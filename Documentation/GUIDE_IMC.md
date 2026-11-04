# Obtenir les exports d'HPE IMC pour FUSAIN

Ce guide explique comment tirer d'HPE Intelligent Management Center (IMC, plateforme 7.3) les deux fichiers que lit « Importer un réseau » : la liste des liens et la liste des équipements. Les noms de menus sont donnés en anglais, langue de l'interface d'IMC ; ils peuvent différer légèrement selon la version et les modules installés.

FUSAIN lit les fichiers sur votre poste, sans les envoyer : le schéma est construit dans le navigateur.

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

## 6. Dans FUSAIN

1. **Ajouter une page** (ou **Modèles**) › rubrique **Réseaux informatiques** › **Importer un réseau (HPE IMC, LLDP : CSV, Excel)…**
2. Choisissez le fichier des liens, puis, si vous l'avez, la liste des équipements.
3. Vérifiez les colonnes reconnues ; corrigez-les au besoin dans les listes déroulantes.
4. Choisissez la présentation (icônes illustrées ou pictogrammes, regroupement, résumé des terminaux, schéma logique), lisez le bilan, puis **Créer les pages**.

Formats lus : `.xlsx`, CSV (virgule, point-virgule ou tabulation, UTF-8 ou Windows), tableau HTML enregistré en `.xls`. Un ancien classeur Excel 97-2003 (`.xls` binaire) est à réenregistrer en `.xlsx` ou en CSV.

## 7. Problèmes fréquents

| Constat | Cause probable | Remède |
|---|---|---|
| « Aucune liaison n'a pu être lue » | Colonnes non reconnues | Désignez les colonnes des deux équipements dans les listes déroulantes |
| Tous les équipements ont la même icône | Pas de liste des équipements | Ajoutez l'export de la liste des équipements, ou nommez les équipements avec un préfixe de rôle (`rt-`, `fw-`, `sw-`, `ap-`) |
| Un seul grand cadre « Sans groupe » | Emplacement non renseigné dans IMC | Renseignez *Location*, ajoutez une colonne *Site*, ou choisissez le regroupement par préfixe du nom ou par sous-réseau |
| Pas de cadre de local technique | Colonne non reconnue, ou « Sans regroupement » choisi | Désignez la colonne dans « Sous-groupe (local technique) » ; choisissez un regroupement |
| Pas de schéma logique | Colonnes VLAN absentes de l'export | Vérifiez que les ports sont lus par IMC (SNMP) ; à défaut, ajoutez les VLAN à la main sur le schéma |
| Des liens manquent | IMC ne les a pas découverts | Vérifiez LLDP sur les équipements et le calcul de topologie de niveau 2 (*System › System Configuration › System Settings › Layer 2 Topology Configuration*) |

## 8. Fichiers d'exemple

Des exports fictifs, aux noms de colonnes documentés par HPE, permettent d'essayer l'import sans IMC. Ils se téléchargent depuis la fenêtre « À propos » de FUSAIN :

- `imc-liens.xlsx` et `imc-liens.csv` : liste des liens (siège et agence, VLAN, agrégat, lien en panne) ;
- `imc-equipements.csv` : liste des équipements correspondante (catégories, emplacements, locaux techniques du siège) ;
- `imc-liens-sites.csv` : liens avec le site et le local technique de chaque extrémité, en un seul fichier ;
- `imc-api.csv` : liens au format de l'API REST ;
- `lldp-voisins.csv` : rapport de voisins LLDP (téléphones, borne Wi-Fi).
