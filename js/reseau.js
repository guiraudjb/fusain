// Import d'un réseau à partir d'exports tabulaires : liens de topologie (HPE IMC « Gestion des liens », API REST d'IMC,
// rapports de voisins LLDP ou CDP) et, en option, liste des équipements. Le résultat est une suite de logigrammes à
// icônes, écrits par l'éditeur du logigramme : ils restent modifiables visuellement. Tout est calculé dans le navigateur.
import { lignesCsv } from './diagrammes/carte.js';
import logigramme from './diagrammes/logigramme.js';
import { LIENS_MAX, TAILLE_MAX_CODE } from './securite.js';

export const TAILLE_MAX_FICHIER = 30 * 1024 * 1024;

// ---------- Lecture des fichiers : CSV, texte tabulé, classeur Excel (.xlsx), tableau HTML enregistré en .xls ----------

function decoder(octets) {
    if (octets[0] === 0xff && octets[1] === 0xfe) return new TextDecoder('utf-16le').decode(octets.subarray(2));
    if (octets[0] === 0xfe && octets[1] === 0xff) return new TextDecoder('utf-16be').decode(octets.subarray(2));
    try {
        return new TextDecoder('utf-8', { fatal: true }).decode(octets).replace(/^﻿/, '');
    } catch {
        // Exports Windows : encodage occidental
        return new TextDecoder('windows-1252').decode(octets);
    }
}

const ENTITES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const texteXml = (t) => String(t).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (tout, e) => {
    if (e[0] === '#') {
        const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1));
        return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : '';
    }
    return ENTITES[e.toLowerCase()] ?? tout;
});

// Archive ZIP (format des classeurs .xlsx) : répertoire central, puis décompression par le navigateur
async function lireZip(octets) {
    const vue = new DataView(octets.buffer, octets.byteOffset, octets.byteLength);
    let fin = -1;
    for (let i = octets.length - 22; i >= Math.max(0, octets.length - 65558); i -= 1) if (vue.getUint32(i, true) === 0x06054b50) { fin = i; break; }
    if (fin < 0) throw new Error('Le classeur est endommagé (archive illisible).');
    const nombre = vue.getUint16(fin + 10, true);
    let p = vue.getUint32(fin + 16, true);
    const entrees = new Map();
    for (let n = 0; n < nombre && p + 46 <= octets.length; n += 1) {
        if (vue.getUint32(p, true) !== 0x02014b50) break;
        const methode = vue.getUint16(p + 10, true);
        const taille = vue.getUint32(p + 20, true);
        const longNom = vue.getUint16(p + 28, true);
        const total = 46 + longNom + vue.getUint16(p + 30, true) + vue.getUint16(p + 32, true);
        const local = vue.getUint32(p + 42, true);
        const nom = new TextDecoder().decode(octets.subarray(p + 46, p + 46 + longNom));
        entrees.set(nom, { methode, taille, local });
        p += total;
    }
    return async (nom) => {
        const e = entrees.get(nom);
        if (!e) return null;
        const debut = e.local + 30 + vue.getUint16(e.local + 26, true) + vue.getUint16(e.local + 28, true);
        const donnees = octets.subarray(debut, debut + e.taille);
        if (e.methode === 0) return decoder(donnees);
        if (e.methode !== 8) throw new Error('Le classeur utilise une compression non prise en charge.');
        const flux = new Blob([donnees]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        const brut = new Uint8Array(await new Response(flux).arrayBuffer());
        if (brut.length > TAILLE_MAX_FICHIER * 4) throw new Error('Le classeur est trop volumineux.');
        return decoder(brut);
    };
}

const colonneExcel = (ref) => [...String(ref).replace(/\d+$/, '')].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;

async function lireXlsx(octets) {
    const lire = await lireZip(octets);
    const partages = [];
    const sst = await lire('xl/sharedStrings.xml');
    if (sst) for (const m of sst.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) partages.push(texteXml([...m[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join('')));
    // Première feuille du classeur, d'après ses relations
    let chemin = 'xl/worksheets/sheet1.xml';
    const classeur = await lire('xl/workbook.xml');
    const relations = await lire('xl/_rels/workbook.xml.rels');
    const premiere = classeur?.match(/<sheet\b[^>]*\br:id="([^"]+)"/);
    if (premiere && relations) {
        const cible = [...relations.matchAll(/<Relationship\b[^>]*>/g)].map((r) => r[0]).find((r) => r.includes(`Id="${premiere[1]}"`))?.match(/Target="([^"]+)"/)?.[1];
        if (cible) chemin = cible.startsWith('/') ? cible.slice(1) : `xl/${cible.replace(/^\.\//, '')}`;
    }
    const feuille = await lire(chemin);
    if (!feuille) throw new Error('Le classeur ne contient pas de feuille lisible.');
    const lignes = [];
    for (const r of feuille.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
        const ligne = [];
        for (const c of r[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
            const ref = c[1].match(/\br="([A-Z]+\d+)"/)?.[1];
            const type = c[1].match(/\bt="([^"]+)"/)?.[1];
            const v = c[2]?.match(/<v>([\s\S]*?)<\/v>/)?.[1];
            let valeur = '';
            if (type === 's') valeur = partages[Number(v)] ?? '';
            else if (type === 'inlineStr') valeur = texteXml([...(c[2] || '').matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join(''));
            else if (v !== undefined) valeur = texteXml(v);
            ligne[ref ? colonneExcel(ref) : ligne.length] = valeur;
        }
        const pleine = Array.from(ligne, (x) => x ?? '');
        if (pleine.some((x) => x.trim())) lignes.push(pleine);
    }
    return lignes;
}

// Beaucoup d'applications web exportent « en Excel » un simple tableau HTML : il est lu ici sans être interprété
function lireTableauHtml(texte) {
    const lignes = [];
    for (const tr of texte.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
        const ligne = [...tr[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) => texteXml(c[1].replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim());
        if (ligne.some(Boolean)) lignes.push(ligne);
    }
    return lignes;
}

// Contenu d'un fichier → enregistrements bruts (tableaux de champs)
export async function lireEnregistrements(octets) {
    if (octets.length > TAILLE_MAX_FICHIER) throw new Error('Le fichier dépasse 30 Mo.');
    if (octets[0] === 0x50 && octets[1] === 0x4b) return lireXlsx(octets);
    if (octets[0] === 0xd0 && octets[1] === 0xcf && octets[2] === 0x11 && octets[3] === 0xe0) {
        throw new Error('Ce fichier est au format Excel 97-2003 (.xls), que FUSAIN ne lit pas : ouvrez-le dans un tableur et enregistrez-le en .xlsx ou en CSV.');
    }
    const texte = decoder(octets);
    if (/^\s*</.test(texte) && /<table\b/i.test(texte)) return lireTableauHtml(texte);
    return lignesCsv(texte, separateurProbable(texte));
}

// Séparateur le plus fréquent sur une ligne parmi les dix premières (un export peut commencer par un titre sans séparateur)
function separateurProbable(texte) {
    let meilleur = null;
    let max = 0;
    for (const ligne of texte.split(/\r?\n/, 10)) {
        const hors = ligne.replace(/"[^"]*"/g, '');
        for (const sep of [';', '\t', ',', '|']) {
            const n = hors.split(sep).length - 1;
            if (n > max) { max = n; meilleur = sep; }
        }
    }
    return meilleur;
}

// ---------- Reconnaissance des colonnes ----------

export const normaliser = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

// Pour chaque champ, des motifs du plus sûr au moins sûr. Intitulés de l'interface d'IMC (anglais et français),
// champs de son API REST, colonnes usuelles des rapports de voisins LLDP / CDP.
const G = 'left|source|src|local|gauche|locale?';
const D = 'right|destination|dest|dst|remote|neighbou?r|voisin|distante?|droite?';
export const CHAMPS_LIENS = [
    ['source', 'Équipement (côté A)', [/^(leftnode|leftsymbolname|leftinterfacedevicelabel|leftdevicelabel|leftdevicename)$/, /^leftdevice$/, /^(sourcedevice|sourcenode|srcdevice|localdevice|localdevicelabel|localsystemname|localsysname|localhost|localnode)$/, /^(equipement|noeud|peripherique)(gauche|source|local)$/, /^(source|devicelabel|device)$/]],
    ['portSource', 'Interface (côté A)', [/^(leftinterface|leftifdesc|leftinterfacedescription|leftport|leftifname|leftinterfacename)$/, new RegExp(`^(${G})(interface|port|portid|ifname|ifdesc|interfacename)$`), /^(interface|port)(gauche|source|locale?)$/, /^(interface|port|localinterface)$/]],
    ['aliasSource', 'Alias de l\'interface (côté A)', [/^leftinterfacealias$/, new RegExp(`^(${G})(interface)?alias$`)]],
    ['vlanTypeSource', 'Type de port VLAN (côté A)', [/^leftinterfacevlantype$/, new RegExp(`^(${G})(interface)?(vlantype|porttype|linktype)$`)]],
    ['vlansSource', 'VLAN autorisés (côté A)', [/^leftinterfaceallowedvlans?$/, new RegExp(`^(${G})(interface)?(allowedvlans?|vlans?|pvid|vlanid)$`), /^vlans?(gauche|source)$/]],
    ['cible', 'Équipement (côté B)', [/^(rightnode|rightsymbolname|rightinterfacedevicelabel|rightdevicelabel|rightdevicename)$/, /^rightdevice$/, /^(destinationdevice|destinationnode|dstdevice|remotedevice|remotedevicename|remotesystemname|remotesysname|remotehost|remotehostname|neighbou?rdevice|neighbou?rname|neighbou?rsystemname|neighbou?rsysname|neighbou?rdevicename|neighbou?rdeviceid|deviceid)$/, /^(equipement|noeud|peripherique)(droit|destination|distant|voisin)$/, /^(nomvoisin|voisin|neighbou?r|systemname|sysname|destination|nomdusystemedistant|nomsystemedistant)$/]],
    ['portCible', 'Interface (côté B)', [/^(rightinterface|rightifdesc|rightinterfacedescription|rightport|rightifname|rightinterfacename)$/, new RegExp(`^(${D})(interface|port|portid|ifname|ifdesc|interfacename|portdescription|portdesc)$`), /^(interface|port)(droite?|destination|distante?|voisin)$/, /^(portid|portdescription|outgoingport|portidentifier)$/]],
    ['aliasCible', 'Alias de l\'interface (côté B)', [/^rightinterfacealias$/, new RegExp(`^(${D})(interface)?alias$`)]],
    ['vlanTypeCible', 'Type de port VLAN (côté B)', [/^rightinterfacevlantype$/, new RegExp(`^(${D})(interface)?(vlantype|porttype|linktype)$`)]],
    ['vlansCible', 'VLAN autorisés (côté B)', [/^rightinterfaceallowedvlans?$/, new RegExp(`^(${D})(interface)?(allowedvlans?|vlans?|pvid|vlanid)$`), /^vlans?(droite?|destination)$/]],
    ['chassis', 'Identifiant de châssis du voisin', [/^(remote|neighbou?r)?chassisid$/, /^chassis$/]],
    ['ipCible', 'Adresse IP du voisin', [/^(remote|neighbou?r)(management|mgmt)?(ip|ipaddress|address|addr)$/, /^(managementaddress|mgmtaddress|ipvoisin|adresseipvoisin)$/]],
    ['capacites', 'Capacités du voisin (LLDP)', [/^(remote|neighbou?r)?(system)?capabilit(y|ies)(enabled|supported)?$/, /^(syscapenabled|capacites|capacitesvoisin|platform|plateforme)$/]],
    ['debit', 'Débit', [/^(linkspeed|bandwidth|speed|linkrate|rate|ifspeed)(bps|kbps|mbps|gbps)?$/, /^(debit|vitesse|debitdulien)(bps|kbits|mbits|gbits)?$/]],
    ['typeLien', 'Type de lien', [/^(linktype|typedelien|typelien|discoveryprotocol|protocol|protocole)$/, /^type$/]],
    ['etat', 'État', [/^(status|linkstatus|state|operstatus|operationalstatus)$/, /^(etat|statut|etatdulien)$/]],
    ['nomLien', 'Nom du lien', [/^(linkname|label|nomdulien|libelle)$/]],
];
export const CHAMPS_EQUIPEMENTS = [
    ['nom', 'Nom de l\'équipement', [/^(devicelabel|label|devicename|nomdelequipement|libelle)$/, /^(sysname|systemname|hostname|name|nom|equipement|device)$/]],
    ['ip', 'Adresse IP', [/^(ipaddress|ip|managementip|mgmtip|adresseip|ipaddressmask|ipmask|adresseipmasque|deviceip)$/]],
    ['categorie', 'Catégorie', [/^(devicecategory|category|categorie|categoriedequipement|categoriedeperipherique)$/, /^(devicetype|typedequipement|type)$/]],
    ['modele', 'Modèle', [/^(model|devicemodel|modele|typename|series)$/]],
    ['lieu', 'Emplacement', [/^(location|syslocation|lieu|emplacement|localisation|site)$/]],
    ['groupe', 'Groupe ou vue', [/^(group|devicegroup|customview|view|groupe|vue|vuepersonnalisee)$/]],
    ['capacites', 'Capacités (LLDP)', [/^(system)?capabilit(y|ies)(enabled)?$|^capacites$/]],
];

// Associe à chaque champ la colonne qui lui correspond le mieux (premier motif reconnu, puis ordre des colonnes)
export function associer(colonnes, champs) {
    const normes = colonnes.map(normaliser);
    const prises = new Set();
    const association = {};
    for (const [cle, , motifs] of champs) {
        for (const motif of motifs) {
            const i = normes.findIndex((n, k) => !prises.has(k) && motif.test(n));
            if (i >= 0) { association[cle] = colonnes[i]; prises.add(i); break; }
        }
    }
    return association;
}

// En-tête : la première des dix premières lignes qui contient au moins deux intitulés reconnus (un export peut commencer
// par un titre ou une date), à défaut la première ligne
export function tableau(enregistrements, champs) {
    const score = (ligne) => Object.keys(associer(ligne.map(String), champs)).length;
    let rang = 0;
    for (let i = 0; i < Math.min(10, enregistrements.length); i += 1) if (score(enregistrements[i]) >= 2) { rang = i; break; }
    const vues = new Map();
    const colonnes = (enregistrements[rang] || []).map((e, i) => {
        let nom = String(e).replace(/\s+/g, ' ').trim() || `Colonne ${i + 1}`;
        const n = (vues.get(nom) || 0) + 1;
        vues.set(nom, n);
        if (n > 1) nom = `${nom} (${n})`;
        return nom;
    });
    const lignes = enregistrements.slice(rang + 1).map((l) => Object.fromEntries(colonnes.map((c, i) => [c, String(l[i] ?? '').trim()])));
    return { colonnes, lignes, association: associer(colonnes, champs) };
}

// ---------- Équipements : nom, catégorie, icône ----------

export const CATEGORIES_RESEAU = {
    routeur: { nom: 'Routeur', pluriel: 'routeurs', illus: 'routeur', picto: 'routeur', rang: 0 },
    'pare-feu': { nom: 'Pare-feu', pluriel: 'pare-feu', illus: 'pare-feu', picto: 'pare-feu', rang: 0 },
    'commutateur-l3': { nom: 'Commutateur de niveau 3', pluriel: 'commutateurs de niveau 3', illus: 'commutateur-niveau-3', picto: 'commutateur-niveau-3', rang: 1 },
    commutateur: { nom: 'Commutateur', pluriel: 'commutateurs', illus: 'commutateur-switch', picto: 'commutateur', rang: 2 },
    wifi: { nom: 'Borne Wi-Fi', pluriel: 'bornes Wi-Fi', illus: 'point-d-acces-wi-fi', picto: 'point-d-acces-wifi', rang: 3, terminal: true },
    serveur: { nom: 'Serveur', pluriel: 'serveurs', illus: 'serveur', picto: 'serveur', rang: 3 },
    stockage: { nom: 'Stockage', pluriel: 'stockages', illus: 'stockage-nas', picto: 'stockage-nas', rang: 3 },
    telephone: { nom: 'Téléphone IP', pluriel: 'téléphones IP', illus: 'telephone-ip', picto: 'telephone-ip', rang: 4, terminal: true },
    poste: { nom: 'Poste de travail', pluriel: 'postes de travail', illus: 'ordinateur-de-bureau', picto: 'poste-de-travail', rang: 4, terminal: true },
    imprimante: { nom: 'Imprimante', pluriel: 'imprimantes', illus: 'imprimante', picto: 'imprimante', rang: 4, terminal: true },
    camera: { nom: 'Caméra', pluriel: 'caméras', illus: 'camera-de-videosurveillance', picto: 'camera', rang: 4, terminal: true },
    inconnu: { nom: 'Équipement', pluriel: 'autres équipements', illus: 'objet-connecte-iot', picto: 'objet-connecte', rang: 4, terminal: true },
};

// Catégorie d'après un texte (catégorie IMC, capacités LLDP « Bridge, Router », type, modèle). Rend null si rien n'est reconnu.
export function categorieDe(...textes) {
    const t = textes.filter(Boolean).map((x) => ` ${String(x).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()} `).join(' ');
    if (!t.trim()) return null;
    const a = (re) => re.test(t);
    const routeur = a(/router|routeur|\brouting\b|\bgateway\b|[\s,(]r[\s,)]/);
    const pont = a(/switch|commutateur|bridge|\bpont\b|[\s,(]b[\s,)]/);
    if (a(/firewall|pare-?feu|\bsecurity\b|securite|\butm\b|\bfw\b/)) return 'pare-feu';
    // Un téléphone ou une borne annoncent aussi « Bridge » en LLDP : ils passent avant les commutateurs
    if (a(/voice|phone|telephon|voip|[\s,(]t[\s,)]/) && !routeur) return 'telephone';
    if (a(/wireless|wlan|access ?point|\bap\b|borne|wi-?fi|sans fil|[\s,(]w[\s,)]/) && !routeur) return 'wifi';
    if (routeur && pont) return 'commutateur-l3';
    if (a(/layer ?3 switch|l3 ?switch|commutateur (de )?niveau 3|core switch/)) return 'commutateur-l3';
    if (routeur) return 'routeur';
    if (pont) return 'commutateur';
    if (a(/printer|imprimante/)) return 'imprimante';
    if (a(/camera|video|surveillance/)) return 'camera';
    if (a(/storage|stockage|\bnas\b|\bsan\b/)) return 'stockage';
    if (a(/server|serveur/)) return 'serveur';
    if (a(/desktop|workstation|station|\bpc\b|poste|ordinateur|laptop|[\s,(]s[\s,)]/)) return 'poste';
    return null;
}

// Catégorie devinée d'après le nom, en dernier recours
function categorieDuNom(nom) {
    const n = String(nom).toLowerCase();
    if (/^(fw|pf|firewall|parefeu)[-_.\d]/.test(n) || /[-_.](fw|pf)[-_.\d]/.test(n)) return 'pare-feu';
    if (/^(rt|rtr|router|routeur|gw)[-_.\d]/.test(n) || /[-_.](rt|rtr|gw)[-_.\d]/.test(n)) return 'routeur';
    if (/^(core|coeur|csw|cs)[-_.\d]/.test(n) || /[-_.](core|coeur|csw)[-_.\d]/.test(n)) return 'commutateur-l3';
    if (/^(sw|swi|asw|dsw|switch)[-_.\d]/.test(n) || /[-_.](sw|swi|asw|dsw)[-_.\d]/.test(n)) return 'commutateur';
    if (/^(ap|wap|borne)[-_.\d]/.test(n) || /[-_.](ap|wap)[-_.\d]/.test(n)) return 'wifi';
    if (/^(sep|ipphone|tel|phone)[-_.\d]/.test(n)) return 'telephone';
    if (/^(srv|svr|server|serveur)[-_.\d]/.test(n) || /[-_.](srv|svr)[-_.\d]/.test(n)) return 'serveur';
    if (/^(prn|imp|printer)[-_.\d]/.test(n)) return 'imprimante';
    return null;
}

// « SW-01(10.0.0.1) », « SW-01 (10.0.0.1/24) » : nom et adresse séparés
export function nomEtIp(brut) {
    const t = String(brut ?? '').replace(/\s+/g, ' ').trim();
    const m = t.match(/^(.*?)\s*[([]\s*(\d{1,3}(?:\.\d{1,3}){3})(?:\/\d+)?\s*[)\]]$/);
    if (m && m[1]) return { nom: m[1].trim(), ip: m[2] };
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(t)) return { nom: t, ip: t };
    return { nom: t, ip: '' };
}
const cleNom = (nom) => String(nom).trim().toLowerCase();

// ---------- Interfaces, débits, VLAN ----------

const ABREVIATIONS = [
    [/^Ten-?GigabitEthernet\s*/i, 'XGE'], [/^TwentyFiveGigE\s*/i, 'WGE'], [/^Twenty-?FiveGigabitEthernet\s*/i, 'WGE'],
    [/^FortyGigE\s*/i, 'FGE'], [/^HundredGigE\s*/i, 'HGE'], [/^GigabitEthernet\s*/i, 'GE'], [/^FastEthernet\s*/i, 'FE'],
    [/^Bridge-Aggregation\s*/i, 'BAGG'], [/^Route-Aggregation\s*/i, 'RAGG'], [/^Port-?channel\s*/i, 'Po'],
    [/^Vlan-?interface\s*/i, 'Vlan'], [/^Ethernet\s*/i, 'Eth'], [/^M-GigabitEthernet\s*/i, 'MGE'],
];
export function abregerInterface(nom) {
    let t = String(nom ?? '').replace(/\s+Interface$/i, '').trim();
    for (const [re, court] of ABREVIATIONS) if (re.test(t)) return t.replace(re, court);
    return t;
}
const estAgregat = (port) => /^(bagg|ragg|bridge-aggregation|route-aggregation|port-?channel|po\d|trk\d|lag\s?\d|ae\d|bond)/i.test(String(port).trim());

export function debitLisible(brut) {
    const t = String(brut ?? '').trim().replace(',', '.');
    if (!t) return '';
    const m = t.match(/^(\d+(?:\.\d+)?)\s*([kmgt])?(?:b(?:it)?(?:ps|\/s)?|bps)?$/i);
    if (!m) return t.length <= 12 ? t : '';
    let bps = Number(m[1]) * ({ k: 1e3, m: 1e6, g: 1e9, t: 1e12 }[(m[2] || '').toLowerCase()] || 1);
    // Une valeur nue de quelques milliers est un débit en Mbit/s (affichage courant des commutateurs)
    if (!m[2] && bps > 0 && bps < 1e5) bps *= 1e6;
    if (bps >= 1e9) return `${Math.round(bps / 1e8) / 10}G`.replace('.0G', 'G');
    if (bps >= 1e6) return `${Math.round(bps / 1e6)}M`;
    return '';
}

// « 1,10,20-25 », « 1 to 4094 », « 10 20 30 » → ensemble de numéros (plafonné)
export function lireVlans(brut) {
    const vlans = new Set();
    const t = String(brut ?? '').replace(/\bto\b|\bà\b/gi, '-').replace(/\s*-\s*/g, '-');
    for (const morceau of t.split(/[\s,;]+/)) {
        const m = morceau.match(/^(\d{1,4})(?:-(\d{1,4}))?$/);
        if (!m) continue;
        const a = Number(m[1]);
        const b = Math.min(Number(m[2] ?? m[1]), 4094);
        for (let v = a; v <= b && vlans.size < 5000; v += 1) if (v >= 1) vlans.add(v);
    }
    return vlans;
}
export function ecrireVlans(vlans) {
    const liste = [...vlans].sort((a, b) => a - b);
    if (liste.length >= 4000) return 'tous';
    const plages = [];
    for (const v of liste) {
        const der = plages[plages.length - 1];
        if (der && v === der[1] + 1) der[1] = v; else plages.push([v, v]);
    }
    const texte = plages.map(([a, b]) => (a === b ? `${a}` : b === a + 1 ? `${a}, ${b}` : `${a}-${b}`)).join(', ');
    return texte.length > 60 ? `${texte.slice(0, 57).replace(/,[^,]*$/, '')}…` : texte;
}

// ---------- Analyse : du tableau des liens au graphe ----------

const EST_EN_PANNE = /\b(down|inactive?|inactif|unreachable|injoignable|disconnected|abnormal|hs|panne)\b/i;

// Construit le graphe : équipements (avec catégorie, IP, lieu, groupe) et liaisons fusionnées
export function analyserReseau(liens, equipements = null, { equipementLocal = '' } = {}) {
    const a = liens.association;
    const infos = new Map(); // clé → { nom, ip, categorie, lieu, groupe, modele }
    const noter = (brut, extra = {}) => {
        const { nom, ip } = nomEtIp(brut);
        if (!nom) return null;
        const cle = cleNom(nom);
        const x = infos.get(cle) || { cle, nom, ip: '', categorie: null, lieu: '', groupe: '', modele: '', indices: [] };
        if (ip && !x.ip) x.ip = ip;
        for (const [k, v] of Object.entries(extra)) if (v && !x[k]) x[k] = v;
        infos.set(cle, x);
        return x;
    };
    // Liste des équipements : nom, IP, catégorie, lieu
    if (equipements) {
        const e = equipements.association;
        for (const l of equipements.lignes) {
            const x = noter(l[e.nom] || l[e.ip]);
            if (!x) continue;
            const ip = nomEtIp(l[e.ip]).ip || String(l[e.ip] || '').match(/\d{1,3}(\.\d{1,3}){3}/)?.[0] || '';
            if (ip && !x.ip) x.ip = ip;
            x.categorie ||= categorieDe(l[e.categorie], l[e.capacites]) || categorieDe(l[e.modele]);
            x.lieu ||= l[e.lieu] || '';
            x.groupe ||= l[e.groupe] || '';
            x.modele ||= l[e.modele] || '';
        }
    }
    const bilan = { lignes: liens.lignes.length, ignorees: 0, doublons: 0 };
    const liaisons = new Map(); // paire d'équipements → liaison
    const vus = new Set();
    for (const l of liens.lignes) {
        const sourceBrute = l[a.source] || equipementLocal;
        const cibleBrute = l[a.cible] || l[a.chassis] || l[a.ipCible];
        const s = noter(sourceBrute);
        const c = noter(cibleBrute, { ip: nomEtIp(l[a.ipCible]).ip });
        if (!s || !c || s === c) { bilan.ignorees += 1; continue; }
        if (!c.categorie) c.categorie = categorieDe(l[a.capacites]);
        let ps = String(l[a.portSource] || l[a.aliasSource] || '').trim();
        let pc = String(l[a.portCible] || l[a.aliasCible] || '').trim();
        // Une même liaison vue des deux côtés n'est comptée qu'une fois
        const bout1 = `${s.cle}|${abregerInterface(ps).toLowerCase()}`;
        const bout2 = `${c.cle}|${abregerInterface(pc).toLowerCase()}`;
        const cleLien = [bout1, bout2].sort().join('~');
        if (vus.has(cleLien)) { bilan.doublons += 1; continue; }
        vus.add(cleLien);
        const [x, y] = s.cle < c.cle ? [s, c] : [c, s];
        if (x !== s) [ps, pc] = [pc, ps];
        const cote = (cible) => {
            const k = (champ) => a[`${champ}${cible ? 'Cible' : 'Source'}`];
            return { type: String(l[k('vlanType')] || '').toLowerCase(), vlans: lireVlans(l[k('vlans')]) };
        };
        const [vx, vy] = [cote(false), cote(true)];
        const paire = `${x.cle}~${y.cle}`;
        const liaison = liaisons.get(paire) || { a: x.cle, b: y.cle, membres: [], panne: false, vlanTypes: new Set(), vlans: new Set() };
        const agregat = estAgregat(ps) || estAgregat(pc);
        liaison.membres.push({ pa: ps, pb: pc, agregat, debit: debitLisible(l[a.debit]) });
        if (EST_EN_PANNE.test(String(l[a.etat] || ''))) liaison.panne = true;
        for (const v of [vx, vy]) {
            if (v.type) liaison.vlanTypes.add(v.type.includes('trunk') ? 'trunk' : v.type.includes('hybrid') ? 'hybrid' : v.type.includes('access') ? 'access' : v.type);
            for (const n of v.vlans) liaison.vlans.add(n);
        }
        liaisons.set(paire, liaison);
    }
    // Degré et catégorie finale de chaque équipement
    const degre = new Map();
    for (const li of liaisons.values()) for (const k of [li.a, li.b]) degre.set(k, (degre.get(k) || 0) + 1);
    const noeuds = [...infos.values()].filter((x) => degre.has(x.cle));
    for (const x of noeuds) {
        x.degre = degre.get(x.cle);
        const parNom = categorieDuNom(x.nom);
        if (x.categorie === 'commutateur' && parNom === 'commutateur-l3') x.categorie = parNom;
        x.categorie ||= parNom || (x.degre >= 2 ? 'commutateur' : 'inconnu');
    }
    const avecVlans = [...liaisons.values()].some((li) => li.vlans.size || li.vlanTypes.size);
    return { noeuds, liaisons: [...liaisons.values()], bilan, avecVlans };
}

// ---------- Regroupement ----------

// Préfixe de site d'un nom : « PAR-SW-01 » → PAR, « SW-SIEGE-1 » → SIEGE. Les mots de rôle (sw, core, rt, ap…) sont sautés.
const ROLES = new Set(['sw', 'swi', 'switch', 'asw', 'dsw', 'csw', 'cs', 'core', 'coeur', 'acc', 'access', 'dist', 'agg', 'rt', 'rtr', 'router', 'routeur', 'gw',
    'fw', 'pf', 'firewall', 'ap', 'wap', 'borne', 'srv', 'svr', 'server', 'serveur', 'sep', 'tel', 'phone', 'prn', 'imp', 'printer', 'stack', 'l', 'lan', 'wan']);
const prefixeDe = (nom) => {
    for (const morceau of String(nom).split(/[-_.\s]+/).slice(0, 2)) {
        const lettres = morceau.match(/^[A-Za-z]+/)?.[0] || '';
        if (lettres.length >= 2 && !ROLES.has(lettres.toLowerCase())) return lettres.toUpperCase();
    }
    return '';
};
const sousReseau = (ip) => (ip ? `${ip.split('.').slice(0, 3).join('.')}.0/24` : '');

export function groupeDe(x, mode) {
    if (mode === 'lieu') return x.lieu || x.groupe || '';
    if (mode === 'prefixe') return prefixeDe(x.nom);
    if (mode === 'reseau') return sousReseau(x.ip);
    return '';
}

// Mode « automatique » : l'emplacement s'il est connu pour la plupart des équipements, sinon le préfixe des noms
// s'il découpe le réseau en quelques sites, sinon rien
export function modeAutomatique(noeuds) {
    const infra = noeuds.filter((x) => !CATEGORIES_RESEAU[x.categorie].terminal);
    if (!infra.length) return 'aucun';
    if (infra.filter((x) => x.lieu || x.groupe).length >= infra.length * 0.6) return 'lieu';
    const prefixes = new Set(infra.map((x) => prefixeDe(x.nom)).filter(Boolean));
    if (prefixes.size >= 2 && prefixes.size <= Math.max(2, infra.length / 2) && infra.filter((x) => prefixeDe(x.nom)).length >= infra.length * 0.8) return 'prefixe';
    return 'aucun';
}

// ---------- Production des pages ----------

const SEUIL_VUE_ENSEMBLE = 25; // au-delà de ce nombre d'équipements d'infrastructure, une page par groupe
const GROUPES_MAX = 40;

function idsUniques() {
    const pris = new Set(['end', 'subgraph', 'direction', 'style', 'click', 'graph', 'flowchart', 'class', 'classDef', 'linkStyle']);
    return (base) => {
        let id = `e_${String(base).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'x'}`;
        let n = 2;
        const racine = id;
        while (pris.has(id)) { id = `${racine}_${n}`; n += 1; }
        pris.add(id);
        return id;
    };
}

function libelleLiaison(li, { abreger, logique, inverse }) {
    const p = (x) => (abreger ? abregerInterface(x) : String(x).trim());
    const ports = (m) => (inverse ? [m.pb, m.pa] : [m.pa, m.pb]);
    if (logique) {
        const types = [...li.vlanTypes].filter(Boolean);
        const vl = li.vlans.size ? ecrireVlans(li.vlans) : '';
        if (types.includes('trunk') || types.includes('hybrid')) return `${types.includes('trunk') ? 'trunk' : 'hybrid'}${vl ? ` : VLAN ${vl}` : ''}`;
        if (types.includes('access') || vl) return `access${vl ? ` VLAN ${vl}` : ''}`;
        return '';
    }
    const agregats = li.membres.filter((m) => m.agregat);
    const physiques = li.membres.filter((m) => !m.agregat);
    const parties = [];
    const base = agregats[0] || (physiques.length === 1 ? physiques[0] : null);
    if (base && (base.pa || base.pb)) parties.push(ports(base).map(p).filter(Boolean).join(' – '));
    const n = physiques.length;
    const debits = [...new Set(physiques.map((m) => m.debit).filter(Boolean))];
    if (n > 1) parties.push(`${n} liens${debits.length === 1 ? ` × ${debits[0]}` : ''}`);
    else if ((physiques[0] || agregats[0])?.debit) parties.push((physiques[0] || agregats[0]).debit);
    return parties.join(' · ');
}

// Une page : nœuds (équipements et résumés), groupes, liaisons, puis écriture par l'éditeur du logigramme
function construirePage({ noeuds, liaisons, groupeDeNoeud, titresGroupes, jeu, resumer, abreger, logique, nouvelId, exterieurs = new Set() }) {
    const modele = { preambule: [], couloirs: false, sens: 'TD', noeuds: [], liens: [], groupes: [], styles: {}, brut: [] };
    const idDe = new Map();
    const parCle = new Map(noeuds.map((x) => [x.cle, x]));
    // Terminaux résumés : rattachés à leur unique voisin d'infrastructure, comptés par catégorie
    const resumes = new Map();
    const voisinUnique = new Map();
    for (const li of liaisons) for (const [x, y] of [[li.a, li.b], [li.b, li.a]]) voisinUnique.set(x, voisinUnique.has(x) ? null : y);
    const masques = new Set();
    if (resumer) {
        for (const x of noeuds) {
            const cat = CATEGORIES_RESEAU[x.categorie];
            const v = voisinUnique.get(x.cle);
            if (!cat.terminal || !v || !parCle.has(v) || CATEGORIES_RESEAU[parCle.get(v).categorie].terminal) continue;
            const cle = `${v}|${x.categorie}`;
            const r = resumes.get(cle) || { voisin: v, categorie: x.categorie, membres: [] };
            r.membres.push(x);
            resumes.set(cle, r);
        }
        for (const r of resumes.values()) if (r.membres.length >= 2) for (const x of r.membres) masques.add(x.cle);
    }
    if (logique) for (const x of noeuds) if (CATEGORIES_RESEAU[x.categorie].terminal) masques.add(x.cle);
    // Groupes
    const idGroupe = new Map();
    const groupeModele = (titre) => {
        if (!titre) return null;
        if (!idGroupe.has(titre)) { const id = nouvelId(`g_${titre}`); idGroupe.set(titre, id); modele.groupes.push({ id, titre, parent: null, sens: null }); }
        return idGroupe.get(titre);
    };
    for (const x of noeuds) {
        if (masques.has(x.cle)) continue;
        const cat = CATEGORIES_RESEAU[x.categorie];
        const id = nouvelId(x.nom);
        idDe.set(x.cle, id);
        const titre = exterieurs.has(x.cle) ? 'Autres sites' : titresGroupes ? groupeDeNoeud(x) : '';
        modele.noeuds.push({ id, texte: x.nom, forme: 'rectangle', groupe: groupeModele(titre), classe: null, icone: `${jeu}:${cat[jeu]}` });
    }
    for (const li of liaisons) {
        if (!idDe.has(li.a) || !idDe.has(li.b)) continue;
        const [x, y] = [parCle.get(li.a), parCle.get(li.b)];
        // Le plus central en haut : l'ordre du lien guide le placement en couches
        const [de, vers] = CATEGORIES_RESEAU[x.categorie].rang + (x.degre > y.degre ? -0.5 : 0) <= CATEGORIES_RESEAU[y.categorie].rang + (y.degre > x.degre ? -0.5 : 0) ? [li.a, li.b] : [li.b, li.a];
        modele.liens.push({ de: idDe.get(de), vers: idDe.get(vers), debut: '', fin: '', texte: libelleLiaison(li, { abreger, logique, inverse: de !== li.a }), trait: li.panne ? 'pointille' : li.membres.length > 1 ? 'epais' : 'plein', longueur: 1 });
    }
    if (resumer && !logique) {
        for (const r of resumes.values()) {
            if (r.membres.length < 2 || !idDe.has(r.voisin)) continue;
            const cat = CATEGORIES_RESEAU[r.categorie];
            const id = nouvelId(`${r.voisin}_${r.categorie}`);
            const voisin = parCle.get(r.voisin);
            modele.noeuds.push({ id, texte: `${r.membres.length} ${cat.pluriel}`, forme: 'rectangle', groupe: modele.noeuds.find((n) => n.id === idDe.get(r.voisin))?.groupe ?? null, classe: null, icone: `${jeu}:${cat[jeu]}` });
            modele.liens.push({ de: idDe.get(voisin.cle), vers: id, debut: '', fin: '', texte: '', trait: 'plein', longueur: 1 });
        }
    }
    return modele;
}

function ecrirePage(modele, alertes, nom) {
    if (modele.liens.length > LIENS_MAX) {
        alertes.push(`${nom} : ${modele.liens.length} liaisons, au-delà des ${LIENS_MAX} que Mermaid dessine ; seules les ${LIENS_MAX} premières sont gardées.`);
        modele.liens = modele.liens.slice(0, LIENS_MAX);
    }
    let code = logigramme.ecrire(modele);
    if (code.length > TAILLE_MAX_CODE) {
        alertes.push(`${nom} : schéma trop volumineux ; les textes des liaisons sont retirés.`);
        for (const l of modele.liens) l.texte = '';
        code = logigramme.ecrire(modele);
    }
    return code;
}

// Options : jeu ('illus' | 'picto'), regroupement ('auto' | 'lieu' | 'prefixe' | 'reseau' | 'aucun'), resumer, abreger, logique
export function produirePages(graphe, options = {}) {
    const { jeu = 'illus', regroupement = 'auto', resumer = true, abreger = true, logique = graphe.avecVlans } = options;
    const mode = regroupement === 'auto' ? modeAutomatique(graphe.noeuds) : regroupement;
    const alertes = [];
    const pages = [];
    const groupeDeNoeud = (x) => groupeDe(x, mode) || (mode === 'aucun' ? '' : 'Sans groupe');
    // Un terminal suit le groupe de son commutateur
    const parCle = new Map(graphe.noeuds.map((x) => [x.cle, x]));
    const voisins = new Map();
    for (const li of graphe.liaisons) for (const [x, y] of [[li.a, li.b], [li.b, li.a]]) (voisins.get(x) || voisins.set(x, []).get(x)).push(y);
    const groupeFinal = new Map();
    for (const x of graphe.noeuds) {
        let g = groupeDeNoeud(x);
        if (CATEGORIES_RESEAU[x.categorie].terminal && (voisins.get(x.cle) || []).length === 1) {
            const v = parCle.get(voisins.get(x.cle)[0]);
            if (v && !CATEGORIES_RESEAU[v.categorie].terminal) g = groupeDeNoeud(v);
        }
        groupeFinal.set(x.cle, g);
    }
    let titres = [...new Set(groupeFinal.values())].filter(Boolean);
    if (titres.length > GROUPES_MAX) {
        alertes.push(`${titres.length} groupes : seuls les ${GROUPES_MAX - 1} plus grands ont leur page, les autres sont réunis dans « Autres ».`);
        const tailles = new Map(titres.map((t) => [t, 0]));
        for (const g of groupeFinal.values()) if (g) tailles.set(g, tailles.get(g) + 1);
        const gardes = new Set([...tailles.entries()].sort((p, q) => q[1] - p[1]).slice(0, GROUPES_MAX - 1).map(([t]) => t));
        for (const [k, g] of groupeFinal) if (g && !gardes.has(g)) groupeFinal.set(k, 'Autres');
        titres = [...new Set(groupeFinal.values())].filter(Boolean);
    }
    const gDe = (x) => groupeFinal.get(x.cle) || '';
    const infra = graphe.noeuds.filter((x) => !CATEGORIES_RESEAU[x.categorie].terminal);
    const commun = { jeu, resumer, abreger };
    const variantes = logique ? [false, true] : [false];

    if (titres.length < 2 || infra.length <= SEUIL_VUE_ENSEMBLE) {
        // Une seule page (par variante), les groupes en cadres
        for (const lo of variantes) {
            const modele = construirePage({ noeuds: graphe.noeuds, liaisons: graphe.liaisons, groupeDeNoeud: gDe, titresGroupes: titres.length >= 2, logique: lo, nouvelId: idsUniques(), ...commun });
            const nom = lo ? 'Réseau logique (VLAN)' : 'Réseau physique';
            pages.push({ nom, code: ecrirePage(modele, alertes, nom), equipements: modele.noeuds.length });
        }
    } else {
        // Vue d'ensemble : un nœud par groupe, liaisons entre groupes comptées
        const nouvelId = idsUniques();
        const vue = { preambule: [], couloirs: false, sens: 'TD', noeuds: [], liens: [], groupes: [], styles: {}, brut: [] };
        const idGroupe = new Map();
        const tailles = new Map();
        for (const x of infra) tailles.set(gDe(x), (tailles.get(gDe(x)) || 0) + 1);
        for (const t of titres) {
            const id = nouvelId(t);
            idGroupe.set(t, id);
            vue.noeuds.push({ id, texte: `${t} (${tailles.get(t) || 0} équipements)`, forme: 'rectangle', groupe: null, classe: null, icone: jeu === 'picto' ? 'picto:batiment' : 'illus:centre-de-donnees' });
        }
        const entre = new Map();
        for (const li of graphe.liaisons) {
            const [ga, gb] = [gDe(parCle.get(li.a)), gDe(parCle.get(li.b))];
            if (!ga || !gb || ga === gb) continue;
            const k = [ga, gb].sort().join('~');
            entre.set(k, (entre.get(k) || 0) + li.membres.length);
        }
        for (const [k, n] of entre) {
            const [ga, gb] = k.split('~');
            vue.liens.push({ de: idGroupe.get(ga), vers: idGroupe.get(gb), debut: '', fin: '', texte: `${n} lien${n > 1 ? 's' : ''}`, trait: 'plein', longueur: 1 });
        }
        pages.push({ nom: 'Réseau : vue d\'ensemble', code: ecrirePage(vue, alertes, 'Vue d\'ensemble'), equipements: vue.noeuds.length });
        // Une page par groupe : ses équipements et, dans un cadre « Autres sites », leurs voisins extérieurs
        for (const lo of variantes) {
            for (const t of titres) {
                const dedans = new Set(graphe.noeuds.filter((x) => gDe(x) === t).map((x) => x.cle));
                const liaisons = graphe.liaisons.filter((li) => dedans.has(li.a) || dedans.has(li.b));
                const exterieurs = new Set(liaisons.flatMap((li) => [li.a, li.b]).filter((k) => !dedans.has(k)));
                const noeuds = graphe.noeuds.filter((x) => dedans.has(x.cle) || exterieurs.has(x.cle));
                const modele = construirePage({ noeuds, liaisons, groupeDeNoeud: () => '', titresGroupes: false, logique: lo, nouvelId: idsUniques(), exterieurs, ...commun });
                const nom = `${lo ? 'Logique' : 'Réseau'} : ${t}`;
                pages.push({ nom, code: ecrirePage(modele, alertes, nom), equipements: modele.noeuds.length });
            }
        }
    }
    return { pages, alertes, mode };
}
