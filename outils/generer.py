#!/usr/bin/env python3
"""FUSAIN — cohérence de la version publiée (cahier des charges §8.4).

Met à jour, à partir des fichiers réellement présents dans le dépôt :
  - les attributs d'intégrité (SRI) de index.html ;
  - la liste des fichiers et la version du cache dans sw.js ;
  - la nomenclature sbom/fusain-sbom-cyclonedx.json (CycloneDX 1.6).

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
DOSSIERS_CACHE = ["css", "js", "libs", "icones", "sbom", "schema", "Documentation"]
FICHIERS_CACHE = ["index.html", "manifest.webmanifest", "FUSAIN_cahier_des_charges.md", "NOMENCLATURE_LOGICIELLE_FUSAIN.md", "JOURNAL_DES_VERSIONS.md"]
EXCLUS = {"sbom/composants.json"}


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
            liste += [str(p.relative_to(RACINE)) for p in base.rglob("*") if p.is_file()]
    return sorted(f for f in liste if f not in EXCLUS)


def index_avec_sri():
    html = lire("index.html")

    def remplacer(m):
        balise, attribut, chemin = m.group(0), m.group(1), m.group(2)
        balise = re.sub(r'\s+integrity="[^"]*"', "", balise)
        return balise.replace(f'{attribut}="./{chemin}"', f'{attribut}="./{chemin}" integrity="{sri(chemin)}"')

    html = re.sub(r'<script\b[^>]*\b(src)="\./((?:libs|js)/[^"]+)"[^>]*>', remplacer, html)
    html = re.sub(r'<link\b[^>]*rel="stylesheet"[^>]*\b(href)="\./((?:libs|css)/[^"]+)"[^>]*>', remplacer, html)
    return html


def sw_genere(generes):
    num, _ = version()
    fichiers = fichiers_caches()
    h = hashlib.sha256()
    for f in fichiers:
        h.update(f.encode())
        # Les fichiers produits dans la même passe sont pris dans leur nouvel état
        h.update(generes[f].encode() if f in generes else (RACINE / f).read_bytes())
    bloc = "/* DEBUT-GENERE */\nconst VERSION_CACHE = 'fusain-%s-%s';\nconst FICHIERS = [\n%s\n];\n/* FIN-GENERE */" % (
        num, h.hexdigest()[:10], "\n".join(f"    './{f}'," for f in ["", *fichiers]).replace("'./',", "'./',", 1))
    return re.sub(r"/\* DEBUT-GENERE \*/.*?/\* FIN-GENERE \*/", lambda _: bloc, lire("sw.js"), flags=re.S)


def nomenclature():
    num, date = version()
    source = json.loads(lire("sbom/composants.json"))
    composants, dependances = [], []
    for c in source["composants"]:
        dossier = RACINE / c["dossier"]
        if not dossier.is_dir():
            raise SystemExit(f"Dossier absent pour {c['nom']} : {c['dossier']}")
        ref = c["purl"]
        fichiers = sorted(str(p.relative_to(RACINE)) for p in dossier.rglob("*") if p.is_file())
        composants.append({
            "type": "library", "bom-ref": ref, "name": c["nom"], "version": c["version"],
            "description": c["role"], "purl": ref,
            "licenses": [{"expression": c["licence"]}] if " " in c["licence"] else [{"license": {"id": c["licence"]}}],
            "hashes": [{"alg": "SHA-256", "content": c["archiveSha256"]}],
            "externalReferences": [{"type": "distribution", "url": c["archive"]}],
            "properties": [{"name": "fusain:dossier", "value": c["dossier"]}, {"name": "fusain:note", "value": c["note"]}],
            "components": [{"type": "file", "name": f, "hashes": [{"alg": "SHA-256", "content": empreinte(f).hexdigest()}]} for f in fichiers],
        })
        dependances.append({"ref": ref, "dependsOn": []})
    ref_app = f"pkg:github/guiraudjb/fusain@{num}"
    contenu = json.dumps(composants, sort_keys=True)
    return {
        "bomFormat": "CycloneDX", "specVersion": "1.6",
        "serialNumber": "urn:uuid:" + str(uuid.uuid5(uuid.NAMESPACE_URL, ref_app + contenu)),
        "version": 1,
        "metadata": {
            "timestamp": f"{date}T00:00:00Z",
            "component": {"type": "application", "bom-ref": ref_app, "name": "FUSAIN", "version": num,
                          "description": "Éditeur visuel de diagrammes Mermaid, exécuté entièrement dans le navigateur",
                          "purl": ref_app},
            "tools": {"components": [{"type": "application", "name": "outils/generer.py"}]},
        },
        "components": composants,
        "dependencies": [{"ref": ref_app, "dependsOn": [c["bom-ref"] for c in composants]}, *dependances],
    }


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
