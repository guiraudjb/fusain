#!/usr/bin/env python3
"""FUSAIN — veille des vulnérabilités (cahier des charges §8.4, nomenclature §5.1).

Interroge OSV.dev sur la version exacte de chaque bibliothèque embarquée (sbom/composants.json)
et signale si une version plus récente existe sur le registre npm. Les composants inclus dans une distribution autonome
(champ « inclus » : copies internes de Mermaid et de ZenUML) sont contrôlés aussi quand leur version est connue ; un avis
déjà analysé (champ « avis », publié dans le CycloneDX avec son analyse) est rappelé sans faire échouer la veille.

    python3 outils/veille.py

Code de sortie : 0 si aucune vulnérabilité connue, 1 sinon, 2 si un service n'a pas pu être interrogé.
Ce script ne fait pas partie du produit livré ; il n'envoie que le nom et la version des bibliothèques.
"""
import json
import sys
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent


def demander(url, corps=None):
    requete = urllib.request.Request(url, data=json.dumps(corps).encode() if corps else None,
                                     headers={"content-type": "application/json", "user-agent": "fusain-veille"})
    with urllib.request.urlopen(requete, timeout=30) as reponse:
        return json.load(reponse)


def principal():
    composants = json.loads((RACINE / "sbom/composants.json").read_text(encoding="utf-8"))["composants"]
    vulnerables, injoignable = 0, False
    print(f"Veille du {date.today().isoformat()} — {len(composants)} bibliothèques embarquées\n")
    a_controler = [(c["nom"], c["version"], "", set(), True) for c in composants]
    for c in composants:
        a_controler += [(i["nom"], i["version"], f" (inclus dans {c['nom']})", set(i.get("avis", [])), False)
                        for i in c.get("inclus", []) if i.get("version")]
    for nom, version, origine, analyses, embarque in a_controler:
        try:
            vulns = demander("https://api.osv.dev/v1/query", {"package": {"name": nom, "ecosystem": "npm"}, "version": version}).get("vulns", [])
        except Exception as erreur:  # réseau, service indisponible
            print(f"?  {nom} {version} : OSV.dev injoignable ({erreur})")
            injoignable = True
            continue
        nouveaux = [v for v in vulns if v["id"] not in analyses]
        if not embarque:
            # Une copie interne ne se met pas à jour seule : seule la version de la bibliothèque qui l'inclut compte
            derniere = "?"
        else:
            try:
                derniere = demander(f"https://registry.npmjs.org/{urllib.parse.quote(nom, safe='@')}/latest")["version"]
            except Exception:
                derniere = "?"
        retard = "" if derniere in (version, "?") else f" — version {derniere} disponible"
        if vulns and not nouveaux:
            print(f"~  {nom} {version}{origine} : {len(vulns)} avis déjà analysés (CycloneDX, section vulnerabilities){retard}")
        elif vulns:
            vulnerables += 1
            print(f"✖  {nom} {version}{origine} : {len(nouveaux)} vulnérabilité(s) nouvelle(s) sur {len(vulns)}{retard}")
            for v in nouveaux:
                gravite = (v.get("database_specific") or {}).get("severity", "gravité non précisée")
                print(f"     {v['id']} [{gravite}] {v.get('summary', '').strip()[:110]}")
                print(f"     https://osv.dev/vulnerability/{v['id']}")
        else:
            print(f"✔  {nom} {version}{origine} : aucune vulnérabilité connue{retard}")
    print()
    if vulnerables:
        print(f"{vulnerables} composant(s) à traiter (mise à jour, ou analyse ajoutée à sbom/composants.json) : suivre la procédure de NOMENCLATURE_LOGICIELLE_FUSAIN.md §5.3,")
        print("dans les délais du §5.2 (72 heures si critique, 7 jours si élevée, 30 jours si moyenne).")
        sys.exit(1)
    if injoignable:
        print("Contrôle incomplet : à relancer.")
        sys.exit(2)
    print("Aucune action requise. Consigner ce contrôle dans le journal de la nomenclature.")


if __name__ == "__main__":
    principal()
