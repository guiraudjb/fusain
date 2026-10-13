// FUSAIN — assemblage de l'interface
import { VERSION, DATE_VERSION } from './version.js';
import { h, s, vider, bouton, champTexte, champSelect, annoncer, message, modale, ouvrirModale, fermerModale, confirmer } from './dom.js';
import { etat, abonner, charger, modifier, allerPage, annuler, retablir, peutAnnuler, peutRetablir, pageCourante, nouveauDocument, nouvellePage, idPage, marquerEnregistre } from './etat.js';
import { FORMATS, MM_PAR_PX, dimensions } from './formats.js';
import { typeDiagramme } from './securite.js';
import { THEMES, rendreSchema, composerPage, decrireErreur } from './rendu.js';
import { serialiser, lireJson, lireFichier, telecharger, nomDocument, PAGES_MAX } from './fichier.js';
import { enregistrerBrouillon, lireBrouillon, effacerDonneesLocales } from './brouillon.js';
import { exporterPDF, exporterPNG, exporterSVG } from './export.js';
import { editeurPour } from './diagrammes/index.js';
import { MODELES, CATEGORIES, MODELE_INITIAL } from './modeles.js';

const $ = (id) => document.getElementById(id);
const zones = {
    barre: $('fusain-barre'), pages: $('fusain-pages'), scene: $('fusain-scene'), feuille: $('fusain-feuille'),
    erreur: $('fusain-erreur'), panneau: $('fusain-proprietes'), code: $('fusain-code'), zoneCode: $('fusain-code-zone'),
    lignes: $('fusain-code-lignes'), etatCode: $('fusain-code-etat'), fichier: $('fusain-fichier'), bandeau: $('fusain-bandeau'),
};

const ui = { mode: 'visuel', zoom: 1, ajuste: true, selection: null, focusTexte: false };
// Vue de la page courante : éditeur visuel et modèle tirés du code, ou motif du passage en « code seul »
let vue = { editeur: null, modele: null, motif: '' };
const derniersRendus = new Map();
let jeton = 0;

function preference(cle, valeur) {
    try {
        if (valeur === undefined) return localStorage.getItem(`fusain-${cle}`);
        localStorage.setItem(`fusain-${cle}`, valeur);
    } catch { /* stockage indisponible */ }
    return null;
}

// ---------- Barre d'outils ----------

const boutons = {};

function construireBarre() {
    const groupe = (...enfants) => h('div', { class: 'fusain-barre__groupe' }, enfants);
    boutons.annuler = bouton('Annuler', { icone: 'arrow-go-back-line', seulIcone: true, titre: 'Annuler (Ctrl+Z)', onclick: annuler });
    boutons.retablir = bouton('Rétablir', { icone: 'arrow-go-forward-line', seulIcone: true, titre: 'Rétablir (Ctrl+Y)', onclick: retablir });
    boutons.zoom = h('span', { class: 'fusain-barre__zoom', 'aria-live': 'off' });
    boutons.visuel = bouton('Visuel', { icone: 'drag-move-2-line', 'aria-pressed': 'true', onclick: () => changerMode('visuel') });
    boutons.code = bouton('Code', { icone: 'code-s-slash-line', 'aria-pressed': 'false', onclick: () => changerMode('code') });
    vider(zones.barre).append(
        groupe(
            bouton('Nouveau', { icone: 'file-add-line', onclick: nouveau }),
            bouton('Ouvrir', { icone: 'upload-line', titre: 'Ouvrir un fichier (Ctrl+O)', onclick: () => zones.fichier.click() }),
            bouton('Enregistrer', { icone: 'save-line', titre: 'Enregistrer en JSON (Ctrl+S)', onclick: enregistrer }),
            bouton('Exporter', { icone: 'download-line', variante: 'secondary', onclick: ouvrirExport })),
        groupe(boutons.annuler, boutons.retablir),
        groupe(
            bouton('Zoom arrière', { icone: 'zoom-out-line', seulIcone: true, onclick: () => zoomer(ui.zoom / 1.2) }),
            boutons.zoom,
            bouton('Zoom avant', { icone: 'zoom-in-line', seulIcone: true, onclick: () => zoomer(ui.zoom * 1.2) }),
            bouton('Ajuster à la fenêtre', { icone: 'fullscreen-line', seulIcone: true, onclick: () => { ui.ajuste = true; dimensionnerFeuille(); } })),
        groupe(h('div', { class: 'fusain-bascule', role: 'group', 'aria-label': 'Mode d\'édition' }, boutons.visuel, boutons.code)),
        groupe(bouton('Modèles', { icone: 'layout-grid-line', onclick: () => ouvrirModeles('remplacer') })));
}

function majBarre() {
    boutons.annuler.disabled = !peutAnnuler();
    boutons.retablir.disabled = !peutRetablir();
    boutons.visuel.setAttribute('aria-pressed', String(ui.mode === 'visuel'));
    boutons.code.setAttribute('aria-pressed', String(ui.mode === 'code'));
    boutons.zoom.textContent = `${Math.round(ui.zoom * 100)} %`;
    document.title = `${etat.modifie ? '• ' : ''}${etat.doc.document.titre} — FUSAIN`;
}

function changerMode(mode) {
    validerCodeEnAttente();
    ui.mode = mode;
    zones.code.hidden = mode !== 'code';
    document.querySelector('.fusain-corps').classList.toggle('fusain-mode-code', mode === 'code');
    rafraichir();
    if (mode === 'code') zones.zoneCode.focus();
}

// ---------- Zoom et dimensions de la feuille ----------

function dimensionnerFeuille() {
    const { l, h: haut } = dimensions(pageCourante());
    if (ui.ajuste) {
        const dispoL = zones.scene.clientWidth - 48;
        const dispoH = zones.scene.clientHeight - 48;
        ui.zoom = Math.max(0.1, Math.min(dispoL / (l / MM_PAR_PX), dispoH / (haut / MM_PAR_PX)));
    }
    zones.feuille.style.width = `${(l / MM_PAR_PX) * ui.zoom}px`;
    zones.feuille.style.height = `${(haut / MM_PAR_PX) * ui.zoom}px`;
    boutons.zoom.textContent = `${Math.round(ui.zoom * 100)} %`;
    placerPoignee();
}

function zoomer(valeur) {
    ui.ajuste = false;
    ui.zoom = Math.max(0.25, Math.min(4, valeur));
    dimensionnerFeuille();
}

// ---------- Rendu général ----------

function analyserPage() {
    const page = pageCourante();
    const editeur = editeurPour(typeDiagramme(page.code));
    vue = { editeur, modele: null, motif: '' };
    if (!editeur) {
        vue.motif = 'L\'édition visuelle n\'est pas encore disponible pour ce type de schéma : il se modifie par le code.';
        return;
    }
    try {
        vue.modele = editeur.analyser(page.code);
    } catch (e) {
        vue.motif = e.message;
    }
    if (ui.selection && !(vue.modele && editeur.elements(vue.modele).some((e) => e.cle === ui.selection))) ui.selection = null;
}

async function rafraichir() {
    const n = ++jeton;
    zones.scene.setAttribute('aria-busy', 'true');
    const page = pageCourante();
    majBarre();
    analyserPage();

    let schema = null;
    let erreur = null;
    try {
        schema = await rendreSchema(page.code, etat.doc.document.theme);
        derniersRendus.set(page.id, schema);
    } catch (e) {
        erreur = decrireErreur(e);
        schema = derniersRendus.get(page.id) || null; // le dernier rendu valide reste affiché
    }
    if (n !== jeton) return;

    zones.scene.removeAttribute('aria-busy');
    afficherFeuille(page, schema, erreur);
    afficherCode(erreur);
    afficherPanneau();
    afficherPages(n);
}

function afficherFeuille(page, schema, erreur) {
    const visuel = ui.mode === 'visuel' && vue.modele && !erreur;
    const { svg, pointsTexte, deborde } = composerPage(page, schema, { index: etat.index, total: etat.doc.pages.length, guides: true });
    vue.pointsTexte = pointsTexte;
    vue.deborde = deborde;
    svg.setAttribute('tabindex', '0');
    svg.setAttribute('role', visuel ? 'group' : 'img');
    svg.setAttribute('aria-label', visuel
        ? `Schéma de la page ${page.nom}. Flèches pour parcourir les éléments, Entrée pour renommer, Suppr pour supprimer, Inser pour ajouter un élément lié.`
        : `Aperçu de la page ${page.nom}`);
    if (visuel) svg.querySelector('title')?.remove(); // en édition, le titre natif s'afficherait en infobulle sur tout le schéma
    const interne = svg.querySelector('.fusain-schema');
    if (visuel && interne) vue.editeur.reperer(interne, vue.modele);
    zones.feuille.classList.toggle('fusain-visuel', Boolean(visuel));
    const avaitFocus = zones.feuille.contains(document.activeElement) && document.activeElement.localName === 'svg';
    zones.feuille.replaceChildren(svg, s('svg', { class: 'fusain-calque', 'aria-hidden': 'true' }));
    if (avaitFocus) svg.focus({ preventScroll: true });
    dimensionnerFeuille();
    majSelection();

    vider(zones.erreur);
    zones.erreur.hidden = !erreur;
    if (erreur) {
        zones.erreur.append(h('div', { class: 'fr-alert fr-alert--error fr-alert--sm' },
            h('h2', { class: 'fr-alert__title' }, erreur.ligne ? `Erreur dans le code, vers la ligne ${Math.min(erreur.ligne, page.code.split('\n').length)}` : 'Erreur dans le code'),
            h('p', {}, erreur.texte.split('\n').flatMap((l, i) => (i ? [h('br'), l] : [l]))),
            ui.mode !== 'code' ? h('p', {}, bouton('Corriger dans le code', { variante: 'secondary', onclick: () => changerMode('code') })) : null));
    }
}

// ---------- Sélection et manipulation directe ----------

function elementsMarques(cle) {
    return [...zones.feuille.querySelectorAll(`[data-fusain="${CSS.escape(cle)}"]`)].filter((el) => !el.classList.contains('fusain-touche'));
}

function majSelection() {
    for (const el of zones.feuille.querySelectorAll('.fusain-sel')) el.classList.remove('fusain-sel');
    if (ui.selection) for (const el of elementsMarques(ui.selection)) el.classList.add('fusain-sel');
    placerPoignee();
}

function selectionner(cle, { panneau = true } = {}) {
    ui.selection = cle;
    majSelection();
    if (panneau) afficherPanneau();
    if (cle && vue.modele) {
        const nom = vue.editeur.elements(vue.modele).find((e) => e.cle === cle)?.nom;
        if (nom) annoncer(`Sélection : ${nom}`);
    }
}

function rectangleRelatif(cle) {
    const el = elementsMarques(cle)[0];
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const f = zones.feuille.getBoundingClientRect();
    return { x: r.left - f.left, y: r.top - f.top, l: r.width, h: r.height };
}

function placerPoignee() {
    zones.feuille.querySelector('.fusain-poignee')?.remove();
    const { editeur, modele } = vue;
    if (ui.mode !== 'visuel' || !modele || !ui.selection || !editeur.relier || !editeur.peutRelier(ui.selection)) return;
    const r = rectangleRelatif(ui.selection);
    if (!r) return;
    const poignee = h('button', { type: 'button', class: 'fusain-poignee', title: 'Cliquer pour ajouter un élément lié, ou glisser vers un autre élément pour les relier', 'aria-label': 'Ajouter un élément lié' }, '+');
    poignee.style.left = `${r.x + r.l - 8}px`;
    poignee.style.top = `${r.y + r.h / 2 - 14}px`;
    zones.feuille.append(poignee);

    let glisse = null;
    const ligne = () => zones.feuille.querySelector('.fusain-calque');
    poignee.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        poignee.setPointerCapture(e.pointerId);
        glisse = { x: e.clientX, y: e.clientY, bouge: false };
    });
    poignee.addEventListener('pointermove', (e) => {
        if (!glisse) return;
        if (Math.hypot(e.clientX - glisse.x, e.clientY - glisse.y) > 6) glisse.bouge = true;
        if (!glisse.bouge) return;
        const f = zones.feuille.getBoundingClientRect();
        ligne().replaceChildren(s('line', { x1: r.x + r.l / 2, y1: r.y + r.h / 2, x2: e.clientX - f.left, y2: e.clientY - f.top }));
    });
    poignee.addEventListener('pointerup', (e) => {
        if (!glisse) return;
        const { bouge } = glisse;
        glisse = null;
        ligne().replaceChildren();
        let cible = null;
        if (bouge) {
            const sous = document.elementFromPoint(e.clientX, e.clientY);
            if (!sous || !zones.feuille.contains(sous)) return; // lâché hors de la feuille : abandon
            cible = sous.closest('[data-fusain]')?.getAttribute('data-fusain') || null;
            if (cible === ui.selection) return;
        }
        relierDepuisSelection(cible);
    });
    poignee.addEventListener('pointercancel', () => { glisse = null; ligne().replaceChildren(); });
    poignee.addEventListener('click', (e) => { if (e.detail === 0) relierDepuisSelection(null); }); // activation au clavier
}

function relierDepuisSelection(cible) {
    const depart = ui.selection;
    let resultat;
    appliquer((m) => { resultat = vue.editeur.relier(m, depart, cible); }, () => resultat || depart);
    if (resultat && !cible) ui.focusTexte = true;
}

// Toute modification visuelle : le modèle est modifié, réécrit en code, et le code devient le nouvel état
function appliquer(fonction, suite) {
    const { editeur, modele } = vue;
    if (!modele) return;
    fonction(modele);
    if (suite) ui.selection = suite(modele);
    const code = editeur.ecrire(modele);
    modifier((doc) => { doc.pages[etat.index].code = code; });
}

function renommerSurPlace(cle) {
    const { editeur, modele } = vue;
    const valeur = modele && editeur.texte(modele, cle);
    const r = rectangleRelatif(cle);
    if (valeur === null || valeur === undefined || !r) return;
    zones.feuille.querySelector('.fusain-saisie')?.remove();
    const saisie = h('input', { type: 'text', class: 'fusain-saisie', value: valeur.replace(/\n/g, ' '), 'aria-label': 'Texte de l\'élément' });
    const largeur = Math.max(r.l, 160);
    saisie.style.left = `${r.x + r.l / 2 - largeur / 2}px`;
    saisie.style.top = `${r.y + r.h / 2 - 18}px`;
    saisie.style.width = `${largeur}px`;
    let termine = false;
    const finir = (valider) => {
        if (termine) return;
        termine = true;
        const texte = saisie.value;
        saisie.remove();
        if (valider && texte !== valeur.replace(/\n/g, ' ')) appliquer((m) => editeur.renommer(m, cle, texte));
        zones.feuille.querySelector('svg.fusain-page')?.focus({ preventScroll: true });
    };
    saisie.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') finir(true);
        if (e.key === 'Escape') finir(false);
    });
    saisie.addEventListener('blur', () => finir(true));
    zones.feuille.append(saisie);
    saisie.focus();
    saisie.select();
}

// Glisser un élément à position libre (points d'une matrice) : la nouvelle position est lue dans la zone de référence
function brancherDeplacement() {
    let glisse = null;
    zones.feuille.addEventListener('pointerdown', (e) => {
        const { editeur, modele } = vue;
        const marque = e.target.closest?.('[data-fusain]');
        if (ui.mode !== 'visuel' || !modele || !editeur.deplacer || !marque || e.button !== 0) return;
        const zone = editeur.zoneDeplacement(zones.feuille.querySelector('.fusain-schema'));
        if (!zone) return;
        glisse = { cle: marque.getAttribute('data-fusain'), x: e.clientX, y: e.clientY, bouge: false, zone: zone.getBoundingClientRect() };
    });
    window.addEventListener('pointermove', (e) => {
        if (!glisse) return;
        if (Math.hypot(e.clientX - glisse.x, e.clientY - glisse.y) > 5) glisse.bouge = true;
        if (!glisse.bouge) return;
        const f = zones.feuille.getBoundingClientRect();
        const x = Math.max(glisse.zone.left, Math.min(glisse.zone.right, e.clientX)) - f.left;
        const y = Math.max(glisse.zone.top, Math.min(glisse.zone.bottom, e.clientY)) - f.top;
        zones.feuille.querySelector('.fusain-calque')?.replaceChildren(s('circle', { cx: x, cy: y, r: 7, fill: '#e4794a', 'fill-opacity': 0.7, stroke: '#fff', 'stroke-width': 2 }));
    });
    window.addEventListener('pointerup', (e) => {
        if (!glisse) return;
        const { cle, bouge, zone } = glisse;
        glisse = null;
        zones.feuille.querySelector('.fusain-calque')?.replaceChildren();
        if (!bouge || !vue.modele || !vue.editeur.deplacer) return;
        const x = (e.clientX - zone.left) / zone.width;
        const y = 1 - (e.clientY - zone.top) / zone.height;
        appliquer((m) => vue.editeur.deplacer(m, cle, x, y), () => cle);
    });
}

function brancherFeuille() {
    zones.feuille.addEventListener('click', (e) => {
        if (ui.mode !== 'visuel' || !vue.modele || e.target.closest('.fusain-poignee, .fusain-saisie')) return;
        selectionner(e.target.closest('[data-fusain]')?.getAttribute('data-fusain') || null);
    });
    zones.feuille.addEventListener('dblclick', (e) => {
        const cle = e.target.closest('[data-fusain]')?.getAttribute('data-fusain');
        if (ui.mode === 'visuel' && vue.modele && cle) { selectionner(cle); renommerSurPlace(cle); }
    });
    zones.feuille.addEventListener('keydown', (e) => {
        if (ui.mode !== 'visuel' || !vue.modele || e.target.localName !== 'svg') return;
        const liste = vue.editeur.elements(vue.modele);
        const i = liste.findIndex((el) => el.cle === ui.selection);
        const aller = (delta) => { if (liste.length) selectionner(liste[(i + delta + liste.length) % liste.length].cle); };
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); aller(i < 0 ? 1 : 1); }
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); aller(i < 0 ? 0 : -1); }
        else if (e.key === 'Escape') selectionner(null);
        else if (!ui.selection) return;
        else if (e.key === 'Enter' || e.key === 'F2') { e.preventDefault(); renommerSurPlace(ui.selection); }
        else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); const cle = ui.selection; appliquer((m) => vue.editeur.supprimer(m, cle), () => null); }
        else if ((e.key === 'Insert' || e.key === '+') && vue.editeur.relier && vue.editeur.peutRelier(ui.selection)) { e.preventDefault(); relierDepuisSelection(null); }
    });
}

// ---------- Mode code ----------

let attenteCode = null;

function validerCodeEnAttente() {
    if (attenteCode === null) return;
    clearTimeout(attenteCode);
    attenteCode = null;
    const code = zones.zoneCode.value;
    if (code !== pageCourante().code) modifier((doc) => { doc.pages[etat.index].code = code; }, { fusion: `code-${pageCourante().id}` });
}

function numeroterLignes(ligneErreur) {
    const total = zones.zoneCode.value.split('\n').length;
    vider(zones.lignes);
    for (let i = 1; i <= total; i += 1) zones.lignes.append(h('div', { class: i === ligneErreur ? 'fusain-ligne-erreur' : null }, i));
    zones.lignes.scrollTop = zones.zoneCode.scrollTop;
}

function afficherCode(erreur) {
    if (ui.mode !== 'code') return;
    const page = pageCourante();
    if (attenteCode === null && zones.zoneCode.value !== page.code) zones.zoneCode.value = page.code;
    numeroterLignes(erreur?.ligne || null);
    const disponible = Boolean(vue.modele);
    zones.etatCode.className = `fr-badge fr-badge--sm fr-badge--${disponible ? 'success' : 'info'}`;
    zones.etatCode.textContent = disponible ? 'Édition visuelle disponible' : 'Code seul';
    zones.etatCode.title = disponible ? '' : vue.motif;
}

function brancherCode() {
    zones.zoneCode.addEventListener('input', () => {
        clearTimeout(attenteCode);
        attenteCode = setTimeout(validerCodeEnAttente, 300);
        numeroterLignes(null);
    });
    zones.zoneCode.addEventListener('scroll', () => { zones.lignes.scrollTop = zones.zoneCode.scrollTop; });
    zones.zoneCode.addEventListener('keydown', (e) => {
        if (e.key !== 'Tab' || e.shiftKey || e.ctrlKey || e.altKey) return;
        // Tab indente ; Échap puis Tab permet de quitter la zone au clavier
        if (zones.zoneCode.dataset.sortie) { delete zones.zoneCode.dataset.sortie; return; }
        e.preventDefault();
        zones.zoneCode.setRangeText('    ', zones.zoneCode.selectionStart, zones.zoneCode.selectionEnd, 'end');
        zones.zoneCode.dispatchEvent(new Event('input'));
    });
    zones.zoneCode.addEventListener('keyup', (e) => { if (e.key === 'Escape') zones.zoneCode.dataset.sortie = '1'; });
}

// ---------- Panneau de propriétés ----------

function majPage(fonction, options) {
    modifier((doc) => fonction(doc.pages[etat.index], doc), options);
}

function blocPage() {
    const page = pageCourante();
    const total = etat.doc.pages.length;
    const a = page.ajustement;
    const alertes = [];
    if (vue.pointsTexte !== null && vue.pointsTexte < 8) {
        alertes.push(h('div', { class: 'fr-alert fr-alert--warning fr-alert--sm' }, h('p', {},
            `Le texte fera environ ${vue.pointsTexte.toFixed(1)} points à l'impression : il sera difficile à lire. Passez en A3, changez d'orientation ou simplifiez le schéma.`)));
    }
    if (vue.deborde) alertes.push(h('div', { class: 'fr-alert fr-alert--warning fr-alert--sm' }, h('p', {}, 'Le schéma dépasse de la zone utile : la partie hors marges est coupée.')));

    return h('div', { class: 'fusain-bloc' },
        h('h2', {}, `Page ${etat.index + 1} sur ${total}`),
        alertes,
        champTexte('Nom de la page', page.nom, (v) => majPage((p) => { p.nom = v.trim().slice(0, 100) || p.nom; })),
        h('div', { class: 'fusain-ligne' },
            champSelect('Format', Object.keys(FORMATS).map((f) => [f, f]), page.format, (v) => majPage((p) => { p.format = v; })),
            champSelect('Orientation', [['portrait', 'Portrait'], ['paysage', 'Paysage']], page.orientation, (v) => majPage((p) => { p.orientation = v; }))),
        champTexte('Titre affiché sur la page', page.titre, (v) => majPage((p) => { p.titre = v.trim().slice(0, 200); })),
        champTexte('Sous-titre', page.sousTitre, (v) => majPage((p) => { p.sousTitre = v.trim().slice(0, 200); })),
        champTexte('Pied de page', page.piedDePage, (v) => majPage((p) => { p.piedDePage = v.trim().slice(0, 200); }), { placeholder: 'Service — page {n}/{total} — {date}' }),
        h('div', { class: 'fusain-ligne' },
            champSelect('Taille du schéma', [['page', 'Ajuster à la page'], ['largeur', 'Toute la largeur'], ['hauteur', 'Toute la hauteur'], ['manuel', 'Échelle manuelle']], a.mode, (v) => majPage((p) => { p.ajustement.mode = v; })),
            a.mode === 'manuel' ? champTexte('Échelle (%)', a.echelle, (v) => majPage((p) => { p.ajustement.echelle = Math.max(10, Math.min(400, Number(v) || 100)); }), { type: 'number', min: 10, max: 400, step: 5 }) : null),
        h('div', { class: 'fusain-ligne' },
            champSelect('Position verticale', [['haut', 'En haut'], ['centre', 'Au centre'], ['bas', 'En bas']], a.alignement, (v) => majPage((p) => { p.ajustement.alignement = v; })),
            champTexte('Marges (mm)', page.margesMm, (v) => majPage((p) => { p.margesMm = Math.max(0, Math.min(50, Number(v) || 0)); }), { type: 'number', min: 0, max: 50, step: 1 })),
        champTexte('Description du schéma (lecteurs d\'écran, export SVG)', page.description, (v) => majPage((p) => { p.description = v.trim().slice(0, 1000); }), { multiligne: true, placeholder: 'Ce que montre le schéma, en une ou deux phrases' }),
        h('div', { class: 'fusain-actions' },
            bouton('Monter la page', { icone: 'arrow-up-line', seulIcone: true, disabled: etat.index === 0, onclick: () => deplacerPage(-1) }),
            bouton('Descendre la page', { icone: 'arrow-down-line', seulIcone: true, disabled: etat.index === total - 1, onclick: () => deplacerPage(1) }),
            bouton('Dupliquer', { icone: 'stack-line', onclick: dupliquerPage }),
            bouton('Supprimer', { icone: 'delete-bin-line', disabled: total === 1, onclick: supprimerPage })));
}

function blocDocument() {
    const d = etat.doc.document;
    return h('div', { class: 'fusain-bloc' },
        h('h2', {}, 'Document'),
        champTexte('Titre du document', d.titre, (v) => modifier((doc) => { doc.document.titre = v.trim().slice(0, 200) || doc.document.titre; })),
        champSelect('Thème des schémas', Object.entries(THEMES).map(([id, t]) => [id, t.nom]), d.theme, (v) => modifier((doc) => { doc.document.theme = v; })));
}

function afficherPanneau() {
    // Le panneau est reconstruit à chaque changement : le champ actif est retrouvé par son rang
    const focusables = 'input, select, textarea, button';
    const rang = [...zones.panneau.querySelectorAll(focusables)].indexOf(document.activeElement);
    const defilement = zones.panneau.scrollTop;
    const blocs = [];
    if (ui.mode === 'visuel') {
        if (vue.modele) {
            blocs.push(...vue.editeur.panneau({ modele: vue.modele, selection: ui.selection, appliquer, selectionner }));
        } else {
            blocs.push(h('div', { class: 'fusain-bloc' },
                h('h2', {}, 'Page en « code seul »'),
                h('p', { class: 'fr-text--sm' }, vue.motif),
                bouton('Modifier le code', { icone: 'code-s-slash-line', variante: 'secondary', onclick: () => changerMode('code') })));
        }
    }
    blocs.push(blocPage(), blocDocument());
    zones.panneau.replaceChildren(...blocs);
    zones.panneau.scrollTop = defilement;
    if (ui.focusTexte) {
        ui.focusTexte = false;
        const champ = $('fusain-champ-texte');
        if (champ) { champ.focus(); champ.select(); return; }
    }
    if (rang >= 0) zones.panneau.querySelectorAll(focusables)[rang]?.focus({ preventScroll: true });
}

// ---------- Pages ----------

function deplacerPage(delta) {
    const cible = etat.index + delta;
    modifier((doc) => { const [p] = doc.pages.splice(etat.index, 1); doc.pages.splice(cible, 0, p); etat.index = cible; });
}

function dupliquerPage() {
    if (etat.doc.pages.length >= PAGES_MAX) return message('Nombre maximal de pages atteint', '', 'warning');
    modifier((doc) => {
        const copie = JSON.parse(JSON.stringify(doc.pages[etat.index]));
        copie.id = idPage();
        copie.nom = `${copie.nom} (copie)`.slice(0, 100);
        doc.pages.splice(etat.index + 1, 0, copie);
        etat.index += 1;
    });
}

async function supprimerPage() {
    const page = pageCourante();
    if (!await confirmer('Supprimer la page', `La page « ${page.nom} » sera retirée du document. Cette action peut être annulée avec Ctrl+Z.`, 'Supprimer')) return;
    modifier((doc) => { doc.pages.splice(etat.index, 1); etat.index = Math.max(0, etat.index - 1); });
    derniersRendus.delete(page.id);
}

function ajouterPage(code, nom) {
    if (etat.doc.pages.length >= PAGES_MAX) return message('Nombre maximal de pages atteint', '', 'warning');
    ui.selection = null;
    modifier((doc) => {
        const modele = pageCourante();
        const page = nouvellePage(code, nom || `Page ${doc.pages.length + 1}`);
        page.format = modele.format;
        page.orientation = modele.orientation;
        page.margesMm = modele.margesMm;
        doc.pages.splice(etat.index + 1, 0, page);
        etat.index += 1;
    });
}

async function afficherPages(n) {
    const total = etat.doc.pages.length;
    const liste = h('ol', { class: 'fusain-vignettes' });
    for (const [i, page] of etat.doc.pages.entries()) {
        let schema = null;
        try { schema = await rendreSchema(page.code, etat.doc.document.theme); } catch { schema = derniersRendus.get(page.id) || null; }
        if (n !== jeton) return;
        const { svg } = composerPage(page, schema, { index: i, total });
        svg.setAttribute('aria-hidden', 'true');
        liste.append(h('li', {}, h('button', { type: 'button', class: 'fusain-vignette', 'aria-current': String(i === etat.index), onclick: () => { validerCodeEnAttente(); ui.selection = null; allerPage(i); } },
            h('span', { class: 'fusain-vignette__image' }, svg),
            h('span', { class: 'fusain-vignette__nom' }, `${i + 1}. ${page.nom}`))));
    }
    const actif = zones.pages.contains(document.activeElement) ? [...zones.pages.querySelectorAll('button')].indexOf(document.activeElement) : -1;
    zones.pages.replaceChildren(liste, bouton('Ajouter une page', { icone: 'add-line', variante: 'secondary', onclick: () => ouvrirModeles('ajouter') }));
    if (actif >= 0) zones.pages.querySelectorAll('button')[actif]?.focus({ preventScroll: true });
    zones.pages.querySelector('.fusain-vignette[aria-current="true"]')?.scrollIntoView({ block: 'nearest' });
}

// ---------- Modèles ----------

function ouvrirModeles(action) {
    const contenu = h('div', {},
        h('p', { class: 'fr-text--sm' }, action === 'ajouter'
            ? 'Choisissez le schéma de départ de la nouvelle page.'
            : 'Le schéma de la page courante sera remplacé par le modèle choisi (annulable avec Ctrl+Z).'),
        CATEGORIES.map(([id, nom]) => [
            h('h2', { class: 'fr-h6 fr-mb-1w' }, nom),
            h('div', { class: 'fusain-modeles' }, MODELES.filter((m) => m.categorie === id).map((m) => h('button', { type: 'button', class: 'fusain-modele', onclick: () => {
                fermerModale(dialogue);
                if (action === 'ajouter') ajouterPage(m.code, m.nom);
                else { ui.selection = null; majPage((p) => { p.code = m.code; }); }
            } },
            h('span', { class: 'fusain-modele__nom' }, m.nom),
            h('span', { class: `fr-badge fr-badge--sm fr-badge--no-icon fr-badge--${editeurPour(typeDiagramme(m.code)) ? 'success' : 'info'}` }, editeurPour(typeDiagramme(m.code)) ? 'Édition visuelle' : 'Par le code')))),
        ]));
    const dialogue = modale('fusain-modale-modeles', action === 'ajouter' ? 'Nouvelle page' : 'Modèles de schémas', contenu);
    ouvrirModale(dialogue);
}

// ---------- Fichiers ----------

async function nouveau() {
    if (etat.modifie && !await confirmer('Nouveau document', 'Les modifications non enregistrées dans un fichier seront perdues.', 'Créer un nouveau document')) return;
    ui.selection = null;
    derniersRendus.clear();
    charger(nouveauDocument(MODELE_INITIAL.code));
}

function enregistrer() {
    validerCodeEnAttente();
    telecharger(new Blob([serialiser(etat.doc)], { type: 'application/json' }), `${nomDocument(etat.doc)}.fusain.json`);
    marquerEnregistre();
    message('Document enregistré', 'Le fichier JSON a été remis à votre navigateur.', 'success', 4000);
}

async function ouvrir(fichier) {
    if (!fichier) return;
    try {
        const texte = await lireFichier(fichier);
        if (/\.(mmd|mermaid|txt)$/i.test(fichier.name)) {
            ajouterPage(texte.slice(0, 50000), fichier.name.replace(/\.[^.]+$/, '').slice(0, 100));
            message('Code importé', 'Le schéma a été ajouté dans une nouvelle page.', 'success', 4000);
            return;
        }
        const doc = lireJson(texte);
        if (etat.modifie && !await confirmer('Ouvrir un document', 'Les modifications non enregistrées dans un fichier seront perdues.', 'Ouvrir')) return;
        ui.selection = null;
        derniersRendus.clear();
        charger(doc);
        message('Document ouvert', doc.document.titre, 'success', 4000);
    } catch (e) {
        // Un fichier invalide est refusé en totalité, jamais restauré partiellement (§5.9)
        message('Fichier refusé', e.message, 'error', 12000);
    }
}

// ---------- Export ----------

function ouvrirExport() {
    validerCodeEnAttente();
    const radio = (nom, valeur, libelle, coche) => {
        const id = `exp-${nom}-${valeur}`;
        return h('div', { class: 'fr-fieldset__element fr-fieldset__element--inline' }, h('div', { class: 'fr-radio-group fr-radio-group--sm' },
            h('input', { type: 'radio', id, name: nom, value: valeur, checked: coche }), h('label', { class: 'fr-label', for: id }, libelle)));
    };
    const groupe = (legende, ...enfants) => h('fieldset', { class: 'fr-fieldset' }, h('legend', { class: 'fr-fieldset__legend fr-text--regular' }, legende), enfants);
    const coche = (id, libelle) => h('div', { class: 'fr-fieldset__element' }, h('div', { class: 'fr-checkbox-group fr-checkbox-group--sm' }, h('input', { type: 'checkbox', id }), h('label', { class: 'fr-label', for: id }, libelle)));
    const resolution = h('select', { class: 'fr-select', id: 'exp-ppp' }, [[150, '150 ppp (écran)'], [300, '300 ppp (impression)'], [600, '600 ppp (haute définition)']].map(([v, n]) => h('option', { value: v, selected: v === 300 }, n)));
    const optionsImage = h('div', { id: 'exp-options-image', hidden: true },
        h('div', { class: 'fusain-champ' }, h('label', { class: 'fr-label', for: 'exp-ppp' }, 'Résolution (PNG)'), resolution),
        coche('exp-transparent', 'Fond transparent (PNG)'),
        coche('exp-schema', 'Schéma seul, sans la page'));
    const formulaire = h('form', {},
        groupe('Format', radio('format', 'pdf', 'PDF (vectoriel)', true), radio('format', 'png', 'PNG (image)'), radio('format', 'svg', 'SVG (vectoriel)')),
        groupe('Pages', radio('portee', 'tout', `Tout le document (${etat.doc.pages.length} page${etat.doc.pages.length > 1 ? 's' : ''})`, true), radio('portee', 'page', 'Page courante')),
        optionsImage);
    formulaire.addEventListener('change', () => { optionsImage.hidden = formulaire.elements.format.value === 'pdf'; });
    formulaire.addEventListener('submit', (e) => e.preventDefault());

    const lancer = bouton('Exporter', { variante: 'primary', taille: 'md', icone: 'download-line', onclick: async () => {
        const format = formulaire.elements.format.value;
        const indices = formulaire.elements.portee.value === 'page' ? [etat.index] : etat.doc.pages.map((_, i) => i);
        const options = { ppp: Number(resolution.value), transparent: $('exp-transparent').checked, schemaSeul: $('exp-schema').checked };
        lancer.disabled = true;
        try {
            if (format === 'pdf') {
                const { pages, enImage } = await exporterPDF(etat.doc, indices);
                message('Export PDF terminé', enImage.length
                    ? `${pages} page(s). Insérée(s) en image à 300 ppp faute de conversion vectorielle fidèle : ${enImage.join(', ')}.`
                    : `${pages} page(s), vectoriel.`, enImage.length ? 'warning' : 'success', 8000);
            } else {
                const n = await (format === 'png' ? exporterPNG : exporterSVG)(etat.doc, indices, options);
                message(`Export ${format.toUpperCase()} terminé`, `${n} fichier(s).`, 'success', 5000);
            }
            fermerModale(dialogue);
        } catch (e) {
            message('Export impossible', e.message, 'error', 12000);
        } finally {
            lancer.disabled = false;
        }
    } });
    const dialogue = modale('fusain-modale-export', 'Exporter', formulaire, [lancer]);
    ouvrirModale(dialogue);
}

// ---------- À propos ----------

function ouvrirAPropos() {
    const lien = (href, texte) => h('a', { class: 'fr-link', href, target: '_blank', rel: 'noopener noreferrer' }, texte);
    const raccourcis = [
        ['Ctrl+Z / Ctrl+Y', 'Annuler / rétablir'], ['Ctrl+S', 'Enregistrer en JSON'], ['Ctrl+O', 'Ouvrir un fichier'],
        ['Flèches', 'Parcourir les éléments du schéma'], ['Entrée ou F2', 'Renommer l\'élément sélectionné'],
        ['Suppr', 'Supprimer l\'élément sélectionné'], ['Inser ou +', 'Ajouter un élément lié'], ['Échap puis Tab', 'Quitter l\'éditeur de code au clavier'],
    ];
    const contenu = h('div', {},
        h('p', {}, h('strong', {}, `FUSAIN ${VERSION}`), ` — version du ${new Date(DATE_VERSION).toLocaleDateString('fr-FR')}`),
        h('p', { class: 'fr-text--sm' }, 'Fabrique Universelle de Schémas Accessibles, Intuitifs et Normés. Tous les traitements (rendu, mise en page, export, sauvegarde) s\'exécutent dans votre navigateur : aucun schéma, aucun texte ne quitte votre poste.'),
        h('h2', { class: 'fr-h6' }, 'Documentation'),
        h('ul', {},
            h('li', {}, lien('./Documentation/GUIDE_UTILISATEUR.md', 'Guide utilisateur')),
            h('li', {}, lien('./FUSAIN_cahier_des_charges.md', 'Cahier des charges')),
            h('li', {}, lien('./NOMENCLATURE_LOGICIELLE_FUSAIN.md', 'Nomenclature logicielle (SBOM)'), ' — ', lien('./sbom/fusain-sbom-cyclonedx.json', 'format CycloneDX'))),
        h('h2', { class: 'fr-h6' }, 'Raccourcis clavier'),
        h('div', { class: 'fr-table fr-table--sm' }, h('table', {}, h('tbody', {}, raccourcis.map(([touche, effet]) => h('tr', {}, h('td', {}, h('kbd', {}, touche)), h('td', {}, effet)))))),
        h('h2', { class: 'fr-h6' }, 'Données locales'),
        h('p', { class: 'fr-text--sm' }, 'Le brouillon et vos préférences sont conservés dans ce navigateur uniquement. Le brouillon n\'est pas une sauvegarde : enregistrez un fichier JSON pour conserver votre travail.'),
        bouton('Effacer les données locales', { variante: 'secondary', icone: 'delete-bin-line', onclick: async () => {
            await effacerDonneesLocales();
            message('Données locales effacées', 'Le brouillon et les préférences ont été supprimés de ce navigateur.', 'success');
        } }));
    ouvrirModale(modale('fusain-modale-apropos', 'À propos de FUSAIN', contenu));
}

// ---------- Thème de l'interface ----------

function appliquerTheme(sombre) {
    document.documentElement.setAttribute('data-fr-scheme', sombre ? 'dark' : 'light');
    document.documentElement.setAttribute('data-fr-theme', sombre ? 'dark' : 'light');
    // Le DSFR recopie les boutons de l'en-tête dans le menu mobile : tous les exemplaires sont mis à jour
    for (const b of document.querySelectorAll('[data-action="theme"]')) {
        b.textContent = sombre ? 'Thème clair' : 'Thème sombre';
        b.classList.toggle('fr-icon-sun-line', sombre);
        b.classList.toggle('fr-icon-moon-line', !sombre);
    }
    preference('theme', sombre ? 'sombre' : 'clair');
}

// ---------- Service worker ----------

function brancherServiceWorker() {
    if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
    const proposer = (attente) => {
        vider(zones.bandeau).append(h('div', { class: 'fr-notice fr-notice--info' }, h('div', { class: 'fr-container' }, h('div', { class: 'fr-notice__body' },
            h('p', { class: 'fr-notice__title' }, 'Une nouvelle version de FUSAIN est disponible.'),
            bouton('Mettre à jour', { variante: 'secondary', onclick: () => {
                validerCodeEnAttente();
                miseAJourDemandee = true;
                sortieAutorisee = true; // le brouillon est enregistré juste avant le rechargement
                enregistrerBrouillon(serialiser(etat.doc)).then(() => attente.postMessage('activer'));
            } })))));
    };
    navigator.serviceWorker.register('./sw.js').then((enregistrement) => {
        if (enregistrement.waiting && navigator.serviceWorker.controller) proposer(enregistrement.waiting);
        enregistrement.addEventListener('updatefound', () => {
            const nouveauSw = enregistrement.installing;
            nouveauSw?.addEventListener('statechange', () => {
                if (nouveauSw.state === 'installed' && navigator.serviceWorker.controller) proposer(nouveauSw);
            });
        });
    }).catch(() => { /* hors ligne ou contexte non sécurisé : l'application fonctionne sans */ });
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!miseAJourDemandee) return;
        miseAJourDemandee = false;
        location.reload();
    });
}

// ---------- Démarrage ----------

let attenteBrouillon = null;
let sortieAutorisee = false;
let miseAJourDemandee = false;

function brancherGlobal() {
    abonner((raison) => {
        if (raison !== 'enregistrement') rafraichir(); else majBarre();
        if (raison === 'modification' || raison === 'historique' || raison === 'chargement') {
            clearTimeout(attenteBrouillon);
            attenteBrouillon = setTimeout(() => enregistrerBrouillon(serialiser(etat.doc)), 800);
        }
    });

    zones.fichier.addEventListener('change', () => { ouvrir(zones.fichier.files[0]); zones.fichier.value = ''; });
    document.addEventListener('click', (e) => {
        const action = e.target.closest?.('[data-action]')?.getAttribute('data-action');
        if (action === 'apropos') ouvrirAPropos();
        if (action === 'theme') appliquerTheme(document.documentElement.getAttribute('data-fr-scheme') !== 'dark');
    });

    document.addEventListener('keydown', (e) => {
        if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
        const cle = e.key.toLowerCase();
        const saisie = e.target.matches?.('input, textarea, select');
        if (cle === 's') { e.preventDefault(); enregistrer(); }
        else if (cle === 'o') { e.preventDefault(); zones.fichier.click(); }
        else if (saisie) return; // dans un champ, l'annulation native du navigateur s'applique
        else if (cle === 'z' && !e.shiftKey) { e.preventDefault(); annuler(); }
        else if (cle === 'y' || (cle === 'z' && e.shiftKey)) { e.preventDefault(); retablir(); }
    });

    // Dépôt d'un fichier sur la fenêtre
    let profondeur = 0;
    const avecFichier = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
    window.addEventListener('dragenter', (e) => { if (avecFichier(e)) { profondeur += 1; document.body.classList.add('fusain-glisser'); } });
    window.addEventListener('dragleave', (e) => { if (avecFichier(e)) { profondeur -= 1; if (profondeur <= 0) document.body.classList.remove('fusain-glisser'); } });
    window.addEventListener('dragover', (e) => { if (avecFichier(e)) e.preventDefault(); });
    window.addEventListener('drop', (e) => {
        if (!avecFichier(e)) return;
        e.preventDefault();
        profondeur = 0;
        document.body.classList.remove('fusain-glisser');
        ouvrir(e.dataTransfer.files[0]);
    });

    window.addEventListener('resize', () => { if (ui.ajuste) dimensionnerFeuille(); else placerPoignee(); });
    window.addEventListener('beforeunload', (e) => {
        validerCodeEnAttente();
        if (etat.modifie && !sortieAutorisee) { e.preventDefault(); e.returnValue = ''; }
    });
}

async function demarrer() {
    construireBarre();
    brancherFeuille();
    brancherDeplacement();
    brancherCode();
    brancherGlobal();
    appliquerTheme(preference('theme') === 'sombre');

    let doc = null;
    const brouillon = await lireBrouillon();
    if (brouillon) {
        try { doc = lireJson(brouillon); } catch { doc = null; }
    }
    charger(doc || nouveauDocument(MODELE_INITIAL.code), { modifie: false });
    if (doc) message('Brouillon repris', 'Votre dernier travail a été rechargé depuis ce navigateur. Pensez à l\'enregistrer dans un fichier.', 'info', 7000);
    brancherServiceWorker();
    document.documentElement.dataset.fusainPret = '1';
}

demarrer();
