// Tests de logique, sans navigateur :  node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { MODELES } from '../js/modeles.js';
import { editeurPour } from '../js/diagrammes/index.js';
import { typeDiagramme, nettoyerCode, nomFichierSur } from '../js/securite.js';
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

test('tous les modèles proposés ont un éditeur visuel', () => {
    for (const m of MODELES) assert.ok(editeurPour(typeDiagramme(m.code)), `sans éditeur : ${m.id}`);
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
    const racine = new URL('..', import.meta.url).pathname;
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
