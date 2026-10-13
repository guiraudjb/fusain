// Carte mentale : arborescence éditable
import { h, bouton, champTexte, champSelect } from '../dom.js';
import { echapper, desechapper, sansGuillemets, separerPreambule, marquer } from './commun.js';

// [nom, ouvrant, fermant, libellé] — ouvrants les plus longs d'abord
const FORMES = [
    ['cercle', '((', '))', 'Cercle'],
    ['explosion', '))', '((', 'Explosion'],
    ['hexagone', '{{', '}}', 'Hexagone'],
    ['carre', '[', ']', 'Rectangle'],
    ['arrondi', '(', ')', 'Rectangle arrondi'],
    ['nuage', ')', '(', 'Nuage'],
];
const LISTE_FORMES = [['defaut', 'Texte simple'], ...FORMES.map((f) => [f[0], f[3]])];
const TEXTE_NU = /^[^[\](){}"`:\n]+$/;

function lireNoeud(ligne) {
    const id = ligne.match(/^[\p{L}\p{N}_-]+/u)?.[0] || '';
    const reste = ligne.slice(id.length);
    const forme = FORMES.find((f) => reste.startsWith(f[1]) && reste.endsWith(f[2]) && reste.length >= f[1].length + f[2].length);
    if (forme) return { texte: desechapper(sansGuillemets(reste.slice(forme[1].length, reste.length - forme[2].length))), forme: forme[0], extras: [], enfants: [] };
    if (!TEXTE_NU.test(ligne)) throw new Error('écriture de nœud non gérée');
    return { texte: ligne, forme: 'defaut', extras: [], enfants: [] };
}

export function analyser(code) {
    const { preambule, corps } = separerPreambule(code);
    if ((corps[0] || '').trim() !== 'mindmap') throw new Error('La première ligne doit être « mindmap ».');
    const modele = { preambule, racine: null };
    const pile = []; // [retrait, noeud]
    corps.slice(1).forEach((brute, n) => {
        const ligne = brute.trim();
        if (!ligne || ligne.startsWith('%%')) return;
        const retrait = brute.match(/^\s*/)[0].replace(/\t/g, '    ').length;
        try {
            if (ligne.startsWith('::')) {
                if (!pile.length) throw new Error('décoration sans nœud');
                pile[pile.length - 1][1].extras.push(ligne);
                return;
            }
            const noeud = lireNoeud(ligne);
            while (pile.length && pile[pile.length - 1][0] >= retrait) pile.pop();
            if (!pile.length) {
                if (modele.racine) throw new Error('une carte mentale n\'a qu\'une seule racine');
                modele.racine = noeud;
            } else pile[pile.length - 1][1].enfants.push(noeud);
            pile.push([retrait, noeud]);
        } catch (e) {
            throw new Error(`Ligne ${n + 2 + preambule.length} : ${e.message}.`);
        }
    });
    if (!modele.racine) throw new Error('La carte mentale est vide.');
    return modele;
}

export function ecrire(modele) {
    const lignes = [...modele.preambule, 'mindmap'];
    let n = 0;
    const parcourir = (noeud, p) => {
        n += 1;
        const marge = '  '.repeat(p);
        const texte = noeud.texte.trim() || 'Sans titre';
        let nomForme = noeud.forme;
        // Un texte simple ne peut pas contenir de caractères de structure : il est alors encadré
        if (nomForme === 'defaut' && !TEXTE_NU.test(texte)) nomForme = 'arrondi';
        const forme = FORMES.find((f) => f[0] === nomForme);
        lignes.push(marge + (forme ? `n${n}${forme[1]}"${echapper(texte)}"${forme[2]}` : texte));
        for (const extra of noeud.extras) lignes.push(marge + extra);
        for (const enfant of noeud.enfants) parcourir(enfant, p + 1);
    };
    parcourir(modele.racine, 1);
    return lignes.join('\n') + '\n';
}

// Les nœuds sont désignés par leur chemin depuis la racine : « r », « r.0 », « r.0.2 »…
function trouver(modele, cle) {
    const indices = cle.split('.').slice(1).map(Number);
    let noeud = modele.racine;
    let parent = null;
    for (const i of indices) { parent = noeud; noeud = noeud?.enfants[i]; }
    return noeud ? { noeud, parent, index: indices[indices.length - 1] ?? 0, cleParent: cle.split('.').slice(0, -1).join('.') } : null;
}

function aplatir(modele) {
    const liste = [];
    const parcourir = (noeud, cle, profondeur) => {
        liste.push({ cle, nom: noeud.texte.replace(/\s+/g, ' '), profondeur });
        noeud.enfants.forEach((e, i) => parcourir(e, `${cle}.${i}`, profondeur + 1));
    };
    parcourir(modele.racine, 'r', 0);
    return liste;
}

export const elements = (modele) => aplatir(modele).map(({ cle, nom }) => ({ cle, nom }));

export function reperer(svg, modele) {
    const prefixe = `${svg.id}-node_`;
    const liste = aplatir(modele);
    for (const g of svg.querySelectorAll('g.mindmap-node')) {
        const i = g.id.startsWith(prefixe) ? Number(g.id.slice(prefixe.length)) : NaN;
        if (liste[i]) marquer(g, liste[i].cle);
    }
}

export const texte = (modele, cle) => trouver(modele, cle)?.noeud.texte ?? null;
export function renommer(modele, cle, valeur) { const t = trouver(modele, cle); if (t && valeur.trim()) t.noeud.texte = valeur.trim(); }
export function supprimer(modele, cle) { const t = trouver(modele, cle); if (t?.parent) t.parent.enfants.splice(t.index, 1); }
export const peutRelier = () => true;

// La poignée d'une idée crée une idée fille
export function relier(modele, de, vers) {
    if (vers) return null;
    const t = trouver(modele, de);
    if (!t) return null;
    t.noeud.enfants.push({ texte: 'Nouvelle idée', forme: 'defaut', extras: [], enfants: [] });
    return `${de}.${t.noeud.enfants.length - 1}`;
}

function arbre(modele, selection, selectionner) {
    const construire = (noeud, cle) => h('li', {},
        h('button', { type: 'button', class: 'fusain-plan__element', 'aria-current': String(cle === selection), onclick: () => selectionner(cle) }, noeud.texte),
        noeud.enfants.length ? h('ul', {}, noeud.enfants.map((e, i) => construire(e, `${cle}.${i}`))) : null);
    return h('ul', { class: 'fusain-plan' }, construire(modele.racine, 'r'));
}

export function panneau(ctx) {
    const { modele, selection, appliquer, selectionner } = ctx;
    const t = selection ? trouver(modele, selection) : null;
    const blocs = [];
    if (t) {
        const cle = selection;
        const maj = (f, suite) => appliquer((m) => f(trouver(m, cle)), suite);
        const frere = (delta) => `${t.cleParent}.${t.index + delta}`;
        blocs.push(h('div', { class: 'fusain-bloc' },
            h('h2', {}, t.parent ? 'Idée sélectionnée' : 'Idée centrale'),
            champTexte('Texte', t.noeud.texte, (v) => maj((x) => { if (v.trim()) x.noeud.texte = v.trim(); }), { multiligne: true, id: 'fusain-champ-texte' }),
            champSelect('Forme', LISTE_FORMES, t.noeud.forme, (v) => maj((x) => { x.noeud.forme = v; })),
            h('div', { class: 'fusain-actions' },
                bouton('Idée fille', { icone: 'add-line', variante: 'secondary', titre: 'Ajouter une idée fille (Tab)', onclick: () => {
                    let nouvelle;
                    appliquer((m) => { nouvelle = relier(m, cle, null); }, () => nouvelle);
                } }),
                t.parent ? bouton('Idée sœur', { icone: 'add-line', titre: 'Ajouter une idée de même niveau (Entrée)', onclick: () => maj((x) => {
                    x.parent.enfants.splice(x.index + 1, 0, { texte: 'Nouvelle idée', forme: 'defaut', extras: [], enfants: [] });
                }, () => frere(1)) }) : null),
            t.parent ? h('div', { class: 'fusain-actions' },
                bouton('Monter', { icone: 'arrow-up-line', seulIcone: true, disabled: t.index === 0, onclick: () => maj((x) => { x.parent.enfants.splice(x.index - 1, 0, x.parent.enfants.splice(x.index, 1)[0]); }, () => frere(-1)) }),
                bouton('Descendre', { icone: 'arrow-down-line', seulIcone: true, disabled: t.index >= t.parent.enfants.length - 1, onclick: () => maj((x) => { x.parent.enfants.splice(x.index + 1, 0, x.parent.enfants.splice(x.index, 1)[0]); }, () => frere(1)) }),
                bouton('Rattacher à l\'idée précédente', { icone: 'arrow-right-s-line', seulIcone: true, disabled: t.index === 0, onclick: () => {
                    let nouvelle;
                    maj((x) => {
                        const precedent = x.parent.enfants[x.index - 1];
                        precedent.enfants.push(x.parent.enfants.splice(x.index, 1)[0]);
                        nouvelle = `${t.cleParent}.${t.index - 1}.${precedent.enfants.length - 1}`;
                    }, () => nouvelle);
                } }),
                bouton('Remonter d\'un niveau', { icone: 'arrow-left-s-line', seulIcone: true, disabled: t.cleParent === 'r', onclick: () => {
                    let nouvelle;
                    appliquer((m) => {
                        const x = trouver(m, cle);
                        const p = trouver(m, x.cleParent);
                        p.parent.enfants.splice(p.index + 1, 0, x.parent.enfants.splice(x.index, 1)[0]);
                        nouvelle = `${p.cleParent}.${p.index + 1}`;
                    }, () => nouvelle);
                } }),
                bouton('Supprimer', { icone: 'delete-bin-line', onclick: () => appliquer((m) => supprimer(m, cle), () => t.cleParent) })) : null));
    } else {
        blocs.push(h('div', { class: 'fusain-bloc' }, h('h2', {}, 'Carte mentale'), h('p', { class: 'fusain-aide' }, 'Sélectionnez une idée sur le schéma ou dans le plan pour la modifier.')));
    }
    blocs.push(h('div', { class: 'fusain-bloc' }, h('h2', {}, 'Plan de la carte'), arbre(modele, selection, selectionner)));
    return blocs;
}

export default { type: 'mindmap', nom: 'Carte mentale', analyser, ecrire, elements, reperer, texte, renommer, supprimer, relier, peutRelier, panneau };
