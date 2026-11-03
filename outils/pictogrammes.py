#!/usr/bin/env python3
"""Pictogrammes au trait, en noir et blanc, dessinés pour FUSAIN (« picto:nom » dans le code Mermaid).

    python3 outils/pictogrammes.py [--planche FICHIER.html]

Chaque pictogramme est écrit ci-dessous en SVG, sur une grille de 48 × 48 : trait noir de 2,5, formes fermées
remplies de blanc (elles masquent les liaisons qui passent dessous), quelques points pleins en noir.
Le script vérifie qu'il n'emploie que des formes simples et des valeurs numériques, puis écrit
icones/pictogrammes.json : la page ne reçoit que des données, jamais du SVG à interpréter.
"""
import argparse
import json
import pathlib
import re
import xml.etree.ElementTree as ET

RACINE = pathlib.Path(__file__).resolve().parent.parent
CIBLE = RACINE / "icones" / "pictogrammes.json"
COTE = 48
NOIR, BLANC = "#161616", "#ffffff"
BALISES = {"path", "rect", "circle", "ellipse", "line", "polyline", "polygon"}
ATTRIBUTS = {"d", "x", "y", "width", "height", "rx", "ry", "cx", "cy", "r", "x1", "y1", "x2", "y2", "points",
             "fill", "stroke", "stroke-width", "stroke-dasharray"}
NOMBRES = re.compile(r"^[0-9MmLlHhVvCcSsQqTtAaZz\s,.+-]+$")
COULEURS = {"none", NOIR, BLANC}

CATEGORIES = {
    "reseau": "Réseau",
    "serveurs": "Serveurs et stockage",
    "postes": "Postes et périphériques",
    "securite": "Sécurité",
    "services": "Services et personnes",
}

# « n » : rempli de noir ; « v » : vide (fill="none")
PICTOGRAMMES = [
    # ---------- Réseau ----------
    ("routeur", "Routeur", "reseau", """
        <circle cx="24" cy="24" r="18"/>
        <path v d="M26 22 L34 14 M28 14 H34 V20 M22 26 L14 34 M14 28 V34 H20 M13 13 L20 20 M20 15 V20 H15 M35 35 L28 28 M28 33 V28 H33"/>"""),
    ("commutateur", "Commutateur (switch)", "reseau", """
        <rect x="4" y="12" width="40" height="24" rx="3"/>
        <path v d="M11 19 H33 M29 15.5 L33 19 L29 22.5 M37 29 H15 M19 25.5 L15 29 L19 32.5"/>"""),
    ("commutateur-niveau-3", "Commutateur de niveau 3", "reseau", """
        <rect x="4" y="12" width="40" height="24" rx="3"/>
        <path v d="M9 19 H25 M21 15.5 L25 19 L21 22.5 M29 29 H13 M17 25.5 L13 29 L17 32.5 M36 16 V32 M32.5 19.5 L36 16 L39.5 19.5 M32.5 28.5 L36 32 L39.5 28.5"/>"""),
    ("point-d-acces-wifi", "Point d'accès Wi-Fi", "reseau", """
        <rect x="12" y="32" width="24" height="9" rx="2"/>
        <circle n cx="17" cy="36.5" r="1.4"/>
        <path v d="M18 24 Q24 18 30 24 M13 19 Q24 9 35 19 M8 14 Q24 0 40 14"/>
        <circle n cx="24" cy="27" r="1.8"/>"""),
    ("antenne-relais", "Antenne relais", "reseau", """
        <path v d="M24 18 L16 43 M24 18 L32 43 M18.6 35 H29.4 M20.2 30 H27.8"/>
        <circle cx="24" cy="15" r="3"/>
        <path v d="M17 9 Q13 15 17 21 M31 9 Q35 15 31 21 M11 5 Q5 15 11 25 M37 5 Q43 15 37 25"/>"""),
    ("box-internet", "Box internet, modem", "reseau", """
        <path v d="M14 24 L11 10 M34 24 L37 10"/>
        <rect x="6" y="24" width="36" height="14" rx="3"/>
        <circle n cx="13" cy="31" r="1.5"/><circle n cx="19" cy="31" r="1.5"/><circle n cx="25" cy="31" r="1.5"/>"""),
    ("internet", "Internet", "reseau", """
        <circle cx="24" cy="24" r="18"/>
        <ellipse v cx="24" cy="24" rx="7.5" ry="18"/>
        <path v d="M6 24 H42 M9.5 14.5 H38.5 M9.5 33.5 H38.5"/>"""),
    ("nuage", "Nuage (cloud)", "reseau", """
        <path d="M14 37 H35 A8 8 0 0 0 35 21 A11 11 0 0 0 15 19.5 A8.8 8.8 0 0 0 14 37 Z"/>"""),
    ("reseau-etendu", "Réseau étendu (WAN)", "reseau", """
        <path v d="M11 13 H37 M11 13 L24 36 M37 13 L24 36"/>
        <circle cx="11" cy="13" r="5.5"/><circle cx="37" cy="13" r="5.5"/><circle cx="24" cy="36" r="5.5"/>"""),
    ("vlan", "VLAN", "reseau", """
        <path d="M10 14 H38 A5 10 0 0 1 38 34 H10 A5 10 0 0 1 10 14 Z"/>
        <ellipse cx="38" cy="24" rx="5" ry="10"/>
        <path v d="M9 19 H33"/>
        <path v stroke-dasharray="4 3" d="M9 24 H33"/>
        <path v stroke-dasharray="0.5 3.5" d="M9 29 H33"/>"""),
    ("liaison-trunk", "Liaison agrégée (trunk)", "reseau", """
        <path v d="M4 17 H44 M4 24 H44 M4 31 H44"/>
        <ellipse cx="24" cy="24" rx="7" ry="13"/>"""),
    ("repartiteur-de-charge", "Répartiteur de charge", "reseau", """
        <path v d="M15 24 L36 10 M15 24 H36 M15 24 L36 38"/>
        <rect x="4" y="16" width="14" height="16" rx="2"/>
        <circle cx="39" cy="10" r="4.5"/><circle cx="39" cy="24" r="4.5"/><circle cx="39" cy="38" r="4.5"/>"""),
    ("panneau-de-brassage", "Panneau de brassage", "reseau", """
        <rect x="3" y="16" width="42" height="16" rx="2"/>
        <rect n stroke="none" x="8" y="21.5" width="3.5" height="5"/><rect n stroke="none" x="14" y="21.5" width="3.5" height="5"/><rect n stroke="none" x="20" y="21.5" width="3.5" height="5"/>
        <rect n stroke="none" x="26" y="21.5" width="3.5" height="5"/><rect n stroke="none" x="32" y="21.5" width="3.5" height="5"/><rect n stroke="none" x="38" y="21.5" width="3.5" height="5"/>"""),
    ("prise-rj45", "Prise réseau RJ45", "reseau", """
        <path d="M11 11 H37 V32 H31 V38 H17 V32 H11 Z"/>
        <path v stroke-width="1.6" d="M16.5 15 V21 M19.5 15 V21 M22.5 15 V21 M25.5 15 V21 M28.5 15 V21 M31.5 15 V21"/>"""),
    ("fibre-optique", "Fibre optique", "reseau", """
        <path v d="M4 40 C14 40 16 24 24 24"/>
        <rect x="24" y="19" width="11" height="10" rx="1.5"/>
        <path v d="M35 24 H40 M43 19 L45.5 16.5 M44 24 H46.5 M43 29 L45.5 31.5"/>"""),
    ("batiment", "Site, bâtiment", "reseau", """
        <rect x="10" y="6" width="28" height="36" rx="1"/>
        <rect x="15" y="11" width="5" height="5"/><rect x="21.5" y="11" width="5" height="5"/><rect x="28" y="11" width="5" height="5"/>
        <rect x="15" y="20" width="5" height="5"/><rect x="21.5" y="20" width="5" height="5"/><rect x="28" y="20" width="5" height="5"/>
        <rect x="20" y="31" width="8" height="11"/>"""),

    # ---------- Serveurs et stockage ----------
    ("serveur", "Serveur", "serveurs", """
        <rect x="13" y="5" width="22" height="38" rx="2"/>
        <path v d="M17.5 12 H30.5 M17.5 17 H30.5 M17.5 22 H30.5"/>
        <circle n cx="24" cy="36" r="2"/>"""),
    ("baie-de-serveurs", "Baie de serveurs", "serveurs", """
        <rect x="9" y="4" width="30" height="40" rx="2"/>
        <rect x="13" y="9" width="22" height="8" rx="1"/><rect x="13" y="20" width="22" height="8" rx="1"/><rect x="13" y="31" width="22" height="8" rx="1"/>
        <circle n cx="30.5" cy="13" r="1.4"/><circle n cx="30.5" cy="24" r="1.4"/><circle n cx="30.5" cy="35" r="1.4"/>"""),
    ("centre-de-donnees", "Centre de données", "serveurs", """
        <rect x="5" y="9" width="38" height="33" rx="2"/>
        <rect x="10" y="15" width="7" height="22"/><rect x="20.5" y="15" width="7" height="22"/><rect x="31" y="15" width="7" height="22"/>
        <path v stroke-width="1.6" d="M12 20 H15 M12 24 H15 M22.5 20 H25.5 M22.5 24 H25.5 M33 20 H36 M33 24 H36"/>"""),
    ("base-de-donnees", "Base de données", "serveurs", """
        <path d="M10 12 V36 A14 5 0 0 0 38 36 V12 Z"/>
        <ellipse cx="24" cy="12" rx="14" ry="5"/>
        <path v d="M10 20 A14 5 0 0 0 38 20 M10 28 A14 5 0 0 0 38 28"/>"""),
    ("stockage-nas", "Stockage en réseau (NAS)", "serveurs", """
        <rect x="8" y="7" width="32" height="34" rx="3"/>
        <rect x="12.5" y="12" width="5" height="18" rx="1"/><rect x="19" y="12" width="5" height="18" rx="1"/>
        <rect x="25.5" y="12" width="5" height="18" rx="1"/><rect x="32" y="12" width="3.5" height="18" rx="1"/>
        <circle n cx="15" cy="35.5" r="1.4"/><circle n cx="21.5" cy="35.5" r="1.4"/>"""),
    ("sauvegarde", "Sauvegarde", "serveurs", """
        <path v d="M10 24 A14 14 0 1 0 14 14 M21 14 H14 V7"/>
        <path v d="M24 16 V24 L30 28"/>"""),
    ("virtualisation", "Hyperviseur, machines virtuelles", "serveurs", """
        <path v d="M12.5 24 V30 M24 24 V30 M35.5 24 V30"/>
        <rect x="7" y="8" width="11" height="16" rx="1.5"/><rect x="18.5" y="8" width="11" height="16" rx="1.5"/><rect x="30" y="8" width="11" height="16" rx="1.5"/>
        <rect x="5" y="30" width="38" height="11" rx="2"/>
        <circle n cx="36" cy="35.5" r="1.4"/>"""),
    ("conteneur", "Conteneur", "serveurs", """
        <path d="M24 6 L40 15 V33 L24 42 L8 33 V15 Z"/>
        <path v d="M8 15 L24 24 L40 15 M24 24 V42"/>"""),
    ("onduleur", "Onduleur", "serveurs", """
        <rect x="12" y="5" width="24" height="38" rx="2"/>
        <path n stroke-width="1.2" d="M26.5 11 L18.5 25 H24.5 L21.5 36 L30 21.5 H24 Z"/>"""),

    # ---------- Postes et périphériques ----------
    ("poste-de-travail", "Poste de travail", "postes", """
        <path v d="M24 32 V39 M15 40 H33"/>
        <rect x="5" y="8" width="38" height="24" rx="2"/>"""),
    ("ordinateur-portable", "Ordinateur portable", "postes", """
        <rect x="10" y="10" width="28" height="20" rx="2"/>
        <path d="M4 34 H44 L41 39 H7 Z"/>"""),
    ("smartphone", "Smartphone", "postes", """
        <rect x="15" y="4" width="18" height="40" rx="3"/>
        <path v d="M21 9 H27"/>
        <circle n cx="24" cy="38.5" r="1.6"/>"""),
    ("telephone-ip", "Téléphone IP", "postes", """
        <path d="M9 22 V14 Q9 9 14 9 H34 Q39 9 39 14 V22 Z"/>
        <rect x="7" y="22" width="34" height="19" rx="3"/>
        <circle n cx="18" cy="28" r="1.5"/><circle n cx="24" cy="28" r="1.5"/><circle n cx="30" cy="28" r="1.5"/>
        <circle n cx="18" cy="34" r="1.5"/><circle n cx="24" cy="34" r="1.5"/><circle n cx="30" cy="34" r="1.5"/>"""),
    ("imprimante", "Imprimante", "postes", """
        <rect x="14" y="7" width="20" height="12"/>
        <rect x="6" y="18" width="36" height="16" rx="3"/>
        <rect x="14" y="28" width="20" height="13"/>
        <path v d="M18 33 H30 M18 37 H27"/>"""),
    ("camera", "Caméra de vidéosurveillance", "postes", """
        <path v d="M22 27 L24 37 M16 40 H32 M24 37 V40"/>
        <path d="M5 15 L35 10 L37 24 L7 29 Z"/>
        <path d="M35 13 L43 12 L44 21 L36.5 22"/>"""),
    ("objet-connecte", "Objet connecté (IoT)", "postes", """
        <path v d="M19 14 V8 M24 14 V8 M29 14 V8 M19 34 V40 M24 34 V40 M29 34 V40 M14 19 H8 M14 24 H8 M14 29 H8 M34 19 H40 M34 24 H40 M34 29 H40"/>
        <rect x="14" y="14" width="20" height="20" rx="2"/>
        <rect x="20" y="20" width="8" height="8"/>"""),
    ("tablette", "Tablette", "postes", """
        <rect x="9" y="5" width="30" height="38" rx="3"/>
        <circle n cx="24" cy="38.5" r="1.6"/>"""),

    # ---------- Sécurité ----------
    ("pare-feu", "Pare-feu", "securite", """
        <rect x="5" y="10" width="38" height="28" rx="1"/>
        <path v d="M5 19.3 H43 M5 28.7 H43 M17 10 V19.3 M31 10 V19.3 M11 19.3 V28.7 M24 19.3 V28.7 M37 19.3 V28.7 M17 28.7 V38 M31 28.7 V38"/>"""),
    ("cadenas", "Cadenas, chiffrement", "securite", """
        <path v d="M16 22 V16 A8 8 0 0 1 32 16 V22"/>
        <rect x="11" y="22" width="26" height="20" rx="3"/>
        <circle n cx="24" cy="30" r="2.6"/>
        <path v d="M24 32 V36"/>"""),
    ("vpn", "Tunnel chiffré (VPN)", "securite", """
        <path d="M5 41 V25 A19 19 0 0 1 43 25 V41 Z"/>
        <path v d="M13 41 V26 A11 11 0 0 1 35 26 V41"/>
        <path v stroke-width="2" d="M21.5 31 V29 A2.5 2.5 0 0 1 26.5 29 V31"/>
        <rect n stroke-width="1.5" x="20" y="31" width="8" height="6.5" rx="1"/>"""),
    ("bouclier", "Protection, cybersécurité", "securite", """
        <path d="M24 5 L39 11 V23 Q39 36 24 43 Q9 36 9 23 V11 Z"/>
        <path v d="M17 24 L22 29 L31 19"/>"""),
    ("sonde-ids", "Sonde de détection d'intrusion (IDS)", "securite", """
        <path d="M4 24 Q24 6 44 24 Q24 42 4 24 Z"/>
        <circle cx="24" cy="24" r="6.5"/>
        <circle n cx="24" cy="24" r="2.4"/>"""),
    ("proxy", "Serveur mandataire (proxy)", "securite", """
        <path v d="M3 24 H16 M32 24 H44 M39 19 L44 24 L39 29"/>
        <rect x="16" y="9" width="16" height="30" rx="2"/>
        <path v d="M20 24 H28 M25 20.5 L28 24 L25 27.5"/>"""),
    ("dmz", "Zone démilitarisée (DMZ)", "securite", """
        <rect v stroke-dasharray="4 3.5" x="4" y="6" width="40" height="36" rx="3"/>
        <rect x="17" y="12" width="14" height="24" rx="2"/>
        <path v d="M20.5 18 H27.5 M20.5 22 H27.5"/>
        <circle n cx="24" cy="31" r="1.5"/>"""),
    ("authentification", "Authentification, clé", "securite", """
        <path v d="M22 24 H43 M37 24 V31 M42 24 V30"/>
        <circle cx="14" cy="24" r="8"/>
        <circle v cx="12" cy="24" r="2.5"/>"""),
    ("alerte", "Alerte, incident", "securite", """
        <path d="M24 6 L43 40 H5 Z"/>
        <path v d="M24 18 V29"/>
        <circle n cx="24" cy="34.5" r="1.8"/>"""),

    # ---------- Services et personnes ----------
    ("utilisateur", "Utilisateur", "services", """
        <circle cx="24" cy="15" r="8"/>
        <path d="M9 43 Q9 27 24 27 Q39 27 39 43 Z"/>"""),
    ("groupe", "Groupe d'utilisateurs", "services", """
        <circle cx="11" cy="17" r="5"/><path d="M2 37 Q2 26 11 26 Q20 26 20 37 Z"/>
        <circle cx="37" cy="17" r="5"/><path d="M28 37 Q28 26 37 26 Q46 26 46 37 Z"/>
        <circle cx="24" cy="16" r="6.5"/><path d="M12 42 Q12 28 24 28 Q36 28 36 42 Z"/>"""),
    ("administrateur", "Administrateur", "services", """
        <circle cx="20" cy="15" r="8"/>
        <path d="M5 43 Q5 27 20 27 Q31 27 34 34"/>
        <circle cx="36" cy="38" r="6"/>
        <circle n cx="36" cy="38" r="2"/>"""),
    ("annuaire", "Annuaire (LDAP, Active Directory)", "services", """
        <rect x="9" y="5" width="30" height="38" rx="2"/>
        <path v d="M15 5 V43"/>
        <circle cx="28" cy="18" r="4.5"/>
        <path d="M20 33 Q20 25 28 25 Q36 25 36 33 Z"/>"""),
    ("serveur-dns", "Serveur de noms (DNS)", "services", """
        <rect x="4" y="6" width="17" height="36" rx="2"/>
        <path v d="M8 12 H17 M8 16 H17"/>
        <circle n cx="12.5" cy="36" r="1.6"/>
        <path v d="M36 13 V43"/>
        <path d="M27 11 H42 L45 14.5 L42 18 H27 Z"/>
        <path d="M44 23 H30 L27 26.5 L30 30 H44 Z"/>"""),
    ("serveur-de-fichiers", "Serveur de fichiers", "services", """
        <rect x="4" y="6" width="17" height="36" rx="2"/>
        <path v d="M8 12 H17 M8 16 H17"/>
        <circle n cx="12.5" cy="36" r="1.6"/>
        <path d="M24 17 H31 L34 20.5 H45 V40 H24 Z"/>"""),
    ("supervision", "Supervision", "services", """
        <path v d="M24 32 V39 M15 40 H33"/>
        <rect x="5" y="8" width="38" height="24" rx="2"/>
        <path v d="M9 21 H16 L19.5 14 L24.5 28 L28 21 H39"/>"""),
    ("messagerie", "Messagerie", "services", """
        <rect x="5" y="11" width="38" height="26" rx="2"/>
        <path v d="M6 13 L24 27 L42 13"/>"""),
    ("application-web", "Application web", "services", """
        <rect x="5" y="8" width="38" height="32" rx="2"/>
        <path v d="M5 16 H43 M11 24 H37 M11 30 H29"/>
        <circle n cx="10" cy="12" r="1.3"/><circle n cx="14.5" cy="12" r="1.3"/>"""),
    ("interface-api", "Interface de programmation (API)", "services", """
        <path v d="M18 9 Q12 9 12 15 V20 Q12 24 7 24 Q12 24 12 28 V33 Q12 39 18 39 M30 9 Q36 9 36 15 V20 Q36 24 41 24 Q36 24 36 28 V33 Q36 39 30 39"/>
        <circle n stroke="none" cx="18.5" cy="24" r="1.8"/><circle n stroke="none" cx="24" cy="24" r="1.8"/><circle n stroke="none" cx="29.5" cy="24" r="1.8"/>"""),
    ("horloge", "Synchronisation horaire (NTP)", "services", """
        <circle cx="24" cy="24" r="18"/>
        <path v d="M24 12 V24 L32 29"/>"""),
    ("telechargement", "Mise à jour, téléchargement", "services", """
        <path v d="M24 6 V30 M15 21 L24 30 L33 21 M8 33 V41 H40 V33"/>"""),
]


def lire(ident, source):
    """SVG d'un pictogramme → liste [balise, attributs], valeurs vérifiées."""
    source = re.sub(r"<(\w+) ([nv]) ", lambda m: f'<{m[1]} fill="{"#161616" if m[2] == "n" else "none"}" ', source)
    elements = []
    for el in ET.fromstring(f"<g>{source}</g>"):
        if el.tag not in BALISES:
            raise SystemExit(f"{ident} : balise refusée <{el.tag}>")
        attrs = {}
        for cle, valeur in el.attrib.items():
            if cle not in ATTRIBUTS:
                raise SystemExit(f"{ident} : attribut refusé {cle}")
            if cle in ("fill", "stroke"):
                if valeur not in COULEURS:
                    raise SystemExit(f"{ident} : couleur refusée {valeur}")
            elif not NOMBRES.match(valeur):
                raise SystemExit(f"{ident} : valeur refusée {cle}={valeur}")
            attrs[cle] = " ".join(valeur.split())
        elements.append([el.tag, attrs])
    return elements


def construire():
    icones = {}
    for ident, nom, categorie, source in PICTOGRAMMES:
        if not re.match(r"^[a-z0-9-]+$", ident) or ident in icones:
            raise SystemExit(f"Identifiant invalide ou en double : {ident}")
        if categorie not in CATEGORIES:
            raise SystemExit(f"{ident} : catégorie inconnue {categorie}")
        icones[ident] = {"nom": nom, "categorie": categorie, "elements": lire(ident, source)}
    return {"cote": COTE, "trait": {"fill": BLANC, "stroke": NOIR, "stroke-width": "2.5", "stroke-linecap": "round", "stroke-linejoin": "round"},
            "categories": CATEGORIES, "icones": icones}


def planche(jeu, chemin):
    trait = " ".join(f'{k}="{v}"' for k, v in jeu["trait"].items())
    cases = []
    for ident, icone in jeu["icones"].items():
        corps = "".join(f"<{b} " + " ".join(f'{k}="{v}"' for k, v in a.items()) + "/>" for b, a in icone["elements"])
        cases.append(f'<figure><svg viewBox="0 0 48 48" width="96" height="96"><g {trait}>{corps}</g></svg><figcaption>{ident}</figcaption></figure>')
    pathlib.Path(chemin).write_text(
        "<!doctype html><meta charset=utf-8><style>body{font:12px sans-serif;display:flex;flex-wrap:wrap;gap:8px;margin:12px;background:#fff}"
        "figure{margin:0;width:120px;text-align:center;border:1px solid #ddd;padding:6px}svg{background:repeating-linear-gradient(0deg,#fff,#fff 9px,#eef 10px)}</style>"
        + "".join(cases), encoding="utf-8")


def principal():
    parser = argparse.ArgumentParser()
    parser.add_argument("--planche", help="écrit aussi une planche HTML de contrôle")
    args = parser.parse_args()
    jeu = construire()
    CIBLE.write_text(json.dumps(jeu, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"{len(jeu['icones'])} pictogrammes → {CIBLE.relative_to(RACINE)} ({CIBLE.stat().st_size // 1024} Ko)")
    if args.planche:
        planche(jeu, args.planche)


if __name__ == "__main__":
    principal()
