#!/bin/sh
# FUSAIN — copie des seuls fichiers servis par l'application (ni outils, ni tests, ni dépôt) dans un dossier.
# Sert au paquet Debian (construire-deb.sh) et à la publication GitLab Pages (.gitlab-ci.yml).
#
#   deploiement/copier-site.sh <dossier de destination>
#
# La liste suit celle du cache hors ligne (outils/generer.py : FICHIERS_CACHE, DOSSIERS_CACHE), plus sw.js.
set -eu
DEST="${1:?dossier de destination attendu}"
cd "$(dirname "$0")/.."
mkdir -p "$DEST"
cp -r index.html manifest.webmanifest sw.js css js libs icones cartes sbom schema Documentation \
      FUSAIN_cahier_des_charges.md NOMENCLATURE_LOGICIELLE_FUSAIN.md AUDIT_SECURITE_FUSAIN.md JOURNAL_DES_VERSIONS.md "$DEST/"
# Source de la nomenclature : le CycloneDX publié suffit
rm -f "$DEST/sbom/composants.json"
