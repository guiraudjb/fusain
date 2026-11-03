// Export Microsoft Visio (.vsdx) : le SVG de chaque page, préparé comme pour le PDF, est relu dans le navigateur
// (positions et styles calculés) puis traduit en formes Visio modifiables (format : visio-format.js).
import { h } from './dom.js';
import { composerPage } from './rendu.js';
import { pagesComposees, preparerPourPdf, svgEnCanvas, canvasEnBlob } from './export.js';
import { telecharger, nomDocument } from './fichier.js';
import { typeDiagramme } from './securite.js';
import { editeurPour } from './diagrammes/index.js';
import { lireTrace, traceRectangle, traceEllipse, tracePoints, aplatir, construireVsdx } from './visio-format.js';
import { ecrireZip } from './zip.js';

const IGNORES = new Set(['defs', 'marker', 'clipPath', 'mask', 'pattern', 'symbol', 'style', 'title', 'desc', 'linearGradient', 'radialGradient', 'foreignObject', 'script', 'metadata', 'filter']);
const EXTREMITE_ETAT = '[*]';

// « rgb(r, g, b) » → « #rrggbb » ; null pour « none » ou une valeur illisible
function hexa(valeur) {
    const m = String(valeur || '').match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
    if (m) return `#${[m[1], m[2], m[3]].map((v) => Math.max(0, Math.min(255, Math.round(Number(v)))).toString(16).padStart(2, '0')).join('')}`;
    if (/^#[0-9a-f]{6}$/i.test(valeur)) return valeur.toLowerCase();
    if (/^#[0-9a-f]{3}$/i.test(valeur)) return `#${[...valeur.slice(1)].map((c) => c + c).join('')}`.toLowerCase();
    return null;
}

// Un remplissage en dégradé prend la couleur moyenne de ses arrêts
function couleurDe(valeur, racine) {
    const url = String(valeur || '').match(/^url\(["']?#([^"')]+)["']?\)/);
    if (!url) return hexa(valeur);
    const teintes = [...(racine.querySelector(`[id="${CSS.escape(url[1])}"]`)?.querySelectorAll('stop') || [])]
        .map((arret) => (arret.getAttribute('stop-color') || getComputedStyle(arret).stopColor).match(/[\d.]+/g)?.slice(0, 3).map(Number)).filter((t) => t?.length === 3);
    if (!teintes.length) return null;
    return hexa(`rgb(${[0, 1, 2].map((i) => teintes.reduce((n, t) => n + t[i], 0) / teintes.length).join(',')})`);
}

const nombreAttr = (el, nom, defaut = 0) => {
    const v = parseFloat(el.getAttribute(nom));
    return Number.isFinite(v) ? v : defaut;
};
const longueur = (el, nom) => {
    try { return el[nom].baseVal.value; } catch { return nombreAttr(el, nom); }
};

function tracesDe(el) {
    switch (el.localName) {
        case 'path': return lireTrace(el.getAttribute('d'));
        case 'rect': return traceRectangle(longueur(el, 'x'), longueur(el, 'y'), longueur(el, 'width'), longueur(el, 'height'), nombreAttr(el, 'rx'), nombreAttr(el, 'ry'));
        case 'circle': { const r = longueur(el, 'r'); return traceEllipse(longueur(el, 'cx'), longueur(el, 'cy'), r, r); }
        case 'ellipse': return traceEllipse(longueur(el, 'cx'), longueur(el, 'cy'), longueur(el, 'rx'), longueur(el, 'ry'));
        case 'line': return lireTrace(`M${longueur(el, 'x1')} ${longueur(el, 'y1')}L${longueur(el, 'x2')} ${longueur(el, 'y2')}`);
        case 'polyline': return tracePoints(el.getAttribute('points'), false);
        case 'polygon': return tracePoints(el.getAttribute('points'), true);
        default: return null;
    }
}

// Flèche Visio d'après le marqueur SVG (13 : pointe pleine, 10 : rond, 0 : rien)
function fleche(el, cote) {
    const v = el.getAttribute(`marker-${cote}`);
    if (!v || v === 'none') return 0;
    if (/circle|dot/i.test(v)) return 10;
    if (/cross/i.test(v)) return 0;
    return 13;
}

function octetsDeDataUrl(url) {
    const m = String(url).match(/^data:image\/(png|jpe?g);base64,(.+)$/i);
    if (!m) return null;
    const binaire = atob(m[2]);
    const octets = new Uint8Array(binaire.length);
    for (let i = 0; i < binaire.length; i += 1) octets[i] = binaire.charCodeAt(i);
    return { octets, type: m[1].toLowerCase() === 'png' ? 'png' : 'jpeg' };
}

// Liaisons du modèle (de → vers) et clés des nœuds qu'elles relient
function liaisons(page) {
    const editeur = editeurPour(typeDiagramme(page.code));
    if (!editeur) return { editeur: null, modele: null, liens: [] };
    let modele = null;
    try { modele = editeur.analyser(page.code); } catch { return { editeur: null, modele: null, liens: [] }; }
    const liste = modele.liens || modele.transitions || modele.relations || [];
    const cle = (id, cote) => (id === EXTREMITE_ETAT ? (cote === 'de' ? 's:debut' : 's:fin') : `n:${id}`);
    return { editeur, modele, liens: liste.map((l) => (l && l.de !== undefined && l.vers !== undefined ? { de: cle(l.de, 'de'), vers: cle(l.vers, 'vers') } : null)) };
}

// Parcours d'une page préparée : objets en millimètres de page
function relirePage(racine, modeleLiens, medias, bilan) {
    const inverse = racine.getScreenCTM().inverse();
    const matrice = (el) => inverse.multiply(el.getScreenCTM());
    const noeuds = new Map(); // clé n:… → groupe
    const connecteurs = [];
    const etiquettes = new Map(); // clé l:… → fragments de texte

    const texteDe = (el, m, opacite) => {
        const contenu = el.textContent.replace(/\s+/g, ' ').trim();
        if (!contenu) return null;
        let b;
        try { b = el.getBBox(); } catch { return null; }
        if (!b.width && !b.height) return null;
        const echelle = Math.hypot(m.a, m.b);
        const cx = b.x + b.width / 2;
        const cy = b.y + b.height / 2;
        const fill = el.getAttribute('fill');
        const couleur = couleurDe(fill, racine);
        if (!couleur) return null;
        const alpha = nombreAttr(el, 'fill-opacity', 1) * opacite;
        if (alpha <= 0.001) return null;
        return {
            genre: 'texte',
            centre: [m.a * cx + m.c * cy + m.e, m.b * cx + m.d * cy + m.f],
            largeur: b.width * echelle,
            hauteur: b.height * echelle,
            angle: Math.atan2(m.b, m.a),
            texte: contenu,
            aligne: 0,
            police: { taille: nombreAttr(el, 'font-size', 16) * echelle, couleur, trans: 1 - alpha, gras: el.getAttribute('font-weight') === 'bold' },
        };
    };

    const imageDe = (el, m, sortie) => {
        const href = el.getAttribute('href') || el.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
        if (el.closest('[clip-path]') || el.hasAttribute('clip-path')) { bilan.imagesIgnorees += 1; return; }
        const media = octetsDeDataUrl(href);
        if (!media) { bilan.imagesIgnorees += 1; return; }
        let nom = medias.parUrl.get(href);
        if (!nom) {
            nom = `image${medias.parUrl.size + 1}.${media.type === 'png' ? 'png' : 'jpeg'}`;
            medias.parUrl.set(href, nom);
            medias.fichiers.set(nom, media);
        }
        const x = longueur(el, 'x');
        const y = longueur(el, 'y');
        const l = longueur(el, 'width');
        const ht = longueur(el, 'height');
        if (!(l > 0 && ht > 0)) return;
        const cx = x + l / 2;
        const cy = y + ht / 2;
        sortie.push({ genre: 'image', centre: [m.a * cx + m.c * cy + m.e, m.b * cx + m.d * cy + m.f], largeur: l * Math.hypot(m.a, m.b), hauteur: ht * Math.hypot(m.c, m.d), angle: Math.atan2(m.b, m.a), media: nom });
    };

    const formeDe = (el, m, opacite) => {
        const traces = tracesDe(el);
        if (!traces?.length) return null;
        const echelle = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1;
        const chemins = aplatir(traces, m, 0.06);
        if (!chemins.length) return null;
        const remplissage = couleurDe(el.getAttribute('fill'), racine);
        const alphaRemp = nombreAttr(el, 'fill-opacity', 1) * opacite;
        const trait = couleurDe(el.getAttribute('stroke'), racine);
        const alphaTrait = nombreAttr(el, 'stroke-opacity', 1) * opacite;
        const epaisseur = nombreAttr(el, 'stroke-width', 0) * echelle;
        const motif = el.getAttribute('stroke-dasharray');
        const premier = motif ? parseFloat(motif) : 0;
        const style = {
            remplissage: remplissage && alphaRemp > 0.001 && chemins.some((c) => c.ferme || c.points.length > 2) ? remplissage : null,
            transRemplissage: 1 - alphaRemp,
            trait: trait && alphaTrait > 0.001 && epaisseur > 0 ? trait : null,
            transTrait: 1 - alphaTrait,
            epaisseur,
            motif: motif ? (premier * echelle <= epaisseur * 1.5 ? 3 : 2) : 1,
            debut: fleche(el, 'start'),
            fin: fleche(el, 'end'),
        };
        if (!style.remplissage && !style.trait) return null;
        return { genre: 'geo', chemins, style };
    };

    // sortie : liste où ranger les objets ; ctx : { noeud (clé n:… en cours), etiquette (clé l:… en cours) }
    const parcourir = (el, sortie, opacite, ctx) => {
        if (el.nodeType !== Node.ELEMENT_NODE || IGNORES.has(el.localName)) return;
        if (el.classList?.contains('fusain-fond')) return;
        if (el.getAttribute('display') === 'none' || el.getAttribute('visibility') === 'hidden') return;
        const op = opacite * nombreAttr(el, 'opacity', 1);
        if (op <= 0.001) return;
        const marque = el.getAttribute('data-fusain') || '';

        // Nœud : un groupe Visio, dont le libellé est le texte
        if (!ctx.noeud && !ctx.etiquette && /^[ns]:/.test(marque) && !noeuds.has(marque)) {
            const groupe = { genre: 'groupe', enfants: [], fragments: [], cle: marque };
            const conteneur = el.localName === 'g' || el.localName === 'svg' || el.localName === 'a';
            for (const enfant of conteneur ? el.children : [el]) parcourir(enfant, groupe.enfants, conteneur ? op : opacite, { noeud: groupe });
            if (groupe.enfants.length || groupe.fragments.length) { noeuds.set(marque, groupe); sortie.push(groupe); }
            return;
        }
        // Étiquette d'une liaison : son texte devient celui du connecteur
        if (!ctx.noeud && !ctx.etiquette && /^l:/.test(marque) && el.localName === 'g') {
            const fragments = [];
            for (const enfant of el.children) parcourir(enfant, [], op, { etiquette: fragments });
            if (fragments.length) etiquettes.set(marque, [...(etiquettes.get(marque) || []), ...fragments]);
            return;
        }
        if (el.localName === 'svg' || el.localName === 'g' || el.localName === 'a' || el.localName === 'switch') {
            for (const enfant of el.children) parcourir(enfant, sortie, op, ctx);
            return;
        }
        let m;
        try { m = matrice(el); } catch { return; }
        if (el.localName === 'text') {
            const t = texteDe(el, m, op);
            if (!t) return;
            if (ctx.etiquette) ctx.etiquette.push(t);
            else if (ctx.noeud) ctx.noeud.fragments.push(t);
            else sortie.push(t);
            return;
        }
        if (el.localName === 'image') { if (!ctx.etiquette) imageDe(el, m, sortie); return; }
        if (ctx.etiquette) return; // fond de l'étiquette : remplacé par le fond du texte du connecteur
        const forme = formeDe(el, m, op);
        if (!forme) return;
        const lien = /^l:\d+$/.test(marque) && el.localName === 'path' && !ctx.noeud ? modeleLiens[Number(marque.slice(2))] : undefined;
        if (lien !== undefined && forme.chemins.length === 1 && !forme.chemins[0].ferme) {
            const c = { genre: 'connecteur', points: forme.chemins[0].points, style: forme.style, cle: marque, lien };
            connecteurs.push(c);
            sortie.push(c);
            return;
        }
        sortie.push(forme);
    };

    const objets = [];
    parcourir(racine, objets, 1, {});

    // Texte d'un groupe : fragments rangés par ligne
    const rassembler = (fragments) => {
        if (!fragments.length) return null;
        const tries = [...fragments].sort((a, b) => a.centre[1] - b.centre[1] || a.centre[0] - b.centre[0]);
        const lignes = [];
        for (const f of tries) {
            const derniere = lignes[lignes.length - 1];
            if (derniere && Math.abs(derniere[0].centre[1] - f.centre[1]) < f.hauteur * 0.5) derniere.push(f);
            else lignes.push([f]);
        }
        const x0 = Math.min(...fragments.map((f) => f.centre[0] - f.largeur / 2));
        const x1 = Math.max(...fragments.map((f) => f.centre[0] + f.largeur / 2));
        const y0 = Math.min(...fragments.map((f) => f.centre[1] - f.hauteur / 2));
        const y1 = Math.max(...fragments.map((f) => f.centre[1] + f.hauteur / 2));
        return {
            centre: [(x0 + x1) / 2, (y0 + y1) / 2], largeur: x1 - x0, hauteur: y1 - y0,
            texte: lignes.map((l) => l.sort((a, b) => a.centre[0] - b.centre[0]).map((f) => f.texte).join(' ')).join('\n'),
            // Police du fragment le plus long : un pictogramme isolé (« ? ») n'impose pas sa taille au libellé
            police: [...fragments].sort((a, b) => b.texte.length - a.texte.length)[0].police,
        };
    };
    for (const g of noeuds.values()) {
        g.texte = rassembler(g.fragments);
        delete g.fragments;
        // Nœud réduit à son libellé : une forme texte, à laquelle les connecteurs restent collés
        if (!g.enfants.length) Object.assign(g, { genre: 'texte', ...g.texte, angle: 0, aligne: 1 });
        // Sinon le libellé est une forme texte du groupe : lue par Visio comme par LibreOffice
        else if (g.texte) { g.enfants.push({ genre: 'texte', ...g.texte, angle: 0, aligne: 1 }); delete g.texte; }
    }

    // Connecteurs : texte, extrémités collées aux nœuds, sens de parcours
    const centreDe = (g) => {
        const pts = [];
        const ajouter = (o) => {
            if (o.genre === 'geo') for (const c of o.chemins) pts.push(...c.points);
            else if (o.genre === 'groupe') o.enfants.forEach(ajouter);
            else if (o.centre) pts.push(o.centre);
        };
        ajouter(g);
        if (g.texte) pts.push(g.texte.centre);
        if (!pts.length) return null;
        return [(Math.min(...pts.map((p) => p[0])) + Math.max(...pts.map((p) => p[0]))) / 2, (Math.min(...pts.map((p) => p[1])) + Math.max(...pts.map((p) => p[1]))) / 2];
    };
    const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    for (const c of connecteurs) {
        c.texte = rassembler(etiquettes.get(c.cle) || []);
        const de = c.lien && noeuds.get(c.lien.de);
        const vers = c.lien && noeuds.get(c.lien.vers);
        const [cd, cv] = [de && centreDe(de), vers && centreDe(vers)];
        // Tracé dessiné de la cible vers la source : il est retourné, flèches comprises
        if (cd && cv && de !== vers) {
            const [p0, p1] = [c.points[0], c.points[c.points.length - 1]];
            if (distance(p0, cv) + distance(p1, cd) < distance(p0, cd) + distance(p1, cv)) {
                c.points.reverse();
                [c.style.debut, c.style.fin] = [c.style.fin, c.style.debut];
            }
        }
        if (de) c.debut = de;
        if (vers) c.fin = vers;
        delete c.lien;
    }
    return { objets, connecteurs: connecteurs.length };
}

// Page entière insérée en image (contenu HTML incorporé, que Visio ne saurait pas lire)
async function pageEnImage(c, total, medias) {
    const frais = composerPage(c.page, c.schema, { index: c.index, total });
    const canvas = await svgEnCanvas(frais.svg, Math.round(c.l / 25.4 * 200), Math.round(c.h / 25.4 * 200), false);
    const octets = new Uint8Array(await (await canvasEnBlob(canvas)).arrayBuffer());
    const nom = `image${medias.parUrl.size + 1}.png`;
    medias.parUrl.set(`page:${c.index}`, nom);
    medias.fichiers.set(nom, { octets, type: 'png' });
    return [{ genre: 'image', centre: [c.l / 2, c.h / 2], largeur: c.l, hauteur: c.h, angle: 0, media: nom }];
}

export async function exporterVisio(doc, indices) {
    const composees = await pagesComposees(doc, indices);
    const medias = { parUrl: new Map(), fichiers: new Map() };
    const bilan = { enImage: [], imagesIgnorees: 0, connecteurs: 0 };
    const pages = [];
    const atelier = h('div', { class: 'fusain-hors-ecran', 'aria-hidden': 'true' });
    document.body.append(atelier);
    try {
        for (const c of composees) {
            let formes = null;
            if (!c.schema?.htmlIncorpore) {
                try {
                    c.svg.setAttribute('width', `${c.l}mm`);
                    c.svg.setAttribute('height', `${c.h}mm`);
                    atelier.replaceChildren(c.svg);
                    const { editeur, modele, liens } = liaisons(c.page);
                    const interne = c.svg.querySelector('.fusain-schema');
                    if (editeur && modele && interne) {
                        try { editeur.reperer(interne, modele); } catch { /* sans repères : formes libres */ }
                    }
                    for (const t of c.svg.querySelectorAll('.fusain-touche')) t.remove();
                    preparerPourPdf(c.svg);
                    const lu = relirePage(c.svg, liens, medias, bilan);
                    formes = lu.objets;
                    bilan.connecteurs += lu.connecteurs;
                } catch (e) {
                    console.warn('Conversion en formes Visio impossible, repli en image', e);
                    formes = null;
                }
            }
            if (!formes) {
                formes = await pageEnImage(c, doc.pages.length, medias);
                bilan.enImage.push(c.page.nom);
            }
            pages.push({ nom: c.page.nom, largeurMm: c.l, hauteurMm: c.h, formes });
        }
    } finally {
        atelier.remove();
    }
    const { fichiers } = construireVsdx({ titre: doc.document.titre, pages, medias: medias.fichiers });
    const octets = await ecrireZip(fichiers);
    telecharger(new Blob([octets], { type: 'application/vnd.ms-visio.drawing' }), `${nomDocument(doc)}.vsdx`);
    return { pages: pages.length, ...bilan };
}
