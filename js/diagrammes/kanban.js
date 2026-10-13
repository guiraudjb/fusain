// Tableau Kanban : colonnes et cartes
import { h, bouton, champTexte, champSelect } from '../dom.js';
import { echapper, desechapper, sansGuillemets, separerPreambule, deplacer, actionsListe, plan, marquer } from './commun.js';

const RE_LIGNE = /^([\p{L}\p{N}_-]+)?\[(.*)\](@\{.*\})?$/u;

export function analyser(code) {
    const { preambule, corps } = separerPreambule(code);
    if ((corps[0] || '').trim() !== 'kanban') throw new Error('La première ligne doit être « kanban ».');
    const modele = { preambule, colonnes: [] };
    let retraitColonne = null;
    corps.slice(1).forEach((brute, n) => {
        const ligne = brute.trim();
        if (!ligne || ligne.startsWith('%%')) return;
        const retrait = brute.match(/^\s*/)[0].replace(/\t/g, '    ').length;
        const m = ligne.match(RE_LIGNE);
        if (!m) throw new Error(`Ligne ${n + 2 + preambule.length} : cette écriture n'est pas gérée par l'édition visuelle.`);
        const element = { texte: desechapper(sansGuillemets(m[2])), meta: m[3] || '' };
        if (retraitColonne === null || retrait <= retraitColonne) {
            retraitColonne = retrait;
            modele.colonnes.push({ ...element, cartes: [] });
        } else modele.colonnes[modele.colonnes.length - 1].cartes.push(element);
    });
    return modele;
}

export function ecrire(modele) {
    const lignes = [...modele.preambule, 'kanban'];
    modele.colonnes.forEach((c, i) => {
        lignes.push(`    c${i + 1}["${echapper(c.texte) || 'Colonne'}"]${c.meta}`);
        c.cartes.forEach((k, j) => lignes.push(`        c${i + 1}k${j + 1}["${echapper(k.texte) || 'Carte'}"]${k.meta}`));
    });
    return lignes.join('\n') + '\n';
}

export function elements(modele) {
    return modele.colonnes.flatMap((c, i) => [{ cle: `c:${i}`, nom: `Colonne : ${c.texte}` }, ...c.cartes.map((k, j) => ({ cle: `k:${i}.${j}`, nom: `— ${k.texte}` }))]);
}

// Colonnes et cartes sont rendues dans l'ordre du code : l'association se fait par le rang
export function reperer(svg, modele) {
    const colonnes = [...svg.querySelectorAll('g.cluster')];
    const cartes = [...svg.querySelectorAll('g.node')];
    const cles = modele.colonnes.flatMap((c, n) => c.cartes.map((_, k) => `k:${n}.${k}`));
    if (colonnes.length === modele.colonnes.length) colonnes.forEach((g, n) => marquer(g, `c:${n}`));
    if (cartes.length === cles.length) cartes.forEach((g, n) => marquer(g, cles[n]));
}

function viser(modele, cle) {
    const [i, j] = cle.slice(2).split('.').map(Number);
    const colonne = modele.colonnes[i];
    return { colonne, i, j, carte: cle.startsWith('k:') ? colonne?.cartes[j] : null, estCarte: cle.startsWith('k:') };
}

export function texte(modele, cle) { const v = viser(modele, cle); return (v.estCarte ? v.carte?.texte : v.colonne?.texte) ?? null; }
export function renommer(modele, cle, valeur) {
    const v = viser(modele, cle);
    const cible = v.estCarte ? v.carte : v.colonne;
    if (cible && valeur.trim()) cible.texte = valeur.trim();
}
export function supprimer(modele, cle) {
    const v = viser(modele, cle);
    if (!v.colonne) return;
    if (v.estCarte) v.colonne.cartes.splice(v.j, 1); else modele.colonnes.splice(v.i, 1);
}
export const peutRelier = () => true;

// La poignée ajoute une carte ; glissée vers une autre colonne (ou l'une de ses cartes), elle y déplace la carte
export function relier(modele, de, vers) {
    const v = viser(modele, de);
    if (!v.colonne) return null;
    if (vers) {
        const cible = viser(modele, vers);
        if (!v.estCarte || !v.carte || !cible.colonne || cible.i === v.i) return null;
        cible.colonne.cartes.push(v.colonne.cartes.splice(v.j, 1)[0]);
        return `k:${cible.i}.${cible.colonne.cartes.length - 1}`;
    }
    const j = v.estCarte ? v.j + 1 : v.colonne.cartes.length;
    v.colonne.cartes.splice(j, 0, { texte: 'Nouvelle carte', meta: '' });
    return `k:${v.i}.${j}`;
}

export function panneau(ctx) {
    const { modele, selection, appliquer, selectionner } = ctx;
    const v = selection ? viser(modele, selection) : null;
    const blocs = [h('div', { class: 'fusain-bloc' },
        h('h2', {}, 'Tableau Kanban'),
        h('div', { class: 'fusain-actions' }, bouton('Ajouter une colonne', { icone: 'add-line', variante: 'secondary', onclick: () => appliquer((m) => { m.colonnes.push({ texte: 'Nouvelle colonne', meta: '', cartes: [] }); }, (m) => `c:${m.colonnes.length - 1}`) })),
        h('p', { class: 'fusain-aide' }, 'Pour changer une carte de colonne, glissez sa pastille « + » sur la colonne voulue, ou utilisez la liste « Colonne ».'))];

    if (v?.estCarte && v.carte) {
        blocs.push(h('div', { class: 'fusain-bloc' },
            h('h2', {}, 'Carte sélectionnée'),
            champTexte('Texte', v.carte.texte, (val) => appliquer((m) => renommer(m, selection, val)), { multiligne: true, id: 'fusain-champ-texte' }),
            champSelect('Colonne', modele.colonnes.map((c, i) => [String(i), c.texte]), String(v.i), (val) => {
                let cle;
                appliquer((m) => { cle = relier(m, selection, `c:${val}`); }, () => cle || selection);
            }),
            actionsListe({
                monter: () => appliquer(() => {}, (m) => `k:${v.i}.${deplacer(m.colonnes[v.i].cartes, v.j, -1)}`),
                descendre: () => appliquer(() => {}, (m) => `k:${v.i}.${deplacer(m.colonnes[v.i].cartes, v.j, 1)}`),
                supprimer: () => appliquer((m) => supprimer(m, selection), () => `c:${v.i}`),
            })));
    } else if (v?.colonne) {
        blocs.push(h('div', { class: 'fusain-bloc' },
            h('h2', {}, 'Colonne sélectionnée'),
            champTexte('Titre', v.colonne.texte, (val) => appliquer((m) => renommer(m, selection, val)), { id: 'fusain-champ-texte' }),
            h('div', { class: 'fusain-actions' }, bouton('Ajouter une carte', { icone: 'add-line', variante: 'secondary', onclick: () => {
                let cle;
                appliquer((m) => { cle = relier(m, selection, null); }, () => cle);
            } })),
            actionsListe({
                monter: () => appliquer(() => {}, (m) => `c:${deplacer(m.colonnes, v.i, -1)}`),
                descendre: () => appliquer(() => {}, (m) => `c:${deplacer(m.colonnes, v.i, 1)}`),
                supprimer: () => appliquer((m) => supprimer(m, selection), () => null),
            })));
    }
    blocs.push(h('div', { class: 'fusain-bloc' }, h('h2', {}, 'Contenu'), plan(elements(modele), selection, selectionner)));
    return blocs;
}

export default { type: 'kanban', nom: 'Tableau Kanban', analyser, ecrire, elements, reperer, texte, renommer, supprimer, relier, peutRelier, panneau };
