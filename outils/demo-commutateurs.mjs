// Pages de démonstration du module « Commutateur et périphériques (CSV à 3 colonnes) », produites par le code de
// l'import lui-même (js/reseau.js) et rangées dans presentation-fusain.fusain.json, après « Interconnexion de sites ».
// Les textes du sommaire, du panorama et de la diapositive « Partie 5 — Réseaux » citent le module (modifiés à la main).
// Relancer après une évolution du module :  bun outils/demo-commutateurs.mjs   (puis python3 outils/generer.py)
// Les pages déjà produites (identifiants « p52c_… ») sont remplacées ; les autres pages ne changent pas.
import { readFileSync, writeFileSync } from 'node:fs';
import * as reseau from '../js/reseau.js';

const racine = new URL('../', import.meta.url);
const lire = async (nom) => reseau.lireCommutateurs(await reseau.lireEnregistrements(new Uint8Array(readFileSync(new URL(`Documentation/exemples-reseau/${nom}`, racine)))));
const petit = await lire('commutateur-serveurs.csv');
const grand = await lire('commutateur-48-serveurs.csv');
const plusieurs = await lire('plusieurs-commutateurs.csv');
const datacenter = await lire('datacenter.csv');
const datacenterVlans = await lire('datacenter-vlans.csv');
const datacenterCascade = await lire('datacenter-cascade.csv');
const imc = reseau.analyserReseau(reseau.tableau(await reseau.lireEnregistrements(new Uint8Array(readFileSync(new URL('Documentation/exemples-reseau/imc-datacenters.csv', racine)))), reseau.CHAMPS_LIENS));

const PIED = 'FUSAIN 0.23.0 — Présentation complète des 60 modèles — page {n}/{total} — {date}';
const AJUSTEMENT = { mode: 'page', echelle: 100, alignement: 'centre' };
const meta = (id, nom, format, titre, sousTitre, description, type = 'flowchart') => ({ id: `p52c_${id}`, nom, format, orientation: 'paysage', margesMm: 15, titre, sousTitre, piedDePage: PIED, description, ajustement: AJUSTEMENT, type });
const produire = (lu, options) => {
    const r = reseau.produirePagesCommutateurs(lu, options);
    if (r.alertes.length) throw new Error(r.alertes.join(' ; '));
    return r.pages;
};
const sousTitre = (fichier, reglages) => `Import « Commutateur et périphériques (CSV à 3 colonnes) » — ${fichier} — ${reglages}`;

const pages = [];
pages.push({ ...meta('diapo', 'Commutateur et périphériques (Diapo Blocs)', 'A4', '', '', 'Présentation du module d\'import d\'un commutateur et de ses périphériques depuis un CSV à trois colonnes (modèle diapo-blocs).', 'diapo'),
    code: `diapo blocs
partie: 5. Réseaux
sous-partie: d. Commutateur et périphériques (CSV à 3 colonnes)
titre: Un schéma de commutateur à partir d'un simple fichier CSV
texte: Colonne 1 : le commutateur ; colonne 2 : le lien ; colonne 3 : le périphérique. Tous les caractères sont admis dans les noms (guillemets, crochets, chevrons, &, |, #) : FUSAIN les protège pour Mermaid. Les pages suivantes sont produites par l'import, avec ses différents réglages.
- [illus:commutateur-switch] Disposition | Sous le commutateur, en rangées (automatique au-delà de 12 périphériques) ou sur une seule rangée ; à droite, en plusieurs colonnes ou sur une seule.
- [illus:livrable] Pages | Tous les commutateurs sur une page, encadrés ; une page par commutateur, précédée d'une vue d'ensemble et rappelant les cœurs amont ; découpage d'un commutateur chargé (8 à 48 par page) ; agrégats et liens simples séparés.
- [illus:flux-de-donnees] Ordre des périphériques | Ordre du fichier, nom du lien (G1/0/2 avant G1/0/10), agrégats d'abord, ou nom du serveur, en ordre croissant ou décroissant.
- [illus:organigramme] Liens et VLAN | Agrégats en trait épais ; nom du lien sous le périphérique ou sur le trait ; interfaces abrégées ; 4e colonne facultative : VLAN propagés, nœud VLAN sur chaque lien.
` });

let [p] = produire(petit, { jeu: 'illus', placeLien: 'trait' });
pages.push({ ...meta('petit', 'Commutateur et 5 serveurs (CSV 3 colonnes)', 'A4', 'Commutateur de salle serveurs et ses 5 serveurs',
    sousTitre('commutateur-serveurs.csv', 'icônes illustrées, une rangée, nom du lien sur le trait'), 'Trois serveurs en agrégat (trait épais), deux en lien gigabit ; nom du lien écrit sur le trait.'), code: p.code });

[p] = produire(plusieurs, { jeu: 'illus', presentation: 'unique', encadrer: true, abreger: true, placeLien: 'peripherique' });
pages.push({ ...meta('plusieurs', 'Plusieurs commutateurs sur une page (CSV 3 colonnes)', 'A4', 'Cœur de réseau et commutateurs d\'étage, chacun encadré avec ses périphériques',
    sousTitre('plusieurs-commutateurs.csv', 'tous les commutateurs sur une page, encadrés, interfaces abrégées, nom du lien sous le périphérique'), 'Trois commutateurs reliés entre eux ; GigabitEthernet1/0/1 abrégé en GE1/0/1 ; un nom de périphérique entre guillemets.'), code: p.code });

[p] = produire(grand, { jeu: 'illus', sens: 'auto', tri: 'lien', placeLien: 'peripherique' });
pages.push({ ...meta('rangees', '48 serveurs en rangées (CSV 3 colonnes)', 'A3', 'Commutateur 48 ports : serveurs en rangées sous le commutateur',
    sousTitre('commutateur-48-serveurs.csv', 'rangées automatiques (7 × 7), tri sur le nom du lien, nom du lien sous le serveur'), '48 serveurs, 12 agrégats et 36 liens gigabit, quatre noms avec des caractères de la syntaxe de Mermaid.'), code: p.code });

[p] = produire(grand, { jeu: 'picto', sens: 'colonnes', tri: 'peripherique', placeLien: 'peripherique' });
pages.push({ ...meta('colonnes', '48 serveurs à droite en colonnes (CSV 3 colonnes)', 'A3', 'Commutateur 48 ports : serveurs en colonnes à droite du commutateur',
    sousTitre('commutateur-48-serveurs.csv', 'pictogrammes, plusieurs colonnes à droite, tri sur le nom du serveur'), 'Même fichier, disposé de gauche à droite, serveurs triés par nom.'), code: p.code });

const decoupe = produire(grand, { jeu: 'illus', parType: true, parPage: 24, tri: 'lien', abreger: true, placeLien: 'peripherique' });
const titres = ['Agrégats de liens', 'Liens simples, 1re page', 'Liens simples, 2e page'];
decoupe.forEach((x, i) => pages.push({ ...meta(`decoupe${i + 1}`, `48 serveurs découpés ${i + 1}/${decoupe.length} (CSV 3 colonnes)`, x.equipements > 20 ? 'A3' : 'A4',
    `${titres[i] ?? x.nom} — ${x.nom.replace(/^Commutateur /, '')}`,
    sousTitre('commutateur-48-serveurs.csv', 'agrégats et liens simples séparés, 24 périphériques au plus par page, interfaces abrégées'),
    'Découpage d\'un commutateur chargé sur plusieurs pages : le commutateur est repris en haut de chacune.'), code: x.code }));

// Deux data centers jumeaux en haute disponibilité, sur deux sites : un cœur par site, reliés entre eux ; 24 commutateurs
// de baie par cœur ; 1 412 serveurs. Vue d'ensemble (un cadre par site), page d'un cœur, page d'une baie.
const dc = produire(datacenter, { jeu: 'illus', abreger: true, placeLien: 'peripherique' });
const SOURCE = 'datacenter.csv';
pages.push({ ...meta('dc_ensemble', 'Data centers jumeaux : vue d\'ensemble (CSV 3 colonnes)', 'A3', 'Deux data centers en haute disponibilité : cœurs reliés entre les sites, 48 commutateurs de baie',
    sousTitre(SOURCE, 'une page par commutateur, vue d\'ensemble en première page, un cadre par site'),
    `2 sites, 1 cœur par site relié à l'autre, 24 commutateurs de baie par cœur, ${datacenter.lignes.length - 49} serveurs : la vue d'ensemble ne dessine que les commutateurs, avec le nombre de serveurs de chacun.`), code: dc[0].code });
const coeur = dc.find((x) => x.nom === 'Commutateur CŒUR-DC-NORD');
pages.push({ ...meta('dc_coeur', 'Data centers jumeaux : un cœur (CSV 3 colonnes)', 'A3', 'Cœur du site Nord : ses 24 commutateurs de baie et sa liaison vers le site Sud',
    sousTitre(SOURCE, 'page d\'un cœur, commutateurs de baie en rangées'), 'Les commutateurs de baie se rangent comme des périphériques ; l\'autre cœur reste à part.'), code: coeur.code });
const baie = dc.find((x) => x.nom === 'Commutateur SW-NORD-B15');
pages.push({ ...meta('dc_baie', 'Data centers jumeaux : une baie (CSV 3 colonnes)', 'A3', 'Baie SW-NORD-B15 : son cœur au-dessus, ses serveurs en rangées',
    sousTitre(SOURCE, 'page d\'un commutateur, cœur amont rappelé au-dessus, interfaces abrégées'),
    `Une des ${dc.length - 1} pages par commutateur : hyperviseurs ESX, serveurs et NAS, agrégats en trait épais.`), code: baie.code });

// Module « Data center » : 4 colonnes (VLAN), vue d'ensemble sur plusieurs pages (cœurs, puis un site par page)
const dcv = produire(datacenterVlans, { jeu: 'illus', presentation: 'commutateur', parPage: 40, parPageVue: 40, abreger: true, tri: 'lien', placeLien: 'peripherique', vlans: true });
const sousTitreDc = (reglages) => `Module « Data center : vue globale et tous les commutateurs, VLAN » — datacenter-vlans.csv — ${reglages}`;
pages.push({ ...meta('dcv_coeurs', 'Data center : vue globale, les cœurs (VLAN)', 'A4', 'Vue globale du data center : les deux cœurs, leur liaison et ses VLAN',
    sousTitreDc('vue d\'ensemble sur plusieurs pages : d\'abord les cœurs, avec le total de chaque site'),
    `${datacenterVlans.lignes.length} liens, ${dcv.length} pages : cœurs, un site par page, puis la vue de chaque commutateur.`), code: dcv[0].code });
pages.push({ ...meta('dcv_site', 'Data center : vue globale d\'un site (VLAN)', 'A3', 'Vue globale du site Nord : le cœur, ses 36 commutateurs et les VLAN de chaque lien',
    sousTitreDc('une page par site, commutateurs en rangées, nœud VLAN au milieu de chaque lien'), 'Chaque lien passe par un nœud VLAN (icône VLAN, liste des VLAN propagés de la 4e colonne, en plages).'), code: dcv[1].code });
pages.push({ ...meta('dcv_commutateur', 'Data center : un commutateur et ses VLAN', 'A3', 'Commutateur SW-NORD-B01 : son cœur, ses serveurs et les VLAN de chaque lien',
    sousTitreDc('vue d\'un commutateur, cœur amont rappelé au-dessus, trunks des ESX et VLAN d\'accès des serveurs'), 'Une des vues produites automatiquement pour chaque commutateur du data center.'),
    code: dcv.find((x) => x.nom === 'Commutateur SW-NORD-B01').code });

// Trois niveaux en cascade (cœur → distribution → accès) : vue d'un site
const dccR = reseau.produirePagesCommutateurs(datacenterCascade, { jeu: 'illus', presentation: 'commutateur', parPage: 40, parPageVue: 40, abreger: true, tri: 'lien', placeLien: 'peripherique', vlans: true });
const dcc = dccR.pages;
pages.push({ ...meta('dcc_site', 'Data center : trois niveaux de commutateurs', 'A3', 'Site Nord à trois niveaux : cœur, 4 commutateurs de distribution, 24 commutateurs d\'accès',
    'Module « Data center » — datacenter-cascade.csv — commutateurs en cascade, rangées par commutateur de distribution, les deux ports de chaque lien',
    `${dcc.length} pages, dans l'ordre de l'arbre : cœurs, sites, puis cœur, distribution, ses accès, distribution suivante…`), code: dcc[1].code });

// Liaison de bout en bout, relue sur les pages du data center à trois niveaux
const grapheDcc = reseau.grapheReseau(dcc);
const bout = reseau.pageBoutEnBout(grapheDcc, [{ a: 'ESX-N101-01', b: 'ESX-S401-03', couleur: '#e1000f' }, { a: 'ESX-N101-02', b: 'ESX-N203-01', couleur: '#000091', animation: 'rapide' }]);
pages.push({ ...meta('bout_en_bout', 'Bout en bout : deux liaisons à travers le data center', 'A3', 'Deux liaisons de bout en bout entre serveurs : chemins à travers les commutateurs d\'accès, de distribution et les cœurs',
    'Bouton « Bout en bout » de la barre d\'outils — deux équipements, une couleur et un trait animé par liaison ; liaisons fusionnées (passent par des équipements communs), tronçons communs tracés une fois',
    'Rouge : ESX-N101-01 (site Nord) vers ESX-S401-03 (site Sud), par les deux cœurs. Bleu : ESX-N101-02 vers ESX-N203-01, sur le site Nord. Les tronçons communs (accès, distribution, cœur Nord) restent en rouge.'), code: bout.code });

// Import IMC (liens avec sites et locaux) des mêmes data centers : découpage intelligent à 60 équipements par page
const pagesImc = reseau.produirePages(imc, { jeu: 'illus', parPage: 60, placeLien: 'peripherique', tri: 'lien' });
if (pagesImc.alertes.length) throw new Error(pagesImc.alertes.join(' ; '));
const sousTitreImc = (reglages) => `Import « Réseau (HPE IMC, LLDP) » — imc-datacenters.csv — ${reglages}`;
const siteImc = pagesImc.pages.find((x) => x.nom === 'Réseau : DC Nord');
pages.push({ ...meta('imc_site', 'Import IMC : un site découpé (liens IMC)', 'A3', 'Import IMC : site DC Nord, un cadre par salle, un renvoi par commutateur',
    sousTitreImc('60 équipements au plus par page : les serveurs de chaque commutateur partent sur sa page de détail'),
    `${imc.noeuds.length} équipements et ${imc.liaisons.length} liaisons : ${pagesImc.pages.length} pages (vue d'ensemble, une page par site, une page de détail par commutateur).`), code: siteImc.code });
const detailImc = pagesImc.pages.find((x) => x.nom === 'Réseau : DC Nord — SW-NORD-B01');
pages.push({ ...meta('imc_detail', 'Import IMC : page de détail (liens IMC)', 'A3', 'Import IMC : page de détail du commutateur SW-NORD-B01',
    sousTitreImc('le cœur au-dessus, les serveurs en rangées triés par interface, port et débit sous chaque serveur'),
    'Page de détail produite par le découpage : l\'appareil, son voisin amont et ses équipements rattachés.'), code: detailImc.code });

const chemin = new URL('presentation-fusain.fusain.json', racine);
const doc = JSON.parse(readFileSync(chemin, 'utf8'));
doc.pages = doc.pages.filter((x) => !String(x.id).startsWith('p52c_'));
const apres = doc.pages.findIndex((x) => x.id === 'p52_reseau_sites');
if (apres < 0) throw new Error('page « p52_reseau_sites » introuvable');
doc.pages.splice(apres + 1, 0, ...pages);
// Topologie complète du data center à trois niveaux : la liaison de bout en bout de la démonstration atteint tous ses
// équipements, y compris ceux qui n'ont pas de page dans la démonstration
doc.formatVersion = 3;
doc.reseaux = [{ nom: 'datacenter-cascade.csv', ...dccR.topologie }];
// Topologie sur une ligne (des milliers de petits tableaux) : le reste du document garde son indentation
const { reseaux, ...sansReseaux } = doc;
writeFileSync(chemin, JSON.stringify(sansReseaux, null, 2).replace(/\n}$/, `,\n  "reseaux": ${JSON.stringify(reseaux)}\n}`) + '\n');
console.log(`${pages.length} pages de démonstration du module commutateur ; document : ${doc.pages.length} pages.`);
