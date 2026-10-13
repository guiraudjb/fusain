// Fidélité de la réécriture : pour chaque code du corpus, soit l'éditeur visuel le refuse (page en « code seul »,
// rien n'est réécrit), soit le code qu'il réécrit produit le même schéma : mêmes textes, même nombre de formes et de liens.
//   PLAYWRIGHT=/chemin/vers/playwright/index.mjs node tests/fidelite.mjs
const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright');
const CORPUS = [
    'graph TD\n    A[Christmas] -->|Get money| B(Go shopping)\n    B --> C{Let me think}\n    C -->|One| D[Laptop]\n    C -->|Two| E[iPhone]\n    C -->|Three| F[fa:fa-car Car]',
    'flowchart LR\n    A-->B\n    B-->C;\n    C-->D;',
    'flowchart TB\n    c1-->a2\n    subgraph one\n    a1-->a2\n    end\n    subgraph two\n    b1-->b2\n    end\n    subgraph three\n    c1-->c2\n    end\n    one --> two\n    three --> two\n    two --> c2',
    'flowchart LR\n    a --> b & c--> d',
    'flowchart TB\n    A & B--> C & D',
    'flowchart LR\n    A -- text --> B -- text2 --> C',
    'flowchart LR\n    A-.->B\n    A-. text .-> C\n    A ==> D\n    A == text ==> E\n    A --- F\n    A -- lien --- G\n    A ~~~ H',
    'flowchart LR\n    A --o B\n    B --x C\n    C o--o D\n    D <--> E\n    E x--x F',
    'flowchart TD\n    A[Start] --> B{Is it?}\n    B -->|Yes| C[OK]\n    C --> D[Rethink]\n    D --> B\n    B ---->|No| E[End]',
    'flowchart LR\n    id1([stadium]) --> id2[[subroutine]] --> id3[(Database)] --> id4((circle)) --> id5>asym] --> id6{rhombus} --> id7{{hexagon}} --> id8[/para/] --> id9[\\para alt\\] --> id10[/trap\\] --> id11[\\trap alt/] --> id12(((double)))',
    'flowchart LR\n    A["Texte avec (parenthèses) et [crochets]"] --> B["Ligne 1<br/>Ligne 2"]',
    'flowchart LR\n    id1[This is the text in the box]\n    id2',
    'flowchart TD\n    A:::rouge --> B\n    classDef rouge fill:#f96,stroke:#333\n    class B rouge\n    style A stroke-width:4px\n    linkStyle 0 stroke:#ff3,stroke-width:4px',
    'flowchart LR\n    subgraph TOP\n        direction TB\n        subgraph B1\n            direction RL\n            i1 -->f1\n        end\n        subgraph B2\n            direction BT\n            i2 -->f2\n        end\n    end\n    A --> TOP --> B\n    B1 --> B2',
    'flowchart LR\n    subgraph "Titre avec espaces"\n        a --> b\n    end\n    subgraph ide1 [Titre un]\n        c --> d\n    end',
    '%% commentaire en tête\nflowchart TD\n    %% commentaire au milieu\n    A --> B\n    B --> C',
    '%%{init: {"theme": "forest"}}%%\nflowchart TD\n    A --> B',
    '---\ntitle: Mon schéma\n---\nflowchart LR\n    A --> B',
    'flowchart LR\n    A@{ shape: cyl, label: "Base" } --> B@{ shape: diamond }',
    'flowchart LR\n    A e1@--> B\n    e1@{ animate: true }',
    'flowchart TD\n    A["`**gras** et _italique_`"] --> B',
    'flowchart TD\n    A --> B\n    click A "https://exemple.invalid" "infobulle"\n    click B call rappel()',
    'flowchart LR\n    Début --> Étape_2 --> fin_3',
    'flowchart LR\n    a-b --> c.d',
    'flowchart TD\n    A[Avec #quot;guillemets#quot; et #9829;] --> B',
    'graph\n    A --> B',
    'flowchart LR; A-->B; B-->C',
    'sequenceDiagram\n    Alice->>John: Hello John, how are you?\n    John-->>Alice: Great!\n    Alice-)John: See you later!',
    'sequenceDiagram\n    autonumber\n    actor A as Alice\n    participant B as Bob le bricoleur\n    A->>+B: Hello\n    B-->>-A: Hi\n    Note right of B: Bob réfléchit\n    Note over A,B: Une note large\n    loop Chaque minute\n        A->>B: ping\n    end\n    alt ok\n        B->>A: pong\n    else ko\n        B-xA: erreur\n    end\n    opt Optionnel\n        A-->B: fin\n    end',
    'sequenceDiagram\n    box Aqua Groupe\n    participant A\n    participant B\n    end\n    A->>B: bonjour\n    activate B\n    B->>A: salut\n    deactivate B\n    rect rgb(191, 223, 255)\n    A->>B: dans un rectangle\n    end',
    'sequenceDiagram\n    participant web as Web Browser\n    participant db as Storage\n    web->>db: A puis B\n    par Alice to Bob\n        web->>db: un\n    and Alice to John\n        web->>db: deux\n    end\n    critical Connexion\n        web-->db: connect\n    option Timeout\n        web-->db: log\n    end',
    'sequenceDiagram\n    Alice->>Bob: Hello\n    create participant Carl\n    Alice->>Carl: Hi Carl!\n    destroy Carl\n    Alice-xCarl: bye',
    'pie title Pets adopted by volunteers\n    "Dogs" : 386\n    "Cats" : 85\n    "Rats" : 15',
    'pie showData\n    title Clés\n    "Calcium" : 42.96\n    "Potassium" : 50.05\n    "Fer" : 5',
    'pie\n    "A" : 1\n    "B" : 2',
    'mindmap\n  root((mindmap))\n    Origins\n      Long history\n      ::icon(fa fa-book)\n      Popularisation\n        British popular psychology author Tony Buzan\n    Research\n      On effectiveness<br/>and features\n    Tools\n      Pen and paper\n      Mermaid',
    'mindmap\n    id[Carré]\n        id2(Arrondi)\n        id3((Cercle))\n        id4))Bang((\n        id5)Nuage(\n        id6{{Hexagone}}\n        Défaut\n        :::urgent',
    'mindmap\n  Racine\n    A\n      B\n   C',
    'gantt\n    title A Gantt Diagram\n    dateFormat YYYY-MM-DD\n    section Section\n        A task          :a1, 2014-01-01, 30d\n        Another task    :after a1, 20d\n    section Another\n        Task in Another :2014-01-12, 12d\n        another task    :24d',
    'gantt\n    dateFormat  YYYY-MM-DD\n    title       Adding GANTT\n    excludes    weekends\n    todayMarker off\n    section A section\n    Completed task            :done,    des1, 2014-01-06,2014-01-08\n    Active task               :active,  des2, 2014-01-09, 3d\n    Future task               :         des3, after des2, 5d\n    Crit                      :crit, done, 2014-01-06,24h\n    Jalon : milestone, m1, 2014-01-25, 0d',
    'gantt\n    dateFormat HH:mm\n    axisFormat %H:%M\n    Initial milestone : milestone, m1, 17:49, 2m\n    Task A : 10m\n    Task B : 5m\n    Final milestone : milestone, m2, 18:08, 4m',
    'timeline\n    title History of Social Media Platform\n    2002 : LinkedIn\n    2004 : Facebook\n         : Google\n    2005 : YouTube\n    2006 : Twitter',
    'timeline\n    title Sections\n    section Stone Age\n      7600 BC : Britain\'s oldest known house was built in Orkney, Scotland\n      6000 BC : Sea levels rise and Britain becomes an island.\n    section Bronze Age\n      2300 BC : People arrive : nouveau : style',
    'kanban\n  Todo\n    [Create Documentation]\n    docs[Create Blog about the new diagram]\n  id7[In progress]\n    id6[Create renderer]@{ assigned: \'knsv\', priority: \'High\' }',
    'kanban\n  a[À faire]\n    b[Tâche une]\n  c[Fait]',
    'quadrantChart\n    title Reach and engagement of campaigns\n    x-axis Low Reach --> High Reach\n    y-axis Low Engagement --> High Engagement\n    quadrant-1 We should expand\n    quadrant-2 Need to promote\n    quadrant-3 Re-evaluate\n    quadrant-4 May be improved\n    Campaign A: [0.3, 0.6]\n    Campaign B: [0.45, 0.23]',
    'stateDiagram-v2\n    [*] --> Still\n    Still --> [*]\n    Still --> Moving\n    Moving --> Still\n    Moving --> Crash\n    Crash --> [*]',
    'stateDiagram-v2\n    direction LR\n    state "En attente de validation" as att\n    [*] --> att\n    att --> ok : valider\n    att --> att : relancer\n    ok : Dossier validé\n    Isole',
    'stateDiagram-v2\n    [*] --> First\n    state First {\n        [*] --> second\n        second --> [*]\n    }',
    'stateDiagram-v2\n    state if_state <<choice>>\n    [*] --> IsPositive\n    IsPositive --> if_state\n    if_state --> False: if n < 0\n    if_state --> True : if n >= 0',
    'stateDiagram-v2\n    State1: The state with a note\n    note right of State1\n        Important information!\n    end note\n    State1 --> State2',
    'stateDiagram\n    s1 --> s2: Une transition\n    s2 --> s1',
    'quadrantChart\n    x-axis Urgent --> Not Urgent\n    y-axis Not Important --> "Important ❤"\n    Point A: [0.9, 0.0] radius: 12\n    Point B:::class1: [0.8, 0.1]\n    classDef class1 color: #109060',
    'journey\n    title My working day\n    section Go to work\n      Make tea: 5: Me\n      Go upstairs: 3: Me\n      Do work: 1: Me, Cat\n    section Go home\n      Go downstairs: 5: Me\n      Sit down: 5: Me',
    'journey\n    Sans section: 3\n    section A\n    section B\n      Tâche: 4: Moi, Toi',
    'xychart-beta\n    title "Sales Revenue"\n    x-axis [jan, feb, mar, apr, may, jun, jul, aug, sep, oct, nov, dec]\n    y-axis "Revenue (in $)" 4000 --> 11000\n    bar [5000, 6000, 7500, 8200, 9500, 10500, 11000, 10200, 9200, 8500, 7000, 6000]\n    line [5000, 6000, 7500, 8200, 9500, 10500, 11000, 10200, 9200, 8500, 7000, 6000]',
    'xychart-beta horizontal\n    title Sans guillemets\n    x-axis "Trimestre" ["T1", "T2"]\n    y-axis Volume\n    bar "Série" [1.5, -2]\n    line [3, 4]',
    'xychart-beta\n    line [1, 2, 4, 8]',
    'xychart-beta\n    x-axis "temps" 0 --> 10\n    line [1, 2, 4]',
    'sankey-beta\n\nAgricultural waste,Bio-conversion,124.729\nBio-conversion,Liquid,0.597\nBio-conversion,Losses,26.862\nBio-conversion,Solid,280.322\nBio-conversion,Gas,81.144',
    'sankey-beta\n\n"Avec, virgule",B,10\n"Avec ""guillemets""",B,5\n\nB,C,15',
    'erDiagram\n    CUSTOMER ||--o{ ORDER : places\n    ORDER ||--|{ LINE-ITEM : contains\n    CUSTOMER }|..|{ DELIVERY-ADDRESS : uses',
    'erDiagram\n    direction LR\n    CAR ||--o{ NAMED-DRIVER : allows\n    CAR {\n        string registrationNumber PK\n        string make\n        string model\n        string[] parts\n    }\n    PERSON ||--o{ NAMED-DRIVER : is\n    PERSON {\n        string driversLicense PK "The license #"\n        string(99) firstName "Only 99 characters are allowed"\n        string lastName\n        string phone UK\n        int age\n    }\n    NAMED-DRIVER {\n        string carRegistrationNumber PK, FK\n        string driverLicence PK, FK\n    }',
    'erDiagram\n    p[Person] {\n        string firstName\n    }\n    a["Customer Account"] {\n        string email\n    }\n    p ||--o| a : has',
    'erDiagram\n    CAR 1 to zero or more NAMED-DRIVER : allows\n    PERSON many(0) optionally to 0+ NAMED-DRIVER : is',
    'classDiagram\n    Animal <|-- Duck\n    Animal <|-- Fish\n    Animal : +int age\n    Animal : +String gender\n    Animal: +isMammal()\n    class Duck{\n        +String beakColor\n        +swim()\n        +quack()\n    }\n    class Fish{\n        -int sizeInFeet\n        -canEat()\n    }',
    'classDiagram\n    direction LR\n    class Shape["Forme géométrique"] {\n        <<interface>>\n        noOfVertices\n        draw()\n    }\n    class Color\n    <<enumeration>> Color\n    Shape "1" *-- "many" Color : contient\n    Shape ..> Color\n    Shape o-- Color\n    Color ..|> Shape\n    Color <--> Shape\n    Color .. Shape',
    'classDiagram\n    class Square~Shape~{\n        int id\n        List~int~ position\n    }\n    note for Square "une note"\n    namespace Formes {\n        class Triangle\n    }',
    'classDiagram\n    class A\n    class B\n    A --> B\n    click A href "https://exemple.invalid"\n    link B "https://exemple.invalid"',
    'architecture-beta\n    group api(cloud)[API]\n\n    service db(database)[Database] in api\n    service disk1(disk)[Storage] in api\n    service disk2(disk)[Storage] in api\n    service server(server)[Server] in api\n\n    db:L -- R:server\n    disk1:T -- B:server\n    disk2:T -- B:db',
    'architecture-beta\n    group pub(internet)[Public]\n    group priv(cloud)[Prive] in pub\n    service a(server)[A] in priv\n    service b(disk)[B]\n    service c[C]\n    a:R --> L:b\n    b:B <--> T:c\n    a:B -[Flux]- T:c',
    'architecture-beta\n    service left_disk(disk)[Disk]\n    service top_disk(disk)[Disk]\n    junction junctionCenter\n    left_disk:R -- L:junctionCenter\n    top_disk:B -- T:junctionCenter',
    'gitGraph\n    commit\n    commit\n    branch develop\n    checkout develop\n    commit\n    commit\n    checkout main\n    merge develop\n    commit\n    commit',
    'gitGraph TB:\n    commit id: "Alpha"\n    commit id: "Beta" type: HIGHLIGHT tag: "v1.0"\n    branch "ma branche"\n    commit id: "Gamma" type: REVERSE msg: "annule"\n    switch main\n    commit id: "Delta"\n    merge "ma branche" id: "Fusion" tag: "v2.0" type: HIGHLIGHT',
    'gitGraph\n    commit id: "ZERO"\n    branch develop order: 2\n    commit id:"A"\n    checkout main\n    commit id:"ONE"\n    cherry-pick id:"A"',
    'packet-beta\n    0-15: "Source Port"\n    16-31: "Destination Port"\n    32-63: "Sequence Number"\n    64-95: "Acknowledgment Number"\n    96-99: "Data Offset"\n    100-105: "Reserved"\n    106: "URG"\n    107: "ACK"\n    108-111: "Flags"\n    112-127: "Window"',
    'packet\n    title Paquet relatif\n    +8: "Type"\n    +16: "Longueur"\n    24-70: "Données"',
    'requirementDiagram\n\n    requirement test_req {\n    id: 1\n    text: the test text.\n    risk: high\n    verifymethod: test\n    }\n\n    element test_entity {\n    type: simulation\n    }\n\n    test_entity - satisfies -> test_req',
    'requirementDiagram\n    direction LR\n    functionalRequirement "Exigence é" {\n    id: "1.1"\n    text: "Un texte"\n    risk: Medium\n    verifymethod: Analysis\n    }\n    designConstraint c2 {\n    id: 2\n    }\n    element "Mon élément" {\n    type: "word doc"\n    docref: reqs/test_entity\n    }\n    c2 <- copies - "Mon élément"\n    "Exigence é" - derives -> c2\n    "Mon élément" - traces -> "Exigence é"',
    'requirementDiagram\n    requirement r1 {\n    id: 1\n    }\n    r1:::important\n    classDef important fill:#f96',
    'C4Context\n    title System Context diagram for Internet Banking System\n    Enterprise_Boundary(b0, "BankBoundary0") {\n        Person(customerA, "Banking Customer A", "A customer of the bank.")\n        System(SystemAA, "Internet Banking System", "Allows customers to view information.")\n        Enterprise_Boundary(b1, "BankBoundary") {\n            SystemDb_Ext(SystemE, "Mainframe Banking System", "Stores all of the core banking information.")\n            System_Boundary(b2, "BankBoundary2") {\n                System(SystemA, "Banking System A")\n            }\n            System_Ext(SystemC, "E-mail system", "The internal e-mail system.")\n        }\n    }\n    BiRel(customerA, SystemAA, "Uses")\n    Rel(SystemAA, SystemE, "Uses")\n    Rel(SystemAA, SystemC, "Sends e-mails", "SMTP")',
    'C4Container\n    Person(customer, Customer, "A customer")\n    Container_Boundary(c1, "Internet Banking") {\n        Container(spa, "Single-Page App", "JavaScript, Angular", "Provides all the functionality")\n        ContainerDb(database, "Database", "SQL Database", "Stores user registration")\n        ContainerQueue_Ext(q, "File")\n    }\n    Rel(customer, spa, "Uses", "HTTPS")\n    Rel_D(spa, database, "Reads", "JDBC")\n    Rel_Back(q, spa, "Notifie")',
    'C4Context\n    Person(a, "A")\n    System(b, "B")\n    Rel(a, b, "Uses")\n    UpdateElementStyle(a, $fontColor="red", $bgColor="grey", $borderColor="red")\n    UpdateRelStyle(a, b, $textColor="blue", $lineColor="blue", $offsetX="5")\n    UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="1")',
    'C4Context\n    Person(a, "A", $sprite="users")\n    System(b, "B", $tags="v1.0")\n    Rel(a, b, "Uses")',
    'C4Deployment\n    Deployment_Node(mob, "Customer mobile device", "Apple IOS or Android"){\n        Container(mobile, "Mobile App", "Xamarin", "Provides a limited subset")\n    }',
    'block-beta\ncolumns 1\n  db(("DB"))\n  blockArrowId6<["&nbsp;&nbsp;&nbsp;"]>(down)\n  block:ID\n    A\n    B["A wide one in the middle"]\n    C\n  end\n  space\n  D\n  ID --> D\n  C --> D\n  style B fill:#969,stroke:#333,stroke-width:4px',
    'block-beta\n  columns 3\n  a b c\n  d:2 e\n  space:2 f["Fin"]',
    'block-beta\n  columns 3\n  a["Texte"] b("Arrondi") c(["Stade"])\n  d[("Base")] e(("Cercle")) f{{"Hexagone"}}\n  block:g1:3\n    columns 2\n    h i\n    block:g2\n      j\n    end\n  end\n  a --> b\n  b -- "avec texte" --> c\n  d --- e\n  style a fill:#e3e3fd',
    'block-beta\n  a b c\n  a --> b --> c',
    'radar-beta\n  title Grades\n  axis m["Math"], s["Science"], e["English"]\n  axis h["History"], g["Geography"], a["Art"]\n  curve a["Alice"]{85, 90, 80, 70, 75, 90}\n  curve b["Bob"]{70, 75, 85, 80, 90, 85}\n\n  max 100\n  min 0',
    'radar-beta\n  axis A, B, C, D, E\n  curve c1{1,2,3,4,5}, c2{5,4,3,2,1}\n  curve c3{ C: 3, A: 1, B: 2, E: 5, D: 4 }\n  graticule polygon\n  ticks 3\n  showLegend false\n  max 5',
    'treemap-beta\n"Category A"\n    "Item A1": 10\n    "Item A2": 20\n"Category B"\n    "Item B1": 15\n    "Item B2": 25',
    'treemap\n\'Racine\'\n  \'Branche\'\n    \'Feuille\': 2.5\n    \'Autre\': 1,000\n  \'Vide\'\n  \'Seule\': 3',
    'treemap-beta\n"Main"\n    "A": 20\n    "B":::important\n        "B1": 10\n        "B2": 15\n    "C": 5\n\nclassDef important fill:#f96,stroke:#333,stroke-width:2px;',
    'zenuml\n    title Annotators\n    @Actor Alice\n    @Database Bob\n    Alice->Bob: Hi Bob\n    Bob->Alice: Hi Alice',
    'zenuml\n    title Order Service\n    @Actor Client\n    @Boundary OrderController\n    @Database Orders\n    // Le client passe commande\n    Client->OrderController.post(payload) {\n        OrderController->Orders.save(order) {\n            return id\n        }\n        if (stock > 0) {\n            OrderController->Client: Confirmation\n        } else if (commande partielle) {\n            OrderController->Client: Partiel\n        } else {\n            OrderController->Client: Refus\n        }\n        return "numéro de commande"\n    }',
    'zenuml\n    A as Alice\n    "Service de paie" as Paie\n    while (reste) {\n        A->"Service de paie": Demande\n    }\n    opt {\n        "Service de paie"->A: Relance\n    }\n    par {\n        A->B: un\n        A->C: deux\n    }\n    try {\n        A->B: essai\n    } catch {\n        A->B: erreur\n    } finally {\n        A->B: fin\n    }',
    'zenuml\n    Alice->Bob.method() {\n        result = Bob->Carl.compute(1, 2)\n        new Dave()\n        return result\n    }',
    'zenuml\n    BookLibService.Borrow(id) {\n        User = Session.GetUser()\n        return receipt\n    }',
    'flowchart LR\n    a@{ icon: "dsfr:user-line", label: "Usager", pos: "b" }\n    b@{ icon: "illus:serveur", label: "Serveur", pos: "b" }\n    c{"Choix"}\n    a --> b\n    b -->|"oui"| c',
    'flowchart LR\n    a@{ icon: "fa:user", label: "Usager" } --> b@{ shape: cyl }',
];
const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: true });
const p = await (await b.newContext({ viewport: { width: 1500, height: 950 } })).newPage();
p.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 200)));
await p.goto(process.env.FUSAIN_URL || 'http://127.0.0.1:8765/');
await p.waitForSelector('html[data-fusain-pret]');
await p.waitForTimeout(600);
const resultats = await p.evaluate(async (CORPUS) => {
    const { editeurPour } = await import('./js/diagrammes/index.js');
    const { typeDiagramme } = await import('./js/securite.js');
    const rendu = await import('./js/rendu.js');
    // Empreinte d'un schéma rendu : ce qu'un lecteur y voit
    const empreinte = (svg) => {
        const textes = [...svg.querySelectorAll('text')].map((t) => t.textContent.replace(/\s+/g, ' ').trim().replace(/^\d+-[0-9a-f]{7}$/, 'identifiant automatique')).filter(Boolean).sort();
        const compte = (sel) => svg.querySelectorAll(sel).length;
        return JSON.stringify({ textes, noeuds: compte('g.node'), liens: compte('path.flowchart-link, line.messageLine0, line.messageLine1, path.messageLine0, path.messageLine1'), groupes: compte('g.cluster'), parts: compte('path.pieCircle'), taches: compte('rect.task, rect[class*="task"]'), points: compte('g.data-point'), formes: compte('rect, circle, polygon'), traits: compte('path, line') });
    };
    const sortie = [];
    for (const [i, code] of CORPUS.entries()) {
        const type = typeDiagramme(code);
        const editeur = editeurPour(type);
        let original;
        try { original = await rendu.rendreSchema(code, 'bleu-france'); } catch (e) { sortie.push([i, type, 'INVALIDE', String(e.message).split('\n')[0].slice(0, 100)]); continue; }
        let modele;
        try { modele = editeur.analyser(code); } catch (e) { sortie.push([i, type, 'code seul', e.message.slice(0, 90)]); continue; }
        try {
            const reecrit = editeur.ecrire(modele);
            const nouveau = await rendu.rendreSchema(reecrit, 'bleu-france');
            const a = empreinte(original.svg); const z = empreinte(nouveau.svg);
            sortie.push(a === z ? [i, type, 'fidèle', ''] : [i, type, 'DIFFÉRENT', `avant ${a.slice(0, 330)}\n          après ${z.slice(0, 330)}\n          code ${reecrit.replace(/\n/g, '⏎').slice(0, 300)}`]);
        } catch (e) { sortie.push([i, type, 'DIFFÉRENT', 'le code réécrit ne se rend pas : ' + String(e.message).split('\n')[0].slice(0, 120)]); }
    }
    return sortie;
}, CORPUS);
let mauvais = 0;
const bilan = {};
for (const [i, type, etat, detail] of resultats) {
    bilan[etat] = (bilan[etat] || 0) + 1;
    const defaut = etat === 'DIFFÉRENT' || etat === 'INVALIDE';
    if (defaut) mauvais += 1;
    if (defaut || process.argv.includes('--detail')) console.log(defaut ? 'ECHEC' : 'OK   ', `n°${i + 1} (${type}) : ${etat}`, detail ? `\n          ${detail}` : '');
    else console.log('OK   ', `n°${i + 1} (${type}) : ${etat}`);
}
console.log('\nBilan :', JSON.stringify(bilan));
await b.close();
process.exit(mauvais ? 1 : 0);
