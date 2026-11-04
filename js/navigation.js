// Zoom et déplacement dans la scène : molette sous le pointeur, glisser à la souris, clic molette à 100 %, pincement et
// déplacement au doigt, Espace maintenue pour déplacer partout. La feuille est redimensionnée par l'application ; ce module
// ne fait que traduire les gestes et garder sous le pointeur le point visé.

export const ZOOM_MIN = 0.1;
export const ZOOM_MAX = 64; // 6400 % : une feuille A0 reste sous les limites de taille des navigateurs
const SEUIL = 4; // px : en deçà, un appui est un clic

export const borner = (z) => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));

// Distance de défilement d'un événement de molette, en pixels quel que soit son mode (pixels, lignes, pages)
function enPixels(e, valeur) {
    if (e.deltaMode === 1) return valeur * 16;
    if (e.deltaMode === 2) return valeur * 400;
    return valeur;
}

// Pavé tactile glissé à deux doigts : des deltas en pixels, fractionnaires ou avec une composante horizontale.
// Il défile ; la molette d'une souris (crans entiers, verticaux) et le pincement (Ctrl) zooment.
export function estPaveTactile(e) {
    return !e.ctrlKey && !e.metaKey && e.deltaMode === 0 && (e.deltaX !== 0 || !Number.isInteger(e.deltaY));
}

// Facteur de zoom d'un événement : un cran de souris (100 px) ≈ ×1,16 ; le pincement, aux deltas faibles, est plus sensible
export function facteurMolette(e) {
    const dy = enPixels(e, e.deltaY);
    const k = (e.ctrlKey || e.metaKey) && Math.abs(dy) < 50 ? 0.01 : 0.0015;
    return Math.exp(Math.max(-1, Math.min(1, -dy * k)));
}

// Correction du défilement pour que le point (x, y) de l'écran désigne le même endroit de la feuille avant et après
export function ancrer(avant, apres, point) {
    const fx = avant.width ? (point.x - avant.left) / avant.width : 0.5;
    const fy = avant.height ? (point.y - avant.top) / avant.height : 0.5;
    return { dx: apres.left + fx * apres.width - point.x, dy: apres.top + fy * apres.height - point.y };
}

const NON_DEPLACANT = '.fusain-poignee, .fusain-saisie, input, textarea, select, button, a, .fusain-erreur';
const champActif = (el) => !!el?.closest?.('input, textarea, select, button, a, [contenteditable="true"], dialog[open]');

// zoomer(valeur, point) applique un zoom ancré ; lireZoom() rend le zoom courant ; peutDeplacerElement(e) dit si l'appui
// vise un élément que l'éditeur sait déplacer (il garde alors la main)
export function brancherNavigation({ scene, lireZoom, zoomer, peutDeplacerElement }) {
    // ---------- Molette ----------
    let attente = null;
    scene.addEventListener('wheel', (e) => {
        if (e.shiftKey || estPaveTactile(e)) return; // défilement natif
        e.preventDefault(); // pas de défilement, ni de zoom de la page par Ctrl + molette
        if (!attente) {
            attente = { facteur: 1, point: null };
            requestAnimationFrame(() => {
                const { facteur, point } = attente;
                attente = null;
                zoomer(lireZoom() * facteur, point);
            });
        }
        attente.facteur *= facteurMolette(e);
        attente.point = { x: e.clientX, y: e.clientY };
    }, { passive: false });

    // ---------- Espace maintenue : déplacement partout ----------
    let survol = false;
    let espace = false;
    const majEspace = (v) => { espace = v; scene.classList.toggle('fusain-scene--espace', v); };
    scene.addEventListener('pointerenter', () => { survol = true; });
    scene.addEventListener('pointerleave', () => { survol = false; });
    window.addEventListener('keydown', (e) => {
        if (e.key !== ' ' || e.repeat || e.ctrlKey || e.altKey || e.metaKey || champActif(e.target)) return;
        if (!survol && !scene.contains(document.activeElement)) return;
        e.preventDefault();
        majEspace(true);
    });
    window.addEventListener('keyup', (e) => { if (e.key === ' ') majEspace(false); });
    window.addEventListener('blur', () => majEspace(false));

    // ---------- Glisser (souris, stylet, doigts) ----------
    const pointeurs = new Map(); // id → { x, y }
    let geste = null;
    let annulerClic = false;
    const fin = () => {
        if (geste?.actif) {
            annulerClic = true;
            setTimeout(() => { annulerClic = false; }, 0);
        }
        geste = null;
        scene.classList.remove('fusain-scene--deplacement');
    };
    const pincement = () => {
        const [a, b] = [...pointeurs.values()];
        return { d: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    };

    scene.addEventListener('pointerdown', (e) => {
        if (e.target.closest?.(NON_DEPLACANT)) return;
        if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 1) return;
        if (e.button === 0 && !espace && peutDeplacerElement(e)) return; // glisser l'élément
        if (e.button === 1) e.preventDefault(); // ni défilement automatique, ni collage
        pointeurs.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointeurs.size === 2) {
            // Deux doigts : pincement, qui remplace le déplacement à un doigt
            geste = { pince: pincement(), actif: true };
            for (const id of pointeurs.keys()) try { scene.setPointerCapture(id); } catch { /* pointeur déjà relâché */ }
            return;
        }
        if (pointeurs.size > 2) return;
        geste = { id: e.pointerId, x: e.clientX, y: e.clientY, gauche: scene.scrollLeft, haut: scene.scrollTop, bouton: e.button, actif: espace };
        if (espace) { e.preventDefault(); scene.setPointerCapture(e.pointerId); scene.classList.add('fusain-scene--deplacement'); }
    });

    scene.addEventListener('pointermove', (e) => {
        if (!pointeurs.has(e.pointerId)) return;
        pointeurs.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (!geste) return;
        if (geste.pince && pointeurs.size === 2) {
            const p = pincement();
            if (geste.pince.d > 0) zoomer(lireZoom() * (p.d / geste.pince.d), { x: p.x, y: p.y });
            scene.scrollLeft -= p.x - geste.pince.x;
            scene.scrollTop -= p.y - geste.pince.y;
            geste.pince = p;
            return;
        }
        if (geste.id !== e.pointerId) return;
        const dx = e.clientX - geste.x;
        const dy = e.clientY - geste.y;
        if (!geste.actif) {
            if (Math.hypot(dx, dy) < SEUIL) return;
            geste.actif = true;
            scene.setPointerCapture(e.pointerId);
            scene.classList.add('fusain-scene--deplacement');
            window.getSelection?.()?.removeAllRanges();
        }
        scene.scrollLeft = geste.gauche - dx;
        scene.scrollTop = geste.haut - dy;
    });

    const relacher = (e) => {
        if (!pointeurs.delete(e.pointerId)) return;
        if (geste?.pince) {
            // Un doigt reste : il reprend le déplacement là où il est
            if (pointeurs.size === 1) {
                const [[id, p]] = [...pointeurs];
                geste = { id, x: p.x, y: p.y, gauche: scene.scrollLeft, haut: scene.scrollTop, bouton: 0, actif: true };
            } else if (!pointeurs.size) fin();
            return;
        }
        if (!geste || geste.id !== e.pointerId) return;
        // Clic molette sans glisser : retour à 100 %, sous le pointeur
        if (e.type === 'pointerup' && geste.bouton === 1 && !geste.actif) zoomer(1, { x: e.clientX, y: e.clientY });
        fin();
    };
    // Relâchement écouté sur la fenêtre : un appui sans glisser n'a pas capturé le pointeur
    window.addEventListener('pointerup', relacher);
    window.addEventListener('pointercancel', relacher);
    scene.addEventListener('lostpointercapture', (e) => { if (geste?.id === e.pointerId && geste.actif) relacher(e); });

    // Après un déplacement, le clic qui suit le relâchement ne sélectionne ni ne désélectionne rien
    scene.addEventListener('click', (e) => { if (annulerClic) { e.stopPropagation(); e.preventDefault(); annulerClic = false; } }, true);
    // Le bouton du milieu ne déclenche ni défilement automatique ni collage (Linux)
    scene.addEventListener('mousedown', (e) => { if (e.button === 1) e.preventDefault(); });
    scene.addEventListener('auxclick', (e) => { if (e.button === 1) e.preventDefault(); });
}
