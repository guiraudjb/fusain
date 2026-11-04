// Boîte « Importer un réseau » : choix des fichiers, vérification des colonnes reconnues, options, puis création des pages.
// Toute la logique (lecture, analyse, écriture des schémas) est dans reseau.js ; ici, seulement le formulaire.
import { h, bouton, champSelect, champCase, champTexte, message, modale, ouvrirModale, fermerModale, idUnique } from './dom.js';
import { CHAMPS_LIENS, CHAMPS_EQUIPEMENTS, CATEGORIES_RESEAU, TAILLE_MAX_FICHIER, lireEnregistrements, tableau, analyserReseau, produirePages } from './reseau.js';

const ESSENTIELS_LIENS = ['source', 'portSource', 'cible', 'portCible', 'debit', 'etat'];
const ESSENTIELS_EQUIPEMENTS = ['nom', 'ip', 'categorie', 'site', 'local', 'lieu'];
const ACCEPTES = '.csv,.txt,.tsv,.xlsx,.xls,.htm,.html,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// ajouterPages(liste de { nom, code, format, orientation }) : fournie par l'application, une seule étape d'annulation
export function ouvrirImportReseau(ajouterPages) {
    const etat = {
        liens: null, nomLiens: '', equipements: null, nomEquipements: '', equipementLocal: '',
        options: { jeu: 'illus', regroupement: 'auto', resumer: true, abreger: true, logique: true },
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
        champFichier('Liens entre équipements', 'Export « Gestion des liens » d\'HPE IMC, liens de son API REST ou rapport de voisins LLDP / CDP. CSV, texte tabulé ou Excel (.xlsx).',
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
        champCase('Ajouter les schémas logiques (VLAN), si l\'export les contient', o.logique, (v) => { o.logique = v; redessiner(); }));

    const bilan = () => {
        resultat = null;
        const a = etat.liens.association;
        if (!a.cible && !a.chassis && !a.ipCible) return h('p', { class: 'fr-error-text' }, 'Indiquez la colonne de l\'équipement côté B (le voisin).');
        if (!a.source && !etat.equipementLocal.trim()) return h('p', { class: 'fr-error-text' }, 'Indiquez la colonne de l\'équipement côté A, ou le nom de l\'équipement qui a produit le rapport.');
        const graphe = analyserReseau(etat.liens, etat.equipements, { equipementLocal: etat.equipementLocal.trim() });
        if (!graphe.liaisons.length) return h('p', { class: 'fr-error-text' }, 'Aucune liaison n\'a pu être lue avec ces colonnes.');
        resultat = produirePages(graphe, { ...o, logique: o.logique && graphe.avecVlans });
        const parCategorie = new Map();
        for (const x of graphe.noeuds) parCategorie.set(x.categorie, (parCategorie.get(x.categorie) || 0) + 1);
        const { lignes, doublons, ignorees } = graphe.bilan;
        return h('div', { class: 'fr-callout fr-py-2w fr-px-3w' },
            h('p', { class: 'fr-callout__text fr-text--sm' },
                `${lignes} lignes lues : ${graphe.noeuds.length} équipements, ${graphe.liaisons.length} liaisons`
                + `${doublons ? `, ${doublons} doublon${doublons > 1 ? 's' : ''} écarté${doublons > 1 ? 's' : ''}` : ''}${ignorees ? `, ${ignorees} ligne${ignorees > 1 ? 's' : ''} sans équipement ignorée${ignorees > 1 ? 's' : ''}` : ''}.`),
            h('p', { class: 'fr-text--sm fr-mb-1w' }, [...parCategorie].sort((p, q) => q[1] - p[1]).map(([c, n]) => `${n} ${n > 1 ? CATEGORIES_RESEAU[c].pluriel : CATEGORIES_RESEAU[c].nom.toLowerCase()}`).join(' · ')),
            h('p', { class: 'fr-text--sm fr-mb-1w' }, `${resultat.pages.length} page${resultat.pages.length > 1 ? 's' : ''} : ${resultat.pages.map((p) => p.nom).join(', ')}.`),
            o.logique && !graphe.avecVlans ? h('p', { class: 'fr-text--xs fr-mb-0' }, 'Pas de schéma logique : l\'export ne contient pas de VLAN.') : null,
            resultat.alertes.map((t) => h('p', { class: 'fr-text--xs fr-mb-0' }, t)));
    };

    const creer = bouton('Créer les pages', { icone: 'add-line', variante: 'primary', taille: 'md', onclick: () => {
        if (!resultat) return;
        fermerModale(dialogue);
        ajouterPages(resultat.pages.map((p) => ({ nom: p.nom.slice(0, 100), code: p.code, format: p.equipements > 30 ? 'A3' : 'A4', orientation: 'paysage' })));
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
        if (etat.liens) parties.push(h('h2', { class: 'fr-h6 fr-mb-1w fr-mt-2w' }, 'Présentation'), choix(), h('h2', { class: 'fr-h6 fr-mb-1w fr-mt-2w' }, 'Résultat'), bilan());
        else resultat = null;
        creer.disabled = !resultat;
        zone.replaceChildren(...parties);
    }

    const dialogue = modale('fusain-modale-import-reseau', 'Importer un réseau', h('div', {},
        h('p', { class: 'fr-text--sm' }, 'Les schémas physiques (et logiques, si les VLAN sont connus) sont construits à partir d\'exports tabulaires. Les fichiers sont lus dans le navigateur, sans envoi.'),
        fichiers, zone), [creer]);
    redessiner();
    ouvrirModale(dialogue);
}
