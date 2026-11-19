# Obtenir les exports d'HPE IMC pour FUSAIN

Ce guide explique comment tirer d'HPE Intelligent Management Center (IMC, plateforme 7.3) les fichiers que lisent les modules réseau de FUSAIN, et comment les retravailler avant l'import. Les noms de menus sont donnés en anglais, langue de l'interface d'IMC ; ils peuvent différer légèrement selon la version et les modules installés.

FUSAIN lit les fichiers sur votre poste, sans les envoyer : le schéma est construit dans le navigateur.

## 0. Quel fichier pour quel module

| Module de FUSAIN | Fichier attendu | Méthodes pour l'obtenir | Retravail |
|---|---|---|---|
| **Importer un réseau (HPE IMC, LLDP)** | Liste des liens d'IMC, telle qu'exportée ; liste des équipements en option | Sections 2 à 5 | Aucun, ou presque : les colonnes sont reconnues d'après leur intitulé |
| **Commutateur et périphériques** | CSV à 3 colonnes : commutateur, lien, périphérique | Section 6 | Indispensable : ordre des colonnes, noms, sens des liens, tri des lignes inutiles |
| **Data center** | Le même CSV, avec une 4e colonne VLAN facultative | Section 6 | Comme ci-dessus, plus la colonne VLAN |

Les deux derniers modules ne reconnaissent **pas** les intitulés d'IMC : ils lisent les colonnes **par position**. Un export d'IMC n'y entre donc jamais tel quel.

## 1. Ce qu'il faut

| Fichier | Obligatoire | Ce qu'il apporte |
|---|---|---|
| Liste des liens | oui | Qui est relié à qui, par quelles interfaces, à quel débit, avec quels VLAN |
| Liste des équipements | non, mais conseillée | La catégorie de chaque équipement (donc son icône), son adresse IP et son emplacement (regroupement par site) |

Il faut un compte IMC qui voit la topologie et la liste des équipements : un compte opérateur en lecture suffit.

## 2. La liste des liens

L'export de la liste des liens vers Excel existe depuis IMC PLAT 7.3 E0710. Sur une version plus ancienne, voyez les sections 4 et 5.

1. Ouvrez **Resource › Network Topology** (Ressource › Topologie réseau), puis la vue qui couvre le périmètre voulu : *IP View* pour tout le réseau, ou une vue personnalisée (*Custom View*) pour un site.
2. Faites un clic droit dans une zone vide de la carte, puis choisissez **Link Management** (gestion des liens).
3. La page liste les liens de la vue. Si besoin, filtrez-la (par exemple par nom d'équipement).
4. Cliquez sur **Export** (ou *Export Excel*), puis sur le lien **Download Exported Data** de la fenêtre qui s'ouvre. Enregistrez le fichier.

Les colonnes utiles, que FUSAIN reconnaît d'après leur intitulé :

| Colonne IMC | Usage dans FUSAIN |
|---|---|
| Left Node, Right Node | Équipements des deux extrémités (« nom(adresse IP) » est accepté) |
| Left Interface, Right Interface | Interfaces, abrégées sur le schéma (GE1/0/1, XGE1/0/49, BAGG1) |
| Left / Right Interface VLAN Type | Port *access*, *trunk* ou *hybrid* : schéma logique |
| Left / Right Interface Allowed VLAN | VLAN autorisés : schéma logique |
| Link Speed | Débit (1G, 10G…) |
| Status | Un lien en panne est tracé en pointillé |
| Link Name, Link Type | Lus, sans effet sur le dessin |

Les colonnes VLAN n'apparaissent que si IMC connaît la configuration VLAN des ports (équipements gérés en SNMP en lecture). Sans elles, FUSAIN ne produit que le schéma physique.

## 3. La liste des équipements

1. Ouvrez **Resource › All Devices** (ou la *Device View*, ou la vue personnalisée du site).
2. Sans cocher d'équipement, cliquez sur **Export Excel** (ou *Export CSV*) au-dessus de la liste : tous les équipements de la liste sont exportés. Si vous cochez des équipements, seuls ceux-là le sont.
3. Cliquez sur **Download Exported Data** dans la fenêtre qui s'ouvre et enregistrez le fichier.

Avant l'export, vous pouvez ajouter des colonnes à la liste (bouton de personnalisation des colonnes) : FUSAIN se sert de **Device Label**, **IP Address**, **Device Category**, **Model** et **Location**. Renseigner l'emplacement (*Location*) des équipements dans IMC permet de regrouper le schéma par site.

### Site et local technique (colonnes facultatives)

Vous pouvez ajouter vous-même deux colonnes au fichier exporté, par exemple dans Excel, pour un regroupement à deux niveaux :

| Colonne à ajouter | Rôle | Intitulés reconnus |
|---|---|---|
| **Site** | Groupe principal : un cadre par site | Site, Groupe principal, Bâtiment, Building, Campus |
| **Local technique** | Sous-groupe : un cadre par local, dans le cadre de son site | Local technique, LT, Local, Sous-groupe, Étage, Salle, Baie |

- Les deux colonnes sont facultatives et peuvent rester vides pour certains équipements : un équipement sans local est placé directement dans son site.
- Si la colonne *Site* est remplie, elle passe avant *Location* ; sinon, *Location* reste le groupe principal, et le local technique s'y range.
- Un même nom de local (« Étage 1 ») peut revenir dans plusieurs sites : chaque site a son propre cadre.
- Les bornes, téléphones et postes suivent le local de leur commutateur.
- Sur un grand réseau (une page par site), les locaux techniques apparaissent en cadres dans la page de leur site.
- Les locaux ne sont pas dessinés si l'option « Regrouper les équipements » est réglée sur « Sans regroupement ».

Ces colonnes peuvent aussi être ajoutées **directement au fichier des liens**, une paire par extrémité : *Left Site*, *Left Local technique*, *Right Site*, *Right Local technique* (ou *Site A*, *Local technique A*, *Site B*, *Local technique B*). La liste des équipements n'est alors plus nécessaire pour le regroupement. Si les deux fichiers donnent un site différent pour le même équipement, la liste des équipements l'emporte.

```csv
Left Node,Left Interface,Left Site,Left Local technique,Right Node,Right Interface,Right Site,Right Local technique
CORE-PARIS,XGE1/0/50,Paris,Salle serveurs,SW-PARIS-E1,XGE1/0/51,Paris,LT étage 1
```

Exemple dans la liste des équipements :

```csv
Device Label,IP Address,Device Category,Site,Local technique
CORE-PARIS,10.1.0.10,Switches,Paris,Salle serveurs
SW-PARIS-E1,10.1.0.21,Switches,Paris,LT étage 1
SW-PARIS-E2,10.1.0.22,Switches,Paris,LT étage 2
RT-LYON,10.2.0.2,Routers,Lyon,
```

La recherche rapide (champ en haut à droite, *Query Devices*) propose aussi **Export Excel** et **Export CSV** pour le résultat d'une recherche : pratique pour ne prendre qu'un site.

## 4. Par l'API REST, avec le script PowerShell

Le script `Documentation/outils/Exporter-ReseauIMC.ps1` interroge l'API REST d'IMC, en lecture seule, et écrit directement les fichiers que lit FUSAIN :

- `reseau-liens.csv` : les liens, avec le **site** et le **local technique** de chaque extrémité. Ce fichier suffit à l'import ;
- `reseau-equipements.csv` : les équipements (catégorie, IP, modèle, emplacement, site, local), facultatif, pour les icônes.

Le site et le local viennent de l'emplacement (*Location*) des équipements dans IMC : écrivez-le sous la forme `Site / Local technique`, par exemple `Paris / LT étage 1`. Un emplacement sans « / » devient le site, sans local. Un autre séparateur se choisit avec `-Separateur ';'`.

```powershell
# Windows PowerShell 5.1 ou PowerShell 7 ; le mot de passe est demandé
.\Exporter-ReseauIMC.ps1 -Serveur https://imc.exemple.fr:8443 -IgnorerCertificat
.\Exporter-ReseauIMC.ps1 -Serveur http://10.0.0.5:8080 -Dossier C:\Exports -VueTopologie 1
```

| Paramètre | Rôle |
|---|---|
| `-Serveur` | Adresse d'IMC avec protocole et port |
| `-Identifiants` | Compte IMC autorisé sur l'API (*System › Operator Management*) ; demandé sinon |
| `-VueTopologie` | Vue dont on lit les liens ; 1 = vue IP, tout le réseau |
| `-Separateur` | Séparateur entre site et local dans l'emplacement ; chaîne vide : pas de découpage |
| `-Dossier` | Dossier des fichiers produits |
| `-IgnorerCertificat` | Accepte le certificat auto-signé d'IMC |

Si Windows bloque le script téléchargé : `Unblock-File .\Exporter-ReseauIMC.ps1`, ou lancez-le avec `powershell -ExecutionPolicy Bypass -File .\Exporter-ReseauIMC.ps1 -Serveur …`.

## 5. Sans export des liens

Sur une version d'IMC antérieure à 7.3 E0710, ou si la page *Link Management* n'offre pas d'export :

- **API REST d'IMC** : `GET /imcrs/plat/res/link?topoId=1` rend les liens de la vue IP (champs `leftSymbolName`, `leftIfDesc`, `rightSymbolName`, `rightIfDesc`, `bandWidth`, `status`). Convertissez la réponse en CSV en gardant ces noms de colonnes : FUSAIN les reconnaît. L'accès à l'API demande un compte autorisé (*System › Operator Management*).
- **Rapport de voisins LLDP** : la sortie de `display lldp neighbor-information list` (Comware) ou `show lldp neighbors` (ArubaOS, Cisco), mise en tableau avec les colonnes *Local Device*, *Local Port*, *Remote System Name*, *Remote Port ID* et, si possible, *System Capabilities Enabled* (pour reconnaître routeurs, téléphones et bornes). Quand le rapport vient d'un seul équipement, il n'y a pas de colonne « côté A » : FUSAIN demande alors le nom de cet équipement.
- **Saisie à la main** : un tableau à quatre colonnes (*Équipement A*, *Interface A*, *Équipement B*, *Interface B*) suffit.

## 6. Fichier à 3 ou 4 colonnes (« Commutateur et périphériques », « Data center »)

### 6.1 Format attendu

| Position | Contenu | Exemple |
|---|---|---|
| 1re colonne | Commutateur (le matériel réseau) | `SW-NORD-B01` |
| 2e colonne | Lien : port ou agrégat du commutateur | `Ten-GigabitEthernet1/0/5`, `Bridge-Aggregation12` |
| 3e colonne | Périphérique : serveur, NAS, autre commutateur… | `ESX-N01-05` |
| 4e colonne (Data center, facultative) | VLAN propagés sur le lien | `10,20,100-110` ou `1 to 4094` |

```csv
Commutateur;Lien;Périphérique;VLAN
CŒUR-DC-NORD;Bridge-Aggregation101;SW-NORD-B01;1,10,20,100-101
SW-NORD-B01;Ten-GigabitEthernet1/0/5;ESX-N01-05;10,20
```

- La ligne d'intitulés est facultative ; elle est reconnue si au moins deux intitulés ressemblent à « commutateur », « port », « périphérique », « VLAN ».
- Séparateur virgule, point-virgule ou tabulation ; UTF-8 ou Windows.
- Les colonnes au-delà de la 4e sont ignorées, avec un avertissement : on peut les garder pour mémoire, **après** les quatre colonnes utiles.
- Un commutateur qui apparaît aussi en 3e colonne d'un autre commutateur est reconnu comme commutateur en cascade (cœur → distribution → accès).
- Un lien entre deux commutateurs décrit des deux côtés (une ligne chez chacun) est tracé une seule fois, avec les deux ports.
- Les lignes en double sont comptées une fois ; une ligne dont le commutateur et le périphérique portent le même nom est ignorée.

### 6.2 Méthode A : à partir de la liste des liens d'IMC

Partez de l'export *Link Management* (section 2) ou de l'API (sections 4 et 5). Correspondance des colonnes :

| Colonne IMC | Devient |
|---|---|
| Left Node (ou `leftSymbolName`) | 1re colonne, commutateur |
| Left Interface (ou `leftIfDesc`) | 2e colonne, lien |
| Right Node (ou `rightSymbolName`) | 3e colonne, périphérique |
| Left Interface Allowed VLAN | 4e colonne, VLAN (Data center) |

Retravail nécessaire :

1. **Ordre des colonnes** : placez les quatre colonnes ci-dessus en tête, dans cet ordre ; supprimez ou rejetez les autres à droite.
2. **Retirer l'adresse IP des noms** : IMC écrit souvent `SW-NORD-B01(10.1.0.11)`. Ce module garde le nom tel quel ; si l'adresse reste, `SW-NORD-B01(10.1.0.11)` et `SW-NORD-B01` sont deux équipements différents. Formule Excel : `=SIERREUR(SUPPRESPACE(GAUCHE(A2;TROUVE("(";A2)-1));A2)`.
3. **Remettre le commutateur à gauche** : IMC ne range pas les extrémités d'un lien ; un serveur peut se trouver en *Left Node*. Il serait alors dessiné comme un commutateur. Repérez ces lignes avec la liste des équipements (colonne *Device Category* ≠ *Switches*, à rapprocher par `RECHERCHEV` sur le nom), puis échangez les colonnes de ces lignes : dans une colonne d'aide « inverser » valant VRAI ou FAUX, `=SI(E2;C2;A2)` pour le commutateur, `=SI(E2;D2;B2)` pour le lien (l'interface de droite), `=SI(E2;A2;C2)` pour le périphérique.
4. **VLAN** : la colonne *Allowed VLAN* n'existe que si IMC lit la configuration des ports en SNMP. Sur un port *access*, elle peut être vide : reportez à la main le VLAN natif (PVID) si vous voulez le voir.
5. **Limite de la méthode** : IMC ne connaît un serveur que s'il l'a découvert, c'est-à-dire si le serveur annonce LLDP (LLDP activé sur le commutateur virtuel distribué d'ESXi, `lldpd` sous Linux ; Windows ne l'annonce pas par défaut). Sans cela, l'export ne contient guère que les liens entre commutateurs : utilisez plutôt la méthode B.

### 6.3 Méthode B : à partir des descriptions de ports (matériel réseau ; port ; description)

Dans un data center, la description des ports (*description* dans la configuration, `ifAlias` en SNMP) porte en général le nom du serveur raccordé. C'est souvent la source la plus complète : elle ne dépend pas de LLDP. Le fichier obtenu, `matériel réseau ; port ; description du port`, a directement la forme attendue ; seul le contenu de la 3e colonne est à retravailler.

Quatre façons de l'obtenir :

- **API REST d'IMC** : `GET /imcrs/plat/res/device` donne la liste des équipements et leur identifiant ; puis, pour chaque commutateur, `GET /imcrs/plat/res/device/{id}/interface?start=0&size=1000` donne ses interfaces : nom (`ifDescription`), description (`ifAlias`), états (`adminStatus`, `operationStatus`). Les VLAN des ports se lisent par `/imcrs/vlan/access?devId={id}` (VLAN natif des ports *access*) et `/imcrs/vlan/trunk?devId={id}` (VLAN autorisés des *trunks*). Compte autorisé sur l'API (*System › Operator Management*) nécessaire. *Ces noms de champs viennent de la documentation de l'API et de la bibliothèque HPE pyhpeimc ; ils n'ont pas été vérifiés sur un IMC réel.*
- **Configurations sauvegardées par IMC** (module *Intelligent Configuration Center*, s'il est installé) : exportez la configuration courante des commutateurs, puis relevez les paires `interface …` / `description …`. Exemple en PowerShell, pour un fichier de configuration Comware (blocs terminés par `#`) ou Cisco (blocs terminés par `!`) :

```powershell
$commutateur = 'SW-NORD-B01'
$port = $null
Get-Content .\SW-NORD-B01.cfg | ForEach-Object {
    if ($_ -match '^interface\s+(\S+)') { $port = $Matches[1] }
    elseif ($port -and $_ -match '^\s+description\s+(.+)$') {
        [pscustomobject]@{ Commutateur = $commutateur; Lien = $port; Peripherique = $Matches[1].Trim() }
    }
    elseif ($_ -match '^[#!]') { $port = $null }
} | Export-Csv .\ports-SW-NORD-B01.csv -Delimiter ';' -NoTypeInformation -Encoding UTF8
```

- **Commande sur l'équipement** : `display interface brief description` (Comware) ou `show interfaces description` (Cisco) affiche port, état et description complète ; la sortie se colle dans Excel (*Données › Convertir*, largeur fixe ou espaces), en ajoutant une 1re colonne au nom du commutateur.
- **SNMP, sans IMC** : `snmpwalk` sur `IF-MIB::ifName` et `IF-MIB::ifAlias` ; les deux listes se rapprochent par le numéro d'interface (`ifIndex`).

Retravail nécessaire :

1. **Écarter les ports sans description**, et ceux fermés (*administratively down*), sauf si vous voulez les voir.
2. **Écarter les interfaces qui ne sont pas des ports** : `Vlan-interface`, `LoopBack`, `NULL0`, `M-GigabitEthernet` (port d'administration), `InLoopBack`.
3. **Écarter les descriptions qui ne nomment pas un équipement** : « Libre », « Réservé », « UPLINK », « Trunk », « A définir »… Filtrez la colonne dans Excel et supprimez les lignes visibles.
4. **Ports membres d'un agrégat** : si l'agrégat (`Bridge-Aggregation12`, `Port-channel12`) porte la description, ne gardez que lui ; sinon, gardez les ports membres. Garder les deux ferait apparaître le serveur trois fois sous le même commutateur.
5. **Ramener la description au nom de l'équipement** : « ESX-N01-05 vmnic0 », « esx-n01-05 / vmnic1 » et « ESX-N01-05 » doivent donner le même nom, sinon un serveur à deux cartes réseau apparaît deux fois. Premier mot de la description : `=SIERREUR(GAUCHE(SUPPRESPACE(C2);TROUVE(" ";SUPPRESPACE(C2))-1);SUPPRESPACE(C2))`, puis `MAJUSCULE` si la casse varie. Vérifiez à la main les descriptions qui commencent par un mot comme « vers », « to » ou « lien ».
6. **Liens entre commutateurs** : leur description contient souvent le nom du voisin (« vers CŒUR-DC-NORD ») ; ramenez-la au nom exact du commutateur voisin, tel qu'il est écrit en 1re colonne de ses propres lignes. C'est ce qui fait reconnaître la cascade et fusionner les deux côtés du lien.
7. **VLAN (Data center)** : ajoutez en 4e colonne les VLAN du port (VLAN natif d'un port *access*, VLAN autorisés d'un *trunk*), relevés par l'API VLAN ou dans la configuration (`port access vlan`, `port trunk permit vlan`).

### 6.4 Contrôles avant l'import

- Triez sur la 3e colonne : les doublons d'écriture (casse, espaces, suffixes `.domaine.local`) sautent aux yeux.
- Comptez les valeurs distinctes de la 1re colonne : ce doit être le nombre de commutateurs attendu.
- Enregistrez en **CSV UTF-8 (délimité par des points-virgules)** pour garder les accents et les noms contenant des virgules.
- Les noms peuvent contenir des caractères spéciaux (`#`, `&`, `<`, guillemets…) : ils s'affichent tels quels.

### 6.5 Dans FUSAIN

**Ajouter une page** › rubrique **Réseaux informatiques** › **Commutateur et périphériques (CSV à 3 colonnes)…** pour un ou quelques commutateurs, ou **Data center : vue globale et tous les commutateurs, VLAN (CSV à 3 ou 4 colonnes)…** pour un data center entier. Lisez le bilan (lignes lues, ignorées, en double, VLAN illisibles) avant de créer les pages.

## 7. Dans FUSAIN : « Importer un réseau »

1. **Ajouter une page** (ou **Modèles**) › rubrique **Réseaux informatiques** › **Importer un réseau (HPE IMC, LLDP : CSV, Excel)…**
2. Choisissez le fichier des liens, puis, si vous l'avez, la liste des équipements.
3. Vérifiez les colonnes reconnues ; corrigez-les au besoin dans les listes déroulantes.
4. Choisissez la présentation (icônes illustrées ou pictogrammes, regroupement, résumé des terminaux, schéma logique), lisez le bilan, puis **Créer les pages**.

Formats lus : `.xlsx`, CSV (virgule, point-virgule ou tabulation, UTF-8 ou Windows), tableau HTML enregistré en `.xls`. Un ancien classeur Excel 97-2003 (`.xls` binaire) est à réenregistrer en `.xlsx` ou en CSV.

## 8. Problèmes fréquents

| Constat | Cause probable | Remède |
|---|---|---|
| « Aucune liaison n'a pu être lue » | Colonnes non reconnues | Désignez les colonnes des deux équipements dans les listes déroulantes |
| Tous les équipements ont la même icône | Pas de liste des équipements | Ajoutez l'export de la liste des équipements, ou nommez les équipements avec un préfixe de rôle (`rt-`, `fw-`, `sw-`, `ap-`) |
| Un seul grand cadre « Sans groupe » | Emplacement non renseigné dans IMC | Renseignez *Location*, ajoutez une colonne *Site*, ou choisissez le regroupement par préfixe du nom ou par sous-réseau |
| Pas de cadre de local technique | Colonne non reconnue, ou « Sans regroupement » choisi | Désignez la colonne dans « Sous-groupe (local technique) » ; choisissez un regroupement |
| Pas de schéma logique | Colonnes VLAN absentes de l'export | Vérifiez que les ports sont lus par IMC (SNMP) ; à défaut, ajoutez les VLAN à la main sur le schéma |
| Des liens manquent | IMC ne les a pas découverts | Vérifiez LLDP sur les équipements et le calcul de topologie de niveau 2 (*System › System Configuration › System Settings › Layer 2 Topology Configuration*) |
| Module à 3 colonnes : un serveur dessiné comme un commutateur | Le serveur est en 1re colonne (lien IMC pris dans l'autre sens) | Remettez le commutateur à gauche (section 6.2, point 3) |
| Module à 3 colonnes : le même commutateur apparaît deux fois | Adresse IP collée au nom sur certaines lignes, casse ou suffixe de domaine différents | Retirez « (IP) » et uniformisez les noms (sections 6.2 et 6.4) |
| Module à 3 colonnes : un serveur apparaît plusieurs fois sous son commutateur | Description différente sur chaque carte réseau, ou agrégat et ports membres gardés ensemble | Ramenez la description au nom du serveur ; ne gardez que l'agrégat (section 6.3, points 4 et 5) |
| Data center : pas de cascade entre commutateurs | Le nom du voisin en 3e colonne diffère de celui de ses propres lignes | Écrivez le voisin exactement comme en 1re colonne (section 6.3, point 6) |
| Data center : « VLAN illisibles » au bilan | 4e colonne avec du texte (« tous », « aucun ») | Écrivez des numéros et des plages : `10,20,100-110` ou `1 to 4094` |

## 9. Fichiers d'exemple

Des exports fictifs, aux noms de colonnes documentés par HPE, permettent d'essayer l'import sans IMC. Ils se téléchargent depuis la fenêtre « À propos » de FUSAIN :

- `imc-liens.xlsx` et `imc-liens.csv` : liste des liens (siège et agence, VLAN, agrégat, lien en panne) ;
- `imc-equipements.csv` : liste des équipements correspondante (catégories, emplacements, locaux techniques du siège) ;
- `imc-liens-sites.csv` : liens avec le site et le local technique de chaque extrémité, en un seul fichier ;
- `imc-api.csv` : liens au format de l'API REST ;
- `lldp-voisins.csv` : rapport de voisins LLDP (téléphones, borne Wi-Fi).
- `commutateur-serveurs.csv`, `commutateur-48-serveurs.csv`, `plusieurs-commutateurs.csv` : fichiers à 3 colonnes pour « Commutateur et périphériques » ;
- `datacenter.csv` (3 colonnes), `datacenter-vlans.csv` et `datacenter-cascade.csv` (4 colonnes, VLAN) : forme visée après retravail, pour le module « Data center ».
