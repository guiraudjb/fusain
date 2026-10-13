// Graphique : séries en barres ou en courbes, sur des catégories
import { h, bouton, champTexte, champSelect, champCase } from '../dom.js';
import { separerPreambule, deplacer, actionsListe, sansGuillemets, marquer, Inconnu, parLigne } from './commun.js';

const propre = (t) => String(t).replace(/"/g, '\'').replace(/[\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim();
const nombre = (v) => { const n = Number(String(v).trim().replace(',', '.')); return String(v).trim() !== '' && Number.isFinite(n) ? n : null; };
const NOMBRE = '[+-]?(?:\\d+\\.?\\d*|\\.\\d+)';
const RE_AXE = new RegExp(`^(?:"([^"]*)"|([^"\\[\\]]*?))\\s*(?:\\[(.*)\\]|(${NOMBRE})\\s*-->\\s*(${NOMBRE}))?$`);

// Sans guillemets, Mermaid colle les mots d'un titre : le modèle reprend ce qu'il affiche
const nu = (t) => (/^".*"$/.test(t.trim()) ? sansGuillemets(t) : t.replace(/\s+/g, ''));

function liste(texte) {
    const valeurs = [];
    let reste = texte.trim();
    while (reste) {
        const m = reste.match(/^(?:"([^"]*)"|([^,"]+))\s*(?:,\s*(.*))?$/);
        if (!m) throw new Inconnu('liste mal formée');
        valeurs.push(m[1] !== undefined ? m[1] : m[2].trim());
        reste = (m[3] || '').trim();
    }
    return valeurs;
}

export function analyser(code) {
    const { preambule, corps } = separerPreambule(code);
    const entete = (corps[0] || '').trim().match(/^(xychart(?:-beta)?)(?:\s+(horizontal|vertical))?$/);
    if (!entete) throw new Error('La première ligne doit être « xychart-beta ».');
    const modele = { preambule, entete: entete[1], horizontal: entete[2] === 'horizontal', titre: '', xTitre: '', categories: null, yTitre: '', yMin: null, yMax: null, series: [], brut: [] };
    parLigne(corps.slice(1), preambule, (ligne) => {
        const mot = ligne.match(/^[A-Za-z-]+/)?.[0] || '';
        const reste = ligne.slice(mot.length).trim();
        if (mot === 'title') { modele.titre = nu(reste); return; }
        if (mot === 'accTitle' || mot === 'accDescr') { modele.brut.push(ligne); return; }
        if (mot === 'x-axis' || mot === 'y-axis') {
            const m = reste.match(RE_AXE);
            if (!m) throw new Inconnu('axe mal formé');
            const titre = m[1] ?? nu(m[2] || '');
            if (mot === 'x-axis') {
                if (m[4] !== undefined) throw new Inconnu('axe horizontal numérique');
                modele.xTitre = titre;
                if (m[3] !== undefined) modele.categories = liste(m[3]);
            } else {
                if (m[3] !== undefined) throw new Inconnu('axe vertical à catégories');
                modele.yTitre = titre;
                if (m[4] !== undefined) { modele.yMin = Number(m[4]); modele.yMax = Number(m[5]); }
            }
            return;
        }
        if (mot === 'bar' || mot === 'line') {
            const m = reste.match(/^(?:"([^"]*)"\s*)?\[(.*)\]$/);
            if (!m) throw new Inconnu('série mal formée');
            const valeurs = liste(m[2]).map(nombre);
            if (valeurs.includes(null)) throw new Inconnu('valeur non numérique');
            modele.series.push({ t: mot, nom: m[1] || '', valeurs });
            return;
        }
        throw new Inconnu('instruction inconnue');
    });
    return modele;
}

const citer = (t) => `"${propre(t)}"`;

export function ecrire(modele) {
    const lignes = [...modele.preambule, `${modele.entete || 'xychart-beta'}${modele.horizontal ? ' horizontal' : ''}`];
    if (propre(modele.titre)) lignes.push(`    title ${citer(modele.titre)}`);
    for (const b of modele.brut) lignes.push(`    ${b}`);
    const x = [propre(modele.xTitre) ? citer(modele.xTitre) : '', modele.categories ? `[${modele.categories.map((c) => citer(c || ' ')).join(', ')}]` : ''].filter(Boolean);
    if (x.length) lignes.push(`    x-axis ${x.join(' ')}`);
    const bornes = modele.yMin !== null && modele.yMax !== null && modele.yMin < modele.yMax;
    // Les bornes ne s'écrivent pas sans titre : à défaut, le titre est une espace
    if (propre(modele.yTitre) || bornes) lignes.push(`    y-axis ${propre(modele.yTitre) ? citer(modele.yTitre) : '" "'}${bornes ? ` ${modele.yMin} --> ${modele.yMax}` : ''}`);
    for (const s of modele.series) lignes.push(`    ${s.t}${propre(s.nom) ? ` ${citer(s.nom)}` : ''} [${s.valeurs.join(', ')}]`);
    return lignes.join('\n') + '\n';
}

const nbCategories = (modele) => Math.max(modele.categories?.length || 0, ...modele.series.map((s) => s.valeurs.length));
const nomCategorie = (modele, k) => modele.categories?.[k] ?? String(k + 1);
const nomSerie = (s, n) => s.nom || `${s.t === 'bar' ? 'Barres' : 'Courbe'} ${n + 1}`;

// Avant d'ajouter, d'ôter ou de déplacer une catégorie, toutes les séries sont mises à la même longueur
function aligner(modele) {
    const nb = nbCategories(modele);
    modele.categories = Array.from({ length: nb }, (_, k) => nomCategorie(modele, k));
    for (const s of modele.series) s.valeurs = Array.from({ length: nb }, (_, k) => s.valeurs[k] ?? 0);
}

export function elements(modele) {
    return [
        ...modele.series.map((s, n) => ({ cle: `s:${n}`, nom: `Série : ${nomSerie(s, n)}` })),
        ...Array.from({ length: nbCategories(modele) }, (_, k) => ({ cle: `c:${k}`, nom: `Catégorie : ${nomCategorie(modele, k)}` })),
        ...modele.series.flatMap((s, n) => s.valeurs.map((v, k) => ({ cle: `v:${n}.${k}`, nom: `${nomSerie(s, n)}, ${nomCategorie(modele, k)} : ${v}` }))),
    ];
}

export function reperer(svg, modele) {
    modele.series.forEach((s, n) => {
        const g = svg.querySelector(`g.plot > g.${s.t}-plot-${n}`);
        if (!g) return;
        const barres = [...g.querySelectorAll('rect')];
        if (s.t === 'bar' && barres.length === s.valeurs.length) barres.forEach((r, k) => marquer(r, `v:${n}.${k}`));
        if (s.t === 'line') marquer(g, `s:${n}`);
    });
    const libelles = [...svg.querySelectorAll(`g.${modele.horizontal ? 'left' : 'bottom'}-axis g.label text`)];
    if (modele.categories && libelles.length === modele.categories.length) libelles.forEach((t, k) => marquer(t, `c:${k}`));
}

function viser(modele, cle) {
    const [n, k] = cle.slice(2).split('.').map(Number);
    return { genre: cle[0], n, k, serie: cle[0] === 'c' ? null : modele.series[n] };
}

export function texte(modele, cle) {
    const v = viser(modele, cle);
    if (v.genre === 'c') return v.n < nbCategories(modele) ? nomCategorie(modele, v.n) : null;
    if (!v.serie) return null;
    return v.genre === 's' ? v.serie.nom : (v.serie.valeurs[v.k] === undefined ? null : String(v.serie.valeurs[v.k]));
}

export function renommer(modele, cle, valeur) {
    const v = viser(modele, cle);
    if (v.genre === 'c') {
        if (v.n >= nbCategories(modele) || !propre(valeur)) return;
        aligner(modele);
        modele.categories[v.n] = propre(valeur);
    } else if (v.genre === 's') {
        if (v.serie) v.serie.nom = propre(valeur);
    } else if (v.serie && v.k < v.serie.valeurs.length && nombre(valeur) !== null) v.serie.valeurs[v.k] = nombre(valeur);
}

// Le graphique garde toujours au moins une série et une catégorie : vide, il ne serait plus valide
export function supprimer(modele, cle) {
    const v = viser(modele, cle);
    if (v.genre === 's') { if (v.serie && modele.series.length > 1) modele.series.splice(v.n, 1); return; }
    if (v.genre === 'v') { if (v.serie && v.k < v.serie.valeurs.length) v.serie.valeurs[v.k] = 0; return; }
    if (v.n >= nbCategories(modele) || nbCategories(modele) <= 1) return;
    aligner(modele);
    modele.categories.splice(v.n, 1);
    for (const s of modele.series) s.valeurs.splice(v.n, 1);
}

function ajouterSerie(modele, t) {
    modele.series.push({ t, nom: '', valeurs: Array.from({ length: nbCategories(modele) || 3 }, () => 10) });
    return `s:${modele.series.length - 1}`;
}

function ajouterCategorie(modele, apres) {
    aligner(modele);
    const k = apres === null ? modele.categories.length : apres + 1;
    modele.categories.splice(k, 0, `Cat. ${modele.categories.length + 1}`);
    for (const s of modele.series) s.valeurs.splice(k, 0, 0);
    return `c:${k}`;
}

function deplacerCategorie(modele, k, delta) {
    aligner(modele);
    const cible = deplacer(modele.categories, k, delta);
    if (cible !== k) for (const s of modele.series) deplacer(s.valeurs, k, delta);
    return `c:${cible}`;
}

export const peutRelier = (cle) => cle.startsWith('c:');

// La poignée ajoute une catégorie à la suite
export function relier(modele, de, vers) {
    if (vers || !de.startsWith('c:') || Number(de.slice(2)) >= nbCategories(modele)) return null;
    return ajouterCategorie(modele, Number(de.slice(2)));
}

function tableau(ctx) {
    const { modele, selection, appliquer, selectionner } = ctx;
    const saisie = (cle, valeur, libelle, attrs = {}) => h('input', { class: 'fr-input', value: valeur, 'aria-label': libelle, 'aria-current': String(selection === cle), ...attrs,
        onfocus: () => { if (selection !== cle) selectionner(cle, { panneau: false }); },
        onchange: (e) => appliquer((m) => renommer(m, cle, e.target.value), () => cle) });
    return h('div', { class: 'fusain-tableau' }, h('table', {},
        h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Catégorie'), modele.series.map((s, n) => h('th', { scope: 'col' },
            h('button', { type: 'button', class: 'fusain-plan__element', 'aria-current': String(selection === `s:${n}`), onclick: () => selectionner(`s:${n}`) }, nomSerie(s, n)))))),
        h('tbody', {}, Array.from({ length: nbCategories(modele) }, (_, k) => h('tr', {},
            h('th', { scope: 'row' }, saisie(`c:${k}`, nomCategorie(modele, k), `Nom de la catégorie ${k + 1}`, { type: 'text' })),
            modele.series.map((s, n) => h('td', {}, saisie(`v:${n}.${k}`, s.valeurs[k] ?? '', `${nomSerie(s, n)}, ${nomCategorie(modele, k)}`, { type: 'number', step: 'any' }))))))));
}

export function panneau(ctx) {
    const { modele, selection, appliquer } = ctx;
    const v = selection ? viser(modele, selection) : null;
    const borne = (cle, libelle) => champTexte(libelle, modele[cle] ?? '', (val) => appliquer((m) => { m[cle] = nombre(val); }), { type: 'number', step: 'any', placeholder: 'auto' });
    const blocs = [h('div', { class: 'fusain-bloc' },
        h('h2', {}, 'Graphique'),
        champTexte('Titre', modele.titre, (val) => appliquer((m) => { m.titre = propre(val); })),
        champCase('Barres horizontales', modele.horizontal, (coche) => appliquer((m) => { m.horizontal = coche; })),
        h('div', { class: 'fusain-ligne' },
            champTexte('Titre de l\'axe des catégories', modele.xTitre, (val) => appliquer((m) => { m.xTitre = propre(val); })),
            champTexte('Titre de l\'axe des valeurs', modele.yTitre, (val) => appliquer((m) => { m.yTitre = propre(val); }))),
        h('div', { class: 'fusain-ligne' }, borne('yMin', 'Valeur minimale'), borne('yMax', 'Valeur maximale')))];

    blocs.push(h('div', { class: 'fusain-bloc' },
        h('h2', {}, 'Données'),
        tableau(ctx),
        h('div', { class: 'fusain-actions' },
            bouton('Catégorie', { icone: 'add-line', variante: 'secondary', onclick: () => { let cle; appliquer((m) => { cle = ajouterCategorie(m, v?.genre === 'c' ? v.n : null); }, () => cle); } }),
            bouton('Barres', { icone: 'add-line', onclick: () => { let cle; appliquer((m) => { cle = ajouterSerie(m, 'bar'); }, () => cle); } }),
            bouton('Courbe', { icone: 'add-line', onclick: () => { let cle; appliquer((m) => { cle = ajouterSerie(m, 'line'); }, () => cle); } }))));

    if (v?.genre === 's' && v.serie) {
        blocs.push(h('div', { class: 'fusain-bloc' },
            h('h2', {}, 'Série sélectionnée'),
            champSelect('Représentation', [['bar', 'Barres'], ['line', 'Courbe']], v.serie.t, (val) => appliquer((m) => { m.series[v.n].t = val; })),
            champTexte('Nom (pour le plan, non affiché sur le graphique)', v.serie.nom, (val) => appliquer((m) => renommer(m, selection, val)), { id: 'fusain-champ-texte' }),
            actionsListe({
                monter: () => appliquer(() => {}, (m) => `s:${deplacer(m.series, v.n, -1)}`),
                descendre: () => appliquer(() => {}, (m) => `s:${deplacer(m.series, v.n, 1)}`),
                supprimer: modele.series.length > 1 ? () => appliquer((m) => supprimer(m, selection), () => null) : null,
            })));
    } else if (v?.genre === 'c' && v.n < nbCategories(modele)) {
        blocs.push(h('div', { class: 'fusain-bloc' },
            h('h2', {}, 'Catégorie sélectionnée'),
            champTexte('Nom', nomCategorie(modele, v.n), (val) => appliquer((m) => renommer(m, selection, val)), { id: 'fusain-champ-texte' }),
            actionsListe({
                monter: () => { let cle; appliquer((m) => { cle = deplacerCategorie(m, v.n, -1); }, () => cle); },
                descendre: () => { let cle; appliquer((m) => { cle = deplacerCategorie(m, v.n, 1); }, () => cle); },
                supprimer: nbCategories(modele) > 1 ? () => appliquer((m) => supprimer(m, selection), () => null) : null,
            })));
    } else if (v?.genre === 'v' && v.serie && v.k < v.serie.valeurs.length) {
        blocs.push(h('div', { class: 'fusain-bloc' },
            h('h2', {}, 'Valeur sélectionnée'),
            h('p', { class: 'fusain-aide' }, `${nomSerie(v.serie, v.n)}, ${nomCategorie(modele, v.k)}`),
            champTexte('Valeur', v.serie.valeurs[v.k], (val) => appliquer((m) => renommer(m, selection, val)), { type: 'number', step: 'any', id: 'fusain-champ-texte' })));
    }
    return blocs;
}

export default { type: 'xychart', nom: 'Graphique', analyser, ecrire, elements, reperer, texte, renommer, supprimer, relier, peutRelier, panneau };
