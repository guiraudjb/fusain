// FUSAIN — assemblage de l'interface
import { VERSION, DATE_VERSION } from './version.js';
import { h, s, vider, bouton, champTexte, champSelect, annoncer, message, modale, ouvrirModale, fermerModale, confirmer } from './dom.js';
import { etat, abonner, charger, modifier, allerPage, annuler, retablir, peutAnnuler, peutRetablir, pageCourante, nouveauDocument, nouvellePage, idPage, marquerEnregistre } from './etat.js';
import { FORMATS, MM_PAR_PX, dimensions } from './formats.js';
import { typeDiagramme, TAILLE_MAX_CODE, TAILLE_MAX_CARTE } from './securite.js';
import { THEMES, rendreSchema, composerPage, decrireErreur, verifierPropositions } from './rendu.js';
import { diagnostiquer } from './diagnostic.js';
import { SYNTAXES, TYPES_AIDE } from './syntaxes.js';
import { serialiser, lireJson, lireFichier, telecharger, nomDocument, PAGES_MAX } from './fichier.js';
import { enregistrerBrouillon, lireBrouillon, effacerDonneesLocales } from './brouillon.js';
import { exporterPDF, exporterPNG, exporterSVG } from './export.js';
import { exporterVisio } from './visio.js';
import { editeurPour } from './diagrammes/index.js';
import { MODELES, CATEGORIES, MODELE_INITIAL } from './modeles.js';
import { rendreMarkdown } from './markdown.js';
import { ouvrirImportReseau } from './import-reseau.js';
import { brancherNavigation, borner, ancrer } from './navigation.js';

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
    boutons.annuler = bouton('Annuler', { icone: 'arrow-go-back-line', seulIcone: true, titre: 'Annuler (Ctrl+Z)', onclick: () => { validerCodeEnAttente(); annuler(); } });
    boutons.retablir = bouton('Rétablir', { icone: 'arrow-go-forward-line', seulIcone: true, titre: 'Rétablir (Ctrl+Y)', onclick: () => { validerCodeEnAttente(); retablir(); } });
    boutons.zoom = h('button', { type: 'button', class: 'fusain-barre__zoom', title: 'Niveau de zoom : choisir une valeur', 'aria-haspopup': 'true', 'aria-expanded': 'false', onclick: () => ouvrirMenuZoom() });
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
            bouton('Zoom arrière', { icone: 'zoom-out-line', seulIcone: true, titre: 'Zoom arrière (Ctrl+−, molette)', onclick: () => zoomer(ui.zoom / 1.25) }),
            h('div', { class: 'fusain-zoom' }, boutons.zoom),
            bouton('Zoom avant', { icone: 'zoom-in-line', seulIcone: true, titre: 'Zoom avant (Ctrl++, molette)', onclick: () => zoomer(ui.zoom * 1.25) }),
            bouton('Ajuster à la fenêtre', { icone: 'fullscreen-line', seulIcone: true, titre: 'Ajuster à la fenêtre (Ctrl+1)', onclick: ajuster })),
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
    const scene = zones.scene;
    if (ui.ajuste) {
        const dispoL = scene.clientWidth - 48;
        const dispoH = scene.clientHeight - 48;
        ui.zoom = borner(Math.min(dispoL / (l / MM_PAR_PX), dispoH / (haut / MM_PAR_PX)));
    }
    const largeur = (l / MM_PAR_PX) * ui.zoom;
    const hauteur = (haut / MM_PAR_PX) * ui.zoom;
    zones.feuille.style.width = `${largeur}px`;
    zones.feuille.style.height = `${hauteur}px`;
    // Zoom manuel : une marge de travail d'une vue presque entière de chaque côté. Le point visé par la molette reste
    // ainsi toujours sous le pointeur, à tout niveau de zoom, et la feuille ne sort jamais tout à fait de l'écran (40 px).
    const manuel = !ui.ajuste;
    const toile = zones.feuille.parentElement;
    toile.style.padding = manuel ? `${Math.max(0, scene.clientHeight - 64)}px ${Math.max(0, scene.clientWidth - 64)}px` : '';
    toile.style.width = manuel ? `${largeur}px` : '';
    zones.feuille.style.margin = manuel ? '0' : '';
    scene.classList.toggle('fusain-scene--deplacable', manuel);
    boutons.zoom.textContent = `${Math.round(ui.zoom * 100)} %`;
    placerPoignee();
}

// Zoom ancré : le point visé (le pointeur, ou le centre de la vue) reste sous les yeux
function zoomer(valeur, point = null) {
    const z = borner(valeur);
    if (!ui.ajuste && Math.abs(z - ui.zoom) < 1e-4) return;
    zones.feuille.querySelector('.fusain-saisie')?.blur(); // un renommage en cours est validé
    const avant = zones.feuille.getBoundingClientRect();
    const cadre = zones.scene.getBoundingClientRect();
    const cible = point || { x: cadre.left + cadre.width / 2, y: cadre.top + cadre.height / 2 };
    ui.ajuste = false;
    ui.zoom = z;
    dimensionnerFeuille();
    const { dx, dy } = ancrer(avant, zones.feuille.getBoundingClientRect(), cible);
    // Le défilement est arrondi au pixel : le reste est reporté au cran suivant, pour qu'une suite de crans ne dérive pas
    const scene = zones.scene;
    const x = scene.scrollLeft + dx + resteDefilement.x;
    const y = scene.scrollTop + dy + resteDefilement.y;
    scene.scrollLeft = x;
    scene.scrollTop = y;
    resteDefilement = { x: Math.abs(x - scene.scrollLeft) < 1 ? x - scene.scrollLeft : 0, y: Math.abs(y - scene.scrollTop) < 1 ? y - scene.scrollTop : 0 };
    annoncerZoom();
}
let resteDefilement = { x: 0, y: 0 };

function ajuster() {
    ui.ajuste = true;
    dimensionnerFeuille();
    annoncerZoom();
}

let minuterieZoom = null;
function annoncerZoom() {
    clearTimeout(minuterieZoom);
    minuterieZoom = setTimeout(() => annoncer(`Zoom ${Math.round(ui.zoom * 100)} %`), 500);
}

function ouvrirMenuZoom() {
    const parent = boutons.zoom.parentElement;
    const ouvert = parent.querySelector('.fusain-zoom__menu');
    if (ouvert) { fermer(); return; }
    const choix = [['Ajuster à la fenêtre', null], ['50 %', 0.5], ['100 %', 1], ['150 %', 1.5], ['200 %', 2], ['400 %', 4]];
    const menu = h('ul', { class: 'fusain-zoom__menu', role: 'menu' }, choix.map(([nom, z]) => h('li', { role: 'none' },
        h('button', { type: 'button', role: 'menuitem', onclick: () => { fermer(); boutons.zoom.focus(); if (z === null) ajuster(); else zoomer(z); } }, nom))));
    function fermer() {
        menu.remove();
        boutons.zoom.setAttribute('aria-expanded', 'false');
        document.removeEventListener('pointerdown', dehors, true);
    }
    function dehors(e) { if (!parent.contains(e.target)) fermer(); }
    menu.addEventListener('keydown', (e) => {
        const items = [...menu.querySelectorAll('button')];
        const i = items.indexOf(document.activeElement);
        if (e.key === 'Escape') { e.preventDefault(); fermer(); boutons.zoom.focus(); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
        else if (e.key === 'Tab') fermer();
    });
    parent.append(menu);
    boutons.zoom.setAttribute('aria-expanded', 'true');
    document.addEventListener('pointerdown', dehors, true);
    menu.querySelector('button').focus();
}

// ---------- Rendu général ----------

function analyserPage() {
    const page = pageCourante();
    const editeur = editeurPour(typeDiagramme(page.code));
    vue = { editeur, modele: null, motif: '', vierge: !page.code.trim() };
    if (vue.vierge) return;
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
        schema = await rendreSchema(page.code, etat.doc.document.theme, page);
        derniersRendus.set(page.id, schema);
    } catch (e) {
        erreur = decrireErreur(e);
        // Diagnostic : ligne réelle, objet visé, syntaxe attendue, réparations à vérifier
        try { erreur.diagnostic = diagnostiquer(page.code, e); } catch (d) { console.warn('Diagnostic impossible', d); }
        if (erreur.diagnostic?.ligne) erreur.ligne = erreur.diagnostic.ligne;
        schema = derniersRendus.get(page.id) || null; // le dernier rendu valide reste affiché
    }
    if (n !== jeton) return;

    zones.scene.removeAttribute('aria-busy');
    afficherFeuille(page, schema, erreur);
    afficherCode(erreur);
    afficherPanneau();
    afficherPages(n);
    if (erreur?.diagnostic) chercherReparations(n, page, erreur.diagnostic);
}

// ---------- Erreurs de syntaxe : diagnostic et réparations ----------

const reparationsVerifiees = new Map(); // thème + code → propositions vérifiées
let zoneReparations = null;

async function chercherReparations(n, page, diagnostic) {
    const cle = `${etat.doc.document.theme}\n${page.code}`;
    let liste = reparationsVerifiees.get(cle);
    if (!liste) {
        try { liste = await verifierPropositions(diagnostic, etat.doc.document.theme, page); } catch { liste = []; }
        reparationsVerifiees.set(cle, liste);
        if (reparationsVerifiees.size > 30) reparationsVerifiees.delete(reparationsVerifiees.keys().next().value);
    }
    if (n !== jeton || !zoneReparations?.isConnected) return;
    afficherReparations(liste, diagnostic);
}

function appliquerReparation(p) {
    const index = etat.index;
    validerCodeEnAttente();
    modifier((doc) => { doc.pages[index].code = p.code; });
    if (ui.mode === 'code') zones.zoneCode.value = pageCourante().code;
    message('Réparation appliquée', 'Ctrl+Z pour revenir au code précédent.', 'success', 5000);
    annoncer(`Réparation appliquée : ${p.libelle}.`);
}

function afficherReparations(liste, diagnostic) {
    vider(zoneReparations);
    if (!liste.length) {
        zoneReparations.append(h('p', { class: 'fr-text--sm fusain-diagnostic__vide' }, 'Aucune réparation automatique sûre : corrigez la ligne d\'après la syntaxe attendue.'));
        return;
    }
    zoneReparations.append(h('p', { class: 'fusain-diagnostic__intitule' }, liste.length > 1 ? 'Réparations proposées' : 'Réparation proposée'),
        h('ul', { class: 'fusain-diagnostic__reparations' }, liste.map((p) => h('li', {},
            bouton('Appliquer', { variante: 'secondary', icone: 'check-line', onclick: () => appliquerReparation(p) }),
            h('div', {},
                h('span', {}, p.libelle, p.verifiee ? '' : ` (corrige la ligne ${p.ligne || diagnostic.ligne} ; une autre erreur suit, ligne ${p.suivante})`),
                p.apres ? h('code', { class: 'fusain-diagnostic__code' }, p.apres.trim()) : null)))));
    annoncer(`${liste.length} réparation${liste.length > 1 ? 's' : ''} proposée${liste.length > 1 ? 's' : ''}.`);
}

function allerALaLigne(ligne) {
    const aller = () => {
        const zone = zones.zoneCode;
        const lignes = zone.value.split('\n');
        const n = Math.max(1, Math.min(ligne, lignes.length));
        const debut = lignes.slice(0, n - 1).reduce((s, l) => s + l.length + 1, 0);
        zone.focus();
        zone.setSelectionRange(debut, debut + lignes[n - 1].length);
        const hauteur = parseFloat(getComputedStyle(zone).lineHeight) || 21;
        zone.scrollTop = Math.max(0, (n - 1) * hauteur - zone.clientHeight / 3);
        zones.lignes.scrollTop = zone.scrollTop;
    };
    if (ui.mode !== 'code') { changerMode('code'); requestAnimationFrame(aller); } else aller();
}

function alerteErreur(page, erreur) {
    const d = erreur.diagnostic;
    const total = page.code.split('\n').length;
    if (!d || !d.ligne) {
        zoneReparations = null;
        return h('div', { class: 'fr-alert fr-alert--error fr-alert--sm' },
            h('h2', { class: 'fr-alert__title' }, erreur.ligne ? `Erreur dans le code, vers la ligne ${Math.min(erreur.ligne, total)}` : 'Erreur dans le code'),
            h('p', {}, erreur.texte.split('\n').flatMap((l, i) => (i ? [h('br'), l] : [l]))),
            d?.type && SYNTAXES[d.type] ? h('p', {}, bouton(`Syntaxes : ${SYNTAXES[d.type].nom.toLowerCase()}`, { variante: 'tertiary', icone: 'question-line', onclick: () => ouvrirSyntaxes(d.type) })) : null,
            ui.mode !== 'code' ? h('p', {}, bouton('Corriger dans le code', { variante: 'secondary', onclick: () => changerMode('code') })) : null);
    }
    // Rien à redire à la ligne signalée : c'est la ligne d'avant qui est désignée
    const enCause = d.precedente && d.cause.includes(`ligne ${d.precedente.ligne},`) ? d.precedente : null;
    const o = enCause?.objet || d.objet;
    const numero = String(d.ligne);
    const largeur = numero.length;
    // La ligne précédente est montrée quand elle est en cause : une faute en fin de ligne est souvent signalée à la suivante
    const extrait = d.precedente ? [`${String(d.precedente.ligne).padStart(largeur)} │ ${d.precedente.texte.replace(/\t/g, '    ')}`] : [];
    extrait.push(`${numero} │ ${d.texte.replace(/\t/g, '    ')}`);
    if (d.colonne) extrait.push(`${' '.repeat(largeur)} │ ${' '.repeat(Math.max(0, d.colonne - 1))}^`);
    zoneReparations = h('div', { class: 'fusain-diagnostic__zone', 'aria-live': 'polite' }, h('p', { class: 'fr-text--sm fusain-diagnostic__vide' }, 'Recherche de réparations…'));
    return h('div', { class: 'fr-alert fr-alert--error fr-alert--sm fusain-diagnostic' },
        h('h2', { class: 'fr-alert__title' }, enCause ? `Erreur ligne ${enCause.ligne}${enCause.objet ? ` — ${enCause.objet.nom}` : ''} (signalée ligne ${d.ligne})` : `Erreur ligne ${d.ligne}${o ? ` — ${o.nom}` : ''}`),
        h('p', {}, d.cause),
        d.precedente?.cause && !d.cause.includes(`ligne ${d.precedente.ligne},`) ? h('p', { class: 'fr-text--sm' }, `Ligne précédente (${d.precedente.ligne}) à vérifier aussi : ${d.precedente.cause}`) : null,
        h('pre', { class: 'fusain-diagnostic__extrait' }, extrait.join('\n')),
        o ? h('div', { class: 'fusain-diagnostic__syntaxe' },
            h('p', { class: 'fusain-diagnostic__intitule' }, 'Syntaxe attendue'),
            h('ul', {}, o.syntaxe.map((x) => h('li', {}, h('code', {}, x)))),
            o.exemple ? h('p', {}, 'Exemple : ', h('code', {}, o.exemple.split('\n')[0])) : null,
            o.aide ? h('p', { class: 'fr-text--sm' }, o.aide) : null) : null,
        zoneReparations,
        h('div', { class: 'fusain-actions' },
            bouton('Aller à la ligne', { variante: 'secondary', icone: 'code-s-slash-line', onclick: () => allerALaLigne(enCause?.ligne || d.ligne) }),
            SYNTAXES[d.type] ? bouton(`Toutes les syntaxes : ${SYNTAXES[d.type].nom.toLowerCase()}`, { variante: 'tertiary', icone: 'question-line', onclick: () => ouvrirSyntaxes(d.type) }) : null),
        h('details', { class: 'fusain-diagnostic__detail' }, h('summary', {}, 'Détail technique'), h('pre', {}, d.message.split('\n').slice(0, 8).join('\n'))));
}

// Index des syntaxes : chaque objet du type, avec sa syntaxe, un exemple et son insertion dans le code
function ouvrirSyntaxes(type = typeDiagramme(pageCourante().code)) {
    const premier = SYNTAXES[type] ? type : 'flowchart';
    const liste = h('div', { class: 'fusain-syntaxes' });
    const inserer = (texte) => {
        fermerModale(dialogue);
        const ecrire = () => {
            const zone = zones.zoneCode;
            const debut = zone.value.lastIndexOf('\n', Math.max(0, zone.selectionStart - 1)) + 1;
            const retrait = (zone.value.slice(debut).match(/^\s*/) || [''])[0];
            const fin = zone.value.indexOf('\n', zone.selectionEnd);
            const position = fin < 0 ? zone.value.length : fin;
            const bloc = texte.split('\n').map((l) => retrait + l).join('\n');
            zone.setRangeText(`\n${bloc}`, position, position, 'end');
            zone.dispatchEvent(new Event('input'));
            zone.focus();
        };
        if (ui.mode !== 'code') { changerMode('code'); requestAnimationFrame(ecrire); } else ecrire();
    };
    const remplir = (t) => {
        const def = SYNTAXES[t];
        const memeType = typeDiagramme(pageCourante().code) === t || SYNTAXES[typeDiagramme(pageCourante().code)] === def;
        liste.replaceChildren(
            h('section', {}, h('h2', { class: 'fr-h6' }, 'Première ligne'), h('ul', {}, def.entete.map((e) => h('li', {}, h('code', {}, e))))),
            ...def.objets.map((o) => h('section', {},
                h('h2', { class: 'fr-h6' }, o.nom),
                o.aide ? h('p', { class: 'fr-text--sm' }, o.aide) : null,
                h('ul', {}, o.syntaxe.map((x) => h('li', {}, h('code', {}, x)))),
                h('pre', { class: 'fusain-syntaxes__exemple' }, o.exemple),
                memeType ? bouton('Insérer l\'exemple', { variante: 'tertiary', taille: 'sm', icone: 'add-line', onclick: () => inserer(o.exemple) }) : null)));
    };
    const choix = champSelect('Type de schéma', TYPES_AIDE.map((t) => [t, SYNTAXES[t].nom]), premier, remplir);
    remplir(premier);
    const dialogue = modale('fusain-modale-syntaxes', 'Syntaxes du code', h('div', {},
        h('p', { class: 'fr-text--sm' }, 'Chaque sorte d\'objet, son écriture et un exemple. « Insérer l\'exemple » l\'ajoute sous la ligne du curseur.'), choix, liste));
    ouvrirModale(dialogue);
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

    // L'alerte est posée au-dessus de la scène : elle en change la hauteur, la feuille est dimensionnée ensuite
    vider(zones.erreur);
    zones.erreur.hidden = !erreur;
    if (erreur) zones.erreur.append(alerteErreur(page, erreur));
    else zoneReparations = null;
    dimensionnerFeuille();
    majSelection();
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
        if (valider && texte !== valeur.replace(/\n/g, ' ')) { let nouvelle; appliquer((m) => { nouvelle = editeur.renommer(m, cle, texte); }, () => nouvelle || cle); }
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

// L'appui vise-t-il un élément que l'éditeur sait déplacer ? (mêmes conditions que brancherDeplacement)
function peutDeplacerElement(e) {
    const { editeur, modele } = vue;
    const marque = e.target.closest?.('[data-fusain]');
    if (ui.mode !== 'visuel' || !modele || !editeur?.deplacer || !marque || !zones.feuille.contains(marque)) return false;
    if (editeur.deplacable && !editeur.deplacable(marque.getAttribute('data-fusain'))) return false;
    return !!editeur.zoneDeplacement(zones.feuille.querySelector('.fusain-schema'));
}

// Glisser un élément à position libre (points d'une matrice) : la nouvelle position est lue dans la zone de référence
function brancherDeplacement() {
    let glisse = null;
    zones.feuille.addEventListener('pointerdown', (e) => {
        const { editeur, modele } = vue;
        const marque = e.target.closest?.('[data-fusain]');
        if (ui.mode !== 'visuel' || !modele || !editeur.deplacer || !marque || e.button !== 0) return;
        if (editeur.deplacable && !editeur.deplacable(marque.getAttribute('data-fusain'))) return;
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
    zones.etatCode.before(bouton('Syntaxes', { icone: 'question-line', titre: 'Écriture de chaque objet du schéma, avec un exemple', onclick: () => ouvrirSyntaxes() }));
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
    // Le panneau est reconstruit à chaque changement : le champ actif est retrouvé par son libellé (son rang parmi les
    // champs de même libellé), à défaut par son rang. Un bloc qui apparaît ou disparaît au-dessus ne déplace plus le focus.
    const focusables = 'input, select, textarea, button';
    const nomChamp = (el) => (el.labels?.[0]?.textContent || el.textContent || el.title || '').trim();
    const actif = document.activeElement;
    const avant = [...zones.panneau.querySelectorAll(focusables)];
    const rang = avant.indexOf(actif);
    const nom = rang >= 0 ? nomChamp(actif) : '';
    const rangNom = rang >= 0 ? avant.filter((el) => el.tagName === actif.tagName && nomChamp(el) === nom).indexOf(actif) : -1;
    const defilement = zones.panneau.scrollTop;
    const blocs = [];
    if (ui.mode === 'visuel') {
        if (vue.modele) {
            blocs.push(...vue.editeur.panneau({ modele: vue.modele, selection: ui.selection, appliquer, selectionner, idPage: pageCourante().id }));
        } else if (vue.vierge) {
            blocs.push(h('div', { class: 'fusain-bloc' },
                h('h2', {}, 'Page vierge'),
                h('p', { class: 'fr-text--sm' }, 'Cette page ne contient pas de schéma : seuls son titre, son sous-titre et son pied de page sont imprimés.'),
                h('div', { class: 'fusain-actions' },
                    bouton('Choisir un schéma', { icone: 'layout-grid-line', variante: 'secondary', onclick: () => ouvrirModeles('remplacer') }),
                    bouton('Écrire du code', { icone: 'code-s-slash-line', onclick: () => changerMode('code') }))));
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
    if (rang < 0) return;
    const apres = [...zones.panneau.querySelectorAll(focusables)];
    const memes = nom ? apres.filter((el) => el.tagName === actif.tagName && nomChamp(el) === nom) : [];
    (memes[rangNom] || apres[rang])?.focus({ preventScroll: true });
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

// Plusieurs pages d'un coup (import d'un réseau), après la page courante : une seule étape d'annulation
function ajouterPages(liste) {
    const place = PAGES_MAX - etat.doc.pages.length;
    if (place <= 0) return message('Nombre maximal de pages atteint', '', 'warning');
    if (liste.length > place) message('Pages en trop', `Seules les ${place} premières pages ont été ajoutées (${PAGES_MAX} pages au plus par document).`, 'warning');
    ui.selection = null;
    modifier((doc) => {
        const modele = pageCourante();
        const pages = liste.slice(0, place).map(({ code, nom, format, orientation }) => {
            const page = nouvellePage(code, nom || `Page ${doc.pages.length + 1}`);
            page.format = FORMATS[format] ? format : modele.format;
            page.orientation = orientation || modele.orientation;
            page.margesMm = modele.margesMm;
            return page;
        });
        doc.pages.splice(etat.index + 1, 0, ...pages);
        etat.index += 1;
    });
}

// Les vignettes ne sont rendues que lorsqu'elles deviennent visibles : un document de 100 pages s'ouvre
// aussi vite qu'un document d'une page.
let observateurVignettes = null;

async function remplirVignette(cadre, n) {
    const i = Number(cadre.dataset.index);
    const page = etat.doc.pages[i];
    if (!page || n !== jeton) return;
    let schema = null;
    try { schema = await rendreSchema(page.code, etat.doc.document.theme, page); } catch { schema = derniersRendus.get(page.id) || null; }
    if (n !== jeton || !cadre.isConnected) return;
    const { svg } = composerPage(page, schema, { index: i, total: etat.doc.pages.length });
    svg.setAttribute('aria-hidden', 'true');
    cadre.replaceChildren(svg);
}

function afficherPages(n) {
    observateurVignettes?.disconnect();
    observateurVignettes = new IntersectionObserver((entrees) => {
        for (const entree of entrees) {
            if (!entree.isIntersecting) continue;
            observateurVignettes.unobserve(entree.target);
            remplirVignette(entree.target, n);
        }
    }, { root: zones.pages, rootMargin: '300px' });

    const liste = h('ol', { class: 'fusain-vignettes' });
    for (const [i, page] of etat.doc.pages.entries()) {
        const { l, h: haut } = dimensions(page);
        const cadre = h('span', { class: 'fusain-vignette__image', 'data-index': i });
        cadre.style.aspectRatio = `${l} / ${haut}`;
        cadre.style.width = l > haut ? '100%' : `${Math.round((l / haut) * 100)}%`;
        liste.append(h('li', {}, h('button', { type: 'button', class: 'fusain-vignette', 'aria-current': String(i === etat.index), onclick: () => { validerCodeEnAttente(); ui.selection = null; allerPage(i); } },
            cadre, h('span', { class: 'fusain-vignette__nom' }, `${i + 1}. ${page.nom}`))));
        observateurVignettes.observe(cadre);
    }
    const actif = zones.pages.contains(document.activeElement) ? [...zones.pages.querySelectorAll('button')].indexOf(document.activeElement) : -1;
    const defilement = zones.pages.scrollTop;
    zones.pages.replaceChildren(liste, bouton('Ajouter une page', { icone: 'add-line', variante: 'secondary', onclick: () => ouvrirModeles('ajouter') }));
    zones.pages.scrollTop = defilement;
    if (actif >= 0) zones.pages.querySelectorAll('button')[actif]?.focus({ preventScroll: true });
    zones.pages.querySelector('.fusain-vignette[aria-current="true"]')?.scrollIntoView({ block: 'nearest' });
}

// ---------- Modèles ----------

function ouvrirModeles(action) {
    const contenu = h('div', {},
        h('p', { class: 'fr-text--sm' }, action === 'ajouter'
            ? 'Choisissez le schéma de départ de la nouvelle page.'
            : 'Le schéma de la page courante sera remplacé par le modèle choisi (annulable avec Ctrl+Z).'),
        action === 'ajouter' ? h('div', { class: 'fusain-modeles' }, h('button', { type: 'button', class: 'fusain-modele', onclick: () => { fermerModale(dialogue); ajouterPage('', ''); } },
            h('span', { class: 'fusain-modele__nom' }, 'Page vierge'),
            h('span', { class: 'fr-badge fr-badge--sm fr-badge--no-icon' }, 'Sans schéma'))) : null,
        CATEGORIES.map(([id, nom]) => [
            h('h2', { class: 'fr-h6 fr-mb-1w' }, nom),
            h('div', { class: 'fusain-modeles' }, MODELES.filter((m) => m.categorie === id).map((m) => h('button', { type: 'button', class: 'fusain-modele', onclick: () => {
                fermerModale(dialogue);
                if (action === 'ajouter') ajouterPage(m.code, m.nom);
                else { ui.selection = null; majPage((p) => { p.code = m.code; }); }
            } },
            h('span', { class: 'fusain-modele__nom' }, m.nom),
            h('span', { class: `fr-badge fr-badge--sm fr-badge--no-icon fr-badge--${editeurPour(typeDiagramme(m.code)) ? 'success' : 'info'}` }, editeurPour(typeDiagramme(m.code)) ? 'Édition visuelle' : 'Par le code'))),
            id === 'reseaux' ? h('button', { type: 'button', class: 'fusain-modele', onclick: () => { fermerModale(dialogue); ouvrirImportReseau(ajouterPages); } },
                h('span', { class: 'fusain-modele__nom' }, 'Importer un réseau (HPE IMC, LLDP : CSV, Excel)…'),
                h('span', { class: 'fr-badge fr-badge--sm fr-badge--no-icon fr-badge--new' }, 'Nouvelles pages')) : null),
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
    const texte = serialiser(etat.doc);
    telecharger(new Blob([texte], { type: 'application/json' }), `${nomDocument(etat.doc)}.fusain.json`);
    marquerEnregistre();
    // Le fichier est relu comme à l'ouverture : un document que FUSAIN refuserait est signalé tout de suite
    try { lireJson(texte); } catch (e) {
        message('Fichier enregistré, mais il ne pourra pas être rouvert', `${e.message} Réduisez la page concernée, puis enregistrez de nouveau.`, 'error', 0);
        return;
    }
    message('Document enregistré', 'Le fichier JSON a été remis à votre navigateur.', 'success', 4000);
}

async function ouvrir(fichier) {
    if (!fichier) return;
    try {
        const texte = await lireFichier(fichier);
        if (/\.(mmd|mermaid|txt)$/i.test(fichier.name)) {
            // Code trop long : refusé plutôt que coupé au milieu d'une ligne
            const max = typeDiagramme(texte) === 'carte' ? TAILLE_MAX_CARTE : TAILLE_MAX_CODE;
            if (texte.length > max) throw new Error(`Le code dépasse la taille maximale d'une page (${max} caractères).`);
            if (etat.doc.pages.length >= PAGES_MAX) throw new Error(`Le document compte déjà ${PAGES_MAX} pages.`);
            ajouterPage(texte, fichier.name.replace(/\.[^.]+$/, '').slice(0, 100));
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
        groupe('Format', radio('format', 'pdf', 'PDF (vectoriel)', true), radio('format', 'png', 'PNG (image)'), radio('format', 'svg', 'SVG (vectoriel)'), radio('format', 'vsdx', 'Visio (.vsdx, modifiable)')),
        groupe('Pages', radio('portee', 'tout', `Tout le document (${etat.doc.pages.length} page${etat.doc.pages.length > 1 ? 's' : ''})`, true), radio('portee', 'page', 'Page courante')),
        optionsImage);
    formulaire.addEventListener('change', () => { optionsImage.hidden = ['pdf', 'vsdx'].includes(formulaire.elements.format.value); });
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
            } else if (format === 'vsdx') {
                const { pages, enImage, imagesIgnorees, connecteurs } = await exporterVisio(etat.doc, indices);
                const remarques = [
                    enImage.length ? `Insérée(s) en image, faute de conversion en formes : ${enImage.join(', ')}.` : '',
                    imagesIgnorees ? `${imagesIgnorees} image(s) non reprise(s) (fond de carte ou image découpée).` : '',
                ].filter(Boolean);
                message('Export Visio terminé', [`${pages} page(s), formes modifiables${connecteurs ? `, ${connecteurs} connecteur(s) collé(s) aux formes` : ''}.`, ...remarques].join(' '),
                    remarques.length ? 'warning' : 'success', remarques.length ? 10000 : 6000);
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

const EXEMPLES_CARTES = [
    ['france-departements.csv', 'Départements de France', 'population, budgets, projets, satisfaction (code INSEE du département, séparateur virgule) ; échelles France et région'],
    ['france-communes.csv', 'Communes de France', 'subventions, dossiers, population éligible, émissions évitées (code INSEE de la commune, séparateur point-virgule, 1 Mo) ; toutes les échelles françaises'],
    ['monde.csv', 'Pays du monde', 'deux séries de test (code ISO à trois lettres) ; échelles monde et région du monde'],
];

const EXEMPLES_RESEAU = [
    ['imc-liens.xlsx', 'Liste des liens (Excel)', 'export « Gestion des liens » d\'HPE IMC : siège et agence, VLAN, agrégat, lien en panne'],
    ['imc-liens.csv', 'Liste des liens (CSV)', 'le même tableau, précédé d\'une ligne de titre comme dans l\'export'],
    ['imc-equipements.csv', 'Liste des équipements', 'catégories, adresses IP et emplacements des mêmes équipements'],
    ['imc-api.csv', 'Liens de l\'API REST d\'IMC', 'un lien vu des deux côtés, compté une fois'],
    ['lldp-voisins.csv', 'Voisins LLDP', 'rapport séparé par des points-virgules : téléphones IP, borne Wi-Fi'],
];

// Les documents joints sont mis en forme dans une modale ; le lien garde son adresse, pour l'ouverture dans un nouvel onglet
async function ouvrirDocument(chemin, titre) {
    try {
        const reponse = await fetch(chemin);
        if (!reponse.ok) throw new Error(`document introuvable (${reponse.status})`);
        const contenu = rendreMarkdown(await reponse.text());
        const retour = bouton('Retour à « À propos »', { variante: 'secondary', taille: 'md', icone: 'arrow-go-back-line', onclick: ouvrirAPropos });
        ouvrirModale(modale('fusain-modale-document', titre, contenu, [retour]));
    } catch (e) {
        message('Document illisible', `${titre} : ${e.message}.`, 'error', 12000);
    }
}

function ouvrirAPropos() {
    const lien = (href, texte) => h('a', { class: 'fr-link', href, target: '_blank', rel: 'noopener noreferrer' }, texte);
    const document_ = (href, texte) => h('a', { class: 'fr-link', href, onclick: (e) => {
        if (e.ctrlKey || e.metaKey || e.shiftKey) return;
        e.preventDefault();
        ouvrirDocument(href, texte);
    } }, texte);
    const raccourcis = [
        ['Ctrl+Z / Ctrl+Y', 'Annuler / rétablir'], ['Ctrl+S', 'Enregistrer en JSON'], ['Ctrl+O', 'Ouvrir un fichier'],
        ['Molette', 'Zoomer sous le pointeur (Maj + molette : défiler)'], ['Glisser', 'Déplacer la vue (Espace + glisser : partout)'],
        ['Clic molette', 'Zoom à 100 %'], ['Ctrl++ / Ctrl+−', 'Zoom avant / arrière'], ['Ctrl+0 / Ctrl+1', 'Zoom à 100 % / ajuster à la fenêtre'],
        ['Flèches', 'Parcourir les éléments du schéma'], ['Entrée ou F2', 'Renommer l\'élément sélectionné'],
        ['Suppr', 'Supprimer l\'élément sélectionné'], ['Inser ou +', 'Ajouter un élément lié'], ['Échap puis Tab', 'Quitter l\'éditeur de code au clavier'],
    ];
    const contenu = h('div', {},
        h('p', {}, h('strong', {}, `FUSAIN ${VERSION}`), ` — version du ${new Date(DATE_VERSION).toLocaleDateString('fr-FR')}`),
        h('p', { class: 'fr-text--sm' }, 'Fabrique Universelle de Schémas Accessibles, Intuitifs et Normés. Tous les traitements (rendu, mise en page, export, sauvegarde) s\'exécutent dans votre navigateur : aucun schéma, aucun texte ne quitte votre poste.'),
        h('h2', { class: 'fr-h6' }, 'Documentation'),
        h('ul', {},
            h('li', {}, document_('./Documentation/GUIDE_UTILISATEUR.md', 'Guide utilisateur')),
            h('li', {}, document_('./Documentation/GUIDE_IMC.md', 'Obtenir les exports d\'HPE IMC (liens et équipements en Excel)')),
            h('li', {}, document_('./FUSAIN_cahier_des_charges.md', 'Cahier des charges')),
            h('li', {}, document_('./NOMENCLATURE_LOGICIELLE_FUSAIN.md', 'Nomenclature logicielle (SBOM)'), ' — ', lien('./sbom/fusain-sbom-cyclonedx.json', 'format CycloneDX')),
            h('li', {}, document_('./AUDIT_SECURITE_FUSAIN.md', 'Audit de sécurité et revue de code'))),
        h('h2', { class: 'fr-h6' }, 'Erreurs de syntaxe et index des syntaxes'),
        h('p', { class: 'fr-text--sm' }, 'Depuis la 0.21.0, une faute dans le code est expliquée : ligne réelle, objet que la ligne essaie d\'écrire, cause, syntaxe attendue et exemple. Des réparations sont proposées après avoir été essayées ; « Appliquer » s\'annule par Ctrl+Z. Le bouton « Syntaxes » du mode code ouvre l\'index des écritures de chaque type de schéma.'),
        h('h2', { class: 'fr-h6' }, 'Export vers Microsoft Visio'),
        h('p', { class: 'fr-text--sm' }, 'Depuis la 0.20.0, « Exporter » propose le format Visio (.vsdx) : un fichier, une page Visio par page, lisible par Visio 2013 et suivants et par LibreOffice Draw. Formes et textes y sont modifiables ; les étapes et équipements forment des groupes ; sur les logigrammes, réseaux importés, diagrammes d\'états, de classes, entités-relations et d\'architecture, les liaisons sont des connecteurs collés qui suivent les formes déplacées. Police Marianne, remplacée par une police voisine si elle n\'est pas installée.'),
        h('h2', { class: 'fr-h6' }, 'Schémas de réseau importés'),
        h('p', { class: 'fr-text--sm' }, 'Depuis la 0.18.0, « Importer un réseau » (rubrique Réseaux informatiques de « Ajouter une page » et de « Modèles ») dessine un réseau à partir d\'exports tabulaires : la liste des liens d\'HPE IMC (« Gestion des liens »), ses liens lus par l\'API REST ou un rapport de voisins LLDP / CDP, et, en option, la liste des équipements d\'IMC. Fichiers lus : Excel .xlsx, CSV, tableau HTML enregistré en .xls.'),
        h('ul', { class: 'fr-text--sm' },
            h('li', {}, 'Colonnes reconnues d\'après leur intitulé (Left Node, Right Interface, Remote System Name, Device Category, Location…), corrigeables avant l\'import.'),
            h('li', {}, 'Schéma physique : icône selon la catégorie de l\'équipement, interfaces abrégées, débits, liens agrégés en trait épais, liens en panne en pointillé, terminaux d\'un commutateur résumés (« 12 téléphones IP »).'),
            h('li', {}, 'Schéma logique quand l\'export donne les VLAN des ports (access, trunk, VLAN autorisés).'),
            h('li', {}, 'Regroupement par emplacement, préfixe du nom ou sous-réseau ; au-delà de 25 équipements d\'infrastructure, une vue d\'ensemble puis une page par site.'),
            h('li', {}, 'Les pages créées sont des logigrammes ordinaires, entièrement modifiables ; un seul Ctrl+Z retire l\'import. Les fichiers sont lus dans le navigateur, sans envoi.')),
        h('p', { class: 'fr-text--sm' }, 'Pour obtenir ces fichiers depuis IMC, voir le guide ', document_('./Documentation/GUIDE_IMC.md', 'Obtenir les exports d\'HPE IMC'), '. Exports fictifs pour essayer l\'import (noms de colonnes documentés par HPE, équipements inventés) :'),
        h('ul', {}, EXEMPLES_RESEAU.map(([fichier, nom, detail]) => h('li', {},
            h('a', { class: 'fr-link', href: `./Documentation/exemples-reseau/${fichier}`, download: fichier }, nom), ` — ${detail}`))),
        h('h2', { class: 'fr-h6' }, 'Données d\'exemple pour les cartes'),
        h('p', { class: 'fr-text--sm' }, 'Fichiers CSV repris de SimpleCarto, à importer dans une page de carte (« Importer un fichier CSV… »). Hormis les codes des territoires, les valeurs sont fictives.'),
        h('ul', {}, EXEMPLES_CARTES.map(([fichier, nom, detail]) => h('li', {},
            h('a', { class: 'fr-link', href: `./cartes/exemples/${fichier}`, download: fichier }, nom), ` — ${detail}`))),
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
        // Zoom de la scène plutôt que de toute la page (la page reste zoomable par le menu du navigateur)
        else if (document.querySelector('dialog[open]')) return;
        else if (['+', '='].includes(e.key) || e.code === 'NumpadAdd') { e.preventDefault(); zoomer(ui.zoom * 1.25); }
        else if (e.key === '-' || e.code === 'NumpadSubtract') { e.preventDefault(); zoomer(ui.zoom / 1.25); }
        else if (e.code === 'Digit0' || e.code === 'Numpad0') { e.preventDefault(); zoomer(1); }
        else if (e.code === 'Digit1' || e.code === 'Numpad1') { e.preventDefault(); ajuster(); }
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

    window.addEventListener('resize', () => {
        if (ui.ajuste) { dimensionnerFeuille(); return; }
        // Zoom manuel : le centre de la vue reste le même
        const centre = { x: zones.scene.scrollLeft + zones.scene.clientWidth / 2, y: zones.scene.scrollTop + zones.scene.clientHeight / 2 };
        const avant = { l: zones.scene.scrollWidth, h: zones.scene.scrollHeight };
        dimensionnerFeuille();
        zones.scene.scrollLeft = (centre.x / avant.l) * zones.scene.scrollWidth - zones.scene.clientWidth / 2;
        zones.scene.scrollTop = (centre.y / avant.h) * zones.scene.scrollHeight - zones.scene.clientHeight / 2;
    });
    window.addEventListener('beforeunload', (e) => {
        validerCodeEnAttente();
        if (etat.modifie && !sortieAutorisee) { e.preventDefault(); e.returnValue = ''; }
    });
}

async function demarrer() {
    construireBarre();
    brancherFeuille();
    brancherDeplacement();
    // La feuille est posée sur une toile : en zoom manuel, la toile porte la marge de travail autour d'elle
    const toile = h('div', { class: 'fusain-toile' });
    zones.feuille.before(toile);
    toile.append(zones.feuille);
    brancherNavigation({ scene: zones.scene, lireZoom: () => ui.zoom, zoomer, peutDeplacerElement });
    brancherCode();
    brancherGlobal();
    appliquerTheme(preference('theme') === 'sombre');

    let doc = null;
    const brouillon = await lireBrouillon();
    if (brouillon) {
        try {
            doc = lireJson(brouillon);
        } catch (e) {
            // Le brouillon serait écrasé par le document neuf : il est d'abord mis de côté, et l'utilisateur prévenu
            doc = null;
            await enregistrerBrouillon(brouillon, 'illisible');
            message('Brouillon non repris', `Le dernier brouillon n'a pas pu être relu (${e.message}). Il est conservé à part dans ce navigateur ; « Effacer les données locales » le supprime.`, 'warning', 0);
        }
    }
    charger(doc || nouveauDocument(MODELE_INITIAL.code), { modifie: false });
    if (doc) message('Brouillon repris', 'Votre dernier travail a été rechargé depuis ce navigateur. Pensez à l\'enregistrer dans un fichier.', 'info', 7000);
    brancherServiceWorker();
    document.documentElement.dataset.fusainPret = '1';
}

demarrer();
