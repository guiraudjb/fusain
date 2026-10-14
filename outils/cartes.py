#!/usr/bin/env python3
"""FUSAIN — données géographiques des diapositives de carte, reprises de SimpleCarto.

    python3 outils/cartes.py [dossier data de SimpleCarto] [TRONCON_ROUTE.shp de ROUTE 500]
    (par défaut ~/SimpleCarto/data ; sans ROUTE 500, les calques du réseau routier ne sont pas produits)

Produit le dossier cartes/ :
  - monde.json, regions-du-monde.json, departements.json, epci.json : préchargés avec l'application ;
  - communes/<région>.json : contours communaux d'une région (et arrondissements municipaux), lus à la demande ;
  - calques/ : relief, hydrographie, voies ferrées, routes nationales, lus à la demande ;
  - calques/routes-*.json : réseau routier de ROUTE 500 (IGN, édition 2021, la dernière) par vocation, lu à la demande.
    Il faut ogr2ogr (GDAL) et mapshaper ;
  - index.json : adresse et empreinte (SRI) de chaque fichier lu à la demande. Son propre condensé est porté par
    index.html (outils/generer.py), si bien que tout fichier chargé est contrôlé.

Le fond communal de SimpleCarto (22 Mo) est découpé par région : chaque fichier ne garde que les arcs de ses communes,
ce qui conserve les limites partagées à l'intérieur de la région (tracé des départements, carte d'un EPCI).
Ce script ne fait pas partie du produit livré : il ne s'exécute que sur le poste de développement.
"""
import base64
import csv
import gettext
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import adresses

RACINE = Path(__file__).resolve().parent.parent
CIBLE = RACINE / "cartes"
GARDEES = ["code_insee", "nom_officiel", "code_insee_du_departement", "code_insee_de_la_region", "codes_siren_des_epci",
           "code_insee_de_la_commune_parente"]


def ecrire_json(chemin, donnees):
    chemin.parent.mkdir(parents=True, exist_ok=True)
    chemin.write_text(json.dumps(donnees, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def sri(chemin):
    return "sha384-" + base64.b64encode(hashlib.sha384(chemin.read_bytes()).digest()).decode()


def arcs_de(geometrie):
    """Indices d'arcs (positifs) utilisés par une géométrie TopoJSON."""
    t, arcs = geometrie.get("type"), geometrie.get("arcs") or []
    if t == "Polygon":
        return [a for anneau in arcs for a in anneau]
    if t == "MultiPolygon":
        return [a for poly in arcs for anneau in poly for a in anneau]
    if t in ("LineString",):
        return list(arcs)
    if t == "MultiLineString":
        return [a for ligne in arcs for a in ligne]
    return []


def renumeroter(geometrie, table):
    def r(a):
        return table[a] if a >= 0 else ~table[~a]
    t, arcs = geometrie.get("type"), geometrie.get("arcs")
    if t == "Polygon":
        geometrie["arcs"] = [[r(a) for a in anneau] for anneau in arcs]
    elif t == "MultiPolygon":
        geometrie["arcs"] = [[[r(a) for a in anneau] for anneau in poly] for poly in arcs]


def sous_topologie(topo, objets):
    """Topologie réduite aux géométries données ({nom: [géométries]}), arcs renumérotés."""
    utilises = sorted({a if a >= 0 else ~a for geoms in objets.values() for g in geoms for a in arcs_de(g)})
    table = {ancien: nouveau for nouveau, ancien in enumerate(utilises)}
    sortie = {"type": "Topology", "transform": topo["transform"], "arcs": [topo["arcs"][a] for a in utilises], "objects": {}}
    for nom, geoms in objets.items():
        copies = []
        for g in geoms:
            c = {"type": g["type"], "properties": {k: g["properties"][k] for k in GARDEES if k in g["properties"]}}
            if "arcs" in g:
                c["arcs"] = json.loads(json.dumps(g["arcs"]))
                renumeroter(c, table)
            copies.append(c)
        sortie["objects"][nom] = {"type": "GeometryCollection", "geometries": copies}
    return sortie


# Vocations de ROUTE 500 retenues, du réseau le plus fin au plus fort. Les bretelles vont avec les autoroutes.
# La vocation (fonction de la route) est préférée à la classe administrative, dépassée depuis les transferts de la loi 3DS.
VOCATIONS_ROUTE500 = (("routes-regionales", "'Liaison régionale'"), ("routes-principales", "'Liaison principale'"),
                      ("routes-autoroutes", "'Type autoroutier', 'Bretelle'"))


def route500(troncons, index):
    """Calques routiers de ROUTE 500 : tronçons fusionnés en lignes continues, reprojetés en longitude et latitude,
    simplifiés. Sans fusion, chaque tronçon serait un arc TopoJSON et le fichier ne maigrirait pas."""
    with tempfile.TemporaryDirectory() as tmp:
        for nom, vocations in VOCATIONS_ROUTE500:
            brut = Path(tmp) / f"{nom}.geojson"
            subprocess.run(["ogr2ogr", "-f", "GeoJSON", "-t_srs", "EPSG:4326", "-oo", "ENCODING=CP1252", "-dialect", "sqlite",
                            "-sql", f"SELECT ST_LineMerge(ST_Union(geometry)) AS geometry FROM TRONCON_ROUTE WHERE VOCATION IN ({vocations})",
                            str(brut), str(troncons)], check=True, env={**os.environ, "OGR_GEOJSON_MAX_OBJ_SIZE": "0"})
            chemin = CIBLE / "calques" / f"{nom}.json"
            subprocess.run(["mapshaper", "-i", str(brut), "-explode", "-simplify", "10%", "keep-shapes", "-rename-layers", nom,
                            "-o", "format=topojson", "quantization=100000", str(chemin)], check=True)
            index[f"calques/{nom}"] = chemin


def principal(source, troncons=None):
    # Les adresses (outils/adresses.py, 35 000 fichiers) sont produites à part : elles sont conservées
    if CIBLE.exists():
        for p in CIBLE.iterdir():
            if p.name != "adresses":
                shutil.rmtree(p) if p.is_dir() else p.unlink()
    (CIBLE / "communes").mkdir(parents=True)
    (CIBLE / "calques").mkdir()

    # Monde (Natural Earth, 177 pays), noms en français, et regroupements de pays de SimpleCarto (sans doublon de code)
    noms = noms_des_pays()
    monde = json.loads((source / "world_2025.json").read_text(encoding="utf-8"))
    for f in monde["features"]:
        f["properties"] = {"nom": noms.get(str(f.get("id")), f["properties"].get("name", ""))}
    ecrire_json(CIBLE / "monde.json", monde)
    regions, vus = [], set()
    for r in json.loads((source / "world_region_list.json").read_text(encoding="utf-8")):
        if r["code"] not in vus:
            vus.add(r["code"])
            regions.append({"code": r["code"], "categorie": r["category"], "nom": r["name"], "pays": r["countries"]})
    ecrire_json(CIBLE / "regions-du-monde.json", regions)

    # Départements (ADMIN EXPRESS), France entière avec l'outre-mer
    deps = json.loads((source / "departement_2025.json").read_text(encoding="utf-8"))
    for g in deps["objects"]["departement_temp"]["geometries"]:
        g["properties"] = {k: g["properties"][k] for k in ("code_insee", "nom_officiel", "code_insee_de_la_region")}
    deps["objects"] = {"departements": deps["objects"]["departement_temp"]}
    ecrire_json(CIBLE / "departements.json", deps)

    # EPCI (INSEE) : nom et régions couvertes ; les communes membres sont lues dans les contours communaux
    epci = {}
    with open(source / "EPCI_2025.csv", encoding="utf-8") as f:
        for ligne in csv.DictReader(f, delimiter=";"):
            code = ligne["EPCI"].strip()
            if not code or code.startswith("Z"):
                continue
            e = epci.setdefault(code, {"code": code, "nom": ligne["LIBEPCI"].strip(), "regions": set(), "departements": set()})
            e["regions"].add(ligne["REG"].strip())
            e["departements"].add(ligne["DEP"].strip())
    ecrire_json(CIBLE / "epci.json", sorted(({**e, "regions": sorted(e["regions"]), "departements": sorted(e["departements"])} for e in epci.values()), key=lambda e: e["nom"]))

    # Communes, découpées par région
    communes = json.loads((source / "commune_2025.json").read_text(encoding="utf-8"))
    par_region = {}
    for nom_source, nom in (("commune_temp", "communes"), ("arrondissement_municipal", "arrondissements")):
        for g in communes["objects"][nom_source]["geometries"]:
            par_region.setdefault(g["properties"]["code_insee_de_la_region"], {"communes": [], "arrondissements": []})[nom].append(g)
    index = {}
    # Saint-Barthélemy et Saint-Martin n'ont pas de code INSEE de commune (« NR ») : ils ne sont pas repris
    par_region.pop("NR", None)
    for region, objets in sorted(par_region.items()):
        chemin = CIBLE / "communes" / f"{region}.json"
        ecrire_json(chemin, sous_topologie(communes, objets))
        index[f"communes/{region}"] = chemin

    # Calques de la France métropolitaine (IGN) : seuls les tracés sont utiles
    for nom, fichier in (("hydro", "hydro_france.json"), ("rail", "rail_france.json"), ("routes", "roads_national.json")):
        topo = json.loads((source / fichier).read_text(encoding="utf-8"))
        cle = next(iter(topo["objects"]))
        for g in topo["objects"][cle]["geometries"]:
            g.pop("properties", None)
        topo["objects"] = {nom: topo["objects"][cle]}
        chemin = CIBLE / "calques" / f"{nom}.json"
        ecrire_json(chemin, topo)
        index[f"calques/{nom}"] = chemin
    shutil.copyfile(source / "relief_france.png", CIBLE / "calques" / "relief.png")
    index["calques/relief"] = CIBLE / "calques" / "relief.png"
    if troncons:
        route500(troncons, index)

    # Chaque fichier, préchargé ou non, est lu avec son empreinte
    for nom in ("monde", "regions-du-monde", "departements", "epci"):
        index[nom] = CIBLE / f"{nom}.json"
    # Jeux de données d'exemple de SimpleCarto, proposés au téléchargement dans « À propos »
    (CIBLE / "exemples").mkdir()
    for fichier in ("france_communes.csv", "france_departements.csv", "monde.csv"):
        shutil.copyfile(source / "samples" / fichier, CIBLE / "exemples" / fichier.replace("_", "-"))

    entrees = {nom: {"fichier": str(c.relative_to(CIBLE)), "integrite": sri(c)} for nom, c in index.items()}
    ecrire_json(CIBLE / "index.json", dict(sorted({**entrees, **adresses.entrees_existantes()}.items())))
    (CIBLE / "LICENCE.txt").write_text(LICENCE, encoding="utf-8")
    taille = sum(p.stat().st_size for p in CIBLE.rglob("*") if p.is_file())
    print(f"cartes/ : {len(par_region)} régions communales, {len(epci)} EPCI, {taille / 1e6:.1f} Mo au total.")


# Noms usuels en français (paquet iso-codes de Debian), complétés pour les codes propres à Natural Earth
NOMS_PARTICULIERS = {"RUS": "Russie", "FLK": "Îles Malouines", "SLB": "Îles Salomon", "PSE": "Palestine", "BRN": "Brunei",
                     "FSM": "Micronésie", "-99": "Chypre du Nord", "OSA": "Kosovo", "SDS": "Soudan du Sud", "ABV": "Somaliland"}


def noms_des_pays():
    pays = json.loads(Path("/usr/share/iso-codes/json/iso_3166-1.json").read_text(encoding="utf-8"))["3166-1"]
    traduction = gettext.translation("iso_3166-1", "/usr/share/locale", ["fr"])
    return {**{p["alpha_3"]: traduction.gettext(p.get("common_name", p["name"])) for p in pays}, **NOMS_PARTICULIERS}


LICENCE = """Données géographiques des diapositives de carte de FUSAIN, reprises de SimpleCarto (outils/cartes.py).

- Contours des communes, arrondissements municipaux, départements et régions : IGN, ADMIN EXPRESS 2025,
  Licence Ouverte / Open Licence 2.0 (Etalab). Arrondissements municipaux : geo.api.gouv.fr, même licence.
- Composition des EPCI au 1er janvier 2025 : INSEE, Licence Ouverte / Open Licence 2.0 (Etalab).
- Hydrographie, voies ferrées et routes nationales : IGN, BD TOPO, Licence Ouverte / Open Licence 2.0 (Etalab).
- Réseau routier par vocation (calques/routes-*.json) : IGN, ROUTE 500 édition 2021 (dernière édition, produit arrêté),
  Licence Ouverte / Open Licence 2.0 (Etalab) ; tronçons fusionnés et simplifiés.
- Relief (estompage) : IGN, Géoplateforme, Licence Ouverte / Open Licence 2.0 (Etalab).
- Pays du monde : Natural Earth, 1:110 000 000, domaine public ; noms français : paquet iso-codes (LGPL-2.1).
- Regroupements de pays (régions du monde) : SimpleCarto.
- Jeux de données d'exemple (exemples/) : SimpleCarto ; hormis les codes, les valeurs sont fictives.
- Adresses (adresses/) : Base Adresse Nationale, Licence Ouverte / Open Licence 2.0 (Etalab) ; regroupées par voie,
  coordonnées arrondies au cent-millième de degré (outils/adresses.py).

Les fichiers ont été simplifiés (propriétés réduites, découpage par région) ; les tracés ne sont pas modifiés.
"""

if __name__ == "__main__":
    principal(Path(sys.argv[1]) if len(sys.argv) > 1 else Path.home() / "SimpleCarto" / "data",
              Path(sys.argv[2]) if len(sys.argv) > 2 else None)
