# Journal des versions — FUSAIN

Chaque version suit le même cycle : mesure ou essai → correction → recette (logique, Chrome, Firefox) → publication.

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
