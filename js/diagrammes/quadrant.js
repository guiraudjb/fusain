// Matrice à quatre quadrants : axes, zones et points
import { h, bouton, champTexte } from '../dom.js';
import { separerPreambule, actionsListe, plan, marquer } from './commun.js';

// Les textes d'une matrice ne supportent qu'un jeu de caractères restreint : le reste est retiré
const propre = (t) => String(t).replace(/-->/g, ' ').replace(/[^\p{L}\p{N} .,'’()\-/%?!+°]/gu, ' ').replace(/\s+/g, ' ').trim();
const borne = (v) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0.5));
const NOMS_QUADRANTS = ['En haut à droite', 'En haut à gauche', 'En bas à gauche', 'En bas à droite'];

export function analyser(code) {
    const { preambule, corps } = separerPreambule(code);
    if ((corps[0] || '').trim() !== 'quadrantChart') throw new Error('La première ligne doit être « quadrantChart ».');
    const modele = { preambule, titre: '', x: ['', ''], y: ['', ''], quadrants: ['', '', '', ''], points: [], brut: [] };
    corps.slice(1).forEach((brute, n) => {
        const ligne = brute.trim();
        if (!ligne || ligne.startsWith('%%')) return;
        let m = ligne.match(/^title\s+(.*)$/);
        if (m) { modele.titre = m[1]; return; }
        m = ligne.match(/^([xy])-axis\s+(.*?)(?:\s*-->\s*(.*))?$/);
        if (m) { modele[m[1]] = [m[2].replace(/^"|"$/g, ''), (m[3] || '').replace(/^"|"$/g, '')]; return; }
        m = ligne.match(/^quadrant-([1-4])\s+(.*)$/);
        if (m) { modele.quadrants[m[1] - 1] = m[2].replace(/^"|"$/g, ''); return; }
        m = ligne.match(/^(?:"([^"]*)"|([^:[\]"]+?))\s*:\s*\[\s*([\d.]+)\s*,\s*([\d.]+)\s*\]\s*$/);
        if (m) { modele.points.push({ nom: (m[1] ?? m[2]).trim(), x: borne(Number(m[3])), y: borne(Number(m[4])) }); return; }
        if (/^(classDef|accTitle|accDescr)\s/.test(ligne)) { modele.brut.push(ligne); return; }
        throw new Error(`Ligne ${n + 2 + preambule.length} : cette écriture n'est pas gérée par l'édition visuelle.`);
    });
    return modele;
}

export function ecrire(modele) {
    const lignes = [...modele.preambule, 'quadrantChart'];
    if (propre(modele.titre)) lignes.push(`    title ${propre(modele.titre)}`);
    for (const axe of ['x', 'y']) {
        const [a, b] = modele[axe].map(propre);
        if (a) lignes.push(`    ${axe}-axis ${a}${b ? ` --> ${b}` : ''}`);
    }
    modele.quadrants.forEach((q, i) => { if (propre(q)) lignes.push(`    quadrant-${i + 1} ${propre(q)}`); });
    for (const p of modele.points) lignes.push(`    "${propre(p.nom) || 'Point'}": [${Number(borne(p.x).toFixed(3))}, ${Number(borne(p.y).toFixed(3))}]`);
    for (const b of modele.brut) lignes.push(`    ${b}`);
    return lignes.join('\n') + '\n';
}

export const elements = (modele) => modele.points.map((p, i) => ({ cle: `p:${i}`, nom: `${p.nom} (${p.x} ; ${p.y})` }));

export function reperer(svg, modele) {
    const libres = modele.points.map((p, i) => [propre(p.nom), i]);
    for (const g of svg.querySelectorAll('g.data-point')) {
        const nom = g.textContent.trim();
        const rang = libres.findIndex(([n]) => n === nom);
        if (rang >= 0) marquer(g, `p:${libres.splice(rang, 1)[0][1]}`);
    }
}

export const texte = (modele, cle) => modele.points[Number(cle.slice(2))]?.nom ?? null;
export function renommer(modele, cle, valeur) { const p = modele.points[Number(cle.slice(2))]; if (p && propre(valeur)) p.nom = propre(valeur); }
export function supprimer(modele, cle) { modele.points.splice(Number(cle.slice(2)), 1); }

// Seul type où la position est libre : un point se glisse à la souris dans la matrice
export const zoneDeplacement = (svg) => svg.querySelector('g.quadrants');
export function deplacer(modele, cle, x, y) {
    const p = modele.points[Number(cle.slice(2))];
    if (!p) return;
    p.x = Number(borne(x).toFixed(2));
    p.y = Number(borne(y).toFixed(2));
}

export function panneau(ctx) {
    const { modele, selection, appliquer, selectionner } = ctx;
    const i = selection?.startsWith('p:') ? Number(selection.slice(2)) : -1;
    const point = modele.points[i];
    const axe = (cle, rang, libelle) => champTexte(libelle, modele[cle][rang], (v) => appliquer((m) => { m[cle][rang] = propre(v); }));
    const coordonnee = (cle, libelle) => champTexte(libelle, point[cle], (v) => appliquer((m) => { m.points[i][cle] = borne(Number(String(v).replace(',', '.'))); }), { type: 'number', min: 0, max: 1, step: 0.05 });
    const blocs = [h('div', { class: 'fusain-bloc' },
        h('h2', {}, 'Matrice'),
        champTexte('Titre', modele.titre, (v) => appliquer((m) => { m.titre = propre(v); })),
        h('div', { class: 'fusain-ligne' }, axe('x', 0, 'Axe horizontal : gauche'), axe('x', 1, 'droite')),
        h('div', { class: 'fusain-ligne' }, axe('y', 0, 'Axe vertical : bas'), axe('y', 1, 'haut')),
        h('h3', {}, 'Nom des quatre zones'),
        [[1, 0], [2, 3]].map((paire) => h('div', { class: 'fusain-ligne' }, paire.map((q) => champTexte(NOMS_QUADRANTS[q], modele.quadrants[q], (v) => appliquer((m) => { m.quadrants[q] = propre(v); }))))),
        h('p', { class: 'fusain-aide' }, 'Un point se déplace en le glissant à la souris dans la matrice, ou par ses coordonnées.'),
        h('div', { class: 'fusain-actions' }, bouton('Ajouter un point', { icone: 'add-line', variante: 'secondary', onclick: () => appliquer((m) => { m.points.push({ nom: `Point ${m.points.length + 1}`, x: 0.5, y: 0.5 }); }, (m) => `p:${m.points.length - 1}`) })))];
    if (point) {
        blocs.push(h('div', { class: 'fusain-bloc' },
            h('h2', {}, 'Point sélectionné'),
            champTexte('Nom', point.nom, (v) => appliquer((m) => renommer(m, selection, v)), { id: 'fusain-champ-texte' }),
            h('div', { class: 'fusain-ligne' }, coordonnee('x', 'Position horizontale (0 à 1)'), coordonnee('y', 'Position verticale (0 à 1)')),
            actionsListe({ supprimer: () => appliquer((m) => supprimer(m, selection), () => null) })));
    }
    blocs.push(h('div', { class: 'fusain-bloc' }, h('h2', {}, 'Points'), plan(elements(modele), selection, selectionner)));
    return blocs;
}

export default { type: 'quadrantChart', nom: 'Matrice', analyser, ecrire, elements, reperer, texte, renommer, supprimer, zoneDeplacement, deplacer, panneau };
