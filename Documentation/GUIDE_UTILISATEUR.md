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

Vingt-sept types de schémas s'éditent visuellement : logigramme, logigramme en couloirs, diagramme de séquence, carte mentale, Gantt, camembert, frise chronologique, tableau Kanban, matrice à quadrants, diagramme d'états, parcours usager, graphique en barres et courbes, diagramme de flux, modèle de données, diagramme de classes, architecture technique, historique de versions, structure de paquet, diagramme C4, diagramme de blocs, diagramme d'exigences, diagramme radar, carte proportionnelle (treemap), séquence ZenUML, diagramme d'Ishikawa, arborescence et diagramme de Venn. Seules quelques écritures avancées (déploiement C4…) se modifient par le code (§6).

**Gestes communs**

| Geste | Effet |
|---|---|
| Clic sur un élément | Le sélectionne ; ses propriétés apparaissent à droite |
| Double-clic | Modifie son texte sur place (Entrée pour valider, Échap pour annuler) |
| Pastille orange « + » | Clic : ajoute un élément relié. Glisser vers un autre élément : les relie |
| Suppr | Supprime l'élément sélectionné |

Vous ne placez pas les éléments au pixel : FUSAIN calcule la disposition. Vous agissez sur le contenu (étapes, liens, groupes) et sur le sens de lecture.

**Au clavier** — placez le focus sur la page (touche Tab), puis : flèches pour passer d'un élément à l'autre, Entrée ou F2 pour renommer, Suppr pour supprimer, Inser ou « + » pour ajouter un élément lié. Le « plan » en bas de la colonne de droite liste tous les éléments et permet de les sélectionner, y compris avec un lecteur d'écran.

**Logigramme** — une étape peut être représentée par une icône (« Représenter par une icône… », parmi les icônes du DSFR et les icônes illustrées) : son texte s'affiche alors dessous. Sens de lecture, espacement (resserré, normal, aéré), tracé des liens (courbes, droits, en escalier), étapes (texte, forme, couleur, groupe, duplication), liens (texte, trait, extrémité, longueur, inversion), groupes imbriquables.

**Logigramme en couloirs** — un logigramme dont chaque groupe est le couloir d'un acteur (« Ajouter un couloir »). La case « Groupes en couloirs » fait passer n'importe quel logigramme d'une présentation à l'autre.

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

**Architecture technique** — services (nom, icône), groupes imbriquables et liaisons. L'icône se choisit parmi les six de Mermaid (serveur, base de données, disque, nuage, Internet, carré plein) ou, par le bouton « Autres icônes… », dans deux jeux : les 1 038 icônes du Système de Design de l'État (au trait, noms en anglais : `user`, `mail`, `computer`…) et les icônes illustrées (en couleur, noms en français : routeur, pare-feu, tribunal, réunion…), classées par thème. Dans le code, elles s'écrivent `dsfr:nom` et `illus:nom`. Pour chaque liaison, vous choisissez le côté de départ et d'arrivée : c'est ce qui guide le placement.

**Historique de versions** — commits, branches et fusions. Les ajouts se placent à la fin de l'historique, sur la « branche de travail ». La pastille « + » d'un commit ou d'une branche y ajoute un commit ; glissée vers une autre branche, elle fusionne la première dans la seconde. FUSAIN refuse les opérations que Mermaid rejetterait (fusion sans rien à fusionner, par exemple).

**Structure de paquet** — une suite de champs, chacun d'une taille en bits ; les positions sont recalculées quand vous ajoutez, déplacez ou redimensionnez un champ.

**Diagramme C4** (contexte, conteneurs, composants) — personnes, systèmes, conteneurs et composants, internes ou externes, rangés dans des limites imbriquables, et reliés par des relations (libellé, technologie, sens du tracé). Une limite vide n'est pas admise : elle disparaît avec son dernier élément.

**Diagramme de blocs** — des blocs rangés en colonnes : choisissez le nombre de colonnes, la forme et la largeur de chaque bloc, insérez des espaces, regroupez des blocs dans un groupe qui a ses propres colonnes, et reliez-les par des liens.

**Diagramme d'exigences** — exigences (nature, identifiant, énoncé, risque, méthode de vérification), éléments qui y répondent, et relations typées (contient, satisfait, vérifie, dérive de…).

**Diagramme radar** — un tableau de données : une ligne par axe, une colonne par courbe. Valeurs au centre et au bord, grille en cercles ou en polygones, légende. Chaque courbe prend une couleur différente.

**Carte proportionnelle (treemap)** — des rubriques emboîtées et des cases dont la surface suit la valeur. La pastille « + » d'une case la divise en sous-cases ; glissée sur une autre case, elle y range la première. Une rubrique vaut la somme de ce qu'elle contient.

**Séquence ZenUML** — une autre écriture du diagramme de séquence : participants (personne, base de données, file…), messages, appels avec retour et messages imbriqués, blocs (condition avec « sinon », boucle, option, en parallèle, essai). La pastille « + » d'un message ajoute sa réponse ; celle d'un participant, un message vers un nouveau participant. Ce type s'appuie sur une extension de Mermaid chargée à la première page qui l'utilise.

**Diagramme d'Ishikawa (causes et effet)** — un effet unique, des catégories (méthodes, personnel, outils…) et leurs causes. Comme pour la carte mentale : cause fille ou sœur, déplacement, rattachement à l'élément précédent ou remontée d'un niveau.

**Arborescence** — une hiérarchie d'éléments (organigramme de services, plan de site, dossiers), avec les mêmes gestes que le diagramme d'Ishikawa ; elle peut avoir plusieurs éléments de premier niveau.

**Diagramme de Venn** — jusqu'à six ensembles et les intersections que vous nommez (cochez les ensembles concernés). Une taille facultative règle la surface relative de chaque ensemble ou intersection.

**Page vierge** — une page sans schéma, pour une page de garde ou un intercalaire : seuls son titre, son sous-titre et son pied de page sont imprimés. Vous pouvez lui donner un schéma plus tard (« Choisir un schéma »).

**Matrice à quadrants** — titre, axes, nom des quatre zones, points. C'est le seul schéma où vous placez librement un élément : glissez un point à la souris dans la matrice.

## 3. Diapositives de texte

En plus des schémas, une page peut être une **diapositive de texte** : page de titre, sommaire, intercalaire, texte en colonnes, chiffres clés, frise d'étapes, blocs, ou texte libre (titres, paragraphes, puces, tableau). « Ajouter une page » les propose dans la rubrique « Diapositives de texte ».

- Les mises en page et leur style (couleurs, tailles, filets) sont ceux des diapositives libres de VALOR, conformes à la charte graphique de l'État pour les présentations. Vous ne réglez pas le style : vous choisissez une mise en page et vous écrivez les textes.
- Un clic sur un texte le sélectionne, un double-clic le modifie sur place ; la colonne de droite donne tous les champs. La pastille « + » d'un élément en ajoute un à la suite.
- Deux astérisques autour d'un passage le mettent en **gras** (`**important**`). Un retour à la ligne dans un champ est repris sur la diapositive.
- « Mise en page » change de modèle en conservant les textes qui y ont leur place.
- La diapositive remplit la zone utile de la page : le rendu de référence est l'A3 paysage ; sur un autre format, elle est mise à l'échelle.
- Icônes : dans le sommaire, les colonnes, les chiffres clés, la frise et les blocs, chaque élément peut recevoir une icône (« Ajouter une icône… ») ; dans le texte libre, « Icône » ajoute un bloc icône. Ce sont les mêmes jeux que pour les schémas : icônes du DSFR et icônes illustrées.
- Les images libres (photos, logos) ne sont pas prises en charge.

## 4. Cartes

Une page peut aussi être une **carte thématique**, avec le moteur de SimpleCarto : « Ajouter une page », rubrique « Cartes ». Cinq modèles servent de point de départ : monde, région du monde, France (départements), région (départements) et EPCI (communes) ; le panneau propose aussi la région détaillée à la commune, le département et la commune seule.

- **Échelle et zone** : en tête du panneau. Selon l'échelle, choisissez la région du monde (ou « Pays ayant des données »), la région, le département, l'EPCI ou la commune.
- **Données** : « Importer un fichier CSV… » lit un fichier séparé par des points-virgules, des virgules ou des tabulations. Indiquez la colonne des codes (INSEE pour les communes et départements, SIREN pour les EPCI, ISO à trois lettres pour les pays) et le calcul : valeur (somme par territoire), part du total, ratio de deux colonnes ou évolution de l'une à l'autre. À l'échelle des départements, un code de commune est ramené à son département. Seuls les territoires de la carte sont gardés. Pour essayer, la fenêtre « À propos » propose trois fichiers d'exemple (départements, communes, pays du monde), aux valeurs fictives.
- Un **clic sur un territoire** le sélectionne : vous pouvez saisir ou corriger sa valeur, lui donner une étiquette à la place de son nom. Le double-clic modifie l'étiquette sur place.
- **Couleurs** : dégradé Bleu France, deux palettes divergentes (vert-jaune-rouge et l'inverse) ou une palette personnalisée de deux ou trois couleurs ; couleurs du fond, des territoires voisins et des territoires sans donnée ; légende des valeurs.
- **Étiquettes** : nom, valeur, ou les deux, placées sans chevauchement ; elles peuvent être limitées à certains noms ou codes, ou aux territoires dont la valeur de filtre passe un seuil (« >= 1000 »).
- **Fonds de carte** (France métropolitaine) : relief, cours d'eau, voies ferrées, routes nationales, et le réseau routier de ROUTE 500 classé par fonction (autoroutes et voies rapides, liaisons principales, liaisons régionales). ROUTE 500 n'est plus mis à jour par l'IGN depuis 2021 : une route ouverte depuis n'y figure pas.
- **Épingles** (un point ou une icône à une latitude et une longitude, avec libellé et légende ; « Épingle à une adresse… » la place à une adresse de la Base Adresse Nationale, choisie par département, commune, voie et numéro), **pictogrammes** (icônes du DSFR ou illustrées) et **annotations** (bulle de texte et flèche) : ajoutez-les depuis le panneau, puis glissez-les à la souris sur la carte ; pour une annotation, la bulle et la pointe de la flèche se déplacent séparément.

Les contours des communes et les fonds de carte sont téléchargés à la première carte qui en a besoin, puis restent disponibles hors ligne. Comme dans SimpleCarto, les départements et régions d'outre-mer sont dessinés en encarts rapprochés de la métropole.

## 5. La page

Dans la colonne de droite, bloc « Page » : format (A4, A3), orientation, marges, titre, sous-titre, pied de page, taille et position du schéma.

La **description du schéma** n'est pas imprimée : elle est lue par les lecteurs d'écran et conservée dans l'export SVG. Renseignez-la en une ou deux phrases pour les personnes qui ne voient pas le schéma. Le pied de page accepte les jetons `{n}`, `{total}` et `{date}`.

FUSAIN vous avertit si le texte devient trop petit pour être lu une fois imprimé : passez en A3, changez d'orientation ou allégez le schéma.

Chaque page a son propre format : un même document peut mêler A4 et A3.

## 6. Le mode code

Le bouton « Code » affiche le code Mermaid de la page à côté de l'aperçu, mis à jour pendant la frappe. En cas d'erreur, le dernier aperçu valide reste affiché et le message indique la ligne concernée.

L'étiquette au-dessus de l'éditeur indique si la page reste éditable visuellement. Si vous utilisez une écriture avancée que l'éditeur visuel ne connaît pas, la page passe en « code seul » : rien n'est perdu, elle se modifie simplement par le code.

Pour quitter la zone de code au clavier : Échap, puis Tab.

## 7. Enregistrer et exporter

- **Enregistrer** produit un fichier `.fusain.json` contenant tout le document. C'est votre sauvegarde : conservez-le.
- **Ouvrir** recharge un tel fichier (ou glissez-le sur la fenêtre). Un fichier `.mmd` ou `.txt` contenant du code Mermaid est ajouté comme nouvelle page.
- **Exporter** : PDF (vectoriel, une page par page du document), PNG (150, 300 ou 600 ppp, fond transparent possible, schéma seul possible) ou SVG.

Le brouillon conservé automatiquement par le navigateur est une commodité, pas une sauvegarde : il disparaît si vous effacez les données du navigateur.

## 8. Raccourcis

| Touches | Effet |
|---|---|
| Ctrl+Z / Ctrl+Y | Annuler / rétablir |
| Ctrl+S | Enregistrer |
| Ctrl+O | Ouvrir |

## 9. Hors ligne

Après une première visite, FUSAIN fonctionne sans réseau et peut être installé comme une application depuis le menu du navigateur. Quand une nouvelle version est publiée, un bandeau propose la mise à jour.
