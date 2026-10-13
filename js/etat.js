// État du document, historique annuler / rétablir
import { VERSION, VERSION_FORMAT } from './version.js';

export const etat = { doc: null, index: 0, modifie: false };

const ecouteurs = new Set();
const LIMITE_HISTORIQUE = 100;
let passe = [];
let futur = [];
let derniereFusion = null;
let dernierInstant = 0;

export function abonner(fonction) { ecouteurs.add(fonction); }
function notifier(raison) { for (const f of ecouteurs) f(raison); }

export function idPage() {
    return 'p' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
}

export function nouvellePage(code, nom = 'Page') {
    return {
        id: idPage(), nom, format: 'A4', orientation: 'paysage', margesMm: 15,
        titre: '', piedDePage: '',
        ajustement: { mode: 'page', echelle: 100, alignement: 'centre' },
        code,
    };
}

export function nouveauDocument(code) {
    const maintenant = new Date().toISOString();
    return {
        format: 'fusain', formatVersion: VERSION_FORMAT, application: VERSION,
        document: { titre: 'Document sans titre', creeLe: maintenant, modifieLe: maintenant, theme: 'bleu-france' },
        pages: [nouvellePage(code, 'Page 1')],
    };
}

export function pageCourante() { return etat.doc.pages[etat.index]; }

function instantane() { return JSON.stringify({ doc: etat.doc, index: etat.index }); }

function restaurer(chaine) {
    const { doc, index } = JSON.parse(chaine);
    etat.doc = doc;
    etat.index = Math.min(index, doc.pages.length - 1);
}

// Remplace le document entier (ouverture, nouveau, brouillon) : l'historique repart de zéro
export function charger(doc, { modifie = false } = {}) {
    etat.doc = doc;
    etat.index = 0;
    etat.modifie = modifie;
    passe = [];
    futur = [];
    notifier('chargement');
}

// Toute modification passe par ici. « fusion » regroupe les frappes successives en une seule étape.
export function modifier(fonction, { fusion = null } = {}) {
    const avant = instantane();
    fonction(etat.doc);
    const maintenant = Date.now();
    if (!(fusion && fusion === derniereFusion && maintenant - dernierInstant < 1500)) {
        passe.push(avant);
        if (passe.length > LIMITE_HISTORIQUE) passe.shift();
    }
    derniereFusion = fusion;
    dernierInstant = maintenant;
    futur = [];
    etat.modifie = true;
    etat.doc.document.modifieLe = new Date().toISOString();
    notifier('modification');
}

export function allerPage(index) {
    etat.index = Math.max(0, Math.min(index, etat.doc.pages.length - 1));
    derniereFusion = null;
    notifier('page');
}

export function peutAnnuler() { return passe.length > 0; }
export function peutRetablir() { return futur.length > 0; }

export function annuler() {
    if (!passe.length) return;
    futur.push(instantane());
    restaurer(passe.pop());
    derniereFusion = null;
    etat.modifie = true;
    notifier('historique');
}

export function retablir() {
    if (!futur.length) return;
    passe.push(instantane());
    restaurer(futur.pop());
    derniereFusion = null;
    etat.modifie = true;
    notifier('historique');
}

export function marquerEnregistre() {
    etat.modifie = false;
    notifier('enregistrement');
}
