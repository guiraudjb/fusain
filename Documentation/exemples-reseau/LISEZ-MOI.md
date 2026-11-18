# Exports réseau fictifs

Fichiers inventés pour essayer l'import d'un réseau (« Importer un réseau ») et pour les tests (`tests/logique.test.mjs`).
Les noms de colonnes reprennent ceux que documente HPE IMC ; les équipements, adresses et ports sont fictifs.
Ils se téléchargent depuis la fenêtre « À propos » de FUSAIN. Pour obtenir les vrais exports, voir `../GUIDE_IMC.md`.

- `commutateur-serveurs.csv` : fichier à trois colonnes pour « Commutateur et périphériques » (commutateur, lien, périphérique) : un commutateur, cinq serveurs, trois agrégats (`Bridge-Aggregation…`) et deux liens gigabit (`G1/0/…`).
- `commutateur-48-serveurs.csv` : même format, 48 serveurs sous un commutateur 48 ports (12 agrégats `Bridge-Aggregation101` à `112`, 36 liens `G1/0/…`), dont quatre noms avec des caractères de la syntaxe de Mermaid (guillemets, crochets, chevrons, `&`, `|`) : les serveurs sont répartis en rangées ; la fenêtre d'import peut aussi les répartir sur plusieurs pages (par nombre de périphériques et/ou par type de lien).
- `plusieurs-commutateurs.csv` : même format, un cœur de réseau relié par agrégats à deux commutateurs d'étage, avec postes, imprimantes et bornes Wi-Fi (noms d'interface longs, à abréger) : pour la page unique, chaque commutateur encadré avec ses périphériques.
- `imc-liens.csv` : liste des liens exportée depuis « Gestion des liens » d'IMC (ligne de titre, nœuds « nom(IP) », VLAN).
- `imc-liens.xlsx` : le même tableau au format Excel.
- `imc-equipements.csv` : liste des équipements d'IMC (catégorie, emplacement).
- `imc-api.csv` : liens tels que les rend l'API REST d'IMC (`/imcrs/plat/res/link`), avec un doublon vu des deux côtés.
- `lldp-voisins.csv` : rapport de voisins LLDP, séparé par des points-virgules (téléphones, borne Wi-Fi).
