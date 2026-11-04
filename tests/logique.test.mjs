// Tests de logique, sans navigateur :  node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { MODELES } from '../js/modeles.js';
import { editeurPour } from '../js/diagrammes/index.js';
import { typeDiagramme, nettoyerCode, nomFichierSur, decoderCss, cssExterieur } from '../js/securite.js';
import { lireJson, serialiser } from '../js/fichier.js';
import { nouveauDocument } from '../js/etat.js';
import logigramme from '../js/diagrammes/logigramme.js';

test('aller-retour code → modèle → code stable pour chaque modèle éditable', () => {
    let n = 0;
    for (const m of MODELES) {
        const editeur = editeurPour(typeDiagramme(m.code));
        if (!editeur) continue;
        n += 1;
        const une = editeur.ecrire(editeur.analyser(m.code));
        const deux = editeur.ecrire(editeur.analyser(une));
        assert.equal(deux, une, `réécriture instable : ${m.id}`);
    }
    assert.ok(n >= 6);
});

test('logigramme : écritures de liens et de formes', () => {
    const m = logigramme.analyser(`graph LR
    A[Début] --> B{Choix}
    B -- oui --> C((Fin))
    B -.->|non| D[(Base)]
    C ==> E & F
    G --o H
    I <--> J
    subgraph zone [Ma zone]
        direction TB
        K --- L
    end
    style A fill:#fff,stroke:#000
    classDef rouge fill:#f00
    click A callback`);
    assert.equal(m.sens, 'LR');
    assert.deepEqual(m.liens.map((l) => [l.de, l.vers, l.trait, l.fin, l.texte]), [
        ['A', 'B', 'plein', '>', ''], ['B', 'C', 'plein', '>', 'oui'], ['B', 'D', 'pointille', '>', 'non'],
        ['C', 'E', 'epais', '>', ''], ['C', 'F', 'epais', '>', ''], ['G', 'H', 'plein', 'o', ''],
        ['I', 'J', 'plein', '>', ''], ['K', 'L', 'plein', '', ''],
    ]);
    assert.equal(m.liens[6].debut, '<');
    assert.equal(m.noeuds.find((n) => n.id === 'D').forme, 'cylindre');
    assert.equal(m.noeuds.find((n) => n.id === 'K').groupe, 'zone');
    assert.equal(m.groupes[0].sens, 'TD');
    const code = logigramme.ecrire(m);
    assert.ok(!code.includes('click'), 'les interactions sont retirées');
    assert.ok(code.includes('classDef rouge fill:#f00'));
    assert.equal(logigramme.ecrire(logigramme.analyser(code)), code);
});

test('logigramme : un libellé ne peut pas injecter d\'instruction', () => {
    const m = logigramme.analyser('flowchart TD\n    A[x]');
    logigramme.renommer(m, 'n:A', 'a"] --> Z\nclick A href "javascript:alert(1)"');
    const code = logigramme.ecrire(m);
    const relu = logigramme.analyser(code);
    assert.equal(relu.noeuds.length, 1);
    assert.equal(relu.liens.length, 0);
    assert.equal(code.split('\n').filter((l) => l.trim()).length, 2);
});

test('logigramme : écriture non gérée → bascule en code seul', () => {
    assert.throws(() => logigramme.analyser('flowchart LR\n    A@{ shape: cyl } --> B'), /pas gérée/);
});

test('directives : seules les clés sans risque sont conservées', () => {
    const code = nettoyerCode(`%%{init: {'securityLevel':'loose','theme':'forest','themeCSS':'*{x:y}','flowchart':{'htmlLabels':true,'curve':'basis'},'themeVariables':{'primaryColor':'#ff0000','x':'url(http://e.vil/a)'}}}%%\nflowchart LR\n A-->B`);
    assert.ok(!/securityLevel|htmlLabels|themeCSS|url\(/.test(code));
    assert.ok(code.includes('"curve":"basis"') && code.includes('"primaryColor":"#ff0000"'));
    assert.ok(!nettoyerCode('%%{init: pas du json}%%\npie').includes('%%{'));
    assert.equal(nettoyerCode('---\ntitle: Mon titre\nconfig:\n  securityLevel: loose\n---\npie'), '---\ntitle: Mon titre\n---\npie');
});

test('fichier : aller-retour et refus des entrées hostiles', () => {
    const doc = nouveauDocument(MODELES[0].code);
    const texte = serialiser(doc);
    assert.deepEqual(lireJson(texte).pages[0].code, doc.pages[0].code);
    const refuse = (modif, motif) => {
        const o = JSON.parse(texte);
        modif(o);
        assert.throws(() => lireJson(JSON.stringify(o)), motif);
    };
    refuse((o) => { o.pages[0].inconnu = 1; }, /Champ inconnu/);
    refuse((o) => { o.format = 'autre'; }, /pas un document FUSAIN/);
    refuse((o) => { o.formatVersion = 99; }, /plus récente/);
    refuse((o) => { o.pages[0].format = 'A0'; }, /non reconnue/);
    refuse((o) => { o.pages[0].margesMm = '15'; }, /hors limites/);
    refuse((o) => { o.pages[0].code = 'x'.repeat(50001); }, /trop long/);
    refuse((o) => { o.pages = []; }, /aucune page/);
    refuse((o) => { o.pages.push({ ...o.pages[0] }); }, /en double/);
    assert.throws(() => lireJson(texte.replace('"format": "fusain",', '"format": "fusain", "__proto__": {"a": 1},')), /interdits/);
    assert.throws(() => lireJson('{'), /JSON valide/);
    // Un fichier de la version 1 du format (sans sous-titre ni description) reste lisible
    const ancien = JSON.parse(texte);
    ancien.formatVersion = 1;
    delete ancien.pages[0].sousTitre;
    delete ancien.pages[0].description;
    const relu = lireJson(JSON.stringify(ancien));
    assert.equal(relu.formatVersion, 2);
    assert.equal(relu.pages[0].sousTitre, '');
    assert.equal(relu.pages[0].description, '');
});

test('analyse statique : aucune écriture HTML ni exécution dynamique dans le code de FUSAIN', async () => {
    const { readdirSync, readFileSync } = await import('node:fs');
    const INTERDITS = [/\.innerHTML\s*=/, /\.outerHTML\s*=/, /insertAdjacentHTML/, /document\.write/, /\beval\s*\(/, /new\s+Function\s*\(/, /setTimeout\s*\(\s*['"`]/, /setInterval\s*\(\s*['"`]/, /\son[a-z]+\s*=\s*["']/];
    const fichiers = [...readdirSync('js').filter((f) => f.endsWith('.js')).map((f) => `js/${f}`), ...readdirSync('js/diagrammes').map((f) => `js/diagrammes/${f}`), 'sw.js'];
    for (const f of fichiers) {
        const code = readFileSync(f, 'utf8').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
        for (const motif of INTERDITS) assert.ok(!motif.test(code), `${f} contient une construction interdite : ${motif}`);
    }
    const html = readFileSync('index.html', 'utf8');
    assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>/.test(html), 'aucun script en ligne dans index.html');
    assert.ok(!/\son[a-z]+\s*=/.test(html.replace(/<meta[^>]*>/g, '')), 'aucun gestionnaire en ligne dans index.html');
    assert.ok(/require-trusted-types-for 'script'/.test(html) && /script-src 'self';/.test(html));
});

test('noms de fichiers nettoyés', () => {
    assert.equal(nomFichierSur('Été 2026 / ../../etc'), 'Ete-2026-etc');
    assert.equal(nomFichierSur('///'), 'document');
});

// ---------- Éditeurs ajoutés en 0.6.0 ----------

// Types arrivés avec Mermaid 12.3 : modèle et aide à la syntaxe, édition en code seulement pour l'instant
const EN_CODE_SEULEMENT = new Set(['agentflow', 'cynefin', 'eventmodeling', 'railroad-ebnf', 'usecase', 'wardley']);
test('tous les modèles proposés ont un éditeur visuel', () => {
    for (const m of MODELES) {
        const type = typeDiagramme(m.code);
        if (EN_CODE_SEULEMENT.has(type)) assert.ok(SYNTAXES[type], `sans aide à la syntaxe : ${m.id}`);
        else assert.ok(editeurPour(type), `sans éditeur : ${m.id}`);
    }
});

test('C4 dynamique et déploiement : nœuds de déploiement relus et réécrits à l\'identique', () => {
    const c4 = editeurPour('C4Deployment');
    assert.equal(c4, editeurPour('C4Dynamic'));
    const code = 'C4Deployment\n    Deployment_Node(poste, "Poste", "Navigateur web", "Poste de l\'usager") {\n        Container(web, "Portail", "HTML")\n    }\n    Deployment_Node(dc, "Centre") {\n        ContainerDb(db, "Base", "PostgreSQL")\n    }\n    Rel(web, db, "Lit")\n';
    assert.equal(c4.ecrire(c4.analyser(code)), code);
    for (const m of MODELES.filter((x) => /^C4(Dynamic|Deployment)/.test(x.code))) {
        assert.equal(c4.ecrire(c4.analyser(m.code)), c4.ecrire(c4.analyser(c4.ecrire(c4.analyser(m.code)))), m.id);
    }
});

test('historique de versions : une opération que Mermaid refuserait n\'est jamais écrite', () => {
    const editeur = editeurPour('gitGraph');
    const modele = editeur.analyser('gitGraph\n    commit id: "a"\n    branch x\n    commit id: "b"\n    checkout main\n    merge x\n');
    // supprimer la branche emporte son commit et sa fusion
    editeur.supprimer(modele, 'b:x');
    assert.equal(editeur.ecrire(modele), 'gitGraph\n    commit id: "a"\n    checkout main\n');
    // une branche qui pointe sur le même commit que main n'a rien à fusionner
    const memeTete = editeur.analyser('gitGraph\n    commit id: "a"\n    branch y\n    checkout main\n');
    assert.equal(editeur.relier(memeTete, 'b:y', 'b:main'), null);
    assert.equal(memeTete.ops.length, 3);
    // un libellé de commit reste unique
    const deux = editeur.analyser('gitGraph\n    commit id: "a"\n    commit id: "b"\n');
    editeur.renommer(deux, 'c:1', 'a');
    assert.ok(editeur.ecrire(deux).includes('commit id: "b"'));
});

test('diagramme de flux : ni circuit, ni accent, ni schéma vide', () => {
    const editeur = editeurPour('sankey');
    const modele = editeur.analyser('sankey-beta\n\nA,B,10\nB,C,5\n');
    assert.equal(editeur.relier(modele, 'n:2', 'n:0'), null, 'C → A fermerait un circuit');
    editeur.renommer(modele, 'n:0', 'Santé "publique"');
    assert.ok(editeur.ecrire(modele).includes('"Sante ""publique""",B,10'));
    editeur.supprimer(modele, 'l:0');
    editeur.supprimer(modele, 'l:0');
    assert.equal(modele.flux.length, 1);
});

test('structure de paquet : les positions suivent les tailles', () => {
    const editeur = editeurPour('packet');
    const modele = editeur.analyser('packet-beta\n    0-3: "a"\n    4-7: "b"\n    +8: "c"\n');
    modele.champs[0].bits = 1;
    assert.equal(editeur.ecrire(modele), 'packet-beta\n    0: "a"\n    1-4: "b"\n    5-12: "c"\n');
    assert.throws(() => editeur.analyser('packet-beta\n    0-3: "a"\n    8-9: "trou"\n'), /pas gérée/);
});

test('écritures avancées des nouveaux types → code seul', () => {
    for (const code of [
        'classDiagram\n    class A~T~\n',
        'classDiagram\n    note for A "x"\n',
        'erDiagram\n    A 1 to many B : x\n',
        'architecture-beta\n    junction j\n',
        'gitGraph\n    commit id: "a"\n    cherry-pick id: "a"\n',
        'xychart-beta\n    x-axis 0 --> 10\n    line [1, 2]\n',
        'journey\n    une ligne sans note\n',
    ]) assert.throws(() => editeurPour(typeDiagramme(code)).analyser(code), /pas gérée/, code);
});

// ---------- Éditeurs ajoutés en 0.7.0 ----------

test('C4 et blocs : ni limite ni groupe vides, toujours un élément', () => {
    const c4 = editeurPour('C4Container');
    assert.equal(c4, editeurPour('C4Context'));
    const modele = c4.analyser('C4Context\n    Boundary(b, "B") {\n        System(s, "S")\n    }\n    Person(p, "P")\n    Rel(p, s, "x")\n');
    c4.supprimer(modele, 'n:s');
    assert.equal(c4.ecrire(modele), 'C4Context\n    Person(p, "P")\n');
    c4.supprimer(modele, 'n:p');
    assert.equal(modele.items.length, 1);

    const blocs = editeurPour('block');
    const b = blocs.analyser('block-beta\n    a["A"]\n    block:g\n        c["C"]\n    end\n    a --> c\n');
    blocs.supprimer(b, 'n:c');
    assert.equal(blocs.ecrire(b), 'block-beta\n    a["A"]\n');
    blocs.supprimer(b, 'n:a');
    assert.equal(b.enfants.length, 1);
});

test('radar : valeurs nommées remises dans l\'ordre des axes, valeurs négatives refusées', () => {
    const radar = editeurPour('radar');
    const modele = radar.analyser('radar-beta\n    axis a, b, c\n    curve x{ c: 3, a: 1, b: 2 }\n');
    assert.deepEqual(modele.courbes[0].valeurs, [1, 2, 3]);
    radar.renommer(modele, 'v:0.1', '-4');
    assert.deepEqual(modele.courbes[0].valeurs, [1, 2, 3]);
    radar.supprimer(modele, 'c:0');
    assert.equal(radar.ecrire(modele), 'radar-beta\n    axis b, c\n    curve x{2, 3}\n');
});

test('exigences : les relations suivent le renommage, les deux écritures de flèche se lisent', () => {
    const editeur = editeurPour('requirementDiagram');
    const modele = editeur.analyser('requirementDiagram\n    requirement r1 {\n    id: 1\n    }\n    element e1 {\n    type: x\n    }\n    r1 <- satisfies - e1\n');
    assert.deepEqual(modele.relations[0], { de: 'e1', vers: 'r1', type: 'satisfies' });
    editeur.renommer(modele, 'n:0', 'Temps de réponse');
    assert.ok(editeur.ecrire(modele).includes('e1 - satisfies -> "Temps de réponse"'));
});

// ---------- Éditeurs ajoutés en 0.8.0 ----------

test('treemap : une case qui en reçoit d\'autres devient une rubrique, la hiérarchie se relit', () => {
    const editeur = editeurPour('treemap');
    const modele = editeur.analyser('treemap-beta\n"A"\n    "f": 4\n"g": 2\n');
    assert.equal(editeur.relier(modele, 't:1', 't:0.0'), 't:0.0.0');
    assert.equal(editeur.ecrire(modele), 'treemap-beta\n"A"\n    "f"\n        "g": 2\n');
    // ranger une rubrique dans l'une de ses propres cases est refusé
    assert.equal(editeur.relier(modele, 't:0', 't:0.0.0'), null);
    assert.throws(() => editeur.analyser('treemap-beta\n"A": 3\n    "f": 4\n'), /pas gérée/);
});

test('ZenUML : blocs imbriqués relus à l\'identique, renommage d\'un participant propagé', () => {
    const editeur = editeurPour('zenuml');
    const code = 'zenuml\n    @Actor A\n    A->B.traiter(x) {\n        if (ok) {\n            B->A: oui\n        } else {\n            B->A: non\n        }\n        return fin\n    }\n';
    const modele = editeur.analyser(code);
    assert.equal(editeur.ecrire(modele), code);
    assert.deepEqual(editeur.elements(modele).map((e) => e.cle), ['p:0', 'p:1', 'i:0', 'i:0.0.0', 'i:0.0.0.0.0', 'k:0.0.0.1', 'i:0.0.0.1.0', 'i:0.0.1']);
    editeur.renommer(modele, 'p:1', 'Service de paie');
    assert.ok(editeur.ecrire(modele).includes('A->"Service de paie".traiter(x) {') && editeur.ecrire(modele).includes('"Service de paie"->A: non'));
    assert.throws(() => editeur.analyser('zenuml\n    A->B.m() {\n        x = B->C.n()\n    }\n'), /pas gérée/);
});

// ---------- Diapositives de texte (0.9.0) ----------

test('diapositive : format lu et réécrit à l\'identique, textes sans effet sur la structure', async () => {
    const { DISPOSITIONS, codeInitial } = await import('../js/diagrammes/diapo.js');
    const editeur = editeurPour('diapo');
    for (const id of Object.keys(DISPOSITIONS)) assert.equal(editeur.ecrire(editeur.analyser(codeInitial(id))), codeInitial(id), id);
    const modele = editeur.analyser('diapo sommaire\ntitre: SOMMAIRE\n- A | a\n- B | b\n');
    // un retour à la ligne devient <br>, une barre verticale ne crée pas de champ
    editeur.renommer(modele, 'e:0.1', 'ligne 1\nligne 2 | intrus');
    editeur.renommer(modele, 'c:titre', 'x\n- faux élément');
    const code = editeur.ecrire(modele);
    assert.equal(code, 'diapo sommaire\ntitre: x<br>- faux élément\n- A | ligne 1<br>ligne 2 / intrus\n- B | b\n');
    assert.equal(editeur.analyser(code).items.length, 2);
    assert.throws(() => editeur.analyser('diapo inconnue\n'), /mise en page/);
    assert.throws(() => editeur.analyser('diapo titre\ncouleur: rouge\n'), /champ inconnu/);
});

test('diapositive libre : un paragraphe ne peut pas devenir un titre, une puce ou un tableau', () => {
    const editeur = editeurPour('diapo');
    const modele = editeur.analyser('diapo libre\n# Titre\nTexte\n- puce\n| a | b |\n');
    assert.deepEqual(modele.blocs.map((b) => b.t), ['h2', 'p', 'li', 'ligne']);
    editeur.renommer(modele, 'b:1', '# pas un titre');
    const relu = editeur.analyser(editeur.ecrire(modele));
    assert.deepEqual(relu.blocs.map((b) => [b.t, b.texte])[1], ['p', '# pas un titre']);
    // changer de mise en page conserve le titre
    assert.equal(typeDiagramme(editeur.ecrire(relu)), 'diapo');
});

test('chaque icône utilisée par un bouton est embarquée', async () => {
    const { readdirSync, readFileSync } = await import('node:fs');
    const lister = (dossier) => readdirSync(dossier, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? lister(`${dossier}/${e.name}`) : [`${dossier}/${e.name}`]));
    const racine = (await import('node:url')).fileURLToPath(new URL('..', import.meta.url));
    const embarquees = new Set(lister(`${racine}libs/dsfr-v1.15.4/icons`).map((f) => f.split('/').pop().replace(/^fr--/, '').replace(/\.svg$/, '')));
    const absentes = new Set();
    for (const fichier of lister(`${racine}js`)) for (const m of readFileSync(fichier, 'utf8').matchAll(/icone: '([a-z0-9-]+-(?:line|fill))'/g)) if (!embarquees.has(m[1])) absentes.add(`${m[1]} (${fichier.split('/js/')[1]})`);
    assert.deepEqual([...absentes], []);
});

// ---------- Icônes du DSFR (0.10.0) ----------

test('jeu d\'icônes du DSFR : 1 038 icônes, noms uniques, tracés sans autre contenu', async () => {
    const { readFileSync } = await import('node:fs');
    const jeu = JSON.parse(readFileSync(new URL('../libs/dsfr-v1.15.4/icones-dsfr.json', import.meta.url), 'utf8'));
    const noms = Object.values(jeu.categories).flatMap((c) => Object.keys(c));
    assert.equal(noms.length, 1038);
    assert.equal(new Set(noms).size, noms.length);
    for (const categorie of Object.values(jeu.categories)) for (const [nom, trace] of Object.entries(categorie)) assert.ok(/^[a-z0-9-]+$/.test(nom) && /^[MmLlHhVvCcSsQqTtAaZz0-9eE\s,.+-]+$/.test(trace), nom);
    // une icône du DSFR se lit et se réécrit dans un schéma d'architecture
    const editeur = editeurPour('architecture');
    const code = 'architecture-beta\n    service a(dsfr:user-line)[Usager]\n    service b(blank)[B]\n';
    assert.equal(editeur.ecrire(editeur.analyser(code)), code);
});

// ---------- Icônes illustrées (0.11.0) ----------

test('icônes illustrées : index cohérent, empreintes exactes, images PNG seulement', async () => {
    const { readFileSync } = await import('node:fs');
    const { createHash } = await import('node:crypto');
    const dossier = new URL('../icones/illustrees/', import.meta.url);
    const { themes } = JSON.parse(readFileSync(new URL('index.json', dossier), 'utf8'));
    const ids = themes.flatMap((t) => t.icones.map(([id]) => id));
    assert.ok(ids.length >= 293);
    assert.equal(new Set(ids).size, ids.length);
    for (const theme of themes) {
        const brut = readFileSync(new URL(theme.fichier, dossier));
        assert.equal(`sha384-${createHash('sha384').update(brut).digest('base64')}`, theme.integrite, theme.id);
        const { icones } = JSON.parse(brut.toString('utf8'));
        assert.deepEqual(Object.keys(icones), theme.icones.map(([id]) => id));
        for (const [id, png] of Object.entries(icones)) {
            assert.ok(/^[a-z0-9-]+$/.test(id) && /^[A-Za-z0-9+/]+=*$/.test(png), id);
            // signature d'un fichier PNG
            assert.equal(Buffer.from(png.slice(0, 12), 'base64').subarray(0, 8).toString('hex'), '89504e470d0a1a0a', id);
        }
    }
    const editeur = editeurPour('architecture');
    const code = 'architecture-beta\n    service a(illus:routeur)[Routeur]\n';
    assert.equal(editeur.ecrire(editeur.analyser(code)), code);
});

// ---------- Pictogrammes en noir et blanc et modèles de réseaux (0.17.0) ----------

test('pictogrammes : formes simples, valeurs numériques, couleurs noir et blanc, empreinte exacte', async () => {
    const { readFileSync } = await import('node:fs');
    const { createHash } = await import('node:crypto');
    const brut = readFileSync(new URL('../icones/pictogrammes.json', import.meta.url));
    const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    const empreinte = page.match(/id="fusain-pictogrammes" href="\.\/icones\/pictogrammes\.json" integrity="([^"]+)"/)[1];
    assert.equal(`sha384-${createHash('sha384').update(brut).digest('base64')}`, empreinte);
    const { categories, icones } = JSON.parse(brut.toString('utf8'));
    assert.ok(Object.keys(icones).length >= 50);
    for (const [id, icone] of Object.entries(icones)) {
        assert.ok(/^[a-z0-9-]+$/.test(id) && icone.nom && categories[icone.categorie], id);
        for (const [balise, attrs] of icone.elements) {
            assert.ok(['path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon'].includes(balise), `${id} ${balise}`);
            for (const [k, v] of Object.entries(attrs)) {
                if (k === 'fill' || k === 'stroke') assert.ok(['none', '#161616', '#ffffff'].includes(v), `${id} ${k}=${v}`);
                else assert.ok(/^[0-9MmLlHhVvCcSsQqTtAaZz\s,.+-]+$/.test(v), `${id} ${k}=${v}`);
            }
        }
    }
});

test('pictogrammes : admis par le filtre, relus à l\'identique dans l\'architecture, le logigramme et les diapositives', () => {
    const filtre = nettoyerCode('flowchart LR\n    a@{ icon: "picto:routeur", label: "R", pos: "b" }\n    b@{ icon: "logos:aws", label: "X" }\n');
    assert.match(filtre, /icon: "picto:routeur"/);
    assert.doesNotMatch(filtre, /logos:aws/);
    const archi = 'architecture-beta\n    service a(picto:pare-feu)[Pare-feu]\n';
    assert.equal(editeurPour('architecture').ecrire(editeurPour('architecture').analyser(archi)), archi);
    const logi = 'flowchart LR\n    a@{ icon: "picto:routeur", label: "Routeur", pos: "b" }\n    b["B"]\n    a --> b\n';
    assert.equal(logigramme.ecrire(logigramme.analyser(logi)), logi);
    const diapo = editeurPour('diapo');
    const modele = diapo.analyser('diapo chiffres\n- [picto:vlan] 12 | VLAN\n- 7 | Sites\n');
    assert.equal(modele.items[0].icone, 'picto:vlan');
});

test('modèles de réseaux : rubrique dédiée, code relu à l\'identique par l\'éditeur d\'architecture', () => {
    const reseaux = MODELES.filter((m) => m.categorie === 'reseaux');
    assert.deepEqual(reseaux.map((m) => m.id), ['reseau-physique', 'reseau-logique', 'reseau-logique-illustre', 'reseau-sites']);
    const editeur = editeurPour('architecture');
    for (const m of reseaux) assert.equal(editeur.ecrire(editeur.analyser(m.code)), m.code, m.id);
});

// ---------- Icônes dans le logigramme et les diapositives (0.12.0) ----------

test('logigramme : étape-icône relue à l\'identique, seules les icônes embarquées franchissent le filtre', () => {
    const code = 'flowchart LR\n    a@{ icon: "illus:serveur", label: "Serveur #quot;A#quot; }", pos: "b" }\n    b["B"]\n    a --> b\n';
    const modele = logigramme.analyser(code);
    assert.equal(modele.noeuds[0].icone, 'illus:serveur');
    assert.equal(modele.noeuds[0].texte, 'Serveur "A" }');
    assert.equal(logigramme.ecrire(modele), code);
    assert.throws(() => logigramme.analyser('flowchart LR\n    a@{ icon: "fa:user", label: "x", pos: "b" }\n'), /pas gérée/);
    const filtre = nettoyerCode('flowchart LR\n A@{ label: "}", img: "https://exemple.invalid/i.png", icon: "fa:user" } --> B@{ icon: "dsfr:user-line", label: "ok", pos: "b" }');
    assert.ok(!/img|fa:user|exemple\.invalid/.test(filtre) && filtre.includes('icon: "dsfr:user-line"'), filtre);
});

test('diapositive : icône d\'un élément et bloc icône, sans confusion avec un texte entre crochets', () => {
    const editeur = editeurPour('diapo');
    const code = 'diapo chiffres\n- [illus:equipe] 42 | Agents\n- 7 | Sites\n';
    const modele = editeur.analyser(code);
    assert.equal(modele.items[0].icone, 'illus:equipe');
    assert.deepEqual([...modele.items[0]], ['42', 'Agents']);
    assert.equal(editeur.ecrire(modele), code);
    // un texte saisi qui ressemble à une icône reste un texte
    editeur.renommer(modele, 'e:1.0', '[dsfr:user-line] 7');
    const relu = editeur.analyser(editeur.ecrire(modele));
    assert.equal(relu.items[1].icone, '');
    assert.equal(relu.items[1][0], '[dsfr:user-line] 7');
    // une mise en page sans icône lit les crochets comme du texte
    assert.equal(editeur.analyser('diapo texte-colonnes\n- [dsfr:user-line] x\n').items[0][0], '[dsfr:user-line] x');
    const libre = editeur.analyser('diapo libre\n[dsfr:flag-line]\nTexte\n');
    assert.deepEqual(libre.blocs.map((b) => [b.t, b.texte]), [['icone', 'dsfr:flag-line'], ['p', 'Texte']]);
    editeur.renommer(libre, 'b:0', '<script>');
    editeur.renommer(libre, 'b:1', '[illus:serveur]');
    assert.deepEqual(editeur.analyser(editeur.ecrire(libre)).blocs.map((b) => [b.t, b.texte]), [['icone', 'dsfr:flag-line'], ['p', '[illus:serveur]']]);
});

// ---------- Import d'un réseau (exports IMC, API, LLDP fictifs : Documentation/exemples-reseau/) ----------
import * as reseau from '../js/reseau.js';
import { readFileSync as lireFichierReseau } from 'node:fs';
import { fileURLToPath as cheminReseau } from 'node:url';

const exportReseau = async (nom, champs) => reseau.tableau(await reseau.lireEnregistrements(new Uint8Array(lireFichierReseau(cheminReseau(new URL(`../Documentation/exemples-reseau/${nom}`, import.meta.url))))), champs);
const relireToutes = (pages) => {
    for (const p of pages) {
        const m = logigramme.analyser(p.code);
        assert.equal(logigramme.ecrire(m), p.code, `page instable : ${p.nom}`);
    }
};

test('réseau : export « Gestion des liens » d\'IMC avec la liste des équipements', async () => {
    const liens = await exportReseau('imc-liens.csv', reseau.CHAMPS_LIENS);
    assert.equal(liens.association.source, 'Left Node');
    assert.equal(liens.association.vlansCible, 'Right Interface Allowed VLAN');
    assert.equal(liens.association.debit, 'Link Speed(bps)');
    const equipements = await exportReseau('imc-equipements.csv', reseau.CHAMPS_EQUIPEMENTS);
    const graphe = reseau.analyserReseau(liens, equipements);
    const cat = Object.fromEntries(graphe.noeuds.map((x) => [x.nom, x.categorie]));
    assert.deepEqual([cat['FW-SIEGE'], cat['RT-SIEGE'], cat['CORE-SIEGE'], cat['SW-SIEGE-1'], cat['SRV-FICHIERS'], cat['AP-SIEGE-1']],
        ['pare-feu', 'routeur', 'commutateur-l3', 'commutateur', 'serveur', 'wifi']);
    assert.ok(graphe.avecVlans);
    const { pages, mode } = reseau.produirePages(graphe, { jeu: 'picto' });
    assert.equal(mode, 'lieu');
    assert.deepEqual(pages.map((p) => p.nom), ['Réseau physique', 'Réseau logique (VLAN)']);
    const [physique, logique] = pages.map((p) => p.code);
    assert.match(physique, /subgraph \w+ \["Agence de Lyon"\]/);
    // Les locaux techniques sont des cadres dans le cadre de leur site ; les bornes suivent leur commutateur
    assert.equal(equipements.association.local, 'Local technique');
    assert.match(physique, /subgraph \w+ \["Siège"\]\n {8}subgraph \w+ \["Salle serveurs"\]\n {12}e_FW_SIEGE/);
    assert.match(physique, / {8}subgraph \w+ \["LT étage 1"\]\n {12}e_SW_SIEGE_1[^\n]*\n {12}e_sw_siege_1_wifi/);
    assert.match(physique, /\["LT étage 2"\]\n {12}e_SW_SIEGE_2[^\n]*\n {12}e_AP_SIEGE_3/);
    assert.match(physique, /icon: "picto:pare-feu", label: "FW-SIEGE"/);
    assert.match(physique, /e_CORE_SIEGE ===\|"BAGG1 – BAGG1 · 2 liens × 10G"\| e_SW_SIEGE_1/);
    assert.match(physique, /label: "2 bornes Wi-Fi"/);
    assert.match(physique, /e_SW_SIEGE_2 -\.-\|/, 'lien en panne en pointillé');
    assert.match(logique, /"trunk : VLAN 1, 10, 20, 30"/);
    assert.doesNotMatch(logique, /AP-SIEGE/);
    relireToutes(pages);
    // Le même tableau enregistré en .xlsx donne le même schéma
    const xlsx = await exportReseau('imc-liens.xlsx', reseau.CHAMPS_LIENS);
    assert.deepEqual(reseau.produirePages(reseau.analyserReseau(xlsx, equipements), { jeu: 'picto' }).pages, pages);
});

test('réseau : liens de l\'API REST d\'IMC et rapport de voisins LLDP', async () => {
    const api = reseau.analyserReseau(await exportReseau('imc-api.csv', reseau.CHAMPS_LIENS));
    assert.deepEqual(api.bilan, { lignes: 4, ignorees: 0, doublons: 1 });
    const [page] = reseau.produirePages(api).pages;
    assert.match(page.code, /e_core_a ---\|"XGE1\/0\/49 – XGE1\/0\/51 · 10G"\| e_acc_a1/);
    const lldp = reseau.analyserReseau(await exportReseau('lldp-voisins.csv', reseau.CHAMPS_LIENS));
    const cat = Object.fromEntries(lldp.noeuds.map((x) => [x.nom, x.categorie]));
    assert.deepEqual([cat['CORE-1'], cat['SW-ETAGE-1'], cat.SEP001122334455, cat['borne-etage1']], ['commutateur-l3', 'commutateur', 'telephone', 'wifi']);
    const pages = reseau.produirePages(lldp, { resumer: true }).pages;
    assert.equal(pages.length, 1);
    assert.match(pages[0].code, /icon: "illus:telephone-ip", label: "3 téléphones IP"/);
    assert.match(reseau.produirePages(lldp, { resumer: false }).pages[0].code, /label: "SEP001122334466"/);
    relireToutes(pages);
});

test('réseau : colonnes « Site » et « Local technique » → cadres imbriqués, même nom de local dans deux sites', () => {
    const liens = { colonnes: [], association: { source: 'a', cible: 'b' }, lignes: [
        { a: 'RT-A', b: 'SW-A1' }, { a: 'RT-A', b: 'SW-A2' }, { a: 'RT-A', b: 'RT-B' }, { a: 'RT-B', b: 'SW-B1' }] };
    const equipements = reseau.tableau([
        ['Device Label', 'Device Category', 'Location', 'Site', 'Local technique'],
        ['RT-A', 'Routers', 'Paris, bât. A', 'Paris', 'Salle serveurs'],
        ['SW-A1', 'Switches', '', 'Paris', 'Étage 1'],
        ['SW-A2', 'Switches', '', 'Paris', 'Étage 2'],
        ['RT-B', 'Routers', '', 'Lyon', ''],
        ['SW-B1', 'Switches', '', 'Lyon', 'Étage 1']], reseau.CHAMPS_EQUIPEMENTS);
    assert.deepEqual([equipements.association.site, equipements.association.local, equipements.association.lieu], ['Site', 'Local technique', 'Location']);
    const graphe = reseau.analyserReseau(liens, equipements);
    const { pages, mode } = reseau.produirePages(graphe, { jeu: 'picto' });
    assert.equal(mode, 'lieu');
    const m = logigramme.analyser(pages[0].code);
    const titre = (id) => m.groupes.find((g) => g.id === id)?.titre ?? null;
    const place = (nom) => { const g = m.groupes.find((x) => x.id === m.noeuds.find((n) => n.texte === nom).groupe); return [titre(g.parent), g.titre]; };
    assert.deepEqual(['RT-A', 'SW-A1', 'SW-A2', 'SW-B1'].map(place), [['Paris', 'Salle serveurs'], ['Paris', 'Étage 1'], ['Paris', 'Étage 2'], ['Lyon', 'Étage 1']]);
    assert.equal(titre(m.noeuds.find((n) => n.texte === 'RT-B').groupe), 'Lyon', 'sans local : directement dans le site');
    assert.equal(m.groupes.filter((g) => g.titre === 'Étage 1').length, 2);
    // Sans regroupement, pas de cadre de local
    assert.doesNotMatch(reseau.produirePages(graphe, { regroupement: 'aucun' }).pages[0].code, /subgraph/);
    relireToutes(pages);
});

test('réseau : grand réseau multi-sites → vue d\'ensemble et une page par site', () => {
    const lignes = [];
    for (const site of ['PAR', 'LYO', 'MRS']) {
        lignes.push({ a: `${site}-RT-1`, pa: 'GE0/0', b: 'WAN-CORE', pb: `GE0/${site.length}` });
        for (let i = 1; i <= 12; i += 1) lignes.push({ a: `${site}-RT-1`, pa: `GE1/0/${i}`, b: `${site}-SW-${i}`, pb: 'GE1/0/52' });
    }
    const t = { colonnes: ['a', 'pa', 'b', 'pb'], lignes, association: { source: 'a', portSource: 'pa', cible: 'b', portCible: 'pb' } };
    const graphe = reseau.analyserReseau(t);
    const { pages, mode } = reseau.produirePages(graphe);
    assert.equal(mode, 'prefixe');
    assert.deepEqual(pages.map((p) => p.nom), ['Réseau : vue d\'ensemble', 'Réseau : PAR', 'Réseau : Sans groupe', 'Réseau : LYO', 'Réseau : MRS']);
    assert.match(pages[0].code, /"PAR \(13 équipements\)"/);
    assert.match(pages[1].code, /subgraph \w+ \["Autres sites"\]/);
    relireToutes(pages);
});

test('réseau : lecture des valeurs (nom et IP, interfaces, débits, VLAN, catégories)', () => {
    assert.deepEqual(reseau.nomEtIp('SW-01(10.0.0.1)'), { nom: 'SW-01', ip: '10.0.0.1' });
    assert.deepEqual(reseau.nomEtIp(' SW 01 [10.0.0.1/24] '), { nom: 'SW 01', ip: '10.0.0.1' });
    assert.equal(reseau.abregerInterface('Ten-GigabitEthernet1/0/49 Interface'), 'XGE1/0/49');
    assert.equal(reseau.abregerInterface('Port-channel12'), 'Po12');
    assert.deepEqual(['1000000000', '100000000', '10 Gbps', '1000', '2.5G', 'auto'].map(reseau.debitLisible), ['1G', '100M', '10G', '1G', '2.5G', 'auto']);
    assert.equal(reseau.ecrireVlans(reseau.lireVlans('1 to 4094')), 'tous');
    assert.equal(reseau.ecrireVlans(reseau.lireVlans('10,11,12, 20 30-31')), '10-12, 20, 30, 31');
    assert.deepEqual(['Routers', 'Switches', 'Bridge, Router', 'Bridge, Telephone', 'WLAN Access Point', 'Security', 'Voice', 'Desktops', 'Servers', 'B, R'].map((c) => reseau.categorieDe(c)),
        ['routeur', 'commutateur', 'commutateur-l3', 'telephone', 'wifi', 'pare-feu', 'telephone', 'poste', 'serveur', 'commutateur-l3']);
    // Un nom hostile reste du texte : identifiants nettoyés, guillemets échappés
    const t = { colonnes: ['a', 'b'], lignes: [{ a: 'end', b: 'x"]; click x call alert(1) %%' }], association: { source: 'a', cible: 'b' } };
    const code = reseau.produirePages(reseau.analyserReseau(t)).pages[0].code;
    assert.doesNotMatch(code, /^\s*click/m);
    assert.equal(logigramme.ecrire(logigramme.analyser(code)), code);
});

test('réseau : fichier Excel 97-2003 refusé avec un conseil', async () => {
    await assert.rejects(reseau.lireEnregistrements(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0, 0, 0, 0])), /\.xlsx ou en CSV/);
});

// ---------- Zoom et déplacement dans la scène ----------
import * as navigation from '../js/navigation.js';

test('navigation : molette, pincement, pavé tactile, bornes', () => {
    const roue = (o) => ({ deltaMode: 0, deltaX: 0, deltaY: 0, ctrlKey: false, metaKey: false, ...o });
    // un cran de souris : environ ×1,16 vers le bas comme vers le haut, symétrique
    const avant = navigation.facteurMolette(roue({ deltaY: -100 }));
    const arriere = navigation.facteurMolette(roue({ deltaY: 100 }));
    assert.ok(avant > 1.1 && avant < 1.25, String(avant));
    assert.ok(Math.abs(avant * arriere - 1) < 1e-9);
    // en lignes (Firefox) : même ordre de grandeur
    assert.ok(Math.abs(navigation.facteurMolette(roue({ deltaMode: 1, deltaY: -3 })) - navigation.facteurMolette(roue({ deltaY: -48 }))) < 1e-9);
    // pincement du pavé tactile (Ctrl, petits deltas) : sensible, plafonné
    assert.ok(navigation.facteurMolette(roue({ ctrlKey: true, deltaY: -10 })) > 1.09);
    assert.ok(navigation.facteurMolette(roue({ deltaY: -100000 })) <= Math.E + 1e-9);
    // la souris zoome, le pavé tactile glissé à deux doigts défile
    assert.equal(navigation.estPaveTactile(roue({ deltaY: 100 })), false);
    assert.equal(navigation.estPaveTactile(roue({ deltaY: 3.5 })), true);
    assert.equal(navigation.estPaveTactile(roue({ deltaX: 4, deltaY: 1 })), true);
    assert.equal(navigation.estPaveTactile(roue({ ctrlKey: true, deltaY: 3.5 })), false);
    assert.deepEqual([0.01, 1, 500].map(navigation.borner), [navigation.ZOOM_MIN, 1, navigation.ZOOM_MAX]);
});

test('navigation : le point visé reste sous le pointeur', () => {
    const avant = { left: 100, top: 50, width: 400, height: 300 };
    const point = { x: 300, y: 200 }; // au milieu de la feuille
    // la feuille double de taille depuis le même coin : le milieu est désormais 200 px plus loin
    assert.deepEqual(navigation.ancrer(avant, { left: 100, top: 50, width: 800, height: 600 }, point), { dx: 200, dy: 150 });
    // feuille recentrée par la mise en page : la correction en tient compte
    const r = navigation.ancrer(avant, { left: -100, top: -100, width: 800, height: 600 }, point);
    assert.ok(Math.abs(-100 + 0.5 * 800 - r.dx - point.x) < 1e-9 && Math.abs(-100 + 0.5 * 600 - r.dy - point.y) < 1e-9);
    // point hors de la feuille (fond gris) : il reste fixe lui aussi
    const dehors = navigation.ancrer(avant, { left: 100, top: 50, width: 800, height: 600 }, { x: 50, y: 20 });
    assert.deepEqual(dehors, { dx: -50, dy: -30 });
});

// ---------- Export Visio ----------
import { lireTrace, aplatir, traceRectangle, echapperXml, construireVsdx, pageXml } from '../js/visio-format.js';
import { ecrireZip, lireZip, crc32 } from '../js/zip.js';

const IDENTITE = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
const proche = (a, b, e = 1e-6) => Math.abs(a - b) <= e;

test('visio : lecture des tracés SVG (absolus, relatifs, H/V, Z, courbes, arcs)', () => {
    const [a] = lireTrace('M10 10 h20 v10 H10 z');
    assert.deepEqual(a.depart, [10, 10]);
    assert.deepEqual(a.segments.map((s) => s.p), [[30, 10], [30, 20], [10, 20]]);
    assert.equal(a.ferme, true);
    // Coordonnées implicites après M : des LineTo ; relatifs enchaînés
    const [b] = lireTrace('m0 0 10 0 0 10');
    assert.deepEqual(b.segments.map((s) => s.p), [[10, 0], [10, 10]]);
    // Nombres collés, exposants
    const [c] = lireTrace('M0,0L1e1-5.5.5');
    assert.deepEqual(c.segments.map((s) => s.p), [[10, -5.5]]);
    assert.equal(lireTrace('M0 0').length, 0);
    // Q et S convertis en cubiques, T reflète le point de contrôle
    const [q] = lireTrace('M0 0Q10 10 20 0T40 0');
    assert.equal(q.segments.length, 2);
    assert.ok(q.segments.every((s) => s.t === 'C'));
    assert.deepEqual(q.segments[1].p, [40, 0]);
    // Demi-cercle par un arc aux drapeaux collés : tous les points à distance r du centre
    const arc = lireTrace('M0 0a10 10 0 0110 10');
    const [plat] = aplatir(arc, IDENTITE, 0.001);
    assert.deepEqual(plat.points.at(-1), [10, 10]);
    for (const [x, y] of plat.points) assert.ok(proche(Math.hypot(x - 0, y - 10), 10, 0.01), `point hors du cercle : ${x}, ${y}`);
    // Tracé tronqué : la partie lisible est gardée
    assert.equal(lireTrace('M0 0L10 10L5').length, 1);
});

test('visio : aplatissement transformé et rectangle arrondi', () => {
    const [r] = aplatir(traceRectangle(0, 0, 10, 4), { a: 2, b: 0, c: 0, d: 2, e: 5, f: 1 });
    assert.equal(r.ferme, true);
    assert.deepEqual(r.points, [[5, 1], [25, 1], [25, 9], [5, 9]]);
    const arrondi = aplatir(traceRectangle(0, 0, 10, 10, 3), IDENTITE, 0.01)[0];
    assert.ok(arrondi.points.length > 8);
    for (const [x, y] of arrondi.points) assert.ok(x >= -1e-9 && x <= 10 + 1e-9 && y >= -1e-9 && y <= 10 + 1e-9);
});

test('visio : échappement XML d\'un libellé hostile', () => {
    const hostile = '</Text><Shape ID="9"/>&amp; "x"\u0001￾\uD800';
    const e = echapperXml(hostile);
    assert.ok(!/[<>]/.test(e));
    assert.ok(!/[\u0000-\u0008￾\uD800]/.test(e));
    assert.equal(e, '&lt;/Text&gt;&lt;Shape ID=&quot;9&quot;/&gt;&amp;amp; &quot;x&quot;');
    const { xml } = pageXml([{ genre: 'texte', centre: [10, 10], largeur: 20, hauteur: 5, angle: 0, texte: hostile, police: {} }], 100, new Map());
    assert.equal((xml.match(/<Shape /g) || []).length, 1);
});

test('visio : unités, axe Y inversé, connecteur collé', () => {
    const carre = (x) => ({ genre: 'groupe', enfants: [{ genre: 'geo', chemins: [{ ferme: true, points: [[x, 10], [x + 25.4, 10], [x + 25.4, 35.4], [x, 35.4]] }], style: { remplissage: '#ffffff', trait: '#000000', epaisseur: 0.3 } }], texte: { centre: [x + 12.7, 22.7], largeur: 10, hauteur: 4, texte: 'Nœud', police: {} } });
    const a = carre(0);
    const b = carre(100);
    const lien = { genre: 'connecteur', points: [[25.4, 22.7], [100, 22.7]], style: { trait: '#000000', epaisseur: 0.3, fin: 13 }, debut: a, fin: b, texte: null };
    const { xml, formes, connecteurs } = pageXml([a, b, lien], 254, new Map());
    assert.equal(formes, 5);
    assert.equal(connecteurs, 2);
    // Groupe a : 1 pouce de côté, centré à (0,5 ; (254 − 22,7) / 25,4) pouces
    assert.match(xml, /<Shape ID="1" Type="Group"[^>]*><Cell N="PinX" V="0.5"\/><Cell N="PinY" V="9.106299"\/><Cell N="Width" V="1"/);
    assert.match(xml, /<Connect FromSheet="5" FromCell="BeginX" FromPart="9" ToSheet="1" ToCell="PinX" ToPart="3"\/>/);
    assert.match(xml, /<Connect FromSheet="5" FromCell="EndX" FromPart="12" ToSheet="3"/);
    assert.match(xml, /_XFTRIGGER\(Sheet\.3!EventXFMod\)/);
    assert.match(xml, /<Cell N="EndArrow" V="13"\/>/);
    // Visio refuse un fichier dont une forme écrit son texte après ses sous-formes (LibreOffice l'accepte)
    assert.match(xml, /<\/Section><Text>Nœud<\/Text><Shapes>/);
    assert.doesNotMatch(xml, /<\/Shapes><Text>/);
});

test('visio : paquet complet relu par le lecteur ZIP', async () => {
    const pages = [
        { nom: 'Réseau / siège', largeurMm: 297, hauteurMm: 210, formes: [{ genre: 'image', centre: [50, 50], largeur: 20, hauteur: 20, angle: 0, media: 'image1.png' }] },
        { nom: 'Deux', largeurMm: 210, hauteurMm: 297, formes: [] },
    ];
    const medias = new Map([['image1.png', { octets: new Uint8Array([137, 80, 78, 71, 1, 2, 3]), type: 'png' }]]);
    const { fichiers } = construireVsdx({ titre: 'Essai <&>', pages, medias });
    const archive = await ecrireZip(fichiers);
    const lire = await lireZip(archive);
    const texte = async (nom) => new TextDecoder().decode(await lire(nom));
    assert.match(await texte('[Content_Types].xml'), /PartName="\/visio\/pages\/page2.xml"/);
    assert.match(await texte('visio/pages/pages.xml'), /Name="Réseau - siège"[\s\S]*PrintPageOrientation" V="2"[\s\S]*PrintPageOrientation" V="1"/);
    assert.match(await texte('visio/pages/page1.xml'), /Type="Foreign"[\s\S]*CompressionType="PNG"><Rel r:id="rId1"\/>/);
    assert.match(await texte('visio/pages/_rels/page1.xml.rels'), /Target="..\/media\/image1.png"/);
    assert.match(await texte('docProps/core.xml'), /<dc:title>Essai &lt;&amp;&gt;<\/dc:title>/);
    // Attribut de police au nom exact du format (Visio refuse un attribut inconnu)
    assert.match(await texte('visio/document.xml'), /<FaceName NameU="Marianne" UnicodeRanges="[^"]*" CharSets="[^"]*" Panose="[^"]*" Flags="\d+"\/>/);
    assert.deepEqual([...await lire('visio/media/image1.png')], [137, 80, 78, 71, 1, 2, 3]);
    assert.equal(await lire('absent.xml'), null);
    for (const f of fichiers) {
        const relu = await lire(f.nom);
        const brut = typeof f.donnees === 'string' ? new TextEncoder().encode(f.donnees) : f.donnees;
        assert.equal(crc32(relu), crc32(brut), f.nom);
    }
    assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
});

// ---------- Diagnostic des erreurs de syntaxe (0.21.0) ----------
import { SYNTAXES, TYPES_AIDE, objetDe } from '../js/syntaxes.js';
import { diagnostiquer, localiser, lignesConservees, distance, plusProche } from '../js/diagnostic.js';

const erreurJison = (ligne, colonne = 0) => ({ message: `Parse error on line ${ligne}:\n...`, hash: { loc: { first_line: ligne, first_column: colonne } } });

test('syntaxes : chaque type a un nom, un en-tête et des objets complets ; chaque exemple est reconnu', () => {
    assert.ok(TYPES_AIDE.length >= 28);
    for (const t of TYPES_AIDE) {
        const def = SYNTAXES[t];
        assert.ok(def.nom && def.entete.length && def.objets.length, t);
        for (const o of def.objets) {
            assert.ok(o.id && o.nom && o.syntaxe.length && o.exemple && o.reconnait instanceof RegExp, `${t}/${o.id}`);
            // La première ligne de l'exemple est reconnue comme un objet du type (la ligne d'en-tête exceptée)
            const premiere = o.exemple.split('\n')[0];
            if (!def.entete.some((e) => premiere.startsWith(e.split(' ')[0]))) assert.ok(objetDe(t, premiere), `${t}/${o.id} : exemple non reconnu`);
        }
    }
    // Les exemples des types à éditeur visuel sont relus par l'éditeur, hors écritures qu'il laisse au code
    const contexte = new Set(['classDiagram/membre', 'erDiagram/attribut', 'requirementDiagram/propriete', 'venn/titre', 'venn/union', 'diapo/element', 'diapo/bloc']);
    for (const t of TYPES_AIDE) {
        const editeur = editeurPour(t);
        if (!editeur) continue;
        for (const o of SYNTAXES[t].objets) {
            if (['commentaire', 'fin'].includes(o.id) || contexte.has(`${t}/${o.id}`)) continue;
            const tete = t === 'gantt' ? 'gantt\n    dateFormat YYYY-MM-DD\n    section S' : t === 'carte' ? 'carte region\nzone: 84' : SYNTAXES[t].entete[0];
            const decale = ['diapo', 'carte', 'treemap'].includes(t) ? '' : '    ';
            try { editeur.analyser(`${tete}\n${o.exemple.split('\n').map((l) => decale + l).join('\n')}\n`); } catch (e) {
                assert.match(e.message, /n'est pas gérée par l'édition visuelle/, `${t}/${o.id} : ${e.message}`);
            }
        }
    }
});

test('diagnostic : ligne réelle malgré le bloc de tête, les commentaires et les lignes vides', () => {
    const code = '\n---\ntitle: Essai\nconfig:\n  theme: base\n---\n%% note\n%%{init: {"theme":"base"}}%%\nflowchart TD\n    %% autre\n    A --> B\n\n    B -> C\n';
    assert.deepEqual(lignesConservees(code).map((i) => i + 1), [9, 11, 12, 13, 14]);
    assert.equal(localiser(code, erreurJison(4, 5)).ligne, 13);
    // Fin du code atteinte : dernière ligne écrite
    assert.deepEqual(localiser('flowchart TD\n    A --> B\n\n', erreurJison(4)), { ligne: 2, colonne: null, finDeCode: true });
    // Erreurs de l'analyseur Langium (camembert, architecture…) et des écritures de FUSAIN
    assert.equal(localiser('pie\n    "A" : 1,5\n', { message: 'Parsing failed: Lexer error on line 2, column 13: x' }).ligne, 2);
    assert.equal(localiser('carte monde\npalete: theme\n', { message: 'Ligne 2 : option inconnue « palete ».' }).ligne, 2);
    // Le diagramme de flux ne numérote pas ses lignes vides
    assert.equal(localiser('sankey-beta\n\nA,B,1\nC,D,x\n', erreurJison(3)).ligne, 4);
});

test('diagnostic : objet visé, cause et réparation attendue sur un corpus de fautes', () => {
    const cas = [
        ['flowchart TD\n    A --> B\n    B -> C\n', erreurJison(3), 3, 'lien', '    B --> C'],
        ['flowchart LR\n    A => B\n', erreurJison(2), 2, 'lien', '    A ==> B'],
        ['flowchart TD\n    A[Texte (détail)] --> B\n', erreurJison(2), 2, 'etape', '    A["Texte (détail)"] --> B'],
        ['flowchart TD\n    A["Texte] --> B\n', erreurJison(2), 2, 'lien', '    A["Texte"] --> B'],
        ['flowchart TD\n    A -->|oui B\n', erreurJison(2), 2, 'lien', '    A -->|oui| B'],
        ['flowchart TD\n    A[“Texte (x)”] --> B\n', erreurJison(2), 2, 'lien', '    A["Texte (x)"] --> B'],
        ['flowchart TD\n    subgrap g [G]\n        A --> B\n    end\n', erreurJison(2), 2, 'groupe', '    subgraph g [G]'],
        ['sequenceDiagram\n    A->>B texte\n', erreurJison(2), 2, 'message', '    A->>B: texte'],
        ['sequenceDiagram\n    A=>B: texte\n', erreurJison(2), 2, 'message', '    A->>B: texte'],
        ['sequenceDiagram\n    participan A as Agent\n', erreurJison(2), 2, 'participant', '    participant A as Agent'],
        ['sequenceDiagram\n    A->>B: x\n    Note A: texte\n', erreurJison(3), 3, 'note', '    Note right of A: texte'],
        ['stateDiagram-v2\n    A -> B\n', erreurJison(2), 2, 'transition', '    A --> B'],
        ['erDiagram\n    A ||--o{ B\n', erreurJison(2), 2, 'relation', '    A ||--o{ B : ""'],
        ['erDiagram\n    A 1--* B : a\n', erreurJison(2), 2, 'relation', '    A ||--o{ B : a'],
        ['erDiagram\n    A {\n        nom\n    }\n', erreurJison(3), 3, 'attribut', '        string nom'],
        ['pie\n    Agents : 12,5\n', { message: 'Parsing failed: Lexer error on line 2, column 13' }, 2, 'part', '    "Agents" : 12.5'],
        ['gantt\n    dateFormat YYYY-MM-DD\n    section S\n    Tache t1, 2026-01-05, 3 jours\n', erreurJison(4), 4, 'tache', '    Tache :t1, 2026-01-05, 3d'],
        ['architecture-beta\n    service a(server)[A]\n    service b(server)[B]\n    a -- b\n', { message: 'Parsing failed: Parse error on line 4, column 9' }, 4, 'liaison', '    a:R -- L:b'],
        ['sankey-beta\n\nBudget,Santé publique,400\n', erreurJison(2), 3, 'flux', 'Budget,Sante publique,400'],
        ['gitGraph\n    commit id: v1\n', { message: 'Parsing failed: Parse error on line 2, column 16' }, 2, 'commit', '    commit id: "v1"'],
        ['packet-beta\n    0-3 "Version"\n', { message: 'Parsing failed: Parse error on line 2, column 9' }, 2, 'champ', '    0-3: "Version"'],
        ['requirementDiagram\n    requirement r {\n        risk: élevé\n    }\n', erreurJison(3), 3, 'propriete', '        risk: high'],
        ['C4Context\n    Rel(a, b)\n', erreurJison(2), 2, 'relation', '    Rel(a, b, "")'],
        ['carte monde\npalete: theme\n', { message: 'Ligne 2 : option inconnue « palete ».' }, 2, 'option', 'palette: theme'],
        ['diapo titre\ntitr: Bonjour\n', { message: 'Ligne 2 : champ inconnu pour la mise en page « Page de titre ».' }, 2, 'champ', 'titre: Bonjour'],
    ];
    for (const [code, erreur, ligne, objet, attendue] of cas) {
        const d = diagnostiquer(code, erreur);
        const nom = code.split('\n')[1].trim();
        assert.equal(d.ligne, ligne, `${nom} : ligne`);
        assert.equal(d.objet?.id, objet, `${nom} : objet`);
        assert.ok(d.cause, `${nom} : cause`);
        assert.ok(d.propositions.some((p) => p.apres === attendue), `${nom} : ${JSON.stringify(d.propositions.map((p) => p.apres))}`);
        // Une réparation ne touche que la ligne fautive
        const p = d.propositions.find((x) => x.apres === attendue);
        const avant = code.split('\n');
        const apres = p.code.split('\n');
        assert.equal(apres.length, avant.length);
        assert.equal(apres.filter((l, k) => l !== avant[k]).length, 1, nom);
        // Dernier recours : mise en commentaire (Mermaid) ou suppression (écritures de FUSAIN)
        assert.ok(d.propositions.some((x) => x.apres.trim().startsWith('%%') || x.libelle === 'Supprimer cette ligne'), `${nom} : recours`);
    }
});

test('diagnostic : la ligne précédant celle désignée est contrôlée aussi', () => {
    const erreurLigne = (n) => ({ message: `Parse error on line ${n}:`, hash: { loc: { first_line: n, first_column: 0 } } });
    // Camembert : guillemet non fermé ligne 3, signalé par Mermaid à la ligne 4
    const pie = 'pie\n  "A" : 10\n  "B : 20\n\n  %% note\n  "C" : 5';
    const d = diagnostiquer(pie, erreurLigne(4));
    assert.equal(d.ligne, 4);
    assert.equal(d.precedente?.ligne, 3);
    assert.ok(d.cause.includes('ligne 3'), d.cause);
    const r = d.propositions.find((p) => p.ligne === 3);
    assert.equal(r?.apres.trim(), '"B" : 20');
    assert.match(r.libelle, /^Ligne 3 : /);
    assert.equal(r.code.split('\n')[5], '  "C" : 5');
    // Ligne précédente correcte : rien n'est ajouté
    const d2 = diagnostiquer('flowchart LR\n  A --> B\n  B -> C', erreurLigne(3));
    assert.equal(d2.precedente, undefined);
    assert.ok(d2.propositions.every((p) => p.ligne === 3));
    // L'en-tête n'est jamais la « ligne précédente »
    assert.ok(diagnostiquer('pie\n  "B : 20', erreurLigne(2)).propositions.every((p) => p.ligne === 2));
    // Libellé entre guillemets abandonné : guillemet et crochet fermés ensemble
    const d3 = diagnostiquer('flowchart LR\n  A --> B["Texte\n  B --> C', erreurLigne(2));
    assert.ok(d3.propositions.map((p) => p.apres.trim()).includes('A --> B["Texte"]'));
});

test('diagnostic : en-tête, sens, blocs ouverts ou fermés en trop, carte mentale', () => {
    let d = diagnostiquer('flowchar TD\n    A --> B\n', { message: 'No diagram type detected matching given configuration' });
    assert.equal(d.ligne, 1);
    assert.equal(d.propositions[0].apres, 'flowchart TD');
    d = diagnostiquer('sequence\n    A->>B: x\n', { message: 'No diagram type detected' });
    assert.equal(d.propositions[0].apres, 'sequenceDiagram');
    d = diagnostiquer('flowchart TOP\n    A --> B\n', erreurJison(1));
    assert.deepEqual(d.propositions.map((p) => p.apres), ['flowchart TD', 'flowchart LR']);
    // end manquant : désigné à l'ouverture du groupe, fermeture proposée en fin de code et après le contenu décalé
    d = diagnostiquer('flowchart TD\n    subgraph g [G]\n        A --> B\n    C --> D\n', erreurJison(6));
    assert.equal(d.ligne, 2);
    assert.equal(d.objet.id, 'groupe');
    assert.deepEqual(d.propositions.map((p) => p.code.split('\n').indexOf('    end')), [4, 3]);
    // end en trop : la ligne est désignée, sa suppression proposée
    d = diagnostiquer('flowchart TD\n    A --> B\n    end\n    C --> D\n', erreurJison(3));
    assert.equal(d.ligne, 3);
    assert.equal(d.propositions[0].code, 'flowchart TD\n    A --> B\n    C --> D\n');
    // Accolade jamais fermée, erreur signalée sur la dernière ligne
    d = diagnostiquer('stateDiagram-v2\n    state A {\n        B --> C\n', erreurJison(3));
    assert.equal(d.ligne, 2);
    assert.ok(d.propositions.some((p) => p.apres === '    }'));
    // Boucle de séquence non fermée
    d = diagnostiquer('sequenceDiagram\n    loop Chaque jour\n        A->>B: x\n', erreurJison(4));
    assert.equal(d.objet.id, 'bloc');
    // Carte mentale : une seule racine
    d = diagnostiquer('mindmap\n  racine\n  autre\n', { message: 'There can be only one root. No parent could be found for ("autre")' });
    assert.equal(d.ligne, 3);
    assert.equal(d.propositions[0].apres, '    autre');
    // « end » comme identifiant : renommé dans tout le code
    d = diagnostiquer('flowchart TD\n    A --> end\n    end --> B\n', erreurJison(2));
    assert.ok(d.propositions.some((p) => p.code === 'flowchart TD\n    A --> fin\n    fin --> B\n'));
});

test('diagnostic : libellé hostile, distances, aucun diagnostic hors de propos', () => {
    const hostile = 'flowchart TD\n    A[<img src=x onerror=alert(1)> (x)] --> B\n';
    const d = diagnostiquer(hostile, erreurJison(2));
    // La réparation reste du texte, mis entre guillemets, sans rien perdre ni ajouter
    assert.ok(d.propositions.some((p) => p.apres === '    A["<img src=x onerror=alert(1)> (x)"] --> B'));
    assert.ok(d.propositions.every((p) => typeof p.code === 'string' && typeof p.libelle === 'string'));
    assert.equal(distance('flowchar', 'flowchart'), 1);
    assert.equal(distance('ab', 'ba'), 1);
    assert.equal(plusProche('participan', ['participant', 'actor']), 'participant');
    assert.equal(plusProche('xyz', ['participant', 'actor']), null);
    // Erreur sans position (limite de taille) : pas de ligne inventée
    assert.equal(diagnostiquer('flowchart TD\n    A --> B\n', { message: 'Maximum text size in diagram exceeded' }).ligne, null);
});

test('CSS : les échappements ne contournent pas le filtre des ressources extérieures', () => {
    assert.equal(decoderCss('\\75 rl(x)'), 'url(x)');
    assert.equal(decoderCss('@\\69mport'), '@import');
    assert.equal(decoderCss('a\\:b'), 'a:b');
    assert.equal(decoderCss('fill:red'), 'fill:red');
    assert.ok(cssExterieur('fill:\\75rl(https://exemple.fr/x.png)'));
    assert.ok(cssExterieur('background:image-set("https://exemple.fr/x.png" 1x)'));
    assert.ok(cssExterieur('@\\69mport "https://exemple.fr/a.css"'));
    assert.ok(!cssExterieur('fill:url(#degrade)'));
    assert.ok(!cssExterieur('fill:#ff0000;stroke-width:2px'));
});

test('directives : en-tête avec espaces, directive non fermée, clé « img » entre guillemets', () => {
    const tete = nettoyerCode('--- \nconfig:\n  flowchart:\n    htmlLabels: true\n---\nflowchart TD\n  A --> B');
    assert.ok(!tete.includes('htmlLabels'));
    assert.throws(() => nettoyerCode('---\nconfig:\n  logLevel: 0\nflowchart TD\n  A --> B'));
    const ouverte = nettoyerCode('flowchart TD\n  A --> B\n%%{init: {"flowchart":{"htmlLabels":true}}');
    assert.ok(!ouverte.includes('%%{'));
    const fermee = nettoyerCode('%%{init: {"theme":"forest"}}%%\nflowchart TD\n  A --> B');
    assert.ok(fermee.includes('%%{init: {"theme":"forest"}}%%'));
    const image = nettoyerCode('flowchart TD\n  A@{ "img": "https://exemple.fr/p.png", label: "x" }');
    assert.ok(!image.includes('exemple.fr'));
    assert.ok(nettoyerCode('flowchart TD\n  A@{ icon: "dsfr:user-line" }').includes('dsfr:user-line'));
});

test('diagnostic : une ligne très longue ne fige pas le diagnostic', async () => {
    const { diagnostiquer } = await import('../js/diagnostic.js');
    const debut = Date.now();
    diagnostiquer('pie\n  1' + ' '.repeat(20000) + '"', new Error('Parse error on line 2'));
    diagnostiquer('treemap-beta\n  a' + ' '.repeat(20000) + '"x', new Error('Parse error on line 2'));
    assert.ok(Date.now() - debut < 2000);
});

test('éditeurs : accTitle/accDescr gardés, entités gardées, « %% » protégé, linkStyle suivi', () => {
    const etats = editeurPour('stateDiagram');
    const e = etats.ecrire(etats.analyser('stateDiagram-v2\n  accTitle: Cycle\n  [*] --> A'));
    assert.ok(e.includes('accTitle: Cycle') && !e.includes('as accTitle'));
    const lg = editeurPour('flowchart');
    const m = lg.analyser('flowchart TD\n  A --> B\n  B --> C\n  C --> D\n  linkStyle 2 stroke:red');
    m.liens.splice(0, 1);
    const ecrit = lg.ecrire(m);
    assert.ok(ecrit.includes('linkStyle 1 stroke:red') && !ecrit.includes('linkStyle 2'));
    const st = lg.ecrire(lg.analyser('flowchart TD\n  A --> B\n  style A font-family:Marianne,arial,stroke:#000'));
    assert.ok(st.includes('font-family:Marianne,arial'));
    // Entité écrite dans le code : gardée telle quelle à la réécriture
    const coeur = lg.ecrire(lg.analyser('flowchart TD\n    A[Avec #quot;guillemets#quot; et #9829;] --> B'));
    assert.ok(coeur.includes('#9829;'));
    const g = editeurPour('gantt');
    const gm = g.analyser('gantt\n  dateFormat YYYY-MM-DD\n  section S\n  Tache :2026-01-01, 2d');
    gm.lignes.find((l) => l.t === 'tache').nom = '%% revoir';
    assert.ok(!/^\s*%%/m.test(g.ecrire(gm).split('\n').slice(3).join('\n')));
    assert.throws(() => etats.analyser('stateDiagram-v2\n  [*] --> Still:::lent'));
});

test('ZIP : une archive dont le contenu dépasse la taille admise est arrêtée', async () => {
    const { ecrireZip, lireZip } = await import('../js/zip.js');
    const archive = await ecrireZip([{ nom: 'a.txt', donnees: 'a'.repeat(200000) }]);
    const lire = await lireZip(archive, { tailleMax: 1000 });
    await assert.rejects(() => lire('a.txt'));
    assert.equal((await (await lireZip(archive))('a.txt')).length, 200000);
});
