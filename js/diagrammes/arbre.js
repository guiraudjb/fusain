// Schémas en arbre, écrits par retrait : diagramme d'Ishikawa (causes et effet) et arborescence (treeView de Mermaid).
// Même édition que la carte mentale : renommer, ajouter une branche fille ou sœur, déplacer, changer de niveau.
import { h, bouton, champTexte } from '../dom.js';
import { separerPreambule, marquer } from './commun.js';

// Un texte tient sur une ligne ; il ne doit pas pouvoir passer pour un commentaire, ni fermer sa chaîne entre guillemets
const propre = (t) => String(t).replace(/\s+/g, ' ').trim();
const ecrireTexte = (t, guillemets) => {
    let texte = propre(t) || 'Sans titre';
    if (texte.startsWith('%%')) texte = `​${texte}`;
    // Entre guillemets, un texte qui commence comme un mot-clé (« title… ») reste un texte
    return guillemets ? `"${texte.replace(/"/g, '”')}"` : texte;
};
const comparable = (t) => String(t).replace(/[\s​]+/g, '');

function fabriquer({ type, entete, nom, unique, nouveau, guillemets, aide, quoi, marques }) {
    function analyser(code) {
        const { preambule, corps } = separerPreambule(code);
        if ((corps[0] || '').trim() !== entete) throw new Error(`La première ligne doit être « ${entete} ».`);
        // Racine virtuelle : ses enfants sont les branches de premier niveau
        const modele = { preambule, racine: { texte: '', enfants: [] } };
        const pile = [[-1, modele.racine]];
        corps.slice(1).forEach((brute, n) => {
            const ligne = brute.trim();
            if (!ligne || ligne.startsWith('%%')) return;
            const retrait = brute.match(/^\s*/)[0].replace(/\t/g, '    ').length;
            while (pile.length > 1 && pile[pile.length - 1][0] >= retrait) pile.pop();
            const noeud = { texte: ligne.replace(/^​/, '').replace(/^"(.*)"$/, '$1'), enfants: [] };
            if (unique && pile.length === 1 && modele.racine.enfants.length) throw new Error(`Ligne ${n + 2 + preambule.length} : ${quoi.racine} est unique ; les autres lignes doivent être en retrait.`);
            pile[pile.length - 1][1].enfants.push(noeud);
            pile.push([retrait, noeud]);
        });
        if (!modele.racine.enfants.length) throw new Error(`${nom} : aucun élément.`);
        return modele;
    }

    function ecrire(modele) {
        const lignes = [...modele.preambule, entete];
        const parcourir = (noeud, p) => {
            lignes.push(`${'    '.repeat(p)}${ecrireTexte(noeud.texte, guillemets)}`);
            for (const e of noeud.enfants) parcourir(e, p + 1);
        };
        for (const e of modele.racine.enfants) parcourir(e, 1);
        return lignes.join('\n') + '\n';
    }

    // Les éléments sont désignés par leur chemin : « r.0 », « r.0.2 »…
    function trouver(modele, cle) {
        const indices = cle.split('.').slice(1).map(Number);
        let noeud = modele.racine;
        let parent = null;
        for (const i of indices) { parent = noeud; noeud = noeud?.enfants[i]; }
        return noeud && parent ? { noeud, parent, index: indices[indices.length - 1], cleParent: cle.split('.').slice(0, -1).join('.') } : null;
    }

    function aplatir(modele) {
        const liste = [];
        const parcourir = (noeud, cle, profondeur) => {
            liste.push({ cle, nom: propre(noeud.texte), profondeur });
            noeud.enfants.forEach((e, i) => parcourir(e, `${cle}.${i}`, profondeur + 1));
        };
        modele.racine.enfants.forEach((e, i) => parcourir(e, `r.${i}`, 0));
        return liste;
    }

    const elements = (modele) => aplatir(modele).map(({ cle, nom }) => ({ cle, nom }));

    // Mermaid ne numérote pas ses éléments : ils sont retrouvés par leur texte, dans l'ordre du code
    function reperer(svg, modele) {
        const restants = aplatir(modele);
        for (const el of svg.querySelectorAll(marques)) {
            const t = comparable(el.textContent);
            const i = restants.findIndex((x) => comparable(x.nom) === t);
            if (i < 0) continue;
            marquer(el.closest('g[class^="ishikawa-"]:not(.ishikawa):not(.ishikawa-pair)') || el, restants[i].cle);
            restants.splice(i, 1);
        }
    }

    const texte = (modele, cle) => trouver(modele, cle)?.noeud.texte ?? null;
    function renommer(modele, cle, valeur) { const t = trouver(modele, cle); if (t && propre(valeur)) t.noeud.texte = propre(valeur); }
    function supprimer(modele, cle) {
        const t = trouver(modele, cle);
        if (!t || (t.parent === modele.racine && modele.racine.enfants.length === 1)) return;
        t.parent.enfants.splice(t.index, 1);
    }
    const peutRelier = () => true;
    function relier(modele, de, vers) {
        if (vers) return null;
        const t = trouver(modele, de);
        if (!t) return null;
        t.noeud.enfants.push({ texte: nouveau(t.cleParent === 'r' ? 1 : 2), enfants: [] });
        return `${de}.${t.noeud.enfants.length - 1}`;
    }

    function plan(modele, selection, selectionner) {
        const construire = (noeud, cle) => h('li', {},
            h('button', { type: 'button', class: 'fusain-plan__element', 'aria-current': String(cle === selection), onclick: () => selectionner(cle) }, noeud.texte),
            noeud.enfants.length ? h('ul', {}, noeud.enfants.map((e, i) => construire(e, `${cle}.${i}`))) : null);
        return h('ul', { class: 'fusain-plan' }, modele.racine.enfants.map((e, i) => construire(e, `r.${i}`)));
    }

    function panneau(ctx) {
        const { modele, selection, appliquer, selectionner } = ctx;
        const t = selection ? trouver(modele, selection) : null;
        const blocs = [];
        if (t) {
            const cle = selection;
            const niveau = cle.split('.').length - 1;
            const maj = (f, suite) => appliquer((m) => f(trouver(m, cle)), suite);
            const frere = (delta) => `${t.cleParent}.${t.index + delta}`;
            const racineUnique = unique && t.parent === modele.racine;
            blocs.push(h('div', { class: 'fusain-bloc' },
                h('h2', {}, quoi.niveau(niveau)),
                champTexte('Texte', t.noeud.texte, (v) => maj((x) => { if (propre(v)) x.noeud.texte = propre(v); }), { id: 'fusain-champ-texte' }),
                h('div', { class: 'fusain-actions' },
                    bouton(quoi.fille, { icone: 'add-line', variante: 'secondary', onclick: () => {
                        let nouvelle;
                        appliquer((m) => { nouvelle = relier(m, cle, null); }, () => nouvelle);
                    } }),
                    racineUnique ? null : bouton(quoi.soeur, { icone: 'add-line', onclick: () => maj((x) => {
                        x.parent.enfants.splice(x.index + 1, 0, { texte: nouveau(niveau), enfants: [] });
                    }, () => frere(1)) })),
                racineUnique ? null : h('div', { class: 'fusain-actions' },
                    bouton('Monter', { icone: 'arrow-up-line', seulIcone: true, disabled: t.index === 0, onclick: () => maj((x) => { x.parent.enfants.splice(x.index - 1, 0, x.parent.enfants.splice(x.index, 1)[0]); }, () => frere(-1)) }),
                    bouton('Descendre', { icone: 'arrow-down-line', seulIcone: true, disabled: t.index >= t.parent.enfants.length - 1, onclick: () => maj((x) => { x.parent.enfants.splice(x.index + 1, 0, x.parent.enfants.splice(x.index, 1)[0]); }, () => frere(1)) }),
                    bouton('Rattacher à l\'élément précédent', { icone: 'arrow-right-s-line', seulIcone: true, disabled: t.index === 0, onclick: () => {
                        let nouvelle;
                        maj((x) => {
                            const precedent = x.parent.enfants[x.index - 1];
                            precedent.enfants.push(x.parent.enfants.splice(x.index, 1)[0]);
                            nouvelle = `${t.cleParent}.${t.index - 1}.${precedent.enfants.length - 1}`;
                        }, () => nouvelle);
                    } }),
                    bouton('Remonter d\'un niveau', { icone: 'arrow-left-s-line', seulIcone: true, disabled: t.cleParent === 'r' || (unique && t.cleParent.split('.').length === 2), onclick: () => {
                        let nouvelle;
                        appliquer((m) => {
                            const x = trouver(m, cle);
                            const p = trouver(m, x.cleParent);
                            p.parent.enfants.splice(p.index + 1, 0, x.parent.enfants.splice(x.index, 1)[0]);
                            nouvelle = `${p.cleParent}.${p.index + 1}`;
                        }, () => nouvelle);
                    } }),
                    bouton('Supprimer', { icone: 'delete-bin-line', onclick: () => appliquer((m) => supprimer(m, cle), () => (t.cleParent === 'r' ? null : t.cleParent)) }))));
        } else {
            blocs.push(h('div', { class: 'fusain-bloc' }, h('h2', {}, nom), h('p', { class: 'fusain-aide' }, aide),
                unique ? null : h('div', { class: 'fusain-actions' }, bouton(quoi.soeur, { icone: 'add-line', variante: 'secondary', onclick: () => appliquer((m) => { m.racine.enfants.push({ texte: nouveau(0), enfants: [] }); }, (m) => `r.${m.racine.enfants.length - 1}`) }))));
        }
        blocs.push(h('div', { class: 'fusain-bloc' }, h('h2', {}, 'Plan'), plan(modele, selection, selectionner)));
        return blocs;
    }

    return { type, nom, analyser, ecrire, elements, reperer, texte, renommer, supprimer, relier, peutRelier, panneau };
}

export const ishikawa = fabriquer({
    type: 'ishikawa', entete: 'ishikawa', nom: 'Diagramme d\'Ishikawa', unique: true, guillemets: false,
    marques: '.ishikawa-head-label, .ishikawa-label',
    nouveau: (niveau) => (niveau <= 1 ? 'Nouvelle catégorie' : 'Nouvelle cause'),
    aide: 'Sélectionnez l\'effet, une catégorie ou une cause sur le schéma ou dans le plan. La poignée « + » ajoute une cause.',
    quoi: { racine: 'l\'effet étudié', fille: 'Cause', soeur: 'Cause de même niveau', niveau: (n) => (n === 1 ? 'Effet étudié' : n === 2 ? 'Catégorie de causes' : 'Cause') },
});

export const arborescence = fabriquer({
    type: 'treeView', entete: 'treeView-beta', nom: 'Arborescence', unique: false, guillemets: true,
    marques: '.treeView-node-label',
    nouveau: () => 'Nouvel élément',
    aide: 'Sélectionnez un élément sur le schéma ou dans le plan. La poignée « + » ajoute un élément enfant.',
    quoi: { racine: 'la racine', fille: 'Élément enfant', soeur: 'Élément de même niveau', niveau: (n) => (n === 1 ? 'Élément de premier niveau' : `Élément de niveau ${n}`) },
});
