// Camembert : tableau libellé / valeur
import { h, bouton, champTexte, champCase, champSelect } from '../dom.js';
import { echapper, desechapper, separerPreambule, deplacer, actionsListe, plan, marquer, lireInit, ecrireInit } from './commun.js';

// Couleurs illustratives du Système de Design de l'État proposées pour les parts
const TEINTES = [['', 'Couleur du thème'], ['#000091', 'Bleu France'], ['#e1000f', 'Rouge Marianne'], ['#009081', 'Vert menthe'], ['#c8aa39', 'Jaune moutarde'], ['#a558a0', 'Violet glycine'], ['#417dc4', 'Bleu écume'], ['#e4794a', 'Orange terre battue'], ['#68a532', 'Vert bourgeon'], ['#aea397', 'Beige gris galet'], ['#c08c65', 'Brun caramel'], ['#3558a2', 'Bleu cumulus'], ['#b7a73f', 'Vert tilleul'], ['#929292', 'Gris'], ['#161616', 'Noir']];

export function analyser(code) {
    const { preambule, corps } = separerPreambule(code);
    const entete = (corps[0] || '').trim().match(/^pie(\s+showData)?(?:\s+title\s+(.*))?$/);
    if (!entete) throw new Error('La première ligne doit être « pie ».');
    const modele = { preambule, valeurs: Boolean(entete[1]), titre: (entete[2] || '').trim(), parts: [] };
    corps.slice(1).forEach((brute, n) => {
        const ligne = brute.trim();
        if (!ligne || ligne.startsWith('%%')) return;
        let m = ligne.match(/^title\s+(.*)$/);
        if (m) { modele.titre = m[1].trim(); return; }
        if (ligne === 'showData') { modele.valeurs = true; return; }
        m = ligne.match(/^"([^"]*)"\s*:\s*(-?\d+(?:\.\d+)?)$/);
        if (!m) throw new Error(`Ligne ${n + 2 + preambule.length} : cette écriture n'est pas gérée par l'édition visuelle.`);
        modele.parts.push({ nom: desechapper(m[1]), valeur: Number(m[2]) });
    });
    return modele;
}

export function ecrire(modele) {
    const lignes = [...modele.preambule, modele.valeurs ? 'pie showData' : 'pie'];
    if (modele.titre) lignes.push(`    title ${modele.titre.replace(/\s+/g, ' ')}`);
    for (const p of modele.parts) lignes.push(`    "${echapper(p.nom).replace(/<br\/>/g, ' ')}" : ${Number.isFinite(p.valeur) && p.valeur > 0 ? p.valeur : 0}`);
    return lignes.join('\n') + '\n';
}

export const elements = (modele) => modele.parts.map((p, i) => ({ cle: `p:${i}`, nom: `${p.nom} : ${p.valeur}` }));

export function reperer(svg, modele) {
    const positives = modele.parts.map((p, i) => [p, i]).filter(([p]) => p.valeur > 0);
    const parts = [...svg.querySelectorAll('path.pieCircle')];
    const legendes = [...svg.querySelectorAll('g.legend')];
    if (parts.length === positives.length) parts.forEach((el, n) => marquer(el, `p:${positives[n][1]}`));
    if (legendes.length === positives.length) legendes.forEach((el, n) => marquer(el, `p:${positives[n][1]}`));
}

export const texte = (modele, cle) => modele.parts[Number(cle.slice(2))]?.nom ?? null;
export function renommer(modele, cle, valeur) { const p = modele.parts[Number(cle.slice(2))]; if (p && valeur.trim()) p.nom = valeur.trim(); }
export function supprimer(modele, cle) { modele.parts.splice(Number(cle.slice(2)), 1); }

// Deux colonnes copiées depuis un tableur : seul le texte brut est lu
function lireTableur(texteColle) {
    const parts = [];
    for (const ligne of texteColle.split(/\r?\n/)) {
        const cellules = ligne.split(/\t|;/).map((c) => c.trim());
        if (cellules.length < 2 || !cellules[0]) continue;
        const valeur = Number(cellules[1].replace(/\s/g, '').replace(',', '.'));
        if (Number.isFinite(valeur) && valeur >= 0) parts.push({ nom: cellules[0].slice(0, 100), valeur });
    }
    return parts;
}

export function panneau(ctx) {
    const { modele, selection, appliquer, selectionner } = ctx;
    const i = selection?.startsWith('p:') ? Number(selection.slice(2)) : -1;
    const part = modele.parts[i];
    const blocs = [h('div', { class: 'fusain-bloc' },
        h('h2', {}, 'Camembert'),
        champTexte('Titre', modele.titre, (v) => appliquer((m) => { m.titre = v.trim(); })),
        champCase('Afficher les valeurs dans la légende', modele.valeurs, (v) => appliquer((m) => { m.valeurs = v; })),
        h('div', { class: 'fusain-actions' }, bouton('Ajouter une part', { icone: 'add-line', variante: 'secondary', onclick: () => {
            appliquer((m) => { m.parts.push({ nom: `Part ${m.parts.length + 1}`, valeur: 10 }); }, (m) => `p:${m.parts.length - 1}`);
        } })),
        champTexte('Coller deux colonnes d\'un tableur (libellé, valeur)', '', (v) => {
            const parts = lireTableur(v);
            if (parts.length) appliquer((m) => { m.parts = parts; }, () => null);
        }, { multiligne: true, placeholder: 'Libellé	Valeur' }))];

    if (part) {
        blocs.push(h('div', { class: 'fusain-bloc' },
            h('h2', {}, 'Part sélectionnée'),
            champTexte('Libellé', part.nom, (v) => appliquer((m) => { if (v.trim()) m.parts[i].nom = v.trim(); }), { id: 'fusain-champ-texte' }),
            champSelect('Couleur', TEINTES, lireInit(modele.preambule).themeVariables?.[`pie${i + 1}`] || '', (v) => appliquer((m) => {
                const config = lireInit(m.preambule);
                config.themeVariables = { ...config.themeVariables, [`pie${i + 1}`]: v };
                ecrireInit(m.preambule, config);
            })),
            champTexte('Valeur', part.valeur, (v) => appliquer((m) => { const n = Number(String(v).replace(',', '.')); if (Number.isFinite(n) && n >= 0) m.parts[i].valeur = n; }), { type: 'number', min: 0, step: 'any' }),
            actionsListe({
                monter: () => appliquer((m) => {}, (m) => `p:${deplacer(m.parts, i, -1)}`),
                descendre: () => appliquer((m) => {}, (m) => `p:${deplacer(m.parts, i, 1)}`),
                supprimer: () => appliquer((m) => { m.parts.splice(i, 1); }, () => null),
            })));
    }
    blocs.push(h('div', { class: 'fusain-bloc' }, h('h2', {}, 'Parts'), plan(elements(modele), selection, selectionner)));
    return blocs;
}

export default { type: 'pie', nom: 'Camembert', analyser, ecrire, elements, reperer, texte, renommer, supprimer, panneau };
