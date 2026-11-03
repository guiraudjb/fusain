// Pictogrammes au trait, en noir et blanc, dessinés pour FUSAIN (outils/pictogrammes.py) : un seul fichier de données,
// chargé à la demande. Dans le code Mermaid, un pictogramme s'écrit « picto:nom », par exemple service fw(picto:pare-feu)[Pare-feu].
// Le fichier ne contient que des formes simples et des nombres ; chaque valeur est revérifiée ici avant tout dessin.
import { s } from './dom.js';

export const PREFIXE_PICTO = 'picto';
const BALISES = new Set(['path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon']);
const ATTRIBUTS = new Set(['d', 'x', 'y', 'width', 'height', 'rx', 'ry', 'cx', 'cy', 'r', 'x1', 'y1', 'x2', 'y2', 'points', 'fill', 'stroke', 'stroke-width', 'stroke-dasharray']);
const NOMBRES = /^[0-9MmLlHhVvCcSsQqTtAaZz\s,.+-]+$/;
const NOIR = '#161616';
const COULEURS = new Set(['none', NOIR, '#ffffff']);
const TRAIT = { fill: '#ffffff', stroke: NOIR, 'stroke-width': '2.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
const COTE = 48;

const sur = ([balise, attrs]) => BALISES.has(balise) && attrs && typeof attrs === 'object'
    && Object.entries(attrs).every(([k, v]) => ATTRIBUTS.has(k) && typeof v === 'string' && (k === 'fill' || k === 'stroke' ? COULEURS.has(v) : NOMBRES.test(v)));

let jeu = null;
export function chargerPictogrammes() {
    jeu ||= (async () => {
        const source = document.getElementById('fusain-pictogrammes');
        // L'adresse et l'empreinte viennent de index.html : le navigateur refuse un fichier altéré
        const reponse = await fetch(source.getAttribute('href'), { integrity: source.getAttribute('integrity') || undefined });
        if (!reponse.ok) throw new Error('Les pictogrammes n\'ont pas pu être chargés.');
        const { categories, icones } = await reponse.json();
        const liste = [];
        for (const [id, icone] of Object.entries(icones || {})) {
            if (/^[a-z0-9-]+$/.test(id) && Array.isArray(icone.elements) && icone.elements.every(sur)) {
                liste.push({ id, nom: String(icone.nom || id), categorie: String(icone.categorie || ''), elements: icone.elements });
            }
        }
        return { categories: categories || {}, liste, parId: new Map(liste.map((i) => [i.id, i])) };
    })().catch((e) => { jeu = null; throw e; });
    return jeu;
}

// Dessin dans un carré de « taille » posé en (x, y). La couleur remplace le noir (diapositives, cartes). Dessiné en
// blanc (sur une pastille de couleur), le pictogramme perd ses fonds blancs, qui le rempliraient entièrement.
export function dessinerPictogramme(icone, x, y, taille, couleur = NOIR) {
    const fond = /^#f{3}(f{3})?$/i.test(couleur) ? 'none' : '#ffffff';
    const teinte = (v) => (v === NOIR ? couleur : v === '#ffffff' ? fond : v);
    return s('g', { ...TRAIT, fill: fond, stroke: couleur, transform: `translate(${x} ${y}) scale(${taille / COTE})` },
        ...icone.elements.map(([balise, attrs]) => s(balise, Object.fromEntries(Object.entries(attrs).map(([k, v]) => [k, teinte(v)])))));
}

export async function pictogramme(id) {
    return (await chargerPictogrammes()).parId.get(id) || null;
}

// Jeu au format attendu par Mermaid : texte SVG reconstruit à partir des seules valeurs vérifiées
export async function jeuPourMermaid() {
    const attributs = (a) => Object.entries(a).map(([k, v]) => `${k}="${v}"`).join(' ');
    const icons = {};
    for (const { id, elements } of (await chargerPictogrammes()).liste) {
        icons[id] = { body: `<g ${attributs(TRAIT)} transform="scale(${80 / COTE})">${elements.map(([b, a]) => `<${b} ${attributs(a)}/>`).join('')}</g>` };
    }
    return { prefix: PREFIXE_PICTO, width: 80, height: 80, icons };
}
