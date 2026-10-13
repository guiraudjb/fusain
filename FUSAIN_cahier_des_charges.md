<!-- title: FUSAIN — Cahier des charges -->

# FUSAIN

### Fabrique Universelle de Schémas Accessibles, Intuitifs et Normés

**Cahier des charges fonctionnel et technique**

| Champ | Valeur |
|---|---|
| Version | 1.1 |
| Date | 13 octobre 2026 |
| Statut | Avant-projet — en cours de validation. Développement engagé : voir §14 pour l'état de réalisation de la version 0.1.0 |
| Objet | Éditeur visuel de diagrammes Mermaid, mis en page au format A4 ou A3 |
| Stack technique | HTML, CSS et JavaScript natifs (modules ES), DSFR, Mermaid — application web progressive, sans serveur applicatif, sans étape de build |
| Lieu d'exécution | Navigateur de l'utilisateur, exclusivement |

---

## Sommaire

1. [Contexte et objectifs](#1-contexte-et-objectifs)
2. [Périmètre fonctionnel](#2-périmètre-fonctionnel)
3. [Utilisateurs](#3-utilisateurs)
4. [Architecture technique](#4-architecture-technique)
5. [Spécifications fonctionnelles](#5-spécifications-fonctionnelles)
6. [Format du fichier de sauvegarde](#6-format-du-fichier-de-sauvegarde)
7. [Sécurité par conception](#7-sécurité-par-conception)
8. [Conformité NIS2 et nomenclature logicielle](#8-conformité-nis2-et-nomenclature-logicielle)
9. [Accessibilité](#9-accessibilité)
10. [Exigences non fonctionnelles](#10-exigences-non-fonctionnelles)
11. [Déploiement](#11-déploiement)
12. [Phasage](#12-phasage)
13. [Annexes](#13-annexes)
14. [État de réalisation](#14-état-de-réalisation)

---

## 1. Contexte et objectifs

### 1.1 Contexte

PLUME et SILLON intègrent déjà la bibliothèque Mermaid pour produire des diagrammes, mais uniquement par saisie de code : l'agent doit connaître la syntaxe, ou partir d'un modèle et le modifier à la main. Cette barrière écarte la majorité des agents, qui se rabattent sur des outils bureautiques ou des services en ligne dont l'hébergement n'est pas maîtrisé et vers lesquels partent des schémas d'organisation, de processus ou d'architecture parfois sensibles.

FUSAIN répond à ce besoin par un éditeur où le schéma se construit à la souris, directement sur une feuille au format d'impression, sans jamais quitter le poste de l'agent.

### 1.2 Objectifs

- Permettre à un agent non technicien de produire un diagramme propre **sans écrire une ligne de code**.
- Conserver Mermaid comme langage sous-jacent : le code reste lisible, modifiable à la main et réutilisable dans PLUME, SILLON ou tout autre outil compatible.
- Produire des documents prêts à imprimer ou à insérer : A4 ou A3, portrait ou paysage, export PDF et PNG.
- Garantir qu'**aucune donnée ne quitte le navigateur** : tous les traitements (rendu, mise en page, export, sauvegarde) s'exécutent sur le poste client.
- Appliquer le Système de Design de l'État (DSFR) et le RGAA.
- Être sécurisé par conception et documenté pour les obligations NIS2 de l'entité qui le déploie.

### 1.3 Ce que FUSAIN n'est pas

- **Pas un outil de dessin libre** : les éléments ne se placent pas au pixel près. La disposition est calculée par Mermaid ; l'utilisateur agit sur la structure et sur des réglages de disposition (§5.3). C'est la contrepartie d'un code Mermaid pur et réversible.
- **Pas un outil collaboratif** : pas d'édition simultanée, pas de partage par lien. Un document s'échange sous forme de fichier.
- **Pas un service de stockage** : aucun compte, aucun espace serveur. La conservation des documents relève de l'utilisateur (fichier JSON).
- **Pas un remplaçant de PLUME** : FUSAIN produit des schémas, pas des courriers ni des rapports.

---

## 2. Périmètre fonctionnel

| Fonction | V1 | Versions ultérieures | Hors périmètre |
|---|---|---|---|
| Édition visuelle : logigramme, séquence, carte mentale / organigramme, Gantt, camembert | ✔ | | |
| Édition visuelle des autres types Mermaid (états, classes, entité-relation, frise, quadrant, parcours, Kanban, etc.) | | ✔ par lots | |
| Édition du code pour **tous** les types Mermaid, avec aperçu en direct | ✔ | | |
| Bibliothèque de modèles de départ | ✔ | | |
| Document multi-pages, A4 / A3, portrait / paysage par page | ✔ | | |
| Export PDF et PNG, repli SVG | ✔ | | |
| Sauvegarde et restauration au format JSON | ✔ | | |
| Brouillon automatique local, annuler / rétablir | ✔ | | |
| Fonctionnement hors ligne (PWA installable) | ✔ | | |
| Import d'un fichier `.mmd` ou d'un bloc de code Mermaid collé | ✔ | | |
| Plusieurs schémas sur une même page | | ✔ | |
| Formats A2, A5, personnalisé | | ✔ | |
| Placement libre des éléments | | | ✔ |
| Collaboration en temps réel, comptes, stockage serveur | | | ✔ |
| Génération de schémas par IA | | | ✔ |

---

## 3. Utilisateurs

FUSAIN ne comporte ni authentification ni rôles : aucune donnée n'étant stockée ou traitée côté serveur, il n'y a rien à protéger par un contrôle d'accès applicatif. L'accès à l'application elle-même relève du réseau qui la sert.

| Profil | Usage | Mode principal |
|---|---|---|
| Agent non technicien | Produit un logigramme, un organigramme ou un planning pour une note, une présentation, un affichage | Visuel |
| Utilisateur avancé | Reprend un code Mermaid existant, utilise un type non couvert par l'édition visuelle, ajuste finement | Code |

Les deux modes portent sur le même document et sont utilisables alternativement à tout moment (§4.3).

---

## 4. Architecture technique

### 4.1 Vue d'ensemble

FUSAIN est un ensemble de **fichiers statiques** : une page HTML, des feuilles de style, des modules JavaScript natifs et des bibliothèques tierces embarquées. N'importe quel serveur de fichiers suffit à le distribuer ; une fois chargé, il n'a plus besoin du réseau.

```
┌────────────────────────── Navigateur de l'agent ──────────────────────────┐
│                                                                            │
│   Interface DSFR ── Éditeur visuel ─┐                                      │
│                  └─ Éditeur de code ─┴─▶ Code Mermaid (source de vérité)   │
│                                               │                            │
│                               Mermaid (rendu SVG) ─▶ DOMPurify ─▶ Feuille  │
│                                               │                            │
│              Export PDF / PNG ◀───────────────┤                            │
│              Fichier JSON  ◀──▶ Document      └─▶ Brouillon (IndexedDB)    │
│                                                                            │
│   Service worker : cache versionné, fonctionnement hors ligne              │
└────────────────────────────────────────────────────────────────────────────┘
              ▲ chargement initial et mises à jour uniquement
     Serveur de fichiers statiques (aucun traitement, aucune donnée)
```

### 4.2 Principes

| Principe | Exigence |
|---|---|
| Calcul côté client | Rendu, mise en page, export et sauvegarde s'exécutent dans le navigateur. Aucune interface de programmation distante n'est appelée. |
| Aucune requête sortante | Après chargement, l'application n'émet aucune requête vers un autre domaine. Exigence imposée par la politique de sécurité de contenu (§7.1) et vérifiée en recette (§10). |
| Aucun CDN | Toutes les bibliothèques sont embarquées dans le dépôt, à version figée, avec empreinte (§8.3). |
| Aucun build | Pas de bundler ni de transpileur : le code livré est le code écrit, auditable tel quel. Modules ES natifs. |
| Aucun script en ligne | Ni balise `<script>` avec contenu, ni attribut `onclick=`. Tous les gestionnaires sont attachés par `addEventListener`. Condition nécessaire à une politique de sécurité de contenu stricte. |
| Liste de dépendances courte | Chaque bibliothèque ajoutée est une surface d'attaque et une charge de veille : toute nouvelle dépendance est justifiée dans la nomenclature. |

### 4.3 Modèle interne : le code Mermaid comme source de vérité

Chaque page contient **un code Mermaid**, seule représentation enregistrée du schéma. L'éditeur visuel n'a pas de format propre :

1. le code est analysé en un modèle structuré en mémoire (nœuds, liens, groupes, tâches… selon le type) ;
2. chaque action visuelle modifie ce modèle ;
3. le modèle est réécrit en code Mermaid, qui est rendu.

Conséquences :

- les modes visuel et code ne peuvent pas diverger, puisqu'un seul des deux est stocké ;
- un fichier FUSAIN reste exploitable sans FUSAIN (le code se copie tel quel) ;
- la restauration d'un fichier ne charge aucune structure complexe : seulement du texte, re-analysé (§7.4).

**Bascule en « code seul »** — Si le code saisi à la main utilise une construction que l'analyseur visuel ne gère pas (syntaxe avancée, type non couvert), la page passe en mode code seul, avec un message expliquant pourquoi. Rien n'est perdu ni réécrit. L'édition visuelle redevient disponible dès que le code revient dans le sous-ensemble géré.

**Préservation du code** — La réécriture depuis le modèle conserve les commentaires et l'ordre des déclarations chaque fois que possible. Les cas où elle ne le peut pas sont documentés dans le guide utilisateur.

### 4.4 Application web progressive

- Manifeste d'application (nom, icônes, couleurs DSFR, mode d'affichage autonome) : installable sur le poste.
- Service worker propre à FUSAIN, avec **cache pré-rempli et versionné** : la liste exhaustive des fichiers et leur version sont déclarées dans le service worker ; rien n'est mis en cache dynamiquement.
- Fonctionnement **complet hors ligne** après la première visite, exports compris.
- À la publication d'une nouvelle version, un bandeau DSFR « Une nouvelle version est disponible » propose le rechargement ; la mise à jour n'interrompt jamais un travail en cours.
- Le numéro de version et la date de publication sont visibles dans la modale « À propos ».

### 4.5 Stockage local

| Donnée | Emplacement | Durée |
|---|---|---|
| Brouillon du document en cours | IndexedDB | Jusqu'à remplacement ou effacement par l'utilisateur |
| Préférences (thème, zoom, dernier format utilisé) | `localStorage` | Idem |
| Fichiers de l'application | Cache du service worker | Jusqu'à la version suivante |

Un bouton « Effacer les données locales » est disponible dans la modale « À propos ». Le brouillon local est une commodité, pas une sauvegarde : l'interface le rappelle et invite à enregistrer un fichier JSON.

---

## 5. Spécifications fonctionnelles

### 5.1 Espace de travail

- En-tête DSFR (marque de l'État, nom du service, bouton « À propos »).
- Barre d'outils : nouveau document, ouvrir, enregistrer, exporter, annuler / rétablir, zoom, bascule visuel / code, thème clair / sombre.
- **Zone centrale** : la page courante, affichée aux proportions réelles de son format, avec ses marges matérialisées. Zoom de 25 % à 400 %, ajustement à la fenêtre, déplacement à la souris et au clavier.
- **Panneau latéral gauche** : vignettes des pages.
- **Panneau latéral droit** : propriétés de l'élément sélectionné, ou de la page si rien n'est sélectionné.
- En mode code, la zone centrale se partage entre l'éditeur et l'aperçu de la page.

### 5.2 Pages et mise en page

| Format | Portrait | Paysage |
|---|---|---|
| A4 | 210 × 297 mm | 297 × 210 mm |
| A3 | 297 × 420 mm | 420 × 297 mm |

- Un document contient une ou plusieurs pages ; chaque page a son format, son orientation et son schéma.
- Opérations sur les pages : ajouter, dupliquer, renommer, réordonner (glisser-déposer et clavier), supprimer (avec confirmation).
- Marges réglables (valeur par défaut : 15 mm), affichées à l'écran, respectées à l'export.
- Éléments de page optionnels : titre, sous-titre, pied de page (texte libre, date, numéro de page « n / total »).
- **Ajustement du schéma** à la zone utile : « ajuster à la page » (par défaut, proportions conservées), « largeur », « hauteur », ou échelle manuelle en pourcentage ; alignement horizontal et vertical.
- Avertissement lorsque l'ajustement rend le texte plus petit qu'un seuil de lisibilité à l'impression (8 points), avec proposition de passer en A3 ou de changer d'orientation.
- Changer le format ou l'orientation d'une page ne modifie jamais le schéma, seulement son ajustement.

### 5.3 Édition visuelle

**Principes communs aux cinq types**

- Manipulation directe sur le schéma rendu : cliquer pour sélectionner, double-cliquer pour renommer en place, touche Suppr pour supprimer.
- Chaque action est aussi disponible depuis le panneau de propriétés et au clavier (§9).
- Sélection multiple, copier / coller / dupliquer.
- Après chaque modification, le schéma est recalculé ; l'élément modifié reste sélectionné et visible.
- Couleurs choisies dans la palette DSFR ; texte en police Marianne.
- Aucune saisie ne peut produire un code invalide : les libellés sont échappés automatiquement (§7.3).

**Logigramme**

- Ajouter un nœud (bouton, ou poignée « + » sur un nœud existant, qui crée le nœud et son lien).
- Relier deux nœuds en tirant un lien de l'un vers l'autre.
- Formes : rectangle, rectangle arrondi, losange (décision), cercle, hexagone, cylindre (base de données), parallélogramme (entrée / sortie), document.
- Liens : plein, pointillé, épais ; avec ou sans flèche, flèche double ; libellé.
- Groupes (sous-graphes) : créer, nommer, y glisser des nœuds, imbriquer.
- Disposition : sens du graphe (haut → bas, bas → haut, gauche → droite, droite → gauche), espacement des nœuds et des rangs.

**Diagramme de séquence**

- Participants et acteurs : ajouter, renommer, réordonner par glisser-déposer.
- Messages : tirer de la ligne de vie d'un participant vers une autre ; type (appel, réponse, asynchrone), libellé ; réordonner.
- Notes, activations, blocs (boucle, alternative, optionnel, parallèle).
- Numérotation automatique des messages.

**Carte mentale et organigramme**

- Nœud racine, ajout d'un enfant ou d'un frère (touches Tab et Entrée, comme dans les outils de carte mentale usuels).
- Déplacement d'une branche par glisser-déposer vers un autre parent ; réordonnancement des frères.
- Forme et couleur par nœud ou par branche.
- Deux présentations d'une même arborescence : rayonnante (carte mentale) ou hiérarchique (organigramme).

**Diagramme de Gantt**

- Sections et tâches saisies dans une grille (nom, début, durée ou fin, dépendance, état, jalon).
- Ajustement à la souris sur le diagramme : déplacer une tâche, étirer sa durée.
- Options : format de date, jours exclus (week-ends, dates), repère « aujourd'hui », graduation de l'axe.

**Camembert**

- Tableau libellé / valeur, ajout et suppression de lignes, réordonnancement.
- Titre, affichage des valeurs, couleur de chaque part.
- Collage direct de deux colonnes copiées depuis un tableur (texte uniquement).

### 5.4 Mode code

- Éditeur de texte à chasse fixe avec numéros de ligne, indentation automatique, annuler / rétablir.
- Aperçu mis à jour après une courte pause de saisie.
- En cas d'erreur de syntaxe : le dernier rendu valide reste affiché, le message d'erreur est donné en clair avec le numéro de ligne, et la ligne fautive est signalée.
- Indicateur permanent de l'état de la page : « édition visuelle disponible » ou « code seul » (§4.3).
- Boutons « Copier le code » et « Importer un code » (collage ou fichier `.mmd`).

### 5.5 Modèles

- Bibliothèque de modèles pré-remplis couvrant tous les types Mermaid, classés par usage (processus et structure, architecture, gestion de projet, analyse et données), reprise et étendue à partir de celle de PLUME.
- Chaque modèle indique s'il est éditable en mode visuel.
- Une page peut aussi être une **diapositive de texte** (depuis la 0.9.0). Ce n'est pas un schéma Mermaid : son code est un format propre à FUSAIN (« diapo » suivi d'une mise en page, puis des lignes « champ: texte » et « - élément »), dessiné par FUSAIN en SVG. Les textes sont écrits comme du texte, jamais interprétés comme du HTML ; le style n'est pas réglable, il est celui de la charte.
- Une nouvelle page démarre d'un modèle, ou d'une **page vierge** (sans schéma : seuls le titre, le sous-titre et le pied de page sont imprimés), à laquelle un schéma peut être donné ensuite.

### 5.6 Habillage

- Thèmes de schéma fondés sur les couleurs du DSFR (Bleu France, Rouge Marianne et couleurs illustratives), applicables à une page ou à tout le document.
- Variante à fort contraste et variante monochrome pour l'impression en noir et blanc.
- Le thème clair / sombre de l'interface ne modifie pas le schéma exporté : la feuille reste sur fond blanc, sauf choix explicite.

### 5.7 Annuler, rétablir, brouillon

- Historique d'au moins 100 actions par session, commun aux modes visuel et code.
- Brouillon enregistré automatiquement après chaque modification ; à la réouverture, proposition de reprendre le travail.
- Avertissement avant de quitter la page ou d'ouvrir un autre document si des modifications ne sont pas enregistrées dans un fichier.

### 5.8 Export

**PDF**

- Vectoriel : texte et traits nets à toute échelle, texte sélectionnable.
- Chaque page du PDF a exactement le format et l'orientation de la page FUSAIN correspondante ; un même PDF peut mêler A4 et A3.
- Portée : document entier, page courante ou sélection de pages.
- Police Marianne incorporée.
- Métadonnées : titre et date ; aucune donnée d'identification du poste ou de l'utilisateur.
- Repli : si un type de schéma ne peut pas être converti en vectoriel fidèlement, la page concernée est insérée en image à 300 ppp et l'utilisateur en est informé.

**PNG**

- Une image par page, à la résolution choisie : 150, 300 (défaut) ou 600 ppp.
- Dimensions exactes : A4 à 300 ppp = 2 480 × 3 508 px ; A3 à 300 ppp = 3 508 × 4 961 px.
- Fond blanc ou transparent.
- Option « schéma seul » : image rognée au schéma, sans la page, pour insertion dans un autre document.
- Export de plusieurs pages : un fichier par page, nommé `document_page-02.png`.

**SVG** — Export du schéma seul, disponible en repli et pour réutilisation.

Tous les exports sont produits dans le navigateur et remis à l'utilisateur par téléchargement local.

### 5.9 Sauvegarde et restauration

- « Enregistrer » produit un fichier `nom-du-document.fusain.json` contenant tout le document (§6).
- « Ouvrir » restaure un fichier, par sélection ou par glisser-déposer sur la fenêtre.
- Un fichier issu d'une version antérieure du format est converti automatiquement ; un fichier d'une version postérieure est refusé avec un message invitant à mettre à jour l'application.
- Un fichier invalide ou altéré est refusé en totalité, avec un message indiquant la cause ; il n'est jamais restauré partiellement.
- Sur les navigateurs qui le permettent, enregistrement direct dans le fichier d'origine (API d'accès au système de fichiers) ; sinon, téléchargement.

### 5.10 Modale « À propos »

Version et date, guide utilisateur, déclaration d'accessibilité, nomenclature logicielle (§8.2), licences, effacement des données locales.

---

## 6. Format du fichier de sauvegarde

### 6.1 Structure

```json
{
  "format": "fusain",
  "formatVersion": 2,
  "application": "1.0.0",
  "document": {
    "titre": "Circuit de traitement des demandes",
    "creeLe": "2026-10-13T09:30:00Z",
    "modifieLe": "2026-10-13T10:05:00Z",
    "theme": "bleu-france"
  },
  "pages": [
    {
      "id": "p1",
      "nom": "Vue d'ensemble",
      "format": "A3",
      "orientation": "paysage",
      "margesMm": 15,
      "titre": "Circuit de traitement",
      "sousTitre": "Version de travail",
      "description": "Le dossier est instruit s'il est complet, sinon des pièces sont demandées.",
      "piedDePage": "DDFiP — page {n}/{total}",
      "ajustement": { "mode": "page", "echelle": 100, "alignement": "centre" },
      "type": "flowchart",
      "code": "flowchart LR\n    A[Réception] --> B{Dossier complet ?}\n    B -- Oui --> C[Instruction]\n    B -- Non --> D[Demande de pièces]"
    }
  ]
}
```

### 6.2 Règles

| Règle | Valeur |
|---|---|
| Encodage | UTF-8, JSON strict |
| Contenu exécutable | Aucun : le fichier ne contient que des chaînes, des nombres et des booléens. Ni HTML, ni SVG, ni script, ni URL de ressource. |
| Images incorporées | Non admises en V1 |
| Taille maximale acceptée | 5 Mo |
| Nombre maximal de pages | 100 |
| Taille maximale d'un code | 50 000 caractères par page |
| Valeurs énumérées | `format` (`A4`, `A3`), `orientation` (`portrait`, `paysage`), `ajustement.mode`, `theme`, `type` : listes fermées, toute autre valeur entraîne le refus |
| Champs inconnus | Refusés (pas de champ libre) |
| Compatibilité | `formatVersion` incrémenté à tout changement non rétrocompatible ; une fonction de conversion par saut de version. Version 2 depuis FUSAIN 0.3.0 (ajout de `sousTitre` et `description`) : un fichier de version 1 reste lisible, ces champs y sont vides |

Le schéma JSON formel (JSON Schema) est livré avec l'application et sert à la fois de documentation et de référence pour la validation à la restauration.

---

## 7. Sécurité par conception

FUSAIN traite deux entrées non fiables : **ce que l'utilisateur saisit ou colle** et **les fichiers qu'il ouvre** — un fichier `.fusain.json` reçu par courriel doit être considéré comme hostile. La cible à protéger est le navigateur de l'agent et, à travers lui, sa session sur les autres applications du même domaine.

La sécurité repose sur des couches indépendantes : la défaillance de l'une ne suffit pas à permettre une attaque.

### 7.1 Politique de sécurité de contenu

Délivrée par **en-tête HTTP** (§11), doublée d'une balise `<meta>` pour les déploiements où l'en-tête ne peut pas être configuré.

```
Content-Security-Policy:
  default-src 'none';
  script-src 'self';
  style-src 'self';
  img-src 'self' data: blob:;
  font-src 'self';
  connect-src 'self';
  worker-src 'self';
  manifest-src 'self';
  object-src 'none';
  base-uri 'none';
  form-action 'none';
  frame-ancestors 'none';
  require-trusted-types-for 'script';
```

| Effet recherché | Directive |
|---|---|
| Un script injecté ne s'exécute pas, même si une faille d'injection existe | `script-src 'self'`, sans `'unsafe-inline'` ni `'unsafe-eval'` |
| Aucune donnée ne peut être envoyée vers l'extérieur | `connect-src 'self'`, `form-action 'none'`, `default-src 'none'` |
| L'application ne peut pas être encadrée par un site tiers (détournement de clic) | `frame-ancestors 'none'` (en-tête uniquement : sans effet dans une balise `<meta>`) |
| Les écritures dangereuses dans le DOM sont bloquées par le navigateur | `require-trusted-types-for 'script'` |

**Écarts retenus à l'issue du prototype (version 0.1.0)**, par rapport à la politique cible ci-dessus :

| Directive | Valeur appliquée | Justification |
|---|---|---|
| `style-src` | `'self' 'unsafe-inline'` | Mermaid insère une feuille de style dans chaque SVG et pose des styles en ligne. Compensation : les feuilles de style du SVG sont filtrées (`@import` et `url()` externes retirés) et aucune ressource externe ne peut être chargée (`img-src`, `font-src`, `connect-src`). |
| `require-trusted-types-for` | Activée depuis la 0.2.1 | Politique par défaut (`js/confiance.js`) : toute chaîne écrite comme du HTML, y compris par Mermaid ou le DSFR, est assainie par DOMPurify ; la création de script à partir de texte est refusée. Vérifié sur Chrome et Firefox. |
| `font-src` | `'self' data:` | Polices incorporées dans les images exportées. |

`script-src` reste `'self'`, sans exception : vérifié en recette, l'application fonctionne sans script en ligne ni évaluation dynamique.

**Autres en-têtes** : `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin`, `Permissions-Policy` désactivant caméra, micro, géolocalisation et capteurs, `Strict-Transport-Security`.

### 7.2 Configuration de Mermaid

- `securityLevel: 'strict'` : balises HTML dans les libellés encodées, interactions par clic désactivées.
- `htmlLabels: false` : libellés rendus en texte SVG, sans `foreignObject` — ce qui supprime un vecteur d'injection HTML et rend l'export en image fiable.
- **Directives embarquées dans le code** (`%%{init: …}%%` et bloc de configuration en tête de schéma) : filtrées par liste blanche de clés (thème, couleurs, sens, espacements). Toute clé touchant à la sécurité, aux polices distantes ou au chargement de ressources est retirée avant rendu. La configuration de sécurité est verrouillée par l'application (`secure`) et ne peut pas être surchargée par un schéma.
- Instructions `click`, `href`, `callback` et liens dans les nœuds : neutralisées. Un schéma FUSAIN est une image, pas une page interactive.
- Icônes et images distantes dans les schémas : interdites ; seules les icônes embarquées sont utilisables.
- Plafonds : taille du code (`maxTextSize`), nombre de liens (`maxEdges`), et délai maximal de rendu au-delà duquel le calcul est abandonné avec un message — protection contre un schéma conçu pour figer le navigateur.

### 7.3 Insertion dans la page

| Règle | Détail |
|---|---|
| Texte utilisateur | Inséré dans l'interface par `textContent` ou par les propriétés de formulaire, jamais interprété comme HTML. |
| `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write` | Interdits sur toute donnée. Seule exception : le SVG produit par Mermaid, après assainissement. Règle contrôlée par analyse statique du code à chaque version. |
| SVG produit par Mermaid | Systématiquement repassé dans DOMPurify (profil SVG strict : ni `script`, ni `foreignObject`, ni attribut `on*`, ni `href` vers autre chose qu'une ancre interne) avant insertion. Défense en profondeur, indépendante de l'assainissement interne de Mermaid. |
| Écriture du code depuis le mode visuel | Les libellés saisis sont échappés selon la syntaxe Mermaid (guillemets, crochets, caractères de structure). Un libellé ne peut pas « sortir » de son nœud pour injecter une instruction. |
| Collage | Seul le texte brut du presse-papiers est lu ; le HTML collé est ignoré. |
| Fonctions d'exécution dynamique | `eval`, `new Function`, `setTimeout` avec une chaîne : interdits dans le code de FUSAIN. |
| Liens vers l'extérieur | Limités à la modale « À propos », avec `rel="noopener noreferrer"`. |

### 7.4 Restauration d'un fichier

1. Refus avant lecture si la taille dépasse le plafond (§6.2).
2. Analyse par `JSON.parse` uniquement — le contenu n'est jamais évalué.
3. Rejet des clés `__proto__`, `constructor` et `prototype` à tout niveau (pollution de prototype).
4. Validation complète contre le schéma : types, listes fermées, longueurs, champs inconnus refusés.
5. Reconstruction du document dans des objets neufs, champ par champ : l'objet issu du fichier n'est jamais utilisé directement.
6. Chaque code Mermaid suit ensuite exactement le même chemin qu'une saisie manuelle (§7.2, §7.3).

Le fichier ne pouvant contenir ni HTML, ni SVG, ni structure de modèle (§4.3, §6.2), il n'existe pas de chemin par lequel son contenu atteindrait la page sans passer par l'analyse et l'assainissement.

### 7.5 Exports

- Le SVG exporté est le SVG assaini, sans script, sans référence externe, polices incorporées.
- Conversion PNG via un canevas alimenté par des données locales uniquement (pas de ressource distante, donc pas de canevas « contaminé »).
- Les noms de fichiers proposés sont nettoyés (caractères alphanumériques, tiret, soulignement).

### 7.6 Intégrité et chaîne d'approvisionnement

- Bibliothèques tierces embarquées à version figée ; empreinte SHA-256 de chaque fichier consignée dans la nomenclature et vérifiée à l'intégration (§8).
- Attribut d'intégrité (SRI) sur chaque script et feuille de style chargés par la page.
- Le service worker ne met en cache que la liste fermée des fichiers de la version, après avoir vérifié l'empreinte SHA-256 de chacun : un fichier altéré ou une publication incomplète fait échouer l'installation, et la version précédente reste en service. Il ne sert rien qui vienne d'un autre domaine.
- Aucune dépendance n'est récupérée à l'exécution.

### 7.7 Vie privée

- Aucune mesure d'audience, aucun traceur, aucun envoi de rapport d'erreur.
- Aucune donnée à caractère personnel traitée par un serveur : FUSAIN ne constitue pas un traitement au sens du RGPD côté hébergeur ; les schémas restent sous la responsabilité de l'agent qui les produit.

### 7.8 Menaces et mesures

| Menace | Scénario | Mesures |
|---|---|---|
| XSS par fichier piégé | Un fichier `.fusain.json` reçu contient un code Mermaid ou un champ forgé | §7.4 (validation, format sans contenu actif), §7.2, §7.3, §7.1 en dernier rempart |
| XSS par libellé | Un libellé contient `<img onerror=…>` ou `<script>` | `htmlLabels: false`, `securityLevel: 'strict'`, DOMPurify, CSP |
| Injection de directive | Un code collé contient `%%{init: {"securityLevel": "loose"}}%%` | Filtrage par liste blanche, configuration verrouillée |
| Exfiltration | Un schéma référence une image ou une police distante pour faire fuiter une information | Ressources distantes interdites, `connect-src`/`img-src`/`font-src` restreints |
| Pollution de prototype | Fichier contenant `"__proto__"` | Rejet des clés, reconstruction champ par champ |
| Déni de service local | Schéma de plusieurs dizaines de milliers de nœuds | Plafonds de taille, de liens et de durée de rendu |
| Dépendance compromise ou vulnérable | Version piégée ou faille publiée dans une bibliothèque | Versions figées, empreintes, SRI, veille et procédure de mise à jour (§8.4) |
| Cache empoisonné | Contenu altéré servi par le service worker | Liste fermée, même origine uniquement, HTTPS obligatoire, SRI |
| Détournement de clic | FUSAIN affiché dans un cadre invisible | `frame-ancestors 'none'` |

### 7.9 Vérification

- Jeu de tests de sécurité automatisé, rejoué à chaque version : corpus de charges XSS dans les libellés et dans les fichiers, directives malveillantes, fichiers malformés et surdimensionnés.
- Analyse statique : absence des écritures et fonctions interdites (§7.3).
- Contrôle en recette : aucune violation de la politique de sécurité de contenu dans la console, aucune requête hors origine dans l'onglet réseau.
- Audit de sécurité externe recommandé avant mise en service généralisée.

---

## 8. Conformité NIS2 et nomenclature logicielle

### 8.1 Cadre

La directive (UE) 2022/2555, dite NIS2, s'impose aux **entités** qu'elle désigne, non aux logiciels. Elle leur demande notamment, au titre des mesures de gestion des risques (article 21), de maîtriser la sécurité de leur chaîne d'approvisionnement et la sécurité du développement et de la maintenance de leurs systèmes, y compris le traitement des vulnérabilités.

FUSAIN ne peut donc pas être « conforme NIS2 » à lui seul. Il fournit à l'entité qui le déploie les éléments dont elle a besoin pour l'intégrer à sa propre conformité :

| Attente | Apport de FUSAIN |
|---|---|
| Connaître la composition des logiciels utilisés | Nomenclature logicielle complète, lisible et exploitable par machine (§8.2, §8.3) |
| Suivre et corriger les vulnérabilités | Veille organisée, délais cibles, procédure de mise à jour (§8.4) |
| Sécurité du développement | Sécurité par conception (§7), tests de sécurité à chaque version (§7.9) |
| Maîtrise de la chaîne d'approvisionnement | Aucune dépendance chargée à l'exécution, versions figées, empreintes vérifiées (§7.6) |
| Réduction de l'exposition | Aucun serveur applicatif, aucune base de données, aucune donnée centralisée |

### 8.2 Livrables de nomenclature

| Fichier | Rôle |
|---|---|
| `NOMENCLATURE_LOGICIELLE_FUSAIN.md` (et sa version PDF) | Document de lecture : composants, versions, licences, provenance, état des correctifs, journal des révisions. Même gabarit que la nomenclature SILLON. |
| `sbom/fusain-sbom-cyclonedx.json` | Référence exploitable par machine, au format CycloneDX 1.6, validée contre le schéma officiel. Inclut les empreintes et, le cas échéant, l'analyse des vulnérabilités connues (VEX). |

Les deux sont versionnés avec le code, mis à jour dans le même changement que toute modification d'une dépendance, et consultables depuis la modale « À propos ».

### 8.3 Briques logicielles

| Composant | Rôle | Version | Licence | Provenance |
|---|---|---|---|---|
| DSFR | Système de Design de l'État : composants, styles, police Marianne, icônes | 1.15.4 | Etalab-2.0 | Registre npm `@gouvfr/dsfr` |
| Mermaid | Analyse et rendu des diagrammes | 12.1.0 | MIT | Registre npm `mermaid` |
| Extension ZenUML de Mermaid | Diagrammes de séquence ZenUML, chargée à la demande (ajoutée en 0.8.0) | 1.0.1 | MIT | Registre npm `@mermaid-js/mermaid-zenuml` |
| DOMPurify | Assainissement du SVG avant insertion | 3.4.17 | Apache-2.0 ou MPL-2.0 | Registre npm `dompurify` |
| jsPDF | Génération du fichier PDF | 4.2.1 | MIT | Registre npm `jspdf` |
| svg2pdf.js | Conversion vectorielle SVG → PDF | 2.8.1 | MIT | Registre npm `svg2pdf.js` |

Versions figées le 13 octobre 2026 : dernières versions amont à cette date, contrôlées sur OSV.dev (aucune vulnérabilité connue). La nomenclature consigne, par fichier embarqué : version exacte, empreinte SHA-256, URL de l'archive d'origine, licence, date du dernier contrôle.

Sont également recensés, bien qu'ils ne soient pas des dépendances embarquées :

- le **code propre à FUSAIN** (version, licence) ;
- les **composants inclus dans les bibliothèques** elles-mêmes (Mermaid embarque notamment ses propres moteurs de disposition et d'analyse) : listés comme sous-composants à partir des métadonnées de la version retenue ;
- le **socle d'exécution**, hors du contrôle de FUSAIN : navigateurs pris en charge (§10) et serveur de fichiers, dont la mise à jour relève de l'entité.

Aucun outil de build, gestionnaire de paquets ou service tiers n'intervient dans le produit livré.

### 8.4 Méthode de mise à jour

**Veille**

| Source | Objet | Fréquence |
|---|---|---|
| OSV.dev, interrogé sur la version exacte de chaque composant | Vulnérabilités publiées | Mensuelle, et avant chaque version |
| Avis de sécurité GitHub et notes de version des cinq projets | Correctifs de sécurité non rattachés à une CVE | Mensuelle |
| Bulletins du CERT-FR | Alertes majeures | En continu |

Chaque contrôle est daté dans le journal de la nomenclature, y compris lorsqu'il ne révèle rien. Le contrôle OSV.dev est automatisable à partir du fichier CycloneDX (outil `osv-scanner` ou équivalent), sur le poste de développement, sans rien ajouter au produit.

**Délais cibles de correction**, à compter de la publication du correctif amont :

| Sévérité | Délai |
|---|---|
| Critique, ou exploitation active constatée | 72 heures |
| Élevée | 7 jours |
| Moyenne | 30 jours |
| Faible | Version suivante |

Une vulnérabilité non atteignable dans FUSAIN (fonction non utilisée, par exemple) peut être classée sans action, à condition que l'analyse soit écrite dans la nomenclature et dans le fichier CycloneDX (VEX).

**Procédure de mise à jour d'un composant**

1. Télécharger l'archive de la version cible depuis le registre officiel.
2. Vérifier son empreinte par rapport à celle publiée par le registre.
3. Lire les notes de version : changements incompatibles, correctifs de sécurité.
4. Remplacer les fichiers embarqués ; le dossier porte le numéro de version (`libs/mermaid-v11.x.y/`), comme dans SILLON.
5. Mettre à jour les attributs d'intégrité (SRI) dans la page et la liste des fichiers du service worker.
6. Incrémenter la version de l'application et celle du cache.
7. Mettre à jour les deux fichiers de nomenclature et le journal des révisions.
8. Rejouer la recette complète : tests fonctionnels, tests de sécurité (§7.9), non-régression des exports sur le jeu de schémas de référence.
9. Publier.

Un script d'aide (`outils/verifier-nomenclature`) contrôle que chaque fichier embarqué correspond à l'empreinte déclarée et que la page, le service worker et la nomenclature désignent les mêmes versions ; il bloque la publication en cas d'écart.

**Propagation aux postes**

- Le service worker détecte la nouvelle version à l'ouverture suivante de l'application et propose le rechargement (§4.4).
- Pour un correctif de sécurité, le bandeau est remplacé par un message indiquant que la mise à jour est requise ; elle s'applique dès que le document en cours est enregistré.
- Un poste resté hors ligne conserve l'ancienne version jusqu'à sa prochaine connexion au serveur : limite inhérente au fonctionnement hors ligne, à mentionner dans la documentation d'exploitation.

**Fin de vie** — Si un composant n'est plus maintenu en amont, la nomenclature le signale et une décision de remplacement est consignée.

---

## 9. Accessibilité

- Conformité visée : RGAA 4.1, niveau AA ; déclaration d'accessibilité publiée dans l'application.
- Composants d'interface issus du DSFR, utilisés sans altération de leur structure.
- **Toute action réalisable à la souris l'est au clavier**, y compris dans l'éditeur visuel : parcours des éléments du schéma aux flèches, création, liaison, renommage, déplacement dans une arborescence, suppression. Les raccourcis sont listés dans une aide accessible par la touche « ? ».
- Le schéma en cours d'édition est doublé d'une **vue en plan** (liste structurée des éléments et de leurs liens), synchronisée avec la sélection, utilisable par un lecteur d'écran.
- Chaque schéma peut recevoir un titre et une description accessibles (`accTitle`, `accDescr`), repris dans le SVG exporté.
- Contrastes des thèmes de schéma vérifiés ; l'information n'est jamais portée par la couleur seule (formes et libellés distincts).
- Annonces vocales des changements d'état (élément ajouté, erreur de syntaxe, export terminé).
- Interface utilisable à 200 % de zoom et sur un écran de 1 280 px de large ; le mode tablette est pris en charge, le téléphone se limite à la consultation.

---

## 10. Exigences non fonctionnelles

| Domaine | Exigence |
|---|---|
| Navigateurs | Deux dernières versions majeures de Firefox (dont la version ESR en cours), Chrome et Edge ; Safari en dernière version. |
| Hors ligne | Toutes les fonctions disponibles sans réseau après la première visite. |
| Réseau | Aucune requête hors origine, vérifiée en recette et garantie par la politique de sécurité de contenu. |
| Rendu | Schéma de 200 nœuds recalculé en moins d'une seconde sur un poste bureautique standard ; l'interface reste réactive pendant le calcul. |
| Export | PDF de 10 pages en moins de 10 secondes ; PNG A3 à 300 ppp en moins de 5 secondes. |
| Poids | Premier chargement inférieur à 10 Mo, dont l'essentiel en cache ensuite (mesuré en 0.1.0 : 8,7 Mo, dont 5,5 Mo pour Mermaid). Depuis la 0.8.0, l'extension ZenUML ajoute 3,2 Mo : elle n'est pas chargée par la page, mais le service worker la met en cache en arrière-plan pour l'usage hors ligne, ce qui porte le total à 12 Mo environ — écart assumé par rapport à la cible. |
| Robustesse | Aucune perte de travail en cas de fermeture accidentelle (brouillon) ; une erreur de rendu n'altère jamais le code de la page. |
| Maintenabilité | Code en modules ES documentés, sans build ; un module par type de diagramme, pour ajouter un type sans toucher aux autres. |
| Tests | Tests automatisés de l'aller-retour code → modèle → code sur un corpus de schémas, par type : le résultat doit être équivalent à l'entrée. |
| Langue | Interface en français ; textes regroupés pour permettre une traduction ultérieure. |
| Sobriété | Aucun traitement en arrière-plan lorsque l'application est inactive. |

Les valeurs chiffrées sont des cibles, à confirmer par mesure à l'issue du prototype.

---

## 11. Déploiement

- **Livrable** : un dossier de fichiers statiques, déposable sur tout serveur de fichiers en HTTPS (obligatoire pour le service worker).
- **Publication de référence** : GitHub Pages, depuis la branche `main` du dépôt — <https://guiraudjb.github.io/fusain/>. Cet hébergement ne permet pas de poser d'en-têtes HTTP : la politique de sécurité de contenu y est délivrée par balise `<meta>`, sans `frame-ancestors` ni les autres en-têtes du §7.1. Il convient à la démonstration et à l'usage courant ; un déploiement en production dans une entité soumise à NIS2 se fait sur un serveur maîtrisé.
- **Configuration serveur** : un exemple pour Nginx est fourni (`deploiement/nginx-fusain.conf`, validé sur Nginx 1.30), limité au service des fichiers et aux en-têtes de sécurité (§7.1), avec les règles de cache adaptées (service worker et page d'entrée jamais mis en cache par le serveur, autres fichiers à longue durée).
- **Paquet Debian optionnel** (`fusain-server`), dans la continuité de TRACE et SILLON : installe les fichiers et la configuration Nginx ; aucune base de données, aucun service à démarrer. Il se construit par `deploiement/construire-deb.sh` ; à l'installation, il crée un certificat auto-signé (à remplacer par celui de l'organisation), active le site et désactive le site par défaut de Nginx. Validé par installation puis purge sur Debian 13.
- **Structure du dépôt**

```
FUSAIN/
├── index.html
├── manifest.webmanifest
├── sw.js
├── css/
├── js/                      modules de l'application
│   └── diagrammes/          un module par type éditable visuellement
├── libs/                    bibliothèques embarquées, dossier par version
├── modeles/                 modèles de schémas
├── schema/                  schéma JSON du format de fichier
├── sbom/                    fusain-sbom-cyclonedx.json
├── outils/                  scripts de vérification (hors produit livré)
├── tests/
├── Documentation/
├── NOMENCLATURE_LOGICIELLE_FUSAIN.md
└── FUSAIN_cahier_des_charges.md
```

---

## 12. Phasage

| Phase | Contenu | Critère de sortie |
|---|---|---|
| **0 — Prototype de faisabilité** | Aller-retour code ⇄ modèle sur le logigramme ; rendu sous politique de sécurité de contenu stricte ; export PDF vectoriel avec police Marianne | Les points de vigilance de §13.2 sont levés ou une alternative est retenue |
| **1 — Socle** | Structure PWA, DSFR, pages A4/A3, mode code avec modèles, export PNG et PDF, sauvegarde et restauration JSON, brouillon | Un document multi-pages peut être produit entièrement en mode code |
| **2 — Édition visuelle** | Logigramme, puis séquence, carte mentale / organigramme, Gantt, camembert | Chaque type est utilisable sans voir le code, au clavier comme à la souris |
| **3 — Mise en service V1** | Tests de sécurité, audit d'accessibilité, nomenclature, guides, paquet Debian | Recette complète passée, nomenclature validée |
| **4 — Lots suivants** | Édition visuelle des autres types, par ordre de demande : états, entité-relation, classes, frise, quadrant… | Un type par lot, sans régression |

---

## 13. Annexes

### 13.1 Glossaire

| Terme | Définition |
|---|---|
| Mermaid | Langage et bibliothèque libres décrivant un diagramme par du texte et le rendant en image vectorielle |
| DSFR | Système de Design de l'État : composants et règles d'interface des sites de l'administration |
| PWA | Application web progressive : site installable, utilisable hors ligne grâce à un service worker |
| Service worker | Script du navigateur qui met l'application en cache et la sert sans réseau |
| CSP | Politique de sécurité de contenu : règles, transmises par le serveur, que le navigateur applique à la page |
| XSS | Injection de script dans une page, exécuté dans le navigateur de la victime |
| SRI | Contrôle d'intégrité : le navigateur refuse un fichier dont l'empreinte ne correspond pas à celle déclarée |
| SBOM / nomenclature logicielle | Inventaire des composants d'un logiciel, avec versions, provenance et licences |
| CycloneDX | Format normalisé de nomenclature logicielle |
| VEX | Déclaration indiquant si une vulnérabilité connue affecte réellement le produit |
| RGAA | Référentiel général d'amélioration de l'accessibilité |
| Vendoriser | Embarquer une bibliothèque tierce dans le dépôt, à version figée, au lieu de la télécharger à l'exécution |

### 13.2 Points de vigilance à confirmer avant le développement

| # | Point | Risque | Piste |
|---|---|---|---|
| 1 | **Analyse du code Mermaid en modèle** : Mermaid n'expose pas d'interface publique stable donnant la structure d'un diagramme | L'utilisation de ses mécanismes internes peut casser à une montée de version | Analyseur propre à FUSAIN pour le sous-ensemble géré de chaque type, avec bascule en code seul au-delà (§4.3) ; corpus de tests d'aller-retour |
| 2 | **Styles en ligne et Trusted Types** avec Mermaid | Assouplissement nécessaire de `style-src` ou de Trusted Types | À mesurer en phase 0 ; `script-src` reste strict dans tous les cas |
| 3 | **PDF vectoriel** : fidélité de svg2pdf.js sur les SVG de Mermaid, et incorporation de la police Marianne (le DSFR la fournit en WOFF/WOFF2, jsPDF attend du TrueType) | Texte mal rendu ou police de substitution | Conversion de la police à l'intégration, ou texte converti en tracés, ou repli image à 300 ppp ; alternative sans dépendance : impression du navigateur avec règles `@page` |
| 4 | **Dépendances optionnelles de jsPDF** (modules chargés à la demande pour des fonctions non utilisées par FUSAIN) | Élargissement non voulu de la nomenclature | Retenir la distribution minimale ; vérifier qu'aucun chargement dynamique n'a lieu |
| 5 | **Licence du DSFR (Etalab-2.0)** : usage réservé aux entités administratives | Diffusion du code hors de l'administration | Préciser les conditions de réutilisation dans le dépôt ; choisir la licence du code propre à FUSAIN |
| 6 | **Types Mermaid en version bêta** (architecture, bloc, paquet, Sankey, graphique XY…) | Syntaxe susceptible de changer entre versions | Disponibles en mode code uniquement, signalés comme expérimentaux dans les modèles |
| 7 | **Ajustements à la souris sur le Gantt et la séquence** | Complexité de la correspondance entre position à l'écran et élément du modèle | Prioriser la grille et le panneau de propriétés ; manipulation directe en second temps |
| 8 | **Postes durablement hors ligne** | Version vulnérable conservée | Documenter la limite ; afficher l'ancienneté de la version dans « À propos » |

---

## 14. État de réalisation

État au 13 octobre 2026 (version 0.9.0) au regard de ce cahier des charges. Le détail de chaque cycle figure dans `JOURNAL_DES_VERSIONS.md`.

### 14.1 Réalisé

| Domaine | Contenu |
|---|---|
| Architecture | Fichiers statiques, modules ES sans build, bibliothèques embarquées, aucun script en ligne, service worker à cache pré-rempli et versionné, manifeste, fonctionnement hors ligne |
| Pages | Document multi-pages, pages vierges, diapositives de texte (13 mises en page reprises des diapositives libres de VALOR, dessinées en SVG aux mêmes mesures ; texte seul, sans image), A4 / A3, portrait / paysage, marges, titre, sous-titre, pied de page avec jetons, description accessible reprise dans le SVG, quatre modes d'ajustement, alerte de lisibilité |
| Édition visuelle | Logigramme, diagramme de séquence, carte mentale, Gantt, camembert, et depuis la 0.2.0 frise chronologique, tableau Kanban et matrice à quadrants (points déplaçables à la souris), depuis la 0.4.0 diagramme d'états, depuis la 0.6.0 parcours usager, graphique (tableau de données), diagramme de flux, modèle de données, diagramme de classes, architecture technique, historique de versions et structure de paquet, depuis la 0.7.0 diagramme C4 (contexte, conteneurs, composants), diagramme de blocs, diagramme d'exigences et diagramme radar, depuis la 0.8.0 carte proportionnelle (treemap) et séquence ZenUML, soit vingt-trois types : sélection, renommage sur place, ajout et liaison par la poignée, suppression, panneau de propriétés, plan du schéma, navigation au clavier |
| Mode code | Aperçu en direct, message d'erreur, dernier rendu valide conservé, bascule en « code seul » avec motif |
| Modèles | 24 modèles de schémas et 13 de diapositives ; répartis en quatre catégories, tous éditables visuellement ; page vierge |
| Export | PDF vectoriel avec police Marianne incorporée (repli en image à 300 ppp pour les schémas à contenu HTML), PNG (150 / 300 / 600 ppp, fond transparent, schéma seul), SVG |
| Fichiers | Sauvegarde et restauration JSON avec validation stricte, import de code Mermaid, brouillon local, annuler / rétablir |
| Sécurité | Politique de sécurité de contenu (avec les écarts du §7.1), Trusted Types, analyse statique automatisée, Mermaid en mode strict, filtrage des directives, assainissement du SVG par DOMPurify, échappement des libellés, validation des fichiers, intégrité (SRI) |
| Déploiement | Exemple de configuration Nginx et script de construction du paquet Debian `fusain-server`, tous deux validés en conteneur |
| Nomenclature | Document de lecture, fichier CycloneDX 1.6 avec empreinte de chaque fichier, script de génération et de vérification |
| Tests | Tests de logique et de sécurité sans navigateur ; recette automatisée dans Chrome et dans Firefox ; essais de libellés hostiles et corpus de codes malveillants ; mesures de montée en charge (`tests/tout.sh`, `tests/charge.mjs`) |

### 14.2 Reste à faire pour la V1

| Domaine | Contenu |
|---|---|
| Édition visuelle | Sélection multiple, copier / coller ; ajustement à la souris des tâches du Gantt et des messages de séquence ; présentation hiérarchique d'une carte mentale (un modèle « organigramme » en logigramme en tient lieu) ; conservation des commentaires à la réécriture ; édition visuelle des dernières écritures Mermaid (déploiement et diagramme dynamique C4) |
| Fichiers | Enregistrement direct dans le fichier d'origine sur les navigateurs qui le permettent |
| Sécurité | Délai maximal de rendu (seuls les plafonds de taille et de nombre de liens sont appliqués)  ; audit externe |
| Intégrité | Au tout premier chargement, les modules propres à FUSAIN autres que le point d'entrée ne sont pas couverts par l'attribut d'intégrité du navigateur (limite des modules ES importés) ; ils le sont dès l'installation du service worker, qui vérifie l'empreinte de chaque fichier |
| Accessibilité | Audit RGAA manuel et déclaration d'accessibilité (le contrôle automatique axe-core et le parcours au clavier sont en place et sans défaut) |
| Recette | Essais sur Safari (les recettes automatisées portent sur Chrome et Firefox) |

