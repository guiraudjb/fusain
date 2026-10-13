// Recette dans Firefox par le protocole WebDriver (geckodriver), sans dépendance : tout passe par l'interface.
//   geckodriver --port 4444 &   puis   node tests/firefox.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BASE = process.env.WEBDRIVER || 'http://127.0.0.1:4444';
const URL_APP = process.env.FUSAIN_URL || 'http://127.0.0.1:8765/';
const dossier = fs.mkdtempSync(path.join(process.env.FUSAIN_SORTIE || os.tmpdir(), 'fusain-ff-'));
const appel = async (methode, chemin, corps) => {
    const r = await fetch(BASE + chemin, { method: methode, headers: { 'content-type': 'application/json' }, body: corps ? JSON.stringify(corps) : undefined });
    const j = await r.json();
    if (j.value?.error) throw new Error(`${j.value.error} : ${j.value.message}`);
    return j.value;
};
const session = await appel('POST', '/session', { capabilities: { alwaysMatch: { browserName: 'firefox', 'moz:firefoxOptions': { args: ['-headless'], prefs: {
    'browser.download.folderList': 2, 'browser.download.dir': dossier, 'browser.download.useDownloadDir': true, 'browser.download.always_ask_before_handling_new_types': false,
    'browser.helperApps.neverAsk.saveToDisk': 'application/pdf,image/png,image/svg+xml,application/json', 'pdfjs.disabled': true, 'browser.download.alwaysOpenPanel': false,
} } } } });
const s = `/session/${session.sessionId}`;
const js = (script, ...args) => appel('POST', `${s}/execute/sync`, { script, args });
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const attendre = async (script, ms = 20000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await js(script)) return true; await pause(150); } return false; };
// Clic réel aux coordonnées de l'élément (WebDriver ne sait pas cliquer un groupe SVG)
const cliquer = async (css) => {
    const [x, y] = await js('const r = document.querySelector(arguments[0]).getBoundingClientRect(); return [Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2)];', css);
    await appel('POST', `${s}/actions`, { actions: [{ type: 'pointer', id: 'souris', parameters: { pointerType: 'mouse' }, actions: [
        { type: 'pointerMove', duration: 0, x, y }, { type: 'pointerDown', button: 0 }, { type: 'pointerUp', button: 0 }] }] });
};
const fichier = async (motif, ms = 30000) => { const t = Date.now(); while (Date.now() - t < ms) { const f = fs.readdirSync(dossier).find((n) => motif.test(n) && !n.endsWith('.part')); if (f && fs.statSync(path.join(dossier, f)).size > 0) return path.join(dossier, f); await pause(200); } return null; };
let echecs = 0;
const ok = (nom, cond, detail = '') => { if (!cond) echecs += 1; console.log(cond ? 'OK   ' : 'ECHEC', nom, detail); };
try {
    console.log('Firefox', session.capabilities.browserVersion);
    await appel('POST', `${s}/window/rect`, { width: 1500, height: 950 });
    await appel('POST', `${s}/url`, { url: URL_APP });
    ok('application prête', await attendre('return Boolean(document.documentElement.dataset.fusainPret && document.querySelector("#fusain-feuille [data-fusain]"))'));
    ok('police Marianne chargée', await js('return document.fonts.check("16px Marianne")'));
    ok('éléments repérés', (await js('return document.querySelectorAll("#fusain-feuille [data-fusain^=\\"n:\\"]").length')) === 5);

    await cliquer('#fusain-feuille [data-fusain="n:C"]');
    ok('sélection et poignée', await attendre('return Boolean(document.querySelector(".fusain-poignee"))', 3000));
    await cliquer('.fusain-poignee');
    ok('étape liée ajoutée', await attendre('return Boolean(document.querySelector("#fusain-feuille [data-fusain=\\"n:n1\\"]"))', 5000));

    // Une page par modèle : tous les types doivent se rendre
    const noms = ['Diagramme de séquence', 'Carte mentale', 'Planning (Gantt)', 'Camembert', 'Diagramme d\'états', 'Frise chronologique', 'Tableau Kanban', 'Parcours usager', 'Matrice (quadrants)', 'Graphique en barres', 'Diagramme de flux (Sankey)', 'Modèle de données', 'Diagramme de classes', 'Architecture technique', 'Historique de versions', 'Structure de paquet réseau'];
    for (const [i, nom] of noms.entries()) {
        await js('[...document.querySelectorAll("#fusain-pages button")].find((b) => b.textContent.includes("Ajouter une page")).click()');
        await attendre('return Boolean(document.querySelector("#fusain-modale-modeles.fr-modal--opened .fusain-modele"))', 5000);
        await js('[...document.querySelectorAll(".fusain-modele")].find((b) => b.querySelector(".fusain-modele__nom").textContent === arguments[0]).click()', nom);
        const rendu = await attendre(`return document.querySelectorAll(".fusain-vignette").length === ${i + 2} && Boolean(document.querySelector("#fusain-feuille .fusain-schema")) && !document.querySelector("#fusain-erreur .fr-alert")`, 15000);
        ok(`page « ${nom} »`, rendu, rendu ? '' : await js('return document.querySelector("#fusain-erreur").textContent'));
    }

    await js('[...document.querySelectorAll(".fusain-barre button")].find((b) => b.textContent === "Enregistrer").click()');
    const json = await fichier(/\.fusain\.json$/);
    ok('enregistrement JSON', json && JSON.parse(fs.readFileSync(json, 'utf8')).pages.length === noms.length + 1);

    const exporter = async (format) => {
        await js('[...document.querySelectorAll(".fusain-barre button")].find((b) => b.textContent === "Exporter").click()');
        await attendre('return Boolean(document.querySelector("#fusain-modale-export.fr-modal--opened"))', 5000);
        await js('const r = document.getElementById("exp-format-" + arguments[0]); r.checked = true; r.dispatchEvent(new Event("change", { bubbles: true }));', format);
        await js('document.querySelector("#fusain-modale-export .fr-modal__footer button").click()');
    };
    await exporter('pdf');
    const pdf = await fichier(/\.pdf$/, 90000);
    ok('export PDF', pdf && fs.statSync(pdf).size > 20000, pdf ? `${fs.statSync(pdf).size} octets` : '');
    await pause(1500);
    console.log('      ', (await js('return document.getElementById("fusain-messages").textContent')).replace(/Masquer le message/g, ' | ').slice(-260));
    await exporter('png');
    const png = await fichier(/_page-17\.png$/, 90000);
    ok('export PNG (17 pages)', Boolean(png), png ? `${fs.statSync(png).size} octets pour la dernière` : '');
    if (pdf) console.log('PDF conservé :', pdf);
} finally {
    await appel('DELETE', s);
}
process.exit(echecs ? 1 : 0);
