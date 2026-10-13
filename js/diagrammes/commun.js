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
    // L'accent grave ouvrirait une « chaîne Markdown » de Mermaid ; la tabulation n'est pas admise dans un libellé
    return String(texte).replace(/\t/g, ' ').replace(/"/g, '#quot;').replace(/`/g, '#96;').replace(/\r?\n/g, '<br/>');
}

export function desechapper(texte) {
    return String(texte).replace(/#quot;/g, '"').replace(/#96;/g, '`').replace(/<br\s*\/?>/gi, '\n');
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

// Réglages de rendu propres à un schéma : ils vivent dans une directive « %%{init: …}%% » placée en tête du code.
// Seule une directive écrite en JSON strict est reprise ; toute autre est laissée intacte.
const RE_INIT = /^%%\{\s*init\s*:\s*([\s\S]*)\}%%$/;

function rangInit(preambule) {
    return preambule.findIndex((ligne) => {
        const m = ligne.trim().match(RE_INIT);
        if (!m) return false;
        try { return typeof JSON.parse(m[1]) === 'object'; } catch { return false; }
    });
}

export function lireInit(preambule) {
    const i = rangInit(preambule);
    return i >= 0 ? JSON.parse(preambule[i].trim().match(RE_INIT)[1]) : {};
}

export function ecrireInit(preambule, config) {
    // Les sections vidées de leurs réglages disparaissent de la directive
    const propre = {};
    for (const [cle, valeur] of Object.entries(config)) {
        if (valeur === null || valeur === undefined || valeur === '') continue;
        if (typeof valeur === 'object' && !Array.isArray(valeur)) {
            const section = Object.fromEntries(Object.entries(valeur).filter(([, v]) => v !== null && v !== undefined && v !== ''));
            if (Object.keys(section).length) propre[cle] = section;
        } else propre[cle] = valeur;
    }
    const ligne = Object.keys(propre).length ? `%%{init: ${JSON.stringify(propre)}}%%` : null;
    const i = rangInit(preambule);
    if (i >= 0) { if (ligne) preambule[i] = ligne; else preambule.splice(i, 1); } else if (ligne) preambule.push(ligne);
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

// Une écriture valide pour Mermaid mais non gérée par l'éditeur visuel : la page passe en « code seul »
export class Inconnu extends Error {}

// Lit le corps ligne à ligne ; les lignes vides et les commentaires sont ignorés
export function parLigne(lignes, preambule, lire) {
    lignes.forEach((brute, n) => {
        const ligne = brute.trim();
        if (!ligne || ligne.startsWith('%%')) return;
        try { lire(ligne); } catch (e) {
            if (e instanceof Inconnu) throw new Error(`Ligne ${n + 2 + preambule.length} : cette écriture n'est pas gérée par l'édition visuelle (${e.message}).`);
            throw e;
        }
    });
}

// Un lien est fin : une copie invisible et large du tracé le rend facile à viser
export function marquerLien(chemin, cle) {
    marquer(chemin, cle);
    const touche = chemin.cloneNode(false);
    for (const a of ['id', 'marker-end', 'marker-start']) touche.removeAttribute(a);
    touche.setAttribute('class', 'fusain-touche');
    marquer(touche, cle);
    chemin.after(touche);
}

// Premier nom libre de la forme « prefixe1 », « prefixe2 »…
export function nomLibre(prefixe, pris) {
    let n = 1;
    while (pris(`${prefixe}${n}`)) n += 1;
    return `${prefixe}${n}`;
}
