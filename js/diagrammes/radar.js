// Diagramme radar : des courbes notées sur plusieurs axes
import { h, bouton, champTexte, champSelect, champCase } from '../dom.js';
import { separerPreambule, deplacer, actionsListe, marquer, Inconnu, parLigne, nomLibre } from './commun.js';

const ID = '[A-Za-z0-9_][A-Za-z0-9_-]*';
const propre = (t) => String(t).replace(/"/g, '\'').replace(/[\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim();
// Mermaid n'accepte que des valeurs positives ou nulles
const nombre = (v) => { const n = Number(String(v).trim().replace(',', '.')); return String(v).trim() !== '' && Number.isFinite(n) && n >= 0 ? n : null; };

// Découpe « a["A"], b, c{1, 2} » aux virgules qui ne sont ni entre guillemets ni entre accolades
function decouper(texte) {
    const morceaux = [''];
    let guillemets = false;
    let accolades = 0;
    for (const c of texte) {
        if (c === '"') guillemets = !guillemets;
        else if (!guillemets && c === '{') accolades += 1;
        else if (!guillemets && c === '}') accolades -= 1;
        if (c === ',' && !guillemets && accolades === 0) morceaux.push(''); else morceaux[morceaux.length - 1] += c;
    }
    return morceaux.map((m) => m.trim()).filter(Boolean);
}

export function analyser(code) {
    const { preambule, corps } = separerPreambule(code);
    if ((corps[0] || '').trim() !== 'radar-beta') throw new Error('La première ligne doit être « radar-beta ».');
    const modele = { preambule, titre: '', axes: [], courbes: [], max: null, min: null, graticule: '', ticks: null, legende: null, brut: [] };
    const courbes = [];
    parLigne(corps.slice(1), preambule, (ligne) => {
        const mot = ligne.match(/^[A-Za-z]+/)?.[0] || '';
        const reste = ligne.slice(mot.length).trim();
        if (mot === 'title') { modele.titre = reste; return; }
        if (mot === 'accTitle' || mot === 'accDescr') { modele.brut.push(ligne); return; }
        if (mot === 'axis') {
            for (const a of decouper(reste)) {
                const m = a.match(new RegExp(`^(${ID})(?:\\["([^"]*)"\\])?$`));
                if (!m) throw new Inconnu('axe mal formé');
                modele.axes.push({ id: m[1], nom: m[2] ?? null });
            }
            return;
        }
        if (mot === 'curve') {
            for (const c of decouper(reste)) {
                const m = c.match(new RegExp(`^(${ID})(?:\\["([^"]*)"\\])?\\s*\\{(.*)\\}$`));
                if (!m) throw new Inconnu('courbe mal formée');
                courbes.push({ id: m[1], nom: m[2] ?? null, brutes: decouper(m[3]) });
            }
            return;
        }
        if ((mot === 'max' || mot === 'min' || mot === 'ticks') && nombre(reste) !== null) { modele[mot] = nombre(reste); return; }
        if (mot === 'graticule' && /^(circle|polygon)$/.test(reste)) { modele.graticule = reste; return; }
        if (mot === 'showLegend' && /^(true|false)$/.test(reste)) { modele.legende = reste === 'true'; return; }
        throw new Inconnu('instruction inconnue');
    });
    // Les valeurs sont données dans l'ordre des axes, ou nommées « axe: valeur »
    for (const c of courbes) {
        const nommees = c.brutes.length > 0 && c.brutes.every((b) => b.includes(':'));
        let valeurs;
        if (nommees) {
            const paires = new Map(c.brutes.map((b) => b.split(':').map((x) => x.trim())));
            valeurs = modele.axes.map((a) => nombre(paires.get(a.id) ?? ''));
            if (paires.size !== modele.axes.length) valeurs = [null];
        } else valeurs = c.brutes.map(nombre);
        if (valeurs.includes(null)) throw new Error('Une courbe utilise une écriture qui n\'est pas gérée par l\'édition visuelle (valeurs négatives, incomplètes ou non numériques).');
        modele.courbes.push({ id: c.id, nom: c.nom, valeurs });
    }
    return modele;
}

const nomme = (x) => `${x.id}${x.nom !== null && propre(x.nom) && propre(x.nom) !== x.id ? `["${propre(x.nom)}"]` : ''}`;

export function ecrire(modele) {
    const lignes = [...modele.preambule, 'radar-beta'];
    if (propre(modele.titre)) lignes.push(`    title ${propre(modele.titre)}`);
    for (const b of modele.brut) lignes.push(`    ${b}`);
    if (modele.axes.length) lignes.push(`    axis ${modele.axes.map(nomme).join(', ')}`);
    for (const c of modele.courbes) lignes.push(`    curve ${nomme(c)}{${c.valeurs.join(', ')}}`);
    if (modele.max !== null) lignes.push(`    max ${modele.max}`);
    if (modele.min !== null) lignes.push(`    min ${modele.min}`);
    if (modele.graticule) lignes.push(`    graticule ${modele.graticule}`);
    if (modele.ticks !== null) lignes.push(`    ticks ${modele.ticks}`);
    if (modele.legende !== null) lignes.push(`    showLegend ${modele.legende}`);
    return lignes.join('\n') + '\n';
}

const nomDe = (x) => x.nom ?? x.id;

export function elements(modele) {
    return [
        ...modele.courbes.map((c, n) => ({ cle: `s:${n}`, nom: `Courbe : ${nomDe(c)}` })),
        ...modele.axes.map((a, k) => ({ cle: `c:${k}`, nom: `Axe : ${nomDe(a)}` })),
        ...modele.courbes.flatMap((c, n) => c.valeurs.map((v, k) => ({ cle: `v:${n}.${k}`, nom: `${nomDe(c)}, ${modele.axes[k] ? nomDe(modele.axes[k]) : k + 1} : ${v}` }))),
    ];
}

export function reperer(svg, modele) {
    const libelles = [...svg.querySelectorAll('text.radarAxisLabel')];
    if (libelles.length === modele.axes.length) libelles.forEach((t, k) => marquer(t, `c:${k}`));
    modele.courbes.forEach((_, n) => {
        marquer(svg.querySelector(`.radarCurve-${n}`), `s:${n}`);
        marquer(svg.querySelector(`.radarLegendBox-${n}`)?.parentNode, `s:${n}`);
    });
}

function viser(modele, cle) {
    const [n, k] = cle.slice(2).split('.').map(Number);
    return { genre: cle[0], n, k, courbe: cle[0] === 'c' ? null : modele.courbes[n], axe: cle[0] === 'c' ? modele.axes[n] : null };
}

export function texte(modele, cle) {
    const v = viser(modele, cle);
    if (v.genre === 'c') return v.axe ? nomDe(v.axe) : null;
    if (!v.courbe) return null;
    return v.genre === 's' ? nomDe(v.courbe) : (v.courbe.valeurs[v.k] === undefined ? null : String(v.courbe.valeurs[v.k]));
}

export function renommer(modele, cle, valeur) {
    const v = viser(modele, cle);
    if (v.genre === 'v') { if (v.courbe && v.k < v.courbe.valeurs.length && nombre(valeur) !== null) v.courbe.valeurs[v.k] = nombre(valeur); return; }
    const cible = v.genre === 'c' ? v.axe : v.courbe;
    if (cible && propre(valeur)) cible.nom = propre(valeur);
}

// Chaque courbe a une valeur par axe
function aligner(modele) {
    for (const c of modele.courbes) c.valeurs = modele.axes.map((_, k) => c.valeurs[k] ?? 0);
}

// Le radar garde toujours au moins un axe
export function supprimer(modele, cle) {
    const v = viser(modele, cle);
    if (v.genre === 's') { if (v.courbe) modele.courbes.splice(v.n, 1); return; }
    if (v.genre === 'v') { if (v.courbe && v.k < v.courbe.valeurs.length) v.courbe.valeurs[v.k] = 0; return; }
    if (!v.axe || modele.axes.length <= 1) return;
    aligner(modele);
    modele.axes.splice(v.n, 1);
    for (const c of modele.courbes) c.valeurs.splice(v.n, 1);
}

const idsPris = (modele) => (id) => [...modele.axes, ...modele.courbes].some((x) => x.id === id);

function ajouterAxe(modele, apres) {
    aligner(modele);
    const k = apres === null ? modele.axes.length : apres + 1;
    modele.axes.splice(k, 0, { id: nomLibre('a', idsPris(modele)), nom: 'Nouvel axe' });
    for (const c of modele.courbes) c.valeurs.splice(k, 0, 0);
    return `c:${k}`;
}

function ajouterCourbe(modele) {
    aligner(modele);
    const repere = modele.max ?? Math.max(10, ...modele.courbes.flatMap((c) => c.valeurs));
    modele.courbes.push({ id: nomLibre('c', idsPris(modele)), nom: `Courbe ${modele.courbes.length + 1}`, valeurs: modele.axes.map(() => Math.round(repere / 2)) });
    return `s:${modele.courbes.length - 1}`;
}

function deplacerAxe(modele, k, delta) {
    aligner(modele);
    const cible = deplacer(modele.axes, k, delta);
    if (cible !== k) for (const c of modele.courbes) deplacer(c.valeurs, k, delta);
    return `c:${cible}`;
}

export const peutRelier = (cle) => cle.startsWith('c:');

// La poignée ajoute un axe à la suite
export function relier(modele, de, vers) {
    if (vers || !de.startsWith('c:') || !modele.axes[Number(de.slice(2))]) return null;
    return ajouterAxe(modele, Number(de.slice(2)));
}

function tableau(ctx) {
    const { modele, selection, appliquer, selectionner } = ctx;
    const saisie = (cle, valeur, libelle, attrs = {}) => h('input', { class: 'fr-input', value: valeur, 'aria-label': libelle, 'aria-current': String(selection === cle), ...attrs,
        onfocus: () => { if (selection !== cle) selectionner(cle, { panneau: false }); },
        onchange: (e) => appliquer((m) => renommer(m, cle, e.target.value), () => cle) });
    return h('div', { class: 'fusain-tableau' }, h('table', {},
        h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Axe'), modele.courbes.map((c, n) => h('th', { scope: 'col' },
            h('button', { type: 'button', class: 'fusain-plan__element', 'aria-current': String(selection === `s:${n}`), onclick: () => selectionner(`s:${n}`) }, nomDe(c)))))),
        h('tbody', {}, modele.axes.map((a, k) => h('tr', {},
            h('th', { scope: 'row' }, saisie(`c:${k}`, nomDe(a), `Nom de l'axe ${k + 1}`, { type: 'text' })),
            modele.courbes.map((c, n) => h('td', {}, saisie(`v:${n}.${k}`, c.valeurs[k] ?? '', `${nomDe(c)}, ${nomDe(a)}`, { type: 'number', min: 0, step: 'any' }))))))));
}

export function panneau(ctx) {
    const { modele, selection, appliquer } = ctx;
    const v = selection ? viser(modele, selection) : null;
    const borne = (cle, libelle) => champTexte(libelle, modele[cle] ?? '', (val) => appliquer((m) => { m[cle] = nombre(val); }), { type: 'number', min: 0, step: 'any', placeholder: 'auto' });
    const ajouter = (fonction) => () => { let cle; appliquer((m) => { cle = fonction(m); }, () => cle); };
    const blocs = [h('div', { class: 'fusain-bloc' },
        h('h2', {}, 'Diagramme radar'),
        champTexte('Titre', modele.titre, (val) => appliquer((m) => { m.titre = propre(val); })),
        h('div', { class: 'fusain-ligne' }, borne('min', 'Valeur au centre'), borne('max', 'Valeur au bord')),
        h('div', { class: 'fusain-ligne' },
            champSelect('Grille', [['', 'Cercles'], ['polygon', 'Polygones']], modele.graticule === 'polygon' ? 'polygon' : '', (val) => appliquer((m) => { m.graticule = val; })),
            champTexte('Nombre de graduations', modele.ticks ?? '', (val) => appliquer((m) => { const n = nombre(val); m.ticks = n === null ? null : Math.max(1, Math.min(20, Math.round(n))); }), { type: 'number', min: 1, max: 20, step: 1, placeholder: '5' })),
        champCase('Afficher la légende', modele.legende !== false, (coche) => appliquer((m) => { m.legende = coche ? null : false; })))];

    blocs.push(h('div', { class: 'fusain-bloc' },
        h('h2', {}, 'Données'),
        tableau(ctx),
        h('div', { class: 'fusain-actions' },
            bouton('Axe', { icone: 'add-line', variante: 'secondary', onclick: ajouter((m) => ajouterAxe(m, v?.genre === 'c' ? v.n : null)) }),
            bouton('Courbe', { icone: 'add-line', onclick: ajouter(ajouterCourbe) }))));

    if (v?.genre === 's' && v.courbe) {
        blocs.push(h('div', { class: 'fusain-bloc' },
            h('h2', {}, 'Courbe sélectionnée'),
            champTexte('Nom', nomDe(v.courbe), (val) => appliquer((m) => renommer(m, selection, val)), { id: 'fusain-champ-texte' }),
            actionsListe({
                monter: () => appliquer(() => {}, (m) => `s:${deplacer(m.courbes, v.n, -1)}`),
                descendre: () => appliquer(() => {}, (m) => `s:${deplacer(m.courbes, v.n, 1)}`),
                supprimer: () => appliquer((m) => supprimer(m, selection), () => null),
            })));
    } else if (v?.genre === 'c' && v.axe) {
        blocs.push(h('div', { class: 'fusain-bloc' },
            h('h2', {}, 'Axe sélectionné'),
            champTexte('Nom', nomDe(v.axe), (val) => appliquer((m) => renommer(m, selection, val)), { id: 'fusain-champ-texte' }),
            actionsListe({
                monter: ajouter((m) => deplacerAxe(m, v.n, -1)),
                descendre: ajouter((m) => deplacerAxe(m, v.n, 1)),
                supprimer: modele.axes.length > 1 ? () => appliquer((m) => supprimer(m, selection), () => null) : null,
            })));
    } else if (v?.genre === 'v' && v.courbe && v.k < v.courbe.valeurs.length) {
        blocs.push(h('div', { class: 'fusain-bloc' },
            h('h2', {}, 'Valeur sélectionnée'),
            h('p', { class: 'fusain-aide' }, `${nomDe(v.courbe)}, ${modele.axes[v.k] ? nomDe(modele.axes[v.k]) : v.k + 1}`),
            champTexte('Valeur', v.courbe.valeurs[v.k], (val) => appliquer((m) => renommer(m, selection, val)), { type: 'number', min: 0, step: 'any', id: 'fusain-champ-texte' })));
    }
    return blocs;
}

export default { type: 'radar', nom: 'Diagramme radar', analyser, ecrire, elements, reperer, texte, renommer, supprimer, relier, peutRelier, panneau };
