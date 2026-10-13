# Journal des versions — FUSAIN

Chaque version suit le même cycle : mesure ou essai → correction → recette (logique, Chrome, Firefox) → publication.

## 0.3.1 — 13 octobre 2026 — accessibilité

- **Contrôle automatique** avec axe-core (`tests/accessibilite.mjs`, règles WCAG 2.1 A et AA automatisables) sur neuf états de l'interface : édition visuelle, sélection d'une étape et d'un lien, mode code avec et sans erreur, trois modales, thème sombre. Défauts trouvés et corrigés : absence de titre de niveau 1, hiérarchie des titres rompue par les alertes. Résultat : aucune règle en défaut.
- **Parcours au clavier seul** ajouté à la recette : sélectionner une étape, lui ajouter une étape liée, la nommer, la renommer sur place, la supprimer — sans souris.
- Limite : un contrôle automatique ne couvre qu'une partie du RGAA ; l'audit manuel et la déclaration d'accessibilité restent à faire.

## 0.3.0 — 13 octobre 2026 — pages, accessibilité, chemin de mise à jour

- **Sous-titre** de page et **description accessible** du schéma (lue par les lecteurs d'écran, conservée dans l'export SVG), valables pour tous les types de schémas.
- **Format de fichier en version 2** pour porter ces deux champs. Les fichiers de version 1 s'ouvrent sans intervention ; une version plus ancienne de FUSAIN refuse proprement un fichier plus récent en invitant à se mettre à jour.
- Indicateur d'occupation pendant le calcul d'un grand schéma.
- **Essais** : suites de 12 opérations aléatoires (ajouts, liaisons, suppressions, renommages) sur les huit éditeurs — 300 suites, le schéma reste valide à chaque pas. Nouveau test du **chemin de mise à jour** (`tests/mise-a-jour.mjs`) : un poste ayant l'ancienne version en cache voit le bandeau, se met à jour, retrouve son travail et n'a plus que le nouveau cache.

## 0.2.1 — 13 octobre 2026 — durcissement

- **Trusted Types activé** : dans les navigateurs qui le prennent en charge, toute écriture de HTML — y compris par Mermaid et le DSFR — passe par DOMPurify, et la création de script à partir de texte est refusée. Aucune régression sur les recettes Chrome et Firefox.
- **Analyse statique** ajoutée aux tests : aucune écriture HTML directe, aucune exécution dynamique, aucun script ni gestionnaire en ligne dans le code de FUSAIN.
- **Exemple de configuration Nginx** (`deploiement/nginx-fusain.conf`) posant la politique complète par en-têtes HTTP. Validé dans un conteneur Nginx 1.30 : en-têtes présents, encadrement par un site tiers bloqué, dossiers internes (`.git`, `outils`, `tests`) non servis, méthodes autres que GET / HEAD refusées.

## 0.2.0 — 13 octobre 2026 — trois nouveaux éditeurs visuels

- Édition visuelle de la **frise chronologique**, du **tableau Kanban** et de la **matrice à quadrants** : huit types de schémas s'éditent désormais sans coder.
- Matrice : les points se placent en les glissant à la souris (seul type de schéma à position libre).
- Kanban : une carte change de colonne en glissant sa pastille sur la colonne voulue.
- Les trois éditeurs sont couverts par les essais de libellés hostiles (200 essais chacun) et par la recette Chrome (43 contrôles).

## 0.1.2 — 13 octobre 2026 — robustesse et sécurité

**Essais** — nouvelle recette `tests/robustesse.mjs` : des libellés aléatoires hostiles (guillemets, crochets, balises, mots réservés, directives) sont injectés par les cinq éditeurs visuels, 400 essais par type ; le code produit doit rester valide pour Mermaid, se relire à l'identique et conserver le même nombre d'éléments. S'y ajoute un corpus de 14 codes malveillants, rendus puis inspectés. `tests/tout.sh` enchaîne désormais toutes les recettes.

**Corrections**

- Un libellé commençant par un accent grave rendait le schéma invalide (Mermaid y voyait une « chaîne Markdown ») : l'accent grave et la tabulation sont maintenant encodés.
- Gantt : un nom de tâche commençant par un mot-clé (`title`, `click`, `section`…) était lu comme une instruction : il est mis entre guillemets français.
- Sécurité : la forme étendue `@{ img: "https://…" }` faisait demander l'image par Mermaid pendant le rendu, avant tout assainissement. La politique de sécurité de contenu bloquait déjà la requête ; l'instruction est désormais retirée du code avant le rendu.

## 0.1.1 — 13 octobre 2026 — montée en charge et essais croisés

**Mesures** (`tests/charge.mjs`, Chrome, poste de développement)

| Opération | Temps |
|---|---|
| Analyse + réécriture d'un logigramme de 400 étapes | 5 ms |
| Rendu d'un logigramme de 50 / 200 / 400 étapes | 0,3 s / 1,0 s / 2,3 s |
| Ouverture d'un document de 30 pages (toutes vignettes) | 5,2 s |
| Modification d'une page dans ce document | 0,2 s |
| PNG A3 à 300 ppp / 600 ppp, 200 étapes | 0,1 s / 0,3 s |
| PDF vectoriel, 1 page A3 de 200 étapes / 10 pages | 0,3 s / 0,6 s |

Les cibles du cahier des charges (§10) sont tenues : 200 étapes en 1 seconde, PDF de 10 pages en moins de 10 secondes.

**Essais** — nouvelle recette Firefox (`tests/firefox.mjs`, protocole WebDriver, sans dépendance) : 24 contrôles, dont le rendu des 17 types de schémas et les exports réels PDF / PNG / JSON. Validée sur Firefox 157.

**Corrections**

- Export impossible dans Chrome pour les schémas à libellés HTML (parcours usager) : ces libellés sont désormais convertis en texte SVG dès le rendu ; ces schémas s'exportent en PDF vectoriel comme les autres.
- PDF : position verticale des textes fausse dans Firefox (matrices, graphiques) ; la ligne de base est maintenant calculée à partir de la boîte des glyphes, de façon identique dans les deux navigateurs.
- Identifiants de rendu rendus uniques par instance, pour qu'un rendu ne puisse jamais retirer un schéma affiché.
- Messages en français lorsque le plafond de liens ou de taille est atteint.

## 0.1.0 — 13 octobre 2026

Première version publiée : édition visuelle de cinq types de schémas, mode code, pages A4 / A3, exports PDF / PNG / SVG, sauvegarde JSON, fonctionnement hors ligne, nomenclature logicielle.
