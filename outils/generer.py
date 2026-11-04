#!/usr/bin/env python3
"""FUSAIN — cohérence de la version publiée (cahier des charges §8.4).

Met à jour, à partir des fichiers réellement présents dans le dépôt :
  - les attributs d'intégrité (SRI) de index.html ;
  - la liste des fichiers et la version du cache dans sw.js ;
  - la nomenclature sbom/fusain-sbom-cyclonedx.json (CycloneDX 1.7, avec l'analyse des avis connus).

    python3 outils/generer.py              met à jour les fichiers
    python3 outils/generer.py --verifier   ne modifie rien ; code de sortie 1 en cas d'écart

Ce script ne fait pas partie du produit livré : il ne s'exécute que sur le poste de développement.
"""
import base64
import hashlib
import json
import re
import sys
import uuid
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
# Fichiers servis par l'application, donc mis en cache pour le fonctionnement hors ligne
DOSSIERS_CACHE = ["css", "js", "libs", "icones", "sbom", "schema", "Documentation", "cartes"]
FICHIERS_CACHE = ["index.html", "manifest.webmanifest", "FUSAIN_cahier_des_charges.md", "NOMENCLATURE_LOGICIELLE_FUSAIN.md", "AUDIT_SECURITE_FUSAIN.md", "JOURNAL_DES_VERSIONS.md"]
EXCLUS = {"sbom/composants.json"}
# Fonds de carte volumineux : hors du préchargement, téléchargés à la première carte qui en a besoin, mais vérifiés
# par le service worker avant d'entrer dans son cache, comme le reste
A_LA_DEMANDE = ("cartes/communes/", "cartes/calques/", "cartes/exemples/", "cartes/adresses/")
# Adresses d'une commune (35 000 fichiers) : ni préchargées ni énumérées dans le service worker. Leur empreinte est donnée
# par l'index de leur département (cartes/adresses/<dép>.json, lu à la demande) et vérifiée au téléchargement.
ADRESSES_COMMUNES = re.compile(r"cartes/adresses/[^/]+/")


def lire(chemin):
    return (RACINE / chemin).read_text(encoding="utf-8")


def empreinte(chemin, algo="sha256"):
    return hashlib.new(algo, (RACINE / chemin).read_bytes())


def sri(chemin):
    return "sha384-" + base64.b64encode(empreinte(chemin, "sha384").digest()).decode()


def version():
    texte = lire("js/version.js")
    return re.search(r"VERSION = '([^']+)'", texte).group(1), re.search(r"DATE_VERSION = '([^']+)'", texte).group(1)


def fichiers_caches():
    liste = [f for f in FICHIERS_CACHE if (RACINE / f).is_file()]
    for dossier in DOSSIERS_CACHE:
        base = RACINE / dossier
        if base.is_dir():
            liste += [p.relative_to(RACINE).as_posix() for p in base.rglob("*") if p.is_file()]
    return sorted(f for f in liste if f not in EXCLUS and not ADRESSES_COMMUNES.match(f))


def fichiers_a_la_demande():
    return [f for f in fichiers_caches() if f.startswith(A_LA_DEMANDE)]


def index_avec_sri():
    html = lire("index.html")

    def remplacer(m):
        balise, attribut, chemin = m.group(0), m.group(1), m.group(2)
        balise = re.sub(r'\s+integrity="[^"]*"', "", balise)
        return balise.replace(f'{attribut}="./{chemin}"', f'{attribut}="./{chemin}" integrity="{sri(chemin)}"')

    html = re.sub(r'<script\b[^>]*\b(src)="\./((?:libs|js)/[^"]+)"[^>]*>', remplacer, html)
    html = re.sub(r'<link\b[^>]*rel="stylesheet"[^>]*\b(href)="\./((?:libs|css)/[^"]+)"[^>]*>', remplacer, html)
    # Bibliothèque chargée à la demande : la balise ne déclenche aucun chargement, elle porte l'adresse et l'empreinte
    html = re.sub(r'<link\b[^>]*rel="fusain-extension"[^>]*\b(href)="\./((?:libs|icones|cartes)/[^"]+)"[^>]*>', remplacer, html)
    return html


def sw_genere(generes):
    num, _ = version()
    fichiers = [f for f in fichiers_caches() if not f.startswith(A_LA_DEMANDE)]
    h = hashlib.sha256()
    lignes = []
    demande = [f"    ['./{f}', '{empreinte(f).hexdigest()}']," for f in fichiers_a_la_demande()]
    for f in fichiers:
        # Les fichiers produits dans la même passe sont pris dans leur nouvel état
        contenu = generes[f].encode() if f in generes else (RACINE / f).read_bytes()
        h.update(f.encode())
        h.update(contenu)
        empreinte_fichier = hashlib.sha256(contenu).hexdigest()
        if f == "index.html":
            lignes.append(f"    ['./', '{empreinte_fichier}'],")
        lignes.append(f"    ['./{f}', '{empreinte_fichier}'],")
    # Le cache des adresses porte l'empreinte de leurs index : une nouvelle édition de la BAN le remplace en entier
    adresses = hashlib.sha256("".join(l for l in demande if "cartes/adresses/" in l).encode()).hexdigest()[:10]
    bloc = ("/* DEBUT-GENERE */\nconst VERSION_CACHE = 'fusain-%s-%s';\n// [chemin, empreinte SHA-256] de chaque fichier de la version\nconst FICHIERS = [\n%s\n];\n"
            "// Fichiers lus seulement quand une page en a besoin : même contrôle, à leur premier téléchargement\nconst A_LA_DEMANDE = [\n%s\n];\n"
            "const CACHE_ADRESSES = 'fusain-adresses-%s';\n/* FIN-GENERE */") % (
        num, h.hexdigest()[:10], "\n".join(lignes), "\n".join(demande), adresses)
    return re.sub(r"/\* DEBUT-GENERE \*/.*?/\* FIN-GENERE \*/", lambda _: bloc, lire("sw.js"), flags=re.S)


def licences(expression):
    """Licence déclarée par l'amont : identifiant SPDX seul, ou expression (« A OR B »)."""
    if " " in expression:
        return [{"expression": expression, "acknowledgement": "declared"}]
    return [{"license": {"id": expression, "acknowledgement": "declared"}}]


def purl_npm(nom, version=None):
    base = "pkg:npm/" + nom.replace("@", "%40", 1)
    return f"{base}@{version}" if version else base


def nomenclature():
    num, date = version()
    source = json.loads(lire("sbom/composants.json"))
    app = source["application"]
    ref_app = f"pkg:github/guiraudjb/fusain@{num}"
    composants, dependances, vulnerabilites = [], [], []
    for c in source["composants"]:
        dossier = RACINE / c["dossier"]
        if not dossier.is_dir():
            raise SystemExit(f"Dossier absent pour {c['nom']} : {c['dossier']}")
        ref = c["purl"]
        fichiers = sorted(p.relative_to(RACINE).as_posix() for p in dossier.rglob("*") if p.is_file())
        sous = [{"type": "file", "bom-ref": f"{ref}#{f}", "name": f, "hashes": [{"alg": "SHA-256", "content": empreinte(f).hexdigest()}]} for f in fichiers]
        inclus_refs = []
        # Composants inclus dans une distribution autonome (mermaid.min.js, mermaid-zenuml.min.js) : listés quand ils sont identifiés
        for i in c.get("inclus", []):
            ref_i = f"{ref}#inclus/{purl_npm(i['nom'], i.get('version'))}"
            inclus_refs.append(ref_i)
            entree = {"type": "library", "bom-ref": ref_i, "name": i["nom"], "scope": "required",
                      "licenses": licences(i["licence"]), "purl": purl_npm(i["nom"], i.get("version")),
                      "properties": [{"name": "fusain:note", "value": i["note"]}]}
            if i.get("version"):
                entree["version"] = i["version"]
            sous.append(entree)
            for id_avis in i.get("avis", []):
                vulnerabilites.append({
                    "bom-ref": f"vex/{id_avis}/{ref_i}", "id": id_avis,
                    "source": {"name": "OSV", "url": f"https://osv.dev/vulnerability/{id_avis}"},
                    "analysis": {"state": "not_affected", "justification": "protected_by_mitigating_control", "detail": i["analyse"]},
                    "affects": [{"ref": ref_i}],
                })
        composants.append({
            "type": "library", "bom-ref": ref, "supplier": {"name": c["fournisseur"], "url": [c["depot"]]},
            "name": c["nom"], "version": c["version"], "description": c["role"], "scope": "required",
            "licenses": licences(c["licence"]),
            "hashes": [{"alg": "SHA-256", "content": c["archiveSha256"]}],
            "purl": ref,
            "externalReferences": [{"type": "distribution", "url": c["archive"]}, {"type": "vcs", "url": c["depot"]}],
            "properties": [{"name": "fusain:dossier", "value": c["dossier"]}, {"name": "fusain:chargement", "value": c["chargement"]},
                           {"name": "fusain:note", "value": c["note"]}],
            "components": sous,
        })
        dependances.append({"ref": ref, "dependsOn": inclus_refs})
    # Données livrées (fonds de carte, icônes) : l'empreinte est celle de leur index, qui porte l'empreinte de chaque fichier
    for d in source["donnees"]:
        entree = {"type": "data", "bom-ref": f"{ref_app}#donnees/{d['nom']}", "supplier": {"name": d["fournisseur"]}, "name": d["nom"],
                  "description": d["description"], "scope": "required",
                  "hashes": [{"alg": "SHA-256", "content": empreinte(d["index"]).hexdigest()}],
                  "data": [{"type": "dataset", "name": d["nom"], "contents": {"url": d["index"]}}],
                  "properties": [{"name": "fusain:dossier", "value": d["dossier"]}, {"name": "fusain:index", "value": d["index"]}]}
        if d.get("licence"):
            entree["licenses"] = licences(d["licence"])
        composants.append(entree)
    contenu = json.dumps([composants, vulnerabilites], sort_keys=True)
    application = {
        "type": "application", "bom-ref": ref_app, "supplier": {"name": app["fournisseur"], "url": [app["depot"]]},
        "name": "FUSAIN", "version": num,
        "description": "Éditeur visuel de diagrammes Mermaid, exécuté entièrement dans le navigateur",
        "purl": ref_app,
        "externalReferences": [{"type": "vcs", "url": app["depot"]}, {"type": "website", "url": app["site"]}],
    }
    if app.get("licence"):
        application["licenses"] = licences(app["licence"])
    else:
        application["properties"] = [{"name": "fusain:licence", "value": "Aucune licence fixée pour le code propre à FUSAIN (nomenclature §4, point 4)."}]
    bom = {
        "$schema": "http://cyclonedx.org/schema/bom-1.7.schema.json",
        "bomFormat": "CycloneDX", "specVersion": "1.7",
        "serialNumber": "urn:uuid:" + str(uuid.uuid5(uuid.NAMESPACE_URL, ref_app + contenu)),
        "version": 1,
        "metadata": {
            "timestamp": f"{date}T00:00:00Z",
            "lifecycles": [{"phase": "build"}],
            "tools": {"components": [{"type": "application", "name": "outils/generer.py", "version": num}]},
            "component": application,
            "supplier": {"name": app["fournisseur"], "url": [app["depot"]]},
        },
        "components": composants,
        "dependencies": [{"ref": ref_app, "dependsOn": [c["bom-ref"] for c in composants if c["type"] == "library"]}, *dependances],
    }
    if vulnerabilites:
        bom["vulnerabilities"] = vulnerabilites
    return bom


def principal():
    verifier = "--verifier" in sys.argv
    html = index_avec_sri()
    cibles = {
        "index.html": html,
        "sbom/fusain-sbom-cyclonedx.json": json.dumps(nomenclature(), ensure_ascii=False, indent=2) + "\n",
    }
    cibles["sw.js"] = sw_genere(cibles)
    ecarts = []
    for chemin, contenu in cibles.items():
        fichier = RACINE / chemin
        actuel = fichier.read_text(encoding="utf-8") if fichier.is_file() else None
        if actuel != contenu:
            ecarts.append(chemin)
            if not verifier:
                fichier.write_text(contenu, encoding="utf-8")
    num, date = version()
    if verifier:
        if ecarts:
            print("ÉCART — fichiers non synchronisés avec le dépôt :", ", ".join(ecarts))
            print("Lancer « python3 outils/generer.py » puis relire les différences avant de publier.")
            sys.exit(1)
        print(f"FUSAIN {num} ({date}) : intégrité, cache et nomenclature cohérents.")
    else:
        print(f"FUSAIN {num} ({date}) : {', '.join(ecarts) if ecarts else 'rien à mettre à jour'}.")


if __name__ == "__main__":
    principal()
