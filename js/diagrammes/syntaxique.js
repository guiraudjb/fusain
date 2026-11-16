// Diagramme syntaxique (railroad-*-beta de Mermaid) : une grammaire, une règle par tracé.
// Chaque règle se modifie par son nom et son expression ; l'ordre des règles est celui des tracés.
import { h, bouton, champTexte, champSelect } from '../dom.js';
import { separerPreambule, plan, marquer, actionsListe, deplacer } from './commun.js';

const NOTATIONS = [['railroad-ebnf-beta', 'EBNF'], ['railroad-abnf-beta', 'ABNF'], ['railroad-peg-beta', 'PEG'], ['railroad-beta', 'EBNF (écriture courte)']];
const AIDES = {
    'railroad-ebnf-beta': 'Suite : a b ; choix : a | b ; facultatif : a? ; répété : a* ou a+ ; groupe : ( a b ) ; texte littéral entre guillemets.',
    'railroad-beta': 'Suite : a b ; choix : a | b ; facultatif : a? ; répété : a* ou a+ ; groupe : ( a b ) ; texte littéral entre guillemets.',
    'railroad-abnf-beta': 'Suite : a b ; choix : a / b ; facultatif : [ a ] ; répété : *a ou 1*a ; texte littéral entre guillemets.',
    'railroad-peg-beta': 'Suite : a b ; choix ordonné : a / b ; facultatif : a? ; répété : a* ou a+ ; texte littéral entre guillemets.',
};
const RE_NOM = /^[A-Za-z_][A-Za-z0-9_-]*$/;
const affectation = (entete) => (entete === 'railroad-peg-beta' ? '<-' : '=');
// Nom donné dans l'éditeur : lettres sans accent, chiffres et soulignés, une lettre en tête ; « title » est réservé
const propreNom = (t) => {
    const n = String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9_]+/g, '_').replace(/_+/g, '_').replace(/^[^A-Za-z]+|_+$/g, '');
    return /^title/i.test(n) ? `r_${n}` : n;
};
// Une expression tient sur une ligne et ne contient pas le point-virgule qui la termine (hors texte littéral)
const propreExpr = (t) => String(t ?? '').replace(/\s+/g, ' ').trim().replace(/;+\s*$/, '');

export function analyser(code) {
    const { preambule, corps } = separerPreambule(code);
    const entete = (corps[0] || '').trim();
    if (!NOTATIONS.some(([n]) => n === entete)) throw new Error('La première ligne doit être « railroad-ebnf-beta », « railroad-abnf-beta » ou « railroad-peg-beta ».');
    const modele = { preambule, entete, titre: '', regles: [], brut: [] };
    const op = affectation(entete);
    // Une règle peut s'étendre sur plusieurs lignes : elle se termine au point-virgule qui n'est pas dans un texte littéral
    let enCours = '';
    const fin = (t) => { let dans = null; let dernier = -1; for (let k = 0; k < t.length; k += 1) { const c = t[k]; if (dans) { if (c === dans) dans = null; } else if (c === '"' || c === '\'') dans = c; else if (c === ';') dernier = k; } return dernier; };
    corps.slice(1).forEach((brute, n) => {
        const ligne = brute.trim();
        if (!enCours && (!ligne || ligne.startsWith('%%') || ligne.startsWith('(*'))) { if (ligne) modele.brut.push(ligne); return; }
        if (!enCours) {
            const m = ligne.match(/^title\s+(?:"([^"]*)"|(.*))$/);
            if (m) { modele.titre = (m[1] ?? m[2]).trim(); return; }
        }
        enCours = enCours ? `${enCours} ${ligne}` : ligne;
        const k = fin(enCours);
        if (k < 0) return;
        if (k !== enCours.length - 1) throw new Error(`Ligne ${n + 2 + preambule.length} : une seule règle par ligne, terminée par « ; ».`);
        const i = enCours.indexOf(op);
        const nom = i > 0 ? enCours.slice(0, i).trim() : '';
        if (!RE_NOM.test(nom)) throw new Error(`Ligne ${n + 2 + preambule.length} : une règle s'écrit « nom ${op} expression ; ».`);
        modele.regles.push({ nom, expr: enCours.slice(i + op.length, k).trim() });
        enCours = '';
    });
    if (enCours) throw new Error('La dernière règle ne se termine pas par « ; ».');
    return modele;
}

export function ecrire(modele) {
    const op = affectation(modele.entete);
    const lignes = [...modele.preambule, modele.entete];
    if (modele.titre.trim()) lignes.push(`    title "${modele.titre.replace(/"/g, '”').replace(/\s+/g, ' ').trim()}"`);
    for (const b of modele.brut) lignes.push(`    ${b}`);
    // Le nom est contrôlé à la lecture et au renommage : il est écrit tel quel
    for (const r of modele.regles) lignes.push(`    ${r.nom} ${op} ${propreExpr(r.expr) || '""'} ;`);
    return lignes.join('\n') + '\n';
}

export const elements = (modele) => modele.regles.map((r, i) => ({ cle: `r:${i}`, nom: `${r.nom} ${affectation(modele.entete)} ${r.expr}` }));

export function reperer(svg, modele) {
    const traces = [...svg.querySelectorAll('g.railroad-rule')];
    if (traces.length === modele.regles.length) traces.forEach((g, i) => marquer(g, `r:${i}`));
}

export const texte = (modele, cle) => modele.regles[Number(cle.slice(2))]?.nom ?? null;

// Renommer une règle renomme aussi ses emplois dans les autres règles (hors textes littéraux)
function renommerRegle(modele, i, valeur) {
    const r = modele.regles[i];
    const v = propreNom(valeur);
    if (!r || !v || v === r.nom || modele.regles.some((x) => x.nom === v)) return;
    const motif = new RegExp(`("[^"]*"|'[^']*')|(?<![A-Za-z0-9_-])${r.nom.replace(/[-]/g, '\\-')}(?![A-Za-z0-9_-])`, 'g');
    for (const x of modele.regles) x.expr = x.expr.replace(motif, (tout, litteral) => litteral || v);
    r.nom = v;
}

export function renommer(modele, cle, valeur) { renommerRegle(modele, Number(cle.slice(2)), valeur); }
export function supprimer(modele, cle) { if (modele.regles.length > 1) modele.regles.splice(Number(cle.slice(2)), 1); }
export const peutRelier = () => false;

function nomLibre(modele) {
    let n = 1;
    while (modele.regles.some((r) => r.nom === `regle_${n}`)) n += 1;
    return `regle_${n}`;
}

export function panneau(ctx) {
    const { modele, selection, appliquer, selectionner } = ctx;
    const i = selection ? Number(selection.slice(2)) : -1;
    const r = modele.regles[i];
    const position = r ? i + 1 : modele.regles.length;
    const blocs = [h('div', { class: 'fusain-bloc' },
        h('h2', {}, 'Diagramme syntaxique'),
        champTexte('Titre', modele.titre, (v) => appliquer((m) => { m.titre = v.replace(/\s+/g, ' ').trim(); })),
        champSelect('Notation', NOTATIONS, modele.entete, (v) => appliquer((m) => {
            // Passer de PEG à une autre notation ne change que le signe d'affectation, écrit par ecrire()
            m.entete = v;
        })),
        h('div', { class: 'fusain-actions' },
            bouton('Ajouter une règle', { icone: 'add-line', variante: 'secondary', onclick: () => appliquer((m) => { m.regles.splice(position, 0, { nom: nomLibre(m), expr: '"texte"' }); }, () => `r:${position}`) })),
        h('p', { class: 'fusain-aide' }, AIDES[modele.entete] || ''))];

    if (r) {
        blocs.push(h('div', { class: 'fusain-bloc' }, h('h2', {}, 'Règle sélectionnée'),
            champTexte('Nom de la règle', r.nom, (v) => appliquer((m) => renommerRegle(m, i, v)), { id: 'fusain-champ-texte' }),
            champTexte('Expression', r.expr, (v) => appliquer((m) => { m.regles[i].expr = propreExpr(v); }), { multiligne: true }),
            h('p', { class: 'fusain-aide' }, 'Renommer une règle met à jour ses emplois dans les autres règles.'),
            actionsListe({
                monter: () => appliquer(() => {}, (m) => `r:${deplacer(m.regles, i, -1)}`),
                descendre: () => appliquer(() => {}, (m) => `r:${deplacer(m.regles, i, 1)}`),
                supprimer: modele.regles.length > 1 ? () => appliquer((m) => supprimer(m, selection), () => null) : null,
            })));
    }
    blocs.push(h('div', { class: 'fusain-bloc' }, h('h2', {}, 'Règles'), plan(elements(modele), selection, selectionner)));
    return blocs;
}

export default { type: 'railroad-ebnf', types: ['railroad-ebnf', 'railroad-abnf', 'railroad-peg', 'railroad'], nom: 'Diagramme syntaxique', analyser, ecrire, elements, reperer, texte, renommer, supprimer, peutRelier, panneau };
