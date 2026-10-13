# FUSAIN — Guide utilisateur

FUSAIN sert à produire des schémas (logigrammes, plannings, organigrammes, cartes mentales…) prêts à imprimer ou à insérer dans un document. Tout se passe dans votre navigateur : rien n'est envoyé sur un serveur.

## 1. L'écran

| Zone | Rôle |
|---|---|
| Barre d'outils | Nouveau, Ouvrir, Enregistrer, Exporter, Annuler / Rétablir, zoom, bascule Visuel / Code, Modèles |
| Colonne de gauche | Les pages du document. « Ajouter une page » propose une page vierge ou un modèle de départ |
| Centre | La page, à ses proportions réelles. Le cadre en pointillés montre les marges (il n'est pas exporté) |
| Colonne de droite | Les propriétés de l'élément sélectionné, puis celles de la page et du document |

## 2. Construire un schéma sans coder

Dix-sept types de schémas s'éditent visuellement : logigramme, diagramme de séquence, carte mentale, Gantt, camembert, frise chronologique, tableau Kanban, matrice à quadrants, diagramme d'états, parcours usager, graphique en barres et courbes, diagramme de flux, modèle de données, diagramme de classes, architecture technique, historique de versions et structure de paquet. Les quelques types restants de Mermaid se modifient par le code (§4).

**Gestes communs**

| Geste | Effet |
|---|---|
| Clic sur un élément | Le sélectionne ; ses propriétés apparaissent à droite |
| Double-clic | Modifie son texte sur place (Entrée pour valider, Échap pour annuler) |
| Pastille orange « + » | Clic : ajoute un élément relié. Glisser vers un autre élément : les relie |
| Suppr | Supprime l'élément sélectionné |

Vous ne placez pas les éléments au pixel : FUSAIN calcule la disposition. Vous agissez sur le contenu (étapes, liens, groupes) et sur le sens de lecture.

**Au clavier** — placez le focus sur la page (touche Tab), puis : flèches pour passer d'un élément à l'autre, Entrée ou F2 pour renommer, Suppr pour supprimer, Inser ou « + » pour ajouter un élément lié. Le « plan » en bas de la colonne de droite liste tous les éléments et permet de les sélectionner, y compris avec un lecteur d'écran.

**Logigramme** — sens de lecture, espacement (resserré, normal, aéré), tracé des liens (courbes, droits, en escalier), étapes (texte, forme, couleur, groupe, duplication), liens (texte, trait, extrémité, longueur, inversion), groupes imbriquables.

**Diagramme de séquence** — participants (boîte ou personnage), messages, notes, blocs (boucle, alternative…), numérotation. Les ajouts se placent après l'élément sélectionné ; les flèches haut / bas le déplacent.

**Carte mentale** — idée fille, idée sœur, déplacement dans l'arborescence, forme de chaque idée.

**Gantt** — titre, format des dates, jours exclus, sections et tâches. Une tâche a un début (une date, ou `after` suivi de l'identifiant d'une autre tâche) et une durée (`5d`, `2w`) ou une date de fin.

**Camembert** — libellés, valeurs et couleur de chaque part ; vous pouvez coller deux colonnes copiées depuis un tableur.

**Frise chronologique** — périodes, événements de chaque période, sections. La pastille « + » d'une période lui ajoute un événement.

**Tableau Kanban** — colonnes et cartes. Pour changer une carte de colonne, glissez sa pastille « + » sur la colonne voulue.

**Diagramme d'états** — états et transitions (événement ou condition). Cochez « État initial » ou « État final » pour relier un état au point de départ ou d'arrivée ; la pastille « + » crée l'état suivant, ou relie deux états si vous la glissez de l'un à l'autre. Les états composés, notes et branchements se font par le code.

**Parcours usager** — sections et étapes ; chaque étape a une note de satisfaction de 1 à 5 et des acteurs séparés par des virgules.

**Graphique** — un tableau de données dans la colonne de droite : une ligne par catégorie, une colonne par série (barres ou courbe). Un clic sur une barre sélectionne sa valeur. Titres des axes, valeurs minimale et maximale, barres horizontales.

**Diagramme de flux (Sankey)** — des postes reliés par des flux chiffrés. La pastille « + » d'un poste crée un flux sortant ; glissée vers un autre poste, elle les relie. Un flux ne peut pas revenir vers son origine. Mermaid n'accepte pas les accents dans ce type de schéma : FUSAIN les retire des noms.

**Modèle de données** — entités, attributs (type, nom, clé, commentaire) et associations avec la cardinalité de chaque côté. Un clic sur un attribut le sélectionne ; un clic sur le titre sélectionne l'entité.

**Diagramme de classes** — classes, stéréotype, attributs et méthodes, relations (héritage, composition, agrégation, flèche, trait plein ou pointillé, multiplicités). Notes, espaces de noms et génériques se font par le code.

**Architecture technique** — services (nom, icône), groupes imbriquables et liaisons. Pour chaque liaison, vous choisissez le côté de départ et d'arrivée : c'est ce qui guide le placement.

**Historique de versions** — commits, branches et fusions. Les ajouts se placent à la fin de l'historique, sur la « branche de travail ». La pastille « + » d'un commit ou d'une branche y ajoute un commit ; glissée vers une autre branche, elle fusionne la première dans la seconde. FUSAIN refuse les opérations que Mermaid rejetterait (fusion sans rien à fusionner, par exemple).

**Structure de paquet** — une suite de champs, chacun d'une taille en bits ; les positions sont recalculées quand vous ajoutez, déplacez ou redimensionnez un champ.

**Page vierge** — une page sans schéma, pour une page de garde ou un intercalaire : seuls son titre, son sous-titre et son pied de page sont imprimés. Vous pouvez lui donner un schéma plus tard (« Choisir un schéma »).

**Matrice à quadrants** — titre, axes, nom des quatre zones, points. C'est le seul schéma où vous placez librement un élément : glissez un point à la souris dans la matrice.

## 3. La page

Dans la colonne de droite, bloc « Page » : format (A4, A3), orientation, marges, titre, sous-titre, pied de page, taille et position du schéma.

La **description du schéma** n'est pas imprimée : elle est lue par les lecteurs d'écran et conservée dans l'export SVG. Renseignez-la en une ou deux phrases pour les personnes qui ne voient pas le schéma. Le pied de page accepte les jetons `{n}`, `{total}` et `{date}`.

FUSAIN vous avertit si le texte devient trop petit pour être lu une fois imprimé : passez en A3, changez d'orientation ou allégez le schéma.

Chaque page a son propre format : un même document peut mêler A4 et A3.

## 4. Le mode code

Le bouton « Code » affiche le code Mermaid de la page à côté de l'aperçu, mis à jour pendant la frappe. En cas d'erreur, le dernier aperçu valide reste affiché et le message indique la ligne concernée.

L'étiquette au-dessus de l'éditeur indique si la page reste éditable visuellement. Si vous utilisez une écriture avancée que l'éditeur visuel ne connaît pas, la page passe en « code seul » : rien n'est perdu, elle se modifie simplement par le code.

Pour quitter la zone de code au clavier : Échap, puis Tab.

## 5. Enregistrer et exporter

- **Enregistrer** produit un fichier `.fusain.json` contenant tout le document. C'est votre sauvegarde : conservez-le.
- **Ouvrir** recharge un tel fichier (ou glissez-le sur la fenêtre). Un fichier `.mmd` ou `.txt` contenant du code Mermaid est ajouté comme nouvelle page.
- **Exporter** : PDF (vectoriel, une page par page du document), PNG (150, 300 ou 600 ppp, fond transparent possible, schéma seul possible) ou SVG.

Le brouillon conservé automatiquement par le navigateur est une commodité, pas une sauvegarde : il disparaît si vous effacez les données du navigateur.

## 6. Raccourcis

| Touches | Effet |
|---|---|
| Ctrl+Z / Ctrl+Y | Annuler / rétablir |
| Ctrl+S | Enregistrer |
| Ctrl+O | Ouvrir |

## 7. Hors ligne

Après une première visite, FUSAIN fonctionne sans réseau et peut être installé comme une application depuis le menu du navigateur. Quand une nouvelle version est publiée, un bandeau propose la mise à jour.
