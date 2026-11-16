// Carte de Wardley (wardley-beta de Mermaid) : ancres et composants placés par visibilité et évolution,
// dépendances, évolutions prévues et notes. Un composant se déplace à la souris sur la carte.
import { h, s, bouton, champTexte, champSelect } from '../dom.js';
import { separerPreambule, plan, marquer, marquerLien, actionsListe } from './commun.js';

const GENRES = [['component', 'Composant'], ['anchor', 'Ancre (besoin de l\'usager)']];
const DECORS = [['', 'Aucune'], ['inertia', 'Inertie'], ['build', 'Fait maison (build)'], ['buy', 'Acheté (buy)'], ['outsource', 'Externalisé (outsource)'], ['market', 'Marché (market)']];
const FLECHES = [['->', 'Dépendance'], ['+>', 'Flux']];
const NOM = String.raw`(?:"([^"]+)"|([\p{L}\p{N}_.-]+))`;
const POSITION = String.raw`\[\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*\]`;
const RE_ELEMENT = new RegExp(`^(component|anchor)\\s+${NOM}\\s*${POSITION}(?:\\s*\\((inertia|build|buy|outsource|market)\\))?$`, 'u');
const RE_LIEN = new RegExp(`^${NOM}\\s*(->|\\+>)\\s*${NOM}$`, 'u');
const RE_EVOLUTION = new RegExp(`^evolve\\s+${NOM}\\s+(-?\\d*\\.?\\d+)$`, 'u');
const RE_NOTE = new RegExp(`^note\\s+"([^"]*)"\\s*${POSITION}$`, 'u');

// Les noms vont entre guillemets droits : ceux qu'ils contiendraient deviennent typographiques
const propre = (t) => String(t ?? '').replace(/\s+/g, ' ').replace(/"/g, '”').trim();
const borne = (v) => Math.min(1, Math.max(0, Number(v) || 0));
const nombre = (v) => borne(v).toFixed(2);
const cite = (nom) => `"${propre(nom)}"`;

export function analyser(code) {
    const { preambule, corps } = separerPreambule(code);
    if ((corps[0] || '').trim() !== 'wardley-beta') throw new Error('La première ligne doit être « wardley-beta ».');
    const modele = { preambule, titre: '', elements: [], liens: [], evolutions: [], notes: [], brut: [] };
    let profondeur = 0;
    corps.slice(1).forEach((brute) => {
        const ligne = brute.trim();
        if (!ligne || ligne.startsWith('%%')) return;
        // Bloc entre accolades (pipeline…) : gardé tel quel
        if (profondeur > 0 || /\{\s*$/.test(ligne)) {
            modele.brut.push(brute.replace(/^ {4}/, '').trimEnd());
            profondeur += (ligne.match(/\{/g) || []).length - (ligne.match(/\}/g) || []).length;
            return;
        }
        if (/^title\s/.test(ligne)) { modele.titre = ligne.slice(6).trim(); return; }
        let m = ligne.match(RE_ELEMENT);
        if (m) { modele.elements.push({ genre: m[1], nom: m[2] ?? m[3], vis: Number(m[4]), evo: Number(m[5]), decor: m[6] || '' }); return; }
        m = ligne.match(RE_LIEN);
        if (m) { modele.liens.push({ de: m[1] ?? m[2], fleche: m[3], vers: m[4] ?? m[5] }); return; }
        m = ligne.match(RE_EVOLUTION);
        if (m) { modele.evolutions.push({ nom: m[1] ?? m[2], cible: Number(m[3]) }); return; }
        m = ligne.match(RE_NOTE);
        if (m) { modele.notes.push({ texte: m[1], vis: Number(m[2]), evo: Number(m[3]) }); return; }
        modele.brut.push(ligne);
    });
    return modele;
}

export function ecrire(modele) {
    const lignes = [...modele.preambule, 'wardley-beta'];
    if (propre(modele.titre)) lignes.push(`    title ${propre(modele.titre)}`);
    for (const b of modele.brut.filter((x) => /^size\b/.test(x))) lignes.push(`    ${b}`);
    for (const e of modele.elements) lignes.push(`    ${e.genre} ${cite(e.nom)} [${nombre(e.vis)}, ${nombre(e.evo)}]${e.decor ? ` (${e.decor})` : ''}`);
    const noms = new Set(modele.elements.map((e) => propre(e.nom)));
    // Une dépendance ou une évolution vers un composant disparu ferait échouer le rendu : elle n'est pas écrite
    for (const l of modele.liens) if (noms.has(propre(l.de)) && noms.has(propre(l.vers))) lignes.push(`    ${cite(l.de)} ${l.fleche} ${cite(l.vers)}`);
    for (const v of modele.evolutions) if (noms.has(propre(v.nom))) lignes.push(`    evolve ${cite(v.nom)} ${nombre(v.cible)}`);
    for (const n of modele.notes) lignes.push(`    note "${propre(n.texte)}" [${nombre(n.vis)}, ${nombre(n.evo)}]`);
    for (const b of modele.brut.filter((x) => !/^size\b/.test(x))) lignes.push(`    ${b}`);
    return lignes.join('\n') + '\n';
}

const nomGenre = (g) => (g === 'anchor' ? 'Ancre' : 'Composant');
export const elements = (modele) => [
    ...modele.elements.map((e, i) => ({ cle: `c:${i}`, nom: `${nomGenre(e.genre)} : ${e.nom}` })),
    ...modele.liens.map((l, i) => ({ cle: `l:${i}`, nom: `${l.de} ${l.fleche === '+>' ? '⇒' : '→'} ${l.vers}` })),
    ...modele.notes.map((n, i) => ({ cle: `n:${i}`, nom: `Note : ${n.texte}` })),
];

export function reperer(svg, modele) {
    // Composants et ancres : retrouvés par leur nom (Mermaid les dessine dans l'ordre du code)
    const restants = modele.elements.map((e, i) => ({ i, nom: propre(e.nom) }));
    for (const g of svg.querySelectorAll('g.wardley-node')) {
        const k = restants.findIndex((e) => e.nom === propre(g.querySelector('.wardley-node-label')?.textContent));
        if (k >= 0) { marquer(g, `c:${restants[k].i}`); restants.splice(k, 1); }
    }
    const noms = new Set(modele.elements.map((e) => propre(e.nom)));
    const liens = modele.liens.map((l, i) => [l, i]).filter(([l]) => noms.has(propre(l.de)) && noms.has(propre(l.vers)));
    const traits = [...svg.querySelectorAll('line.wardley-link, path.wardley-link')];
    if (traits.length === liens.length) traits.forEach((t, k) => marquerLien(t, `l:${liens[k][1]}`));
    const notes = [...svg.querySelectorAll('g.wardley-notes > text, g.wardley-notes > g')];
    if (notes.length === modele.notes.length) notes.forEach((t, i) => marquer(t, `n:${i}`));
    // Zone de déplacement : le cadre des axes (évolution en abscisse, visibilité en ordonnée)
    const axes = [...svg.querySelectorAll('g.wardley-axes > line')].map((l) => ['x1', 'y1', 'x2', 'y2'].map((a) => Number(l.getAttribute(a))));
    if (axes.length >= 2) {
        const xs = axes.flatMap(([x1, , x2]) => [x1, x2]);
        const ys = axes.flatMap(([, y1, , y2]) => [y1, y2]);
        const [x, y] = [Math.min(...xs), Math.min(...ys)];
        const cadre = s('rect', { class: 'fusain-zone-wardley', x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y, fill: 'none', 'pointer-events': 'none' });
        svg.querySelector('g.wardley-map')?.insertBefore(cadre, svg.querySelector('g.wardley-links'));
    }
}

export const zoneDeplacement = (svg) => svg.querySelector('.fusain-zone-wardley');
export const deplacable = (cle) => /^[cn]:/.test(cle);
export function deplacer(modele, cle, x, y) {
    const cible = (cle.startsWith('c:') ? modele.elements : modele.notes)[Number(cle.slice(2))];
    if (!cible) return;
    cible.evo = Number(nombre(x));
    cible.vis = Number(nombre(y));
}

export function texte(modele, cle) {
    const i = Number(cle.slice(2));
    if (cle.startsWith('c:')) return modele.elements[i]?.nom ?? null;
    if (cle.startsWith('n:')) return modele.notes[i]?.texte ?? null;
    return null;
}

// Renommer un composant renomme aussi ses dépendances et son évolution
function renommerComposant(modele, i, nom) {
    const e = modele.elements[i];
    const v = propre(nom);
    if (!e || !v || modele.elements.some((x, k) => k !== i && propre(x.nom) === v)) return;
    const ancien = propre(e.nom);
    for (const l of modele.liens) { if (propre(l.de) === ancien) l.de = v; if (propre(l.vers) === ancien) l.vers = v; }
    for (const ev of modele.evolutions) if (propre(ev.nom) === ancien) ev.nom = v;
    e.nom = v;
}

export function renommer(modele, cle, valeur) {
    const i = Number(cle.slice(2));
    if (cle.startsWith('c:')) renommerComposant(modele, i, valeur);
    if (cle.startsWith('n:') && modele.notes[i] && propre(valeur)) modele.notes[i].texte = propre(valeur);
}

export function supprimer(modele, cle) {
    const i = Number(cle.slice(2));
    if (cle.startsWith('c:')) {
        const [e] = modele.elements.splice(i, 1);
        if (!e) return;
        const nom = propre(e.nom);
        modele.liens = modele.liens.filter((l) => propre(l.de) !== nom && propre(l.vers) !== nom);
        modele.evolutions = modele.evolutions.filter((v) => propre(v.nom) !== nom);
    }
    if (cle.startsWith('l:')) modele.liens.splice(i, 1);
    if (cle.startsWith('n:')) modele.notes.splice(i, 1);
}

export const peutRelier = (cle) => cle.startsWith('c:');
export function relier(modele, de, vers) {
    const a = modele.elements[Number(de.slice(2))];
    if (!a) return de;
    let b = vers && vers.startsWith('c:') && vers !== de ? modele.elements[Number(vers.slice(2))] : null;
    if (!b) {
        // Nouveau composant, placé sous le composant d'origine (moins visible)
        b = { genre: 'component', nom: nomLibre(modele), vis: Math.max(0, a.vis - 0.15), evo: a.evo, decor: '' };
        modele.elements.push(b);
    }
    modele.liens.push({ de: a.nom, fleche: '->', vers: b.nom });
    return `l:${modele.liens.length - 1}`;
}

function nomLibre(modele) {
    let n = 1;
    while (modele.elements.some((e) => propre(e.nom) === `Composant ${n}`)) n += 1;
    return `Composant ${n}`;
}

const champNombre = (libelle, valeur, surChangement) => champTexte(libelle, String(valeur ?? ''), (v) => {
    const n = parseFloat(String(v).replace(',', '.'));
    if (Number.isFinite(n)) surChangement(borne(n));
}, { inputmode: 'decimal' });

export function panneau(ctx) {
    const { modele, selection, appliquer, selectionner } = ctx;
    const i = selection ? Number(selection.slice(2)) : -1;
    const blocs = [h('div', { class: 'fusain-bloc' },
        h('h2', {}, 'Carte de Wardley'),
        champTexte('Titre', modele.titre, (v) => appliquer((m) => { m.titre = propre(v); })),
        h('div', { class: 'fusain-actions' },
            bouton('Composant', { icone: 'add-line', variante: 'secondary', onclick: () => appliquer((m) => { m.elements.push({ genre: 'component', nom: nomLibre(m), vis: 0.5, evo: 0.5, decor: '' }); }, (m) => `c:${m.elements.length - 1}`) }),
            bouton('Ancre', { icone: 'add-line', onclick: () => appliquer((m) => { m.elements.push({ genre: 'anchor', nom: 'Usager', vis: 0.95, evo: 0.5, decor: '' }); }, (m) => `c:${m.elements.length - 1}`) }),
            bouton('Note', { icone: 'add-line', onclick: () => appliquer((m) => { m.notes.push({ texte: 'Nouvelle note', vis: 0.2, evo: 0.8 }); }, (m) => `n:${m.notes.length - 1}`) })),
        h('p', { class: 'fusain-aide' }, 'Glissez un composant ou une note sur la carte pour le placer. Visibilité : 0 en bas, 1 en haut ; évolution : 0 genèse, 1 produit courant.'))];

    if (selection?.startsWith('c:') && modele.elements[i]) {
        const e = modele.elements[i];
        const maj = (f) => appliquer((m) => f(m.elements[i], m));
        const evolution = modele.evolutions.find((v) => propre(v.nom) === propre(e.nom));
        const autres = modele.elements.filter((x, k) => k !== i).map((x) => [x.nom, x.nom]);
        blocs.push(h('div', { class: 'fusain-bloc' }, h('h2', {}, `${nomGenre(e.genre)} sélectionné${e.genre === 'anchor' ? 'e' : ''}`),
            champTexte('Nom', e.nom, (v) => appliquer((m) => renommerComposant(m, i, v)), { id: 'fusain-champ-texte' }),
            champSelect('Nature', GENRES, e.genre, (v) => maj((x) => { x.genre = v; if (v === 'anchor') x.decor = ''; })),
            h('div', { class: 'fusain-ligne' },
                champNombre('Visibilité (0 à 1)', e.vis, (v) => maj((x) => { x.vis = v; })),
                champNombre('Évolution (0 à 1)', e.evo, (v) => maj((x) => { x.evo = v; }))),
            e.genre === 'component' ? champSelect('Mode de fourniture', DECORS, e.decor, (v) => maj((x) => { x.decor = v; })) : null,
            champTexte('Évolution prévue vers (vide : aucune)', evolution ? String(evolution.cible) : '', (v) => maj((x, m) => {
                const n = parseFloat(String(v).replace(',', '.'));
                m.evolutions = m.evolutions.filter((ev) => propre(ev.nom) !== propre(x.nom));
                if (Number.isFinite(n)) m.evolutions.push({ nom: x.nom, cible: borne(n) });
            }), { inputmode: 'decimal' }),
            autres.length ? champSelect('Ajouter une dépendance vers…', [['', 'Choisir un composant'], ...autres], '', (v) => {
                if (v) appliquer((m) => { m.liens.push({ de: m.elements[i].nom, fleche: '->', vers: v }); }, (m) => `l:${m.liens.length - 1}`);
            }) : null,
            actionsListe({ supprimer: () => appliquer((m) => supprimer(m, selection), () => null) })));
    } else if (selection?.startsWith('l:') && modele.liens[i]) {
        const l = modele.liens[i];
        const noms = modele.elements.map((x) => [x.nom, x.nom]);
        const maj = (f) => appliquer((m) => f(m.liens[i]));
        blocs.push(h('div', { class: 'fusain-bloc' }, h('h2', {}, 'Dépendance sélectionnée'),
            h('div', { class: 'fusain-ligne' },
                champSelect('De', noms, l.de, (v) => maj((x) => { x.de = v; })),
                champSelect('Vers', noms, l.vers, (v) => maj((x) => { x.vers = v; }))),
            champSelect('Nature', FLECHES, l.fleche, (v) => maj((x) => { x.fleche = v; })),
            actionsListe({ extra: [bouton('Inverser', { icone: 'arrow-left-right-line', onclick: () => maj((x) => { [x.de, x.vers] = [x.vers, x.de]; }) })], supprimer: () => appliquer((m) => supprimer(m, selection), () => null) })));
    } else if (selection?.startsWith('n:') && modele.notes[i]) {
        const n = modele.notes[i];
        const maj = (f) => appliquer((m) => f(m.notes[i]));
        blocs.push(h('div', { class: 'fusain-bloc' }, h('h2', {}, 'Note sélectionnée'),
            champTexte('Texte', n.texte, (v) => appliquer((m) => renommer(m, selection, v)), { id: 'fusain-champ-texte' }),
            h('div', { class: 'fusain-ligne' },
                champNombre('Visibilité (0 à 1)', n.vis, (v) => maj((x) => { x.vis = v; })),
                champNombre('Évolution (0 à 1)', n.evo, (v) => maj((x) => { x.evo = v; }))),
            actionsListe({ supprimer: () => appliquer((m) => supprimer(m, selection), () => null) })));
    }
    blocs.push(h('div', { class: 'fusain-bloc' }, h('h2', {}, 'Contenu'), plan(elements(modele), selection, selectionner)));
    return blocs;
}

export default { type: 'wardley', nom: 'Carte de Wardley', analyser, ecrire, elements, reperer, texte, renommer, supprimer, relier, peutRelier, deplacer, deplacable, zoneDeplacement, panneau };
