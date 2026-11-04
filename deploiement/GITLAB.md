# FUSAIN sur un GitLab privé

Le dépôt peut être hébergé sur un GitLab privé, en plus de GitHub, et l'application servie par GitLab Pages. Trois fichiers servent à cela :

- `.gitlab-ci.yml` : le pipeline ;
- `deploiement/ajouter-gitlab.sh` : le rattachement du dépôt ;
- `deploiement/copier-site.sh` : la liste des fichiers publiés, la même que pour le paquet Debian.

## 1. Préparer le projet GitLab

1. Créer un projet **vide**, sans fichier README, de visibilité « Privé ». Par exemple `groupe/fusain`.
2. Vérifier qu'un exécuteur (runner) de type Docker est disponible : Paramètres > CI/CD > Exécuteurs.
3. Vérifier que GitLab Pages est activé sur l'instance : le menu Déploiement > Pages doit exister. Sinon, demander à l'administrateur.

## 2. Rattacher et pousser

Depuis la racine du dépôt, une fois les modifications committées :

```bash
deploiement/ajouter-gitlab.sh git@gitlab.exemple.fr:groupe/fusain.git
```

Le script :

1. contrôle les empreintes (`outils/generer.py --verifier`) ;
2. ajoute le dépôt distant `gitlab`, GitHub restant `origin` ;
3. pousse la branche `main` et les étiquettes.

Ensuite, `Upload.sh` pousse vers les deux dépôts.

## 3. Le pipeline

| Travail | Rôle | Image |
|---|---|---|
| `coherence` | SRI de `index.html`, cache de `sw.js` et nomenclature CycloneDX conformes aux fichiers | `python:3.13-slim` |
| `logique` | Tests de logique et de sécurité, sans navigateur (`node --test`) | `node:22-bookworm-slim` |
| `pages` | Copie des seuls fichiers servis dans `public/`, publiée par GitLab Pages, sur `main` uniquement et après les deux contrôles | `alpine:3.22` |

La recette navigateur complète (Chrome, Firefox, accessibilité, robustesse, fidélité) reste sur GitHub : elle demande Chrome et geckodriver sur l'exécuteur.

**Instance sans accès à Internet.** Les images viennent de Docker Hub. On peut les remplacer par celles du proxy de dépendances ou du registre interne, en définissant `IMAGE_PYTHON`, `IMAGE_NODE` et `IMAGE_PAGES` dans Paramètres > CI/CD > Variables. Par exemple : `$CI_DEPENDENCY_PROXY_GROUP_IMAGE_PREFIX/python:3.13-slim`.

## 4. La page web

- L'adresse apparaît dans Déploiement > Pages après le premier pipeline réussi. Elle est de la forme `https://groupe.pages.exemple.fr/fusain/`, ou un domaine unique propre au projet.
- Tous les chemins de FUSAIN sont relatifs : l'application, le service worker et le mode hors ligne fonctionnent dans un sous-dossier comme à la racine.
- **Accès réservé** : si l'administrateur a activé le contrôle d'accès de Pages, régler Paramètres > Général > Visibilité > Pages sur « Membres du projet uniquement ». La page demande alors de se connecter à GitLab.
- **HTTPS** est indispensable au service worker et à l'installation de l'application. GitLab Pages doit être servi en HTTPS.

### Taille du site

Le site publié pèse environ 420 Mo sur disque (35 000 fichiers), dont 314 Mo d'adresses (`cartes/adresses/`, Base Adresse Nationale). GitLab mesure l'archive compressée de l'artefact : environ 145 Mo (mesure du 4 novembre 2026). Les deux limites de l'instance sont de 100 Mo par défaut. L'administrateur doit donc les relever, à 250 Mo par exemple :

- Administration > Paramètres > CI/CD > « Taille maximale des artefacts » ;
- Administration > Paramètres > Préférences > Pages > « Taille maximale des pages ».

On peut aussi les relever pour ce seul projet, ou pour son groupe, dans leurs paramètres CI/CD (droit d'administrateur requis).

### Ce que GitLab Pages ne fait pas

GitLab Pages, comme GitHub Pages, ne permet pas de poser des en-têtes HTTP. La politique de sécurité de contenu s'applique par la balise `<meta>` de `index.html`, avec les écarts décrits au cahier des charges §7.1 : `frame-ancestors`, entre autres, n'y a pas d'effet. Pour l'ensemble des en-têtes de sécurité, servir FUSAIN par Nginx (`deploiement/nginx-fusain.conf`, ou le paquet `deploiement/construire-deb.sh`).
