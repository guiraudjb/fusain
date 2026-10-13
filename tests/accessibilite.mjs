// Contrôle automatique d'accessibilité (règles WCAG 2.1 A et AA automatisables) avec axe-core, outil de test non livré.
//   npm pack axe-core && tar xzf axe-core-*.tgz
//   PLAYWRIGHT=/chemin/vers/playwright/index.mjs node tests/accessibilite.mjs package/axe.min.js
const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright');
import fs from 'node:fs';
const axe = fs.readFileSync(process.argv[2], 'utf8');
const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: true });
const ctx = await b.newContext({ viewport: { width: 1500, height: 950 }, bypassCSP: true });
const p = await ctx.newPage();
await p.goto(process.env.FUSAIN_URL || 'http://127.0.0.1:8765/'); await p.waitForSelector('html[data-fusain-pret]'); await p.waitForTimeout(900);
await p.evaluate(axe);
let total = 0;
const controler = async (etat) => {
  const r = await p.evaluate(async () => { const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] } }); return r.violations.map(v => ({ id: v.id, impact: v.impact, aide: v.help, n: v.nodes.length, ex: v.nodes.slice(0, 3).map(n => n.target.join(' ') + ' :: ' + (n.failureSummary || '').split('\n').slice(1, 2).join(' ').slice(0, 140)) })); });
  total += r.length;
  console.log(`\n== ${etat} : ${r.length} règle(s) en défaut`);
  for (const v of r) { console.log(`  [${v.impact}] ${v.id} (${v.n}) — ${v.aide}`); for (const e of v.ex) console.log('      ', e.slice(0, 230)); }
};
await controler('édition visuelle, rien de sélectionné');
await p.click('#fusain-feuille [data-fusain="n:C"]'); await p.waitForTimeout(300); await controler('étape sélectionnée');
await p.locator('#fusain-feuille .fusain-touche[data-fusain="l:0"]').click({ force: true }); await p.waitForTimeout(300); await controler('lien sélectionné');
await p.click('button:has-text("Code")'); await p.waitForTimeout(500); await controler('mode code');
await p.fill('#fusain-code-zone', 'flowchart LR\n  A -->'); await p.waitForTimeout(1000); await controler('mode code avec erreur');
await p.click('button:has-text("Visuel")'); await p.waitForTimeout(500);
await p.click('.fusain-barre button:has-text("Modèles")'); await p.waitForTimeout(700); await controler('modale des modèles');
await p.keyboard.press('Escape'); await p.waitForTimeout(500);
await p.click('.fusain-barre button:has-text("Exporter")'); await p.waitForTimeout(700); await controler('modale d\'export');
await p.keyboard.press('Escape'); await p.waitForTimeout(500);
await p.click('.fr-header__tools [data-action="apropos"]'); await p.waitForTimeout(700); await controler('modale À propos');
await p.keyboard.press('Escape'); await p.waitForTimeout(500);
await p.click('.fr-header__tools [data-action="theme"]'); await p.mouse.move(700, 500); await p.waitForTimeout(500); await controler('thème sombre');
// Panneaux des éditeurs ajoutés en 0.6.0 (dont le tableau de données du graphique) et page vierge
await p.click('.fr-header__tools [data-action="theme"]'); await p.waitForTimeout(300);
for (const id of ['graphique', 'entites', 'classes', 'versions', 'architecture', 'radar', 'treemap', 'zenuml', 'diapo-blocs', 'diapo-libre']) {
  await p.evaluate(async (id) => { const { MODELES } = await import('./js/modeles.js'); const { charger, nouveauDocument } = await import('./js/etat.js'); charger(nouveauDocument(MODELES.find((m) => m.id === id).code)); }, id);
  await p.waitForTimeout(1300);
  await p.locator('#fusain-proprietes .fusain-plan__element').nth(1).click(); await p.waitForTimeout(400);
  await controler(`éditeur « ${id} », élément sélectionné`);
}
await p.evaluate(async () => { const { charger, nouveauDocument } = await import('./js/etat.js'); charger(nouveauDocument('')); }); await p.waitForTimeout(800);
await controler('page vierge');
console.log('\n' + (total ? 'ECHEC' : 'OK   '), 'règles en défaut sur l\'ensemble des états :', total);
await b.close();
process.exitCode = total ? 1 : 0;
