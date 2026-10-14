#!/usr/bin/env python3
"""FUSAIN — adresses de la Base Adresse Nationale, pour placer une épingle sur une carte (comme SimpleCarto).

    python3 outils/adresses.py adresses-france.csv.gz

Source : https://adresse.data.gouv.fr/data/ban/adresses/latest/csv/adresses-france.csv.gz (Licence Ouverte 2.0).

Produit le dossier cartes/adresses/ :
  - <département>/<code INSEE>.json : adresses d'une commune, lues à la demande ;
  - <département>.json : communes du département, avec le nom et l'empreinte (SRI) du fichier de chacune.
Les index de département sont inscrits dans cartes/index.json, lui-même contrôlé par index.html : la chaîne
d'empreintes couvre ainsi les 35 000 fichiers de communes sans les énumérer dans le service worker.

Format d'une commune, pour peser le moins possible : les adresses sont regroupées par voie, les coordonnées sont
des entiers en cent-millièmes de degré (environ un mètre), chacune écrite comme l'écart à la précédente.
  {"o": [lon, lat], "v": [[nom de la voie, [numéros], [dlon, dlat, dlon, dlat…]], …]}
Un numéro est un entier, ou un texte quand il porte un indice de répétition (« 12 bis ») ; 0 : adresse sans numéro.
Ce script ne fait pas partie du produit livré : il ne s'exécute que sur le poste de développement.
"""
import base64
import csv
import gzip
import hashlib
import json
import re
import shutil
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
CIBLE = RACINE / "cartes" / "adresses"
INDEX = RACINE / "cartes" / "index.json"


def departement(code):
    return code[:3] if code.startswith(("97", "98")) else code[:2]


def sri(donnees):
    return "sha384-" + base64.b64encode(hashlib.sha384(donnees).digest()).decode()


def cle_numero(n):
    return (n, "") if isinstance(n, int) else (int(re.match(r"\d*", n).group() or 0), n)


def ecrire_commune(code, nom, voies):
    """Écrit le fichier d'une commune et rend son entrée dans l'index du département."""
    points = [(lon, lat) for adresses in voies.values() for _, lon, lat in adresses]
    origine = [min(p[0] for p in points), min(p[1] for p in points)]
    precedent = list(origine)
    sortie = []
    for voie in sorted(voies, key=str.casefold):
        numeros, ecarts = [], []
        for numero, lon, lat in sorted(voies[voie], key=lambda a: cle_numero(a[0])):
            numeros.append(numero)
            ecarts += [lon - precedent[0], lat - precedent[1]]
            precedent = [lon, lat]
        sortie.append([voie, numeros, ecarts])
    donnees = json.dumps({"o": origine, "v": sortie}, ensure_ascii=False, separators=(",", ":")).encode()
    chemin = CIBLE / departement(code) / f"{code}.json"
    chemin.parent.mkdir(exist_ok=True)
    chemin.write_bytes(donnees)
    return [code, nom, sri(donnees)]


def principal(source):
    if CIBLE.exists():
        shutil.rmtree(CIBLE)
    CIBLE.mkdir(parents=True)
    index_deps, communes, vues = {}, 0, set()
    courante, nom, voies = None, "", {}

    def clore():
        nonlocal communes
        if courante and voies:
            index_deps.setdefault(departement(courante), []).append(ecrire_commune(courante, nom, voies))
            communes += 1

    with gzip.open(source, "rt", encoding="utf-8", newline="") as f:
        for ligne in csv.DictReader(f, delimiter=";"):
            code = ligne["code_insee"]
            if code != courante:
                clore()
                # Le fichier national est rangé par commune : une commune ne doit pas reparaître plus loin
                if code in vues:
                    raise SystemExit(f"Commune {code} rencontrée deux fois : le fichier n'est pas rangé par commune.")
                vues.add(code)
                courante, nom, voies = code, ligne["nom_commune"], {}
            try:
                lon, lat = round(float(ligne["lon"]) * 1e5), round(float(ligne["lat"]) * 1e5)
            except ValueError:
                continue
            voie = ligne["nom_voie"].strip() or ligne["nom_ld"].strip()
            if not voie:
                continue
            # Dans une commune nouvelle, des voies homonymes se distinguent par leur ancienne commune
            ancienne = ligne["nom_ancienne_commune"].strip()
            if ancienne and ancienne != nom:
                voie = f"{voie} ({ancienne})"
            numero = int(ligne["numero"] or 0)
            rep = ligne["rep"].strip()
            voies.setdefault(voie, []).append((f"{numero} {rep}" if rep else numero, lon, lat))
        clore()

    entrees = {}
    for dep, liste in index_deps.items():
        chemin = CIBLE / f"{dep}.json"
        chemin.write_text(json.dumps(sorted(liste, key=lambda c: c[0]), ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        entrees[f"adresses/{dep}"] = {"fichier": f"adresses/{dep}.json", "integrite": sri(chemin.read_bytes())}
    inscrire(entrees)
    taille = sum(p.stat().st_size for p in CIBLE.rglob("*") if p.is_file())
    print(f"cartes/adresses/ : {len(index_deps)} départements, {communes} communes, {taille / 1e6:.0f} Mo.")


def inscrire(entrees):
    """Remplace les entrées « adresses/… » de cartes/index.json (appelé aussi par outils/cartes.py)."""
    index = {k: v for k, v in json.loads(INDEX.read_text(encoding="utf-8")).items() if not k.startswith("adresses/")}
    INDEX.write_text(json.dumps(dict(sorted({**index, **entrees}.items())), ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def entrees_existantes():
    """Entrées d'index des adresses déjà produites, pour que outils/cartes.py les conserve."""
    return {f"adresses/{p.stem}": {"fichier": f"adresses/{p.name}", "integrite": sri(p.read_bytes())} for p in sorted(CIBLE.glob("*.json"))}


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    principal(Path(sys.argv[1]))
