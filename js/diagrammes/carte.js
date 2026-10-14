// Diapositive de carte : carte thématique d'un territoire, reprise de SimpleCarto. Ce n'est pas un schéma Mermaid :
// le code est un petit format « clé: valeur », dessiné par js/carte.js avec les fonds de carte de cartes/.
//
//   carte <échelle>                       monde, region-du-monde, france, region, region-communes, departement, epci, commune
//   zone: <code>                          région du monde, région, département, EPCI ou commune représentés
//   <option>: <valeur>                    apparence (voir OPTIONS)
//   - <code> | <valeur> | <étiquette> | <valeur de filtre>       une ligne de données par territoire
//   epingle: <latitude> <longitude> | <couleur> | <libellé> | <icône>
//   pictogramme: <x %> <y %> | <icône> | <couleur> | <taille>
//   annotation: <x %> <y %> | <x % de la pointe> <y % de la pointe> | <texte>
import { h, bouton, champTexte, champSelect, champCase, message, modale, ouvrirModale, fermerModale } from '../dom.js';
import { actionsListe, plan, marquer } from './commun.js';
import { choisirIcone } from '../icones.js';
import { referentiels, nomsDesZones, lireCommunes, inverserPosition, territoiresRepresentes, departementsAdresses, communesAdresses, adressesCommune } from '../geo.js';

export const ECHELLES = {
    monde: { nom: 'Monde' },
    'region-du-monde': { nom: 'Région du monde', zone: 'Région du monde' },
    france: { nom: 'France (départements)' },
    region: { nom: 'Région (départements)', zone: 'Région' },
    'region-communes': { nom: 'Région (communes)', zone: 'Région' },
    departement: { nom: 'Département (communes)', zone: 'Département' },
    epci: { nom: 'EPCI (communes)', zone: 'EPCI' },
    commune: { nom: 'Commune', zone: 'Commune' },
};

export const REGIONS = {
    11: 'Île-de-France', 24: 'Centre-Val de Loire', 27: 'Bourgogne-Franche-Comté', 28: 'Normandie', 32: 'Hauts-de-France',
    44: 'Grand Est', 52: 'Pays de la Loire', 53: 'Bretagne', 75: 'Nouvelle-Aquitaine', 76: 'Occitanie', 84: 'Auvergne-Rhône-Alpes',
    93: 'Provence-Alpes-Côte d\'Azur', 94: 'Corse', '01': 'Guadeloupe', '02': 'Martinique', '03': 'Guyane', '04': 'La Réunion', '06': 'Mayotte',
};

export const DEPARTEMENTS = {
    '01': 'Ain', '02': 'Aisne', '03': 'Allier', '04': 'Alpes-de-Haute-Provence', '05': 'Hautes-Alpes', '06': 'Alpes-Maritimes', '07': 'Ardèche', '08': 'Ardennes', '09': 'Ariège', 10: 'Aube', 11: 'Aude', 12: 'Aveyron', 13: 'Bouches-du-Rhône', 14: 'Calvados', 15: 'Cantal', 16: 'Charente', 17: 'Charente-Maritime', 18: 'Cher', 19: 'Corrèze', '2A': 'Corse-du-Sud', '2B': 'Haute-Corse', 21: 'Côte-d\'Or', 22: 'Côtes-d\'Armor', 23: 'Creuse', 24: 'Dordogne', 25: 'Doubs', 26: 'Drôme', 27: 'Eure', 28: 'Eure-et-Loir', 29: 'Finistère', 30: 'Gard', 31: 'Haute-Garonne', 32: 'Gers', 33: 'Gironde', 34: 'Hérault', 35: 'Ille-et-Vilaine', 36: 'Indre', 37: 'Indre-et-Loire', 38: 'Isère', 39: 'Jura', 40: 'Landes', 41: 'Loir-et-Cher', 42: 'Loire', 43: 'Haute-Loire', 44: 'Loire-Atlantique', 45: 'Loiret', 46: 'Lot', 47: 'Lot-et-Garonne', 48: 'Lozère', 49: 'Maine-et-Loire', 50: 'Manche', 51: 'Marne', 52: 'Haute-Marne', 53: 'Mayenne', 54: 'Meurthe-et-Moselle', 55: 'Meuse', 56: 'Morbihan', 57: 'Moselle', 58: 'Nièvre', 59: 'Nord', 60: 'Oise', 61: 'Orne', 62: 'Pas-de-Calais', 63: 'Puy-de-Dôme', 64: 'Pyrénées-Atlantiques', 65: 'Hautes-Pyrénées', 66: 'Pyrénées-Orientales', 67: 'Bas-Rhin', 68: 'Haut-Rhin', 69: 'Rhône', 70: 'Haute-Saône', 71: 'Saône-et-Loire', 72: 'Sarthe', 73: 'Savoie', 74: 'Haute-Savoie', 75: 'Paris', 76: 'Seine-Maritime', 77: 'Seine-et-Marne', 78: 'Yvelines', 79: 'Deux-Sèvres', 80: 'Somme', 81: 'Tarn', 82: 'Tarn-et-Garonne', 83: 'Var', 84: 'Vaucluse', 85: 'Vendée', 86: 'Vienne', 87: 'Haute-Vienne', 88: 'Vosges', 89: 'Yonne', 90: 'Territoire de Belfort', 91: 'Essonne', 92: 'Hauts-de-Seine', 93: 'Seine-Saint-Denis', 94: 'Val-de-Marne', 95: 'Val-d\'Oise', 971: 'Guadeloupe', 972: 'Martinique', 973: 'Guyane', 974: 'La Réunion', 976: 'Mayotte',
};

const ETIQUETTES = [['aucune', 'Aucune'], ['nom', 'Nom du territoire'], ['valeur', 'Valeur'], ['nom-valeur', 'Nom et valeur']];
export const PALETTES = [['theme', 'Bleu France (dégradé)'], ['divergente', 'Vert → jaune → rouge'], ['divergente-inverse', 'Rouge → jaune → vert'], ['personnalisee', 'Personnalisée']];
const COULEUR = /^#[0-9a-f]{6}$/i;
const ICONE = /^(?:dsfr|illus):[a-z0-9-]+$/;
const CODE = /^[0-9A-Za-z-]{1,12}$/;
const FILTRE = /^(>=|<=|>|<|=)\s*(-?\d+(?:[.,]\d+)?)$/;

// [type, défaut, minimum, maximum] ; une option à sa valeur par défaut n'est pas écrite dans le code
export const OPTIONS = {
    etiquettes: ['choix', 'nom', ETIQUETTES.map(([v]) => v)],
    'taille-etiquettes': ['nombre', 10, 4, 40],
    'filtre-noms': ['texte', ''],
    filtre: ['texte', ''],
    palette: ['choix', 'theme', PALETTES.map(([v]) => v)],
    couleurs: ['texte', '#f5f5fe, #000091'],
    fond: ['couleur', '#ffffff'],
    contexte: ['couleur', '#f8f9fa'],
    'sans-donnee': ['couleur', '#e5e5e5'],
    legende: ['oui', true],
    relief: ['oui', false],
    'opacite-relief': ['nombre', 0.6, 0, 1],
    hydrographie: ['oui', false],
    rail: ['oui', false],
    routes: ['oui', false],
    'routes-autoroutes': ['oui', false],
    'routes-principales': ['oui', false],
    'routes-regionales': ['oui', false],
    'libelles-epingles': ['oui', true],
    'legende-epingles': ['oui', true],
    'taille-epingles': ['nombre', 5, 1, 30],
    'taille-icones': ['nombre', 28, 8, 120],
    force: ['nombre', 0.15, 0, 1],
    espacement: ['nombre', 4, 0, 30],
};
const ELEMENTS_MAX = 200;

// Un texte tient sur une ligne et dans une case : « | » est remplacé, les retours à la ligne s'écrivent <br>
const propre = (t) => String(t ?? '').replace(/\r?\n/g, '<br>').replace(/\|/g, '/').replace(/[\t ]+/g, ' ').trim();
const enLignes = (t) => String(t ?? '').replace(/<br\s*\/?>/gi, '\n');
const nombre = (t) => { const n = parseFloat(String(t ?? '').replace(/[\s  ]/g, '').replace(',', '.')); return Number.isFinite(n) ? n : null; };
const borne = (v, min, max) => Math.max(min, Math.min(max, v));
const arrondi = (v, n = 2) => Number(v.toFixed(n));
export const couleursPersonnalisees = (t) => String(t).split(',').map((c) => c.trim()).filter((c) => COULEUR.test(c)).slice(0, 3);

export const departementDe = (commune) => (String(commune).startsWith('97') ? String(commune).slice(0, 3) : String(commune).slice(0, 2));
export const estMonde = (echelle) => echelle === 'monde' || echelle === 'region-du-monde';
const ZONES = {
    'region-du-monde': /^[A-Z][A-Z0-9_]{1,11}$|^auto$/,
    region: /^\d{2}$/,
    'region-communes': /^\d{2}$/,
    departement: /^(\d{2}|2[AB]|97\d)$/,
    epci: /^\d{9}$/,
    commune: /^(\d{5}|2[AB]\d{3})$/,
};

export function analyser(code) {
    const lignes = String(code).replace(/\r\n?/g, '\n').split('\n');
    const debut = lignes.findIndex((l) => l.trim());
    const entete = (lignes[debut] || '').trim().match(/^carte\s+([a-z-]+)$/);
    if (!entete || !ECHELLES[entete[1]]) throw new Error(`La première ligne doit être « carte » suivi d'une échelle : ${Object.keys(ECHELLES).join(', ')}.`);
    const modele = { echelle: entete[1], zone: '', options: {}, donnees: [], epingles: [], pictogrammes: [], annotations: [] };
    const codes = new Set();
    lignes.slice(debut + 1).forEach((brute, n) => {
        const ligne = brute.trim();
        const erreur = (texte) => new Error(`Ligne ${debut + n + 2} : ${texte}`);
        if (!ligne) return;
        if (ligne.startsWith('- ') || ligne === '-') {
            const [c, v, t, f] = ligne.slice(1).split('|').map((x) => x.trim());
            if (!CODE.test(c || '')) throw erreur(`code de territoire invalide « ${c || ''} ».`);
            if (v && nombre(v) === null) throw erreur(`valeur non numérique « ${v} ».`);
            if (f && nombre(f) === null) throw erreur(`valeur de filtre non numérique « ${f} ».`);
            if (codes.has(c)) throw erreur(`le territoire ${c} a déjà une ligne de données.`);
            codes.add(c);
            modele.donnees.push({ code: c, valeur: v ? nombre(v) : null, texte: t || '', filtre: f ? nombre(f) : null });
            return;
        }
        const m = ligne.match(/^([a-z-]+)\s*:\s*(.*)$/);
        if (!m) throw erreur('ligne non reconnue.');
        const [, cle, valeur] = m;
        const cases = valeur.split('|').map((x) => x.trim());
        if (cle === 'zone') {
            if (!ZONES[modele.echelle]?.test(valeur)) throw erreur(`zone « ${valeur} » invalide pour l'échelle « ${ECHELLES[modele.echelle].nom} ».`);
            modele.zone = valeur;
        } else if (cle === 'epingle') {
            const [lat, lon] = (cases[0] || '').split(/\s+/).map(nombre);
            if (lat === null || lon === null || Math.abs(lat) > 90 || Math.abs(lon) > 180) throw erreur('une épingle commence par sa latitude et sa longitude, par exemple « 45.76 4.84 ».');
            if (cases[1] && !COULEUR.test(cases[1])) throw erreur(`couleur invalide « ${cases[1]} ».`);
            if (cases[3] && !ICONE.test(cases[3])) throw erreur(`icône invalide « ${cases[3]} ».`);
            modele.epingles.push({ lat, lon, couleur: cases[1] || '#e1000f', texte: cases[2] || '', icone: cases[3] || '' });
        } else if (cle === 'pictogramme') {
            const [x, y] = (cases[0] || '').split(/\s+/).map(nombre);
            if (x === null || y === null) throw erreur('un pictogramme commence par sa position en pourcentage, par exemple « 20 30 ».');
            if (!ICONE.test(cases[1] || '')) throw erreur(`icône invalide « ${cases[1] || ''} ».`);
            if (cases[2] && !COULEUR.test(cases[2])) throw erreur(`couleur invalide « ${cases[2]} ».`);
            modele.pictogrammes.push({ x: borne(x, 0, 100), y: borne(y, 0, 100), icone: cases[1], couleur: cases[2] || '#000091', taille: borne(nombre(cases[3]) ?? 48, 8, 300) });
        } else if (cle === 'annotation') {
            const [x, y] = (cases[0] || '').split(/\s+/).map(nombre);
            const [cx, cy] = (cases[1] || '').split(/\s+/).map(nombre);
            if ([x, y, cx, cy].some((v) => v === null || v === undefined)) throw erreur('une annotation commence par la position de la bulle puis celle de la pointe, en pourcentage : « 70 15 | 55 45 | Texte ».');
            modele.annotations.push({ x: borne(x, 0, 100), y: borne(y, 0, 100), cx: borne(cx, 0, 100), cy: borne(cy, 0, 100), texte: cases.slice(2).join(' / ') });
        } else if (OPTIONS[cle]) {
            const [type, , a, b] = OPTIONS[cle];
            let v = valeur;
            if (type === 'oui') { if (!['oui', 'non'].includes(valeur)) throw erreur(`« ${cle} » vaut « oui » ou « non ».`); v = valeur === 'oui'; }
            if (type === 'nombre') { v = nombre(valeur); if (v === null) throw erreur(`« ${cle} » attend un nombre.`); v = borne(v, a, b); }
            if (type === 'couleur' && !COULEUR.test(valeur)) throw erreur(`couleur invalide « ${valeur} ».`);
            if (type === 'choix' && !a.includes(valeur)) throw erreur(`« ${cle} » vaut ${a.join(', ')}.`);
            if (cle === 'filtre' && valeur && !FILTRE.test(valeur)) throw erreur('le filtre s\'écrit avec un opérateur et un seuil, par exemple « >= 1000 ».');
            if (cle === 'couleurs' && couleursPersonnalisees(valeur).length < 2) throw erreur('la palette personnalisée compte deux ou trois couleurs, par exemple « #ffffff, #000091 ».');
            modele.options[cle] = v;
        } else throw erreur(`option inconnue « ${cle} ».`);
    });
    if (ZONES[modele.echelle] && !modele.zone) throw new Error(`Choisissez la zone représentée : ligne « zone: … » (${ECHELLES[modele.echelle].zone}).`);
    if (modele.epingles.length + modele.pictogrammes.length + modele.annotations.length > ELEMENTS_MAX) throw new Error(`Une carte compte au plus ${ELEMENTS_MAX} épingles, pictogrammes et annotations.`);
    return modele;
}

export const option = (modele, cle) => (cle in modele.options ? modele.options[cle] : OPTIONS[cle][1]);
const chiffre = (v) => (v === null || v === undefined ? '' : String(arrondi(v, 6)));

export function ecrire(modele) {
    const lignes = [`carte ${modele.echelle}`];
    if (ZONES[modele.echelle] && modele.zone) lignes.push(`zone: ${modele.zone}`);
    for (const [cle, [type, defaut]] of Object.entries(OPTIONS)) {
        const v = option(modele, cle);
        if (v === defaut || (type === 'texte' && !propre(v))) continue;
        lignes.push(`${cle}: ${type === 'oui' ? (v ? 'oui' : 'non') : type === 'texte' ? propre(v) : v}`);
    }
    for (const e of modele.epingles) lignes.push(`epingle: ${arrondi(e.lat, 5)} ${arrondi(e.lon, 5)} | ${e.couleur} | ${propre(e.texte)}${e.icone ? ` | ${e.icone}` : ''}`.trimEnd());
    for (const p of modele.pictogrammes) lignes.push(`pictogramme: ${arrondi(p.x, 1)} ${arrondi(p.y, 1)} | ${p.icone} | ${p.couleur} | ${Math.round(p.taille)}`);
    for (const a of modele.annotations) lignes.push(`annotation: ${arrondi(a.x, 1)} ${arrondi(a.y, 1)} | ${arrondi(a.cx, 1)} ${arrondi(a.cy, 1)} | ${propre(a.texte)}`);
    for (const d of modele.donnees) lignes.push(`- ${d.code} | ${chiffre(d.valeur)} | ${propre(d.texte)} | ${chiffre(d.filtre)}`.replace(/(\s\|\s*)+$/, ''));
    return lignes.join('\n') + '\n';
}

// ---------- Données issues d'un fichier CSV (moteur de calcul de SimpleCarto) ----------

// Lecture d'un CSV : séparateur deviné sur la première ligne (point-virgule, virgule ou tabulation), champs entre guillemets
export function lireCsv(texte) {
    const source = String(texte).replace(/^﻿/, '');
    // Le séparateur est compté sur le premier enregistrement, hors guillemets : un nom de colonne peut contenir des retours
    // à la ligne (« "Code⏎alpha⏎-3" » dans le jeu d'exemple des pays)
    const comptes = { ';': 0, '\t': 0, ',': 0 };
    for (let i = 0, entre = false; i < source.length; i += 1) {
        const c = source[i];
        if (c === '"') entre = !entre;
        else if (!entre && (c === '\n' || c === '\r')) break;
        else if (!entre && c in comptes) comptes[c] += 1;
    }
    const separateur = Object.entries(comptes).sort((a, b) => b[1] - a[1])[0][0];
    const lignes = [];
    let ligne = [];
    let champ = '';
    let guillemets = false;
    for (let i = 0; i < source.length; i += 1) {
        const c = source[i];
        if (guillemets) {
            if (c === '"' && source[i + 1] === '"') { champ += '"'; i += 1; } else if (c === '"') guillemets = false; else champ += c;
        } else if (c === '"') guillemets = true;
        else if (c === separateur) { ligne.push(champ); champ = ''; } else if (c === '\n' || c === '\r') {
            if (c === '\r' && source[i + 1] === '\n') i += 1;
            ligne.push(champ); champ = '';
            if (ligne.some((x) => x.trim())) lignes.push(ligne);
            ligne = [];
        } else champ += c;
    }
    ligne.push(champ);
    if (ligne.some((x) => x.trim())) lignes.push(ligne);
    const [entetes = [], ...corps] = lignes;
    const colonnes = entetes.map((e, i) => e.replace(/\s+/g, ' ').trim() || `Colonne ${i + 1}`);
    return { colonnes, lignes: corps.map((l) => Object.fromEntries(colonnes.map((c, i) => [c, (l[i] ?? '').trim()]))) };
}

// Code du territoire visé : zéro initial rendu (perdu par les tableurs) et, aux échelles par département, commune
// ramenée à son département
export function codeCible(brut, echelle) {
    let code = String(brut ?? '').trim();
    if (!code) return null;
    if (estMonde(echelle)) return code.toUpperCase();
    if (code.length === 1 || code.length === 4) code = `0${code}`;
    if (echelle === 'france' || echelle === 'region') return code.length >= 4 ? departementDe(code) : code;
    return code;
}

export const CALCULS = [['somme', 'Valeur (somme par territoire)'], ['part', 'Part du total (%)'], ['ratio', 'Ratio colonne 1 / colonne 2'], ['evolution', 'Évolution de la colonne 1 à la colonne 2 (%)']];

export function agreger(lignes, echelle, { colCode, col1, col2, colTexte, colFiltre, calcul }) {
    const parCode = new Map();
    let total = 0;
    for (const l of lignes) {
        const code = codeCible(l[colCode], echelle);
        if (!code || !CODE.test(code)) continue;
        if (!parCode.has(code)) parCode.set(code, { v1: 0, v2: 0, texte: '', filtre: null });
        const acc = parCode.get(code);
        const v1 = nombre(l[col1]) ?? 0;
        acc.v1 += v1;
        acc.v2 += col2 ? nombre(l[col2]) ?? 0 : 0;
        total += v1;
        if (colTexte && !acc.texte && l[colTexte]) acc.texte = propre(l[colTexte]);
        if (colFiltre) acc.filtre = (acc.filtre ?? 0) + (nombre(l[colFiltre]) ?? 0);
    }
    return [...parCode].map(([code, acc]) => {
        let valeur = acc.v1;
        if (calcul === 'ratio') valeur = acc.v2 !== 0 ? acc.v1 / acc.v2 : 0;
        else if (calcul === 'evolution') valeur = acc.v1 !== 0 ? ((acc.v2 - acc.v1) / acc.v1) * 100 : 0;
        else if (calcul === 'part') valeur = total !== 0 ? (acc.v1 / total) * 100 : 0;
        return { code, valeur: arrondi(valeur, 4), texte: acc.texte, filtre: acc.filtre };
    });
}

// ---------- Édition visuelle ----------

export const nomZone = (code) => nomsDesZones.get(code) || code;
const court = (t, n = 50) => enLignes(t).replace(/\n/g, ' ').slice(0, n);
const valeurLisible = (v) => (v === null || v === undefined ? 'sans valeur' : new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(v));

export function elements(modele) {
    return [
        ...modele.donnees.map((d) => ({ cle: `z:${d.code}`, nom: `${nomZone(d.code)} : ${valeurLisible(d.valeur)}${d.texte ? ` (${court(d.texte, 30)})` : ''}` })),
        ...modele.epingles.map((e, n) => ({ cle: `e:${n}`, nom: `Épingle ${n + 1}${e.texte ? ` : ${court(e.texte)}` : ''}` })),
        ...modele.pictogrammes.map((p, n) => ({ cle: `p:${n}`, nom: `Pictogramme ${n + 1} : ${p.icone.split(':')[1]}` })),
        ...modele.annotations.flatMap((a, n) => [{ cle: `a:${n}`, nom: `Annotation ${n + 1} : ${court(a.texte)}` }, { cle: `a:${n}.pointe`, nom: `— pointe de la flèche ${n + 1}` }]),
    ];
}

// Le dessin porte déjà la clé de chaque élément
export function reperer(svg) {
    for (const el of svg.querySelectorAll('[data-champ]')) marquer(el, el.getAttribute('data-champ'));
}

const ligneDe = (modele, cle) => modele.donnees.find((d) => `z:${d.code}` === cle);
const rang = (cle) => Number(cle.slice(2).split('.')[0]);

// Entrée ou F2 : l'étiquette d'un territoire, le libellé d'une épingle, le texte d'une annotation
export function texte(modele, cle) {
    if (cle.startsWith('z:')) return ligneDe(modele, cle)?.texte || nomZone(cle.slice(2));
    if (cle.startsWith('e:')) return modele.epingles[rang(cle)]?.texte ?? null;
    if (cle.startsWith('a:') && !cle.endsWith('.pointe')) return enLignes(modele.annotations[rang(cle)]?.texte ?? '') || null;
    return null;
}

function ligneDonnees(modele, code) {
    let d = modele.donnees.find((x) => x.code === code);
    if (!d) { d = { code, valeur: null, texte: '', filtre: null }; modele.donnees.push(d); }
    return d;
}

export function renommer(modele, cle, valeur) {
    if (cle.startsWith('z:')) {
        const code = cle.slice(2);
        // Le nom du territoire retapé à l'identique n'est pas une étiquette personnalisée
        ligneDonnees(modele, code).texte = propre(valeur) === nomZone(code) ? '' : propre(valeur);
    } else if (cle.startsWith('e:') && modele.epingles[rang(cle)]) modele.epingles[rang(cle)].texte = propre(valeur);
    else if (cle.startsWith('a:') && modele.annotations[rang(cle)]) modele.annotations[rang(cle)].texte = propre(valeur);
}

export function supprimer(modele, cle) {
    if (cle.startsWith('z:')) modele.donnees = modele.donnees.filter((d) => `z:${d.code}` !== cle);
    else if (cle.startsWith('e:')) modele.epingles.splice(rang(cle), 1);
    else if (cle.startsWith('p:')) modele.pictogrammes.splice(rang(cle), 1);
    else if (cle.startsWith('a:')) modele.annotations.splice(rang(cle), 1);
}

export const peutRelier = () => false;

// Épingles, pictogrammes et annotations se glissent à la souris sur la carte
export const zoneDeplacement = (svg) => svg.querySelector('.fusain-carte-cadre');
export const deplacable = (cle) => /^[epa]:/.test(cle);
export function deplacer(modele, cle, x, y) {
    const px = arrondi(borne(x * 100, 0, 100), 1);
    const py = arrondi(borne((1 - y) * 100, 0, 100), 1);
    const n = rang(cle);
    if (cle.startsWith('p:') && modele.pictogrammes[n]) Object.assign(modele.pictogrammes[n], { x: px, y: py });
    else if (cle.startsWith('a:') && modele.annotations[n]) Object.assign(modele.annotations[n], cle.endsWith('.pointe') ? { cx: px, cy: py } : { x: px, y: py });
    else if (cle.startsWith('e:') && modele.epingles[n]) {
        // La position sur la carte est ramenée en latitude et longitude par la projection du dernier rendu
        const lieu = inverserPosition(ecrire(modele), px / 100, py / 100);
        if (lieu) Object.assign(modele.epingles[n], { lat: arrondi(lieu[1], 5), lon: arrondi(lieu[0], 5) });
    }
}

// Changer d'échelle conserve les données dont le code a encore un sens
function changerEchelle(modele, echelle) {
    const avant = modele.echelle;
    modele.echelle = echelle;
    const defaut = { 'region-du-monde': 'EUROES', region: '84', 'region-communes': '84', departement: '69', epci: '200046977', commune: '69123' };
    if (!ZONES[echelle]) modele.zone = '';
    else if (!ZONES[echelle].test(modele.zone)) modele.zone = defaut[echelle];
    if (estMonde(avant) !== estMonde(echelle)) modele.donnees = [];
    // Des centaines de communes étiquetées seraient illisibles
    if (['region-communes', 'departement'].includes(echelle) && !['region-communes', 'departement'].includes(avant)) modele.options.etiquettes = 'aucune';
}

function importer(appliquer, modele) {
    const { echelle } = modele;
    const representes = territoiresRepresentes(ecrire(modele));
    const entree = h('input', { type: 'file', accept: '.csv,.txt,text/csv', class: 'fr-hidden' });
    entree.addEventListener('change', async () => {
        const fichier = entree.files[0];
        if (!fichier) return;
        if (fichier.size > 20 * 1024 * 1024) { message('Fichier trop volumineux', 'Le fichier CSV dépasse 20 Mo.', 'error'); return; }
        const { colonnes, lignes } = lireCsv(await fichier.text());
        if (!colonnes.length || !lignes.length) { message('Fichier illisible', 'Aucune ligne de données n\'a été trouvée dans ce fichier.', 'error'); return; }
        dialogueImport(appliquer, echelle, representes, fichier.name, colonnes, lignes);
    });
    document.body.append(entree);
    entree.click();
    entree.remove();
}

function dialogueImport(appliquer, echelle, representes, nom, colonnes, lignes) {
    const choix = (libelle, id, options, valeur) => champSelect(libelle, options, valeur, () => {}, { id });
    const avecAucune = [['', '— aucune —'], ...colonnes.map((c) => [c, c])];
    const toutes = colonnes.map((c) => [c, c]);
    const devine = colonnes.find((c) => /code|insee|iso|geo|dep|com/i.test(c)) || colonnes[0];
    const chiffree = colonnes.find((c) => c !== devine && lignes.slice(0, 20).every((l) => !l[c] || nombre(l[c]) !== null)) || colonnes[1] || colonnes[0];
    const formulaire = h('form', {},
        h('p', { class: 'fr-text--sm' }, `${nom} : ${lignes.length} ligne(s), ${colonnes.length} colonne(s). Les valeurs sont regroupées par territoire de l'échelle « ${ECHELLES[echelle].nom} » ; à l'échelle des départements, un code de commune est ramené à son département.`),
        choix('Colonne des codes (INSEE, SIREN de l\'EPCI ou ISO 3 du pays)', 'imp-code', toutes, devine),
        choix('Calcul', 'imp-calcul', CALCULS, 'somme'),
        choix('Colonne 1 (valeurs)', 'imp-col1', toutes, chiffree),
        choix('Colonne 2 (ratio, évolution)', 'imp-col2', avecAucune, ''),
        choix('Étiquette personnalisée (facultatif)', 'imp-texte', avecAucune, ''),
        choix('Valeur de filtre des étiquettes (facultatif)', 'imp-filtre', avecAucune, ''));
    formulaire.addEventListener('submit', (e) => e.preventDefault());
    const lire = (id) => formulaire.querySelector(`#${id}`).value;
    const valider = bouton('Importer les données', { variante: 'primary', taille: 'md', icone: 'upload-line', onclick: () => {
        const reglage = { colCode: lire('imp-code'), col1: lire('imp-col1'), col2: lire('imp-col2'), colTexte: lire('imp-texte'), colFiltre: lire('imp-filtre'), calcul: lire('imp-calcul') };
        if (['ratio', 'evolution'].includes(reglage.calcul) && !reglage.col2) { message('Colonne 2 manquante', 'Ce calcul compare deux colonnes : choisissez la colonne 2.', 'warning'); return; }
        // Seuls les territoires de la carte sont gardés : un fichier national ne charge pas la page de milliers de lignes inutiles
        const toutes = agreger(lignes, echelle, reglage);
        const donnees = representes ? toutes.filter((d) => representes.has(d.code)) : toutes;
        if (!donnees.length) { message('Aucune donnée', 'Aucun code de la colonne choisie ne correspond à un territoire de la carte.', 'error'); return; }
        fermerModale(dialogue);
        appliquer((m) => { m.donnees = donnees; });
        const ecartees = toutes.length - donnees.length;
        message('Données importées', `${donnees.length} territoire(s) renseigné(s)${ecartees ? ` ; ${ecartees} code(s) hors de la carte ignoré(s)` : ''}.`, 'success', 6000);
    } });
    const dialogue = modale('fusain-modale-import-carte', 'Importer des données', formulaire, [valider]);
    ouvrirModale(dialogue);
}

// Épingle posée à une adresse de la Base Adresse Nationale : département, commune, voie puis numéro, comme dans SimpleCarto
const COLLECTIVITES = { 975: 'Saint-Pierre-et-Miquelon', 977: 'Saint-Barthélemy', 978: 'Saint-Martin', 987: 'Polynésie française', 988: 'Nouvelle-Calédonie' };
const NUMERO_ABSENT = 0;
const libelleNumero = (n) => (n === NUMERO_ABSENT ? '(sans numéro)' : String(n));

async function dialogueAdresse(appliquer, modele) {
    let deps;
    try { deps = await departementsAdresses(); } catch (e) { message('Adresses indisponibles', e.message, 'error'); return; }
    if (!deps.length) { message('Adresses indisponibles', 'Cette installation de FUSAIN ne contient pas la Base Adresse Nationale.', 'error'); return; }
    const rang = (c) => parseFloat(c.replace('2A', '20.1').replace('2B', '20.2'));
    const nomDep = (c) => DEPARTEMENTS[c] || COLLECTIVITES[c] || c;
    const zone = ['departement', 'commune'].includes(modele.echelle) ? departementDe(modele.zone) : '';
    const depart = deps.includes(zone) ? zone : '';
    const liste = (libelle, id, options) => champSelect(libelle, options, '', () => {}, { id });
    const formulaire = h('form', {},
        h('p', { class: 'fr-text--sm' }, 'Base Adresse Nationale. Les adresses d\'une commune sont téléchargées à son premier choix, puis restent disponibles hors ligne.'),
        liste('Département', 'adr-dep', [['', '— Choisir —'], ...deps.sort((a, b) => rang(a) - rang(b)).map((c) => [c, `${c} — ${nomDep(c)}`])]),
        liste('Commune', 'adr-commune', []),
        liste('Voie', 'adr-voie', []),
        liste('Numéro', 'adr-numero', []));
    formulaire.addEventListener('submit', (e) => e.preventDefault());
    const champ = (id) => formulaire.querySelector(`#${id}`);
    const remplir = (id, options) => {
        champ(id).replaceChildren(...options.map(([v, nom]) => h('option', { value: v }, nom)));
        champ(id).disabled = options.length <= 1;
    };
    let communes = [];
    let voies = [];
    const choisirNumeros = () => {
        const adresses = voies.find(([v]) => v === champ('adr-voie').value)?.[1] || [];
        remplir('adr-numero', adresses.map(([n], i) => [String(i), libelleNumero(n)]));
        // Une voie à adresse unique (lieu-dit) n'a rien à choisir
        champ('adr-numero').disabled = adresses.length <= 1;
    };
    const choisirVoies = async () => {
        voies = [];
        remplir('adr-voie', []); remplir('adr-numero', []);
        const code = champ('adr-commune').value;
        if (!code) return;
        try { voies = await adressesCommune(champ('adr-dep').value, code); } catch (e) { message('Adresses indisponibles', e.message, 'error'); return; }
        if (champ('adr-commune').value !== code) return;
        voies.sort((a, b) => a[0].localeCompare(b[0], 'fr', { numeric: true }));
        remplir('adr-voie', [['', '— Choisir —'], ...voies.map(([v]) => [v, v])]);
    };
    const choisirCommunes = async () => {
        communes = [];
        remplir('adr-commune', []); remplir('adr-voie', []); remplir('adr-numero', []);
        const dep = champ('adr-dep').value;
        if (!dep) return;
        try { communes = await communesAdresses(dep); } catch (e) { message('Adresses indisponibles', e.message, 'error'); return; }
        if (champ('adr-dep').value !== dep) return;
        const triees = [...communes].sort((a, b) => a[1].localeCompare(b[1], 'fr'));
        remplir('adr-commune', [['', '— Choisir —'], ...triees.map(([c, nom]) => [c, `${nom} (${c})`])]);
        if (modele.echelle === 'commune' && communes.some(([c]) => c === modele.zone)) {
            champ('adr-commune').value = modele.zone;
            await choisirVoies();
        }
    };
    champ('adr-dep').addEventListener('change', choisirCommunes);
    champ('adr-commune').addEventListener('change', choisirVoies);
    champ('adr-voie').addEventListener('change', choisirNumeros);
    remplir('adr-commune', []); remplir('adr-voie', []); remplir('adr-numero', []);
    const valider = bouton('Placer l\'épingle', { variante: 'primary', taille: 'md', icone: 'add-line', onclick: () => {
        const voie = voies.find(([v]) => v === champ('adr-voie').value);
        const adresse = voie?.[1][Number(champ('adr-numero').value) || 0];
        if (!adresse) { message('Adresse incomplète', 'Choisissez un département, une commune et une voie.', 'warning'); return; }
        const [numero, lon, lat] = adresse;
        const commune = communes.find(([c]) => c === champ('adr-commune').value)?.[1] || '';
        fermerModale(dialogue);
        appliquer((m) => { m.epingles.push({ lat: arrondi(lat, 5), lon: arrondi(lon, 5), couleur: '#e1000f', texte: `${numero === NUMERO_ABSENT ? '' : `${numero} `}${voie[0]}, ${commune}`, icone: '' }); },
            (m) => `e:${m.epingles.length - 1}`);
    } });
    const dialogue = modale('fusain-modale-adresse', 'Épingle à une adresse', formulaire, [valider]);
    ouvrirModale(dialogue);
    if (depart) { champ('adr-dep').value = depart; await choisirCommunes(); }
}

const optionsZones = (echelle, zone) => {
    if (echelle === 'region-du-monde') return [['auto', 'Pays ayant des données'], ...referentiels.regionsDuMonde.map((r) => [r.code, `${r.categorie} — ${r.nom}`])];
    if (echelle === 'region' || echelle === 'region-communes') return Object.entries(REGIONS).sort((a, b) => a[1].localeCompare(b[1], 'fr'));
    // Par code, Corse comprise entre le 19 et le 21
    const rang = (c) => parseFloat(c.replace('2A', '20.1').replace('2B', '20.2'));
    if (echelle === 'departement') return Object.entries(DEPARTEMENTS).sort((a, b) => rang(a[0]) - rang(b[0])).map(([c, n]) => [c, `${c} — ${n}`]);
    if (echelle === 'epci') return referentiels.epci.length ? referentiels.epci.map((e) => [e.code, `${e.nom} (${e.departements.join(', ')})`]) : [[zone, zone]];
    return [];
};

function choixZone(modele, appliquer) {
    const { echelle, zone } = modele;
    if (!ZONES[echelle]) return null;
    if (echelle !== 'commune') return champSelect(ECHELLES[echelle].zone, optionsZones(echelle, zone), zone, (v) => appliquer((m) => { m.zone = v; }));
    // Commune : le département d'abord, puis la commune parmi les siennes
    const dep = departementDe(zone);
    const communes = referentiels.communes.get(dep) || [[zone, nomZone(zone)]];
    return [
        champSelect('Département', optionsZones('departement'), dep, async (v) => {
            try {
                await lireCommunes(referentiels.regionDuDepartement.get(v));
                const premiere = referentiels.communes.get(v)?.[0]?.[0];
                if (premiere) appliquer((m) => { m.zone = premiere; });
            } catch (e) { message('Communes indisponibles', e.message, 'error'); }
        }),
        champSelect('Commune', communes, zone, (v) => appliquer((m) => { m.zone = v; })),
    ];
}

const couleur = (libelle, valeur, surChangement) => champTexte(libelle, valeur, surChangement, { type: 'color' });
const case_ = (modele, appliquer, cle, libelle) => champCase(libelle, option(modele, cle), (v) => appliquer((m) => { m.options[cle] = v; }));
const nombreOption = (modele, appliquer, cle, libelle, pas = 1) => {
    const [, , min, max] = OPTIONS[cle];
    return champTexte(libelle, option(modele, cle), (v) => { const n = nombre(v); if (n !== null) appliquer((m) => { m.options[cle] = borne(n, min, max); }); }, { type: 'number', min, max, step: pas });
};

export function panneau(ctx) {
    const { modele, selection, appliquer, selectionner } = ctx;
    const blocs = [];
    const metropole = !estMonde(modele.echelle) && !(modele.zone && /^0\d$|^97/.test(modele.zone));

    blocs.push(h('div', { class: 'fusain-bloc' },
        h('h2', {}, 'Carte'),
        champSelect('Échelle', Object.entries(ECHELLES).map(([id, e]) => [id, e.nom]), modele.echelle, (v) => appliquer((m) => changerEchelle(m, v), () => null)),
        choixZone(modele, appliquer)));

    // Territoire, épingle, pictogramme ou annotation sélectionné
    if (selection?.startsWith('z:')) {
        const code = selection.slice(2);
        const d = ligneDe(modele, selection);
        const maj = (champ, lire) => (v) => appliquer((m) => { ligneDonnees(m, code)[champ] = lire(v); });
        blocs.push(h('div', { class: 'fusain-bloc' },
            h('h2', {}, `${nomZone(code)} (${code})`),
            champTexte('Valeur', d?.valeur ?? '', maj('valeur', nombre), { type: 'text', inputmode: 'decimal', id: 'fusain-champ-texte' }),
            champTexte('Étiquette (à la place du nom)', d?.texte ?? '', maj('texte', propre)),
            champTexte('Valeur de filtre', d?.filtre ?? '', maj('filtre', nombre), { inputmode: 'decimal' }),
            d ? actionsListe({ supprimer: () => appliquer((m) => supprimer(m, selection), () => null) }) : null));
    } else if (selection?.startsWith('e:') && modele.epingles[rang(selection)]) {
        const n = rang(selection);
        const e = modele.epingles[n];
        const maj = (champ, lire = (v) => v) => (v) => appliquer((m) => { m.epingles[n][champ] = lire(v); });
        blocs.push(h('div', { class: 'fusain-bloc' },
            h('h2', {}, `Épingle ${n + 1}`),
            champTexte('Libellé', e.texte, maj('texte', propre), { id: 'fusain-champ-texte' }),
            champTexte('Latitude', e.lat, maj('lat', (v) => borne(nombre(v) ?? e.lat, -90, 90)), { inputmode: 'decimal' }),
            champTexte('Longitude', e.lon, maj('lon', (v) => borne(nombre(v) ?? e.lon, -180, 180)), { inputmode: 'decimal' }),
            couleur('Couleur du point', e.couleur, maj('couleur')),
            h('div', { class: 'fusain-actions' },
                bouton(e.icone ? `Icône : ${e.icone.split(':')[1]}…` : 'Remplacer le point par une icône…', { icone: 'layout-grid-line', onclick: () => choisirIcone(e.icone, maj('icone')).catch((x) => message('Icônes indisponibles', x.message, 'error')) }),
                e.icone ? bouton('Retirer l\'icône', { icone: 'close-line', onclick: () => appliquer((m) => { m.epingles[n].icone = ''; }) }) : null),
            h('p', { class: 'fusain-aide' }, 'Glissez l\'épingle sur la carte pour la déplacer.'),
            actionsListe({ supprimer: () => appliquer((m) => supprimer(m, selection), () => null) })));
    } else if (selection?.startsWith('p:') && modele.pictogrammes[rang(selection)]) {
        const n = rang(selection);
        const p = modele.pictogrammes[n];
        const maj = (champ, lire = (v) => v) => (v) => appliquer((m) => { m.pictogrammes[n][champ] = lire(v); });
        blocs.push(h('div', { class: 'fusain-bloc' },
            h('h2', {}, `Pictogramme ${n + 1}`),
            h('div', { class: 'fusain-actions' }, bouton(`Icône : ${p.icone.split(':')[1]}…`, { icone: 'layout-grid-line', onclick: () => choisirIcone(p.icone, maj('icone')).catch((x) => message('Icônes indisponibles', x.message, 'error')) })),
            p.icone.startsWith('dsfr:') ? couleur('Couleur', p.couleur, maj('couleur')) : null,
            champTexte('Taille', p.taille, maj('taille', (v) => borne(nombre(v) ?? p.taille, 8, 300)), { type: 'number', min: 8, max: 300, step: 4 }),
            h('p', { class: 'fusain-aide' }, 'Glissez le pictogramme sur la carte pour le déplacer.'),
            actionsListe({ supprimer: () => appliquer((m) => supprimer(m, selection), () => null) })));
    } else if (selection?.startsWith('a:') && modele.annotations[rang(selection)]) {
        const n = rang(selection);
        const a = modele.annotations[n];
        blocs.push(h('div', { class: 'fusain-bloc' },
            h('h2', {}, `Annotation ${n + 1}`),
            champTexte('Texte', enLignes(a.texte), (v) => appliquer((m) => { m.annotations[n].texte = propre(v); }), { multiligne: true, rows: 3, id: 'fusain-champ-texte' }),
            h('p', { class: 'fusain-aide' }, 'Glissez la bulle, ou le point au bout de la flèche, pour les déplacer.'),
            actionsListe({ supprimer: () => appliquer((m) => supprimer(m, `a:${n}`), () => null) })));
    }

    blocs.push(h('div', { class: 'fusain-bloc' },
        h('h2', {}, `Données (${modele.donnees.length} territoire${modele.donnees.length > 1 ? 's' : ''})`),
        h('div', { class: 'fusain-actions' },
            bouton('Importer un fichier CSV…', { icone: 'upload-line', variante: 'secondary', onclick: () => importer(appliquer, modele) }),
            modele.donnees.length ? bouton('Effacer les données', { icone: 'delete-bin-line', onclick: () => appliquer((m) => { m.donnees = []; }, () => null) }) : null),
        h('p', { class: 'fusain-aide' }, 'Cliquez sur un territoire de la carte pour saisir ou corriger sa valeur. Les codes attendus sont ceux de l\'INSEE (départements, communes), le SIREN des EPCI ou le code ISO à trois lettres des pays.')));

    const palette = option(modele, 'palette');
    const perso = couleursPersonnalisees(option(modele, 'couleurs'));
    blocs.push(h('div', { class: 'fusain-bloc' },
        h('h2', {}, 'Couleurs et légende'),
        champSelect('Palette', PALETTES, palette, (v) => appliquer((m) => { m.options.palette = v; })),
        palette === 'personnalisee' ? [0, 1, 2].map((i) => couleur(i === 2 ? 'Couleur 3 (facultative)' : `Couleur ${i + 1}`, perso[i] || (i === 2 ? '#ffffff' : OPTIONS.couleurs[1].split(', ')[i]), (v) => appliquer((m) => {
            const liste = couleursPersonnalisees(option(m, 'couleurs'));
            liste[i] = v;
            m.options.couleurs = liste.filter(Boolean).join(', ');
        }))) : null,
        palette === 'personnalisee' && perso.length > 2 ? bouton('Revenir à deux couleurs', { icone: 'close-line', onclick: () => appliquer((m) => { m.options.couleurs = perso.slice(0, 2).join(', '); }) }) : null,
        couleur('Fond', option(modele, 'fond'), (v) => appliquer((m) => { m.options.fond = v; })),
        couleur('Territoires voisins', option(modele, 'contexte'), (v) => appliquer((m) => { m.options.contexte = v; })),
        couleur('Territoires sans donnée', option(modele, 'sans-donnee'), (v) => appliquer((m) => { m.options['sans-donnee'] = v; })),
        case_(modele, appliquer, 'legende', 'Afficher la légende des valeurs')));

    blocs.push(h('div', { class: 'fusain-bloc' },
        h('h2', {}, 'Étiquettes'),
        champSelect('Contenu', ETIQUETTES, option(modele, 'etiquettes'), (v) => appliquer((m) => { m.options.etiquettes = v; })),
        nombreOption(modele, appliquer, 'taille-etiquettes', 'Taille du texte'),
        champTexte('N\'étiqueter que ces noms ou codes (séparés par des virgules)', option(modele, 'filtre-noms'), (v) => appliquer((m) => { m.options['filtre-noms'] = propre(v); })),
        champTexte('N\'étiqueter que si la valeur de filtre est… (ex. « >= 1000 »)', option(modele, 'filtre'), (v) => {
            const t = propre(v);
            if (t && !FILTRE.test(t)) { message('Filtre invalide', 'Écrivez un opérateur (>, >=, =, <=, <) suivi d\'un nombre.', 'warning'); return; }
            appliquer((m) => { m.options.filtre = t; });
        }),
        nombreOption(modele, appliquer, 'force', 'Attraction des étiquettes vers leur territoire (0 à 1)', 0.05),
        nombreOption(modele, appliquer, 'espacement', 'Espacement entre étiquettes')));

    blocs.push(h('div', { class: 'fusain-bloc' },
        h('h2', {}, 'Fonds de carte'),
        metropole ? [
            case_(modele, appliquer, 'relief', 'Relief (estompage IGN)'),
            option(modele, 'relief') ? nombreOption(modele, appliquer, 'opacite-relief', 'Opacité du relief (0 à 1)', 0.1) : null,
            case_(modele, appliquer, 'hydrographie', 'Cours d\'eau'),
            case_(modele, appliquer, 'rail', 'Voies ferrées'),
            case_(modele, appliquer, 'routes', 'Routes nationales'),
            h('p', { class: 'fusain-aide' }, 'Réseau routier par fonction (IGN, ROUTE 500, édition 2021) :'),
            case_(modele, appliquer, 'routes-autoroutes', 'Autoroutes et voies rapides'),
            case_(modele, appliquer, 'routes-principales', 'Liaisons principales'),
            case_(modele, appliquer, 'routes-regionales', 'Liaisons régionales'),
            h('p', { class: 'fusain-aide' }, 'Ces fonds sont téléchargés à la première utilisation, puis disponibles hors ligne.'),
        ] : h('p', { class: 'fusain-aide' }, 'Relief, cours d\'eau, voies ferrées et routes ne couvrent que la France métropolitaine.')));

    const ajouter = (liste, element, cle) => () => appliquer((m) => { m[liste].push(element); }, (m) => `${cle}:${m[liste].length - 1}`);
    blocs.push(h('div', { class: 'fusain-bloc' },
        h('h2', {}, 'Épingles, pictogrammes, annotations'),
        h('div', { class: 'fusain-actions' },
            bouton('Épingle', { icone: 'add-line', onclick: () => {
                const centre = inverserPosition(ecrire(modele), 0.5, 0.5) || [2.35, 46.6];
                ajouter('epingles', { lat: arrondi(centre[1], 5), lon: arrondi(centre[0], 5), couleur: '#e1000f', texte: 'Nouvelle épingle', icone: '' }, 'e')();
            } }),
            bouton('Épingle à une adresse…', { icone: 'search-line', onclick: () => dialogueAdresse(appliquer, modele) }),
            bouton('Pictogramme', { icone: 'add-line', onclick: () => choisirIcone('dsfr:map-pin-2-line', (icone) => ajouter('pictogrammes', { x: 50, y: 50, icone, couleur: '#000091', taille: 48 }, 'p')()).catch((x) => message('Icônes indisponibles', x.message, 'error')) }),
            bouton('Annotation', { icone: 'add-line', onclick: ajouter('annotations', { x: 75, y: 15, cx: 55, cy: 45, texte: 'Votre annotation' }, 'a') })),
        modele.epingles.length ? [
            case_(modele, appliquer, 'libelles-epingles', 'Libellés des épingles'),
            case_(modele, appliquer, 'legende-epingles', 'Légende des épingles'),
            nombreOption(modele, appliquer, 'taille-epingles', 'Taille des points'),
            nombreOption(modele, appliquer, 'taille-icones', 'Taille des icônes', 4),
        ] : null));

    blocs.push(h('div', { class: 'fusain-bloc' }, h('h2', {}, 'Contenu'), plan(elements(modele), selection, selectionner)));
    return blocs;
}

// Code de départ d'une carte
export function codeInitial(echelle, zone = '', donnees = [], options = {}) {
    return ecrire({ echelle, zone, options, donnees: donnees.map(([code, valeur]) => ({ code, valeur, texte: '', filtre: null })), epingles: [], pictogrammes: [], annotations: [] });
}

export default { type: 'carte', nom: 'Carte', analyser, ecrire, elements, reperer, texte, renommer, supprimer, peutRelier, deplacer, deplacable, zoneDeplacement, panneau };
