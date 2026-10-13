// Rendu Mermaid et composition de la page au format d'impression
import { s } from './dom.js';
import { dimensions, MM_PAR_PX } from './formats.js';
import { nettoyerCode, assainirSvg, TAILLE_MAX_CODE, LIENS_MAX } from './securite.js';

const POLICE = 'Marianne, Arial, sans-serif';

// Thèmes de schéma fondés sur les couleurs du Système de Design de l'État
export const THEMES = {
    'bleu-france': { nom: 'Bleu France', fond: '#e3e3fd', bord: '#000091', trait: '#000091', second: '#f5f5fe', tiers: '#ececfe' },
    'rouge-marianne': { nom: 'Rouge Marianne', fond: '#fddede', bord: '#c9191e', trait: '#c9191e', second: '#fef4f4', tiers: '#fee9e9' },
    'vert-emeraude': { nom: 'Vert émeraude', fond: '#c3fad5', bord: '#297254', trait: '#297254', second: '#e3fdeb', tiers: '#dffee6' },
    'bleu-ecume': { nom: 'Bleu écume', fond: '#e9edfe', bord: '#2f4077', trait: '#2f4077', second: '#f4f6fe', tiers: '#dee5fd' },
    'brun-caramel': { nom: 'Brun caramel', fond: '#f7ebe5', bord: '#845d48', trait: '#845d48', second: '#fbf5f2', tiers: '#eed7c8' },
    'contraste': { nom: 'Fort contraste', fond: '#ffffff', bord: '#000000', trait: '#000000', second: '#ffffff', tiers: '#f6f6f6' },
    'monochrome': { nom: 'Monochrome (impression noir et blanc)', fond: '#f6f6f6', bord: '#3a3a3a', trait: '#3a3a3a', second: '#ffffff', tiers: '#e5e5e5' },
};

const ILLUSTRATIVES = ['#000091', '#e1000f', '#009081', '#c8aa39', '#a558a0', '#417dc4', '#e4794a', '#68a532', '#aea397', '#c08c65', '#3558a2', '#b7a73f'];

let themeActif = null;

function configurer(idTheme) {
    if (themeActif === idTheme) return;
    themeActif = idTheme;
    const t = THEMES[idTheme] || THEMES['bleu-france'];
    const camembert = idTheme === 'monochrome' || idTheme === 'contraste'
        ? ['#161616', '#929292', '#3a3a3a', '#cecece', '#666666', '#e5e5e5', '#000000', '#b5b5b5', '#4d4d4d', '#dddddd', '#777777', '#f6f6f6']
        : ILLUSTRATIVES;
    const variables = {
        primaryColor: t.fond, primaryTextColor: '#161616', primaryBorderColor: t.bord,
        lineColor: t.trait, secondaryColor: t.second, tertiaryColor: t.tiers,
        textColor: '#161616', mainBkg: t.fond, nodeBorder: t.bord,
        clusterBkg: t.second, clusterBorder: t.bord, edgeLabelBackground: '#ffffff',
        noteBkgColor: '#fef7da', noteBorderColor: '#b34000', noteTextColor: '#161616',
        actorBkg: t.fond, actorBorder: t.bord, signalColor: t.trait, signalTextColor: '#161616',
        fontFamily: POLICE, fontSize: '16px',
    };
    camembert.forEach((c, i) => { variables[`pie${i + 1}`] = c; });
    window.mermaid.initialize({
        startOnLoad: false,
        // Sécurité (§7.2) : ces clés ne peuvent pas être surchargées par une directive du schéma
        securityLevel: 'strict',
        secure: ['secure', 'securityLevel', 'startOnLoad', 'maxTextSize', 'maxEdges', 'htmlLabels', 'themeCSS', 'fontFamily', 'suppressErrorRendering', 'dompurifyConfig'],
        maxTextSize: TAILLE_MAX_CODE,
        maxEdges: LIENS_MAX,
        suppressErrorRendering: true,
        htmlLabels: false,
        flowchart: { htmlLabels: false, useMaxWidth: false, wrappingWidth: 220 },
        sequence: { useMaxWidth: false },
        gantt: { useMaxWidth: false, useWidth: 1100 },
        pie: { useMaxWidth: false },
        mindmap: { useMaxWidth: false },
        theme: 'base',
        themeVariables: variables,
        fontFamily: POLICE,
    });
}

// ---------- Rendu d'un schéma ----------

const cache = new Map();
let file = Promise.resolve();
let numero = 0;
// Identifiant propre à cette instance du module : deux instances ne peuvent pas se marcher dessus
const graine = Math.random().toString(36).slice(2, 8);

function nettoyerOrphelins(id) {
    for (const el of document.querySelectorAll(`#${id}, #d${id}, #i${id}`)) el.remove();
}

async function rendre(code, idTheme) {
    await document.fonts.ready;
    configurer(idTheme);
    const propre = nettoyerCode(code);
    if (!propre.trim()) throw new Error('La page ne contient aucun code.');
    numero += 1;
    const id = `fusain-${graine}-${numero}`;
    try {
        await window.mermaid.parse(propre);
        const { svg: chaine } = await window.mermaid.render(id, propre);
        const svg = assainirSvg(chaine);
        const vb = (svg.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
        let [, , l, h] = vb.length === 4 && vb.every(Number.isFinite) ? vb : [0, 0, 0, 0];
        if (!(l > 0 && h > 0)) {
            l = parseFloat(svg.getAttribute('width')) || 800;
            h = parseFloat(svg.getAttribute('height')) || 600;
            svg.setAttribute('viewBox', `0 0 ${l} ${h}`);
        }
        svg.removeAttribute('style');
        remplacerHtmlIncorpore(svg);
        // Libellés de section du parcours usager : blancs par défaut, illisibles sur les fonds clairs du thème
        svg.querySelector('style')?.append(`#${id} text.journey-section{fill:#161616;}`);
        centrerLibelles(svg, l, h);
        return { svg, l, h, htmlIncorpore: Boolean(svg.querySelector('foreignObject')) };
    } finally {
        nettoyerOrphelins(id);
    }
}

// Quelques types de schémas (parcours usager…) placent leurs libellés dans du HTML incorporé (foreignObject),
// que ni la conversion en image ni la conversion en PDF ne savent traiter de façon fiable. Chaque bloc est
// remplacé par un texte SVG équivalent, centré dans la même boîte et replié à sa largeur.
let mesure = null;
function remplacerHtmlIncorpore(svg) {
    for (const bloc of [...svg.querySelectorAll('foreignObject')]) {
        const [x, y, l, h] = ['x', 'y', 'width', 'height'].map((n) => parseFloat(bloc.getAttribute(n)) || 0);
        const contenu = bloc.textContent.replace(/\s+/g, ' ').trim();
        if (!contenu || l <= 0) { bloc.remove(); continue; }
        const interne = bloc.querySelector('[style*="font-size"]');
        const taille = Math.max(8, Math.min(parseFloat(interne?.style.fontSize) || 14, 24));
        mesure ||= document.createElement('canvas').getContext('2d');
        mesure.font = `${taille}px ${POLICE}`;
        const lignes = [''];
        for (const mot of contenu.split(' ')) {
            const essai = lignes[lignes.length - 1] ? `${lignes[lignes.length - 1]} ${mot}` : mot;
            if (lignes[lignes.length - 1] && mesure.measureText(essai).width > l) lignes.push(mot); else lignes[lignes.length - 1] = essai;
        }
        const interligne = taille * 1.2;
        const premier = y + h / 2 - ((lignes.length - 1) * interligne) / 2 + taille * 0.35;
        const texte = s('text', { 'text-anchor': 'middle', 'font-family': POLICE, 'font-size': taille, fill: '#161616', class: 'fusain-libelle' },
            lignes.map((ligne, i) => s('tspan', { x: x + l / 2, y: premier + i * interligne }, ligne)));
        bloc.replaceWith(texte);
    }
    // Mermaid double parfois le HTML d'un texte SVG de repli dans un <switch> : une fois le HTML retiré,
    // le repli est sorti de son enveloppe, que les convertisseurs PDF ne connaissent pas.
    for (const choix of [...svg.querySelectorAll('switch')]) choix.replaceWith(...choix.childNodes);
}

// Mermaid suppose des libellés HTML dans les cartes mentales et les diagrammes d'états : en SVG, certains ne sont pas centrés
// sur leur forme. L'écart est mesuré dans le navigateur puis corrigé nœud par nœud.
function centrerLibelles(svg, l, h) {
    const noeuds = svg.querySelectorAll('g.mindmap-node, g.statediagram-state');
    if (!noeuds.length) return;
    const atelier = document.createElement('div');
    atelier.className = 'fusain-hors-ecran';
    svg.setAttribute('width', l);
    svg.setAttribute('height', h);
    document.body.append(atelier);
    atelier.append(svg);
    try {
        const ecarts = [];
        for (const g of noeuds) {
            const forme = g.querySelector(':scope > :is(circle, rect, path, polygon, ellipse), :scope > g > :is(rect, path)');
            const libelle = g.querySelector(':scope > g.label');
            const texte = libelle?.querySelector('text');
            if (!forme || !texte) continue;
            const f = forme.getBoundingClientRect();
            const t = texte.getBoundingClientRect();
            const dx = (f.left + f.width / 2) - (t.left + t.width / 2);
            if (Math.abs(dx) > 2) ecarts.push([libelle, dx]);
        }
        for (const [libelle, dx] of ecarts) libelle.setAttribute('transform', `translate(${dx}, 0) ${libelle.getAttribute('transform') || ''}`);
    } finally {
        svg.remove();
        atelier.remove();
        svg.removeAttribute('width');
        svg.removeAttribute('height');
    }
}

// Les rendus sont mis en file : Mermaid ne supporte pas les appels concurrents
export function rendreSchema(code, idTheme) {
    // Page vierge : aucun schéma, seule la mise en page (titre, pied de page) est composée
    if (!String(code).trim()) return Promise.resolve(null);
    const cle = `${idTheme}\n${code}`;
    if (cache.has(cle)) return Promise.resolve(cache.get(cle));
    const tache = file.then(() => rendre(code, idTheme));
    file = tache.catch(() => {});
    return tache.then((resultat) => {
        cache.set(cle, resultat);
        if (cache.size > 60) cache.delete(cache.keys().next().value);
        return resultat;
    });
}

// Message d'erreur lisible, avec le numéro de ligne quand Mermaid le fournit
export function decrireErreur(erreur) {
    const brut = String(erreur?.message || erreur || 'Erreur inconnue');
    const ligne = brut.match(/line\s+(\d+)/i);
    let texte = brut.split('\n').slice(0, 4).join('\n');
    if (/^(Parse|Lexical) error/i.test(brut)) texte = 'La syntaxe du schéma est incorrecte.\n' + brut.split('\n').slice(1, 3).join('\n');
    if (/Edge limit exceeded/i.test(brut)) texte = `Le schéma dépasse le nombre maximal de liens (${LIENS_MAX}). Répartissez-le sur plusieurs pages.`;
    if (/Maximum text size/i.test(brut)) texte = 'Le code du schéma dépasse la taille maximale autorisée.';
    if (/No diagram type detected|UnknownDiagramError/i.test(brut)) texte = 'Type de schéma non reconnu : la première ligne doit annoncer le type (flowchart, sequenceDiagram, pie…).';
    return { texte, ligne: ligne ? Number(ligne[1]) : null };
}

// ---------- Composition de la page ----------

export function texteDePied(page, index, total) {
    return page.piedDePage
        .replaceAll('{n}', String(index + 1))
        .replaceAll('{total}', String(total))
        .replaceAll('{date}', new Date().toLocaleDateString('fr-FR'));
}

export function zoneUtile(page) {
    const { l, h } = dimensions(page);
    const m = page.margesMm;
    const haut = m + (page.titre ? 11 : 0) + (page.sousTitre ? 7 : 0);
    const bas = h - m - (page.piedDePage ? 6 : 0);
    return { x: m, y: haut, l: Math.max(10, l - 2 * m), h: Math.max(10, bas - haut) };
}

// Construit le SVG de la page entière, en millimètres : c'est lui qui est affiché, puis exporté tel quel.
export function composerPage(page, schema, { index = 0, total = 1, guides = false } = {}) {
    const { l, h } = dimensions(page);
    const zone = zoneUtile(page);
    const svg = s('svg', { xmlns: 'http://www.w3.org/2000/svg', viewBox: `0 0 ${l} ${h}`, class: 'fusain-page' },
        // Titre et description accessibles : lus par les lecteurs d'écran, conservés dans l'export SVG
        s('title', {}, page.titre || page.nom),
        page.description ? s('desc', {}, page.description) : null,
        s('rect', { class: 'fusain-fond', x: 0, y: 0, width: l, height: h, fill: '#ffffff' }));

    if (page.titre) {
        svg.append(s('text', { x: l / 2, y: page.margesMm + 6, 'text-anchor': 'middle', 'font-family': POLICE, 'font-size': 7, 'font-weight': 700, fill: '#161616' }, page.titre));
    }
    if (page.sousTitre) {
        svg.append(s('text', { x: l / 2, y: page.margesMm + (page.titre ? 13 : 5), 'text-anchor': 'middle', 'font-family': POLICE, 'font-size': 4.2, fill: '#3a3a3a' }, page.sousTitre));
    }
    if (page.piedDePage) {
        svg.append(s('text', { x: l / 2, y: h - page.margesMm, 'text-anchor': 'middle', 'font-family': POLICE, 'font-size': 3.2, fill: '#3a3a3a' }, texteDePied(page, index, total)));
    }
    if (guides) svg.append(s('rect', { class: 'fusain-marges', x: page.margesMm, y: page.margesMm, width: Math.max(0, l - 2 * page.margesMm), height: Math.max(0, h - 2 * page.margesMm) }));

    let pointsTexte = null;
    let deborde = false;
    if (schema) {
        const a = page.ajustement;
        let k;
        if (a.mode === 'largeur') k = zone.l / schema.l;
        else if (a.mode === 'hauteur') k = zone.h / schema.h;
        else if (a.mode === 'manuel') k = (a.echelle / 100) * MM_PAR_PX;
        else k = Math.min(zone.l / schema.l, zone.h / schema.h, 2 * MM_PAR_PX);
        const dl = schema.l * k;
        const dh = schema.h * k;
        const y = a.alignement === 'haut' ? 0 : a.alignement === 'bas' ? zone.h - dh : (zone.h - dh) / 2;
        const clone = schema.svg.cloneNode(true);
        clone.setAttribute('x', (zone.l - dl) / 2);
        clone.setAttribute('y', y);
        clone.setAttribute('width', dl);
        clone.setAttribute('height', dh);
        clone.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        clone.classList.add('fusain-schema');
        svg.append(s('svg', { class: 'fusain-zone', x: zone.x, y: zone.y, width: zone.l, height: zone.h, viewBox: `0 0 ${zone.l} ${zone.h}`, overflow: 'hidden' }, clone));
        pointsTexte = 16 * k * 72 / 25.4;
        deborde = dl > zone.l + 0.01 || dh > zone.h + 0.01;
    }
    return { svg, l, h, pointsTexte, deborde };
}

// ---------- Polices incorporées pour les exports en image ----------

const FICHIERS_POLICE = [
    ['400', 'Marianne-Regular'], ['500', 'Marianne-Medium'], ['700', 'Marianne-Bold'],
];
export const DOSSIER_DSFR = './libs/dsfr-v1.15.4';
let reglePolices = null;

export async function binaireEnBase64(url) {
    const reponse = await fetch(url);
    if (!reponse.ok) throw new Error(`Ressource introuvable : ${url}`);
    const octets = new Uint8Array(await reponse.arrayBuffer());
    let binaire = '';
    for (let i = 0; i < octets.length; i += 0x8000) binaire += String.fromCharCode.apply(null, octets.subarray(i, i + 0x8000));
    return btoa(binaire);
}

export async function reglesPolices() {
    if (reglePolices === null) {
        const regles = await Promise.all(FICHIERS_POLICE.map(async ([graisse, nom]) => {
            const b64 = await binaireEnBase64(`${DOSSIER_DSFR}/fonts/${nom}.woff2`);
            return `@font-face{font-family:Marianne;font-weight:${graisse};font-style:normal;src:url(data:font/woff2;base64,${b64}) format("woff2")}`;
        }));
        reglePolices = regles.join('\n');
    }
    return reglePolices;
}
