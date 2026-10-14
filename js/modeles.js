// Bibliothèque de modèles de départ (cahier des charges §5.5)

import { DISPOSITIONS, codeInitial } from './diagrammes/diapo.js';
import { codeInitial as carteInitiale } from './diagrammes/carte.js';

// Population municipale 2022 (INSEE, recensement repris dans ADMIN EXPRESS 2025), pour les cartes d'exemple
const POPULATION_DEPARTEMENTS = `
01:671289 02:525558 03:334715 04:167179 05:141677 06:1114579 07:333229 08:267204 09:155339 10:311076 11:377773 12:279736 13:2069811 14:704605
15:144399 16:351603 17:668160 18:299496 19:240120 21:537577 22:609598 23:115529 24:416325 25:548662 26:521432 27:601305 28:432950 29:927912 2A:166045
2B:185231 30:764010 31:1456261 32:192649 33:1674980 34:1217331 35:1109232 36:216809 37:616326 38:1291380 39:258405 40:428427 41:328953 42:772041
43:228161 44:1473156 45:687063 46:175620 47:332226 48:76503 49:828151 50:496815 51:564107 52:169865 53:305437 54:732898 55:180745 56:776103 57:1050721
58:202299 59:2616909 60:830725 61:276144 62:1460184 63:664385 64:699473 65:231453 66:492964 67:1156963 68:767800 69:1907982 70:233920 71:549136
72:566129 73:445288 74:849583 75:2113705 76:1260205 77:1452399 78:1470778 79:375415 80:565540 81:396168 82:264924 83:1108364 84:568702 85:706343
86:438688 87:372438 88:358700 89:333896 90:140082 91:1324546 92:1647435 93:1681725 94:1419531 95:1270845 971:383569 972:361019 973:288382 974:881348
976:256518 NR:48099`;
const POPULATION_METROPOLE_LYON = `
69003:3013 69029:42850 69033:2951 69034:43479 69040:6124 69044:5272 69046:4670 69063:4604 69068:2541 69069:12170 69071:1186 69072:8980 69081:18019
69085:1549 69087:3070 69088:7005 69089:15664 69091:20943 69096:9941 69100:8909 69116:3933 69117:3193 69123:520774 69127:3711 69142:6554 69143:7807
69149:37928 69153:1394 69163:3620 69168:1546 69191:6113 69194:7405 69199:19549 69202:21893 69204:21329 69205:5370 69207:3037 69233:1241 69244:22819
69250:4460 69256:52448 69259:66701 69260:5175 69266:162207 69271:11214 69273:11196 69275:29905 69276:9727 69278:5632 69279:6109 69282:36437
69283:13716 69284:3270 69286:31479 69290:49193 69292:7039 69293:2418 69296:3131`;
const paires = (texte) => texte.trim().split(/\s+/).map((p) => { const [code, valeur] = p.split(':'); return [code, Number(valeur)]; });

export const CATEGORIES = [
    ['processus', 'Processus et structure'],
    ['projet', 'Gestion de projet'],
    ['donnees', 'Analyse et données'],
    ['architecture', 'Ingénierie et architecture'],
    ['diapos', 'Diapositives de texte (charte de l\'État)'],
    ['cartes', 'Cartes (moteur de SimpleCarto)'],
];

export const MODELES = [
    { id: 'logigramme', categorie: 'processus', nom: 'Logigramme', code: `flowchart TD
    A(["Réception du dossier"])
    B{"Dossier complet ?"}
    C["Instruction"]
    D["Demande de pièces complémentaires"]
    E(["Notification à l'usager"])
    A --> B
    B -->|"Oui"| C
    B -->|"Non"| D
    D --> A
    C --> E
` },
    { id: 'logigramme-icones', categorie: 'processus', nom: 'Logigramme illustré', code: `flowchart LR
    usager@{ icon: "illus:utilisateur", label: "Usager", pos: "b" }
    portail@{ icon: "dsfr:computer-line", label: "Portail", pos: "b" }
    agent@{ icon: "illus:administrateur", label: "Agent instructeur", pos: "b" }
    decision{"Dossier complet ?"}
    base@{ icon: "illus:base-de-donnees", label: "Archivage", pos: "b" }
    usager -->|"Dépose"| portail
    portail --> agent
    agent --> decision
    decision -->|"Oui"| base
    decision -->|"Non"| usager
` },
    { id: 'sequence', categorie: 'processus', nom: 'Diagramme de séquence', code: `sequenceDiagram
    actor U as Usager
    participant A as Agent
    participant S as Système
    U->>A: Dépôt de la demande
    A->>S: Saisie des données
    S-->>A: Validation technique
    A-->>U: Remise du récépissé
` },
    { id: 'carte-mentale', categorie: 'processus', nom: 'Carte mentale', code: `mindmap
  n1(("Action publique"))
    Transition écologique
      Énergies renouvelables
      Rénovation thermique
    Numérique
      Démarches en ligne
      Inclusion numérique
    Sécurité
      Prévention
      Intervention
` },
    { id: 'organigramme', categorie: 'processus', nom: 'Organigramme', code: `flowchart TD
    D["Direction"]
    P1["Pôle Gestion publique"]
    P2["Pôle Gestion fiscale"]
    P3["Pôle Pilotage et ressources"]
    S1["Service comptabilité"]
    S2["Service des particuliers"]
    S3["Service des entreprises"]
    S4["Ressources humaines"]
    S5["Informatique"]
    D --- P1
    D --- P2
    D --- P3
    P1 --- S1
    P2 --- S2
    P2 --- S3
    P3 --- S4
    P3 --- S5
` },
    { id: 'couloirs', categorie: 'processus', nom: 'Logigramme en couloirs', code: `swimlane-beta LR
    subgraph usager ["Usager"]
        depot["Dépose sa demande"]
        recoit(["Reçoit la décision"])
    end
    subgraph accueil ["Accueil"]
        enregistre["Enregistre le dossier"]
        complet{"Dossier complet ?"}
    end
    subgraph instruction ["Service instructeur"]
        instruit["Instruit la demande"]
        decide["Rédige la décision"]
    end
    depot --> enregistre
    enregistre --> complet
    complet -->|"Non"| depot
    complet -->|"Oui"| instruit
    instruit --> decide
    decide --> recoit
` },
    { id: 'ishikawa', categorie: 'processus', nom: 'Causes et effet (Ishikawa)', code: `ishikawa
    Délais de traitement trop longs
        Méthodes
            Procédure non documentée
            Validations successives
        Personnel
            Effectifs insuffisants
            Formation incomplète
        Outils
            Logiciel métier lent
        Usagers
            Dossiers incomplets
` },
    { id: 'arborescence', categorie: 'architecture', nom: 'Arborescence', code: `treeView-beta
    "Direction"
        "Pôle accueil"
            "Guichet"
            "Téléphone"
        "Pôle instruction"
            "Aides"
            "Autorisations"
        "Pôle support"
` },
    { id: 'etats', categorie: 'processus', nom: 'Diagramme d\'états', code: `stateDiagram-v2
    state "Validé" as Valide
    state "Publié" as Publie
    [*] --> Brouillon
    Brouillon --> Relecture : Demande d'avis
    Relecture --> Brouillon : Corrections requises
    Relecture --> Valide : Avis favorable
    Valide --> Publie : Mise en ligne
    Publie --> [*]
` },
    { id: 'gantt', categorie: 'projet', nom: 'Planning (Gantt)', code: `gantt
    title Planning de déploiement
    dateFormat YYYY-MM-DD
    axisFormat %d/%m
    excludes weekends
    section Phase 1
    Conception :done, t1, 2026-01-05, 20d
    Développement :active, t2, after t1, 30d
    section Phase 2
    Tests et recette :t3, after t2, 15d
    Mise en production :milestone, t4, after t3, 0d
` },
    { id: 'frise', categorie: 'projet', nom: 'Frise chronologique', code: `timeline
    title Historique de la réforme
    2024 : Lancement de la concertation
         : Rapport préliminaire
    2025 : Vote de la loi
         : Promulgation
    2026 : Décrets d'application
         : Ouverture du portail usager
` },
    { id: 'kanban', categorie: 'projet', nom: 'Tableau Kanban', code: `kanban
    afaire[À faire]
        t1[Rédiger le cahier des charges]
        t2[Valider le budget]
    encours[En cours]
        t3[Développement]
    termine[Terminé]
        t4[Prototype]
` },
    { id: 'parcours', categorie: 'projet', nom: 'Parcours usager', code: `journey
    title Parcours usager : demande de subvention
    section Préparation
      Recherche d'information: 5: Usager
      Création du compte: 4: Usager, Système
    section Dépôt
      Formulaire en ligne: 3: Usager
      Ajout des pièces justificatives: 2: Usager
    section Instruction
      Vérification du dossier: 4: Agent
      Validation finale: 5: Directeur
` },
    { id: 'camembert', categorie: 'donnees', nom: 'Camembert', code: `pie showData
    title Répartition du budget (en k€)
    "Subventions" : 450
    "Fonctionnement" : 250
    "Investissement" : 200
    "Communication" : 100
` },
    { id: 'venn', categorie: 'donnees', nom: 'Diagramme de Venn', code: `venn-beta
    title Publics du service
    set A["Particuliers"]
    set B["Entreprises"]
    set C["Collectivités"]
    union A,B["Auto-entrepreneurs"]
    union B,C["Délégataires"]
` },
    { id: 'quadrant', categorie: 'donnees', nom: 'Matrice (quadrants)', code: `quadrantChart
    title Cartographie des risques
    x-axis Faible probabilité --> Forte probabilité
    y-axis Faible impact --> Fort impact
    quadrant-1 Risques critiques
    quadrant-2 Risques majeurs
    quadrant-3 Risques mineurs
    quadrant-4 Risques modérés
    "Cyberattaque": [0.2, 0.9]
    "Panne serveur": [0.3, 0.8]
    "Retard fournisseur": [0.8, 0.4]
    "Absence maladie": [0.7, 0.2]
` },
    { id: 'graphique', categorie: 'donnees', nom: 'Graphique en barres', code: `xychart-beta
    title "Évolution mensuelle des dossiers"
    x-axis ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin"]
    y-axis "Volume traité" 0 --> 500
    bar [150, 200, 350, 400, 280, 450]
    line [150, 200, 350, 400, 280, 450]
` },
    { id: 'flux', categorie: 'donnees', nom: 'Diagramme de flux (Sankey)', code: `sankey-beta

Budget,Sante publique,400
Budget,Transition ecologique,350
Sante publique,Hopitaux,250
Sante publique,Prevention,150
Transition ecologique,Renovation,200
Transition ecologique,Mobilite,150
` },
    { id: 'entites', categorie: 'architecture', nom: 'Modèle de données', code: `erDiagram
    USAGER ||--o{ DEMANDE : soumet
    USAGER {
        string identifiant
        string nom
        string courriel
    }
    DEMANDE ||--|{ DOCUMENT : contient
    DEMANDE {
        int numero_dossier
        date date_depot
        string statut
    }
` },
    { id: 'classes', categorie: 'architecture', nom: 'Diagramme de classes', code: `classDiagram
    class Agent {
        +String matricule
        +String nom
        +traiterDossier()
    }
    class Dossier {
        +int numero
        +String statut
        +valider()
    }
    Agent "1" -- "*" Dossier : instruit
` },
    { id: 'architecture', categorie: 'architecture', nom: 'Architecture technique', code: `architecture-beta
    group si(cloud)[Zone SI]
    service parefeu(cloud)[Pare feu]
    service web(server)[Serveur web] in si
    service bdd(database)[Base de donnees] in si

    parefeu:R -- L:web
    web:R -- L:bdd
` },
    { id: 'versions', categorie: 'architecture', nom: 'Historique de versions', code: `gitGraph
    commit id: "v1" tag: "Lancement"
    branch developpement
    checkout developpement
    commit id: "dev1"
    checkout main
    merge developpement
    commit id: "v2" tag: "Validation"
` },
    { id: 'paquet', categorie: 'architecture', nom: 'Structure de paquet réseau', code: `packet-beta
    title En-tête IPv4
    0-3: "Version"
    4-7: "IHL"
    8-15: "TOS"
    16-31: "Longueur totale"
    32-47: "Identification"
    48-50: "Drapeaux"
    51-63: "Décalage"
    64-71: "TTL"
    72-79: "Protocole"
    80-95: "Somme de contrôle"
    96-127: "Adresse source"
    128-159: "Adresse destination"
` },
    { id: 'c4', categorie: 'architecture', nom: 'Contexte du système (C4)', code: `C4Context
    title Contexte du système de gestion des demandes
    Person(usager, "Usager", "Dépose et suit sa demande")
    Person(agent, "Agent instructeur", "Instruit les dossiers")
    Enterprise_Boundary(administration, "Administration") {
        System(portail, "Portail des demandes", "Reçoit et suit les demandes")
        SystemDb(ged, "Gestion documentaire", "Conserve les pièces")
    }
    System_Ext(messagerie, "Messagerie", "Envoie les notifications")
    Rel(usager, portail, "Dépose sa demande", "HTTPS")
    Rel(agent, portail, "Instruit")
    Rel(portail, ged, "Archive")
    Rel(portail, messagerie, "Notifie")
` },
    { id: 'blocs', categorie: 'architecture', nom: 'Diagramme de blocs', code: `block-beta
    columns 3
    accueil["Accueil"]
    instruction["Instruction"]
    decision["Décision"]
    block:socle:3
        columns 3
        annuaire[("Annuaire")]
        documents[("Documents")]
        journal[("Journal")]
    end
    accueil --> instruction
    instruction --> decision
` },
    { id: 'exigences', categorie: 'projet', nom: 'Diagramme d\'exigences', code: `requirementDiagram
    requirement disponibilite {
        id: "EX-1"
        text: "Le service est disponible 99,5 % du temps"
        risk: high
        verifymethod: test
    }
    performanceRequirement temps_de_reponse {
        id: "EX-1.1"
        text: "Une page s'affiche en moins de 2 secondes"
        risk: medium
        verifymethod: test
    }
    element supervision {
        type: "outil"
        docref: "DOC-12"
    }
    disponibilite - contains -> temps_de_reponse
    supervision - verifies -> disponibilite
` },
    { id: 'radar', categorie: 'donnees', nom: 'Diagramme radar', code: `radar-beta
    title Maturité des services
    axis securite["Sécurité"], accessibilite["Accessibilité"], performance["Performance"], sobriete["Sobriété"], qualite["Qualité des données"]
    curve a["Service A"]{4, 3, 5, 2, 4}
    curve b["Service B"]{3, 5, 3, 4, 2}
    max 5
    min 0
` },
    { id: 'treemap', categorie: 'donnees', nom: 'Carte proportionnelle (treemap)', code: `treemap-beta
"Budget"
    "Fonctionnement"
        "Salaires": 400
        "Locaux": 150
        "Informatique": 90
    "Investissement"
        "Travaux": 200
        "Équipements": 100
    "Communication": 50
` },
    { id: 'zenuml', categorie: 'processus', nom: 'Séquence ZenUML', code: `zenuml
    title Dépôt d'une demande
    @Actor Usager
    Portail
    @Database Base
    Usager->Portail: Dépose sa demande
    Portail->Base.enregistrer(demande) {
        return numero
    }
    if (dossier complet) {
        Portail->Usager: Accusé de réception
    } else {
        Portail->Usager: Demande de pièces
    }
` },
    // Diapositives de texte : une page par mise en page, reprises des diapositives libres de VALOR
    ...Object.entries(DISPOSITIONS).map(([id, d]) => ({ id: `diapo-${id}`, categorie: 'diapos', nom: d.nom, code: codeInitial(id) })),
    // Cartes : une par échelle demandée, avec des données réelles là où le fond les fournit
    { id: 'carte-monde', categorie: 'cartes', nom: 'Monde', code: carteInitiale('monde', '', [], { etiquettes: 'aucune' }) },
    { id: 'carte-region-du-monde', categorie: 'cartes', nom: 'Région du monde', code: carteInitiale('region-du-monde', 'UEURO', [], { 'taille-etiquettes': 9 }) },
    { id: 'carte-france', categorie: 'cartes', nom: 'France (départements)', code: carteInitiale('france', '', paires(POPULATION_DEPARTEMENTS), { etiquettes: 'aucune' }) },
    { id: 'carte-region', categorie: 'cartes', nom: 'Région (départements)', code: carteInitiale('region', '53', paires(POPULATION_DEPARTEMENTS).filter(([c]) => ['22', '29', '35', '56'].includes(c)), { etiquettes: 'nom-valeur', 'taille-etiquettes': 14 }) },
    { id: 'carte-epci', categorie: 'cartes', nom: 'EPCI (communes)', code: carteInitiale('epci', '200046977', paires(POPULATION_METROPOLE_LYON), { etiquettes: 'aucune' }) },
];

export const MODELE_INITIAL = MODELES[0];
