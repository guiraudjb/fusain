// Index des syntaxes : pour chaque type de schéma, la ligne d'en-tête, les mots clés et chaque sorte d'objet
// (écriture correcte, exemple, conseil). Sert à l'aide du mode code et au diagnostic des erreurs (diagnostic.js).
// « reconnait » dit qu'une ligne essaie d'écrire cet objet, même mal : l'ordre compte, le premier qui convient l'emporte.

const COMMENTAIRE = { id: 'commentaire', nom: 'Commentaire', reconnait: /^%%/, syntaxe: ['%% texte ignoré au rendu'], exemple: '%% À valider avec le service', aide: 'Une ligne qui commence par deux signes pour cent n\'est pas dessinée.' };
const TITRE = { id: 'titre', nom: 'Titre', reconnait: /^title\b/i, syntaxe: ['title Texte du titre'], exemple: 'title Répartition du budget', aide: 'Sans guillemets ni deux-points.' };

const LIEN_LOGIGRAMME = {
    id: 'lien', nom: 'Lien entre deux étapes',
    reconnait: /(^|\s|[\])}>])(<?[-=.]{1,}[>ox-]|<?-+\s*>|=>|->)/,
    syntaxe: ['A --> B', 'A --- B', 'A -->|texte| B', 'A -- texte --> B', 'A -.-> B', 'A ==> B', 'A <--> B', 'A --> B & C'],
    exemple: 'Reception -->|complet| Instruction',
    aide: 'Deux tirets puis un chevron (-->), entourés d\'espaces. Le texte se met entre barres verticales juste après la flèche. Pointillé : -.-> ; trait épais : ==>.',
};
const ETAPE_LOGIGRAMME = {
    id: 'etape', nom: 'Étape (forme et libellé)',
    reconnait: /^[\p{L}\p{N}_-]+\s*(\(\[|\[\(|\[\[|\(\(|\{\{|\[\/|\[\\|[[({>])/u,
    syntaxe: ['id["Texte"]  (rectangle)', 'id("Texte")  (arrondi)', 'id(["Texte"])  (pastille)', 'id{"Texte"}  (losange de décision)', 'id(("Texte"))  (cercle)', 'id[("Texte")]  (base de données)', 'id[["Texte"]]  (sous-programme)', 'id{{"Texte"}}  (hexagone)', 'id>"Texte"]  (drapeau)'],
    exemple: 'B{"Dossier complet ?"}',
    aide: 'Un identifiant sans espace, puis le libellé entre une ouverture et sa fermeture. Mettez le libellé entre guillemets dès qu\'il contient des parenthèses, crochets, accolades ou barres verticales.',
};
const LOGIGRAMME = {
    nom: 'Logigramme',
    entete: ['flowchart TD', 'flowchart LR', 'flowchart BT', 'flowchart RL', 'graph TD'],
    motsCles: ['flowchart', 'graph', 'subgraph', 'end', 'direction', 'style', 'classDef', 'class', 'linkStyle', 'click'],
    blocs: { ouvre: /^subgraph\b/, ferme: /^end\s*$/, fermeture: 'end' },
    objets: [
        COMMENTAIRE,
        { id: 'groupe', nom: 'Groupe (sous-graphe)', reconnait: /^(subgraph|sub-graph|subgrap|sousgraphe)\b/i, syntaxe: ['subgraph id ["Titre du groupe"]', '    étapes et liens du groupe', 'end'], exemple: 'subgraph accueil ["Accueil"]\n    A["Guichet"]\nend', aide: 'Chaque subgraph se termine par une ligne end.' },
        { id: 'fin', nom: 'Fin de groupe', reconnait: /^end\s*$/i, syntaxe: ['end'], exemple: 'end', aide: 'Ferme le dernier subgraph ouvert.' },
        { id: 'sens', nom: 'Sens d\'un groupe', reconnait: /^direction\b/, syntaxe: ['direction TB', 'direction LR'], exemple: 'direction LR', aide: 'TB ou TD (haut → bas), BT, LR (gauche → droite), RL.' },
        { id: 'style', nom: 'Style d\'une étape', reconnait: /^style\b/, syntaxe: ['style id fill:#couleur,stroke:#couleur'], exemple: 'style A fill:#e3e3fd,stroke:#000091', aide: 'Propriétés séparées par des virgules, sans espace.' },
        { id: 'classe', nom: 'Classe de style', reconnait: /^(classDef|class)\b/, syntaxe: ['classDef nom fill:#couleur', 'class id1,id2 nom', 'id:::nom'], exemple: 'classDef alerte fill:#ffe9e6\nclass D alerte', aide: '' },
        { id: 'styleLien', nom: 'Style d\'un lien', reconnait: /^linkStyle\b/, syntaxe: ['linkStyle numéro stroke:#couleur'], exemple: 'linkStyle 0 stroke:#e1000f', aide: 'Les liens sont numérotés à partir de 0, dans l\'ordre du code.' },
        LIEN_LOGIGRAMME,
        ETAPE_LOGIGRAMME,
        { id: 'icone', nom: 'Étape-icône', reconnait: /@\{/, syntaxe: ['id@{ icon: "illus:nom", label: "Texte" }'], exemple: 'web@{ icon: "illus:serveur-web", label: "Serveur web" }', aide: 'Seules les icônes embarquées (dsfr:, illus:, picto:) sont admises.' },
    ],
};

const SEQUENCE = {
    nom: 'Diagramme de séquence',
    entete: ['sequenceDiagram'],
    motsCles: ['sequenceDiagram', 'participant', 'actor', 'as', 'Note', 'loop', 'alt', 'else', 'opt', 'par', 'and', 'critical', 'option', 'break', 'rect', 'end', 'activate', 'deactivate', 'autonumber', 'box'],
    blocs: { ouvre: /^(loop|alt|opt|par|critical|break|rect|box)\b/, ferme: /^end\s*$/, fermeture: 'end' },
    objets: [
        COMMENTAIRE,
        { id: 'participant', nom: 'Participant', reconnait: /^(participant|actor|participan|acteur)\b/i, syntaxe: ['participant id as Nom affiché', 'actor id as Nom affiché'], exemple: 'participant A as Agent', aide: 'actor dessine un personnage.' },
        { id: 'note', nom: 'Note', reconnait: /^note\b/i, syntaxe: ['Note right of A: texte', 'Note left of A: texte', 'Note over A,B: texte'], exemple: 'Note over A,S: Contrôle automatique', aide: 'right of, left of ou over, puis deux-points avant le texte.' },
        { id: 'bloc', nom: 'Bloc (boucle, alternative…)', reconnait: /^(loop|alt|opt|par|critical|break|rect|box|else|and|option)\b/, syntaxe: ['loop Libellé', '    messages', 'end', 'alt Cas 1', '    messages', 'else Cas 2', '    messages', 'end'], exemple: 'alt Dossier complet\n    A->>U: Accusé de réception\nelse Incomplet\n    A->>U: Demande de pièces\nend', aide: 'Chaque bloc se termine par end.' },
        { id: 'fin', nom: 'Fin de bloc', reconnait: /^end\s*$/i, syntaxe: ['end'], exemple: 'end', aide: '' },
        { id: 'activation', nom: 'Activation', reconnait: /^(activate|deactivate)\b/, syntaxe: ['activate A', 'deactivate A'], exemple: 'activate A', aide: '' },
        { id: 'numerotation', nom: 'Numérotation', reconnait: /^autonumber\b/, syntaxe: ['autonumber'], exemple: 'autonumber', aide: '' },
        { id: 'message', nom: 'Message', reconnait: /[-=<]+[>x)]|->|=>|—>/, syntaxe: ['A->>B: texte  (appel)', 'A-->>B: texte  (réponse, pointillé)', 'A->B: texte  (trait sans pointe)', 'A-xB: texte  (message perdu)', 'A-)B: texte  (asynchrone)', 'A->>+B: texte  (active B)'], exemple: 'U->>A: Dépôt de la demande', aide: 'Émetteur, flèche, destinataire, deux-points, puis le texte.' },
    ],
};

const ETATS = {
    nom: 'Diagramme d\'états',
    entete: ['stateDiagram-v2'],
    motsCles: ['stateDiagram-v2', 'state', 'as', 'note', 'direction', 'end'],
    blocs: { ouvre: /\{\s*$/, ferme: /^\}\s*$/, fermeture: '}' },
    objets: [
        COMMENTAIRE,
        { id: 'etat', nom: 'État nommé', reconnait: /^state\b/i, syntaxe: ['state "Nom affiché" as id', 'state id {', '    états internes', '}'], exemple: 'state "Validé" as Valide', aide: 'Le nom affiché entre guillemets, puis as et l\'identifiant sans espace.' },
        { id: 'note', nom: 'Note', reconnait: /^note\b/i, syntaxe: ['note right of id : texte'], exemple: 'note right of Valide : Signé par le chef de service', aide: '' },
        { id: 'transition', nom: 'Transition', reconnait: /-+>|=>/, syntaxe: ['A --> B', 'A --> B : texte', '[*] --> A  (état initial)', 'A --> [*]  (état final)'], exemple: 'Relecture --> Valide : Avis favorable', aide: 'Deux tirets et un chevron ; le texte après « : ».' },
    ],
};

const CLASSES = {
    nom: 'Diagramme de classes',
    entete: ['classDiagram'],
    motsCles: ['classDiagram', 'class', 'direction', 'note', 'namespace'],
    blocs: { ouvre: /\{\s*$/, ferme: /^\}\s*$/, fermeture: '}' },
    objets: [
        COMMENTAIRE,
        { id: 'classe', nom: 'Classe', reconnait: /^class\b/i, syntaxe: ['class Nom {', '    +Type attribut', '    +methode()', '}', 'class Nom'], exemple: 'class Agent {\n    +String matricule\n    +traiterDossier()\n}', aide: '+ public, - privé, # protégé.' },
        { id: 'relation', nom: 'Relation', reconnait: /(<\|--|--\|>|\*--|--\*|o--|--o|-->|<--|--|\.\.>|\.\.|->)/, syntaxe: ['A <|-- B  (héritage)', 'A *-- B  (composition)', 'A o-- B  (agrégation)', 'A --> B  (association)', 'A ..> B  (dépendance)', 'A "1" -- "*" B : texte'], exemple: 'Agent "1" -- "*" Dossier : instruit', aide: 'Les cardinalités vont entre guillemets, de chaque côté du trait.' },
        { id: 'membre', nom: 'Membre (dans une classe)', reconnait: /^[+\-#~]?[\p{L}\w]+/u, syntaxe: ['+Type nom', '+methode(paramètre) Type'], exemple: '+String nom', aide: '' },
    ],
};

const ENTITES = {
    nom: 'Diagramme entités-relations',
    entete: ['erDiagram'],
    motsCles: ['erDiagram'],
    blocs: { ouvre: /\{\s*$/, ferme: /^\}\s*$/, fermeture: '}' },
    objets: [
        COMMENTAIRE,
        { id: 'relation', nom: 'Relation', reconnait: /[|}o{][|o]?(--|\.\.)[|o]?[|{o}]|--|\.\.|[<>*]/, syntaxe: ['A ||--o{ B : libellé', 'A ||--|{ B : libellé', 'A }o--o{ B : libellé', 'A ||..|| B : libellé  (non identifiante)'], exemple: 'USAGER ||--o{ DEMANDE : soumet', aide: 'Cardinalités : || exactement un, |o zéro ou un, }o zéro ou plusieurs, }| un ou plusieurs (côté droit : o|, ||, o{, |{). Le libellé après « : » est obligatoire ("" s\'il est vide).' },
        { id: 'entite', nom: 'Entité et attributs', reconnait: /^[\p{L}\w"-]+\s*\{\s*$/u, syntaxe: ['ENTITE {', '    type nom', '    type nom PK', '}'], exemple: 'DEMANDE {\n    int numero PK\n    date depot\n}', aide: 'Chaque attribut : son type puis son nom, sans espace dans l\'un ni l\'autre.' },
        { id: 'attribut', nom: 'Attribut (dans une entité)', reconnait: /^[\p{L}\w-]+(\s+[\p{L}\w-]+)?(\s+(PK|FK|UK))?/u, syntaxe: ['type nom', 'type nom PK', 'type nom "commentaire"'], exemple: 'string courriel', aide: '' },
    ],
};

const GANTT = {
    nom: 'Diagramme de Gantt',
    entete: ['gantt'],
    motsCles: ['gantt', 'title', 'dateFormat', 'axisFormat', 'excludes', 'includes', 'section', 'todayMarker', 'tickInterval', 'weekday'],
    objets: [
        COMMENTAIRE, TITRE,
        { id: 'format', nom: 'Format des dates', reconnait: /^(dateFormat|dateformat|date-format|axisFormat|axisformat)\b/i, syntaxe: ['dateFormat YYYY-MM-DD', 'axisFormat %d/%m'], exemple: 'dateFormat YYYY-MM-DD', aide: 'dateFormat décrit les dates écrites dans les tâches ; axisFormat, celles de l\'axe.' },
        { id: 'exclusion', nom: 'Jours exclus', reconnait: /^excludes?\b/i, syntaxe: ['excludes weekends', 'excludes 2026-05-01'], exemple: 'excludes weekends', aide: '' },
        { id: 'section', nom: 'Section', reconnait: /^section\b/i, syntaxe: ['section Nom de la section'], exemple: 'section Phase 1', aide: '' },
        { id: 'tache', nom: 'Tâche', reconnait: /:|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}|\b\d+[dwhjs]\b/, syntaxe: ['Nom :id, 2026-01-05, 10d', 'Nom :id, after autre_id, 5d', 'Nom :done, id, 2026-01-05, 2026-01-20', 'Nom :active, id, after autre_id, 1w', 'Nom :milestone, id, after autre_id, 0d'], exemple: 'Conception :done, t1, 2026-01-05, 20d', aide: 'Nom, deux-points, puis états facultatifs (done, active, crit, milestone), identifiant, début (date au dateFormat ou after id), fin ou durée (d jours, w semaines, h heures).' },
    ],
};

const CAMEMBERT = {
    nom: 'Camembert',
    entete: ['pie', 'pie showData'],
    motsCles: ['pie', 'showData', 'title'],
    objets: [
        COMMENTAIRE, TITRE,
        { id: 'part', nom: 'Part', reconnait: /.+/, syntaxe: ['"Libellé" : valeur'], exemple: '"Subventions" : 450', aide: 'Libellé entre guillemets droits, deux-points, nombre positif avec un point décimal (12.5).' },
    ],
};

const CARTE_MENTALE = {
    nom: 'Carte mentale',
    entete: ['mindmap'],
    motsCles: ['mindmap'],
    objets: [
        COMMENTAIRE,
        { id: 'idee', nom: 'Idée', reconnait: /.+/, syntaxe: ['Texte', 'id["Texte"]  (rectangle)', 'id("Texte")  (arrondi)', 'id(("Texte"))  (cercle)', 'id{{"Texte"}}  (hexagone)', '::icon(fa fa-nom)'], exemple: 'mindmap\n  n1(("Action publique"))\n    Numérique\n      Démarches en ligne', aide: 'L\'indentation donne la hiérarchie : une seule racine, chaque niveau plus décalé que son parent (espaces, sans tabulation).' },
    ],
};

const ARCHITECTURE = {
    nom: 'Architecture',
    entete: ['architecture-beta'],
    motsCles: ['architecture-beta', 'group', 'service', 'junction', 'in'],
    objets: [
        COMMENTAIRE,
        { id: 'groupe', nom: 'Groupe', reconnait: /^(group|groupe)\b/i, syntaxe: ['group id(icône)[Titre]', 'group id(icône)[Titre] in parent'], exemple: 'group si(cloud)[Zone SI]', aide: '' },
        { id: 'service', nom: 'Service', reconnait: /^(service|servic|serivce)\b/i, syntaxe: ['service id(icône)[Libellé]', 'service id(icône)[Libellé] in groupe'], exemple: 'service web(server)[Serveur web] in si', aide: 'Icônes : cloud, database, disk, internet, server, ou une icône embarquée (dsfr:, illus:, picto:).' },
        { id: 'jonction', nom: 'Jonction', reconnait: /^junction\b/i, syntaxe: ['junction id', 'junction id in groupe'], exemple: 'junction carrefour', aide: '' },
        { id: 'liaison', nom: 'Liaison', reconnait: /--|->|<-/, syntaxe: ['a:R -- L:b', 'a:B --> T:b', 'a:R <--> L:b', 'a:R -[texte]- L:b'], exemple: 'parefeu:R -- L:web', aide: 'Chaque extrémité donne son côté : L (gauche), R (droite), T (haut), B (bas), collé au nom par deux-points.' },
    ],
};

const SIMPLES = {
    swimlane: { ...LOGIGRAMME, nom: 'Logigramme en couloirs', entete: ['swimlane-beta LR', 'swimlane-beta TD'], motsCles: [...LOGIGRAMME.motsCles, 'swimlane-beta'] },
    ishikawa: { nom: 'Diagramme d\'Ishikawa', entete: ['ishikawa'], motsCles: ['ishikawa'], objets: [COMMENTAIRE, { id: 'cause', nom: 'Effet, famille, cause', reconnait: /.+/, syntaxe: ['Effet observé (première ligne, non décalée)', '    Famille de causes', '        Cause'], exemple: 'ishikawa\n    Délais trop longs\n        Méthodes\n            Procédure non documentée', aide: 'L\'indentation donne le niveau.' }] },
    treeView: { nom: 'Arborescence', entete: ['treeView-beta'], motsCles: ['treeView-beta'], objets: [COMMENTAIRE, { id: 'element', nom: 'Élément', reconnait: /.+/, syntaxe: ['"Élément"', '    "Sous-élément"'], exemple: '"Direction"\n    "Pôle accueil"', aide: 'Libellés entre guillemets ; l\'indentation donne la hiérarchie.' }] },
    timeline: { nom: 'Frise chronologique', entete: ['timeline'], motsCles: ['timeline', 'title', 'section'], objets: [COMMENTAIRE, TITRE, { id: 'section', nom: 'Section', reconnait: /^section\b/i, syntaxe: ['section Période'], exemple: 'section 2024-2025', aide: '' }, { id: 'evenement', nom: 'Période et événements', reconnait: /.+/, syntaxe: ['Période : événement', '     : autre événement'], exemple: '2025 : Vote de la loi\n     : Promulgation', aide: 'Deux-points entourés d\'espaces avant chaque événement.' }] },
    kanban: { nom: 'Tableau Kanban', entete: ['kanban'], motsCles: ['kanban'], objets: [COMMENTAIRE, { id: 'colonne', nom: 'Colonne et carte', reconnait: /.+/, syntaxe: ['id[Titre de la colonne]', '    id[Texte de la carte]', '    id[Texte]@{ assigned: "Nom", priority: "High" }'], exemple: 'afaire[À faire]\n    t1[Rédiger le cahier des charges]', aide: 'Les cartes sont décalées sous leur colonne.' }] },
    journey: { nom: 'Parcours usager', entete: ['journey'], motsCles: ['journey', 'title', 'section'], objets: [COMMENTAIRE, TITRE, { id: 'section', nom: 'Section', reconnait: /^section\b/i, syntaxe: ['section Étape'], exemple: 'section Dépôt', aide: '' }, { id: 'tache', nom: 'Tâche', reconnait: /.+/, syntaxe: ['Tâche: note: Acteur1, Acteur2'], exemple: 'Formulaire en ligne: 3: Usager', aide: 'Note de satisfaction de 1 à 5.' }] },
    venn: { nom: 'Diagramme de Venn', entete: ['venn-beta'], motsCles: ['venn-beta', 'title', 'set', 'union'], objets: [COMMENTAIRE, TITRE, { id: 'ensemble', nom: 'Ensemble', reconnait: /^set\b/i, syntaxe: ['set id["Libellé"]'], exemple: 'set A["Particuliers"]', aide: '' }, { id: 'union', nom: 'Intersection', reconnait: /^union\b/i, syntaxe: ['union id1,id2["Libellé"]'], exemple: 'union A,B["Auto-entrepreneurs"]', aide: 'Identifiants séparés par une virgule, sans espace.' }] },
    quadrantChart: { nom: 'Matrice à quadrants', entete: ['quadrantChart'], motsCles: ['quadrantChart', 'title', 'x-axis', 'y-axis', 'quadrant-1', 'quadrant-2', 'quadrant-3', 'quadrant-4'], objets: [COMMENTAIRE, TITRE, { id: 'axe', nom: 'Axe', reconnait: /^[xy]-?axis\b/i, syntaxe: ['x-axis Faible --> Fort', 'y-axis Faible --> Fort'], exemple: 'x-axis Faible probabilité --> Forte probabilité', aide: '' }, { id: 'quadrant', nom: 'Nom d\'un quadrant', reconnait: /^quadrant/i, syntaxe: ['quadrant-1 Texte (en haut à droite)', 'quadrant-2 Texte (en haut à gauche)', 'quadrant-3 Texte', 'quadrant-4 Texte'], exemple: 'quadrant-1 Risques critiques', aide: '' }, { id: 'point', nom: 'Point', reconnait: /.+/, syntaxe: ['"Nom": [x, y]'], exemple: '"Cyberattaque": [0.2, 0.9]', aide: 'Coordonnées entre 0 et 1, avec un point décimal, séparées par une virgule.' }] },
    xychart: { nom: 'Graphique', entete: ['xychart-beta'], motsCles: ['xychart-beta', 'title', 'x-axis', 'y-axis', 'bar', 'line', 'horizontal'], objets: [COMMENTAIRE, { id: 'titre', nom: 'Titre', reconnait: /^title\b/i, syntaxe: ['title "Titre"'], exemple: 'title "Évolution mensuelle"', aide: '' }, { id: 'axe', nom: 'Axe', reconnait: /^[xy]-?axis\b/i, syntaxe: ['x-axis ["Jan", "Fév", "Mar"]', 'y-axis "Titre" 0 --> 500'], exemple: 'x-axis ["Jan", "Fév", "Mar"]', aide: 'Catégories entre guillemets, séparées par des virgules.' }, { id: 'serie', nom: 'Série', reconnait: /^(bar|line|barre|ligne)\b/i, syntaxe: ['bar [150, 200, 350]', 'line [150, 200, 350]'], exemple: 'bar [150, 200, 350]', aide: 'Nombres avec un point décimal, séparés par des virgules.' }] },
    sankey: { nom: 'Diagramme de flux (Sankey)', entete: ['sankey-beta'], motsCles: ['sankey-beta'], objets: [COMMENTAIRE, { id: 'flux', nom: 'Flux', reconnait: /.+/, syntaxe: ['Source,Cible,valeur', '"Source, avec virgule",Cible,valeur'], exemple: 'Budget,Sante publique,400', aide: 'Trois champs séparés par des virgules ; un libellé qui contient une virgule va entre guillemets ; valeur avec un point décimal. Les libellés ne peuvent pas contenir de lettres accentuées.' }] },
    gitGraph: { nom: 'Historique de versions', entete: ['gitGraph'], motsCles: ['gitGraph', 'commit', 'branch', 'checkout', 'merge', 'cherry-pick'], objets: [COMMENTAIRE, { id: 'commit', nom: 'Version', reconnait: /^commit\b/i, syntaxe: ['commit', 'commit id: "v1" tag: "Lancement"', 'commit type: HIGHLIGHT'], exemple: 'commit id: "v1" tag: "Lancement"', aide: 'Valeurs entre guillemets.' }, { id: 'branche', nom: 'Branche', reconnait: /^(branch|checkout|switch|merge)\b/i, syntaxe: ['branch nom', 'checkout nom', 'merge nom'], exemple: 'branch developpement', aide: 'Nom sans espace.' }] },
    packet: { nom: 'Trame réseau', entete: ['packet-beta'], motsCles: ['packet-beta', 'title'], objets: [COMMENTAIRE, TITRE, { id: 'champ', nom: 'Champ', reconnait: /.+/, syntaxe: ['début-fin: "Libellé"', 'bit: "Libellé"', '+longueur: "Libellé"'], exemple: '0-3: "Version"', aide: 'Positions en bits, deux-points, libellé entre guillemets.' }] },
    C4Context: { nom: 'C4', entete: ['C4Context', 'C4Container', 'C4Component'], motsCles: ['C4Context', 'C4Container', 'C4Component', 'title', 'Person', 'Person_Ext', 'System', 'System_Ext', 'SystemDb', 'Container', 'ContainerDb', 'Component', 'Rel', 'BiRel', 'Boundary', 'Enterprise_Boundary', 'System_Boundary', 'Container_Boundary'], blocs: { ouvre: /\{\s*$/, ferme: /^\}\s*$/, fermeture: '}' }, objets: [COMMENTAIRE, TITRE, { id: 'relation', nom: 'Relation', reconnait: /^(Bi)?Rel/i, syntaxe: ['Rel(de, vers, "Libellé")', 'Rel(de, vers, "Libellé", "Technologie")'], exemple: 'Rel(usager, portail, "Dépose sa demande", "HTTPS")', aide: '' }, { id: 'frontiere', nom: 'Frontière', reconnait: /Boundary/i, syntaxe: ['Enterprise_Boundary(id, "Libellé") {', '    éléments', '}'], exemple: 'Enterprise_Boundary(adm, "Administration") {\n    System(portail, "Portail")\n}', aide: '' }, { id: 'element', nom: 'Personne, système, conteneur', reconnait: /.+/, syntaxe: ['Person(id, "Nom", "Description")', 'System(id, "Nom", "Description")', 'System_Ext(id, "Nom", "Description")', 'SystemDb(id, "Nom", "Description")', 'Container(id, "Nom", "Techno", "Description")'], exemple: 'Person(usager, "Usager", "Dépose et suit sa demande")', aide: 'Arguments entre parenthèses, séparés par des virgules, textes entre guillemets.' }] },
    block: { nom: 'Schéma de blocs', entete: ['block-beta'], motsCles: ['block-beta', 'columns', 'block', 'end', 'space'], blocs: { ouvre: /^block(:|\s*$)/, ferme: /^end\s*$/, fermeture: 'end' }, objets: [COMMENTAIRE, { id: 'colonnes', nom: 'Colonnes', reconnait: /^columns\b/i, syntaxe: ['columns 3'], exemple: 'columns 3', aide: '' }, { id: 'groupe', nom: 'Bloc composé', reconnait: /^block\b/i, syntaxe: ['block:id:largeur', '    blocs', 'end'], exemple: 'block:socle:3\n    columns 3\n    a["A"]\nend', aide: '' }, { ...LIEN_LOGIGRAMME, syntaxe: ['a --> b', 'a -- "texte" --> b'] }, { ...ETAPE_LOGIGRAMME, syntaxe: ['id["Texte"]', 'id[("Base")]', 'id(("Cercle"))', 'id["Texte"]:2  (sur deux colonnes)'] }] },
    requirementDiagram: { nom: 'Exigences', entete: ['requirementDiagram'], motsCles: ['requirementDiagram', 'requirement', 'functionalRequirement', 'performanceRequirement', 'interfaceRequirement', 'physicalRequirement', 'designConstraint', 'element', 'id', 'text', 'risk', 'verifymethod', 'type', 'docref', 'satisfies', 'traces', 'contains', 'derives', 'refines', 'verifies', 'copies'], blocs: { ouvre: /\{\s*$/, ferme: /^\}\s*$/, fermeture: '}' }, objets: [COMMENTAIRE, { id: 'exigence', nom: 'Exigence', reconnait: /requirement|constraint/i, syntaxe: ['requirement nom {', '    id: "EX-1"', '    text: "Énoncé"', '    risk: low | medium | high', '    verifymethod: analysis | inspection | test | demonstration', '}'], exemple: 'requirement disponibilite {\n    id: "EX-1"\n    text: "Disponible 99,5 % du temps"\n    risk: high\n    verifymethod: test\n}', aide: '' }, { id: 'propriete', nom: 'Propriété', reconnait: /^(id|text|risk|verifymethod|type|docref)\s*:?/i, syntaxe: ['id: "EX-1"', 'text: "Énoncé"', 'risk: high', 'verifymethod: test'], exemple: 'risk: medium', aide: 'risk : low, medium ou high ; verifymethod : analysis, inspection, test ou demonstration.' }, { id: 'element', nom: 'Élément', reconnait: /^element\b/i, syntaxe: ['element nom {', '    type: "Logiciel"', '}'], exemple: 'element supervision {\n    type: "Outil"\n}', aide: '' }, { id: 'relation', nom: 'Relation', reconnait: /->|<-/, syntaxe: ['source - satisfies -> exigence', 'source - verifies -> exigence', 'a - contains -> b', 'a - derives -> b'], exemple: 'supervision - verifies -> disponibilite', aide: '' }] },
    radar: { nom: 'Radar', entete: ['radar-beta'], motsCles: ['radar-beta', 'title', 'axis', 'curve', 'max', 'min', 'graticule', 'ticks', 'showLegend'], objets: [COMMENTAIRE, TITRE, { id: 'axes', nom: 'Axes', reconnait: /^axis\b/i, syntaxe: ['axis id["Libellé"], id2["Libellé"]'], exemple: 'axis securite["Sécurité"], qualite["Qualité"]', aide: '' }, { id: 'courbe', nom: 'Courbe', reconnait: /^curve\b/i, syntaxe: ['curve id["Libellé"]{v1, v2, v3}'], exemple: 'curve a["Service A"]{4, 3, 5}', aide: 'Une valeur par axe, séparées par des virgules, point décimal.' }, { id: 'borne', nom: 'Bornes', reconnait: /^(max|min)\b/i, syntaxe: ['max 5', 'min 0'], exemple: 'max 5', aide: '' }] },
    treemap: { nom: 'Carte proportionnelle', entete: ['treemap-beta'], motsCles: ['treemap-beta'], objets: [COMMENTAIRE, { id: 'case', nom: 'Rubrique ou case', reconnait: /.+/, syntaxe: ['"Rubrique"', '    "Case": valeur'], exemple: '"Fonctionnement"\n    "Salaires": 400', aide: 'Libellés entre guillemets ; la valeur après deux-points, point décimal ; l\'indentation donne la hiérarchie.' }] },
    zenuml: { nom: 'Séquence ZenUML', entete: ['zenuml'], motsCles: ['zenuml', 'title', 'if', 'else', 'while', 'for', 'return', 'try', 'catch', 'par', 'opt'], blocs: { ouvre: /\{\s*$/, ferme: /^\}/, fermeture: '}' }, objets: [COMMENTAIRE, TITRE, { id: 'participant', nom: 'Participant', reconnait: /^@\w+/, syntaxe: ['@Actor Nom', '@Database Nom', 'Nom'], exemple: '@Actor Usager', aide: '' }, { id: 'message', nom: 'Message', reconnait: /->|\./, syntaxe: ['A->B: texte', 'A->B.methode(paramètre) {', '    return valeur', '}'], exemple: 'Usager->Portail: Dépose sa demande', aide: '' }, { id: 'condition', nom: 'Condition, boucle', reconnait: /^(if|else|while|for|try|catch|par|opt)\b/, syntaxe: ['if (condition) {', '    messages', '} else {', '    messages', '}'], exemple: 'if (dossier complet) {\n    Portail->Usager: Accusé\n}', aide: '' }] },
};

const DIAPO = {
    nom: 'Diapositive de texte',
    entete: ['diapo titre', 'diapo sommaire', 'diapo colonnes', 'diapo chiffres', 'diapo libre'],
    motsCles: ['diapo', 'titre', 'sous-titre', 'date', 'annee', 'numero', 'texte', 'partie', 'sous-partie', 'accroche'],
    objets: [
        { id: 'champ', nom: 'Champ', reconnait: /^[\p{L}-]+\s*:/u, syntaxe: ['clé: valeur'], exemple: 'titre: Titre de la<br>présentation', aide: 'Les champs admis dépendent de la mise en page (voir l\'en-tête). Un retour à la ligne s\'écrit <br>.' },
        { id: 'element', nom: 'Élément répété', reconnait: /^-/, syntaxe: ['- Titre | Texte', '- [dsfr:nom-icone] Titre | Texte'], exemple: '- ÉLÉMENT 1 | Descriptif de cette partie', aide: 'Les deux parties sont séparées par une barre verticale.' },
        { id: 'bloc', nom: 'Bloc (texte libre)', reconnait: /^(#|##|\||\[)/, syntaxe: ['# Titre', '## Sous-titre', '- Puce', '| cellule | cellule', '[dsfr:nom-icone]', 'Paragraphe'], exemple: '# Titre de la diapositive', aide: 'Mise en page « libre » seulement.' },
    ],
};

const CARTE = {
    nom: 'Carte',
    entete: ['carte france', 'carte region', 'carte departement', 'carte region-communes', 'carte epci', 'carte commune', 'carte monde', 'carte region-du-monde'],
    motsCles: ['carte', 'zone', 'epingle', 'pictogramme', 'annotation'],
    objets: [
        { id: 'donnee', nom: 'Donnée d\'un territoire', reconnait: /^-/, syntaxe: ['- code | valeur | texte | filtre'], exemple: '- 69 | 1843319 | Rhône', aide: 'Code officiel du territoire (INSEE ou ISO), valeur avec un point décimal.' },
        { id: 'zone', nom: 'Zone représentée', reconnait: /^zone\s*:/i, syntaxe: ['zone: code'], exemple: 'zone: 84', aide: 'Région, département ou région du monde selon l\'échelle.' },
        { id: 'epingle', nom: 'Épingle', reconnait: /^[ée]pingle\s*:/i, syntaxe: ['epingle: latitude longitude | #couleur | texte | icône'], exemple: 'epingle: 45.76 4.84 | #e1000f | Lyon', aide: 'Latitude puis longitude, en degrés décimaux avec un point.' },
        { id: 'pictogramme', nom: 'Pictogramme', reconnait: /^pictogramme\s*:/i, syntaxe: ['pictogramme: x y | icône | #couleur | taille'], exemple: 'pictogramme: 20 30 | picto:serveur | #000091 | 48', aide: 'Position en pourcentage de la carte.' },
        { id: 'annotation', nom: 'Annotation', reconnait: /^annotation\s*:/i, syntaxe: ['annotation: x y | x_pointe y_pointe | texte'], exemple: 'annotation: 70 15 | 55 45 | Siège', aide: '' },
        { id: 'option', nom: 'Option', reconnait: /^[\p{L}-]+\s*:/u, syntaxe: ['option: valeur'], exemple: 'palette: theme', aide: 'Options : voir le panneau de la carte, qui les écrit pour vous.' },
    ],
};

export const SYNTAXES = {
    flowchart: LOGIGRAMME,
    sequence: SEQUENCE,
    stateDiagram: ETATS,
    classDiagram: CLASSES,
    erDiagram: ENTITES,
    gantt: GANTT,
    pie: CAMEMBERT,
    mindmap: CARTE_MENTALE,
    architecture: ARCHITECTURE,
    ...SIMPLES,
    diapo: DIAPO,
    carte: CARTE,
};
SYNTAXES.C4Container = SYNTAXES.C4Context;
SYNTAXES.C4Component = SYNTAXES.C4Context;
SYNTAXES.C4Dynamic = SYNTAXES.C4Context;
SYNTAXES.C4Deployment = SYNTAXES.C4Context;

// Types proposés dans l'aide, sans doublon
export const TYPES_AIDE = Object.keys(SYNTAXES).filter((t, i, liste) => liste.findIndex((u) => SYNTAXES[u] === SYNTAXES[t]) === i);

// Premier objet de l'index qu'une ligne tente d'écrire
export function objetDe(type, ligne) {
    const t = String(ligne).trim();
    if (!t) return null;
    return SYNTAXES[type]?.objets.find((o) => o.reconnait.test(t)) || null;
}
