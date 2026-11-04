#!/bin/bash
# FUSAIN — rattache le dépôt à un projet GitLab privé (second dépôt distant « gitlab ») et y pousse tout l'historique.
# Mode d'emploi : deploiement/GITLAB.md.
#
#   deploiement/ajouter-gitlab.sh <adresse du projet GitLab>
#   ex. deploiement/ajouter-gitlab.sh git@gitlab.exemple.fr:groupe/fusain.git
#       deploiement/ajouter-gitlab.sh https://gitlab.exemple.fr/groupe/fusain.git
#
# GitHub reste le dépôt « origin » ; Upload.sh pousse ensuite vers les deux.
set -euo pipefail
cd "$(dirname "$0")/.."
ADRESSE="${1:?adresse du projet GitLab attendue (voir deploiement/GITLAB.md)}"

python3 outils/generer.py --verifier
if [ -n "$(git status --porcelain)" ]; then
    echo "Des modifications ne sont pas validées : les committer avant de pousser." >&2
    git status --short >&2
    exit 1
fi

if git remote get-url gitlab >/dev/null 2>&1; then
    git remote set-url gitlab "$ADRESSE"
else
    git remote add gitlab "$ADRESSE"
fi
echo "Dépôt distant « gitlab » : $(git remote get-url gitlab)"

git push -u gitlab main
git push gitlab --tags
echo
echo "Poussé. Le pipeline (contrôles puis publication) se suit dans GitLab : Compilation > Pipelines."
echo "L'adresse de la page apparaît ensuite dans Déploiement > Pages."
