#!/bin/bash
# Recette complète : logique, Chrome, robustesse, Firefox. À lancer depuis la racine du dépôt.
#   PLAYWRIGHT=/chemin/vers/playwright/index.mjs tests/tout.sh
# Prérequis : python3, node, Chrome ; pour Firefox, geckodriver lancé sur le port 4444 (sinon l'étape est ignorée).
set -u
cd "$(dirname "$0")/.."
PORT=8765
export FUSAIN_URL="http://127.0.0.1:$PORT/"
SORTIE="$PWD/tests/sortie"
mkdir -p "$SORTIE"
python3 -m http.server $PORT --bind 127.0.0.1 >/dev/null 2>&1 &
SERVEUR=$!
trap 'kill $SERVEUR 2>/dev/null' EXIT
sleep 1
echecs=0
etape() { echo; echo "== $1"; shift; "$@" || echecs=$((echecs + 1)); }
filtre() { "$@" > "$SORTIE/derniere-etape.log" 2>&1; code=$?; grep -E 'ECHEC|pageerror|✖|^ℹ (pass|fail)|erreurs console' "$SORTIE/derniere-etape.log"; echo "   $(grep -c '^OK' "$SORTIE/derniere-etape.log") contrôles réussis"; return $code; }
etape "Cohérence intégrité / cache / nomenclature" python3 outils/generer.py --verifier
etape "Logique et sécurité (sans navigateur)" filtre node --test tests/logique.test.mjs
etape "Recette Chrome" filtre node tests/recette.mjs "$SORTIE"
etape "Robustesse et corpus malveillant" filtre node tests/robustesse.mjs 200
# Chemin de mise à jour : copie jetable de la dernière version validée (HEAD), servie sur un second port
COPIE="$SORTIE/copie-maj"
if [ ! -e "$COPIE" ] || [ -f "$COPIE/sw.js" ]; then
    mkdir -p "$COPIE" && git archive HEAD | tar -x -C "$COPIE"
    (cd "$COPIE" && exec python3 -m http.server 8766 --bind 127.0.0.1) >/dev/null 2>&1 &
    SERVEUR2=$!
    sleep 1
    etape "Mise à jour d'un poste (ancienne version en cache)" filtre node tests/mise-a-jour.mjs "$COPIE"
    kill $SERVEUR2 2>/dev/null
fi
if curl -s -m 2 http://127.0.0.1:4444/status >/dev/null; then
    FUSAIN_SORTIE="$SORTIE" etape "Recette Firefox" filtre node tests/firefox.mjs
else
    echo; echo "== Recette Firefox : ignorée (geckodriver absent du port 4444)"
fi
echo
[ $echecs -eq 0 ] && echo "RECETTE COMPLÈTE : SUCCÈS" || echo "RECETTE : $echecs ÉTAPE(S) EN ÉCHEC"
exit $echecs
