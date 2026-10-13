// Bibliothèque de modèles de départ (cahier des charges §5.5)

import { DISPOSITIONS, codeInitial } from './diagrammes/diapo.js';

export const CATEGORIES = [
    ['processus', 'Processus et structure'],
    ['projet', 'Gestion de projet'],
    ['donnees', 'Analyse et données'],
    ['architecture', 'Ingénierie et architecture'],
    ['diapos', 'Diapositives de texte (charte de l\'État)'],
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
];

export const MODELE_INITIAL = MODELES[0];
