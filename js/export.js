// Exports PDF, PNG et SVG — produits dans le navigateur (cahier des charges §5.8)
import { h, s } from './dom.js';
import { rendreSchema, composerPage, reglesPolices, binaireEnBase64, DOSSIER_DSFR } from './rendu.js';
import { telecharger, nomDocument } from './fichier.js';

const NS_SVG = 'http://www.w3.org/2000/svg';

function deuxChiffres(n) { return String(n).padStart(2, '0'); }

async function pagesComposees(doc, indices) {
    const sorties = [];
    for (const i of indices) {
        const page = doc.pages[i];
        let schema = null;
        try {
            schema = await rendreSchema(page.code, doc.document.theme);
        } catch {
            throw new Error(`La page « ${page.nom} » contient une erreur de syntaxe : corrigez-la avant d'exporter.`);
        }
        sorties.push({ page, schema, index: i, ...composerPage(page, schema, { index: i, total: doc.pages.length }) });
    }
    return sorties;
}

async function svgAutonome(svg, largeurPx, hauteurPx) {
    const clone = svg.cloneNode(true);
    clone.setAttribute('xmlns', NS_SVG);
    clone.setAttribute('width', largeurPx);
    clone.setAttribute('height', hauteurPx);
    clone.prepend(s('style', {}, await reglesPolices()));
    return new XMLSerializer().serializeToString(clone);
}

async function svgEnCanvas(svg, largeurPx, hauteurPx, transparent) {
    const chaine = await svgAutonome(svg, largeurPx, hauteurPx);
    const url = URL.createObjectURL(new Blob([chaine], { type: 'image/svg+xml;charset=utf-8' }));
    try {
        const image = new Image();
        image.src = url;
        await image.decode();
        const canvas = h('canvas', { width: largeurPx, height: hauteurPx });
        const ctx = canvas.getContext('2d');
        if (!transparent) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, largeurPx, hauteurPx); }
        ctx.drawImage(image, 0, 0, largeurPx, hauteurPx);
        return canvas;
    } finally {
        URL.revokeObjectURL(url);
    }
}

function canvasEnBlob(canvas) {
    return new Promise((resoudre, rejeter) => canvas.toBlob((b) => (b ? resoudre(b) : rejeter(new Error('La conversion en image a échoué.'))), 'image/png'));
}

function preparerImage(c, { schemaSeul, transparent, ppp }) {
    let svg = c.svg;
    let lpx = Math.round(c.l / 25.4 * ppp);
    let hpx = Math.round(c.h / 25.4 * ppp);
    if (schemaSeul) {
        svg = c.schema.svg.cloneNode(true);
        lpx = Math.round(c.schema.l * ppp / 96);
        hpx = Math.round(c.schema.h * ppp / 96);
    } else if (transparent) {
        svg = c.svg.cloneNode(true);
        svg.querySelector('.fusain-fond')?.remove();
    }
    return { svg, lpx, hpx };
}

export async function exporterPNG(doc, indices, options) {
    const composees = await pagesComposees(doc, indices);
    const base = nomDocument(doc);
    for (const c of composees) {
        const { svg, lpx, hpx } = preparerImage(c, options);
        const canvas = await svgEnCanvas(svg, lpx, hpx, options.transparent);
        const suffixe = composees.length > 1 || doc.pages.length > 1 ? `_page-${deuxChiffres(c.index + 1)}` : '';
        telecharger(await canvasEnBlob(canvas), `${base}${suffixe}.png`);
        if (composees.length > 1) await new Promise((r) => setTimeout(r, 250));
    }
    return composees.length;
}

export async function exporterSVG(doc, indices, options) {
    const composees = await pagesComposees(doc, indices);
    const base = nomDocument(doc);
    for (const c of composees) {
        const svg = options.schemaSeul ? c.schema.svg : c.svg;
        const largeur = options.schemaSeul ? `${c.schema.l}px` : `${c.l}mm`;
        const hauteur = options.schemaSeul ? `${c.schema.h}px` : `${c.h}mm`;
        const chaine = await svgAutonome(svg, largeur, hauteur);
        const suffixe = doc.pages.length > 1 ? `_page-${deuxChiffres(c.index + 1)}` : '';
        telecharger(new Blob([chaine], { type: 'image/svg+xml;charset=utf-8' }), `${base}${suffixe}.svg`);
        if (composees.length > 1) await new Promise((r) => setTimeout(r, 250));
    }
    return composees.length;
}

// ---------- PDF vectoriel ----------

const PRESENTATION = ['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit',
    'opacity', 'fill-opacity', 'stroke-opacity', 'font-family', 'font-size', 'font-weight', 'font-style', 'text-anchor', 'dominant-baseline'];

function couleur(valeur) {
    const m = valeur.match(/^rgba\(\s*([\d.]+),\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)\s*\)$/);
    return m ? { rgb: `rgb(${m[1]}, ${m[2]}, ${m[3]})`, alpha: Number(m[4]) } : { rgb: valeur, alpha: 1 };
}

// svg2pdf ne lit pas les feuilles de style de Mermaid de façon fiable : les styles calculés par le
// navigateur sont recopiés en attributs de présentation, puis les feuilles sont retirées.
function figerStyles(svg) {
    const releves = [];
    for (const el of svg.querySelectorAll('*')) {
        if (el.localName === 'style' || el.localName === 'title' || el.localName === 'desc') continue;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' && !el.closest('defs')) { releves.push([el, null]); continue; }
        const attrs = {};
        for (const p of PRESENTATION) attrs[p] = cs.getPropertyValue(p);
        releves.push([el, attrs]);
    }
    for (const [el, attrs] of releves) {
        if (!attrs) { el.remove(); continue; }
        for (const cle of ['fill', 'stroke']) {
            const { rgb, alpha } = couleur(attrs[cle]);
            attrs[cle] = rgb;
            if (alpha < 1) attrs[`${cle}-opacity`] = String(Number(attrs[`${cle}-opacity`] || 1) * alpha);
        }
        attrs['font-size'] = String(parseFloat(attrs['font-size']) || 16);
        attrs['stroke-width'] = String(parseFloat(attrs['stroke-width']) || 0);
        attrs['font-family'] = 'Marianne';
        attrs['font-style'] = 'normal'; // seules les graisses normale et grasse de Marianne sont incorporées
        attrs['font-weight'] = Number(attrs['font-weight']) >= 600 ? 'bold' : 'normal';
        // Un motif sans plein ou sans vide (« 0 », « 1, 0 ») désigne un trait continu
        const motif = attrs['stroke-dasharray'].replace(/px/g, '');
        const valeurs = motif.split(/[\s,]+/).map(Number);
        const continu = motif === 'none' || valeurs.some(Number.isNaN) || valeurs.every((v) => v === 0) || valeurs.every((v, i) => i % 2 === 0 || v === 0);
        if (continu) { delete attrs['stroke-dasharray']; el.removeAttribute('stroke-dasharray'); } else attrs['stroke-dasharray'] = motif;
        for (const [cle, valeur] of Object.entries(attrs)) if (valeur !== '') el.setAttribute(cle, valeur);
        el.removeAttribute('style');
        el.removeAttribute('class');
    }
    for (const style of svg.querySelectorAll('style')) style.remove();
}

// svg2pdf interprète de façon incomplète les décalages (dy), les lignes de base et les tspans imbriqués.
// Chaque fragment de texte est donc réécrit à la position exacte calculée par le navigateur.
function aplatirTextes(svg) {
    for (const texte of [...svg.querySelectorAll('text')]) {
        if (texte.querySelector('textPath')) continue;
        const feuilles = [];
        const parcourir = (el) => {
            for (const enfant of el.childNodes) {
                if (enfant.nodeType === Node.TEXT_NODE) { if (enfant.data.trim()) feuilles.push([el, enfant]); }
                else if (enfant.nodeType === Node.ELEMENT_NODE && enfant.localName === 'tspan') parcourir(enfant);
            }
        };
        parcourir(texte);
        const fragments = [];
        try {
            // Rang du premier caractère de chaque fragment dans le texte complet
            let rang = 0;
            const marcheur = document.createTreeWalker(texte, NodeFilter.SHOW_TEXT);
            const rangs = new Map();
            for (let n = marcheur.nextNode(); n; n = marcheur.nextNode()) { rangs.set(n, rang); rang += n.data.length; }
            for (const [el, noeud] of feuilles) {
                const debut = noeud.data.search(/\S/);
                const point = texte.getStartPositionOfChar(rangs.get(noeud) + debut);
                const cs = getComputedStyle(el);
                fragments.push({ x: point.x, y: point.y, contenu: noeud.data.trim(), fill: cs.fill, taille: cs.fontSize, graisse: cs.fontWeight, opacite: cs.fillOpacity });
            }
        } catch {
            continue; // texte non affiché : laissé tel quel
        }
        if (!fragments.length) continue;
        const groupe = s('g', {});
        for (const nom of ['transform', 'class', 'id']) if (texte.hasAttribute(nom)) groupe.setAttribute(nom, texte.getAttribute(nom));
        for (const f of fragments) {
            const t = s('text', { x: f.x, y: f.y }, f.contenu);
            t.style.fill = f.fill;
            t.style.fillOpacity = f.opacite;
            t.style.fontSize = f.taille;
            t.style.fontWeight = f.graisse;
            t.style.textAnchor = 'start';
            t.style.dominantBaseline = 'alphabetic';
            t.style.stroke = 'none';
            groupe.append(t);
        }
        texte.replaceWith(groupe);
    }
}

export function preparerPourPdf(svg) {
    aplatirTextes(svg);
    figerStyles(svg);
}

let policesPdf = null;
async function chargerPolicesPdf() {
    if (!policesPdf) {
        policesPdf = await Promise.all(['Regular', 'Bold'].map((n) => binaireEnBase64(`${DOSSIER_DSFR}/fonts-ttf/Marianne-${n}.ttf`)));
    }
    return policesPdf;
}

export async function exporterPDF(doc, indices) {
    const { jsPDF } = window.jspdf;
    const composees = await pagesComposees(doc, indices);
    const [regulier, gras] = await chargerPolicesPdf();
    const orientation = (c) => (c.l > c.h ? 'landscape' : 'portrait');
    const premiere = composees[0];
    const pdf = new jsPDF({ unit: 'mm', format: [premiere.l, premiere.h], orientation: orientation(premiere), compress: true });
    pdf.addFileToVFS('Marianne-Regular.ttf', regulier);
    pdf.addFont('Marianne-Regular.ttf', 'Marianne', 'normal');
    pdf.addFileToVFS('Marianne-Bold.ttf', gras);
    pdf.addFont('Marianne-Bold.ttf', 'Marianne', 'bold');
    pdf.setProperties({ title: doc.document.titre, creator: 'FUSAIN' });

    const atelier = h('div', { class: 'fusain-hors-ecran', 'aria-hidden': 'true' });
    document.body.append(atelier);
    const enImage = [];
    try {
        for (const [n, c] of composees.entries()) {
            if (n > 0) pdf.addPage([c.l, c.h], orientation(c));
            let vectoriel = !c.schema.htmlIncorpore;
            if (vectoriel) {
                try {
                    c.svg.setAttribute('width', `${c.l}mm`);
                    c.svg.setAttribute('height', `${c.h}mm`);
                    atelier.replaceChildren(c.svg);
                    preparerPourPdf(c.svg);
                    await window.svg2pdf.svg2pdf(c.svg, pdf, { x: 0, y: 0, width: c.l, height: c.h });
                } catch (e) {
                    console.warn('Conversion vectorielle impossible, repli en image', e);
                    vectoriel = false;
                }
            }
            if (!vectoriel) {
                // Repli : page insérée en image à 300 ppp
                const frais = composerPage(c.page, c.schema, { index: c.index, total: doc.pages.length });
                const canvas = await svgEnCanvas(frais.svg, Math.round(c.l / 25.4 * 300), Math.round(c.h / 25.4 * 300), false);
                pdf.addImage(canvas, 'PNG', 0, 0, c.l, c.h, undefined, 'FAST');
                enImage.push(c.page.nom);
            }
        }
    } finally {
        atelier.remove();
    }
    telecharger(pdf.output('blob'), `${nomDocument(doc)}.pdf`);
    return { pages: composees.length, enImage };
}
