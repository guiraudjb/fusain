<!-- title: FUSAIN — Nomenclature des composants logiciels (SBOM) -->

# Nomenclature des composants logiciels (SBOM) — FUSAIN

| Champ | Valeur |
|---|---|
| Date | 13 octobre 2026 |
| Version de FUSAIN | 0.1.0 |
| Périmètre | Tout ce qui est servi au navigateur : code propre à FUSAIN et cinq bibliothèques embarquées |
| Format | Ce document (lecture) + `sbom/fusain-sbom-cyclonedx.json` (CycloneDX 1.6, avec l'empreinte SHA-256 de chaque fichier embarqué) |
| Source | `sbom/composants.json`, tenu à la main ; le reste est calculé par `outils/generer.py` |
| Dernier contrôle des vulnérabilités | 13 octobre 2026 — OSV.dev, sur les versions exactes : aucune vulnérabilité connue |

**Journal des révisions**

| # | Date | Contenu |
|---|---|---|
| 1 | 13/10/2026 | Version initiale. Cinq bibliothèques embarquées à leur dernière version amont du jour, contrôle OSV.dev sans résultat. |

---

## 1. Contexte

La directive (UE) 2022/2555, dite NIS2, demande aux entités qu'elle désigne de maîtriser leur chaîne d'approvisionnement logicielle et de traiter les vulnérabilités de leurs systèmes. Ce document donne à l'entité qui déploie FUSAIN la composition exacte du logiciel et la marche à suivre pour le maintenir à jour.

FUSAIN est un ensemble de fichiers statiques exécutés dans le navigateur. Il n'a ni serveur applicatif, ni base de données, ni étape de build, ni dépendance téléchargée à l'exécution : la totalité de ses composants se trouve dans le dépôt, sous `libs/`.

## 2. Composants embarqués

| Composant | Version | Rôle | Licence | Fichiers embarqués | Dossier |
|---|---|---|---|---|---|
| DSFR (`@gouvfr/dsfr`) | 1.15.4 | Système de Design de l'État : styles, script, police Marianne, icônes | Etalab-2.0 | Sous-ensemble de `dist/` : `dsfr.min.css`, `dsfr.module.min.js`, polices WOFF2, favicon, icônes utilisées | `libs/dsfr-v1.15.4/` |
| Mermaid | 12.1.0 | Analyse et rendu des diagrammes | MIT | `dist/mermaid.min.js` | `libs/mermaid-v12.1.0/` |
| DOMPurify | 3.4.17 | Assainissement du SVG avant insertion dans la page | MPL-2.0 ou Apache-2.0 | `dist/purify.min.js` | `libs/dompurify-v3.4.17/` |
| jsPDF | 4.2.1 | Génération du fichier PDF | MIT | `dist/jspdf.umd.min.js` | `libs/jspdf-v4.2.1/` |
| svg2pdf.js | 2.8.1 | Conversion vectorielle SVG → PDF | MIT | `dist/svg2pdf.umd.min.js` | `libs/svg2pdf-v2.8.1/` |

### 2.1 Provenance et intégrité

Chaque composant provient de l'archive officielle du registre npm, dont l'empreinte SHA-256 a été relevée au téléchargement :

| Composant | Archive | SHA-256 de l'archive |
|---|---|---|
| DSFR | `https://registry.npmjs.org/@gouvfr/dsfr/-/dsfr-1.15.4.tgz` | `e40bfe360002f7e8c3b62b11d9433fdf2d0ecc670b4fd48453b8b7beb603a8eb` |
| Mermaid | `https://registry.npmjs.org/mermaid/-/mermaid-12.1.0.tgz` | `3e516f33246e1a6a5bc5ebcabd35434669b487c3b3791f9b0466aa2c254d004a` |
| DOMPurify | `https://registry.npmjs.org/dompurify/-/dompurify-3.4.17.tgz` | `056cbdae276897208b88c21d1d779adfa09ad7be488a2f510a28e900d3bbffe7` |
| jsPDF | `https://registry.npmjs.org/jspdf/-/jspdf-4.2.1.tgz` | `e97bd16e3211928442c631b20dcefa78a8e10dad8ccbe97160b89b214745603a` |
| svg2pdf.js | `https://registry.npmjs.org/svg2pdf.js/-/svg2pdf.js-2.8.1.tgz` | `5fdfdf4f540a80911c59b0eb2e72d9c8653558e9917ac2286a240f153f2ff40a` |

L'empreinte SHA-256 de **chaque fichier embarqué** figure dans `sbom/fusain-sbom-cyclonedx.json`. Les scripts et feuilles de style chargés par `index.html` portent en outre un attribut d'intégrité (SRI) : le navigateur refuse un fichier altéré.

### 2.2 Particularités

- **Fichiers dérivés** — `libs/dsfr-v1.15.4/fonts-ttf/` contient Marianne Regular et Bold convertis de WOFF2 en TrueType avec fontTools, pour l'incorporation dans les PDF (jsPDF n'accepte que le TrueType). Ces deux fichiers ne figurent pas dans l'archive d'origine ; ils sont à régénérer à chaque mise à jour du DSFR.
- **DSFR partiel** — seules les icônes réellement utilisées sont embarquées ; `icons.min.css` référence les autres, qui ne sont jamais demandées.
- **Dépendances incluses dans Mermaid** — `mermaid.min.js` est une distribution autonome qui contient ses propres dépendances (moteurs de disposition, analyseurs, D3, un DOMPurify interne). Elles ne sont pas détaillées ici : leur suivi passe par les avis de sécurité de Mermaid.
- **Dépendances optionnelles de jsPDF** — html2canvas, canvg et dompurify ne sont ni embarquées ni chargées : la fonction `html()` de jsPDF n'est pas utilisée.

## 3. Hors du produit livré

| Élément | Nature | Suivi |
|---|---|---|
| Navigateur de l'utilisateur | Socle d'exécution | Relève de l'entité (mise à jour des postes) |
| Serveur de fichiers (GitHub Pages pour la publication de référence) | Hébergement statique | Relève de l'hébergeur |
| `outils/generer.py`, tests | Outils de développement (Python 3, Node.js, bibliothèque standard uniquement) | Ne sont jamais servis au navigateur |

## 4. Points d'attention

| # | Constat | Sévérité | Suite |
|---|---|---|---|
| 1 | La politique de sécurité de contenu autorise les styles en ligne (`style-src 'unsafe-inline'`) : Mermaid insère une feuille de style dans chaque SVG | À noter | Les scripts restent strictement limités à l'origine ; les feuilles de style du SVG sont filtrées (`@import` et `url()` externes retirés) |
| 2 | Sur GitHub Pages, la politique est délivrée par balise `<meta>` : `frame-ancestors` et les autres en-têtes HTTP de sécurité ne peuvent pas y être posés | Attention | Pour un usage en production, servir FUSAIN depuis un serveur maîtrisé avec les en-têtes du cahier des charges §7.1 |
| 3 | Mermaid 12 est une version majeure récente | À noter | Recette complète rejouée à chaque montée de version |
| 4 | Aucune licence n'est encore fixée pour le code propre à FUSAIN ; le DSFR (Etalab-2.0) est réservé aux entités administratives | À noter | À trancher avant toute diffusion hors de l'administration |
| 5 | Un poste resté hors ligne conserve l'ancienne version jusqu'à sa prochaine connexion | À noter | Limite inhérente au fonctionnement hors ligne ; la version est affichée dans « À propos » |

## 5. Méthode de mise à jour

### 5.1 Veille

| Source | Fréquence |
|---|---|
| [OSV.dev](https://osv.dev/), interrogé sur la version exacte de chaque composant | Mensuelle, et avant chaque version |
| Avis de sécurité GitHub et notes de version des cinq projets | Mensuelle |
| Bulletins du CERT-FR | En continu |

Commande de contrôle, à lancer depuis n'importe quel poste connecté (exemple pour Mermaid) :

```bash
curl -s -X POST https://api.osv.dev/v1/query \
  -d '{"package":{"name":"mermaid","ecosystem":"npm"},"version":"12.1.0"}'
```

Une réponse `{}` signifie qu'aucune vulnérabilité n'est connue pour cette version. Le fichier CycloneDX peut aussi être soumis tel quel à `osv-scanner` ou à tout outil équivalent. Chaque contrôle est daté dans le journal en tête de ce document, y compris lorsqu'il ne révèle rien.

### 5.2 Délais cibles

| Sévérité | Délai de correction après publication du correctif amont |
|---|---|
| Critique, ou exploitation active constatée | 72 heures |
| Élevée | 7 jours |
| Moyenne | 30 jours |
| Faible | Version suivante |

Une vulnérabilité non atteignable dans FUSAIN peut être classée sans action, à condition d'en écrire l'analyse au §4.

### 5.3 Procédure pour mettre à jour un composant

1. Télécharger l'archive de la version cible depuis le registre npm (`npm pack <paquet>@<version>`) et relever son empreinte (`sha256sum`).
2. Lire les notes de version : changements incompatibles, correctifs de sécurité.
3. Copier les fichiers utiles dans un nouveau dossier `libs/<composant>-v<version>/` et supprimer l'ancien.
4. Mettre à jour les chemins dans `index.html` (et `DOSSIER_DSFR` dans `js/rendu.js` pour le DSFR).
5. Mettre à jour l'entrée du composant dans `sbom/composants.json` (version, archive, empreinte).
6. Incrémenter la version dans `js/version.js`.
7. Lancer `python3 outils/generer.py` : attributs d'intégrité, liste et version du cache, nomenclature CycloneDX.
8. Rejouer la recette : `node --test tests/logique.test.mjs`, puis `tests/recette.mjs` dans un navigateur.
9. Mettre à jour ce document (tableaux §2, journal) et publier.

Avant toute publication, `python3 outils/generer.py --verifier` doit se terminer sans écart : il garantit que la page, le service worker et la nomenclature décrivent bien les fichiers présents.

### 5.4 Propagation aux postes

À l'ouverture suivante de l'application, le service worker détecte la nouvelle version et un bandeau propose la mise à jour ; elle s'applique au rechargement, sans perte du travail en cours (le brouillon est enregistré juste avant).

## 6. Limites

- Les composants inclus dans `mermaid.min.js` ne sont pas énumérés individuellement.
- Le contrôle des vulnérabilités est manuel ; il n'est pas automatisé dans une chaîne d'intégration.
- Aucun audit de sécurité externe n'a encore été mené.
