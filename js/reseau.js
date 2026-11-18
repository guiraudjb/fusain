// Import d'un réseau à partir d'exports tabulaires : liens de topologie (HPE IMC « Gestion des liens », API REST d'IMC,
// rapports de voisins LLDP ou CDP) et, en option, liste des équipements. Le résultat est une suite de logigrammes à
// icônes, écrits par l'éditeur du logigramme : ils restent modifiables visuellement. Tout est calculé dans le navigateur.
import { lignesCsv } from './diagrammes/carte.js';
import logigramme from './diagrammes/logigramme.js';
import { LIENS_MAX, TAILLE_MAX_CODE } from './securite.js';
import { lireZip } from './zip.js';

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

const colonneExcel = (ref) => [...String(ref).replace(/\d+$/, '')].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;

async function lireXlsx(octets) {
    const lireOctets = await lireZip(octets, { tailleMax: TAILLE_MAX_FICHIER * 4 });
    const lire = async (nom) => { const o = await lireOctets(nom); return o && decoder(o); };
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
    // Site et local technique de chaque extrémité : colonnes facultatives ajoutées au fichier des liens
    ['siteSource', 'Site (côté A)', [new RegExp(`^(${G})(site|groupeprincipal|batiment|building|campus)$`), /^(site|batiment)(left|source|gauche|a|cotea)$/]],
    ['localSource', 'Local technique (côté A)', [new RegExp(`^(${G})(localtechnique|lt|local|sousgroupe|subgroup|etage|floor|salle|room|baie)$`), /^(localtechnique|lt|sousgroupe|etage|salle)(left|source|gauche|a|cotea)$/]],
    ['siteCible', 'Site (côté B)', [new RegExp(`^(${D})(site|groupeprincipal|batiment|building|campus)$`), /^(site|batiment)(right|destination|droite?|distante?|voisin|b|coteb)$/]],
    ['localCible', 'Local technique (côté B)', [new RegExp(`^(${D})(localtechnique|lt|local|sousgroupe|subgroup|etage|floor|salle|room|baie)$`), /^(localtechnique|lt|sousgroupe|etage|salle)(right|destination|droite?|distante?|voisin|b|coteb)$/]],
];
export const CHAMPS_EQUIPEMENTS = [
    ['nom', 'Nom de l\'équipement', [/^(devicelabel|label|devicename|nomdelequipement|libelle)$/, /^(sysname|systemname|hostname|name|nom|equipement|device)$/]],
    ['ip', 'Adresse IP', [/^(ipaddress|ip|managementip|mgmtip|adresseip|ipaddressmask|ipmask|adresseipmasque|deviceip)$/]],
    ['categorie', 'Catégorie', [/^(devicecategory|category|categorie|categoriedequipement|categoriedeperipherique)$/, /^(devicetype|typedequipement|type)$/]],
    ['modele', 'Modèle', [/^(model|devicemodel|modele|typename|series)$/]],
    // Site et local technique : colonnes facultatives ajoutées au fichier, pour un regroupement à deux niveaux
    ['site', 'Groupe principal (site)', [/^(site|groupeprincipal|batiment|building|campus)$/]],
    ['local', 'Sous-groupe (local technique)', [/^(localtechnique|lt|local|sousgroupe|subgroup|etage|floor|salle|room|baie|wiringcloset|closet|idf)$/]],
    ['lieu', 'Emplacement', [/^(location|syslocation|lieu|emplacement|localisation)$/]],
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
    // Accents retirés et « œ » écrit « oe » : « CŒUR-DC-01 » se lit « coeur-dc-01 »
    const n = String(nom).toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (/^(fw|pf|firewall|parefeu)[-_.\d]/.test(n) || /[-_.](fw|pf)[-_.\d]/.test(n)) return 'pare-feu';
    if (/^(rt|rtr|router|routeur|gw)[-_.\d]/.test(n) || /[-_.](rt|rtr|gw)[-_.\d]/.test(n)) return 'routeur';
    if (/^(core|coeur|csw|cs)[-_.\d]/.test(n) || /[-_.](core|coeur|csw)[-_.\d]/.test(n)) return 'commutateur-l3';
    if (/^(sw|swi|asw|dsw|switch)[-_.\d]/.test(n) || /[-_.](sw|swi|asw|dsw)[-_.\d]/.test(n)) return 'commutateur';
    if (/^(ap|wap|borne)[-_.\d]/.test(n) || /[-_.](ap|wap)[-_.\d]/.test(n)) return 'wifi';
    if (/^(sep|ipphone|tel|phone)[-_.\d]/.test(n)) return 'telephone';
    if (/^(srv|svr|server|serveur)[-_.\d]/.test(n) || /[-_.](srv|svr)[-_.\d]/.test(n)) return 'serveur';
    if (/^(prn|imp|printer)[-_.\d]/.test(n)) return 'imprimante';
    // Hyperviseurs et nœuds de calcul : des serveurs ; baies de stockage
    if (/^(esxi?|hyp|hv|kvm|pve|proxmox|xen|vmh|nutanix|k8s|node|bdd|db|sql)[-_.\d]/.test(n)) return 'serveur';
    if (/^(nas|san|stor|stockage|baie-stockage)[-_.\d]/.test(n)) return 'stockage';
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
    const infos = new Map(); // clé → { nom, ip, categorie, site, local, lieu, groupe, modele }
    const noter = (brut, extra = {}) => {
        const { nom, ip } = nomEtIp(brut);
        if (!nom) return null;
        const cle = cleNom(nom);
        const x = infos.get(cle) || { cle, nom, ip: '', categorie: null, site: '', local: '', lieu: '', groupe: '', modele: '', indices: [] };
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
            x.site ||= l[e.site] || '';
            x.local ||= l[e.local] || '';
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
        // La liste des équipements, lue d'abord, garde la priorité sur le site et le local écrits dans les liens
        const s = noter(sourceBrute, { site: l[a.siteSource], local: l[a.localSource] });
        const c = noter(cibleBrute, { ip: nomEtIp(l[a.ipCible]).ip, site: l[a.siteCible], local: l[a.localCible] });
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
    if (mode === 'lieu') return x.site || x.lieu || x.groupe || '';
    if (mode === 'prefixe') return prefixeDe(x.nom);
    if (mode === 'reseau') return sousReseau(x.ip);
    return '';
}

// Mode « automatique » : l'emplacement s'il est connu pour la plupart des équipements, sinon le préfixe des noms
// s'il découpe le réseau en quelques sites, sinon rien
export function modeAutomatique(noeuds) {
    const infra = noeuds.filter((x) => !CATEGORIES_RESEAU[x.categorie].terminal);
    if (!infra.length) return 'aucun';
    if (infra.filter((x) => x.site || x.lieu || x.groupe).length >= infra.length * 0.6) return 'lieu';
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
// detaches : Map(clé d'un équipement → { membres, renvoi }) : ses équipements terminaux partent sur des pages de détail ;
// un nœud de renvoi les remplace (« 32 serveurs → page « SW-01 » »)
function construirePage({ noeuds, liaisons, groupeDeNoeud, sousGroupeDeNoeud = () => '', titresGroupes, jeu, resumer, abreger, logique, nouvelId, exterieurs = new Set(), detaches = new Map() }) {
    const modele = { preambule: [], couloirs: false, sens: 'TD', noeuds: [], liens: [], groupes: [], styles: {}, brut: [] };
    const idDe = new Map();
    const parCle = new Map(noeuds.map((x) => [x.cle, x]));
    // Terminaux résumés : rattachés à leur unique voisin d'infrastructure, comptés par catégorie
    const resumes = new Map();
    const voisinUnique = new Map();
    for (const li of liaisons) for (const [x, y] of [[li.a, li.b], [li.b, li.a]]) voisinUnique.set(x, voisinUnique.has(x) ? null : y);
    const masques = new Set();
    for (const d of detaches.values()) for (const x of d.membres) masques.add(x.cle);
    if (resumer) {
        for (const x of noeuds) {
            if (masques.has(x.cle)) continue;
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
    // Groupes : le site, et dedans le local technique (un même nom de local peut revenir dans plusieurs sites)
    const idGroupe = new Map();
    const groupeModele = (titre, parent = null) => {
        if (!titre) return parent;
        const k = JSON.stringify([parent, titre]);
        if (!idGroupe.has(k)) { const id = nouvelId(`g_${titre}`); idGroupe.set(k, id); modele.groupes.push({ id, titre, parent, sens: null }); }
        return idGroupe.get(k);
    };
    for (const x of noeuds) {
        if (masques.has(x.cle)) continue;
        const cat = CATEGORIES_RESEAU[x.categorie];
        const id = nouvelId(x.nom);
        idDe.set(x.cle, id);
        const groupe = exterieurs.has(x.cle) ? groupeModele('Autres sites')
            : groupeModele(sousGroupeDeNoeud(x), titresGroupes ? groupeModele(groupeDeNoeud(x)) : null);
        modele.noeuds.push({ id, texte: x.nom, forme: 'rectangle', groupe, classe: null, icone: `${jeu}:${cat[jeu]}` });
    }
    for (const li of liaisons) {
        if (!idDe.has(li.a) || !idDe.has(li.b)) continue;
        const [x, y] = [parCle.get(li.a), parCle.get(li.b)];
        // Le plus central en haut : l'ordre du lien guide le placement en couches
        const [de, vers] = CATEGORIES_RESEAU[x.categorie].rang + (x.degre > y.degre ? -0.5 : 0) <= CATEGORIES_RESEAU[y.categorie].rang + (y.degre > x.degre ? -0.5 : 0) ? [li.a, li.b] : [li.b, li.a];
        modele.liens.push({ de: idDe.get(de), vers: idDe.get(vers), debut: '', fin: '', texte: libelleLiaison(li, { abreger, logique, inverse: de !== li.a }), trait: li.panne ? 'pointille' : li.membres.length > 1 ? 'epais' : 'plein', longueur: 1 });
    }
    for (const [cle, d] of detaches) {
        if (!idDe.has(cle)) continue;
        const cats = [...new Set(d.membres.map((x) => x.categorie))];
        const cat = CATEGORIES_RESEAU[cats.length === 1 ? cats[0] : 'inconnu'];
        const n = d.membres.length;
        const id = nouvelId(`${cle}_detail`);
        modele.noeuds.push({ id, texte: `${n} ${cats.length === 1 ? cat.pluriel : 'équipements'}\n→ ${d.renvoi}`, forme: 'rectangle', groupe: modele.noeuds.find((x) => x.id === idDe.get(cle))?.groupe ?? null, classe: null, icone: `${jeu}:${cat[jeu]}` });
        modele.liens.push({ de: idDe.get(cle), vers: id, debut: '', fin: '', texte: '', trait: 'pointille', longueur: 1 });
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

// Mise en forme d'un modèle déjà construit (import IMC / LLDP) :
// - feuilles : nœuds reliés par un seul lien, venant de leur parent ; groupées par parent et par cadre ;
// - nom du lien sous la feuille (placeLien 'peripherique') ou retiré ('aucun') ;
// - ordre des feuilles (tri : 'fichier' | 'lien' | 'nom') ; rangées ou colonnes au-delà de 12 (sens).
export function rangerModele(modele, { sens = 'auto', tri = 'fichier', placeLien = 'trait' } = {}) {
    const visibles = modele.liens.filter((l) => l.trait !== 'invisible');
    const degre = new Map();
    for (const l of visibles) for (const k of [l.de, l.vers]) degre.set(k, (degre.get(k) || 0) + 1);
    const noeud = new Map(modele.noeuds.map((n) => [n.id, n]));
    const sortants = new Map();
    for (const l of visibles) (sortants.get(l.de) || sortants.set(l.de, []).get(l.de)).push(l);
    // Bas d'une petite chaîne (un commutateur et son renvoi, par exemple) : la rangée suivante se pose dessous
    const bas = new Map();
    const finDeChaine = (c) => {
        let x = c;
        for (let i = 0; i < 4; i += 1) {
            if (degre.get(x) === 1) return x;
            const s2 = sortants.get(x) || [];
            if (degre.get(x) !== 2 || s2.length !== 1) return null;
            x = s2[0].vers;
        }
        return null;
    };
    const familles = new Map();
    for (const l of visibles) {
        if (degre.get(l.de) === 1) continue;
        const fin = finDeChaine(l.vers);
        if (!fin) continue;
        bas.set(l.vers, fin);
        const f = noeud.get(l.vers);
        const k = JSON.stringify([l.de, f.groupe ?? null]);
        (familles.get(k) || familles.set(k, []).get(k)).push(l);
    }
    // Tri d'abord (sur le nom du lien, encore sur le trait), puis placement du nom du lien
    const comparer = { lien: (a, b) => comparerNoms(a.texte, b.texte), nom: (a, b) => comparerNoms(noeud.get(a.vers).texte, noeud.get(b.vers).texte) }[tri];
    if (comparer) {
        for (const liste of familles.values()) {
            // Les liens d'une famille reprennent leurs places d'origine, dans l'ordre trié : Mermaid range d'après cet ordre
            const places = liste.map((l) => modele.liens.indexOf(l)).sort((a, b) => a - b);
            liste.sort(comparer);
            places.forEach((i, j) => { modele.liens[i] = liste[j]; });
        }
    }
    if (placeLien === 'aucun') for (const l of visibles) l.texte = '';
    else if (placeLien === 'peripherique') {
        for (const liste of familles.values()) for (const l of liste) {
            if (!l.texte) continue;
            const f = noeud.get(l.vers);
            f.texte = `${f.texte}\n${l.texte}`;
            l.texte = '';
        }
    }
    const enColonnes = sens === 'colonnes' || sens === 'LR';
    modele.sens = enColonnes ? 'LR' : 'TD';
    for (const liste of familles.values()) {
        const n = liste.length;
        const ranger = sens === 'rangees' || sens === 'colonnes' || (sens === 'auto' && n > SEUIL_RANGEES);
        if (!ranger || n < 2) continue;
        const k = colonnesRangees(n);
        for (let i = k; i < n; i += 1) modele.liens.push({ de: bas.get(liste[i - k].vers), vers: liste[i].vers, debut: '', fin: '', texte: '', trait: 'invisible', longueur: 1 });
    }
    return modele;
}

// Options : jeu ('illus' | 'picto'), regroupement ('auto' | 'lieu' | 'prefixe' | 'reseau' | 'aucun'), resumer, abreger, logique,
// sens, tri, placeLien (voir rangerModele), parPage (au plus N équipements par page ; 0 = sans limite) : au-delà, les
// équipements terminaux des appareils les plus chargés partent sur des pages de détail (l'appareil, ses voisins amont,
// ses terminaux par tranches), un nœud de renvoi les remplace sur la page d'origine.
export function produirePages(graphe, options = {}) {
    const { jeu = 'illus', regroupement = 'auto', resumer = true, abreger = true, logique = graphe.avecVlans,
        sens = 'auto', tri = 'fichier', placeLien = 'trait', parPage = 0 } = options;
    const limite = Math.max(0, Math.floor(Number(parPage) || 0));
    const mise = { sens, tri, placeLien };
    const mode = regroupement === 'auto' ? modeAutomatique(graphe.noeuds) : regroupement;
    const alertes = [];
    const pages = [];
    const groupeDeNoeud = (x) => groupeDe(x, mode) || (mode === 'aucun' ? '' : 'Sans groupe');
    // Le local technique n'est dessiné que si les équipements sont regroupés
    const localDe = (x) => (mode === 'aucun' ? '' : x.local || '');
    // Un terminal suit le groupe (et le local) de son commutateur
    const parCle = new Map(graphe.noeuds.map((x) => [x.cle, x]));
    const voisins = new Map();
    for (const li of graphe.liaisons) for (const [x, y] of [[li.a, li.b], [li.b, li.a]]) (voisins.get(x) || voisins.set(x, []).get(x)).push(y);
    const groupeFinal = new Map();
    const localFinal = new Map();
    for (const x of graphe.noeuds) {
        let [g, lt] = [groupeDeNoeud(x), localDe(x)];
        if (CATEGORIES_RESEAU[x.categorie].terminal && (voisins.get(x.cle) || []).length === 1) {
            const v = parCle.get(voisins.get(x.cle)[0]);
            if (v && !CATEGORIES_RESEAU[v.categorie].terminal) [g, lt] = [groupeDeNoeud(v), localDe(v)];
        }
        groupeFinal.set(x.cle, g);
        localFinal.set(x.cle, lt);
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
    const ltDe = (x) => localFinal.get(x.cle) || '';
    const infra = graphe.noeuds.filter((x) => !CATEGORIES_RESEAU[x.categorie].terminal);
    const commun = { jeu, resumer, abreger };
    const variantes = logique ? [false, true] : [false];
    // Une page, et au besoin ses pages de détail
    const fabriquer = (nom, params) => {
        const construire = (detaches) => rangerModele(construirePage({ ...params, ...commun, nouvelId: idsUniques(), detaches }), mise);
        let detaches = new Map();
        let modele = construire(detaches);
        const details = [];
        if (limite > 0 && modele.noeuds.length > limite) {
            const ext = params.exterieurs || new Set();
            const degre = new Map();
            for (const li of params.liaisons) for (const k of [li.a, li.b]) degre.set(k, (degre.get(k) || 0) + 1);
            const presents = new Set(params.noeuds.map((x) => x.cle));
            const feuilles = new Map();
            for (const li of params.liaisons) for (const [x, v] of [[li.a, li.b], [li.b, li.a]]) {
                if (degre.get(x) !== 1 || degre.get(v) === 1 || ext.has(x) || ext.has(v) || !presents.has(x) || !presents.has(v)) continue;
                (feuilles.get(v) || feuilles.set(v, []).get(v)).push({ x: parCle.get(x), li });
            }
            const candidats = [...feuilles.entries()].filter(([, l]) => l.length >= 2).sort((a, b) => b[1].length - a[1].length);
            for (const [v, liste] of candidats) {
                detaches.set(v, { membres: liste.map((f) => f.x), renvoi: `page « ${parCle.get(v).nom} »`, liste });
                modele = construire(detaches);
                if (modele.noeuds.length <= limite) break;
            }
            if (modele.noeuds.length > limite) alertes.push(`${nom} : ${modele.noeuds.length} équipements après découpage, au-delà des ${limite} demandés (l'infrastructure seule dépasse la limite).`);
            for (const [v, d] of [...detaches].sort((a, b) => comparerNoms(parCle.get(a[0]).nom, parCle.get(b[0]).nom))) {
                const appareil = parCle.get(v);
                // Voisins amont : ceux qui ne sont pas des feuilles détachées ; ils restent en haut de chaque page de détail
                const dans = new Set(d.membres.map((x) => x.cle));
                const amont = params.liaisons.filter((li) => (li.a === v || li.b === v) && !dans.has(li.a === v ? li.b : li.a));
                const ordre = tri === 'nom' ? [...d.liste].sort((a, b) => comparerNoms(a.x.nom, b.x.nom))
                    : tri === 'lien' ? [...d.liste].sort((a, b) => comparerNoms(libelleLiaison(a.li, { abreger, inverse: a.li.a !== v }), libelleLiaison(b.li, { abreger, inverse: b.li.a !== v })))
                        : d.liste;
                const taille = Math.max(1, limite - amont.length - 1);
                const tranches = Math.ceil(ordre.length / taille);
                for (let t = 0; t < tranches; t += 1) {
                    const part = ordre.slice(t * taille, (t + 1) * taille);
                    const cles = new Set([v, ...amont.map((li) => (li.a === v ? li.b : li.a)), ...part.map((f) => f.x.cle)]);
                    const nomDetail = `${nom} — ${appareil.nom}${tranches > 1 ? ` (${t + 1}/${tranches}) : ${t * taille + 1} à ${t * taille + part.length} sur ${ordre.length}` : ''}`;
                    const m = rangerModele(construirePage({ noeuds: params.noeuds.filter((x) => cles.has(x.cle)).concat([...cles].filter((k) => !presents.has(k)).map((k) => parCle.get(k))),
                        liaisons: [...amont, ...part.map((f) => f.li)], groupeDeNoeud: () => '', titresGroupes: false, logique: params.logique,
                        jeu, resumer: false, abreger, nouvelId: idsUniques() }), mise);
                    details.push({ nom: nomDetail, code: ecrirePage(m, alertes, nomDetail), equipements: m.noeuds.length });
                }
            }
        }
        pages.push({ nom, code: ecrirePage(modele, alertes, nom), equipements: modele.noeuds.length }, ...details);
    };

    if (titres.length < 2 || infra.length <= SEUIL_VUE_ENSEMBLE) {
        // Une seule page (par variante), les groupes en cadres
        for (const lo of variantes) {
            fabriquer(lo ? 'Réseau logique (VLAN)' : 'Réseau physique',
                { noeuds: graphe.noeuds, liaisons: graphe.liaisons, groupeDeNoeud: gDe, sousGroupeDeNoeud: ltDe, titresGroupes: titres.length >= 2, logique: lo });
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
            // La paire est gardée telle quelle : un nom de groupe peut contenir n'importe quel caractère
            const paire = [ga, gb].sort();
            const k = JSON.stringify(paire);
            const avant = entre.get(k);
            entre.set(k, { paire, n: (avant?.n || 0) + li.membres.length });
        }
        for (const { paire: [ga, gb], n } of entre.values()) {
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
                fabriquer(`${lo ? 'Logique' : 'Réseau'} : ${t}`, { noeuds, liaisons, groupeDeNoeud: () => '', sousGroupeDeNoeud: ltDe, titresGroupes: false, logique: lo, exterieurs });
            }
        }
    }
    return { pages, alertes, mode };
}

// ---------- Commutateur et périphériques : fichier à trois colonnes ----------
// Colonne 1 : commutateur, colonne 2 : lien (port, agrégat…), colonne 3 : périphérique. Les noms sont des données :
// ils peuvent contenir n'importe quel caractère, y compris ceux de la syntaxe de Mermaid.

const MOTS_ENTETE = [/commutateur|switch|equipement|source|nom|device|chassis/, /lien|port|interface|link|liaison|connexion|agregat/, /peripherique|device|equipement|voisin|destination|cible|serveur|poste|hote|host|nom|client/, /vlan/];

// Un nom tient sur une ligne : caractères de contrôle et retours à la ligne deviennent des espaces
export const nettoyerNom = (t) => String(t ?? '').replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);

// Texte d'un libellé : Mermaid interprète « <…> » comme du HTML (retiré) et « #…; » ou « &…; » comme des entités.
// Ces caractères sont écrits en entités numériques, que Mermaid laisse telles quelles et que le rendu décode
// (rendu.js, decoderEntites) : le nom s'affiche exactement. Guillemets, accents graves et barres sont pris en
// charge par l'éditeur du logigramme.
export const protegerTexte = (t) => String(t)
    .replace(/#(?=\w+;)/g, '#35;').replace(/&/g, '#38;').replace(/</g, '#60;').replace(/>/g, '#62;')
    // Mise en forme Markdown : « *gras* », « _italique_ » ; un « _ » entre deux lettres (SW_A_B) n'en fait pas
    .replace(/\*/g, '#42;').replace(/(?<![\p{L}\p{N}])_|_(?![\p{L}\p{N}])/gu, '#95;');

export function lireCommutateurs(enregistrements, { entete = 'auto' } = {}) {
    const premiere = (enregistrements[0] || []).slice(0, 4).map(normaliser);
    const avecEntete = entete === 'auto' ? premiere.filter((c, i) => c && MOTS_ENTETE[i].test(c)).length >= 2 : Boolean(entete);
    const bilan = { lignes: 0, ignorees: 0, doublons: 0, colonnesEnTrop: false, vlansIllisibles: 0 };
    let avecVlans = false;
    const lignes = [];
    const vues = new Set();
    for (const brute of enregistrements.slice(avecEntete ? 1 : 0)) {
        if (!brute.some((c) => String(c ?? '').trim())) continue;
        bilan.lignes += 1;
        if (brute.slice(4).some((c) => String(c ?? '').trim())) bilan.colonnesEnTrop = true;
        const [commutateur, lien, peripherique] = [0, 1, 2].map((i) => nettoyerNom(brute[i]));
        if (!commutateur || !peripherique || cleNom(commutateur) === cleNom(peripherique)) { bilan.ignorees += 1; continue; }
        const cle = JSON.stringify([cleNom(commutateur), lien.toLowerCase(), cleNom(peripherique)]);
        if (vues.has(cle)) { bilan.doublons += 1; continue; }
        vues.add(cle);
        // 4e colonne facultative : VLAN propagés sur le lien (« 10,20,100-110 », « 1 to 4094 »)
        const brutVlans = String(brute[3] ?? '').trim();
        const vlans = brutVlans ? lireVlans(brutVlans) : new Set();
        if (brutVlans && !vlans.size) bilan.vlansIllisibles += 1;
        if (vlans.size) avecVlans = true;
        lignes.push({ commutateur, lien, peripherique, vlans });
    }
    return { lignes, entete: avecEntete, avecVlans, colonnes: avecEntete ? (enregistrements[0] || []).slice(0, 4).map((c) => nettoyerNom(c)) : [], bilan };
}

const SEUIL_PAGE_UNIQUE = 40; // au-delà de ce nombre d'équipements, une page par commutateur
const SEUIL_RANGEES = 12; // au-delà de ce nombre de périphériques sous un commutateur, ils sont répartis en rangées
// Colonnes d'une répartition en rangées : à peu près les proportions d'une page paysage (48 → 7 colonnes, 7 rangées)
export const colonnesRangees = (n) => Math.min(12, Math.max(6, Math.ceil(Math.sqrt(n))));

// Options : jeu ('illus' | 'picto'), presentation ('auto' | 'unique' | 'commutateur'),
// sens ('auto' | 'rangees' | 'TD' | 'LR' | 'colonnes' (à droite, en plusieurs colonnes) ; automatique : une rangée sous le commutateur, plusieurs au-delà de 12),
// liens (nom du lien sur le trait), abreger (GigabitEthernet1/0/1 → GE1/0/1), encadrer (un cadre par commutateur),
// vlans (sur chaque lien qui en porte : un nœud « VLAN 10, 20, 100-110 » avec l'icône VLAN, au milieu du lien),
// parPageVue (vue d'ensemble : au plus N commutateurs par page ; au-delà, une page des cœurs puis une page par site,
// par tranches ; 0 = une seule page),
// ensemble (pages par commutateur, plusieurs commutateurs : vue d'ensemble des commutateurs en première page, avec le
// nombre de périphériques de chacun), amont (sur la page d'un commutateur, rappel des commutateurs dont il dépend),
// placeLien ('trait' : nom du lien sur le trait ; 'peripherique' : sous le nom du périphérique, quand il n'a qu'un lien
// sur la page, sinon sur le trait), parType (pages séparées pour les agrégats et les liens simples), parPage (au plus N périphériques par page ; 0 = sans limite).
// Un découpage (parType ou parPage) donne toujours des pages par commutateur.
// tri : ordre des périphériques ('fichier' | 'lien' | 'lien-inverse' | 'type' | 'peripherique' | 'peripherique-inverse') ; les liens sont triés
// dans l'ordre naturel (G1/0/2 avant G1/0/10, Bridge-Aggregation9 avant Bridge-Aggregation10) ; à égalité, ordre du fichier.
const COLLATEUR = new Intl.Collator('fr', { numeric: true, sensitivity: 'base' });
export const comparerNoms = (a, b) => COLLATEUR.compare(String(a ?? ''), String(b ?? ''));
export const TRIS_PERIPHERIQUES = [
    ['fichier', 'Ordre du fichier'],
    ['lien', 'Nom du lien, croissant (G1/0/2 avant G1/0/10)'],
    ['lien-inverse', 'Nom du lien, décroissant'],
    ['type', 'Agrégats d\'abord, puis nom du lien'],
    ['peripherique', 'Nom du serveur ou périphérique, croissant'],
    ['peripherique-inverse', 'Nom du serveur ou périphérique, décroissant'],
];
export function trierLignes(lignes, tri = 'fichier') {
    const cle = {
        lien: (a, b) => comparerNoms(a.lien, b.lien),
        'lien-inverse': (a, b) => comparerNoms(b.lien, a.lien),
        type: (a, b) => (estAgregat(b.lien) - estAgregat(a.lien)) || comparerNoms(a.lien, b.lien),
        peripherique: (a, b) => comparerNoms(a.peripherique, b.peripherique),
        'peripherique-inverse': (a, b) => comparerNoms(b.peripherique, a.peripherique),
    }[tri];
    return cle ? [...lignes].sort(cle) : [...lignes]; // tri stable : à égalité, l'ordre du fichier est gardé
}
// Liens entre deux commutateurs décrits des deux côtés (« A;BAGG101;B » et « B;BAGG1;A », comme dans un export où chaque
// commutateur liste ses voisins) : un seul lien, côté parent, qui porte les deux ports (« BAGG101 – BAGG1 »).
// Le parent est celui qui a le plus de commutateurs voisins (un cœur) ; à égalité, celui de la première ligne.
// Plusieurs liens entre les deux mêmes commutateurs sont appariés dans l'ordre du fichier. Rend aussi le nombre de fusions.
const SEPARATEUR_PORTS = '\u0000';
export function fusionnerReciproques(lignes) {
    const cles = new Set(lignes.map((l) => cleNom(l.commutateur)));
    const voisins = new Map();
    for (const l of lignes) {
        const [a, b] = [cleNom(l.commutateur), cleNom(l.peripherique)];
        if (cles.has(b)) for (const [x, y] of [[a, b], [b, a]]) (voisins.get(x) || voisins.set(x, new Set()).get(x)).add(y);
    }
    const parSens = new Map();
    lignes.forEach((l, i) => {
        const [a, b] = [cleNom(l.commutateur), cleNom(l.peripherique)];
        if (!cles.has(b)) return;
        const k = JSON.stringify([a, b]);
        (parSens.get(k) || parSens.set(k, []).get(k)).push(i);
    });
    const retirees = new Set();
    const resultat = lignes.map((l) => ({ ...l }));
    let fusions = 0;
    for (const [k, aller] of parSens) {
        const [a, b] = JSON.parse(k);
        const retour = parSens.get(JSON.stringify([b, a]));
        if (!retour || a === b) continue;
        // Chaque paire est traitée une fois, depuis le parent
        const parent = (voisins.get(a)?.size ?? 0) !== (voisins.get(b)?.size ?? 0) ? ((voisins.get(a)?.size ?? 0) > (voisins.get(b)?.size ?? 0) ? a : b) : (aller[0] < retour[0] ? a : b);
        if (parent !== a) continue;
        for (let n = 0; n < Math.min(aller.length, retour.length); n += 1) {
            const [i, j] = [aller[n], retour[n]];
            const fils = lignes[j];
            resultat[i].lien = [lignes[i].lien, fils.lien].filter(Boolean).join(SEPARATEUR_PORTS);
            resultat[i].vlans = new Set([...(lignes[i].vlans || []), ...(fils.vlans || [])]);
            retirees.add(j);
            fusions += 1;
        }
    }
    return { lignes: resultat.filter((_, i) => !retirees.has(i)), fusions };
}

export function produirePagesCommutateurs({ lignes: lignesLues }, options = {}) {
    const { jeu = 'illus', presentation = 'auto', sens = 'auto', liens: avecLiens = true, abreger = false, encadrer = true,
        parType = false, parPage = 0, tri = 'fichier', placeLien = 'trait', ensemble = true, amont: avecAmont = true,
        vlans: avecVlans = false, parPageVue = 0 } = options;
    const limiteVue = Math.max(0, Math.floor(Number(parPageVue) || 0));
    const { lignes: fusionnees, fusions } = fusionnerReciproques(lignesLues);
    const lignes = trierLignes(fusionnees, tri);
    const limite = Math.max(0, Math.floor(Number(parPage) || 0));
    const alertes = [];
    const noms = new Map(); // clé → nom affiché (le premier rencontré)
    const nomDe = (n) => { const k = cleNom(n); if (!noms.has(k)) noms.set(k, n); return k; };
    const commutateurs = [];
    const branches = new Map(); // clé du commutateur → [{ peripherique, lien }]
    for (const l of lignes) {
        const c = nomDe(l.commutateur);
        const p = nomDe(l.peripherique);
        if (!branches.has(c)) { branches.set(c, []); commutateurs.push(c); }
        branches.get(c).push({ peripherique: p, lien: l.lien, vlans: l.vlans });
    }
    const estCommutateur = new Set(commutateurs);
    const categorie = (k) => {
        const parNom = categorieDuNom(noms.get(k));
        if (estCommutateur.has(k)) return ['commutateur-l3', 'routeur', 'pare-feu'].includes(parNom) ? parNom : 'commutateur';
        return parNom || categorieDe(noms.get(k)) || 'inconnu';
    };
    const icone = (k) => `${jeu}:${CATEGORIES_RESEAU[categorie(k)][jeu]}`;
    // Un lien fusionné porte les deux ports : côté parent – côté fils
    const texteLien = (lien) => (avecLiens && lien ? String(lien).split(SEPARATEUR_PORTS).map((x) => protegerTexte(abreger ? abregerInterface(x) : x)).join(' – ') : '');
    const sensPour = () => (sens === 'LR' || sens === 'colonnes' ? 'LR' : 'TD');
    // Rangées : les périphériques propres à un commutateur (ni commutateurs, ni partagés) sont empilés par des liens
    // invisibles, de la colonne de la rangée du dessus vers celle du dessous ; l'ordre du fichier se lit ligne par ligne
    // En LR (« colonnes »), le même empilement donne des colonnes à droite du commutateur
    const enRangees = (n) => sens === 'rangees' || sens === 'colonnes' || (sens === 'auto' && n > SEUIL_RANGEES);
    const nombre = new Set(lignes.flatMap((l) => [cleNom(l.commutateur), cleNom(l.peripherique)])).size;
    const decoupe = parType || limite > 0;
    const unique = !decoupe && (presentation === 'unique' || (presentation === 'auto' && (commutateurs.length === 1 || nombre <= SEUIL_PAGE_UNIQUE)));
    const pages = [];

    const page = (cles, liaisons, groupeDe, titre, sensPage, rangs = [], complement = null) => {
        const modele = { preambule: [], couloirs: false, sens: sensPage, noeuds: [], liens: [], groupes: [], styles: {}, brut: [] };
        const nouvelId = idsUniques();
        const ids = new Map();
        const idGroupe = new Map();
        // Nom du lien sous le nom de l'équipement : seulement si tous les liens qui lui arrivent sur la page portent le
        // même nom (un serveur, ou un commutateur de baie relié aux deux cœurs par le même agrégat) ; sinon sur les traits
        const lienSous = new Map();
        if (placeLien === 'peripherique' && avecLiens) {
            const nomsVers = new Map();
            for (const { vers, lien, entre } of liaisons) if (!entre) nomsVers.set(vers, (nomsVers.get(vers) || new Set()).add(lien || ''));
            for (const [vers, n] of nomsVers) if (n.size === 1 && [...n][0]) lienSous.set(vers, [...n][0]);
        }
        for (const k of cles) {
            const g = groupeDe(k);
            if (g && !idGroupe.has(g)) { const id = nouvelId(`g_${noms.get(g)}`); idGroupe.set(g, id); modele.groupes.push({ id, titre: protegerTexte(noms.get(g)), parent: null, sens: null }); }
            const id = nouvelId(noms.get(k));
            ids.set(k, id);
            // Commutateur dans son propre cadre : son nom est déjà le titre du cadre ; l'icône ne porte que la suite
            // (nom du lien, liaison entre cœurs, nombre de périphériques)
            const suite = [lienSous.has(k) ? texteLien(lienSous.get(k)) : '', complement?.get(k) || ''].filter(Boolean).join('\n');
            const texte = g === k ? suite : protegerTexte(noms.get(k)) + (suite ? `\n${suite}` : '');
            modele.noeuds.push({ id, texte, forme: 'rectangle', groupe: g ? idGroupe.get(g) : null, classe: null, icone: icone(k) });
        }
        // VLAN : un nœud au milieu du lien (Mermaid ne pose pas d'icône sur un trait) ; il est le haut du périphérique
        // pour les rangées
        const hautDe = new Map();
        const groupeDuNoeud = new Map(modele.noeuds.map((n) => [n.id, n.groupe]));
        for (const { de, vers, lien, vlans: vl, entre } of liaisons) {
            const trait = estAgregat(lien) ? 'epais' : 'plein';
            // Liaison entre deux cœurs : un nœud sous les deux, relié à chacun ; un trait direct mettrait l'un sous l'autre
            if (entre) {
                const id = nouvelId(`liaison_${noms.get(de)}_${noms.get(vers)}`);
                const lignes = [`Liaison ${protegerTexte(noms.get(de))} ↔ ${protegerTexte(noms.get(vers))}`, avecLiens && lien ? texteLien(lien) : '', avecVlans && vl?.size ? `VLAN ${ecrireVlans(vl)}` : ''];
                modele.noeuds.push({ id, texte: lignes.filter(Boolean).join('\n'), forme: 'rectangle', groupe: null, classe: null, icone: avecVlans && vl?.size ? `${jeu}:vlan` : null });
                modele.liens.push({ de: ids.get(de), vers: id, debut: '', fin: '', texte: '', trait, longueur: 1 });
                modele.liens.push({ de: ids.get(vers), vers: id, debut: '', fin: '', texte: '', trait, longueur: 1 });
                continue;
            }
            const texte = lienSous.has(vers) ? '' : texteLien(lien);
            if (avecVlans && vl?.size) {
                const id = nouvelId(`vlan_${noms.get(de)}_${noms.get(vers)}`);
                const [gA, gB] = [groupeDuNoeud.get(ids.get(de)), groupeDuNoeud.get(ids.get(vers))];
                modele.noeuds.push({ id, texte: `VLAN ${ecrireVlans(vl)}`, forme: 'rectangle', groupe: gA === gB ? gB : null, classe: null, icone: `${jeu}:vlan` });
                modele.liens.push({ de: ids.get(de), vers: id, debut: '', fin: '', texte, trait, longueur: 1 });
                modele.liens.push({ de: id, vers: ids.get(vers), debut: '', fin: '', texte: '', trait, longueur: 1 });
                hautDe.set(vers, hautDe.has(vers) ? null : id);
            } else {
                modele.liens.push({ de: ids.get(de), vers: ids.get(vers), debut: '', fin: '', texte, trait, longueur: 1 });
                if (hautDe.has(vers)) hautDe.set(vers, null);
            }
        }
        for (const liste of rangs) {
            if (!enRangees(liste.length)) continue;
            const k = colonnesRangees(liste.length);
            for (let i = k; i < liste.length; i += 1) modele.liens.push({ de: ids.get(liste[i - k]), vers: hautDe.get(liste[i]) || ids.get(liste[i]), debut: '', fin: '', texte: '', trait: 'invisible', longueur: 1 });
        }
        pages.push({ nom: titre, code: ecrirePage(modele, alertes, titre), equipements: modele.noeuds.length }); // nœuds VLAN compris
    };

    if (unique) {
        // Tous les commutateurs sur une page ; un périphérique relié à un seul commutateur va dans le cadre de celui-ci
        const rattache = new Map();
        for (const c of commutateurs) for (const { peripherique: p } of branches.get(c)) {
            if (estCommutateur.has(p)) continue;
            rattache.set(p, rattache.has(p) && rattache.get(p) !== c ? null : c);
        }
        const cles = [];
        for (const c of commutateurs) {
            cles.push(c);
            for (const { peripherique: p } of branches.get(c)) if (!cles.includes(p) && !estCommutateur.has(p)) cles.push(p);
        }
        const cadres = encadrer && commutateurs.length > 1;
        const groupeDe = (k) => (!cadres ? null : estCommutateur.has(k) ? k : rattache.get(k) || null);
        const liaisons = commutateurs.flatMap((c) => branches.get(c).map(({ peripherique, lien, vlans }) => ({ de: c, vers: peripherique, lien, vlans })));
        const propres = (c) => [...new Set(branches.get(c).map((x) => x.peripherique))].filter((p) => !estCommutateur.has(p) && rattache.get(p) === c);
        page(cles, liaisons, groupeDe, commutateurs.length === 1 ? `Commutateur ${noms.get(commutateurs[0])}` : 'Commutateurs et périphériques',
            sensPour(), commutateurs.map(propres));
    } else {
        // Commutateurs amont de chacun (ceux qui le citent comme périphérique) : rappelés au-dessus de lui sur ses pages
        const amont = new Map(commutateurs.map((c) => [c, []]));
        for (const c of commutateurs) for (const { peripherique, lien, vlans } of branches.get(c)) if (estCommutateur.has(peripherique) && peripherique !== c) amont.get(peripherique).push({ de: c, lien, vlans });
        // Vue d'ensemble : les commutateurs seuls, leurs liaisons, et le nombre de périphériques de chacun
        if (ensemble && commutateurs.length > 1) {
            const liaisons = commutateurs.flatMap((c) => branches.get(c).filter((x) => estCommutateur.has(x.peripherique) && x.peripherique !== c).map(({ peripherique, lien, vlans }) => ({ de: c, vers: peripherique, lien, vlans })));
            // Deux commutateurs qui desservent chacun d'autres commutateurs (deux cœurs reliés entre eux) : un trait les
            // mettrait l'un sous l'autre et les liaisons du premier contourneraient le second ; ils restent côte à côte,
            // leur liaison devient un nœud placé sous les deux (nom du lien, VLAN). Sur la page d'un site sans l'autre
            // cœur, elle est écrite sous le cœur (« ↔ CŒUR-DC-SUD : BAGG1 »)
            const aval = (c) => new Set(liaisons.filter((l) => l.de === c).map((l) => l.vers));
            const entrePairs = (l) => [...aval(l.de)].some((v) => v !== l.vers) && [...aval(l.vers)].some((v) => v !== l.de);
            const pairs = liaisons.filter(entrePairs);
            const nombre = (c) => { const n = new Set(branches.get(c).map((x) => x.peripherique).filter((p) => !estCommutateur.has(p))).size; return n ? `${n} périphérique${n > 1 ? 's' : ''}` : ''; };
            const complement = new Map(commutateurs.map((c) => [c, nombre(c)]));
            const versAutreCoeur = (c) => pairs.filter((l) => l.de === c || l.vers === c).map((l) => `↔ ${protegerTexte(noms.get(l.de === c ? l.vers : l.de))}${avecLiens && l.lien ? ` : ${texteLien(l.lien)}` : ''}${avecVlans && l.vlans?.size ? ` · VLAN ${ecrireVlans(l.vlans)}` : ''}`);
            const complementSite = new Map(commutateurs.map((c) => [c, [...versAutreCoeur(c), nombre(c)].filter(Boolean).join('\n')]));
            const entreCoeurs = pairs.map((l) => ({ ...l, entre: true }));
            const feuilles = commutateurs.filter((c) => !liaisons.some((l) => l.de === c));
            // Sites : un cœur (relié à un autre cœur, ou sans commutateur amont) et les commutateurs qui ne dépendent que de
            // lui ; s'il y a plusieurs cœurs et que chaque commutateur relève d'un seul, chaque site a son cadre
            const coeurs = commutateurs.filter((c) => aval(c).size && (pairs.some((l) => l.de === c || l.vers === c) || !liaisons.some((l) => l.vers === c)));
            const estCoeur = new Set(coeurs);
            const siteDe = new Map(coeurs.map((c) => [c, c]));
            const remonter = (c, vus = new Set()) => {
                if (estCoeur.has(c)) return new Set([c]);
                if (vus.has(c)) return new Set();
                vus.add(c);
                const r = new Set();
                for (const l of liaisons) if (l.vers === c && !pairs.includes(l)) for (const x of remonter(l.de, vus)) r.add(x);
                return r;
            };
            for (const c of commutateurs) if (!estCoeur.has(c)) { const r = remonter(c); if (r.size === 1) siteDe.set(c, [...r][0]); }
            const parSite = encadrer && coeurs.length > 1 && commutateurs.every((c) => siteDe.has(c));
            const rangsVue = parSite ? coeurs.map((c) => feuilles.filter((f) => siteDe.get(f) === c)) : [feuilles];
            const tracees = liaisons.filter((l) => !pairs.includes(l));
            if (!limiteVue || commutateurs.length <= limiteVue) {
                page(commutateurs, [...tracees, ...entreCoeurs], parSite ? (k) => siteDe.get(k) : () => null, 'Vue d\'ensemble des commutateurs', sensPour(), rangsVue, complement);
            } else {
                // Trop de commutateurs pour une page : une page des cœurs (s'il y a plusieurs sites), puis une page par site,
                // découpée en tranches ; les cœurs du site sont repris en haut de chaque tranche
                const sites = parSite
                    ? coeurs.map((c) => ({ nom: noms.get(c), racines: [c], membres: commutateurs.filter((x) => x !== c && siteDe.get(x) === c) }))
                    : [{ nom: '', racines: commutateurs.filter((c) => !feuilles.includes(c)), membres: feuilles }];
                if (parSite) {
                    const resume = new Map(coeurs.map((c) => {
                        const membres = commutateurs.filter((x) => x !== c && siteDe.get(x) === c);
                        const n = new Set(membres.flatMap((x) => branches.get(x).map((b) => b.peripherique)).filter((p) => !estCommutateur.has(p))).size;
                        return [c, `${membres.length} commutateur${membres.length > 1 ? 's' : ''} · ${n} périphérique${n > 1 ? 's' : ''}`];
                    }));
                    page(coeurs, [...tracees.filter((l) => estCoeur.has(l.de) && estCoeur.has(l.vers)), ...entreCoeurs], () => null, 'Vue d\'ensemble : cœurs de réseau', sensPour(), [], resume);
                }
                for (const site of sites) {
                    const taille = Math.max(1, limiteVue - site.racines.length);
                    const tranches = Math.max(1, Math.ceil(site.membres.length / taille));
                    for (let t = 0; t < tranches; t += 1) {
                        const part = site.membres.slice(t * taille, (t + 1) * taille);
                        const cles = new Set([...site.racines, ...part]);
                        const titre = `Vue d'ensemble${site.nom ? ` : ${site.nom}` : ' des commutateurs'}${tranches > 1 ? ` (${t + 1}/${tranches}) : commutateurs ${t * taille + 1} à ${t * taille + part.length} sur ${site.membres.length}` : ''}`;
                        page([...cles], tracees.filter((l) => cles.has(l.de) && cles.has(l.vers)), () => null, titre, sensPour(), [part.filter((x) => feuilles.includes(x))], complementSite);
                    }
                }
            }
        }
        // Une page par commutateur : lui, puis ses périphériques (un commutateur voisin y figure comme périphérique)
        // Découpage : par type de lien (agrégats, puis liens simples), puis par tranches de « limite » périphériques,
        // dans l'ordre du fichier ; un périphérique relié des deux façons figure sur les deux pages
        for (const c of commutateurs) {
            const b = branches.get(c);
            const types = parType
                ? [['agrégats', b.filter((x) => estAgregat(x.lien))], ['liens simples', b.filter((x) => !estAgregat(x.lien))]].filter(([, l]) => l.length)
                : [['', b]];
            for (const [type, liste] of types) {
                const peripheriques = [...new Set(liste.map((x) => x.peripherique))];
                const taille = limite > 0 ? limite : peripheriques.length;
                const tranches = Math.ceil(peripheriques.length / taille);
                for (let t = 0; t < tranches; t += 1) {
                    const part = peripheriques.slice(t * taille, (t + 1) * taille);
                    const dans = new Set(part);
                    const titre = `Commutateur ${noms.get(c)}${type ? ` — ${type}` : ''}${tranches > 1 ? ` (${t + 1}/${tranches}) : périphériques ${t * taille + 1} à ${t * taille + part.length} sur ${peripheriques.length}` : ''}`;
                    const hauts = avecAmont ? amont.get(c).filter((x) => !dans.has(x.de)) : [];
                    // Rangées : les périphériques et les commutateurs desservis, sauf ceux qui desservent eux-mêmes des
                    // commutateurs (l'autre cœur d'un data center jumeau)
                    const desservent = (p) => estCommutateur.has(p) && branches.get(p).some((x) => estCommutateur.has(x.peripherique) && x.peripherique !== c);
                    page([...new Set(hauts.map((x) => x.de)), c, ...part],
                        [...hauts.map(({ de, lien, vlans }) => ({ de, vers: c, lien, vlans })), ...liste.filter((x) => dans.has(x.peripherique)).map(({ peripherique, lien, vlans }) => ({ de: c, vers: peripherique, lien, vlans }))],
                        () => null, titre, sensPour(), [part.filter((p) => !desservent(p))]);
                }
            }
        }
    }
    return { pages, alertes, unique, commutateurs: commutateurs.length, equipements: nombre, fusions };
}
