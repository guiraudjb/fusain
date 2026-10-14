#!/bin/bash
# FUSAIN — construction du paquet Debian « fusain-server » (cahier des charges §11).
#
#   deploiement/construire-deb.sh [dossier de sortie]
#
# Le paquet installe les fichiers statiques de l'application sous /var/www/html/FUSAIN et un site Nginx
# posant tous les en-têtes de sécurité. Aucune base de données, aucun service propre à FUSAIN.
set -euo pipefail
cd "$(dirname "$0")/.."
SORTIE="${1:-$PWD/tests/sortie}"
VERSION=$(sed -n "s/.*VERSION = '\([^']*\)'.*/\1/p" js/version.js | head -1)
python3 outils/generer.py --verifier

RACINE=$(mktemp -d)
trap 'rm -rf "$RACINE"' EXIT
PAQUET="$RACINE/fusain-server_${VERSION}_all"
WWW="$PAQUET/var/www/html/FUSAIN"
mkdir -p "$PAQUET/DEBIAN" "$WWW" "$PAQUET/etc/nginx/sites-available" "$PAQUET/usr/share/doc/fusain-server"

# Seuls les fichiers servis par l'application sont livrés : ni outils, ni tests, ni dépôt
cp -r index.html manifest.webmanifest sw.js css js libs icones cartes sbom schema Documentation \
      FUSAIN_cahier_des_charges.md NOMENCLATURE_LOGICIELLE_FUSAIN.md JOURNAL_DES_VERSIONS.md "$WWW/"
rm -f "$WWW/sbom/composants.json"
cp README.md "$PAQUET/usr/share/doc/fusain-server/"

# Site Nginx : même configuration que l'exemple, adaptée à une installation locale
sed -e 's/server_name fusain.exemple.gouv.fr;/server_name _;/' \
    -e 's#/etc/ssl/certs/fusain.pem#/etc/fusain/tls/fusain.pem#' \
    -e 's#/etc/ssl/private/fusain.key#/etc/fusain/tls/fusain.key#' \
    deploiement/nginx-fusain.conf > "$PAQUET/etc/nginx/sites-available/fusain"

cat > "$PAQUET/DEBIAN/control" <<CONTROLE
Package: fusain-server
Version: $VERSION
Section: web
Priority: optional
Architecture: all
Depends: nginx, openssl
Maintainer: FUSAIN <https://github.com/guiraudjb/fusain>
Homepage: https://github.com/guiraudjb/fusain
Description: FUSAIN - éditeur visuel de diagrammes Mermaid
 Fabrique Universelle de Schémas Accessibles, Intuitifs et Normés.
 Application web statique : tous les traitements s'exécutent dans le
 navigateur, ce paquet ne fait que servir les fichiers par Nginx avec
 les en-têtes de sécurité (politique de sécurité de contenu complète).
CONTROLE

cat > "$PAQUET/DEBIAN/conffiles" <<'CONF'
/etc/nginx/sites-available/fusain
CONF

cat > "$PAQUET/DEBIAN/postinst" <<'POSTINST'
#!/bin/sh
set -e
if [ "$1" = "configure" ]; then
    # Certificat auto-signé de première installation, à remplacer par celui de l'organisation
    if [ ! -f /etc/fusain/tls/fusain.pem ]; then
        mkdir -p /etc/fusain/tls
        chmod 750 /etc/fusain/tls
        openssl req -x509 -newkey rsa:3072 -nodes -days 365 \
            -keyout /etc/fusain/tls/fusain.key -out /etc/fusain/tls/fusain.pem \
            -subj "/CN=$(hostname -f 2>/dev/null || hostname)" >/dev/null 2>&1
        chmod 640 /etc/fusain/tls/fusain.key
        echo "fusain-server : certificat auto-signé créé dans /etc/fusain/tls (à remplacer)."
    fi
    # Activation du site ; le site par défaut de Nginx, qui occuperait les mêmes ports, est désactivé
    if [ ! -e /etc/nginx/sites-enabled/fusain ]; then
        ln -s /etc/nginx/sites-available/fusain /etc/nginx/sites-enabled/fusain
        rm -f /etc/nginx/sites-enabled/default
    fi
    if nginx -t >/dev/null 2>&1; then
        if [ -d /run/systemd/system ]; then systemctl reload nginx || systemctl restart nginx || true; fi
    else
        echo "fusain-server : la configuration Nginx est invalide, vérifier avec « nginx -t »." >&2
    fi
fi
POSTINST

cat > "$PAQUET/DEBIAN/postrm" <<'POSTRM'
#!/bin/sh
set -e
if [ "$1" = "remove" ] || [ "$1" = "purge" ]; then
    rm -f /etc/nginx/sites-enabled/fusain
    if [ -d /run/systemd/system ] && nginx -t >/dev/null 2>&1; then systemctl reload nginx || true; fi
fi
if [ "$1" = "purge" ]; then
    rm -rf /etc/fusain
fi
POSTRM
chmod 755 "$PAQUET/DEBIAN/postinst" "$PAQUET/DEBIAN/postrm"
find "$PAQUET" -type d -exec chmod 755 {} +
find "$PAQUET/var" "$PAQUET/etc" "$PAQUET/usr" -type f -exec chmod 644 {} +

mkdir -p "$SORTIE"
dpkg-deb --root-owner-group --build "$PAQUET" "$SORTIE/fusain-server_${VERSION}_all.deb" >/dev/null
echo "Paquet construit : $SORTIE/fusain-server_${VERSION}_all.deb ($(du -h "$SORTIE/fusain-server_${VERSION}_all.deb" | cut -f1))"
sha256sum "$SORTIE/fusain-server_${VERSION}_all.deb"
