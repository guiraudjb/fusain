#!/usr/bin/env python3
"""Construit le jeu d'icônes du DSFR utilisable dans les schémas d'architecture.

Les 1 038 icônes du DSFR sont des fichiers SVG de 24 × 24 faits d'un ou deux tracés. Ce script n'en garde que les
tracés et les range par catégorie dans un seul fichier, `libs/dsfr-v<version>/icones-dsfr.json`, chargé à la demande.

    python3 outils/icones.py /chemin/vers/package/dist/icons

Le dossier `dist/icons` vient de l'archive officielle `@gouvfr/dsfr` de la version embarquée, dont l'empreinte
est consignée dans sbom/composants.json : la vérifier avant de lancer ce script.
"""
import json
import pathlib
import re
import sys
import xml.etree.ElementTree as ET

RACINE = pathlib.Path(__file__).resolve().parent.parent
TRACE = re.compile(r"^[MmLlHhVvCcSsQqTtAaZz0-9eE\s,.+-]+$")
SVG = "{http://www.w3.org/2000/svg}"


def principal():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    source = pathlib.Path(sys.argv[1])
    composant = next(c for c in json.loads((RACINE / "sbom/composants.json").read_text(encoding="utf-8"))["composants"] if c["nom"] == "@gouvfr/dsfr")
    categories, total = {}, 0
    for dossier in sorted(p for p in source.iterdir() if p.is_dir()):
        icones = {}
        for fichier in sorted(dossier.glob("*.svg")):
            racine = ET.parse(fichier).getroot()
            if racine.get("viewBox") != "0 0 24 24" or any(e.tag not in (SVG + "svg", SVG + "path") for e in racine.iter()):
                sys.exit(f"Icône inattendue (dimensions ou contenu) : {fichier}")
            traces = [e.get("d", "") for e in racine.iter(SVG + "path")]
            if not traces or not all(TRACE.match(t) for t in traces):
                sys.exit(f"Tracé inattendu : {fichier}")
            nom = fichier.stem.removeprefix("fr--")
            if any(nom in c for c in categories.values()) or nom in icones:
                sys.exit(f"Nom d'icône en double : {nom}")
            icones[nom] = " ".join(traces)
        categories[dossier.name] = icones
        total += len(icones)
    cible = RACINE / composant["dossier"] / "icones-dsfr.json"
    cible.write_text(json.dumps({"source": f"@gouvfr/dsfr {composant['version']}, dist/icons", "categories": categories}, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"{total} icônes en {len(categories)} catégories → {cible.relative_to(RACINE)} ({cible.stat().st_size // 1024} Ko)")


if __name__ == "__main__":
    principal()
