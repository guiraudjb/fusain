// Chemin de mise à jour : un poste ayant l'ancienne version en cache doit voir le bandeau, se mettre à jour et retrouver son travail.
//   Copier le dépôt dans un dossier jetable, le servir sur le port 8766, puis :
//   PLAYWRIGHT=/chemin/vers/playwright/index.mjs node tests/mise-a-jour.mjs /dossier/jetable
const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright');
import { execSync } from 'node:child_process';
import fs from 'node:fs';
const dir = process.argv[2];
const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: true });
const p = await (await b.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
p.on('pageerror', e => console.log('[pageerror]', e.message.slice(0, 200)));
const ok = (n, c, d = '') => console.log(c ? 'OK   ' : 'ECHEC', n, d);
await p.goto('http://127.0.0.1:8766/'); await p.waitForSelector('html[data-fusain-pret]');
await p.evaluate(() => navigator.serviceWorker.ready); await p.waitForTimeout(3000);
// un travail en cours : renommer une étape
await p.dblclick('#fusain-feuille [data-fusain="n:C"]'); await p.fill('.fusain-saisie', 'Travail en cours'); await p.keyboard.press('Enter'); await p.waitForTimeout(1500);
const v1 = await p.evaluate(async () => (await caches.keys()).join(','));
// publication d'une nouvelle version côté serveur
fs.writeFileSync(dir + '/js/version.js', fs.readFileSync(dir + '/js/version.js', 'utf8').replace(/VERSION = '[^']+'/, "VERSION = '9.9.9'"));
execSync('python3 outils/generer.py', { cwd: dir });
await p.reload(); await p.waitForSelector('html[data-fusain-pret]');
const bandeau = await p.waitForSelector('#fusain-bandeau .fr-notice', { timeout: 20000 }).then(() => true).catch(() => false);
ok('bandeau de mise à jour affiché', bandeau, await p.textContent('#fusain-bandeau'));
ok('ancienne version encore active avant acceptation', await p.evaluate(async () => (await import('./js/version.js')).VERSION) !== '9.9.9');
ok('travail repris depuis le brouillon', (await p.textContent('#fusain-proprietes')).includes('Travail en cours'));
if (bandeau) {
  await Promise.all([p.waitForNavigation({ timeout: 20000 }).catch(() => console.log('pas de rechargement')), p.click('#fusain-bandeau button')]);
  await p.waitForSelector('html[data-fusain-pret]'); await p.waitForTimeout(1500);
  const v2 = await p.evaluate(async () => (await caches.keys()).join(','));
  ok('nouveau cache seul présent', v2.includes('9.9.9') && !v2.includes(v1), `${v1} → ${v2}`);
  await p.click('[data-action="apropos"]'); await p.waitForTimeout(800);
  ok('nouvelle version affichée dans « À propos »', (await p.textContent('#fusain-modale-apropos')).includes('FUSAIN 9.9.9'));
  ok('travail toujours présent après la mise à jour', (await p.textContent('#fusain-proprietes')).includes('Travail en cours'));
  ok('bandeau retiré', await p.locator('#fusain-bandeau .fr-notice').count() === 0);
}
// Publication incomplète ou fichier altéré : la nouvelle version ne doit pas s'installer, l'ancienne reste en service
fs.writeFileSync(dir + '/js/version.js', fs.readFileSync(dir + '/js/version.js', 'utf8').replace(/VERSION = '[^']+'/, "VERSION = '9.9.10'"));
execSync('python3 outils/generer.py', { cwd: dir });
fs.appendFileSync(dir + '/js/modeles.js', '\n// fichier altéré après le calcul des empreintes\n');
await p.reload(); await p.waitForSelector('html[data-fusain-pret]'); await p.waitForTimeout(6000);
const apres = await p.evaluate(async () => ({ caches: (await caches.keys()).join(','), version: (await import('./js/version.js')).VERSION, bandeau: document.querySelectorAll('#fusain-bandeau .fr-notice').length }));
ok('version altérée refusée : pas de bandeau, ancien cache conservé, ancienne version en service', apres.bandeau === 0 && apres.caches.includes('9.9.9') && !apres.caches.includes('9.9.10') && apres.version === '9.9.9', JSON.stringify(apres));
await b.close();
