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
await p.selectOption('#fusain-proprietes select >> nth=1', 'pointille'); await p.waitForTimeout(700);
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
for (const [nom, sel, titre] of [['Diagramme de séquence', '[data-fusain^="i:"]', 'Diagramme de séquence'], ['Carte mentale', '[data-fusain^="r"]', 'Carte mentale'], ['Planning (Gantt)', '[data-fusain^="i:"]', 'Diagramme de Gantt'], ['Camembert', '[data-fusain^="p:"]', 'Camembert'], ['Frise chronologique', '[data-fusain^="e:"]', 'Frise chronologique'], ['Tableau Kanban', '[data-fusain^="k:"]', 'Tableau Kanban'], ['Matrice (quadrants)', '[data-fusain^="p:"]', 'Matrice']]) {
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
// 10 bis. matrice : glisser un point vers le coin supérieur droit
{ const pt = await p.locator('#fusain-feuille [data-fusain="p:0"] circle').first().boundingBox(); const z = await p.locator('#fusain-feuille .fusain-schema g.quadrants').boundingBox();
  await p.mouse.move(pt.x + pt.width / 2, pt.y + pt.height / 2); await p.mouse.down(); await p.mouse.move(z.x + z.width * 0.6, z.y + z.height * 0.5, { steps: 5 }); await p.mouse.move(z.x + z.width * 0.9, z.y + z.height * 0.1, { steps: 5 }); await p.mouse.up(); await p.waitForTimeout(800);
  const cq = await lireCode(); ok('matrice : point déplacé à la souris', /"Cyberattaque": \[0\.(8[5-9]|9\d?), 0\.(8[5-9]|9\d?)\]/.test(cq), cq.split('\n').find(l => l.includes('Cyberattaque'))); }
let f = await dl(() => p.click('button:has-text("Enregistrer")')); const json = fs.readFileSync(f, 'utf8'); ok('enregistrement JSON', JSON.parse(json).pages.length === 8, f.split('/').pop());
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
