#!/usr/bin/env python3
"""Construit le jeu d'icônes illustrées de FUSAIN (schémas d'architecture).

Deux sources :
  - les icônes illustrées de SimpleCarto (dépôt local, dossier icons/pictograms-k2), générées avec Krea 2 ;
  - les icônes propres à FUSAIN, générées de la même façon à partir de icon-prompts.json (voir LISEZ-MOI.md).

    python3 outils/illustrations/installer.py [--simplecarto /home/adm1/SimpleCarto] [--detourees DOSSIER]

Chaque icône est ramenée à 192 px et à 128 couleurs (environ 5 Ko), puis rangée par thème dans
icones/illustrees/<theme>.json. index.json liste les thèmes, les icônes et l'empreinte de chaque fichier.
À lancer avec un Python disposant de Pillow, numpy et scipy.
"""
import argparse
import base64
import glob
import hashlib
import io
import json
import os
import pathlib

import numpy as np
from PIL import Image
from scipy.ndimage import label

RACINE = pathlib.Path(__file__).resolve().parent.parent.parent
ICI = pathlib.Path(__file__).resolve().parent
CIBLE = RACINE / "icones" / "illustrees"
COTE = 192
COULEURS = 128


def fragments(chemin):
    """Nombre de morceaux disjoints : la variante la plus propre est celle qui en a le moins."""
    alpha = np.array(Image.open(chemin).getchannel("A")) > 40
    return label(alpha)[1]


def reduire(chemin):
    image = Image.open(chemin).convert("RGBA").resize((COTE, COTE), Image.LANCZOS).quantize(COULEURS, method=Image.FASTOCTREE)
    tampon = io.BytesIO()
    image.save(tampon, "PNG", optimize=True)
    return base64.b64encode(tampon.getvalue()).decode("ascii")


def principal():
    parser = argparse.ArgumentParser()
    parser.add_argument("--simplecarto", default="/home/adm1/SimpleCarto")
    parser.add_argument("--detourees", default="/home/adm1/RAID/aitools/krea-2/outputs/fusain-icons/cutout")
    args = parser.parse_args()

    themes = {}  # id -> {nom, icones: {id: {nom, png}}}
    vus = set()

    def ajouter(icone, chemin, origine):
        if icone["id"] in vus:
            raise SystemExit(f"Identifiant en double : {icone['id']}")
        vus.add(icone["id"])
        theme = themes.setdefault(icone["theme"], {"nom": icone["theme_label"], "origine": origine, "icones": {}})
        theme["icones"][icone["id"]] = {"nom": icone["label_fr"], "png": reduire(chemin)}

    catalogue = json.load(open(os.path.join(args.simplecarto, "tools", "icons", "icon-prompts.json"), encoding="utf-8"))
    for icone in catalogue["icons"]:
        chemin = os.path.join(args.simplecarto, "icons", "pictograms-k2", icone["theme"], f"{icone['id']}.png")
        if os.path.exists(chemin):
            ajouter(icone, chemin, "SimpleCarto")

    propres = json.load(open(ICI / "icon-prompts.json", encoding="utf-8"))
    selection = json.load(open(ICI / "selection.json", encoding="utf-8")) if (ICI / "selection.json").exists() else {}
    manquantes = []
    for icone in propres["icons"]:
        variantes = sorted(glob.glob(os.path.join(args.detourees, icone["theme"], f"{icone['id']}_s*.png")))
        if not variantes:
            manquantes.append(icone["id"])
            continue
        imposee = selection.get(icone["id"])
        choisie = next((v for v in variantes if v.endswith(f"_s{imposee}.png")), None) if imposee is not None else None
        ajouter(icone, choisie or min(variantes, key=lambda v: (fragments(v), v)), "FUSAIN")

    CIBLE.mkdir(parents=True, exist_ok=True)
    for ancien in CIBLE.glob("*.json"):
        ancien.unlink()
    index = []
    for ident, theme in themes.items():
        contenu = json.dumps({"theme": ident, "icones": {i: x["png"] for i, x in theme["icones"].items()}}, separators=(",", ":")) + "\n"
        (CIBLE / f"{ident}.json").write_text(contenu, encoding="utf-8")
        empreinte = "sha384-" + base64.b64encode(hashlib.sha384(contenu.encode("utf-8")).digest()).decode("ascii")
        index.append({"id": ident, "nom": theme["nom"], "origine": theme["origine"], "fichier": f"{ident}.json", "integrite": empreinte,
                      "icones": [[i, x["nom"]] for i, x in theme["icones"].items()]})
    (CIBLE / "index.json").write_text(json.dumps({"themes": index}, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    (CIBLE / "LICENCE.txt").write_text(
        "Icônes illustrées de FUSAIN\n"
        "Générées localement avec le modèle Krea 2 (checkpoint Turbo), détourées avec rembg, réduites à 192 px et 128 couleurs.\n"
        "Une partie vient du dépôt SimpleCarto (icons/pictograms-k2), l'autre de outils/illustrations/ de ce dépôt.\n"
        "Aucune œuvre tierce n'est reprise ; les descriptions qui ont servi à les produire sont dans icon-prompts.json.\n", encoding="utf-8")
    total = sum(len(t["icones"]) for t in themes.values())
    poids = sum(f.stat().st_size for f in CIBLE.glob("*.json")) // 1024
    print(f"{total} icônes en {len(themes)} thèmes → icones/illustrees/ ({poids} Ko)")
    if manquantes:
        print(f"{len(manquantes)} icône(s) du catalogue FUSAIN pas encore générée(s) : {', '.join(manquantes[:8])}{'…' if len(manquantes) > 8 else ''}")


if __name__ == "__main__":
    principal()
