# Icônes illustrées de FUSAIN

Les schémas d'architecture peuvent utiliser des icônes illustrées, en couleur (`illus:nom` dans le code).
Elles sont produites localement, sans service en ligne, et rangées par thème dans `icones/illustrees/`.

| Source | Contenu |
|---|---|
| SimpleCarto (`icons/pictograms-k2` du dépôt local) | 293 icônes en 12 thèmes : informatique et réseaux, énergie, transports, finances publiques… |
| FUSAIN (`icon-prompts.json` de ce dossier) | Les thèmes absents de SimpleCarto et du DSFR : justice et droit, éducation et formation, santé et action sociale, ressources humaines, gestion de projet, logiciels et données |

## Ajouter ou refaire des icônes

1. Décrire l'icône dans `icon-prompts.json` : identifiant, thème, nom français, sujet en anglais.
2. Générer avec Krea 2 (carte graphique libre, environ 40 s par image, deux variantes par icône) :

       K=/home/adm1/RAID/aitools/krea-2
       OSS_TURBO=$K/checkpoints/krea2_turbo_fp8_scaled.safetensors $K/.venv/bin/python3 -u generate_icons.py --seeds 2 --out $K/outputs/fusain-icons/raw

3. Détourer (rembg) et produire la planche contact `planche.html` :

       /home/adm1/RAID/venv/bin/python cutout_icons.py --raw $K/outputs/fusain-icons/raw --out $K/outputs/fusain-icons/cutout

4. Installer : la variante la plus propre est retenue, ou celle imposée dans `selection.json` (`{"identifiant": graine}`).

       /home/adm1/RAID/venv/bin/python installer.py

5. `python3 outils/generer.py`, puis la recette.

`generate_icons.py` et `cutout_icons.py` sont repris du dépôt SimpleCarto (`tools/icons/`). Les images brutes et détourées
restent hors du dépôt ; seuls les fichiers réduits (192 px, 128 couleurs, environ 5 Ko par icône) sont livrés.
