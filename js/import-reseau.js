// Boîte « Importer un réseau » : choix des fichiers, vérification des colonnes reconnues, options, puis création des pages.
// Toute la logique (lecture, analyse, écriture des schémas) est dans reseau.js ; ici, seulement le formulaire.
import { h, bouton, champSelect, champCase, champTexte, message, modale, ouvrirModale, fermerModale, idUnique } from './dom.js';
import { CHAMPS_LIENS, CHAMPS_EQUIPEMENTS, CATEGORIES_RESEAU, TAILLE_MAX_FICHIER, lireEnregistrements, tableau, analyserReseau, produirePages, lireCommutateurs, produirePagesCommutateurs, TRIS_PERIPHERIQUES, ecrireVlans, nettoyerNom } from './reseau.js';
import { lireRoutesComware, lireAlias, ecrireAlias, produirePagesRoutage } from './routage.js';

const ESSENTIELS_LIENS = ['source', 'portSource', 'cible', 'portCible', 'debit', 'etat', 'siteSource', 'localSource', 'siteCible', 'localCible'];
const ESSENTIELS_EQUIPEMENTS = ['nom', 'ip', 'categorie', 'site', 'local', 'lieu'];
const ACCEPTES = '.csv,.txt,.tsv,.xlsx,.xls,.htm,.html,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// Ce que l'import crée : les schémas (et le réseau, enregistré avec le document), ou le réseau seul, sans aucune page :
// l'utilisateur choisit ensuite, par « Bout en bout », les liaisons à dessiner
const CREATIONS = [['pages', 'Les schémas (pages) et le réseau'], ['reseau', 'Le réseau seulement : équipements et liaisons, sans schéma']];
const AIDE_RESEAU_SEUL = 'Aucune page n\'est créée : les équipements et les liaisons sont enregistrés avec le document. La fenêtre « Bout en bout » s\'ouvre ensuite pour choisir les liaisons à dessiner ; les liaisons qui passent par un même équipement sont fusionnées sur un même schéma.';
const pluriel = (n, mot) => `${n.toLocaleString('fr-FR')} ${mot}${n > 1 ? 's' : ''}`;

// Réseau seul : enregistré sans page, puis fenêtre « Bout en bout »
function importerReseauSeul(ajouterPages, nom, topo, boutEnBout) {
    ajouterPages([], { reseau: { nom: (nom || 'Réseau importé').slice(0, 100), ...topo } });
    message('Réseau importé, sans schéma', `${pluriel(topo.equipements.length, 'équipement')} et ${pluriel(topo.liaisons.length, 'liaison')} enregistrés avec le document à partir de ${nom}. Choisissez les liaisons de bout en bout à dessiner (bouton « Bout en bout »).`, 'success', 8000);
    boutEnBout?.();
}

// ajouterPages(liste de { nom, code, format, orientation }) : fournie par l'application, une seule étape d'annulation
// boutEnBout() : ouvre la fenêtre « Bout en bout », après un import du réseau seul
export function ouvrirImportReseau(ajouterPages, { boutEnBout = null } = {}) {
    const etat = {
        creation: 'pages', liens: null, nomLiens: '', equipements: null, nomEquipements: '', equipementLocal: '',
        options: { jeu: 'illus', regroupement: 'auto', resumer: true, abreger: true, logique: true, sens: 'auto', tri: 'fichier', placeLien: 'peripherique', parPage: 60 },
    };
    const zone = h('div', { class: 'fusain-import-reseau' });
    let resultat = null;

    const champFichier = (libelle, aide, surFichier) => {
        const id = idUnique('fichier');
        const entree = h('input', { class: 'fr-upload', type: 'file', id, accept: ACCEPTES });
        entree.addEventListener('change', async () => {
            const fichier = entree.files[0];
            if (!fichier) return;
            try {
                if (fichier.size > TAILLE_MAX_FICHIER) throw new Error('Le fichier dépasse 30 Mo.');
                const enregistrements = await lireEnregistrements(new Uint8Array(await fichier.arrayBuffer()));
                if (enregistrements.length < 2) throw new Error('Aucune ligne de données n\'a été trouvée dans ce fichier.');
                surFichier(enregistrements, fichier.name);
            } catch (e) {
                entree.value = '';
                message('Fichier illisible', e.message, 'error');
            }
            redessiner();
        });
        return h('div', { class: 'fr-upload-group fr-mb-2w' },
            h('label', { class: 'fr-label', for: id }, libelle, h('span', { class: 'fr-hint-text' }, aide)), entree);
    };

    const fichiers = h('div', {},
        champFichier('Liens entre équipements', 'Export « Gestion des liens » d\'HPE IMC, liens de son API REST ou rapport de voisins LLDP / CDP. CSV, texte tabulé ou Excel (.xlsx). Colonnes facultatives : site et local technique de chaque côté (Left Site, Left Local technique, Right Site, Right Local technique).',
            (e, nom) => { etat.liens = tableau(e, CHAMPS_LIENS); etat.nomLiens = nom; }),
        champFichier('Liste des équipements (facultatif)', 'Export de la liste des équipements : précise la catégorie (icône), l\'adresse IP et l\'emplacement (regroupement par site). Deux colonnes facultatives, « Site » et « Local technique », donnent un regroupement à deux niveaux.',
            (e, nom) => { etat.equipements = tableau(e, CHAMPS_EQUIPEMENTS); etat.nomEquipements = nom; }));

    // Une liste déroulante par champ : la colonne reconnue est présélectionnée, l'utilisateur peut corriger
    const colonnes = (t, champs, essentiels) => {
        const options = [['', '(aucune)'], ...t.colonnes.map((c) => [c, c])];
        const select = ([cle, libelle]) => champSelect(libelle, options, t.association[cle] || '', (v) => {
            if (v) t.association[cle] = v; else delete t.association[cle];
            redessiner();
        });
        const autres = champs.filter(([cle]) => !essentiels.includes(cle));
        return h('div', {},
            h('div', { class: 'fusain-import-reseau__colonnes' }, champs.filter(([cle]) => essentiels.includes(cle)).map(select)),
            h('details', { class: 'fr-mt-1w' }, h('summary', {}, `Autres colonnes (${autres.filter(([cle]) => t.association[cle]).length} reconnues sur ${autres.length})`),
                h('div', { class: 'fusain-import-reseau__colonnes' }, autres.map(select))));
    };

    const o = etat.options;
    const choix = () => h('div', { class: 'fusain-import-reseau__colonnes' },
        champSelect('Icônes', [['illus', 'Illustrées (couleur)'], ['picto', 'Pictogrammes (noir et blanc)']], o.jeu, (v) => { o.jeu = v; redessiner(); }),
        champSelect('Regrouper les équipements', [['auto', 'Automatique'], ['lieu', 'Par site ou emplacement'], ['prefixe', 'Par préfixe du nom (site)'], ['reseau', 'Par sous-réseau IP (/24)'], ['aucun', 'Sans regroupement']],
            o.regroupement, (v) => { o.regroupement = v; redessiner(); }),
        champCase('Résumer les terminaux d\'un même commutateur (« 12 téléphones IP »)', o.resumer, (v) => { o.resumer = v; redessiner(); }),
        champCase('Abréger les interfaces (GigabitEthernet1/0/1 → GE1/0/1)', o.abreger, (v) => { o.abreger = v; redessiner(); }),
        champCase('Ajouter les schémas logiques (VLAN), si l\'export les contient', o.logique, (v) => { o.logique = v; redessiner(); }),
        champSelect('Disposition des équipements rattachés à un seul autre', [['auto', 'Automatique (en rangées au-delà de 12)'], ['rangees', 'Dessous, en rangées'], ['TD', 'Dessous, sur une seule rangée'],
            ['LR', 'À droite, sur une seule colonne'], ['colonnes', 'À droite, en plusieurs colonnes']], o.sens, (v) => { o.sens = v; redessiner(); }),
        champSelect('Ordre de ces équipements', [['fichier', 'Ordre du fichier'], ['lien', 'Interface (G1/0/2 avant G1/0/10)'], ['nom', 'Nom de l\'équipement']], o.tri, (v) => { o.tri = v; redessiner(); }),
        champSelect('Nom du lien', [['trait', 'Sur le trait'], ['peripherique', 'Sous l\'équipement rattaché (plus lisible)'], ['aucun', 'Ne pas l\'écrire']], o.placeLien, (v) => { o.placeLien = v; redessiner(); }),
        champSelect('Équipements au plus par page', [['0', 'Sans limite'], ...[30, 40, 60, 80, 100, 150].map((n) => [String(n), `${n} : au-delà, pages de détail`])], String(o.parPage), (v) => { o.parPage = Number(v); redessiner(); }));

    const bilan = () => {
        resultat = null;
        const a = etat.liens.association;
        if (!a.cible && !a.chassis && !a.ipCible) return h('p', { class: 'fr-error-text' }, 'Indiquez la colonne de l\'équipement côté B (le voisin).');
        if (!a.source && !etat.equipementLocal.trim()) return h('p', { class: 'fr-error-text' }, 'Indiquez la colonne de l\'équipement côté A, ou le nom de l\'équipement qui a produit le rapport.');
        const graphe = analyserReseau(etat.liens, etat.equipements, { equipementLocal: etat.equipementLocal.trim() });
        if (!graphe.liaisons.length) return h('p', { class: 'fr-error-text' }, 'Aucune liaison n\'a pu être lue avec ces colonnes.');
        resultat = produirePages(graphe, { ...o, logique: o.logique && graphe.avecVlans });
        if (etat.creation === 'reseau') {
            return h('div', { class: 'fr-callout fr-py-2w fr-px-3w' },
                h('p', { class: 'fr-callout__text fr-text--sm' }, `${graphe.bilan.lignes} lignes lues : ${pluriel(resultat.topologie.equipements.length, 'équipement')} et ${pluriel(resultat.topologie.liaisons.length, 'liaison')} à enregistrer, sans page.`),
                h('p', { class: 'fr-text--xs fr-mb-0' }, AIDE_RESEAU_SEUL));
        }
        const parCategorie = new Map();
        for (const x of graphe.noeuds) parCategorie.set(x.categorie, (parCategorie.get(x.categorie) || 0) + 1);
        const { lignes, doublons, ignorees } = graphe.bilan;
        return h('div', { class: 'fr-callout fr-py-2w fr-px-3w' },
            h('p', { class: 'fr-callout__text fr-text--sm' },
                `${lignes} lignes lues : ${graphe.noeuds.length} équipements, ${graphe.liaisons.length} liaisons`
                + `${doublons ? `, ${doublons} doublon${doublons > 1 ? 's' : ''} écarté${doublons > 1 ? 's' : ''}` : ''}${ignorees ? `, ${ignorees} ligne${ignorees > 1 ? 's' : ''} sans équipement ignorée${ignorees > 1 ? 's' : ''}` : ''}.`),
            h('p', { class: 'fr-text--sm fr-mb-1w' }, [...parCategorie].sort((p, q) => q[1] - p[1]).map(([c, n]) => `${n} ${n > 1 ? CATEGORIES_RESEAU[c].pluriel : CATEGORIES_RESEAU[c].nom.toLowerCase()}`).join(' · ')),
            h('p', { class: 'fr-text--sm fr-mb-1w' }, `${resultat.pages.length} page${resultat.pages.length > 1 ? 's' : ''} : ${resultat.pages.slice(0, 8).map((p) => p.nom).join(', ')}${resultat.pages.length > 8 ? `, … et ${resultat.pages.length - 8} autres` : ''}.`),
            o.parPage && resultat.pages.some((p) => / — /.test(p.nom)) ? h('p', { class: 'fr-text--xs fr-mb-1w' }, 'Les équipements des appareils les plus chargés sont sur des pages de détail ; un renvoi « → page « … » » les remplace sur la page d\'origine.') : null,
            o.logique && !graphe.avecVlans ? h('p', { class: 'fr-text--xs fr-mb-0' }, 'Pas de schéma logique : l\'export ne contient pas de VLAN.') : null,
            resultat.alertes.map((t) => h('p', { class: 'fr-text--xs fr-mb-0' }, t)));
    };

    const creer = bouton('Créer les pages', { icone: 'add-line', variante: 'primary', taille: 'md', onclick: () => {
        if (!resultat) return;
        fermerModale(dialogue);
        if (etat.creation === 'reseau') return importerReseauSeul(ajouterPages, etat.nomLiens, resultat.topologie, boutEnBout);
        ajouterPages(resultat.pages.map((p) => ({ nom: p.nom.slice(0, 100), code: p.code, format: p.equipements > 30 ? 'A3' : 'A4', orientation: 'paysage' })),
            { reseau: { nom: (etat.nomLiens || 'Réseau importé').slice(0, 100), ...resultat.topologie } });
        message('Réseau importé', `${resultat.pages.length} page${resultat.pages.length > 1 ? 's' : ''} ajoutée${resultat.pages.length > 1 ? 's' : ''} à partir de ${etat.nomLiens}. Chaque schéma reste modifiable.`, 'success', 6000);
    } });

    function redessiner() {
        const parties = [];
        if (etat.liens) {
            parties.push(h('h2', { class: 'fr-h6 fr-mb-1w fr-mt-2w' }, `Colonnes de « ${etat.nomLiens} »`), colonnes(etat.liens, CHAMPS_LIENS, ESSENTIELS_LIENS));
            if (!etat.liens.association.source) {
                parties.push(champTexte('Équipement qui a produit le rapport (s\'il n\'y a pas de colonne côté A)', etat.equipementLocal, (v) => { etat.equipementLocal = v; redessiner(); }));
            }
        }
        if (etat.equipements) parties.push(h('h2', { class: 'fr-h6 fr-mb-1w fr-mt-2w' }, `Colonnes de « ${etat.nomEquipements} »`), colonnes(etat.equipements, CHAMPS_EQUIPEMENTS, ESSENTIELS_EQUIPEMENTS));
        if (etat.liens) {
            parties.push(h('h2', { class: 'fr-h6 fr-mb-1w fr-mt-2w' }, 'À créer'),
                champSelect('Créer', CREATIONS, etat.creation, (v) => { etat.creation = v; redessiner(); }));
            if (etat.creation === 'pages') parties.push(h('h2', { class: 'fr-h6 fr-mb-1w fr-mt-2w' }, 'Présentation'), choix());
            else parties.push(h('div', { class: 'fusain-import-reseau__colonnes' },
                champSelect('Icônes', [['illus', 'Illustrées (couleur)'], ['picto', 'Pictogrammes (noir et blanc)']], o.jeu, (v) => { o.jeu = v; redessiner(); }),
                champCase('Abréger les interfaces (GigabitEthernet1/0/1 → GE1/0/1)', o.abreger, (v) => { o.abreger = v; redessiner(); })));
            parties.push(h('h2', { class: 'fr-h6 fr-mb-1w fr-mt-2w' }, 'Résultat'), bilan());
        } else resultat = null;
        creer.disabled = !resultat;
        creer.textContent = etat.creation === 'reseau' ? 'Importer le réseau' : 'Créer les pages';
        zone.replaceChildren(...parties);
    }

    const dialogue = modale('fusain-modale-import-reseau', 'Importer un réseau', h('div', {},
        h('p', { class: 'fr-text--sm' }, 'Les schémas physiques (et logiques, si les VLAN sont connus) sont construits à partir d\'exports tabulaires. Les fichiers sont lus dans le navigateur, sans envoi.'),
        fichiers, zone), [creer]);
    redessiner();
    ouvrirModale(dialogue);
}

// Boîte « Commutateur et périphériques » : fichier à trois colonnes (commutateur, lien, périphérique), sans intitulés imposés
// datacenter : module « Data center » : même fichier (4e colonne VLAN facultative), réglé pour tout le data center :
// vue d'ensemble sur une ou plusieurs pages, puis les vues de tous les commutateurs, découpées au besoin
export function ouvrirImportCommutateurs(ajouterPages, { datacenter = false, boutEnBout = null } = {}) {
    const etat = { creation: 'pages', enregistrements: null, nom: '', entete: 'auto', limiter: datacenter, vlansChoisis: null, options: { jeu: 'illus', presentation: datacenter ? 'commutateur' : 'auto', sens: 'auto', liens: true, abreger: datacenter, encadrer: true, parType: false, parPage: datacenter ? 40 : 0, tri: datacenter ? 'lien' : 'fichier', placeLien: 'peripherique', ensemble: true, amont: true, vlans: false, parPageVue: datacenter ? 40 : 0 } };
    const o = etat.options;
    const zone = h('div', { class: 'fusain-import-reseau' });
    let resultat = null;
    const id = idUnique('fichier');
    const entree = h('input', { class: 'fr-upload', type: 'file', id, accept: ACCEPTES });
    entree.addEventListener('change', async () => {
        const fichier = entree.files[0];
        if (!fichier) return;
        try {
            if (fichier.size > TAILLE_MAX_FICHIER) throw new Error('Le fichier dépasse 30 Mo.');
            const enregistrements = await lireEnregistrements(new Uint8Array(await fichier.arrayBuffer()));
            if (!enregistrements.length) throw new Error('Aucune ligne n\'a été trouvée dans ce fichier.');
            etat.enregistrements = enregistrements;
            etat.nom = fichier.name;
            etat.entete = 'auto';
        } catch (e) {
            entree.value = '';
            etat.enregistrements = null;
            message('Fichier illisible', e.message, 'error');
        }
        redessiner();
    });

    const creer = bouton('Créer les pages', { icone: 'add-line', variante: 'primary', taille: 'md', onclick: () => {
        if (!resultat) return;
        fermerModale(dialogue);
        if (etat.creation === 'reseau') return importerReseauSeul(ajouterPages, etat.nom, resultat.topologie, boutEnBout);
        ajouterPages(resultat.pages.map((p) => ({ nom: p.nom.slice(0, 100), code: p.code, format: p.equipements > 20 ? 'A3' : 'A4', orientation: 'paysage' })),
            { reseau: { nom: (etat.nom || 'Réseau importé').slice(0, 100), ...resultat.topologie } });
        message('Commutateurs importés', `${resultat.pages.length} page${resultat.pages.length > 1 ? 's' : ''} ajoutée${resultat.pages.length > 1 ? 's' : ''} à partir de ${etat.nom}. Chaque schéma reste modifiable.`, 'success', 6000);
    } });

    function redessiner() {
        resultat = null;
        const parties = [];
        if (etat.enregistrements) {
            const lu = lireCommutateurs(etat.enregistrements, { entete: etat.entete });
            const apercu = lu.lignes.slice(0, 5);
            // VLAN : affichés d'office si le fichier en porte, sauf choix contraire
            o.vlans = lu.avecVlans && etat.vlansChoisis !== false;
            parties.push(
                h('h2', { class: 'fr-h6 fr-mb-1w fr-mt-2w' }, `Contenu de « ${etat.nom} »`),
                champCase('La première ligne contient les intitulés des colonnes', lu.entete, (v) => { etat.entete = v; redessiner(); }),
                h('div', { class: 'fr-table fr-table--sm fr-mb-1w' }, h('table', {},
                    h('thead', {}, h('tr', {}, ['Commutateur (col. 1)', 'Lien (col. 2)', 'Périphérique (col. 3)', ...(lu.avecVlans ? ['VLAN (col. 4)'] : [])].map((t) => h('th', { scope: 'col' }, t)))),
                    h('tbody', {}, apercu.map((l) => h('tr', {}, [l.commutateur, l.lien, l.peripherique, ...(lu.avecVlans ? [l.vlans.size ? ecrireVlans(l.vlans) : '—'] : [])].map((t) => h('td', {}, t))))))),
                lu.lignes.length > apercu.length ? h('p', { class: 'fr-text--xs' }, `… et ${lu.lignes.length - apercu.length} autre${lu.lignes.length - apercu.length > 1 ? 's' : ''} ligne${lu.lignes.length - apercu.length > 1 ? 's' : ''}.`) : null,
                h('h2', { class: 'fr-h6 fr-mb-1w fr-mt-2w' }, 'À créer'),
                champSelect('Créer', CREATIONS, etat.creation, (v) => { etat.creation = v; redessiner(); }));
            if (etat.creation === 'reseau') {
                parties.push(h('div', { class: 'fusain-import-reseau__colonnes' },
                    champSelect('Icônes', [['illus', 'Illustrées (couleur)'], ['picto', 'Pictogrammes (noir et blanc)']], o.jeu, (v) => { o.jeu = v; redessiner(); }),
                    champCase('Abréger les interfaces (GigabitEthernet1/0/1 → GE1/0/1)', o.abreger, (v) => { o.abreger = v; redessiner(); })),
                h('h2', { class: 'fr-h6 fr-mb-1w fr-mt-2w' }, 'Résultat'));
            } else parties.push(
                h('h2', { class: 'fr-h6 fr-mb-1w fr-mt-2w' }, 'Présentation'),
                h('div', { class: 'fusain-import-reseau__colonnes' },
                    champSelect('Icônes', [['illus', 'Illustrées (couleur)'], ['picto', 'Pictogrammes (noir et blanc)']], o.jeu, (v) => { o.jeu = v; redessiner(); }),
                    champSelect('Pages', [['auto', 'Automatique'], ['unique', 'Tous les commutateurs sur une page'], ['commutateur', 'Une page par commutateur'],
                        ['commutateur-pages', 'Une page par commutateur, sur plusieurs pages s\'il a trop de périphériques']],
                    o.parPage ? 'commutateur-pages' : o.presentation, (v) => {
                        etat.limiter = v === 'commutateur-pages';
                        o.presentation = etat.limiter ? 'commutateur' : v;
                        o.parPage = etat.limiter ? (o.parPage || 24) : 0;
                        redessiner();
                    }),
                    etat.limiter ? champSelect('Périphériques au plus par page', [8, 12, 16, 20, 24, 32, 40, 48].map((n) => [String(n), String(n)]), String(o.parPage || 24), (v) => { o.parPage = Number(v); redessiner(); }) : null,
                    champSelect('Ordre des périphériques', TRIS_PERIPHERIQUES, o.tri, (v) => { o.tri = v; redessiner(); }),
                    champSelect('Disposition', [['auto', 'Automatique (en rangées au-delà de 12)'], ['rangees', 'Sous le commutateur, en rangées'], ['TD', 'Sous le commutateur, sur une seule rangée'], ['LR', 'À droite du commutateur, sur une seule colonne'], ['colonnes', 'À droite du commutateur, en plusieurs colonnes']], o.sens, (v) => { o.sens = v; redessiner(); }),
                    champSelect('Nom du lien', [['trait', 'Sur le trait'], ['peripherique', 'Sous le nom du périphérique (plus lisible)'], ['aucun', 'Ne pas l\'écrire']],
                        o.liens ? o.placeLien : 'aucun', (v) => { o.liens = v !== 'aucun'; if (o.liens) o.placeLien = v; redessiner(); }),
                    champCase('Abréger les interfaces (GigabitEthernet1/0/1 → GE1/0/1)', o.abreger, (v) => { o.abreger = v; redessiner(); }),
                    champCase('Encadrer chaque commutateur avec ses périphériques (page unique)', o.encadrer, (v) => { o.encadrer = v; redessiner(); })),
                champCase('Séparer les agrégats et les liens simples (une page pour chaque type)', o.parType, (v) => { o.parType = v; redessiner(); }),
                champCase('Pages par commutateur : vue d\'ensemble des commutateurs en première page', o.ensemble, (v) => { o.ensemble = v; redessiner(); }),
                champCase('Pages par commutateur : rappeler en haut de chaque page le ou les commutateurs amont (cœur de réseau)', o.amont, (v) => { o.amont = v; redessiner(); }),
                o.ensemble ? champSelect('Vue d\'ensemble : commutateurs au plus par page', [['0', 'Une seule page'], ...[20, 30, 40, 60, 80].map((n) => [String(n), `${n} : au-delà, une page des cœurs puis une page par site`])], String(o.parPageVue), (v) => { o.parPageVue = Number(v); redessiner(); }) : null,
                champCase(lu.avecVlans ? 'Indiquer sur chaque lien les VLAN propagés (icône VLAN et liste de la colonne 4)' : 'Indiquer les VLAN propagés : le fichier n\'a pas de 4e colonne VLAN',
                    o.vlans, (v) => { etat.vlansChoisis = v; redessiner(); }, lu.avecVlans ? {} : { disabled: true }),
                o.parType || o.parPage ? h('p', { class: 'fr-text--xs' }, `Chaque commutateur a ses propres pages${o.parPage ? `, de ${o.parPage} périphériques au plus` : ''}${o.parType ? ', agrégats et liens simples séparés' : ''} ; le commutateur est repris en haut de chacune.`) : null,
                h('h2', { class: 'fr-h6 fr-mb-1w fr-mt-2w' }, 'Résultat'));
            if (!lu.lignes.length) {
                parties.push(h('p', { class: 'fr-error-text' }, 'Aucune ligne utilisable : il faut un commutateur en colonne 1 et un périphérique en colonne 3.'));
            } else {
                resultat = produirePagesCommutateurs(lu, o);
                const { ignorees, doublons, colonnesEnTrop } = lu.bilan;
                if (etat.creation === 'reseau') {
                    parties.push(h('div', { class: 'fr-callout fr-py-2w fr-px-3w' },
                        h('p', { class: 'fr-callout__text fr-text--sm' }, `${pluriel(lu.lignes.length, 'ligne')} : ${pluriel(resultat.topologie.equipements.length, 'équipement')} (dont ${pluriel(resultat.commutateurs, 'commutateur')}) et ${pluriel(resultat.topologie.liaisons.length, 'liaison')} à enregistrer, sans page`
                            + `${doublons ? `, ${doublons} doublon${doublons > 1 ? 's' : ''} écarté${doublons > 1 ? 's' : ''}` : ''}${ignorees ? `, ${ignorees} ligne${ignorees > 1 ? 's' : ''} incomplète${ignorees > 1 ? 's' : ''} ignorée${ignorees > 1 ? 's' : ''}` : ''}.`),
                        h('p', { class: 'fr-text--xs fr-mb-0' }, AIDE_RESEAU_SEUL)));
                } else parties.push(h('div', { class: 'fr-callout fr-py-2w fr-px-3w' },
                    h('p', { class: 'fr-callout__text fr-text--sm' }, `${lu.lignes.length} liaison${lu.lignes.length > 1 ? 's' : ''} : ${resultat.commutateurs} commutateur${resultat.commutateurs > 1 ? 's' : ''}, ${resultat.equipements} équipements en tout`
                        + `${doublons ? `, ${doublons} doublon${doublons > 1 ? 's' : ''} écarté${doublons > 1 ? 's' : ''}` : ''}${ignorees ? `, ${ignorees} ligne${ignorees > 1 ? 's' : ''} incomplète${ignorees > 1 ? 's' : ''} ignorée${ignorees > 1 ? 's' : ''}` : ''}.`),
                    h('p', { class: 'fr-text--sm fr-mb-1w' }, `${resultat.pages.length} page${resultat.pages.length > 1 ? 's' : ''} : ${resultat.pages.slice(0, 8).map((p) => p.nom).join(', ')}${resultat.pages.length > 8 ? '…' : ''}.`),
                    h('p', { class: 'fr-text--xs fr-mb-0' }, 'Les agrégats de liens (Bridge-Aggregation, Port-channel…) sont tracés en trait épais.'),
                    resultat.fusions ? h('p', { class: 'fr-text--xs fr-mb-0' }, `${resultat.fusions} lien${resultat.fusions > 1 ? 's' : ''} entre commutateurs décrit${resultat.fusions > 1 ? 's' : ''} des deux côtés : un seul trait, avec les deux ports (côté parent – côté fils).`) : null,
                    colonnesEnTrop ? h('p', { class: 'fr-text--xs fr-mb-0' }, 'Le fichier a plus de quatre colonnes : seules les quatre premières sont lues (la 4e : VLAN).') : null,
                    lu.bilan.vlansIllisibles ? h('p', { class: 'fr-text--xs fr-mb-0' }, `${lu.bilan.vlansIllisibles} ligne${lu.bilan.vlansIllisibles > 1 ? 's' : ''} : colonne 4 sans numéro de VLAN lisible (attendu : « 10,20,100-110 »).`) : null,
                    resultat.alertes.map((t) => h('p', { class: 'fr-text--xs fr-mb-0' }, t))));
            }
        }
        creer.disabled = !resultat;
        creer.textContent = etat.creation === 'reseau' ? 'Importer le réseau' : 'Créer les pages';
        zone.replaceChildren(...parties.filter(Boolean));
    }

    const dialogue = modale(datacenter ? 'fusain-modale-import-datacenter' : 'fusain-modale-import-commutateurs', datacenter ? 'Data center : vue globale et tous les commutateurs' : 'Commutateur et périphériques', h('div', {},
        h('p', { class: 'fr-text--sm' }, `Un fichier à trois ou quatre colonnes, une ligne par lien : colonne 1, le nom du commutateur ; colonne 2, le nom du lien (port, agrégat…) ; colonne 3, le nom du périphérique ou du commutateur relié ; colonne 4 (facultative), les VLAN propagés sur le lien (« 10,20,100-110 »). Les noms peuvent contenir n'importe quel caractère. Le fichier est lu dans le navigateur, sans envoi.${datacenter ? ' Le data center est dessiné en entier : une vue d\'ensemble (sur plusieurs pages si besoin, une page des cœurs puis une page par site), puis la vue de chaque commutateur, découpée au-delà de 40 périphériques.' : ''}`),
        h('div', { class: 'fr-upload-group fr-mb-2w' },
            h('label', { class: 'fr-label', for: id }, 'Fichier', h('span', { class: 'fr-hint-text' }, 'CSV (point-virgule, virgule ou tabulation), texte tabulé ou Excel (.xlsx). Première ligne d\'intitulés facultative.')), entree),
        zone), [creer]);
    redessiner();
    ouvrirModale(dialogue);
}

// Boîte « Routage d'un commutateur Comware » : configuration collée ou chargée (lignes « ip route-static »), alias des
// prochains sauts et des sous-réseaux (« IP = nom », « réseau/longueur = nom »), gardés avec le document.
// alias : paires [clé, nom] du document ; ajouterPages(pages, { alias }) les remplace par celles de la boîte.
const ACCEPTES_CONFIG = '.txt,.cfg,.conf,.log,text/plain';
const ATTENTE_SAISIE = 300;
export function ouvrirImportRoutage(ajouterPages, { alias = [] } = {}) {
    const etat = { config: '', alias: ecrireAlias(alias), commutateur: '', nomSaisi: false, nomFichier: '', options: { presentation: 'ensemble-vrf', jeu: 'illus', descriptions: true, parPage: 60 } };
    const o = etat.options;
    const plur = (n, un, plusieurs = `${un}s`) => `${n.toLocaleString('fr-FR')} ${n > 1 ? plusieurs : un}`;
    const zone = h('div', { class: 'fusain-import-reseau' });
    let resultat = null;
    let attente = null;
    const plusTard = () => { clearTimeout(attente); attente = setTimeout(redessiner, ATTENTE_SAISIE); };

    const idConfig = idUnique('config');
    const config = h('textarea', { class: 'fr-input fusain-import-routage__texte', id: idConfig, rows: 8, spellcheck: 'false', autocomplete: 'off', placeholder: 'ip route-static vpn-instance VRF_PROD 10.10.10.0 255.255.255.0 192.168.254.1 description via FW-PROD' });
    config.addEventListener('input', () => { etat.config = config.value; plusTard(); });
    const idFichier = idUnique('fichier');
    const entree = h('input', { class: 'fr-upload', type: 'file', id: idFichier, accept: ACCEPTES_CONFIG });
    entree.addEventListener('change', async () => {
        const fichier = entree.files[0];
        if (!fichier) return;
        try {
            if (fichier.size > TAILLE_MAX_FICHIER) throw new Error('Le fichier dépasse 30 Mo.');
            etat.config = config.value = await fichier.text();
            etat.nomFichier = fichier.name;
        } catch (e) {
            message('Fichier illisible', e.message, 'error');
        }
        entree.value = '';
        redessiner();
    });
    const idNom = idUnique('nom');
    const nom = h('input', { class: 'fr-input', id: idNom, type: 'text', maxlength: 120, autocomplete: 'off' });
    nom.addEventListener('input', () => { etat.commutateur = nom.value; etat.nomSaisi = !!nom.value.trim(); plusTard(); });
    const idAlias = idUnique('alias');
    const zoneAlias = h('textarea', { class: 'fr-input fusain-import-routage__texte', id: idAlias, rows: 6, spellcheck: 'false', autocomplete: 'off', placeholder: '192.168.254.1 = FW-PROD-ACTIF\n10.10.10.0/24 = Applications métier' });
    zoneAlias.value = etat.alias;
    zoneAlias.addEventListener('input', () => { etat.alias = zoneAlias.value; plusTard(); });

    const fixe = h('div', {},
        h('div', { class: 'fr-input-group' },
            h('label', { class: 'fr-label', for: idConfig }, 'Configuration du commutateur',
                h('span', { class: 'fr-hint-text' }, 'Collez le résultat de « display current-configuration », ou seulement les lignes « ip route-static » (« display current-configuration | include route-static »). Les autres lignes sont ignorées.')),
            config),
        h('div', { class: 'fr-upload-group fr-mb-2w' },
            h('label', { class: 'fr-label', for: idFichier }, 'Ou chargez un fichier de configuration', h('span', { class: 'fr-hint-text' }, 'Texte : .txt, .cfg, .conf, .log.')), entree),
        h('div', { class: 'fr-input-group' },
            h('label', { class: 'fr-label', for: idNom }, 'Nom du commutateur', h('span', { class: 'fr-hint-text' }, 'Repris de la ligne « sysname » de la configuration, s\'il y en a une.')), nom),
        h('div', { class: 'fr-input-group' },
            h('label', { class: 'fr-label', for: idAlias }, 'Alias des prochains sauts et des sous-réseaux routés',
                h('span', { class: 'fr-hint-text' }, 'Une ligne par alias : « 192.168.254.1 = FW-PROD-ACTIF », « 10.10.10.0/24 = Applications métier » ou « 10.10.20.0 255.255.254.0 = Bases Oracle ». « # » en début de ligne : commentaire. Les alias sont enregistrés avec le document et proposés au prochain import.')),
            zoneAlias));

    const creer = bouton('Créer les pages', { icone: 'add-line', variante: 'primary', taille: 'md', onclick: () => {
        if (!resultat) return;
        fermerModale(dialogue);
        ajouterPages(resultat.pages.map((p) => ({ nom: p.nom, code: p.code, format: p.equipements > 30 ? 'A3' : 'A4', orientation: 'paysage' })), { alias: [...resultat.alias] });
        message('Routage importé', `${plur(resultat.pages.length, 'page')} ajoutée${resultat.pages.length > 1 ? 's' : ''} pour ${resultat.commutateur}. Chaque schéma reste modifiable ; les alias sont gardés avec le document.`, 'success', 6000);
    } });

    function redessiner() {
        clearTimeout(attente);
        resultat = null;
        const parties = [];
        const lu = lireRoutesComware(etat.config);
        if (!etat.nomSaisi) nom.value = etat.commutateur = lu.commutateur;
        const { alias: table, invalides: aliasInvalides } = lireAlias(etat.alias);
        if (etat.config.trim()) {
            const { bilan } = lu;
            parties.push(h('h2', { class: 'fr-h6 fr-mb-1w fr-mt-2w' }, 'Présentation'),
                h('div', { class: 'fusain-import-reseau__colonnes' },
                    champSelect('Pages', [['ensemble-vrf', 'Vue d\'ensemble, puis une page par VRF'], ['vrf', 'Une page par VRF'], ['unique', 'Tout sur une seule page']], o.presentation, (v) => { o.presentation = v; redessiner(); }),
                    champSelect('Icônes', [['illus', 'Illustrées (couleur)'], ['picto', 'Pictogrammes (noir et blanc)']], o.jeu, (v) => { o.jeu = v; redessiner(); }),
                    o.presentation === 'unique' ? null : champSelect('Sous-réseaux au plus par page', [['0', 'Sans limite'], ...[20, 30, 40, 60, 80].map((n) => [String(n), `${n} : au-delà, une page par prochain saut`])], String(o.parPage), (v) => { o.parPage = Number(v); redessiner(); }),
                    champCase('Écrire la description de chaque route sur son trait', o.descriptions, (v) => { o.descriptions = v; redessiner(); })),
                h('h2', { class: 'fr-h6 fr-mb-1w fr-mt-2w' }, 'Résultat'));
            if (!lu.routes.length) {
                parties.push(h('p', { class: 'fr-error-text' }, bilan.lignes ? 'Aucune route lisible : voir les lignes refusées ci-dessous.' : 'Aucune ligne « ip route-static » n\'a été trouvée.'));
            } else {
                const r = produirePagesRoutage({ commutateur: etat.commutateur, routes: lu.routes }, table, o);
                resultat = { ...r, alias: table, commutateur: nettoyerNom(etat.commutateur) || 'Commutateur' };
                const inconnus = [...table.keys()].filter((k) => !r.bilan.aliasUtilises.has(k));
                const apercu = lu.routes.slice(0, 5);
                parties.push(
                    h('div', { class: 'fr-table fr-table--sm fr-mb-1w' }, h('table', {},
                        h('thead', {}, h('tr', {}, ['VRF', 'Sous-réseau', 'Prochain saut', 'Description'].map((t) => h('th', { scope: 'col' }, t)))),
                        h('tbody', {}, apercu.map((x) => h('tr', {}, [x.vrf || 'globale', [x.cidr, table.get(x.cidr) || (x.longueur < 32 ? table.get(x.reseau) : '')].filter(Boolean).join(' · '),
                            [x.nh || x.interface, x.nh && table.get(x.nh)].filter(Boolean).join(' · '), x.description || '—'].map((t) => h('td', {}, t))))))),
                    lu.routes.length > apercu.length ? h('p', { class: 'fr-text--xs' }, `… et ${plur(lu.routes.length - apercu.length, 'autre route')}.`) : null,
                    h('div', { class: 'fr-callout fr-py-2w fr-px-3w' },
                        h('p', { class: 'fr-callout__text fr-text--sm' }, `${plur(lu.routes.length, 'route')} : ${plur(r.bilan.vrfs, 'table')} (VRF ou table globale), ${plur(r.bilan.sauts, 'prochain saut', 'prochains sauts')}, ${plur(r.bilan.reseaux, 'sous-réseau routé', 'sous-réseaux routés')} ; ${plur(r.bilan.aliasUtilises.size, 'alias utilisé', 'alias utilisés')}`
                            + `${bilan.doublons ? `, ${plur(bilan.doublons, 'doublon écarté', 'doublons écartés')}` : ''}.`),
                        h('p', { class: 'fr-text--sm fr-mb-1w' }, `${plur(r.pages.length, 'page')} : ${r.pages.slice(0, 8).map((p) => p.nom).join(', ')}${r.pages.length > 8 ? '…' : ''}.`),
                        h('p', { class: 'fr-text--xs fr-mb-0' }, 'Une route de secours (préférence plus élevée vers un même sous-réseau) est tracée en pointillé.'),
                        bilan.corrigees.length ? h('p', { class: 'fr-text--xs fr-mb-0' }, `Adresse de réseau corrigée (bits d'hôte) : ${bilan.corrigees.slice(0, 5).map((c) => `ligne ${c.ligne} → ${c.cidr}`).join(', ')}${bilan.corrigees.length > 5 ? '…' : ''}.`) : null,
                        inconnus.length ? h('p', { class: 'fr-text--xs fr-mb-0' }, `${plur(inconnus.length, 'alias ne correspond', 'alias ne correspondent')} à aucune route : ${inconnus.slice(0, 6).join(', ')}${inconnus.length > 6 ? '…' : ''} (gardé${inconnus.length > 1 ? 's' : ''} avec le document).`) : null,
                        r.alertes.map((t) => h('p', { class: 'fr-text--xs fr-mb-0' }, t))));
            }
            const ignorees = [bilan.ipv6 ? plur(bilan.ipv6, 'route IPv6', 'routes IPv6') : '', bilan.undo ? plur(bilan.undo, 'ligne « undo »', 'lignes « undo »') : ''].filter(Boolean);
            if (ignorees.length) parties.push(h('p', { class: 'fr-text--xs fr-mb-0' }, `Ignorées : ${ignorees.join(', ')}.`));
            if (bilan.invalides.length) parties.push(h('p', { class: 'fr-text--xs fr-mb-0 fr-error-text' }, `${plur(bilan.invalides.length, 'ligne refusée', 'lignes refusées')} : ${bilan.invalides.slice(0, 5).map((x) => `ligne ${x.ligne} (${x.erreur})`).join(', ')}${bilan.invalides.length > 5 ? '…' : ''}.`));
        }
        if (aliasInvalides.length) parties.push(h('p', { class: 'fr-text--xs fr-mb-0 fr-error-text' }, `Alias illisibles, ignorés : ${aliasInvalides.slice(0, 5).map((x) => `ligne ${x.ligne} « ${x.texte} »`).join(', ')}${aliasInvalides.length > 5 ? '…' : ''} (attendu : « adresse = nom »).`));
        creer.disabled = !resultat;
        zone.replaceChildren(...parties.filter(Boolean));
    }

    const dialogue = modale('fusain-modale-import-routage', 'Routage d\'un commutateur Comware', h('div', {},
        h('p', { class: 'fr-text--sm' }, 'Les routes statiques (« ip route-static ») d\'un commutateur HPE Comware sont dessinées du commutateur vers chaque prochain saut, puis vers les sous-réseaux routés, un cadre par VRF (vpn-instance). La configuration est lue dans le navigateur, sans envoi.'),
        fixe, zone), [creer]);
    redessiner();
    ouvrirModale(dialogue);
}
