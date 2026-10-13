// Montée en charge : temps de rendu, d'édition et d'export sur de gros schémas et de longs documents.
//   PLAYWRIGHT=/chemin/vers/playwright/index.mjs node tests/charge.mjs
const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright');
const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: true });
const p = await (await b.newContext({ viewport: { width: 1500, height: 950 } })).newPage();
p.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 200)));
await p.goto(process.env.FUSAIN_URL || 'http://127.0.0.1:8765/');
await p.waitForSelector('html[data-fusain-pret]');
await p.waitForTimeout(800);

const resultats = await p.evaluate(async () => {
    const rendu = await import('./js/rendu.js');
    const logi = (await import('./js/diagrammes/logigramme.js')).default;
    const exp = await import('./js/export.js');
    const etat = await import('./js/etat.js');
    const sortie = [];
    const chrono = async (nom, f) => { const t = performance.now(); let info = ''; try { info = (await f()) || ''; } catch (e) { info = 'ERREUR ' + String(e.message).slice(0, 80); } sortie.push([nom, Math.round(performance.now() - t), info]); };
    const graphe = (n) => { const l = ['flowchart TD']; for (let i = 0; i < n; i += 1) l.push(`    n${i}["Étape numéro ${i}"]`); for (let i = 1; i < n; i += 1) l.push(`    n${Math.floor((i - 1) / 3)} --> n${i}`); return l.join('\n') + '\n'; };

    for (const n of [50, 200, 400]) {
        const code = graphe(n);
        await chrono(`analyse + réécriture ${n} nœuds`, () => { logi.ecrire(logi.analyser(code)); });
        await chrono(`rendu ${n} nœuds`, async () => { const s = await rendu.rendreSchema(code, 'bleu-france'); return `${Math.round(s.l)}×${Math.round(s.h)}`; });
    }
    await chrono('rendu 600 liens (plafond 500)', async () => { await rendu.rendreSchema(graphe(601), 'bleu-france'); });

    // Document de 30 pages dans l'application
    const doc = etat.nouveauDocument(graphe(40));
    for (let i = 1; i < 30; i += 1) doc.pages.push({ ...etat.nouvellePage(graphe(20 + i), `Page ${i + 1}`), format: i % 2 ? 'A3' : 'A4' });
    await chrono('chargement document 30 pages', async () => { etat.charger(doc); await new Promise((r) => setTimeout(r, 50)); while (document.querySelectorAll('.fusain-vignette').length < 30) await new Promise((r) => setTimeout(r, 50)); });
    await chrono('modification sur document 30 pages', async () => {
        etat.modifier((d) => { d.pages[0].code = graphe(41); });
        const debut = performance.now();
        while (!document.querySelector('#fusain-feuille [data-fusain="n:n40"]') && performance.now() - debut < 20000) await new Promise((r) => setTimeout(r, 20));
    });
    await chrono('idem jusqu\'aux vignettes à jour', async () => { await new Promise((r) => setTimeout(r, 30)); const debut = performance.now(); while (performance.now() - debut < 20000) { await new Promise((r) => setTimeout(r, 50)); if (!window.__fusainOccupe?.()) break; } });

    // Exports (téléchargements neutralisés : seul le temps de calcul est mesuré)
    const clic = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () {};
    const un = etat.nouveauDocument(graphe(200)); un.pages[0].format = 'A3';
    await chrono('PNG A3 300 ppp, 200 nœuds', () => exp.exporterPNG(un, [0], { ppp: 300 }));
    await chrono('PNG A3 600 ppp, 200 nœuds', () => exp.exporterPNG(un, [0], { ppp: 600 }));
    await chrono('PDF 1 page A3, 200 nœuds', async () => JSON.stringify(await exp.exporterPDF(un, [0])));
    const dix = etat.nouveauDocument(graphe(30)); for (let i = 1; i < 10; i += 1) dix.pages.push(etat.nouvellePage(graphe(30 + i), `P${i}`));
    await chrono('PDF 10 pages', async () => JSON.stringify(await exp.exporterPDF(dix, dix.pages.map((_, i) => i))));
    HTMLAnchorElement.prototype.click = clic;
    return sortie;
});
for (const [nom, ms, info] of resultats) console.log(String(ms).padStart(7), 'ms ', nom, info ? `(${info})` : '');
await b.close();
