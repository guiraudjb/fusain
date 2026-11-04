<!-- title: FUSAIN — Audit de sécurité et revue de code (0.22.0) -->

# Audit de sécurité et revue de code — FUSAIN

| Champ | Valeur |
|---|---|
| Date | 4 novembre 2026 |
| Version auditée | 0.21.2 (commit `946bb843`) ; corrections livrées en 0.22.0 |
| Nature | Audit interne : lecture du code, essais ciblés, interrogation d'OSV.dev. Ce n'est pas un audit externe ni un test d'intrusion. |
| Périmètre | Tout ce qui est servi au navigateur (`index.html`, `sw.js`, `js/`, `css/`), les bibliothèques de `libs/`, les outils (`outils/*.py`), le serveur local Windows, la configuration nginx, l'intégration continue GitHub |
| Documents liés | `NOMENCLATURE_LOGICIELLE_FUSAIN.md` (révision 6) et `sbom/fusain-sbom-cyclonedx.json` (CycloneDX 1.7) |

## 1. Synthèse

FUSAIN reste un logiciel sans serveur applicatif, dont toutes les ressources sont locales et contrôlées par empreinte. Les protections de fond sont en place et ont tenu à l'examen :

- politique de sécurité de contenu stricte (`script-src 'self'`, `default-src 'none'`) ;
- Trusted Types, avec une politique `default` qui assainit tout HTML par DOMPurify ;
- assainissement du SVG de Mermaid avant affichage et export ;
- validation champ par champ des fichiers ouverts ;
- empreintes SHA-256 vérifiées par le service worker avant toute mise en cache ;
- aucune requête vers l'extérieur.

L'audit a relevé **32 constats**, tous corrigés ou documentés dans la 0.22.0. Aucun ne permettait d'exécuter du code dans la page. Les plus importants sont les suivants :

| Gravité | Nombre | Exemples |
|---|---|---|
| Élevée | 2 | Blocage de l'onglet (ReDoS) par une ligne piégée dans le diagnostic ; contournement de la liste blanche de configuration Mermaid |
| Moyenne | 5 | Copie vulnérable de DOMPurify dans l'extension ZenUML (atténuée) ; filtre CSS contourné par des échappements ; image distante par clé `"img"` ; perte du brouillon ; « bombe » ZIP |
| Faible | 25 | Défauts de réécriture des éditeurs visuels, cache nginx, chemins sous Windows, actions GitHub non épinglées, etc. |

Les bibliothèques embarquées ne présentaient aucune vulnérabilité connue. Trois d'entre elles ont été mises à jour : Mermaid 12.3.0, svg2pdf.js 2.9.0 et D3 7.9.2.

## 2. Méthode

1. Revue du dernier commit (0.21.2) par l'outil de revue de code, puis relecture complète du dépôt en deux lots : cœur de l'application, et éditeurs visuels avec les outils. Chaque constat a été vérifié par lecture du code. Le blocage par expression régulière a été chronométré dans Chrome.
2. Audit ciblé des chemins d'injection :
   - insertion du SVG ;
   - directives et en-têtes Mermaid ;
   - formes `@{ … }` ;
   - feuilles de style ;
   - fichiers ouverts : JSON, CSV, classeurs `.xlsx`, `.mmd` ;
   - export Visio ;
   - service worker ;
   - serveur local.
3. Veille : OSV.dev interrogé sur les versions exactes des 8 bibliothèques et des copies internes identifiées dans `mermaid.min.js` et `mermaid-zenuml.min.js`. Le registre npm a été consulté pour les versions plus récentes.
4. Vérification après correction :
   - 51 tests de logique réussis, dont 6 nouveaux ;
   - `outils/generer.py --verifier` sans écart ;
   - nomenclature validée contre le schéma officiel CycloneDX 1.7 ; le validateur a été contrôlé sur un fichier volontairement faux.

   La recette navigateur complète (Chrome, robustesse, fidélité, accessibilité, mise à jour) tourne sur GitHub à la publication.

## 3. Constats de sécurité

| # | Gravité | Constat | Lieu | Correction (0.22.0) |
|---|---|---|---|---|
| S1 | Élevée | **Blocage de l'onglet (ReDoS)**. Certaines expressions du diagnostic ont un coût cubique selon la longueur de la ligne. Une ligne de camembert « `1` + 4 000 espaces + `"` » prend 49,5 s dans Chrome, et le diagnostic s'exécute à chaque erreur de rendu : un fichier reçu figeait l'onglet dès son ouverture. | `js/diagnostic.js` (camembert, treemap, logigramme) | Les lignes de plus de 300 caractères ne passent plus par les règles de réparation. Un test vérifie qu'une ligne de 20 000 caractères est traitée en moins de 2 s. |
| S2 | Élevée | **Liste blanche de configuration contournée**, de deux façons. Mermaid 12.3 accepte un en-tête `--- ` suivi d'espaces, que le filtre ne reconnaissait pas : `htmlLabels`, `logLevel`, etc. passaient. Mermaid lit aussi une directive `%%{init: …}` dont la fermeture `}%%` manque, et le filtre l'ignorait. DOMPurify et la CSP limitaient l'effet. | `js/securite.js` | L'en-tête est reconnu avec la grammaire de Mermaid ; un en-tête ouvert mais jamais fermé est refusé. Un `%%{` non fermé est neutralisé : il devient le commentaire `%% {`. Les tests portent sur les trois cas. |
| S3 | Moyenne, atténuée | **Copie vulnérable de DOMPurify dans l'extension ZenUML**. `mermaid-zenuml.min.js` 1.0.1, dernière version publiée, embarque DOMPurify 3.3.1, visé par 21 avis (OSV.dev). | `libs/mermaid-zenuml-v1.0.1/` | Le risque n'est pas atteignable en l'état :<br>– FUSAIN n'appelle pas cette copie ;<br>– tout HTML inséré passe par la politique Trusted Types, qui l'assainit avec DOMPurify 3.4.17, dans les navigateurs qui l'appliquent ;<br>– la CSP interdit scripts en ligne et gestionnaires d'événements ;<br>– le SVG est assaini une seconde fois.<br>L'analyse est publiée dans la section `vulnerabilities` du CycloneDX (VEX, `not_affected`). La veille contrôle désormais cette copie et signalera tout avis nouveau. À remplacer dès qu'une version corrigée de l'extension paraît. |
| S4 | Moyenne | **Filtre CSS contourné par des échappements**. `\75rl(` vaut `url(`, `@\69mport` vaut `@import`, et `image-set()` n'était pas filtré. Dans l'application, la CSP bloquait la requête. En revanche, un SVG exporté puis ouvert ailleurs aurait pu appeler une adresse extérieure. | `js/securite.js` | Les échappements CSS sont décodés avant le contrôle, pour les attributs comme pour les feuilles de style ; `image-set()` est neutralisé. Test ajouté. |
| S5 | Moyenne | **Image distante par clé entre guillemets**. `A@{ "img": "https://…" }` n'était pas retiré ; seule la CSP `img-src` empêchait la requête. | `js/securite.js` | La clé est reconnue avec ou sans guillemets. Test ajouté. |
| S6 | Moyenne | **« Bombe » ZIP**. La taille d'un fichier extrait d'un `.xlsx` n'était contrôlée qu'après la décompression complète : un classeur très compressible pouvait épuiser la mémoire de l'onglet. | `js/zip.js` | La décompression est interrompue dès que la taille admise est dépassée. Test ajouté. |
| S7 | Faible | **Actions GitHub épinglées par étiquette**, et jeton gardé après `checkout`. | `.github/workflows/*.yml` | Actions épinglées par empreinte de commit (v4.4.0) ; `persist-credentials: false`. |
| S8 | Faible | **Cache nginx d'un jour** sur des adresses non versionnées (`js/app.js`, `css/`, index des cartes) dont l'empreinte est dans `index.html`. Un navigateur sans service worker actif pouvait mêler la nouvelle page et un ancien script, refusé par le contrôle d'intégrité : l'application restait vide jusqu'à 24 h. | `deploiement/nginx-fusain.conf` | `no-cache` (revalidation par ETag) ; cache long et `immutable` réservé à `libs/`, dont les chemins portent la version. |
| S9 | Faible | **Chemin d'écriture tiré d'un fichier source**. Le code INSEE lu dans le CSV de la Base Adresse Nationale servait de nom de fichier sans contrôle. | `outils/adresses.py` | Seul un code INSEE de commune est admis. |
| S10 | Faible | **Outils lancés sous Windows**. Les chemins étaient écrits avec `\`, ce qui donnait un service worker invalide et 35 000 fichiers d'adresses énumérés. | `outils/generer.py`, `outils/cartes.py` | Chemins écrits en `/` (`as_posix()`). |

### Points examinés sans défaut

- **Fichiers ouverts** : la validation champ par champ refuse les clés `__proto__`, `constructor` et `prototype`.
- **Rendu Markdown** des documents joints : aucun HTML n'est interprété, et seuls les liens `#` et `http(s)` sont suivis.
- **Politique Trusted Types** : les chargements de script sont limités à une liste fermée.
- **Export Visio** : échappement XML et structure du paquet.
- **Service worker** : empreintes vérifiées avant mise en cache, nettoyage à l'activation, aucune requête hors de l'origine.
- **Serveur local Windows** : écoute sur `localhost` seulement, protection contre la traversée de chemin.
- **Éditeurs visuels** : aucun libellé ne peut sortir de ses guillemets pour injecter une instruction ou un `click`.

## 4. Constats de fonctionnement (revue de code)

| # | Constat | Lieu | Correction |
|---|---|---|---|
| F1 | La relecture automatique du CSV après un changement de zone se déclenchait aussi après Annuler ou Rétablir, ce qui vidait l'historique des étapes à rétablir. | `js/diagrammes/carte.js` | La relecture n'a lieu qu'après un changement de zone ou d'échelle fait dans le panneau. |
| F2 | « Effacer les données » n'oubliait pas le fichier : les données revenaient au changement de zone suivant. | idem | Le fichier est oublié à l'effacement. |
| F3 | Le fichier d'une session pouvait être réappliqué à un autre document qui portait les mêmes identifiants de page. | idem | Les fichiers sont oubliés à l'ouverture d'un document. |
| F4 | En passant de la France au monde, la relecture affichait un avertissement inutile. Un clic sur « Actualiser » sans changement ajoutait une étape vide à l'historique. | idem | Pas de relecture sans résultat, pas d'étape identique. |
| F5 | « Actualiser » restait proposé quand les territoires de la carte étaient inconnus : le fichier entier était alors chargé. | idem | Le bouton n'apparaît que lorsque les territoires sont connus. |
| F6 | Le fichier CSV gardé en mémoire contenait toutes ses colonnes (jusqu'à 20 Mo par page). | idem | Seules les colonnes du réglage sont gardées. |
| F7 | Une liste déroulante changée au clavier puis Ctrl+S dans les 0,7 s : l'enregistrement se faisait sans le dernier choix. | `js/dom.js` | Un raccourci applique d'abord le choix en attente. |
| F8 | Un choix en attente pouvait s'appliquer à une autre page après un changement de page. | idem | Il est abandonné si le champ a quitté la page. |
| F9 | Après la reconstruction du panneau, le focus pouvait aller sur un autre bouton de même libellé, par exemple « Supprimer » d'un autre élément. | `js/app.js` | Ce repli a été retiré. |
| F10 | Perte de travail : un brouillon refusé au démarrage (taille dépassée, par exemple) était écrasé sans message. | `js/app.js`, `js/brouillon.js` | Le brouillon est mis de côté sous une autre clé, et l'utilisateur est prévenu. |
| F11 | Un document que FUSAIN refuserait à l'ouverture pouvait être enregistré sans avertissement. | `js/app.js` | Le fichier enregistré est relu aussitôt ; un refus est signalé. |
| F12 | L'import `.mmd` coupait le code à 50 000 caractères au milieu d'une ligne, et annonçait « importé » même quand la limite de 100 pages était atteinte. | `js/app.js` | Un fichier trop long ou un document plein est refusé avec un message ; la limite des cartes (400 000 caractères) s'applique. |
| F13 | Une saisie de code en attente était écrite dans une autre page après un clic sur Annuler ou Rétablir. | `js/app.js` | La saisie est appliquée avant l'annulation. |
| F14 | `accTitle:` et `accDescr:` n'étaient pas reconnus. Dans un schéma d'états, de classes, un Gantt ou une frise, ils devenaient un élément, et le Gantt ne s'affichait plus. | `js/diagrammes/*.js` | Ces lignes sont reconnues et gardées telles quelles (helper `ligneAccessible`) ; un bloc `accDescr {` sur plusieurs lignes fait passer la page en « code seul ». |
| F15 | Dans un schéma d'états, `Etat:::classe` devenait une description « ::classe ». | `js/diagrammes/etats.js` | La page passe en « code seul ». |
| F16 | Les lignes `linkStyle N` gardaient leur numéro après la suppression d'un lien : le mauvais lien était stylé, ou le rendu échouait. | `js/diagrammes/logigramme.js` | Le style est rattaché au lien, et son numéro est recalculé à l'écriture. |
| F17 | `style A font-family:Marianne,arial` perdait la suite de la valeur. | idem | Une virgule ne sépare deux propriétés que si un nom de propriété la suit. |
| F18 | « Ticket #42; urgent » s'affichait « Ticket * urgent » : Mermaid lit `#42;` comme une entité. | `js/diagrammes/commun.js` | `#` est écrit `#35;` devant une forme d'entité. |
| F19 | Une tâche, période, étape, idée ou un membre dont le texte commence par `%%` devenait un commentaire et disparaissait. | gantt, frise, parcours, carte mentale, classes | Une espace sans chasse précède le `%%`, ou le texte est encadré. |
| F20 | Gantt : vider le début d'une tâche qui porte un identifiant produisait une date invalide. | `js/diagrammes/gantt.js` | Le début est exigé tant que l'identifiant existe. |
| F21 | Export Visio : des noms de page en double, après troncature à 31 caractères, sont refusés par Visio. | `js/visio-format.js` | Les doublons reçoivent un numéro. |
| F22 | Import réseau : un nom d'emplacement contenant `~` créait un nœud parasite `undefined`. | `js/reseau.js` | La paire de groupes est gardée telle quelle. |

## 5. Recommandations ouvertes

| # | Recommandation | Raison |
|---|---|---|
| R1 | Remplacer l'extension ZenUML dès qu'une version embarque DOMPurify ≥ 3.4 | Voir S3. La veille mensuelle signalera tout avis nouveau. |
| R2 | Contrôler l'intégrité de chaque module ES, avec une carte d'imports portant `integrity` et une empreinte dans la CSP | Seul `js/app.js` porte un attribut SRI. Les modules qu'il importe ne sont contrôlés que par le service worker, donc pas à la toute première visite. |
| R3 | Servir FUSAIN avec les en-têtes HTTP de `deploiement/nginx-fusain.conf` pour un usage en production | Sur GitHub Pages, `frame-ancestors` et les autres en-têtes ne peuvent pas être posés. |
| R4 | Fixer une licence pour le code propre à FUSAIN | La nomenclature le déclare « non fixée ». |
| R5 | Faire mener un audit externe avant une diffusion large | Cet audit est interne. |

## 6. Limites

- La recette navigateur n'a pas été rejouée sur le poste de développement, faute de Node et de Chrome réunis sur une même machine du labo ; elle tourne sur GitHub à la publication.
- L'export Visio n'a pas été ouvert dans Microsoft Visio.
- `@zenuml/core` et marked, inclus dans l'extension ZenUML, n'ont pas de version inscrite dans le fichier : ils ne peuvent pas être contrôlés automatiquement.
