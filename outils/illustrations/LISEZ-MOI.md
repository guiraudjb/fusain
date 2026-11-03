# Icônes illustrées de FUSAIN

Les schémas d'architecture peuvent utiliser des icônes illustrées, en couleur (`illus:nom` dans le code).
Elles sont produites localement, sans service en ligne, et rangées par thème dans `icones/illustrees/`.

| Source | Contenu |
|---|---|
| SimpleCarto (`icons/pictograms-k2` du dépôt local) | 293 icônes en 12 thèmes : informatique et réseaux, énergie, transports, finances publiques… |
| FUSAIN (`icon-prompts.json` de ce dossier) | Les thèmes absents de SimpleCarto et du DSFR : justice et droit, éducation et formation, santé et action sociale, ressources humaines, gestion de projet, logiciels et données |

## Ajouter ou refaire des icônes

1. Décrire l'icône dans `icon-prompts.json` : identifiant, thème, nom français, sujet en anglais.
2. Générer avec Krea 2 sur un nœud de calcul du labo (gpu-a ou gpu-b, environ 40 s par image, deux variantes par icône).
   Le script attend que la carte soit libre ; avec l'outillage des ateliers, la réservation se fait par `gpu.reserver_pour_le_script` :

       D=/home/adm1/Projets/.labo/fusain-icones
       cd ~/aitools/krea-2 && .venv/bin/python3 <dépôt>/outils/illustrations/generate_icons.py --only id1,id2 --seeds 2 --out $D/brutes

3. Détourer (rembg, modèle BiRefNet présent sur les nœuds) et produire la planche contact `planche.html` :

       ~/.venvs/rembg/bin/python cutout_icons.py --raw $D/brutes --out $D/detourees --only id1,id2 --modele birefnet-general

4. Installer : la variante la plus propre est retenue, ou celle imposée dans `selection.json` (`{"identifiant": graine}`).
   Les icônes déjà livrées sont gardées telles quelles ; seules celles dont l'image détourée est présente sont refaites.

       python3 installer.py

5. `python3 outils/generer.py`, puis la recette.

`generate_icons.py` et `cutout_icons.py` sont repris du dépôt SimpleCarto (`tools/icons/`). Les images brutes et détourées
restent hors du dépôt (`/home/adm1/Projets/.labo/fusain-icones`) ; seuls les fichiers réduits (192 px, 128 couleurs, environ 5 Ko par icône) sont livrés.
