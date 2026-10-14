// Diagramme de Venn (venn-beta de Mermaid) : ensembles, intersections nommées, tailles relatives
import { h, bouton, champTexte, champCase } from '../dom.js';
import { separerPreambule, plan, marquer, actionsListe } from './commun.js';

const ID = /^[A-Za-z][A-Za-z0-9_]*$/;
const propre = (t) => String(t ?? '').replace(/\s+/g, ' ').replace(/"/g, '”').replace(/[[\]]/g, '').trim();
const ENSEMBLES_MAX = 6;

function lireEnonce(reste) {
    // « A["Libellé"]: 20 », « A,B["Libellé"] », « A »
    const m = reste.match(/^([A-Za-z0-9_,\s]+?)\s*(?:\["([^"]*)"\])?\s*(?::\s*([+-]?\d+(?:\.\d+)?))?$/);
    if (!m) return null;
    return { ids: m[1].split(',').map((x) => x.trim()), texte: m[2] ?? '', taille: m[3] === undefined ? null : Number(m[3]) };
}

export function analyser(code) {
    const { preambule, corps } = separerPreambule(code);
    if ((corps[0] || '').trim() !== 'venn-beta') throw new Error('La première ligne doit être « venn-beta ».');
    const modele = { preambule, titre: '', ensembles: [], unions: [], brut: [] };
    corps.slice(1).forEach((brute, n) => {
        const ligne = brute.trim();
        if (!ligne || ligne.startsWith('%%')) return;
        const erreur = (t) => new Error(`Ligne ${n + 2 + preambule.length} : ${t}`);
        if (/^title\s/.test(ligne)) { modele.titre = ligne.slice(6).trim(); return; }
        const m = ligne.match(/^(set|union)\s+(.*)$/);
        if (!m) { modele.brut.push(ligne); return; }
        const e = lireEnonce(m[2]);
        if (!e || !e.ids.every((id) => ID.test(id))) throw erreur('écriture non reconnue.');
        if (m[1] === 'set') {
            if (e.ids.length !== 1 || modele.ensembles.some((x) => x.id === e.ids[0])) throw erreur('ensemble invalide ou en double.');
            modele.ensembles.push({ id: e.ids[0], texte: e.texte, taille: e.taille });
        } else {
            if (e.ids.length < 2 || !e.ids.every((id) => modele.ensembles.some((x) => x.id === id))) throw erreur('une intersection relie au moins deux ensembles déclarés avant elle.');
            modele.unions.push({ ids: e.ids, texte: e.texte, taille: e.taille });
        }
    });
    if (!modele.ensembles.length) throw new Error('Le diagramme ne compte aucun ensemble.');
    return modele;
}

const enonce = (ids, texte, taille) => `${ids.join(',')}${propre(texte) ? `["${propre(texte)}"]` : ''}${taille === null || taille === undefined ? '' : `: ${taille}`}`;

export function ecrire(modele) {
    const lignes = [...modele.preambule, 'venn-beta'];
    if (propre(modele.titre)) lignes.push(`    title ${propre(modele.titre)}`);
    for (const e of modele.ensembles) lignes.push(`    set ${enonce([e.id], e.texte, e.taille)}`);
    // Une intersection ne garde que les ensembles qui existent encore
    for (const u of modele.unions) if (u.ids.length >= 2) lignes.push(`    union ${enonce(u.ids, u.texte, u.taille)}`);
    for (const b of modele.brut) lignes.push(`    ${b}`);
    return lignes.join('\n') + '\n';
}

const nomEnsemble = (modele, id) => modele.ensembles.find((e) => e.id === id)?.texte || id;

export const elements = (modele) => [
    ...modele.ensembles.map((e, i) => ({ cle: `e:${i}`, nom: `Ensemble : ${e.texte || e.id}` })),
    ...modele.unions.map((u, i) => ({ cle: `u:${i}`, nom: `Intersection ${u.ids.map((id) => nomEnsemble(modele, id)).join(' ∩ ')}${u.texte ? ` : ${u.texte}` : ''}` })),
];

export function reperer(svg, modele) {
    modele.ensembles.forEach((_, i) => marquer(svg.querySelector(`g.venn-set-${i}`), `e:${i}`));
    // Les intersections ne portent pas de numéro : elles sont retrouvées par leur libellé
    const restantes = modele.unions.map((u, i) => ({ i, texte: propre(u.texte) })).filter((u) => u.texte);
    for (const g of svg.querySelectorAll('g.venn-intersection')) {
        const k = restantes.findIndex((u) => u.texte === propre(g.textContent));
        if (k >= 0) { marquer(g, `u:${restantes[k].i}`); restantes.splice(k, 1); }
    }
}

const cible = (modele, cle) => (cle.startsWith('e:') ? modele.ensembles : modele.unions)[Number(cle.slice(2))];
export const texte = (modele, cle) => { const c = cible(modele, cle); return c ? c.texte || (c.id ?? '') : null; };
export function renommer(modele, cle, valeur) { const c = cible(modele, cle); if (c) c.texte = propre(valeur); }
export function supprimer(modele, cle) {
    const i = Number(cle.slice(2));
    if (cle.startsWith('u:')) { modele.unions.splice(i, 1); return; }
    if (modele.ensembles.length <= 1) return;
    const [e] = modele.ensembles.splice(i, 1);
    for (const u of modele.unions) u.ids = u.ids.filter((id) => id !== e.id);
    modele.unions = modele.unions.filter((u) => u.ids.length >= 2);
}
export const peutRelier = () => false;

function nouvelId(modele) {
    for (const lettre of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') if (!modele.ensembles.some((e) => e.id === lettre)) return lettre;
    return `E${modele.ensembles.length + 1}`;
}

const taille = (libelle, valeur, surChangement) => champTexte(libelle, valeur ?? '', (v) => {
    const n = parseFloat(String(v).replace(',', '.'));
    surChangement(String(v).trim() === '' || !Number.isFinite(n) ? null : Math.max(0, n));
}, { inputmode: 'decimal' });

export function panneau(ctx) {
    const { modele, selection, appliquer, selectionner } = ctx;
    const blocs = [h('div', { class: 'fusain-bloc' },
        h('h2', {}, 'Diagramme de Venn'),
        champTexte('Titre', modele.titre, (v) => appliquer((m) => { m.titre = propre(v); })),
        h('div', { class: 'fusain-actions' },
            modele.ensembles.length < ENSEMBLES_MAX ? bouton('Ajouter un ensemble', { icone: 'add-line', variante: 'secondary', onclick: () => appliquer((m) => { m.ensembles.push({ id: nouvelId(m), texte: 'Nouvel ensemble', taille: null }); }, (m) => `e:${m.ensembles.length - 1}`) }) : null,
            modele.ensembles.length >= 2 ? bouton('Nommer une intersection', { icone: 'add-line', onclick: () => appliquer((m) => { m.unions.push({ ids: m.ensembles.slice(0, 2).map((e) => e.id), texte: 'Intersection', taille: null }); }, (m) => `u:${m.unions.length - 1}`) }) : null),
        h('p', { class: 'fusain-aide' }, 'La taille, facultative, règle la surface relative d\'un ensemble ou d\'une intersection.'))];

    const i = selection ? Number(selection.slice(2)) : -1;
    if (selection?.startsWith('e:') && modele.ensembles[i]) {
        const e = modele.ensembles[i];
        blocs.push(h('div', { class: 'fusain-bloc' }, h('h2', {}, 'Ensemble sélectionné'),
            champTexte('Libellé', e.texte, (v) => appliquer((m) => { m.ensembles[i].texte = propre(v); }), { id: 'fusain-champ-texte' }),
            taille('Taille (facultative)', e.taille, (v) => appliquer((m) => { m.ensembles[i].taille = v; })),
            actionsListe({ supprimer: modele.ensembles.length > 1 ? () => appliquer((m) => supprimer(m, selection), () => null) : null })));
    } else if (selection?.startsWith('u:') && modele.unions[i]) {
        const u = modele.unions[i];
        blocs.push(h('div', { class: 'fusain-bloc' }, h('h2', {}, 'Intersection sélectionnée'),
            champTexte('Libellé', u.texte, (v) => appliquer((m) => { m.unions[i].texte = propre(v); }), { id: 'fusain-champ-texte' }),
            h('p', { class: 'fusain-aide' }, 'Ensembles concernés (deux au moins) :'),
            modele.ensembles.map((e) => champCase(e.texte || e.id, u.ids.includes(e.id), (coche) => {
                const ids = coche ? modele.ensembles.map((x) => x.id).filter((id) => id === e.id || u.ids.includes(id)) : u.ids.filter((id) => id !== e.id);
                if (ids.length >= 2) appliquer((m) => { m.unions[i].ids = ids; });
            })),
            taille('Taille (facultative)', u.taille, (v) => appliquer((m) => { m.unions[i].taille = v; })),
            actionsListe({ supprimer: () => appliquer((m) => supprimer(m, selection), () => null) })));
    }
    blocs.push(h('div', { class: 'fusain-bloc' }, h('h2', {}, 'Contenu'), plan(elements(modele), selection, selectionner)));
    return blocs;
}

export default { type: 'venn', nom: 'Diagramme de Venn', analyser, ecrire, elements, reperer, texte, renommer, supprimer, peutRelier, panneau };
