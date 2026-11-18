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
- [illus:livrable] Pages | Tous les commutateurs sur une page, chacun encadré avec ses périphériques ; une page par commutateur ; découpage d'un commutateur chargé (8 à 48 périphériques par page) ; agrégats et liens simples séparés.
- [illus:flux-de-donnees] Ordre des périphériques | Ordre du fichier, nom du lien (G1/0/2 avant G1/0/10), agrégats d'abord, ou nom du serveur, en ordre croissant ou décroissant.
- [illus:organigramme] Nom des liens | Agrégats en trait épais ; nom du lien sous le nom du périphérique, sur le trait ou absent ; interfaces abrégées (GigabitEthernet1/0/1 → GE1/0/1).
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

const chemin = new URL('presentation-fusain.fusain.json', racine);
const doc = JSON.parse(readFileSync(chemin, 'utf8'));
doc.pages = doc.pages.filter((x) => !String(x.id).startsWith('p52c_'));
const apres = doc.pages.findIndex((x) => x.id === 'p52_reseau_sites');
if (apres < 0) throw new Error('page « p52_reseau_sites » introuvable');
doc.pages.splice(apres + 1, 0, ...pages);
writeFileSync(chemin, JSON.stringify(doc, null, 2) + '\n');
console.log(`${pages.length} pages de démonstration du module commutateur ; document : ${doc.pages.length} pages.`);
