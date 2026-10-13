// Outils partagés par les éditeurs visuels
import { h, bouton } from '../dom.js';

// Couleurs proposées pour les éléments : fonds et bordures du Système de Design de l'État
export const COULEURS = [
    ['Couleur du thème', null, null],
    ['Bleu France', '#e3e3fd', '#000091'],
    ['Rouge Marianne', '#fddede', '#c9191e'],
    ['Vert émeraude', '#c3fad5', '#297254'],
    ['Vert menthe', '#bafaee', '#37635f'],
    ['Bleu écume', '#e9edfe', '#2f4077'],
    ['Bleu cumulus', '#e6eefe', '#3558a2'],
    ['Violet glycine', '#fee7fc', '#6e445a'],
    ['Rose macaron', '#fee9e6', '#8d533e'],
    ['Jaune tournesol', '#fef7da', '#716043'],
    ['Brun caramel', '#f7ebe5', '#845d48'],
    ['Gris', '#eeeeee', '#3a3a3a'],
    ['Blanc', '#ffffff', '#161616'],
];

export function nuancier(fondActuel, surChoix) {
    return h('div', { class: 'fusain-couleurs', role: 'group', 'aria-label': 'Couleur' },
        COULEURS.map(([nom, fond, bord]) => {
            const b = h('button', { type: 'button', class: 'fusain-couleur', title: nom, 'aria-label': nom,
                'aria-pressed': String((fondActuel || null) === fond), onclick: () => surChoix(fond, bord) });
            b.style.background = fond || 'repeating-linear-gradient(45deg, #fff 0 4px, #ddd 4px 8px)';
            if (bord) b.style.borderColor = bord;
            return b;
        }));
}

// Texte d'un libellé Mermaid : guillemets et retours à la ligne ne peuvent pas « sortir » du libellé (§7.3)
export function echapper(texte) {
    return String(texte).replace(/"/g, '#quot;').replace(/\r?\n/g, '<br/>');
}

export function desechapper(texte) {
    return String(texte).replace(/#quot;/g, '"').replace(/<br\s*\/?>/gi, '\n');
}

export function sansGuillemets(texte) {
    const t = texte.trim();
    return t.length >= 2 && t.startsWith('"') && t.endsWith('"') ? t.slice(1, -1) : t;
}

// Sépare l'en-tête éventuel (bloc ---, directives, commentaires) du corps du schéma
export function separerPreambule(code) {
    const lignes = String(code).replace(/\r\n?/g, '\n').split('\n');
    const preambule = [];
    let i = 0;
    if (lignes[0]?.trim() === '---') {
        const fin = lignes.findIndex((l, n) => n > 0 && l.trim() === '---');
        if (fin > 0) { preambule.push(...lignes.slice(0, fin + 1)); i = fin + 1; }
    }
    while (i < lignes.length && (!lignes[i].trim() || lignes[i].trim().startsWith('%%'))) {
        if (lignes[i].trim()) preambule.push(lignes[i]);
        i += 1;
    }
    return { preambule, corps: lignes.slice(i) };
}

export function deplacer(tableau, index, delta) {
    const cible = index + delta;
    if (cible < 0 || cible >= tableau.length) return index;
    const [el] = tableau.splice(index, 1);
    tableau.splice(cible, 0, el);
    return cible;
}

export function actionsListe({ monter, descendre, supprimer, extra = [] }) {
    return h('div', { class: 'fusain-actions' },
        extra,
        monter ? bouton('Monter', { icone: 'arrow-up-line', seulIcone: true, onclick: monter }) : null,
        descendre ? bouton('Descendre', { icone: 'arrow-down-line', seulIcone: true, onclick: descendre }) : null,
        supprimer ? bouton('Supprimer', { icone: 'delete-bin-line', onclick: supprimer }) : null);
}

export function plan(elements, selection, selectionner) {
    return h('ul', { class: 'fusain-plan' }, elements.map((e) => h('li', {},
        h('button', { type: 'button', class: 'fusain-plan__element' + (e.brut ? ' fusain-plan__brut' : ''),
            'aria-current': String(e.cle === selection), onclick: () => selectionner(e.cle) },
        e.nom))));
}

export function marquer(el, cle) {
    if (el) el.setAttribute('data-fusain', cle);
}
