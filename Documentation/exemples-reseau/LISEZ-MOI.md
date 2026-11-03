# Exports réseau fictifs

Fichiers inventés pour essayer l'import d'un réseau (« Importer un réseau ») et pour les tests (`tests/logique.test.mjs`).
Les noms de colonnes reprennent ceux que documente HPE IMC ; les équipements, adresses et ports sont fictifs.
Ils se téléchargent depuis la fenêtre « À propos » de FUSAIN. Pour obtenir les vrais exports, voir `../GUIDE_IMC.md`.

- `imc-liens.csv` : liste des liens exportée depuis « Gestion des liens » d'IMC (ligne de titre, nœuds « nom(IP) », VLAN).
- `imc-liens.xlsx` : le même tableau au format Excel.
- `imc-equipements.csv` : liste des équipements d'IMC (catégorie, emplacement).
- `imc-api.csv` : liens tels que les rend l'API REST d'IMC (`/imcrs/plat/res/link`), avec un doublon vu des deux côtés.
- `lldp-voisins.csv` : rapport de voisins LLDP, séparé par des points-virgules (téléphones, borne Wi-Fi).
