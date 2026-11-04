// Diagnostic d'une erreur de syntaxe : ligne réelle, objet que la ligne tente d'écrire, syntaxe attendue et réparations
// candidates. Tout est calculé sur le texte, sans navigateur ; les réparations sont ensuite essayées par le rendu
// (rendu.js, verifierCode) et seules celles qui passent sont proposées.
import { typeDiagramme } from './securite.js';
import { SYNTAXES, objetDe } from './syntaxes.js';
import { DISPOSITIONS } from './diagrammes/diapo.js';
import { ECHELLES, OPTIONS } from './diagrammes/carte.js';

const PROPRES = new Set(['diapo', 'carte']); // écritures de FUSAIN, lues ligne à ligne sans Mermaid

// ---------- Outils ----------

export function distance(a, b) {
    a = a.toLowerCase();
    b = b.toLowerCase();
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j += 1) d[0][j] = j;
    for (let i = 1; i <= a.length; i += 1) {
        for (let j = 1; j <= b.length; j += 1) {
            d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
            if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
        }
    }
    return d[a.length][b.length];
}

// Mot le plus proche d'une liste, à une distance raisonnable de sa longueur
export function plusProche(mot, liste) {
    let meilleur = null;
    let ecart = Infinity;
    for (const candidat of liste) {
        const e = distance(mot, candidat);
        if (e < ecart) { ecart = e; meilleur = candidat; }
    }
    const tolere = mot.length <= 4 ? 1 : mot.length <= 8 ? 2 : 3;
    return meilleur && ecart <= tolere ? meilleur : null;
}

const lignesDe = (code) => String(code ?? '').replace(/\r\n?/g, '\n').split('\n');
const indentation = (ligne) => ligne.match(/^\s*/)[0];
const estCommentaire = (t) => /^%%/.test(t.trim());

// Bloc « --- … --- » de tête : indices de ses lignes
function blocDeTete(lignes) {
    let i = 0;
    while (i < lignes.length && !lignes[i].trim()) i += 1;
    if (lignes[i]?.trim() !== '---') return new Set();
    const fin = lignes.findIndex((l, k) => k > i && /^---\s*$/.test(l));
    if (fin < 0) return new Set();
    return new Set(Array.from({ length: fin - i + 1 }, (_, k) => i + k));
}

// Ligne de l'en-tête (le type du schéma) : indice dans le code
function ligneEntete(lignes) {
    const tete = blocDeTete(lignes);
    let directive = false;
    for (let i = 0; i < lignes.length; i += 1) {
        const t = lignes[i].trim();
        if (tete.has(i)) continue;
        if (directive) { if (t.includes('}%%')) directive = false; continue; }
        if (t.startsWith('%%{')) { if (!t.includes('}%%')) directive = true; continue; }
        if (!t || estCommentaire(t)) continue;
        return i;
    }
    return -1;
}

// Lignes du code que Mermaid numérote : il retire le bloc de tête, les directives, les commentaires et les lignes vides
// du début (le diagramme de flux, toutes ses lignes vides). Rend les indices des lignes conservées, dans l'ordre.
export function lignesConservees(code, type = typeDiagramme(code)) {
    const lignes = lignesDe(code);
    const tete = blocDeTete(lignes);
    const gardees = [];
    let directive = false;
    for (let i = 0; i < lignes.length; i += 1) {
        const t = lignes[i].trim();
        if (tete.has(i)) continue;
        if (directive) { if (t.includes('}%%')) directive = false; continue; }
        if (t.startsWith('%%{')) { if (!t.includes('}%%')) directive = true; continue; }
        if (/^\s*%%.+/.test(lignes[i]) && !t.startsWith('%%{')) continue;
        if (!t && (!gardees.length || type === 'sankey')) continue;
        gardees.push(i);
    }
    return gardees;
}

// Position de l'erreur dans le code de l'utilisateur : { ligne, colonne, finDeCode } (lignes et colonnes à partir de 1)
export function localiser(code, erreur) {
    const type = typeDiagramme(code);
    const message = String(erreur?.message ?? erreur ?? '');
    const lignes = lignesDe(code);
    if (PROPRES.has(type)) {
        const m = message.match(/^Ligne\s+(\d+)/i);
        if (m) return { ligne: Math.min(Number(m[1]), lignes.length), colonne: null, finDeCode: false };
        return null;
    }
    const loc = erreur?.hash?.loc;
    let n = loc?.first_line ?? Number(message.match(/\bline\s+(\d+)/i)?.[1] || 0);
    let colonne = loc ? loc.first_column + 1 : Number(message.match(/\bcolumn\s+(\d+)/i)?.[1] || 0) || null;
    if (!n) return null;
    const gardees = lignesConservees(code, type);
    if (n > gardees.length || (n === gardees.length && !lignes[gardees[n - 1]].trim())) {
        // Fin du code atteinte : la faute est en amont, on désigne la dernière ligne écrite
        const derniere = [...gardees].reverse().find((i) => lignes[i].trim() && !estCommentaire(lignes[i]));
        return derniere === undefined ? null : { ligne: derniere + 1, colonne: null, finDeCode: true };
    }
    // Mermaid mesure la colonne après avoir retiré l'indentation de la première ligne
    const i = gardees[n - 1];
    if (colonne && n === 1) colonne += indentation(lignes[i]).length;
    return { ligne: i + 1, colonne, finDeCode: false };
}

// ---------- Contrôles de structure ----------

// Blocs ouverts et fermés (subgraph/end, loop/end, accolades) : le premier déséquilibre trouvé
function blocs(lignes, def, debut) {
    if (!def.blocs) return null;
    const pile = [];
    for (let i = debut + 1; i < lignes.length; i += 1) {
        const t = lignes[i].trim();
        if (!t || estCommentaire(t)) continue;
        const ferme = def.blocs.ferme.test(t);
        const ouvre = def.blocs.ouvre.test(t);
        if (ferme) {
            if (!pile.length) return { genre: 'enTrop', i };
            pile.pop();
        }
        if (ouvre) pile.push(i);
    }
    return pile.length ? { genre: 'ouvert', i: pile[pile.length - 1] } : null;
}

// Crochets et guillemets d'une ligne, hors des parties entre guillemets
function equilibre(t) {
    const paires = { '(': ')', '[': ']', '{': '}' };
    const fermants = { ')': '(', ']': '[', '}': '{' };
    const pile = [];
    const enTrop = [];
    let guillemets = 0;
    let dans = false;
    for (let k = 0; k < t.length; k += 1) {
        const c = t[k];
        if (c === '"') { dans = !dans; guillemets += 1; continue; }
        if (dans) continue;
        if (paires[c]) pile.push({ c, k });
        else if (fermants[c]) {
            if (pile.length && pile[pile.length - 1].c === fermants[c]) pile.pop();
            else enTrop.push(k);
        }
    }
    return { manquants: pile.map((p) => ({ ...p, f: paires[p.c] })), enTrop, guillemetsImpairs: guillemets % 2 === 1 };
}

// Début d'un lien dans une ligne de logigramme (pour fermer une étape avant lui)
const LIEN = /\s+(<?(?:--|==|-\.)[-.=]*[>ox]?|&)(?=\s|\||$)/;

// ---------- Réparations par type ----------

const fleches = (t) => t
    .replace(/[—–]+>/g, '-->')
    .replace(/(?<![-=.<>])->(?![>-])/g, '-->')
    .replace(/(?<![=<])=>(?![>=])/g, '==>')
    .replace(/(?<![<])<-(?![-<])/g, '<--')
    .replace(/-\s+>/g, '-->');

const OUVRANTS = [['([', '])'], ['[(', ')]'], ['[[', ']]'], ['((', '))'], ['{{', '}}'], ['[/', '/]'], ['[\\', '\\]'], ['[', ']'], ['(', ')'], ['{', '}'], ['>', ']']];
const RESERVES = /[()[\]{}<>|]/;

// Libellés d'étapes qui contiennent des caractères réservés : mis entre guillemets
function libellesEntreGuillemets(t) {
    let sortie = '';
    let reste = t;
    let change = false;
    const debutNoeud = /(^|[\s&|>])([\p{L}\p{N}_-]+)(?=[[({>])/u;
    for (let garde = 0; garde < 20 && reste; garde += 1) {
        const m = reste.match(debutNoeud);
        if (!m) break;
        const posId = m.index + m[1].length;
        const apresId = posId + m[2].length;
        const ouvrant = OUVRANTS.find(([o]) => reste.startsWith(o, apresId));
        if (!ouvrant || (ouvrant[0] === '>' && /[->]$/.test(reste.slice(0, apresId)))) { sortie += reste.slice(0, apresId); reste = reste.slice(apresId); continue; }
        const [o, f] = ouvrant;
        const debutLibelle = apresId + o.length;
        // Fin de l'étape : avant le lien suivant, ou en fin de ligne
        const suite = reste.slice(debutLibelle);
        const lien = suite.match(LIEN);
        const segment = lien ? suite.slice(0, lien.index) : suite;
        const fin = segment.lastIndexOf(f);
        const libelle = fin >= 0 ? segment.slice(0, fin) : segment;
        const apres = fin >= 0 ? segment.slice(fin + f.length) : '';
        if (!libelle.startsWith('"') && (RESERVES.test(libelle) || fin < 0)) {
            sortie += reste.slice(0, debutLibelle) + `"${libelle.trim().replace(/"/g, '#quot;')}"` + f + apres;
            change = true;
        } else sortie += reste.slice(0, debutLibelle) + segment;
        reste = suite.slice(segment.length);
    }
    return change ? sortie + reste : null;
}

const guillemetsDroits = (t) => t.replace(/«\s*/g, '"').replace(/\s*»/g, '"').replace(/[“”„]/g, '"');

const nombreFr = (v) => String(v).replace(/\s/g, '').replace(',', '.');

function reglesLogigramme(t, ctx) {
    const r = [];
    const f = fleches(t);
    if (f !== t) r.push({ apres: f, libelle: 'Écrire la flèche avec deux tirets', cause: 'La flèche est mal écrite : un lien s\'écrit avec deux tirets et un chevron (-->), ou ==> pour un trait épais.' });
    const g = libellesEntreGuillemets(f);
    if (g) r.push({ apres: g, objet: 'etape', libelle: 'Mettre le libellé entre guillemets', cause: 'Le libellé contient des caractères qui ont un sens dans le code (parenthèses, crochets, accolades, barres verticales) : il doit être entre guillemets.' });
    const sansCible = t.match(/^(.*?)\s*<?(?:--|==|-\.)[-.=]*[>ox]?\s*(\|[^|]*\|)?\s*$/);
    if (sansCible && sansCible[1] && !/^(subgraph|end)\b/.test(t)) r.push({ apres: sansCible[1], libelle: 'Retirer le lien sans étape d\'arrivée', cause: 'Le lien n\'a pas d\'étape d\'arrivée.' });
    const barres = t.match(/^(.*?(?:-->|---|-\.->|==>))\|([^|]*?)\s+(\S+)$/);
    if (barres && !barres[2].includes('|')) r.push({ apres: `${barres[1]}|${barres[2].trim()}| ${barres[3]}`, libelle: 'Fermer le texte du lien', cause: 'Le texte du lien doit être encadré par deux barres verticales.' });
    if (t !== 'end' && /(^|[\s&>|-])end(?=$|[\s[({&;:-])/.test(t)) {
        const code = ctx.lignes.map((l) => (/^\s*end\s*$/.test(l) ? l : l.replace(/(^|[\s&>|-])end(?=$|[\s[({&;:-])/g, '$1fin'))).join('\n');
        r.push({ code, libelle: 'Renommer l\'étape « end » en « fin » dans tout le code', cause: '« end » est un mot réservé (il ferme un groupe) : il ne peut pas servir d\'identifiant d\'étape.' });
    }
    return r;
}

function reglesSequence(t) {
    const r = [];
    const f = t.replace(/[—–]+>/g, '-->').replace(/(?<![-=])=>>?/g, '->>').replace(/-\s+>/g, '->');
    if (f !== t) r.push({ apres: f, libelle: 'Corriger la flèche', cause: 'Flèche inconnue : un message s\'écrit A->>B (appel) ou A-->>B (réponse).' });
    const m = f.match(/^([^\s:-][^:]*?)\s*(<<)?(--?>>|--?>|--?x|--?\))\s*([+-]?)\s*([^\s:+-][^\s:]*)\s+([^:].*)$/);
    if (m && !f.includes(':')) r.push({ apres: `${m[1]}${m[2] || ''}${m[3]}${m[4]}${m[5]}: ${m[6]}`, libelle: 'Ajouter les deux-points avant le texte', cause: 'Le texte d\'un message suit deux-points : A->>B: texte.' });
    const sansDeuxPoints = f.match(/^([^\s:-][^:]*?)\s*(--?>>|--?>)\s*(\S+)$/);
    if (sansDeuxPoints) r.push({ apres: `${sansDeuxPoints[1]}${sansDeuxPoints[2]}${sansDeuxPoints[3]}: `, libelle: 'Ajouter un texte au message', cause: 'Un message doit avoir un texte après deux-points.' });
    const note = f.match(/^note\s+(right|left)\s+(?!of\b)(.+)$/i);
    if (note) r.push({ apres: `Note ${note[1].toLowerCase()} of ${note[2]}`, libelle: 'Écrire « right of » / « left of »', cause: 'La position d\'une note s\'écrit right of, left of ou over.' });
    const noteSansPosition = f.match(/^note\s+(?!right\b|left\b|over\b)([^:]+?)\s*:\s*(.*)$/i);
    if (noteSansPosition) r.push({ apres: `Note right of ${noteSansPosition[1]}: ${noteSansPosition[2]}`, libelle: 'Préciser la position de la note', cause: 'Une note doit dire où elle se place : right of, left of ou over.' });
    const participant = f.match(/^(participant|actor)\s+(\S+)\s+(?!as\b)(.+)$/);
    if (participant) r.push({ apres: `${participant[1]} ${participant[2]} as ${participant[2]} ${participant[3]}`, libelle: 'Séparer l\'identifiant du nom affiché', cause: 'L\'identifiant d\'un participant n\'a pas d\'espace ; le nom affiché suit « as ».' });
    return r;
}

function reglesEtats(t) {
    const r = [];
    let f = fleches(t).replace(/\(\*\)|\[\s*\*\s*\]/g, '[*]');
    if (f !== t) r.push({ apres: f, libelle: 'Corriger la transition', cause: 'Une transition s\'écrit A --> B ; l\'état initial ou final, [*].' });
    const texte = f.match(/^(\S+)\s*-->\s*(\S+)\s+([^:\s].*)$/);
    if (texte) r.push({ apres: `${texte[1]} --> ${texte[2]} : ${texte[3]}`, libelle: 'Ajouter les deux-points avant le texte', cause: 'Le texte d\'une transition suit deux-points.' });
    const inverse = f.match(/^state\s+([\p{L}\w]+)\s+as\s+"([^"]*)"\s*$/u);
    if (inverse) r.push({ apres: `state "${inverse[2]}" as ${inverse[1]}`, libelle: 'Mettre le nom affiché avant « as »', cause: 'Un état nommé s\'écrit state "Nom affiché" as identifiant.' });
    return r;
}

function reglesClasses(t) {
    const r = [];
    const f = fleches(t);
    if (f !== t) r.push({ apres: f, libelle: 'Corriger la relation', cause: 'Relation mal écrite.' });
    const card = t.match(/^(\S+)\s+([\d*n.]+)\s+(<\|--|--\|>|\*--|o--|-->|--|\.\.>|\.\.)\s+([\d*n.]+)\s+(\S+)(.*)$/);
    if (card) r.push({ apres: `${card[1]} "${card[2]}" ${card[3]} "${card[4]}" ${card[5]}${card[6]}`, libelle: 'Mettre les cardinalités entre guillemets', cause: 'Les cardinalités d\'une relation vont entre guillemets.' });
    return r;
}

function reglesEntites(t, ctx) {
    const r = [];
    const rel = t.match(/^("[^"]+"|\S+)\s+(\S*(?:--|\.\.)\S*)\s+("[^"]+"|[^\s:]+)\s*(:.*)?$/);
    if (rel) {
        let [, a, lien, b, libelle] = rel;
        let corrige = lien.replace(/</g, '{').replace(/>/g, '}');
        const humain = corrige.match(/^([1n*]+)(--|\.\.)([1n*]+)$/i);
        if (humain) corrige = `${humain[1] === '1' ? '||' : '}o'}${humain[2]}${humain[3] === '1' ? '||' : 'o{'}`;
        if (!libelle || !libelle.slice(1).trim()) libelle = ': ""';
        const apres = `${a} ${corrige} ${b} ${libelle.replace(/^:\s*/, ': ')}`;
        if (apres !== t) r.push({ apres, libelle: corrige !== lien ? 'Corriger les cardinalités' : 'Ajouter le libellé de la relation', cause: corrige !== lien ? 'Cardinalités inconnues : ||, |o, }o, }| d\'un côté ; ||, o|, o{, |{ de l\'autre.' : 'Une relation se termine par deux-points et un libellé ("" s\'il est vide).' });
    }
    if (/^[\p{L}\w-]+$/u.test(t) && ctx.dansBloc) r.push({ apres: `string ${t}`, libelle: 'Donner un type à l\'attribut', cause: 'Un attribut s\'écrit avec son type puis son nom.' });
    return r;
}

function reglesGantt(t, ctx) {
    const r = [];
    const format = (ctx.code.match(/^\s*dateFormat\s+(\S+)/m) || [])[1] || 'YYYY-MM-DD';
    let f = t;
    if (format === 'YYYY-MM-DD') f = f.replace(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/g, (_, j, m, a) => `${a}-${m.padStart(2, '0')}-${j.padStart(2, '0')}`);
    f = f.replace(/\b(\d+)\s*(?:jours?|j)\b/gi, '$1d').replace(/\b(\d+)\s*(?:semaines?|sem)\b/gi, '$1w').replace(/\b(\d+)\s+([dwh])\b/g, '$1$2');
    if (f !== t) r.push({ apres: f, libelle: 'Écrire les dates et durées au format attendu', cause: `Les dates s'écrivent au format déclaré (${format}) et les durées en d (jours), w (semaines) ou h (heures).` });
    if (!f.includes(':') && !/^(section|title|dateFormat|axisFormat|excludes|includes|todayMarker|tickInterval|weekday)\b/i.test(f)) {
        const m = f.match(/^(.*?)\s+([\p{L}\w-]+\s*,.*)$/u);
        if (m) r.push({ apres: `${m[1]} :${m[2]}`, libelle: 'Ajouter les deux-points après le nom de la tâche', cause: 'Le nom d\'une tâche est suivi de deux-points.' });
    }
    return r;
}

function reglesCamembert(t) {
    if (/^(title|showData|pie)\b/i.test(t)) return [];
    const m = t.match(/^"?(.*?)"?\s*:?\s*(-?\d[\d\s]*(?:[.,]\d+)?)\s*(?:%|[^\d\s.,"]*)$/);
    if (!m || !m[1].trim()) return [];
    const apres = `"${m[1].trim().replace(/"/g, '')}" : ${nombreFr(m[2])}`;
    return apres === t ? [] : [{ apres, libelle: 'Écrire la part au format « "Libellé" : valeur »', cause: 'Une part s\'écrit "Libellé" : valeur, avec des guillemets droits et un point décimal.' }];
}

function reglesArchitecture(t) {
    const r = [];
    const lien = t.match(/^([\w-]+)(?::([LRTBlrtb]))?\s*(<?--?>?|<?-\[[^\]]*\]->?)\s*(?:([LRTBlrtb]):)?([\w-]+)$/);
    if (lien && /-/.test(lien[3])) {
        const fl = lien[3] === '->' ? '-->' : lien[3] === '<-' ? '<--' : lien[3];
        const apres = `${lien[1]}:${(lien[2] || 'R').toUpperCase()} ${fl} ${(lien[4] || 'L').toUpperCase()}:${lien[5]}`;
        if (apres !== t) r.push({ apres, libelle: 'Préciser les côtés de la liaison', cause: 'Chaque extrémité d\'une liaison précise son côté : a:R -- L:b (L gauche, R droite, T haut, B bas).' });
    }
    const sansIcone = t.match(/^(service|group)\s+([\w-]+)\s*\[(.*)\](.*)$/);
    if (sansIcone) r.push({ apres: `${sansIcone[1]} ${sansIcone[2]}(${sansIcone[1] === 'group' ? 'cloud' : 'server'})[${sansIcone[3]}]${sansIcone[4]}`, libelle: 'Ajouter une icône', cause: 'Un service ou un groupe se déclare avec son icône : service id(icône)[Libellé].' });
    const accents = t.match(/^(service|group)\s+([\w-]+\([^)]*\))\[(.*)\](.*)$/);
    if (accents && /[^A-Za-z0-9 ]/.test(accents[3])) {
        const propre = accents[3].normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
        r.push({ apres: `${accents[1]} ${accents[2]}[${propre}]${accents[4]}`, libelle: 'Retirer accents et signes du libellé', cause: 'Ce libellé contient des caractères que le schéma d\'architecture n\'accepte pas.' });
    }
    return r;
}

function reglesDivers(type, t) {
    const r = [];
    const ajouter = (apres, libelle, cause) => { if (apres && apres !== t) r.push({ apres, libelle, cause }); };
    if (type === 'timeline') {
        const m = t.match(/^([^:]+?)\s*(?:-|–|:)\s*(.+)$/);
        if (m && !/^(title|section)\b/.test(t)) ajouter(`${m[1]} : ${m[2]}`, 'Séparer la période de l\'événement par « : »', 'Une période et son événement sont séparés par deux-points entourés d\'espaces.');
    }
    if (type === 'journey' && !/^(title|section)\b/.test(t)) {
        const m = t.match(/^([^:]+):\s*([^:\d][^:]*)$/);
        if (m) ajouter(`${m[1]}: 3: ${m[2].trim()}`, 'Ajouter une note de satisfaction', 'Une tâche s\'écrit Tâche: note: Acteurs, note de 1 à 5.');
        const n = t.match(/^([^:]+):\s*(\d+)\s*:(.*)$/);
        if (n && (Number(n[2]) > 5 || Number(n[2]) < 1)) ajouter(`${n[1]}: ${Math.max(1, Math.min(5, Number(n[2])))}:${n[3]}`, 'Ramener la note entre 1 et 5', 'La note de satisfaction va de 1 à 5.');
    }
    if (type === 'quadrantChart') {
        const m = t.match(/^"?([^":[]+?)"?\s*:\s*\[(.*)\]\s*$/);
        if (m) {
            let v = m[2].replace(/;/g, ' , ').match(/-?\d+(?:[.,]\d+)?/g) || [];
            if (v.length === 4 && m[2].split(',').length === 4 && !m[2].includes(';')) v = [`${v[0]}.${v[1]}`, `${v[2]}.${v[3]}`];
            v = v.map((x) => Number(nombreFr(x))).map((x) => (x > 1 && x <= 100 ? x / 100 : x));
            if (v.length === 2 && v.every((x) => x >= 0 && x <= 1)) ajouter(`"${m[1].trim()}": [${v[0]}, ${v[1]}]`, 'Écrire le point « "Nom": [x, y] »', 'Les coordonnées vont de 0 à 1, avec un point décimal.');
        }
    }
    if (type === 'xychart') {
        const axe = t.match(/^(x-axis)\s*(?:"[^"]*"\s*)?\[(.*)\]\s*$/);
        if (axe && /[^",\s]/.test(axe[2].replace(/"[^"]*"/g, ''))) ajouter(`${t.slice(0, t.indexOf('['))}[${axe[2].split(/[,;]/).map((x) => `"${x.trim().replace(/"/g, '')}"`).join(', ')}]`, 'Mettre les catégories entre guillemets', 'Les catégories de l\'axe vont entre guillemets, séparées par des virgules.');
        const serie = t.match(/^(bar|line)\s*\[(.*)\]\s*$/);
        if (serie && (serie[2].includes(';') || /\d,\d/.test(serie[2]))) {
            const valeurs = serie[2].includes(';') ? serie[2].split(';').map(nombreFr) : serie[2].split(/,\s+/).map(nombreFr);
            ajouter(`${serie[1]} [${valeurs.join(', ')}]`, 'Séparer les valeurs par des virgules', 'Les valeurs sont séparées par des virgules, avec un point décimal.');
        }
    }
    if (type === 'sankey') {
        let champs = null;
        if (t.includes(';')) champs = t.split(';');
        const fleche = t.match(/^(.+?)\s*-+>\s*(.+?)\s*:\s*([\d.,]+)$/);
        if (fleche) champs = [fleche[1], fleche[2], fleche[3]];
        if (!champs) champs = t.match(/^(.+?),(.+?),(\d+),(\d+)$/)?.slice(1).reduce((a, x, i) => (i === 3 ? [a[0], a[1], `${a[2]}.${x}`] : [...a, x]), []) || t.split(',');
        if (champs.length === 3) {
            const [a, b, v] = champs.map((x) => x.trim().replace(/^"|"$/g, ''));
            // Le diagramme de flux de Mermaid n'accepte pas les lettres accentuées, même entre guillemets
            const q = (x) => { const s = x.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); return s.includes(',') ? `"${s.replace(/"/g, '""')}"` : s; };
            ajouter(`${q(a)},${q(b)},${nombreFr(v)}`, 'Écrire le flux « Source,Cible,valeur », sans accents', 'Un flux compte trois champs séparés par des virgules ; les libellés ne peuvent pas contenir de lettres accentuées.');
        }
    }
    if (type === 'gitGraph') ajouter(t.replace(/\b(id|tag|msg):\s*([^"\s][^\s]*)/g, '$1: "$2"'), 'Mettre les valeurs entre guillemets', 'Les valeurs de id, tag et msg vont entre guillemets.');
    if (type === 'packet') {
        const m = t.match(/^(\+?\d+(?:\s*-\s*\d+)?)\s*:?\s*"?([^"]*?)"?\s*$/);
        if (m && !/^title\b/.test(t)) ajouter(`${m[1].replace(/\s/g, '')}: "${m[2]}"`, 'Écrire le champ « début-fin: "Libellé" »', 'Un champ s\'écrit avec ses positions, deux-points et un libellé entre guillemets.');
    }
    if (type === 'radar') {
        const m = t.match(/^(curve\s+.*\{)(.*)\}\s*$/);
        if (m && (m[2].includes(';') || /\d,\d/.test(m[2]))) ajouter(`${m[1]}${(m[2].includes(';') ? m[2].split(';') : m[2].split(/,\s+/)).map(nombreFr).join(', ')}}`, 'Séparer les valeurs par des virgules', 'Les valeurs sont séparées par des virgules, avec un point décimal.');
    }
    if (type === 'treemap') {
        const m = t.match(/^"?([^":]+?)"?\s*(?::\s*([\d\s.,]+))?\s*$/);
        if (m) ajouter(`"${m[1].trim()}"${m[2] ? `: ${nombreFr(m[2])}` : ''}`, 'Écrire « "Libellé": valeur »', 'Libellé entre guillemets, valeur après deux-points avec un point décimal.');
    }
    if (type === 'treeView') {
        const m = t.match(/^"?([^"]+?)"?$/);
        if (m) ajouter(`"${m[1]}"`, 'Mettre l\'élément entre guillemets', 'Chaque élément s\'écrit entre guillemets.');
    }
    if (type === 'venn') {
        ajouter(t.replace(/^(union\s+\w+)\s*,\s*(\w+)/, '$1,$2').replace(/\[([^"\]][^\]]*)\]/, '["$1"]'), 'Écrire l\'ensemble au format attendu', 'set id["Libellé"] ; union id1,id2["Libellé"].');
    }
    if (type.startsWith('C4')) {
        const rel = t.match(/^((?:Bi)?Rel\w*)\(\s*([^,]+?)\s*,\s*([^,)]+?)\s*\)$/);
        if (rel) ajouter(`${rel[1]}(${rel[2]}, ${rel[3]}, "")`, 'Ajouter le libellé de la relation', 'Une relation s\'écrit Rel(de, vers, "Libellé").');
        const el = t.match(/^(\w+)\((.*)\)(\s*\{)?$/);
        if (el) {
            const args = el[2].split(',').map((x) => x.trim());
            const debut = /Rel/.test(el[1]) ? 2 : 1;
            const quotes = args.map((x, i) => (i >= debut && x && !/^".*"$/.test(x) ? `"${x.replace(/"/g, '')}"` : x));
            ajouter(`${el[1]}(${quotes.join(', ')})${el[3] || ''}`, 'Mettre les textes entre guillemets', 'Les textes des éléments C4 vont entre guillemets.');
        }
    }
    if (type === 'requirementDiagram') {
        const risques = { 'élevé': 'high', eleve: 'high', haut: 'high', fort: 'high', moyen: 'medium', faible: 'low', bas: 'low' };
        const methodes = { analyse: 'analysis', 'démonstration': 'demonstration', demonstration: 'demonstration', essai: 'test' };
        const m = t.match(/^(risk|verifymethod)\s*:\s*(.+)$/i);
        if (m) {
            const v = m[2].trim().toLowerCase();
            const corrige = m[1].toLowerCase() === 'risk' ? risques[v] || plusProche(v, ['low', 'medium', 'high']) : methodes[v] || plusProche(v, ['analysis', 'inspection', 'test', 'demonstration']);
            if (corrige) ajouter(`${m[1].toLowerCase()}: ${corrige}`, `Écrire « ${corrige} »`, 'risk vaut low, medium ou high ; verifymethod, analysis, inspection, test ou demonstration.');
        }
        const texte = t.match(/^(id|text)\s*:\s*([^"].*)$/i);
        if (texte) ajouter(`${texte[1]}: "${texte[2].trim().replace(/"/g, '')}"`, 'Mettre la valeur entre guillemets', 'id et text vont entre guillemets.');
    }
    return r;
}

// Écritures propres à FUSAIN : clé inconnue, mise en page ou échelle inconnue
function reglesPropres(type, t, ctx) {
    const r = [];
    const m = t.match(/^([\p{L}-]+)\s*:\s*(.*)$/u);
    if (type === 'diapo') {
        const entete = ctx.lignes[ctx.entete]?.trim().match(/^diapo\s+([a-z-]+)/);
        const d = DISPOSITIONS[entete?.[1]];
        if (ctx.i === ctx.entete) {
            const mot = t.split(/\s+/)[1] || '';
            const proche = plusProche(mot, Object.keys(DISPOSITIONS));
            if (proche) r.push({ apres: `diapo ${proche}`, libelle: `Mise en page « ${proche} »`, cause: `Mise en page inconnue. Mises en page : ${Object.keys(DISPOSITIONS).join(', ')}.` });
        } else if (m && d) {
            const cles = (d.champs || []).map(([c]) => c);
            const proche = plusProche(m[1], cles);
            if (proche && proche !== m[1]) r.push({ apres: `${proche}: ${m[2]}`, libelle: `Écrire « ${proche} »`, cause: `Champ inconnu pour cette mise en page. Champs admis : ${cles.join(', ')}.` });
        }
    }
    if (type === 'carte') {
        if (ctx.i === ctx.entete) {
            const proche = plusProche(t.split(/\s+/)[1] || '', Object.keys(ECHELLES));
            if (proche) r.push({ apres: `carte ${proche}`, libelle: `Échelle « ${proche} »`, cause: `Échelle inconnue. Échelles : ${Object.keys(ECHELLES).join(', ')}.` });
        } else if (m) {
            const cles = ['zone', 'epingle', 'pictogramme', 'annotation', ...Object.keys(OPTIONS)];
            const proche = plusProche(m[1].normalize('NFD').replace(/[̀-ͯ]/g, ''), cles);
            if (proche && proche !== m[1]) r.push({ apres: `${proche}: ${m[2]}`, libelle: `Écrire « ${proche} »`, cause: 'Option inconnue.' });
            if (/^[ée]pingle$/i.test(m[1]) && /^-?\d+(?:[.,]\d+)?\s*[,;]\s*-?\d/.test(m[2])) {
                const [pos, ...reste] = m[2].split('|');
                const [lat, lon] = pos.split(/\s*[;]\s*|,\s+|\s*,\s*(?=-?\d+[.,]?\d*\s*$)/).map(nombreFr);
                r.push({ apres: `epingle: ${lat} ${lon}${reste.length ? ` |${reste.join('|')}` : ''}`, libelle: 'Séparer latitude et longitude par une espace', cause: 'Une épingle commence par sa latitude et sa longitude séparées par une espace, avec des points décimaux.' });
            }
        }
        const donnee = t.match(/^-\s*([^|]+)\|\s*(-?[\d\s]+,\d+)\s*(\|.*)?$/);
        if (donnee) r.push({ apres: `- ${donnee[1].trim()} | ${nombreFr(donnee[2])}${donnee[3] ? ` ${donnee[3]}` : ''}`, libelle: 'Écrire la valeur avec un point décimal', cause: 'Les nombres s\'écrivent avec un point décimal.' });
    }
    return r;
}

// ---------- Diagnostic ----------

// erreur : l'objet levé par le rendu (message, et hash.loc pour les erreurs de Mermaid)
// Au-delà, une ligne n'est pas soumise aux règles de réparation : certaines expressions ont un coût qui croît vite avec
// la longueur, et le diagnostic s'exécute à chaque erreur de rendu (un fichier piégé figerait l'onglet)
const LIGNE_MAX = 300;

export function diagnostiquer(code, erreur) {
    const lignes = lignesDe(code);
    const type = typeDiagramme(code);
    const def = SYNTAXES[type];
    const message = String(erreur?.message ?? erreur ?? '');
    const entete = ligneEntete(lignes);
    const diag = { type, nomType: def?.nom || null, ligne: null, colonne: null, texte: '', objet: null, cause: '', propositions: [], message };
    const remplacer = (i, nouvelle) => lignes.map((l, k) => (k === i ? nouvelle : l)).join('\n');
    const inserer = (i, nouvelle) => [...lignes.slice(0, i), nouvelle, ...lignes.slice(i)].join('\n');
    const situer = (i) => { diag.ligne = i + 1; diag.texte = lignes[i] ?? ''; };

    // 1. Type du schéma inconnu ou mal écrit
    // (« sequence » est connu de FUSAIN mais pas de Mermaid, qui attend « sequenceDiagram » : son refus fait foi)
    if ((!def || /No diagram type detected|UnknownDiagram/i.test(message)) && entete >= 0) {
        situer(entete);
        const mot = lignes[entete].trim().split(/\s+/)[0];
        diag.objet = { id: 'entete', nom: 'Type de schéma (première ligne)', syntaxe: [...new Set(Object.values(SYNTAXES).map((s) => s.entete[0]))], exemple: 'flowchart TD', aide: 'La première ligne annonce le type du schéma.' };
        diag.cause = `« ${mot} » n'est pas un type de schéma connu.`;
        const motsTypes = [...new Set(Object.values(SYNTAXES).flatMap((s) => s.entete.map((e) => e.split(/\s+/)[0])))];
        // Mot tronqué (« sequence », « architecture ») ou mal orthographié
        const proche = (mot.length >= 3 && motsTypes.find((m) => m !== mot && m.toLowerCase().startsWith(mot.toLowerCase()))) || plusProche(mot, motsTypes.filter((m) => m !== mot));
        if (proche) diag.propositions.push({ libelle: `Écrire « ${proche} »`, avant: lignes[entete], apres: lignes[entete].replace(mot, proche), code: remplacer(entete, lignes[entete].replace(mot, proche)) });
        return diag;
    }
    if (!def) return diag;

    // 2. Position donnée par le rendu
    const loc = localiser(code, erreur);

    // 3. Structure : sens du logigramme, blocs ouverts ou fermés en trop
    if (entete >= 0 && ['flowchart', 'swimlane'].includes(type)) {
        const [mot, sens] = lignes[entete].trim().split(/\s+/);
        if (sens && !['TB', 'TD', 'BT', 'RL', 'LR'].includes(sens)) {
            situer(entete);
            diag.objet = { id: 'entete', nom: 'Sens du logigramme', syntaxe: SYNTAXES[type].entete, exemple: `${mot} TD`, aide: 'TD (haut → bas), LR (gauche → droite), BT, RL.' };
            diag.cause = `Sens « ${sens} » inconnu.`;
            const proche = plusProche(sens.toUpperCase(), ['TB', 'TD', 'BT', 'RL', 'LR']) || (/^(H|HAUT|TOP|VERT)/i.test(sens) ? 'TD' : 'LR');
            for (const s of [...new Set([proche, 'TD', 'LR'])]) diag.propositions.push({ libelle: `Sens ${s}`, avant: lignes[entete], apres: lignes[entete].replace(sens, s), code: remplacer(entete, lignes[entete].replace(sens, s)) });
            return diag;
        }
    }
    const desequilibre = blocs(lignes, def, entete);
    const derniereEcrite = lignes.reduce((d, l, k) => (l.trim() && !estCommentaire(l) ? k : d), -1) + 1;
    if (desequilibre && (!loc || loc.finDeCode || (desequilibre.genre === 'ouvert' && loc.ligne >= derniereEcrite) || (desequilibre.genre === 'enTrop' && desequilibre.i + 1 <= loc.ligne))) {
        const i = desequilibre.i;
        situer(i);
        const fermeture = def.blocs.fermeture;
        if (desequilibre.genre === 'enTrop') {
            diag.objet = objetDe(type, lignes[i]) || { id: 'fin', nom: 'Fin de bloc', syntaxe: [fermeture], exemple: fermeture, aide: '' };
            diag.cause = `« ${fermeture} » ferme un bloc qui n'a pas été ouvert.`;
            diag.propositions.push({ libelle: 'Supprimer cette ligne', avant: lignes[i], apres: '', code: lignes.filter((_, k) => k !== i).join('\n') });
        } else {
            diag.objet = objetDe(type, lignes[i]);
            diag.cause = `Ce bloc n'est jamais fermé : il manque une ligne « ${fermeture} ».`;
            const derniere = lignes.reduce((d, l, k) => (l.trim() ? k : d), i);
            const nouvelle = indentation(lignes[i]) + fermeture;
            diag.propositions.push({ libelle: `Ajouter « ${fermeture} » à la fin du code`, avant: '', apres: nouvelle, code: inserer(derniere + 1, nouvelle) });
            // Variante : fermer le bloc après sa dernière ligne plus décalée que lui
            let fin = i;
            for (let k = i + 1; k < lignes.length; k += 1) {
                if (!lignes[k].trim()) continue;
                if (indentation(lignes[k]).length > indentation(lignes[i]).length) fin = k; else break;
            }
            if (fin !== derniere && fin > i) diag.propositions.push({ libelle: `Ajouter « ${fermeture} » après la ligne ${fin + 1}`, avant: '', apres: nouvelle, code: inserer(fin + 1, nouvelle) });
        }
        return diag;
    }

    // 4. Ligne désignée, ou première ligne qui pose problème dans un Gantt (erreur de dates levée au dessin)
    let i = loc ? loc.ligne - 1 : -1;
    if (i < 0 && /premi[eè]re ligne|No diagram type/i.test(message)) i = entete;
    if (i < 0 && /only one root/i.test(message)) {
        const nom = message.match(/\("([^"]*)"\)/)?.[1] ?? message.match(/for \(([^)]*)\)/)?.[1];
        if (nom) i = lignes.findIndex((l, k) => k > entete && l.includes(nom));
        if (i >= 0) {
            situer(i);
            diag.objet = objetDe(type, lignes[i].trim());
            diag.cause = 'Une carte mentale n\'a qu\'une racine : cette idée doit être décalée sous une autre.';
            const precedente = lignes.slice(0, i).reverse().find((l) => l.trim() && !estCommentaire(l)) || '';
            const nouvelle = `${indentation(precedente).replace(/\t/g, '    ')}  ${lignes[i].trim()}`;
            diag.propositions.push({ libelle: 'Décaler l\'idée sous la précédente', avant: lignes[i], apres: nouvelle, code: remplacer(i, nouvelle) });
            return diag;
        }
    }
    if (i < 0 && type === 'gantt') {
        i = lignes.findIndex((l, k) => k > entete && l.length <= LIGNE_MAX && reglesGantt(l.trim(), { code }).length > 0);
    }
    if (i < 0) return diag;
    situer(i);
    diag.colonne = loc?.colonne || null;
    const brute = lignes[i];
    const t = brute.trim();
    diag.objet = i === entete ? { id: 'entete', nom: 'Type de schéma (première ligne)', syntaxe: def.entete, exemple: def.entete[0], aide: '' } : objetDe(type, t);

    // Règles d'une ligne : chaque réparation candidate porte le rang de la ligne qu'elle corrige
    const analyser = (k) => {
        const candidats = [];
        const proposer = (c) => { if (c) candidats.push({ ...c, k }); };
        if (lignes[k].length > LIGNE_MAX) return candidats;
        const retrait = indentation(lignes[k]);
        const t = lignes[k].trim();
        // Règles communes
        const droits = guillemetsDroits(t);
        if (droits !== t) proposer({ apres: droits, libelle: 'Remplacer les guillemets typographiques par des guillemets droits', cause: 'Les guillemets typographiques (« », “ ”) ne sont pas reconnus : le code attend des guillemets droits (").' });
        if (type !== 'diapo' && /[  ​﻿\t]/.test(t)) proposer({ apres: t.replace(/[​﻿]/g, '').replace(/[  \t]/g, ' '), libelle: 'Remplacer les espaces spéciales', cause: 'La ligne contient une espace insécable ou une tabulation.' });
        if (/\t/.test(retrait) && ['mindmap', 'ishikawa', 'treeView', 'kanban', 'treemap'].includes(type)) proposer({ code: remplacer(k, retrait.replace(/\t/g, '    ') + t), libelle: 'Remplacer les tabulations de début de ligne par des espaces', cause: 'L\'indentation donne la hiérarchie : elle s\'écrit avec des espaces, pas des tabulations.' });
        if (t.startsWith('//')) proposer({ apres: `%%${t.slice(2)}`, libelle: 'Écrire le commentaire avec %%', cause: 'Un commentaire commence par %% (et non //).' });
        const premierMot = t.match(/^[\p{L}][\p{L}\w-]*/u)?.[0];
        const motsCles = def.motsCles || [];
        if (premierMot && premierMot.length >= 3 && !motsCles.includes(premierMot)) {
            const proche = plusProche(premierMot, motsCles.filter((m) => m.length >= 4));
            if (proche && distance(premierMot, proche) > 0 && !PROPRES.has(type)) proposer({ apres: proche + t.slice(premierMot.length), libelle: `Écrire « ${proche} »`, cause: `Mot clé mal écrit : « ${proche} ».` });
        }
        // Règles du type
        const ctx = { code, lignes, i: k, entete, dansBloc: lignes.slice(entete + 1, k).reduce((n, l) => n + (/\{\s*$/.test(l) ? 1 : 0) - (/^\s*\}/.test(l) ? 1 : 0), 0) > 0 };
        const base = droits;
        if (['flowchart', 'swimlane', 'block'].includes(type)) reglesLogigramme(base, ctx).forEach(proposer);
        else if (type === 'sequence') reglesSequence(base).forEach(proposer);
        else if (type === 'stateDiagram') reglesEtats(base).forEach(proposer);
        else if (type === 'classDiagram') reglesClasses(base).forEach(proposer);
        else if (type === 'erDiagram') reglesEntites(base, ctx).forEach(proposer);
        else if (type === 'gantt') reglesGantt(base, ctx).forEach(proposer);
        else if (type === 'pie') reglesCamembert(base).forEach(proposer);
        else if (type === 'architecture') reglesArchitecture(base).forEach(proposer);
        else if (PROPRES.has(type)) reglesPropres(type, base, ctx).forEach(proposer);
        else reglesDivers(type, base).forEach(proposer);
        // Crochets et guillemets non appariés
        // Les cardinalités d'une relation entre entités (o{, }|) ne sont pas des accolades
        const eq = equilibre(type === 'erDiagram' ? base.replace(/\S*(--|\.\.)\S*/g, '') : base);
        if (eq.manquants.length) {
            const dernier = eq.manquants[eq.manquants.length - 1];
            const lien = base.slice(dernier.k).match(LIEN);
            const position = lien ? dernier.k + lien.index : base.length;
            const fermetures = eq.manquants.map((m) => m.f).reverse().join('');
            proposer({ apres: base.slice(0, position) + fermetures + base.slice(position), libelle: `Ajouter « ${fermetures} »`, cause: 'Un crochet, une parenthèse ou une accolade ouverte n\'est pas refermée.' });
        }
        if (eq.enTrop.length) {
            const p = eq.enTrop[eq.enTrop.length - 1];
            proposer({ apres: base.slice(0, p) + base.slice(p + 1), libelle: `Retirer « ${base[p]} » en trop`, cause: 'Un crochet, une parenthèse ou une accolade est fermée sans avoir été ouverte.' });
        }
        if (eq.guillemetsImpairs) {
            // Le guillemet manquant se place avant la fermeture qui suit le dernier guillemet ouvert
            const ouvert = base.lastIndexOf('"');
            const fermeture = base.slice(ouvert + 1).search(/[\])}]/);
            const position = fermeture >= 0 ? ouvert + 1 + fermeture : base.length;
            proposer({ apres: `${base.slice(0, position)}"${base.slice(position)}`, libelle: 'Fermer les guillemets', cause: 'Des guillemets ouverts ne sont pas refermés.' });
            // Libellé ouvert puis abandonné (A["Texte) : guillemet et fermetures ensemble
            if (eq.manquants.length && fermeture < 0) {
                const fermetures = eq.manquants.map((m) => m.f).reverse().join('');
                const lien = base.slice(ouvert + 1).match(LIEN);
                const fin = lien ? ouvert + 1 + lien.index : base.length;
                const debut = base.slice(0, fin).trimEnd();
                proposer({ apres: `${debut}"${fermetures}${base.slice(debut.length)}`, libelle: `Fermer les guillemets et ajouter « ${fermetures} »`, cause: 'Un libellé entre guillemets n\'est pas refermé.' });
            }
        }
        return candidats;
    };

    const candidats = analyser(i);
    // Ligne précédente : une faute en fin de ligne (lien sans cible, crochet ou guillemet non fermé) n'est souvent
    // signalée qu'à la ligne suivante. La dernière ligne écrite avant celle désignée est donc contrôlée aussi.
    let p = i - 1;
    while (p > entete && (!lignes[p].trim() || estCommentaire(lignes[p]))) p -= 1;
    const avant = p > entete && i !== entete ? analyser(p) : [];
    if (avant.length) {
        const c = avant.find((x) => x.cause);
        diag.precedente = { ligne: p + 1, texte: lignes[p], objet: objetDe(type, lignes[p].trim()), cause: c?.cause || '' };
        candidats.push(...avant.map((x) => ({ ...x, libelle: `Ligne ${p + 1} : ${x.libelle.charAt(0).toLowerCase()}${x.libelle.slice(1)}` })));
    }
    // Dernier recours : la ligne est mise de côté, le reste du schéma s'affiche
    if (i !== entete) {
        if (PROPRES.has(type)) candidats.push({ supprimer: true, libelle: 'Supprimer cette ligne', cause: '', k: i });
        else candidats.push({ apres: `%% ${t}`, libelle: 'Mettre la ligne en commentaire (elle ne sera plus dessinée)', cause: '', k: i });
    }

    // Mise en forme : ligne complète, code complet, sans doublon ni proposition identique au code
    const vus = new Set([code]);
    for (const c of candidats) {
        let nouveau;
        let apres = '';
        if (c.code) nouveau = c.code;
        else if (c.supprimer) nouveau = lignes.filter((_, k) => k !== c.k).join('\n');
        else { apres = indentation(lignes[c.k]) + c.apres; nouveau = remplacer(c.k, apres); }
        if (vus.has(nouveau)) continue;
        vus.add(nouveau);
        diag.propositions.push({ libelle: c.libelle, ligne: c.k + 1, avant: lignes[c.k], apres: c.code ? '' : apres, code: nouveau, cause: c.cause });
    }
    const propres = candidats.filter((c) => c.k === i && c.cause);
    if (!propres.length && diag.precedente?.cause) {
        // Rien à redire à la ligne désignée : la faute vient de la ligne d'avant
        diag.cause = `La ligne ${diag.precedente.ligne}, juste avant, est en cause : ${diag.precedente.cause.charAt(0).toLowerCase()}${diag.precedente.cause.slice(1)}`;
        return diag;
    }
    const retenu = candidats.find((c) => c.objet);
    if (retenu && candidats.indexOf(retenu) === 0) diag.objet = def.objets.find((o) => o.id === retenu.objet) || diag.objet;
    diag.cause = propres[0]?.cause || (diag.objet ? `Cette ligne ne respecte pas l'écriture attendue : ${diag.objet.nom.toLowerCase()}.` : 'Cette ligne n\'est pas reconnue.');
    return diag;
}
