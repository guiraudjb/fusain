// Mode diaporama dans une nouvelle page web (?diaporama=1)
import { h, vider, bouton, annoncer, message } from './dom.js';
import { dimensions, MM_PAR_PX } from './formats.js';
import { rendreSchema, composerPage } from './rendu.js';
import { lireJson, lireFichier } from './fichier.js';
import { lireBrouillon } from './brouillon.js';
import { nouveauDocument } from './etat.js';
import { MODELE_INITIAL } from './modeles.js';
import { estPaveTactile, facteurMolette, ancrer } from './navigation.js';

const CLE_SESSION = 'fusain-diaporama-doc';
const DELAI_LECTURE_MS = 6000;
const ZOOM_REL_MAX = 16;
const SEUIL_GLISSER = 6;

export const FICHIER_DEMONSTRATION = './presentation-fusain.fusain.json';

export function estModeDiaporama() {
    const params = new URLSearchParams(location.search);
    return params.has('diaporama');
}

export function enregistrerSessionDiaporama(json) {
    try {
        localStorage.setItem(CLE_SESSION, json);
    } catch { /* quota dépassé : le brouillon IndexedDB prend le relais */ }
}

export function estBrouillonParDefaut(doc) {
    if (!doc) return true;
    if (
        doc.pages.length === 1 &&
        doc.document.titre === 'Sans titre' &&
        doc.pages[0].code.trim() === MODELE_INITIAL.code.trim() &&
        !doc.pages[0].titre &&
        !doc.pages[0].sousTitre &&
        !doc.pages[0].notes
    ) {
        return true;
    }
    if (
        doc.document.titre === 'Présentation complète de FUSAIN — Catalogue des 60 modèles' &&
        doc.pages.some((p) => p.code.includes('erreur ==> analyseur'))
    ) {
        return true;
    }
    return false;
}

export async function chargerDocumentDemonstration() {
    try {
        const rep = await fetch(FICHIER_DEMONSTRATION);
        if (rep.ok) return lireJson(await rep.text());
    } catch { /* fichier de démonstration absent ou ouverture hors serveur */ }
    return nouveauDocument(MODELE_INITIAL.code);
}

async function chargerDocumentInitial() {
    const params = new URLSearchParams(location.search);
    const fichierUrl = params.get('doc') || (params.get('diaporama') !== '1' && params.get('diaporama') !== '' ? params.get('diaporama') : '');
    if (fichierUrl && /^[A-Za-z0-9_.-]+\.json$/i.test(fichierUrl)) {
        try {
            const rep = await fetch(`./${fichierUrl}`);
            if (rep.ok) return lireJson(await rep.text());
        } catch { /* repli sur la session ou le brouillon */ }
    }
    try {
        const session = localStorage.getItem(CLE_SESSION);
        if (session) {
            const doc = lireJson(session);
            if (!estBrouillonParDefaut(doc)) return doc;
        }
    } catch { /* lecture impossible */ }
    try {
        const brouillon = await lireBrouillon();
        if (brouillon) {
            const doc = lireJson(brouillon);
            if (!estBrouillonParDefaut(doc)) return doc;
        }
    } catch { /* brouillon indisponible */ }
    return chargerDocumentDemonstration();
}

export async function demarrerDiaporama() {
    let doc = await chargerDocumentInitial();
    const params = new URLSearchParams(location.search);
    const pageParam = Number(params.get('page'));
    let index = Number.isInteger(pageParam) && pageParam >= 1 && pageParam <= doc.pages.length ? pageParam - 1 : 0;
    let jeton = 0;
    let minuterieLecture = null;
    let minuterieBarre = null;
    let ajuste = true;
    let zoomRelatif = 1;
    let resteDefilement = { x: 0, y: 0 };

    document.body.classList.add('fusain-mode-diaporama');

    const jauge = h('div', { class: 'fusain-diapo__jauge-barre' });
    const feuille = h('div', { class: 'fusain-feuille fusain-diapo__feuille' });
    const cadreLoupe = h('div', { class: 'fusain-diapo__loupe', hidden: true });
    const toile = h('div', { class: 'fusain-toile fusain-diapo__toile' }, feuille);
    const alerte = h('div', { class: 'fusain-diapo__erreur', role: 'alert', hidden: true });
    const plateau = h('div', { class: 'fusain-diapo__plateau', tabindex: '-1', title: 'Tracer un cadre ou utiliser la molette pour zoomer sur une zone ; double-cliquer ou Échap pour revenir à la taille initiale' }, toile, cadreLoupe, alerte);

    const selectPage = h('select', { class: 'fr-select fusain-diapo__select', 'aria-label': 'Aller à la diapositive', onchange: () => aller(Number(selectPage.value)) });
    const btnPrecedent = bouton('Précédente', { icone: 'arrow-left-s-line', seulIcone: true, titre: 'Diapositive précédente (Flèche gauche)', onclick: () => aller(index - 1) });
    const btnSuivant = bouton('Suivante', { icone: 'arrow-right-s-line', seulIcone: true, titre: 'Diapositive suivante (Flèche droite ou Espace)', onclick: () => aller(index + 1) });

    const btnZoomMoins = bouton('Zoom arrière', { icone: 'zoom-out-line', seulIcone: true, titre: 'Zoom arrière (−)', onclick: () => zoomerVers(zoomRelatif / 1.35) });
    const btnTailleInitiale = bouton('100 %', { icone: 'fullscreen-line', titre: 'Revenir à la taille initiale (Échap ou 0)', onclick: () => reinitialiserZoom() });
    const btnZoomPlus = bouton('Zoom avant', { icone: 'zoom-in-line', seulIcone: true, titre: 'Zoom avant (+)', onclick: () => zoomerVers(zoomRelatif * 1.35) });

    const btnLecture = bouton('Lecture auto', { icone: 'arrow-right-line', titre: 'Lecture automatique (P)', onclick: basculerLecture });
    const btnPleinEcran = bouton('Plein écran', { icone: 'external-link-line', seulIcone: true, titre: 'Plein écran du navigateur (F)', onclick: basculerPleinEcran });
    const champFichier = h('input', { type: 'file', accept: '.json,application/json', hidden: true });
    const btnOuvrir = bouton('Ouvrir…', { icone: 'upload-line', titre: 'Charger un autre fichier .fusain.json', onclick: () => champFichier.click() });
    const btnEditer = bouton('Éditeur', { icone: 'arrow-go-back-line', titre: 'Ouvrir l\'éditeur FUSAIN', onclick: () => {
        arreterLecture();
        location.href = './';
    } });

    const titreDoc = h('span', { class: 'fusain-diapo__titre' });
    const barre = h('nav', { class: 'fusain-diapo__barre', 'aria-label': 'Contrôles du diaporama' },
        h('div', { class: 'fusain-diapo__groupe' }, titreDoc),
        h('div', { class: 'fusain-diapo__groupe fusain-diapo__navigation' }, btnPrecedent, selectPage, btnSuivant),
        h('div', { class: 'fusain-diapo__groupe' }, btnZoomMoins, btnTailleInitiale, btnZoomPlus),
        h('div', { class: 'fusain-diapo__groupe' }, btnLecture, btnOuvrir, btnPleinEcran, btnEditer),
        champFichier);

    const conteneur = h('div', { class: 'fusain-diapo' },
        h('div', { class: 'fusain-diapo__jauge', 'aria-hidden': 'true' }, jauge),
        plateau,
        barre);

    const app = document.getElementById('fusain-app');
    vider(app).append(conteneur);

    function remplirSelect() {
        vider(selectPage).append(...doc.pages.map((p, i) => h('option', { value: String(i), selected: i === index },
            `${i + 1} / ${doc.pages.length} — ${p.nom || p.titre || `Page ${i + 1}`}`)));
        titreDoc.textContent = doc.document.titre;
    }

    function echelleBase() {
        const page = doc.pages[index];
        if (!page) return { lPx: 1, hPx: 1, k0: 1 };
        const { l, h: haut } = dimensions(page);
        const lPx = l / MM_PAR_PX;
        const hPx = haut / MM_PAR_PX;
        const dispoL = Math.max(200, plateau.clientWidth - 48);
        const dispoH = Math.max(150, plateau.clientHeight - 64);
        return { lPx, hPx, k0: Math.min(dispoL / lPx, dispoH / hPx) };
    }

    function majBoutonZoom() {
        const pct = Math.round(zoomRelatif * 100);
        btnTailleInitiale.textContent = ajuste ? 'Taille initiale' : `${pct} % — Taille initiale`;
        btnTailleInitiale.disabled = ajuste;
        btnZoomMoins.disabled = ajuste;
        btnZoomPlus.disabled = zoomRelatif >= ZOOM_REL_MAX - 0.01;
        plateau.classList.toggle('fusain-diapo__plateau--zoome', !ajuste);
    }

    function dimensionner() {
        const { lPx, hPx, k0 } = echelleBase();
        if (ajuste) zoomRelatif = 1;
        const largeur = Math.round(lPx * k0 * zoomRelatif);
        const hauteur = Math.round(hPx * k0 * zoomRelatif);
        feuille.style.width = `${largeur}px`;
        feuille.style.height = `${hauteur}px`;
        if (ajuste) {
            toile.style.padding = '';
            toile.style.width = '';
            plateau.scrollLeft = 0;
            plateau.scrollTop = 0;
        } else {
            toile.style.padding = `${Math.max(0, plateau.clientHeight - 64)}px ${Math.max(0, plateau.clientWidth - 64)}px`;
            toile.style.width = `${largeur}px`;
        }
        majBoutonZoom();
    }

    function reinitialiserZoom(silencieux = false) {
        if (ajuste && zoomRelatif === 1) return;
        ajuste = true;
        zoomRelatif = 1;
        resteDefilement = { x: 0, y: 0 };
        dimensionner();
        if (!silencieux) annoncer('Taille initiale rétablie');
    }

    // Zoom ancré autour d'un point de l'écran (ou du centre du plateau)
    function zoomerVers(nouveauZoomRel, point = null) {
        if (nouveauZoomRel <= 1.02) {
            reinitialiserZoom();
            return;
        }
        const z = Math.min(ZOOM_REL_MAX, nouveauZoomRel);
        if (!ajuste && Math.abs(z - zoomRelatif) < 1e-3) return;
        const avant = feuille.getBoundingClientRect();
        const cadre = plateau.getBoundingClientRect();
        const cible = point || { x: cadre.left + cadre.width / 2, y: cadre.top + cadre.height / 2 };
        ajuste = false;
        zoomRelatif = z;
        dimensionner();
        const { dx, dy } = ancrer(avant, feuille.getBoundingClientRect(), cible);
        const x = plateau.scrollLeft + dx + resteDefilement.x;
        const y = plateau.scrollTop + dy + resteDefilement.y;
        plateau.scrollLeft = x;
        plateau.scrollTop = y;
        resteDefilement = {
            x: Math.abs(x - plateau.scrollLeft) < 1 ? x - plateau.scrollLeft : 0,
            y: Math.abs(y - plateau.scrollTop) < 1 ? y - plateau.scrollTop : 0,
        };
        annoncer(`Zoom ${Math.round(zoomRelatif * 100)} %`);
    }

    // Zoom et centrage sur un rectangle tracé à la souris (coordonnées écran)
    function zoomerSurZone(x0, y0, x1, y1) {
        const avant = feuille.getBoundingClientRect();
        const gx0 = Math.max(avant.left, Math.min(x0, x1));
        const gy0 = Math.max(avant.top, Math.min(y0, y1));
        const gx1 = Math.min(avant.right, Math.max(x0, x1));
        const gy1 = Math.min(avant.bottom, Math.max(y0, y1));
        const lZone = gx1 - gx0;
        const hZone = gy1 - gy0;
        if (lZone < 16 || hZone < 16 || !avant.width || !avant.height) return;

        const fx = ((gx0 + gx1) / 2 - avant.left) / avant.width;
        const fy = ((gy0 + gy1) / 2 - avant.top) / avant.height;
        const cadre = plateau.getBoundingClientRect();
        const facteur = Math.min((cadre.width - 48) / lZone, (cadre.height - 64) / hZone);
        ajuste = false;
        zoomRelatif = Math.max(1.25, Math.min(ZOOM_REL_MAX, zoomRelatif * facteur));
        dimensionner();

        const apres = feuille.getBoundingClientRect();
        const cx = cadre.left + cadre.width / 2;
        const cy = cadre.top + cadre.height / 2;
        plateau.scrollLeft += apres.left + fx * apres.width - cx;
        plateau.scrollTop += apres.top + fy * apres.height - cy;
        resteDefilement = { x: 0, y: 0 };
        annoncer(`Zone agrandie à ${Math.round(zoomRelatif * 100)} %`);
    }

    async function afficher() {
        const n = ++jeton;
        const total = doc.pages.length;
        index = Math.max(0, Math.min(index, total - 1));
        const page = doc.pages[index];
        selectPage.value = String(index);
        btnPrecedent.disabled = index <= 0;
        btnSuivant.disabled = index >= total - 1;
        jauge.style.width = `${((index + 1) / total) * 100}%`;
        document.title = `(${index + 1}/${total}) ${page.nom || doc.document.titre} — Diaporama FUSAIN`;

        const url = new URL(location.href);
        url.searchParams.set('page', String(index + 1));
        history.replaceState(null, '', url);

        reinitialiserZoom(true);
        dimensionner();
        plateau.setAttribute('aria-busy', 'true');
        alerte.hidden = true;

        let schema = null;
        if (page.code.trim()) {
            try {
                schema = await rendreSchema(page.code, doc.document.theme, page);
            } catch (e) {
                if (n !== jeton) return;
                alerte.textContent = `Erreur sur la diapositive « ${page.nom} » : ${e.message || e}`;
                alerte.hidden = false;
            }
        }
        if (n !== jeton) return;

        const { svg } = composerPage(page, schema, { index, total, guides: false });
        vider(feuille).append(svg);
        plateau.removeAttribute('aria-busy');
        annoncer(`Diapositive ${index + 1} sur ${total} : ${page.titre || page.nom}`);

        // Préchargement silencieux de la diapositive suivante
        const suivante = doc.pages[index + 1];
        if (suivante?.code.trim()) {
            rendreSchema(suivante.code, doc.document.theme, suivante).catch(() => {});
        }
    }

    function aller(cible) {
        const bornee = Math.max(0, Math.min(cible, doc.pages.length - 1));
        if (bornee === index) return;
        index = bornee;
        afficher();
    }

    function arreterLecture() {
        if (!minuterieLecture) return;
        clearInterval(minuterieLecture);
        minuterieLecture = null;
        btnLecture.textContent = 'Lecture auto';
        btnLecture.className = 'fr-btn fr-btn--sm fr-btn--tertiary-no-outline fr-icon-arrow-right-line fr-btn--icon-left';
        btnLecture.setAttribute('aria-pressed', 'false');
    }

    function basculerLecture() {
        if (minuterieLecture) {
            arreterLecture();
            return;
        }
        btnLecture.textContent = 'Pause';
        btnLecture.className = 'fr-btn fr-btn--sm fr-btn--secondary fr-icon-close-line fr-btn--icon-left';
        btnLecture.setAttribute('aria-pressed', 'true');
        minuterieLecture = setInterval(() => {
            if (index + 1 < doc.pages.length) aller(index + 1);
            else aller(0);
        }, DELAI_LECTURE_MS);
    }

    function basculerPleinEcran() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen?.().catch(() => {});
        } else {
            document.exitFullscreen?.().catch(() => {});
        }
    }

    function reveillerBarre() {
        conteneur.classList.remove('fusain-diapo--calme');
        clearTimeout(minuterieBarre);
        minuterieBarre = setTimeout(() => {
            if (!barre.contains(document.activeElement)) conteneur.classList.add('fusain-diapo--calme');
        }, 3000);
    }

    // ---------- Molette : zoom sous le pointeur ----------
    let attenteMolette = null;
    plateau.addEventListener('wheel', (e) => {
        if (e.shiftKey || ( !ajuste && estPaveTactile(e) )) return;
        e.preventDefault();
        if (!attenteMolette) {
            attenteMolette = { facteur: 1, point: null };
            requestAnimationFrame(() => {
                const { facteur, point } = attenteMolette;
                attenteMolette = null;
                zoomerVers(zoomRelatif * facteur, point);
            });
        }
        attenteMolette.facteur *= facteurMolette(e);
        attenteMolette.point = { x: e.clientX, y: e.clientY };
    }, { passive: false });

    // ---------- Souris : tracer un cadre de zoom (loupe) ou déplacer la vue quand elle est zoomée ----------
    let geste = null;
    plateau.addEventListener('pointerdown', (e) => {
        if (e.target.closest?.('a, button, select, input')) return;
        if (e.button === 1) {
            e.preventDefault();
            reinitialiserZoom();
            return;
        }
        if (e.button !== 0) return;
        // À la taille initiale (ou avec Maj enfoncée) : tracer un cadre de loupe pour zoomer sur une zone.
        // Une fois zoomé (sans Maj) : glisser pour se déplacer dans la diapositive.
        const modeLoupe = ajuste || e.shiftKey;
        geste = {
            id: e.pointerId,
            modeLoupe,
            x0: e.clientX,
            y0: e.clientY,
            x1: e.clientX,
            y1: e.clientY,
            gauche: plateau.scrollLeft,
            haut: plateau.scrollTop,
            actif: false,
        };
    });

    plateau.addEventListener('pointermove', (e) => {
        if (!geste || geste.id !== e.pointerId) return;
        geste.x1 = e.clientX;
        geste.y1 = e.clientY;
        const dx = geste.x1 - geste.x0;
        const dy = geste.y1 - geste.y0;
        if (!geste.actif) {
            if (Math.hypot(dx, dy) < SEUIL_GLISSER) return;
            geste.actif = true;
            try { plateau.setPointerCapture(e.pointerId); } catch { /* ignoré */ }
            if (!geste.modeLoupe) plateau.classList.add('fusain-scene--deplacement');
        }
        if (geste.modeLoupe) {
            const cadre = plateau.getBoundingClientRect();
            const gauche = Math.min(geste.x0, geste.x1) - cadre.left + plateau.scrollLeft;
            const haut = Math.min(geste.y0, geste.y1) - cadre.top + plateau.scrollTop;
            cadreLoupe.style.left = `${gauche}px`;
            cadreLoupe.style.top = `${haut}px`;
            cadreLoupe.style.width = `${Math.abs(dx)}px`;
            cadreLoupe.style.height = `${Math.abs(dy)}px`;
            cadreLoupe.hidden = false;
        } else {
            plateau.scrollLeft = geste.gauche - dx;
            plateau.scrollTop = geste.haut - dy;
        }
    });

    const finGeste = (e) => {
        if (!geste || geste.id !== e.pointerId) return;
        const courant = geste;
        geste = null;
        cadreLoupe.hidden = true;
        plateau.classList.remove('fusain-scene--deplacement');
        if (courant.actif && courant.modeLoupe && e.type === 'pointerup') {
            zoomerSurZone(courant.x0, courant.y0, courant.x1, courant.y1);
        }
    };
    plateau.addEventListener('pointerup', finGeste);
    plateau.addEventListener('pointercancel', finGeste);

    // Double-clic : zoomer sur la zone cliquée (×2,5) ou revenir à la taille initiale si déjà zoomé
    plateau.addEventListener('dblclick', (e) => {
        if (e.target.closest?.('a, button, select, input')) return;
        e.preventDefault();
        if (ajuste) zoomerVers(2.5, { x: e.clientX, y: e.clientY });
        else reinitialiserZoom();
    });

    document.addEventListener('mousemove', reveillerBarre);
    document.addEventListener('focusin', reveillerBarre);

    document.addEventListener('keydown', (e) => {
        if (e.target.matches?.('select, input, textarea')) return;
        if (e.key === 'Escape' && !ajuste) {
            e.preventDefault();
            reinitialiserZoom();
        } else if ((e.key === '0' || e.key === '1') && !e.altKey) {
            e.preventDefault();
            reinitialiserZoom();
        } else if (['+', '='].includes(e.key) || e.code === 'NumpadAdd') {
            e.preventDefault();
            zoomerVers(zoomRelatif * 1.35);
        } else if (e.key === '-' || e.code === 'NumpadSubtract') {
            e.preventDefault();
            zoomerVers(zoomRelatif / 1.35);
        } else if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(e.key)) {
            e.preventDefault();
            aller(index + 1);
        } else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(e.key)) {
            e.preventDefault();
            aller(index - 1);
        } else if (e.key === 'Home') {
            e.preventDefault();
            aller(0);
        } else if (e.key === 'End') {
            e.preventDefault();
            aller(doc.pages.length - 1);
        } else if (e.key.toLowerCase() === 'f' && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            basculerPleinEcran();
        } else if (e.key.toLowerCase() === 'p' && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            basculerLecture();
        }
    });

    champFichier.addEventListener('change', async () => {
        const f = champFichier.files[0];
        champFichier.value = '';
        if (!f) return;
        try {
            const texte = await lireFichier(f);
            doc = lireJson(texte);
            enregistrerSessionDiaporama(JSON.stringify(doc));
            index = 0;
            remplirSelect();
            await afficher();
            message('Diaporama chargé', `« ${doc.document.titre} » (${doc.pages.length} diapositives).`, 'success', 4000);
        } catch (err) {
            message('Ouverture impossible', err.message, 'error', 8000);
        }
    });

    window.addEventListener('storage', (e) => {
        if (e.key === CLE_SESSION && e.newValue) {
            try {
                doc = lireJson(e.newValue);
                index = Math.min(index, doc.pages.length - 1);
                remplirSelect();
                afficher();
            } catch { /* ignoré */ }
        }
    });

    window.addEventListener('resize', dimensionner);
    document.addEventListener('fullscreenchange', dimensionner);

    remplirSelect();
    reveillerBarre();
    await afficher();
}
