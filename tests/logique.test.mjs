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
