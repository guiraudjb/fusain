// Recette dans un vrai navigateur. Servir le dépôt (python3 -m http.server 8765) puis :
//   PLAYWRIGHT=/chemin/vers/playwright/index.mjs node tests/recette.mjs /dossier/de/sortie
const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright');
import fs from 'node:fs';
const OUT = process.argv[2];
const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: true });
const ctx = await b.newContext({ viewport: { width: 1500, height: 950 }, acceptDownloads: true });
const p = await ctx.newPage();
const errs = [];
p.on('console', m => { const t = m.text(); if (!/dsfr :/.test(t)) { console.log('[console]', m.type(), t.slice(0, 500)); if (m.type()==='error') errs.push(t); } });
p.on('pageerror', e => { errs.push(e.message); console.log('[pageerror]', e.message.slice(0, 300), (e.stack||'').split('\n').slice(1,4).join(' | ')); });
p.on('response', r => { if (r.status() >= 400) console.log('[http]', r.status(), r.url()); });
const ok = (nom, cond, detail='') => console.log(cond ? 'OK   ' : 'ECHEC', nom, detail);
const code = () => p.evaluate(() => JSON.parse(JSON.stringify(window.__etat?.doc?.pages?.map(x => x.code) || null)));
await p.goto(process.env.FUSAIN_URL || 'http://127.0.0.1:8765/');
await p.waitForSelector('html[data-fusain-pret]'); await p.waitForTimeout(900);
const lireCode = async () => { await p.click('button:has-text("Code")'); await p.waitForTimeout(500); const v = await p.inputValue('#fusain-code-zone'); await p.click('button:has-text("Visuel")'); await p.waitForTimeout(500); return v; };

// 1. sélection + renommage sur place
await p.click('[data-fusain="n:C"]'); await p.waitForTimeout(200);
ok('sélection nœud', await p.locator('.fusain-sel').count() > 0 && (await p.textContent('#fusain-proprietes')).includes('Étape sélectionnée'));
await p.dblclick('[data-fusain="n:C"]'); await p.waitForTimeout(200);
await p.fill('.fusain-saisie', 'Instruction "du" dossier <b>x</b>'); await p.keyboard.press('Enter'); await p.waitForTimeout(700);
let c = await lireCode();
ok('renommage sur place + échappement', c.includes('C["Instruction #quot;du#quot; dossier <b>x</b>"]'), c.split('\n').find(l => l.includes('C[')));
// 2. poignée : clic => nouveau nœud lié
await p.click('[data-fusain="n:C"]'); await p.waitForTimeout(200);
await p.click('.fusain-poignee'); await p.waitForTimeout(800);
c = await lireCode();
ok('ajout nœud lié', /C --> n1/.test(c) && /n1\["Nouvelle étape"\]/.test(c));
// 3. glisser la poignée vers un autre nœud
await p.click('[data-fusain="n:n1"]'); await p.waitForTimeout(300);
const h = await p.locator('.fusain-poignee').boundingBox(); const t = await p.locator('[data-fusain="n:A"]').first().boundingBox();
await p.mouse.move(h.x + h.width/2, h.y + h.height/2); await p.mouse.down(); await p.mouse.move(h.x + 40, h.y - 30, { steps: 4 }); await p.mouse.move(t.x + t.width/2, t.y + t.height/2, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(800);
c = await lireCode();
ok('lien par glisser', /n1 --> A/.test(c), c.split('\n').filter(l => /n1/.test(l)).join(' ; '));
// 4. lien : sélection + propriétés
await p.locator('.fusain-touche[data-fusain="l:0"]').click({ force: true }); await p.waitForTimeout(300);
ok('sélection lien', (await p.textContent('#fusain-proprietes')).includes('Lien sélectionné'));
await p.locator('#fusain-proprietes .fusain-champ:has(label:text-is("Trait")) select').selectOption('pointille'); await p.waitForTimeout(700);
c = await lireCode(); ok('trait pointillé', /A -\.-> B/.test(c));
// 5. forme + couleur + groupe
await p.click('[data-fusain="n:A"]'); await p.waitForTimeout(200);
await p.click('.fusain-couleur[title="Rouge Marianne"]'); await p.waitForTimeout(700);
await p.click('button:has-text("Ajouter un groupe")'); await p.waitForTimeout(800);
c = await lireCode(); ok('couleur + groupe', /style A fill:#fddede/.test(c) && /subgraph groupe1 \["Nouveau groupe"\]/.test(c));
// 6. clavier : suppression
await p.click('[data-fusain="n:n1"]'); await p.focus('svg.fusain-page'); await p.keyboard.press('Delete'); await p.waitForTimeout(700);
c = await lireCode(); ok('suppression clavier', !/n1/.test(c));
// 7. annuler / rétablir
await p.click('button[title^="Annuler"]'); await p.waitForTimeout(700); c = await lireCode(); ok('annuler', /n1/.test(c));
await p.screenshot({ path: OUT + '/e2e-logigramme.png' });
// 7 ter. parcours au clavier seul : sélectionner, ajouter une étape liée, la nommer, renommer sur place, supprimer
{ await p.focus('#fusain-feuille svg.fusain-page'); await p.keyboard.press('Escape'); await p.keyboard.press('ArrowRight'); await p.waitForTimeout(200);
  const premiere = await p.evaluate(() => document.querySelector('#fusain-feuille .fusain-sel')?.getAttribute('data-fusain'));
  await p.keyboard.press('Insert'); await p.waitForTimeout(900);
  const dansChamp = await p.evaluate(() => document.activeElement?.id === 'fusain-champ-texte' && document.activeElement.selectionEnd - document.activeElement.selectionStart > 0);
  await p.keyboard.type('Étape clavier'); await p.keyboard.press('Tab'); await p.waitForTimeout(800);
  let cc = await lireCode();
  ok('clavier : étape liée ajoutée et nommée sans souris', premiere === 'n:A' && dansChamp && /A --> n\d+/.test(cc) && cc.includes('["Étape clavier"]'), `${premiere} ${dansChamp}`);
  const cle = await p.evaluate(() => document.querySelector('#fusain-feuille .fusain-sel')?.getAttribute('data-fusain'));
  await p.focus('#fusain-feuille svg.fusain-page'); await p.keyboard.press('F2'); await p.waitForTimeout(200); await p.keyboard.press('Control+a'); await p.keyboard.type('Renommée au clavier'); await p.keyboard.press('Enter'); await p.waitForTimeout(800);
  cc = await lireCode(); ok('clavier : renommage sur place', cc.includes('["Renommée au clavier"]'), cle);
  await p.click(`#fusain-feuille [data-fusain="${cle}"]`); await p.focus('#fusain-feuille svg.fusain-page'); await p.keyboard.press('Delete'); await p.waitForTimeout(800);
  cc = await lireCode(); ok('clavier : suppression', !cc.includes('Renommée au clavier')); }
// 7 quater. réglages du logigramme : espacement, tracé des liens, duplication
{ const liste = (l) => p.locator(`#fusain-proprietes .fusain-champ:has(label:text-is("${l}")) select`);
  const boite = () => p.evaluate(() => document.querySelector('#fusain-feuille .fusain-schema').getAttribute('viewBox').split(' ').map(Number));
  const avant = await boite();
  await liste('Espacement').selectOption('aere'); await p.waitForTimeout(900);
  const apres = await boite();
  await liste('Tracé des liens').selectOption('step'); await p.waitForTimeout(900);
  const trace = await p.evaluate(() => document.querySelector('#fusain-feuille path.flowchart-link').getAttribute('d'));
  ok('logigramme : espacement aéré et liens en escalier', apres[3] > avant[3] && !/C/.test(trace), `${avant[3]} → ${apres[3]}`);
  await p.click('#fusain-feuille [data-fusain="n:B"]'); await p.waitForTimeout(200); await p.click('#fusain-proprietes button:has-text("Dupliquer")'); await p.waitForTimeout(900);
  const cd = await lireCode(); ok('logigramme : duplication d\'une étape', (cd.match(/\{"Dossier complet \?"\}/g) || []).length === 2);
  await liste('Espacement').selectOption(''); await p.waitForTimeout(700); await liste('Tracé des liens').selectOption(''); await p.waitForTimeout(700);
  ok('logigramme : réglages par défaut = aucune directive dans le code', !(await lireCode()).includes('%%{')); }
// 7 bis. page : titre, sous-titre et description accessible
{ const champ = (libelle) => p.locator(`#fusain-proprietes .fusain-champ:has(label:text-is("${libelle}")) :is(input, textarea)`);
  await champ('Titre affiché sur la page').fill('Circuit de traitement'); await champ('Titre affiché sur la page').press('Tab'); await p.waitForTimeout(600);
  await champ('Sous-titre').fill('Version de travail'); await champ('Sous-titre').press('Tab'); await p.waitForTimeout(600);
  await champ('Description du schéma (lecteurs d\'écran, export SVG)').fill('Le dossier est instruit s\'il est complet.'); await p.keyboard.press('Tab'); await p.waitForTimeout(800);
  const page = await p.evaluate(() => { const s = document.querySelector('#fusain-feuille svg.fusain-page'); return { desc: s.querySelector(':scope > desc')?.textContent, textes: [...s.querySelectorAll(':scope > text')].map((t) => t.textContent) }; });
  ok('titre, sous-titre et description sur la page', page.desc === 'Le dossier est instruit s\'il est complet.' && page.textes.includes('Circuit de traitement') && page.textes.includes('Version de travail'), JSON.stringify(page));
  await p.screenshot({ path: OUT + '/e2e-page.png' }); }
// 8. mode code : erreur
await p.click('button:has-text("Code")'); await p.waitForTimeout(300);
await p.fill('#fusain-code-zone', 'flowchart LR\n  A -->'); await p.waitForTimeout(1200);
ok('erreur affichée, dernier rendu conservé', await p.locator('#fusain-erreur .fr-alert--error').count() === 1 && await p.locator('#fusain-feuille .fusain-schema').count() === 1, await p.textContent('#fusain-erreur'));
await p.fill('#fusain-code-zone', 'flowchart LR\n  A@{ shape: cyl, label: "Base" } --> B'); await p.waitForTimeout(1200);
ok('bascule code seul', (await p.textContent('#fusain-code-etat')) === 'Code seul' && await p.locator('#fusain-erreur .fr-alert').count() === 0, await p.getAttribute('#fusain-code-etat', 'title'));
await p.screenshot({ path: OUT + '/e2e-code.png' });
// 9. modèles : ajouter une page de chaque type visuel et vérifier le repérage
for (const [nom, sel, titre] of [['Diagramme de séquence', '[data-fusain^="i:"]', 'Diagramme de séquence'], ['Carte mentale', '[data-fusain^="r"]', 'Carte mentale'], ['Planning (Gantt)', '[data-fusain^="i:"]', 'Diagramme de Gantt'], ['Camembert', '[data-fusain^="p:"]', 'Camembert'], ['Frise chronologique', '[data-fusain^="e:"]', 'Frise chronologique'], ['Tableau Kanban', '[data-fusain^="k:"]', 'Tableau Kanban'], ["Diagramme d'états", '[data-fusain^="n:"]', "Diagramme d'états"], ['Matrice (quadrants)', '[data-fusain^="p:"]', 'Matrice']]) {
  await p.click('button:has-text("Visuel")');
  await p.click('button:has-text("Ajouter une page")'); await p.waitForSelector('#fusain-modale-modeles[open], #fusain-modale-modeles.fr-modal--opened', { timeout: 3000 }).catch(() => console.log('modale non ouverte'));
  await p.waitForTimeout(400);
  await p.click(`.fusain-modele:has(.fusain-modele__nom:text-is("${nom}"))`); await p.waitForTimeout(1500);
  const n = await p.locator(sel).count();
  ok(`page ${nom}`, n > 0 && (await p.textContent('#fusain-proprietes')).includes(titre), `${n} éléments repérés`);
  await p.locator(sel).first().click({ force: true }); await p.waitForTimeout(300);
  await p.screenshot({ path: `${OUT}/e2e-${nom.split(' ')[0].toLowerCase()}.png` });
}
// 10. tous les modèles se rendent sans erreur
const res = await p.evaluate(async () => { const { MODELES } = await import('./js/modeles.js'); const r = await import('./js/rendu.js'); const out = []; for (const m of MODELES) { try { const s = await r.rendreSchema(m.code, 'bleu-france'); out.push([m.id, 'ok', s.htmlIncorpore ? 'HTML' : '']); } catch (e) { out.push([m.id, 'ERREUR', String(e.message).slice(0, 120)]); } } return out; });
for (const r of res) ok('modèle ' + r[0], r[1] === 'ok', r[2]);
// 11. exports
const dl = async (action) => { const [d] = await Promise.all([p.waitForEvent('download', { timeout: 60000 }), action()]); const f = `${OUT}/${d.suggestedFilename()}`; await d.saveAs(f); return f; };
// 10 ter. camembert : couleur d'une part
{ const n = await p.locator('.fusain-vignette').count();
  for (let i = 0; i < n; i += 1) { if ((await p.locator('.fusain-vignette').nth(i).textContent()).includes('Camembert')) await p.locator('.fusain-vignette').nth(i).click(); }
  await p.waitForTimeout(900); await p.locator('#fusain-feuille [data-fusain="p:1"]').first().click({ force: true }); await p.waitForTimeout(300);
  await p.locator('#fusain-proprietes .fusain-champ:has(label:text-is("Couleur")) select').selectOption('#161616'); await p.waitForTimeout(900);
  const teintes = await p.evaluate(() => [...document.querySelectorAll('#fusain-feuille path.pieCircle')].map((x) => getComputedStyle(x).fill));
  ok('camembert : couleur d\'une part', teintes[1] === 'rgb(22, 22, 22)' && teintes[0] !== teintes[1], teintes.join(' '));
  await p.locator('.fusain-vignette').last().click(); await p.waitForTimeout(900); }
// 10 bis. matrice : glisser un point vers le coin supérieur droit
{ const pt = await p.locator('#fusain-feuille [data-fusain="p:0"] circle').first().boundingBox(); const z = await p.locator('#fusain-feuille .fusain-schema g.quadrants').boundingBox();
  await p.mouse.move(pt.x + pt.width / 2, pt.y + pt.height / 2); await p.mouse.down(); await p.mouse.move(z.x + z.width * 0.6, z.y + z.height * 0.5, { steps: 5 }); await p.mouse.move(z.x + z.width * 0.9, z.y + z.height * 0.1, { steps: 5 }); await p.mouse.up(); await p.waitForTimeout(800);
  const cq = await lireCode(); ok('matrice : point déplacé à la souris', /"Cyberattaque": \[0\.(8[5-9]|9\d?), 0\.(8[5-9]|9\d?)\]/.test(cq), cq.split('\n').find(l => l.includes('Cyberattaque'))); }
// 10 quater. les types ajoutés en 0.6.0 et 0.7.0 : édition visuelle, repérage, et une modification par type
const ajouterModele = async (nom) => {
  await p.click('button:has-text("Visuel")');
  await p.click('button:has-text("Ajouter une page")'); await p.waitForTimeout(500);
  await p.click(`.fusain-modele:has(.fusain-modele__nom:text-is("${nom}"))`); await p.waitForTimeout(1500); };
const champPanneau = (libelle) => p.locator(`#fusain-proprietes .fusain-champ:has(label:text-is("${libelle}")) :is(input, select, textarea)`).first();
for (const [nom, sel, titre, agir, attendu] of [
  ['Parcours usager', '[data-fusain^="i:"]', 'Parcours usager', async () => { await p.locator('#fusain-feuille [data-fusain="i:1"] rect.task').first().click({ force: true }); await p.waitForTimeout(300); await champPanneau('Satisfaction').selectOption('1'); }, /Recherche d'information: 1: Usager/],
  ['Graphique en barres', '[data-fusain^="v:"]', 'Graphique', async () => { const z = p.locator('#fusain-proprietes .fusain-tableau input[aria-label="Barres 1, Mar"]'); await z.fill('123'); await z.press('Tab'); }, /bar \[150, 200, 123, 400, 280, 450\]/],
  ['Diagramme de flux (Sankey)', '[data-fusain^="n:"]', 'Diagramme de flux', async () => { await p.locator('#fusain-feuille [data-fusain="n:3"]').first().click({ force: true }); await p.waitForTimeout(300); await p.click('.fusain-poignee'); }, /Hopitaux,Poste 1,10/],
  ['Modèle de données', '[data-fusain^="a:"]', 'Modèle de données', async () => { await p.locator('#fusain-feuille .fusain-touche[data-fusain="l:0"]').click({ force: true }); await p.waitForTimeout(300); await champPanneau('Côté « DEMANDE »').selectOption('un-plusieurs'); }, /USAGER \|\|--\|\{ DEMANDE : "soumet"/],
  ['Diagramme de classes', '[data-fusain^="m:"]', 'Diagramme de classes', async () => { await p.locator('#fusain-feuille [data-fusain="n:Agent"]').first().click({ force: true, position: { x: 5, y: 5 } }); await p.waitForTimeout(300); await champPanneau('Stéréotype').selectOption('interface'); }, /class Agent \{\n\s+<<interface>>/],
  ['Architecture technique', '[data-fusain^="n:"]', 'Architecture technique', async () => { await p.locator('#fusain-feuille [data-fusain="n:bdd"]').first().click({ force: true }); await p.waitForTimeout(300); await champPanneau('Icône').selectOption('disk'); }, /service bdd\(disk\)\[Base de donnees\] in si/],
  ['Historique de versions', '[data-fusain^="c:"]', 'Historique de versions', async () => { await p.locator('#fusain-feuille [data-fusain="b:developpement"]').first().click({ force: true }); await p.waitForTimeout(300); await p.click('.fusain-poignee'); }, /checkout developpement\n\s+commit id: "c1"/],
  ['Structure de paquet réseau', '[data-fusain^="p:"]', 'Structure de paquet', async () => { await p.locator('#fusain-feuille [data-fusain="p:0"]').first().click({ force: true }); await p.waitForTimeout(300); const z = champPanneau('Taille (bits)'); await z.fill('8'); await z.press('Tab'); }, /0-7: "Version"\n\s+8-11: "IHL"/],
  ['Contexte du système (C4)', '[data-fusain^="n:"]', 'Diagramme de contexte (C4)', async () => { await p.locator('#fusain-feuille [data-fusain="n:portail"]').first().click({ force: true }); await p.waitForTimeout(300); await champPanneau('Nature').selectOption('SystemQueue'); }, /SystemQueue\(portail, "Portail des demandes"/],
  ['Diagramme de blocs', '[data-fusain^="n:"]', 'Diagramme de blocs', async () => { await p.locator('#fusain-feuille [data-fusain="n:accueil"]').first().click({ force: true }); await p.waitForTimeout(300); await p.click('.fusain-poignee'); }, /accueil --> b1/],
  ['Diagramme d\'exigences', '[data-fusain^="n:"]', 'Diagramme d\'exigences', async () => { await p.locator('#fusain-feuille [data-fusain="n:0"]').first().click({ force: true }); await p.waitForTimeout(300); await champPanneau('Risque').selectOption('low'); }, /disponibilite \{\n\s+id: "EX-1"\n.*\n\s+risk: low/],
  ['Diagramme radar', '[data-fusain^="s:"]', 'Diagramme radar', async () => { const z = p.locator('#fusain-proprietes .fusain-tableau input[aria-label="Service A, Sobriété"]'); await z.fill('5'); await z.press('Tab'); }, /curve a\["Service A"\]\{4, 3, 5, 5, 4\}/],
  ['Carte proportionnelle (treemap)', '[data-fusain^="t:"]', 'Carte proportionnelle', async () => { await p.locator('#fusain-feuille [data-fusain="t:0.0.0"]').first().click({ force: true }); await p.waitForTimeout(300); const z = champPanneau('Valeur'); await z.fill('500'); await z.press('Tab'); }, /"Salaires": 500/],
  ['Séquence ZenUML', '[data-fusain^="i:"]', 'Séquence ZenUML', async () => { await p.locator('#fusain-feuille [data-fusain="i:0"] text.message-label').first().click({ force: true }); await p.waitForTimeout(300); await p.click('.fusain-poignee'); }, /Usager->Portail: Dépose sa demande\n\s+Portail->Usager: Réponse/],
]) {
  await ajouterModele(nom);
  await p.waitForFunction((titreAttendu) => document.querySelector('#fusain-proprietes')?.textContent.includes(titreAttendu), titre, { timeout: 15000 }).catch(() => {});
  const n = await p.locator(`#fusain-feuille ${sel}`).count();
  ok(`page ${nom}`, n > 0 && (await p.textContent('#fusain-proprietes')).includes(titre), `${n} éléments repérés`);
  await agir(); await p.waitForTimeout(1200);
  const cn = await lireCode();
  ok(`${nom} : modification visuelle`, attendu.test(cn) && await p.locator('#fusain-erreur .fr-alert').count() === 0, cn.split('\n').slice(1, 4).join(' ; '));
  if (nom === 'Architecture technique') ok('architecture : icônes dessinées', await p.locator('#fusain-feuille .architecture-service svg path').count() >= 3);
  await p.screenshot({ path: `${OUT}/e2e-v6-${nom.split(' ').pop().replace(/\W/g, '').toLowerCase()}.png` });
}
// 10 quinquies. page vierge
{ await p.click('button:has-text("Ajouter une page")'); await p.waitForTimeout(500);
  await p.click('.fusain-modele:has(.fusain-modele__nom:text-is("Page vierge"))'); await p.waitForTimeout(1000);
  const pages = await p.evaluate(async () => (await import('./js/etat.js')).etat.doc.pages.map((x) => x.code));
  ok('page vierge ajoutée', pages.length === 24 && pages[pages.length - 1] === '' && (await p.textContent('#fusain-proprietes')).includes('Page vierge')
    && await p.locator('#fusain-feuille .fusain-schema').count() === 0 && await p.locator('#fusain-erreur .fr-alert').count() === 0);
  await champPanneau('Titre affiché sur la page').fill('Annexes'); await champPanneau('Titre affiché sur la page').press('Tab'); await p.waitForTimeout(700);
  ok('page vierge : titre affiché', (await p.textContent('#fusain-feuille svg.fusain-page')).includes('Annexes')); }
let f = await dl(() => p.click('button:has-text("Enregistrer")')); const json = fs.readFileSync(f, 'utf8'); ok('enregistrement JSON', JSON.parse(json).pages.length === 24, f.split('/').pop());
await p.click('.fusain-barre button:has-text("Exporter")'); await p.waitForTimeout(600);
f = await dl(() => p.click('#fusain-modale-export .fr-modal__footer button')); ok('export PDF', fs.statSync(f).size > 5000, `${f.split('/').pop()} ${fs.statSync(f).size} o`);
await p.waitForTimeout(1500); console.log('   messages:', (await p.textContent('#fusain-messages')).slice(-200));
await p.click('.fusain-barre button:has-text("Exporter")'); await p.waitForTimeout(600);
await p.check('#exp-format-png', { force: true }); await p.check('#exp-portee-page', { force: true });
f = await dl(() => p.click('#fusain-modale-export .fr-modal__footer button')); ok('export PNG', fs.statSync(f).size > 5000, `${f.split('/').pop()} ${fs.statSync(f).size} o`);
// 12. restauration : fichier hostile puis fichier valide
const hostile = JSON.parse(json); hostile.pages[0].inconnu = 1; fs.writeFileSync(OUT + '/hostile.json', JSON.stringify(hostile));
await p.setInputFiles('#fusain-fichier', OUT + '/hostile.json'); await p.waitForTimeout(600);
ok('fichier à champ inconnu refusé', (await p.textContent('#fusain-messages')).includes('Fichier refusé'));
fs.writeFileSync(OUT + '/proto.json', json.replace('"format": "fusain",', '"format": "fusain", "__proto__": {"x":1},'));
await p.setInputFiles('#fusain-fichier', OUT + '/proto.json'); await p.waitForTimeout(600);
ok('fichier __proto__ refusé', (await p.textContent('#fusain-messages')).includes('champs interdits'));
console.log('erreurs console/page :', errs.length, errs.slice(0, 5));
await b.close();
