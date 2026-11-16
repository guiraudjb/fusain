# FUSAIN

**Fabrique Universelle de Schémas Accessibles, Intuitifs et Normés** — un éditeur visuel de diagrammes [Mermaid](https://mermaid.js.org/), mis en page au format A4 ou A3.

**Utiliser l'application : <https://guiraudjb.github.io/fusain/>**

Hors ligne sous Windows, sans rien installer : double-cliquer `lancer-site-local.bat`. Il lance `serveur-local.ps1`, un serveur web PowerShell local (sans droits d'administrateur, accessible depuis le poste seulement) sur `http://localhost:8090/`, et ouvre le navigateur. Q, Échap ou fermeture de la fenêtre pour l'arrêter. Options : `-Port 9000`, `-SansNavigateur`.

- Construire un schéma à la souris ou au clavier, sans écrire de code ; le code Mermaid reste accessible et modifiable à tout moment.
- Pages A4 ou A3, portrait ou paysage, document multi-pages.
- Export PDF (vectoriel), PNG, SVG et Microsoft Visio (.vsdx, formes modifiables et connecteurs collés) ; sauvegarde et restauration au format JSON.
- **Tous les traitements s'exécutent dans le navigateur** : aucun schéma ne quitte le poste. Aucun serveur applicatif, aucun compte, aucun traceur.
- Application web progressive : installable, utilisable hors ligne.
- Système de Design de l'État (DSFR).

## État d'avancement (bêta)

| Fonction | État |
|---|---|
| Édition visuelle de 34 types Mermaid : logigramme, logigramme en couloirs, flux d'agents, séquence, carte mentale, Gantt, camembert, frise, Kanban, matrice, états, parcours usager, graphique, flux (Sankey), modèle de données, classes, architecture, historique de versions, paquet réseau, C4 (contexte, conteneurs, composants, dynamique, déploiement), blocs, exigences, radar, treemap, ZenUML, Ishikawa, arborescence, Venn, cas d'utilisation, modélisation par événements, diagramme syntaxique, cadre Cynefin, carte de Wardley ; et des diagrammes de séquence PlantUML, sans quitter PlantUML | Disponible |
| Prise en charge native de PlantUML (`@startuml`, `@startmindmap`, `@startwbs`, `@startgantt`, import `.puml`) et conversion vers l'édition visuelle | Disponible |
| Cartes thématiques (moteur de SimpleCarto : du monde à la commune, import CSV, fonds IGN, géocodage BAN hors ligne) | Disponible |
| Import de topologies réseau (HPE IMC, LLDP / CDP en CSV ou Excel `.xlsx`) en schémas physiques et logiques (VLAN) | Disponible |
| 1 038 icônes du DSFR, 54 pictogrammes au trait et 380 icônes illustrées embarquées, pour l'architecture, le logigramme, les cartes et les diapositives | Disponible |
| Mode code avec aperçu en direct, diagnostic des erreurs en français, réparations vérifiées et index des syntaxes pour tous les types Mermaid (dont `usecase`, `eventmodeling`, `agentflow`, `railroad-ebnf`, `cynefin`, `wardley`) | Disponible |
| Diapositives de texte aux mises en page de la charte de l'État (13 modèles) et mode diaporama plein écran (`F5`, zoom sur zone) | Disponible |
| 60 modèles de départ (42 de schémas, 13 de diapositives et 5 de cartes), document de démonstration de 60 pages, page vierge | Disponible |
| Export PDF (vectoriel), PNG, SVG et Visio (`.vsdx`), sauvegarde JSON, brouillon automatique, annuler / rétablir | Disponible |
| Fonctionnement hors ligne | Disponible |

Le détail de ce qui reste à faire figure dans le [cahier des charges](FUSAIN_cahier_des_charges.md), section « État de réalisation ».

## Documentation

- [Guide utilisateur](Documentation/GUIDE_UTILISATEUR.md)
- [Cahier des charges](FUSAIN_cahier_des_charges.md)
- [Journal des versions](JOURNAL_DES_VERSIONS.md) — mesures, essais et corrections de chaque cycle
- [Nomenclature logicielle (SBOM) et méthode de mise à jour](NOMENCLATURE_LOGICIELLE_FUSAIN.md) — version exploitable par machine : [`sbom/fusain-sbom-cyclonedx.json`](sbom/fusain-sbom-cyclonedx.json)
- [Format du fichier de sauvegarde](schema/fusain.schema.json)

## Développement

Aucune étape de build : le code livré est le code écrit (modules ES natifs, bibliothèques embarquées dans `libs/`).

```bash
python3 -m http.server 8765          # servir le dépôt, puis ouvrir http://127.0.0.1:8765/
node --test tests/logique.test.mjs   # tests de logique et de sécurité, sans navigateur
tests/tout.sh                        # recette complète : logique, Chrome, robustesse, Firefox
python3 outils/generer.py            # avant chaque publication : intégrité (SRI), liste du cache, nomenclature
python3 outils/generer.py --verifier # contrôle sans modification (code de sortie 1 en cas d'écart)
python3 outils/veille.py             # vulnérabilités connues des bibliothèques embarquées (OSV.dev)
```

La recette est rejouée par GitHub à chaque modification (`.github/workflows/recette.yml`) et la veille des vulnérabilités le 1er de chaque mois (`veille.yml`).

Pour héberger le dépôt sur un GitLab privé et servir l'application par GitLab Pages : `deploiement/GITLAB.md`.

`outils/generer.py` doit être relancé après toute modification d'un fichier servi : il recalcule les empreintes d'intégrité de `index.html`, la liste et la version du cache du service worker, et la nomenclature CycloneDX.

## Sécurité

Pour un déploiement en production, `deploiement/nginx-fusain.conf` fournit une configuration Nginx posant tous les en-têtes de sécurité.

Sur Debian, le paquet `fusain-server` fait l'ensemble (fichiers, site Nginx, certificat auto-signé de première installation) :

```bash
deploiement/construire-deb.sh                      # produit tests/sortie/fusain-server_<version>_all.deb
sudo apt install ./fusain-server_<version>_all.deb
```

Remplacez ensuite `/etc/fusain/tls/fusain.pem` et `fusain.key` par le certificat de votre organisation. Le paquet désactive le site par défaut de Nginx.

Signaler une vulnérabilité : ouvrir un avis privé depuis l'onglet « Security » du dépôt. Les principes de sécurité (politique de sécurité de contenu, assainissement du SVG, validation des fichiers) sont décrits au §7 du cahier des charges.

## Licences

Le DSFR est distribué sous licence Etalab-2.0, dont l'usage est réservé aux entités administratives. Les licences des bibliothèques embarquées figurent dans leur dossier respectif sous `libs/`. La licence du code propre à FUSAIN reste à fixer.
