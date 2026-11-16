// Modélisation par événements (eventmodeling de Mermaid) : une frise d'étapes numérotées — écrans, commandes,
// événements, vues de lecture, automates — avec leurs données et leurs liens vers une étape antérieure
import { h, bouton, champTexte, champSelect } from '../dom.js';
import { separerPreambule, plan, marquer, actionsListe } from './commun.js';

const GENRES = [['ui', 'Écran (ui)'], ['cmd', 'Commande (cmd)'], ['evt', 'Événement (evt)'], ['rmo', 'Vue de lecture (rmo)'], ['pcr', 'Automate (pcr)']];
const SYNONYMES = { command: 'cmd', event: 'evt', readmodel: 'rmo', processor: 'pcr', timeframe: 'tf', resetframe: 'rf' };
const CADRES = [['tf', 'À la suite de l\'étape précédente'], ['rf', 'Nouveau départ (sans lien avec la précédente)']];
const RE_ETAPE = /^(tf|timeframe|rf|resetframe)\s+([A-Za-z0-9_]+)\s+(ui|cmd|command|evt|event|rmo|readmodel|pcr|processor)\s+([A-Za-z0-9_]+)\s*(?:\{([^{}]*)\})?\s*(.*)$/;

// Un nom d'étape n'admet ni espace ni accent et commence par une lettre : il est ramené à un identifiant en
// « CasseChameau » (la majuscule initiale écarte aussi le mot réservé « title », que Mermaid lit en minuscules)
const identifiant = (t) => {
    const mots = String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9_]+/g, ' ').trim().split(' ').filter(Boolean);
    const id = mots.map((m) => m.charAt(0).toUpperCase() + m.slice(1)).join('');
    return /^[A-Za-z]/.test(id) ? id : id ? `E${id}` : '';
};
const propreDonnees = (t) => String(t ?? '').replace(/[{}\n\r]/g, ' ').replace(/\s+/g, ' ').trim();
const nomGenre = (g) => GENRES.find(([x]) => x === g)?.[1] || g;

export function analyser(code) {
    const { preambule, corps } = separerPreambule(code);
    if ((corps[0] || '').trim() !== 'eventmodeling') throw new Error('La première ligne doit être « eventmodeling ».');
    const modele = { preambule, items: [] };
    let profondeur = 0;
    corps.slice(1).forEach((brute) => {
        const ligne = brute.trim();
        if (!ligne) return;
        // Bloc de données (« data id { … } ») ou toute autre écriture : gardés tels quels, à leur place
        if (profondeur > 0 || ligne.startsWith('%%') || /^data\b/.test(ligne)) {
            modele.items.push({ t: 'brut', ligne: brute.replace(/^ {4}/, '').trimEnd() });
            profondeur = Math.max(0, profondeur + (ligne.match(/\{/g) || []).length - (ligne.match(/\}/g) || []).length);
            return;
        }
        const m = ligne.match(RE_ETAPE);
        if (!m) { modele.items.push({ t: 'brut', ligne }); return; }
        modele.items.push({ t: 'etape', cadre: SYNONYMES[m[1]] || m[1], num: m[2], genre: SYNONYMES[m[3]] || m[3], nom: m[4], donnees: m[5] === undefined ? null : m[5].trim(), suite: m[6].trim() });
    });
    return modele;
}

export function ecrire(modele) {
    const lignes = [...modele.preambule, 'eventmodeling'];
    for (const x of modele.items) {
        if (x.t === 'brut') { lignes.push(`    ${x.ligne}`); continue; }
        const donnees = x.donnees === null || x.donnees === undefined ? '' : ` { ${propreDonnees(x.donnees)} }`;
        lignes.push(`    ${x.cadre} ${x.num} ${x.genre} ${identifiant(x.nom) || 'Etape'}${donnees}${x.suite ? ` ${x.suite}` : ''}`);
    }
    return lignes.join('\n') + '\n';
}

const etapes = (modele) => modele.items.map((x, i) => [x, i]).filter(([x]) => x.t === 'etape');

export const elements = (modele) => modele.items.map((x, i) => (x.t === 'etape'
    ? { cle: `e:${i}`, nom: `${x.num} · ${nomGenre(x.genre)} : ${x.nom}` }
    : { cle: `e:${i}`, nom: x.ligne, brut: true }));

export function reperer(svg, modele) {
    const liste = etapes(modele);
    const boites = [...svg.querySelectorAll('g.em-box')];
    // Une boîte par étape, dans l'ordre ; à défaut, chaque boîte est retrouvée par le nom en gras qu'elle affiche
    if (boites.length === liste.length) { boites.forEach((g, k) => marquer(g, `e:${liste[k][1]}`)); return; }
    const restantes = [...liste];
    for (const g of boites) {
        const nom = (g.querySelector('b')?.textContent || g.textContent || '').trim();
        const k = restantes.findIndex(([x]) => nom.startsWith(x.nom));
        if (k >= 0) { marquer(g, `e:${restantes[k][1]}`); restantes.splice(k, 1); }
    }
}

export function texte(modele, cle) {
    const x = modele.items[Number(cle.slice(2))];
    return x ? (x.t === 'etape' ? x.nom : x.ligne) : null;
}

export function renommer(modele, cle, valeur) {
    const x = modele.items[Number(cle.slice(2))];
    if (!x) return;
    if (x.t === 'etape') { const v = identifiant(valeur); if (v) x.nom = v; } else if (valeur.trim()) x.ligne = valeur.trim();
}

// Renumérote les étapes dans l'ordre (01, 02…) et reporte les nouveaux numéros dans les liens « ->> »
function renumeroter(modele) {
    const liste = etapes(modele).map(([x]) => x);
    const largeur = Math.max(2, String(liste.length).length);
    const table = new Map(liste.map((x, k) => [x.num, String(k + 1).padStart(largeur, '0')]));
    for (const x of liste) {
        x.num = table.get(x.num);
        x.suite = x.suite.replace(/(->>\s*)([A-Za-z0-9_]+(?:\s*,\s*[A-Za-z0-9_]+)*)/, (_, fleche, refs) => fleche + refs.split(/\s*,\s*/).map((r) => table.get(r) || r).join(', '));
    }
}

export function supprimer(modele, cle) {
    const i = Number(cle.slice(2));
    const [x] = modele.items.splice(i, 1);
    if (x?.t !== 'etape') return;
    // Les liens vers l'étape supprimée disparaissent avec elle
    for (const y of modele.items) if (y.t === 'etape') y.suite = y.suite.replace(new RegExp(`->>\\s*${x.num}\\b`), '').trim();
    renumeroter(modele);
}

export const peutRelier = () => false;

function deplacerEtape(modele, i, delta) {
    const cible = i + delta;
    if (cible < 0 || cible >= modele.items.length) return i;
    const [x] = modele.items.splice(i, 1);
    modele.items.splice(cible, 0, x);
    renumeroter(modele);
    return cible;
}

const RE_SOURCE = /^->>\s*([A-Za-z0-9_]+)$/;

export function panneau(ctx) {
    const { modele, selection, appliquer, selectionner } = ctx;
    const i = selection ? Number(selection.slice(2)) : -1;
    const x = modele.items[i];
    const position = x ? i + 1 : modele.items.length;
    const ajouter = (genre) => appliquer((m) => {
        m.items.splice(position, 0, { t: 'etape', cadre: 'tf', num: `n${Date.now()}`, genre, nom: { ui: 'Ecran', cmd: 'Commande', evt: 'Evenement', rmo: 'VueLecture', pcr: 'Automate' }[genre], donnees: null, suite: '' });
        renumeroter(m);
    }, () => `e:${position}`);
    const blocs = [h('div', { class: 'fusain-bloc' },
        h('h2', {}, 'Modélisation par événements'),
        champSelect('Ajouter une étape', [['', 'Choisir…'], ...GENRES], '', (v) => { if (v) ajouter(v); }),
        h('p', { class: 'fusain-aide' }, 'L\'étape s\'ajoute après l\'élément sélectionné ; les numéros se recalculent. Les noms s\'écrivent sans espace ni accent.'))];

    if (x?.t === 'etape') {
        const maj = (f) => appliquer((m) => f(m.items[i]));
        const anterieures = etapes(modele).filter(([y]) => y !== x).map(([y]) => [y.num, `${y.num} · ${y.nom}`]);
        const source = x.suite.match(RE_SOURCE)?.[1];
        blocs.push(h('div', { class: 'fusain-bloc' }, h('h2', {}, `Étape ${x.num}`),
            champTexte('Nom', x.nom, (v) => appliquer((m) => renommer(m, selection, v)), { id: 'fusain-champ-texte' }),
            h('div', { class: 'fusain-ligne' },
                champSelect('Nature', GENRES, x.genre, (v) => maj((y) => { y.genre = v; })),
                champSelect('Enchaînement', CADRES, x.cadre, (v) => maj((y) => { y.cadre = v; }))),
            champTexte('Données (champ: type, …)', x.donnees ?? '', (v) => maj((y) => { y.donnees = propreDonnees(v) || null; })),
            !x.suite || source ? champSelect('Alimentée par l\'étape', [['', 'Aucune'], ...anterieures], source || '', (v) => maj((y) => { y.suite = v ? `->> ${v}` : ''; }))
                : champTexte('Suite de la ligne', x.suite, (v) => maj((y) => { y.suite = v.replace(/\s+/g, ' ').trim(); })),
            actionsListe({
                monter: () => appliquer(() => {}, (m) => `e:${deplacerEtape(m, i, -1)}`),
                descendre: () => appliquer(() => {}, (m) => `e:${deplacerEtape(m, i, 1)}`),
                supprimer: () => appliquer((m) => supprimer(m, selection), () => null),
            })));
    } else if (x) {
        blocs.push(h('div', { class: 'fusain-bloc' }, h('h2', {}, 'Instruction'),
            champTexte('Ligne de code', x.ligne, (v) => appliquer((m) => renommer(m, selection, v)), { id: 'fusain-champ-texte' }),
            actionsListe({ supprimer: () => appliquer((m) => { m.items.splice(i, 1); }, () => null) })));
    }
    blocs.push(h('div', { class: 'fusain-bloc' }, h('h2', {}, 'Frise'), plan(elements(modele), selection, selectionner)));
    return blocs;
}

export default { type: 'eventmodeling', nom: 'Modélisation par événements', analyser, ecrire, elements, reperer, texte, renommer, supprimer, peutRelier, panneau };
