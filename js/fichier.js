// Sauvegarde et restauration au format JSON (cahier des charges §5.9, §6 et §7.4)
import { VERSION, VERSION_FORMAT } from './version.js';
import { FORMATS, ORIENTATIONS, MODES_AJUSTEMENT, ALIGNEMENTS } from './formats.js';
import { TAILLE_MAX_CODE, typeDiagramme, nomFichierSur } from './securite.js';
import { THEMES } from './rendu.js';

export const TAILLE_MAX_FICHIER = 5 * 1024 * 1024;
export const PAGES_MAX = 100;

const CLES_HOSTILES = new Set(['__proto__', 'constructor', 'prototype']);

function refuser(motif) {
    throw new Error(motif);
}

function chaine(valeur, nom, max, { vide = true } = {}) {
    if (typeof valeur !== 'string') refuser(`Le champ « ${nom} » doit être un texte.`);
    if (valeur.length > max) refuser(`Le champ « ${nom} » est trop long (${max} caractères au maximum).`);
    if (!vide && !valeur.trim()) refuser(`Le champ « ${nom} » est vide.`);
    return valeur;
}

function parmi(valeur, liste, nom) {
    if (!liste.includes(valeur)) refuser(`Valeur non reconnue pour « ${nom} ».`);
    return valeur;
}

function nombre(valeur, nom, min, max) {
    if (typeof valeur !== 'number' || !Number.isFinite(valeur) || valeur < min || valeur > max) refuser(`Valeur hors limites pour « ${nom} ».`);
    return valeur;
}

function objet(valeur, nom, clesPermises) {
    if (valeur === null || typeof valeur !== 'object' || Array.isArray(valeur)) refuser(`Le champ « ${nom} » est mal formé.`);
    for (const cle of Object.keys(valeur)) {
        if (!clesPermises.includes(cle)) refuser(`Champ inconnu « ${cle} » dans « ${nom} ».`);
    }
    return valeur;
}

function date(valeur, nom) {
    chaine(valeur, nom, 40);
    if (Number.isNaN(Date.parse(valeur))) refuser(`Date invalide pour « ${nom} ».`);
    return new Date(valeur).toISOString();
}

// Reconstruit un document neuf, champ par champ, à partir d'un objet non fiable.
// L'objet d'entrée n'est jamais réutilisé tel quel.
export function valider(brut) {
    objet(brut, 'fichier', ['format', 'formatVersion', 'application', 'document', 'pages']);
    if (brut.format !== 'fusain') refuser('Ce fichier n\'est pas un document FUSAIN.');
    if (!Number.isInteger(brut.formatVersion) || brut.formatVersion < 1) refuser('Version de format invalide.');
    if (brut.formatVersion > VERSION_FORMAT) refuser('Ce fichier a été créé avec une version plus récente de FUSAIN. Mettez l\'application à jour pour l\'ouvrir.');
    chaine(brut.application, 'application', 20);

    const d = objet(brut.document, 'document', ['titre', 'creeLe', 'modifieLe', 'theme']);
    const document = {
        titre: chaine(d.titre, 'titre du document', 200),
        creeLe: date(d.creeLe, 'creeLe'),
        modifieLe: date(d.modifieLe, 'modifieLe'),
        theme: parmi(d.theme, Object.keys(THEMES), 'theme'),
    };

    if (!Array.isArray(brut.pages) || brut.pages.length < 1) refuser('Le document ne contient aucune page.');
    if (brut.pages.length > PAGES_MAX) refuser(`Le document dépasse ${PAGES_MAX} pages.`);
    const vus = new Set();
    const pages = brut.pages.map((p, i) => {
        const nom = `page ${i + 1}`;
        objet(p, nom, ['id', 'nom', 'format', 'orientation', 'margesMm', 'titre', 'piedDePage', 'ajustement', 'type', 'code']);
        const a = objet(p.ajustement, `${nom} / ajustement`, ['mode', 'echelle', 'alignement']);
        chaine(p.id, `${nom} / id`, 40, { vide: false });
        if (!/^[A-Za-z0-9_-]+$/.test(p.id) || vus.has(p.id)) refuser(`Identifiant de page invalide ou en double (${nom}).`);
        vus.add(p.id);
        if (p.type !== undefined) {
            chaine(p.type, `${nom} / type`, 40);
            if (!/^[A-Za-z0-9-]*$/.test(p.type)) refuser(`Type de schéma invalide (${nom}).`);
        }
        return {
            id: p.id,
            nom: chaine(p.nom, `${nom} / nom`, 100),
            format: parmi(p.format, Object.keys(FORMATS), `${nom} / format`),
            orientation: parmi(p.orientation, ORIENTATIONS, `${nom} / orientation`),
            margesMm: nombre(p.margesMm, `${nom} / marges`, 0, 50),
            titre: chaine(p.titre, `${nom} / titre`, 200),
            piedDePage: chaine(p.piedDePage, `${nom} / pied de page`, 200),
            ajustement: {
                mode: parmi(a.mode, MODES_AJUSTEMENT, `${nom} / mode d'ajustement`),
                echelle: nombre(a.echelle, `${nom} / échelle`, 10, 400),
                alignement: parmi(a.alignement, ALIGNEMENTS, `${nom} / alignement`),
            },
            code: chaine(p.code, `${nom} / code`, TAILLE_MAX_CODE),
        };
    });

    return { format: 'fusain', formatVersion: VERSION_FORMAT, application: VERSION, document, pages };
}

export function lireJson(texte) {
    if (texte.length > TAILLE_MAX_FICHIER) refuser('Le fichier dépasse la taille maximale autorisée (5 Mo).');
    let brut;
    try {
        brut = JSON.parse(texte, (cle, valeur) => {
            if (CLES_HOSTILES.has(cle)) throw new Error('hostile');
            return valeur;
        });
    } catch (e) {
        refuser(e.message === 'hostile' ? 'Le fichier contient des champs interdits.' : 'Le fichier n\'est pas un JSON valide.');
    }
    return valider(brut);
}

export function serialiser(doc) {
    const sortie = {
        format: 'fusain', formatVersion: VERSION_FORMAT, application: VERSION,
        document: { ...doc.document },
        pages: doc.pages.map((p) => ({
            id: p.id, nom: p.nom, format: p.format, orientation: p.orientation, margesMm: p.margesMm,
            titre: p.titre, piedDePage: p.piedDePage, ajustement: { ...p.ajustement },
            type: typeDiagramme(p.code), code: p.code,
        })),
    };
    return JSON.stringify(sortie, null, 2);
}

export async function lireFichier(fichier) {
    if (fichier.size > TAILLE_MAX_FICHIER) refuser('Le fichier dépasse la taille maximale autorisée (5 Mo).');
    return fichier.text();
}

export function telecharger(blob, nom) {
    const url = URL.createObjectURL(blob);
    const lien = document.createElement('a');
    lien.href = url;
    lien.download = nom;
    document.body.append(lien);
    lien.click();
    lien.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export function nomDocument(doc) {
    return nomFichierSur(doc.document.titre, 'document');
}
