// Robustesse et sécurité, dans le navigateur :
//  1. des libellés aléatoires hostiles sont injectés par les éditeurs visuels ; le code produit doit rester
//     valide pour Mermaid, se relire à l'identique, et ne rien exécuter ;
//  2. un corpus de codes malveillants est rendu ; le SVG final ne doit contenir ni script, ni gestionnaire,
//     ni lien, ni ressource externe.
//   PLAYWRIGHT=/chemin/vers/playwright/index.mjs node tests/robustesse.mjs [nombre d'essais par type]
const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright');
const ESSAIS = Number(process.argv[2] || 150);
const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: true });
const p = await (await b.newContext({ viewport: { width: 1500, height: 950 } })).newPage();
const externes = [];
const base = process.env.FUSAIN_URL || 'http://127.0.0.1:8765/';
p.on('request', (r) => { if (!r.url().startsWith(base) && !/^(data|blob):/.test(r.url())) externes.push(r.url()); });
p.on('dialog', (d) => { console.log('ECHEC boîte de dialogue ouverte :', d.message()); d.dismiss(); });
p.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 200)));
await p.goto(base);
await p.waitForSelector('html[data-fusain-pret]');
await p.waitForTimeout(600);

const bilan = await p.evaluate(async (ESSAIS) => {
    const { MODELES } = await import('./js/modeles.js');
    const { editeurPour } = await import('./js/diagrammes/index.js');
    const { typeDiagramme, nettoyerCode } = await import('./js/securite.js');
    const rendu = await import('./js/rendu.js');
    window.__xss = 0;
    // L'extension ZenUML n'est chargée qu'au premier rendu d'un schéma de ce type
    await rendu.rendreSchema(MODELES.find((m) => m.id === 'zenuml').code, 'bleu-france');
    const MORCEAUX = ['"', "'", '`', '[', ']', '(', ')', '{', '}', '|', ';', ':', '#', '%%', '-->', '---', '&', '<', '>', '\\', '/', '\n', ' ', ' end ', 'end', 'subgraph x', 'click A', 'style', '<script>window.__xss=1</script>', '<img src=x onerror="window.__xss=1">', '<b>gras</b>', '#quot;', '#59;', '%%{init:{"securityLevel":"loose"}}%%', 'javascript:window.__xss=1', 'é', 'Ω', '😀', '\t', ',', '=', '==>', '-.->', '~~~', '@{', ':::', '$$', '&lt;', 'title', 'section', 'after', 'Note over', 'loop', 'participant'];
    let graine = 12345;
    const alea = (n) => { graine = (graine * 1103515245 + 12345) & 0x7fffffff; return graine % n; };
    const texte = () => { let t = ''; for (let i = 0, n = 1 + alea(6); i < n; i += 1) t += alea(3) ? MORCEAUX[alea(MORCEAUX.length)] : 'mot' + alea(9); return t; };
    const echecs = [];
    const comptes = {};

    for (const type of ['logigramme', 'sequence', 'carte-mentale', 'gantt', 'camembert', 'frise', 'kanban', 'quadrant', 'etats', 'parcours', 'graphique', 'flux', 'entites', 'classes', 'architecture', 'versions', 'paquet', 'c4', 'blocs', 'exigences', 'radar', 'treemap', 'zenuml']) {
        const depart = MODELES.find((m) => m.id === type).code;
        const editeur = editeurPour(typeDiagramme(depart));
        comptes[type] = 0;
        for (let essai = 0; essai < ESSAIS; essai += 1) {
            const modele = editeur.analyser(depart);
            const cles = editeur.elements(modele).map((e) => e.cle);
            const injectes = [];
            for (let k = 0; k < 3; k += 1) { const cle = cles[alea(cles.length)]; const t = texte(); injectes.push(t); editeur.renommer(modele, cle, t); }
            let code = '';
            try {
                code = editeur.ecrire(modele);
                await window.mermaid.parse(nettoyerCode(code));
                const relu = editeur.ecrire(editeur.analyser(code));
                if (relu !== code) throw new Error('relecture différente');
                if (editeur.elements(editeur.analyser(code)).length !== cles.length) throw new Error('nombre d\'éléments modifié : un libellé est sorti de son élément');
                if (essai % 10 === 0) await rendu.rendreSchema(code, 'bleu-france');
                comptes[type] += 1;
            } catch (e) {
                if (echecs.length < 12) echecs.push({ type, injectes, erreur: String(e.message).split('\n')[0].slice(0, 160), code: code.slice(0, 400) });
                else echecs.push({ type });
            }
        }
    }

    // Suites d'opérations aléatoires (ajouts, liaisons, suppressions, renommages) : le schéma doit rester valide à chaque pas
    comptes.operations = 0;
    const visuels = MODELES.filter((m) => editeurPour(typeDiagramme(m.code)));
    for (let essai = 0; essai < ESSAIS; essai += 1) {
        const depart = visuels[alea(visuels.length)];
        const editeur = editeurPour(typeDiagramme(depart.code));
        let code = depart.code;
        const journal = [];
        try {
            for (let pas = 0; pas < 12; pas += 1) {
                const modele = editeur.analyser(code);
                const cles = editeur.elements(modele).map((e) => e.cle);
                if (!cles.length) break;
                const cle = cles[alea(cles.length)];
                const choix = alea(10);
                if (choix < 2) { journal.push(`supprimer ${cle}`); editeur.supprimer(modele, cle); }
                else if (choix < 5 && editeur.relier && editeur.peutRelier(cle)) { journal.push(`relier ${cle}`); editeur.relier(modele, cle, null); }
                else if (choix < 7 && editeur.relier && editeur.peutRelier(cle)) { const vers = cles[alea(cles.length)]; journal.push(`relier ${cle} → ${vers}`); editeur.relier(modele, cle, vers); }
                else { const t = texte(); journal.push(`renommer ${cle}`); editeur.renommer(modele, cle, t); }
                code = editeur.ecrire(modele);
                const relu = editeur.ecrire(editeur.analyser(code));
                if (relu !== code) throw new Error('relecture différente');
                if (editeur.elements(editeur.analyser(code)).length) await window.mermaid.parse(nettoyerCode(code));
            }
            comptes.operations += 1;
        } catch (e) {
            if (echecs.length < 12) echecs.push({ type: depart.id, journal, erreur: String(e.message).split('\n')[0].slice(0, 160), code: code.slice(0, 500) });
        }
    }

    // Corpus de codes malveillants : rendu complet puis inspection du SVG final
    const CORPUS = [
        'flowchart LR\n  A["<img src=x onerror=window.__xss=1>"] --> B["<script>window.__xss=1</script>"]',
        '%%{init: {"securityLevel":"loose","flowchart":{"htmlLabels":true}}}%%\nflowchart LR\n  A["<iframe src=javascript:window.__xss=1></iframe>"] --> B\n  click A href "javascript:window.__xss=1"\n  click B call alert()',
        '%%{init: {"themeCSS":"*{background:url(https://exemple.invalid/fuite)}","themeVariables":{"primaryColor":"url(https://exemple.invalid/a)"}}}%%\nflowchart LR\n  A --> B',
        '%%{init: {"fontFamily":"x;}</style><script>window.__xss=1</script>"}}%%\nflowchart LR\n  A --> B',
        '---\nconfig:\n  securityLevel: loose\n  themeCSS: "@import url(https://exemple.invalid/x.css);"\n---\nflowchart LR\n  A["<a href=\'https://exemple.invalid\'>lien</a>"] --> B',
        'sequenceDiagram\n  A->>B: <img src=https://exemple.invalid/p.png onerror=window.__xss=1>\n  Note over A: <svg onload=window.__xss=1>',
        'mindmap\n  root(("<img src=x onerror=window.__xss=1>"))\n    ::icon(fa fa-book)\n    A["<script>window.__xss=1</script>"]',
        'pie title <script>window.__xss=1</script>\n  "<img src=x onerror=window.__xss=1>" : 10\n  "b" : 5',
        'gantt\n  title <img src=x onerror=window.__xss=1>\n  dateFormat YYYY-MM-DD\n  section <svg onload=window.__xss=1>\n  T :a1, 2026-01-01, 3d\n  click a1 href "javascript:window.__xss=1"',
        'classDiagram\n  class A["<img src=x onerror=window.__xss=1>"]\n  link A "javascript:window.__xss=1"\n  click A href "https://exemple.invalid"',
        'stateDiagram-v2\n  [*] --> A\n  A: <img src=x onerror=window.__xss=1>',
        'flowchart LR\n  A@{ img: "https://exemple.invalid/i.png", label: "x", w: 60, h: 60 } --> B@{ icon: "fa:user" }',
        'journey\n  title <img src=x onerror=window.__xss=1>\n  section S\n    <script>window.__xss=1</script>: 5: Moi',
        'kanban\n  a[<img src=x onerror=window.__xss=1>]\n    b[<a href="javascript:window.__xss=1">x</a>]',
    ];
    const atelier = document.createElement('div');
    document.body.append(atelier);
    const corpus = [];
    for (const [i, code] of CORPUS.entries()) {
        try {
            const s = await rendu.rendreSchema(code, 'bleu-france');
            atelier.replaceChildren(s.svg.cloneNode(true));
            await new Promise((r) => setTimeout(r, 30));
            const html = atelier.innerHTML;
            const defauts = [];
            if (/<script|<iframe|<object|<embed|<img|<image|<a[\s>]|<foreignObject/i.test(html)) defauts.push('balise interdite');
            if (/\son[a-z]+\s*=/i.test(html.replace(/>[^<]*</g, '><'))) defauts.push('gestionnaire d\'événement');
            if (/javascript:/i.test(html.replace(/>[^<]*</g, '><'))) defauts.push('URL javascript');
            if (/exemple\.invalid/i.test(html.replace(/>[^<]*</g, '><'))) defauts.push('ressource externe');
            if (/@import/i.test(html)) defauts.push('@import');
            corpus.push([i, defauts.length ? 'DÉFAUT : ' + defauts.join(', ') : 'sain']);
        } catch (e) {
            corpus.push([i, 'refusé au rendu']); // un refus est une issue sûre
        }
    }
    atelier.remove();
    return { comptes, echecs, corpus, xss: window.__xss };
}, ESSAIS);

let mauvais = 0;
for (const [type, n] of Object.entries(bilan.comptes)) { if (n !== ESSAIS) mauvais += 1; console.log(n === ESSAIS ? 'OK   ' : 'ECHEC', type === 'operations' ? `suites de 12 opérations aléatoires : ${n}/${ESSAIS}` : `libellés hostiles — ${type} : ${n}/${ESSAIS}`); }
for (const e of bilan.echecs.filter((x) => x.erreur)) console.log('   ', JSON.stringify(e));
for (const [i, etat] of bilan.corpus) { if (etat.startsWith('DÉFAUT')) mauvais += 1; console.log(etat.startsWith('DÉFAUT') ? 'ECHEC' : 'OK   ', `corpus malveillant n°${i + 1} : ${etat}`); }
if (bilan.xss) mauvais += 1;
console.log(bilan.xss ? 'ECHEC' : 'OK   ', 'aucun script injecté ne s\'est exécuté');
// Trusted Types : une écriture HTML directe est assainie par le navigateur, un script créé par texte est refusé
const confiance = await p.evaluate(() => {
    if (!window.trustedTypes) return 'non pris en charge par ce navigateur';
    const d = document.createElement('div');
    d.innerHTML = '<img src="https://exemple.invalid/x.png" onerror="window.__xss=1"><b>ok</b>';
    let script = 'accepté';
    try { const s = document.createElement('script'); s.textContent = 'window.__xss=1'; document.body.append(s); } catch { script = 'refusé'; }
    return d.innerHTML === '<img><b>ok</b>' && script === 'refusé' && !window.__xss ? 'actif' : `DÉFAUT : ${d.innerHTML} / script ${script}`;
});
if (confiance.startsWith('DÉFAUT')) mauvais += 1;
console.log(confiance.startsWith('DÉFAUT') ? 'ECHEC' : 'OK   ', 'Trusted Types :', confiance);
if (externes.length) mauvais += 1;
console.log(externes.length ? 'ECHEC' : 'OK   ', 'aucune requête hors origine', externes.slice(0, 3).join(' '));
await b.close();
process.exit(mauvais ? 1 : 0);
