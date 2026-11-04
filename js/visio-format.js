// Format Microsoft Visio (.vsdx, Visio 2013 et suivants) : géométrie et écriture du paquet, sans lien avec la page.
// Les formes arrivent en millimètres, axe Y vers le bas (coordonnées de la page FUSAIN) ; Visio compte en pouces,
// axe Y vers le haut, à partir du coin bas gauche de la page.

const POUCE = 25.4;
export const POLICE_VISIO = 'Marianne';

export const nombre = (n) => {
    const v = Math.round(n * 1e6) / 1e6;
    return Number.isFinite(v) && !Object.is(v, -0) ? String(v) : '0';
};

// Tout texte écrit dans le XML : caractères interdits retirés, caractères spéciaux échappés
export const echapperXml = (t) => String(t ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ---------- Tracés SVG ----------

// Arc elliptique (paramètres du SVG) en courbes de Bézier cubiques, d'au plus un quart de tour chacune
function arcEnCubiques(x1, y1, rx, ry, angle, grand, sens, x2, y2) {
    if (x1 === x2 && y1 === y2) return [];
    rx = Math.abs(rx);
    ry = Math.abs(ry);
    if (!rx || !ry) return [{ t: 'L', p: [x2, y2] }];
    const phi = (angle * Math.PI) / 180;
    const cos = Math.cos(phi);
    const sin = Math.sin(phi);
    const dx = (x1 - x2) / 2;
    const dy = (y1 - y2) / 2;
    const xp = cos * dx + sin * dy;
    const yp = -sin * dx + cos * dy;
    const lambda = (xp * xp) / (rx * rx) + (yp * yp) / (ry * ry);
    if (lambda > 1) { rx *= Math.sqrt(lambda); ry *= Math.sqrt(lambda); }
    const num = rx * rx * ry * ry - rx * rx * yp * yp - ry * ry * xp * xp;
    const den = rx * rx * yp * yp + ry * ry * xp * xp;
    const coef = (grand === sens ? -1 : 1) * Math.sqrt(Math.max(0, num / den));
    const cxp = (coef * rx * yp) / ry;
    const cyp = (-coef * ry * xp) / rx;
    const cx = cos * cxp - sin * cyp + (x1 + x2) / 2;
    const cy = sin * cxp + cos * cyp + (y1 + y2) / 2;
    const angleEntre = (ux, uy, vx, vy) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    const t1 = angleEntre(1, 0, (xp - cxp) / rx, (yp - cyp) / ry);
    let dt = angleEntre((xp - cxp) / rx, (yp - cyp) / ry, (-xp - cxp) / rx, (-yp - cyp) / ry);
    if (!sens && dt > 0) dt -= 2 * Math.PI;
    else if (sens && dt < 0) dt += 2 * Math.PI;
    const n = Math.max(1, Math.ceil(Math.abs(dt) / (Math.PI / 2) - 1e-9));
    const pas = dt / n;
    const k = (4 / 3) * Math.tan(pas / 4);
    const point = (t) => [cx + rx * Math.cos(t) * cos - ry * Math.sin(t) * sin, cy + rx * Math.cos(t) * sin + ry * Math.sin(t) * cos];
    const derivee = (t) => [-rx * Math.sin(t) * cos - ry * Math.cos(t) * sin, -rx * Math.sin(t) * sin + ry * Math.cos(t) * cos];
    const segments = [];
    for (let i = 0; i < n; i += 1) {
        const a = t1 + i * pas;
        const b = a + pas;
        const [p0, p3] = [point(a), i === n - 1 ? [x2, y2] : point(b)];
        const [d0, d3] = [derivee(a), derivee(b)];
        segments.push({ t: 'C', p1: [p0[0] + k * d0[0], p0[1] + k * d0[1]], p2: [p3[0] - k * d3[0], p3[1] - k * d3[1]], p: p3 });
    }
    return segments;
}

// Lecture de l'attribut d : sous-chemins { depart, segments: [{ t: 'L', p } | { t: 'C', p1, p2, p }], ferme }
export function lireTrace(d) {
    const jetons = String(d ?? '').match(/[a-zA-Z]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) || [];
    const chemins = [];
    let courant = null;
    let x = 0;
    let y = 0;
    let sx = 0;
    let sy = 0;
    let ctrl = null; // dernier point de contrôle (C, S) pour S
    let quad = null; // dernier point de contrôle (Q, T) pour T
    let i = 0;
    let commande = null;
    const estCommande = (j) => /^[a-zA-Z]$/.test(j);
    const lire = () => {
        if (i >= jetons.length || estCommande(jetons[i])) throw new Error('tracé incomplet');
        return Number(jetons[i++]);
    };
    // Les drapeaux d'un arc peuvent être collés (« 011 »)
    const drapeau = () => {
        const j = jetons[i];
        if (j === undefined || estCommande(j)) throw new Error('tracé incomplet');
        if (/^[01]./.test(j)) { jetons[i] = j.slice(1); return Number(j[0]); }
        i += 1;
        return Number(j) ? 1 : 0;
    };
    const ajouter = (segment) => {
        if (!courant) { courant = { depart: [x, y], segments: [], ferme: false }; chemins.push(courant); }
        courant.segments.push(segment);
    };
    try {
        while (i < jetons.length) {
            if (estCommande(jetons[i])) commande = jetons[i++];
            else if (!commande) break;
            const relatif = commande === commande.toLowerCase();
            const ox = relatif ? x : 0;
            const oy = relatif ? y : 0;
            const C = commande.toUpperCase();
            if (C === 'Z') {
                if (courant) { courant.ferme = true; x = sx; y = sy; }
                courant = null;
                ctrl = quad = null;
                commande = null;
                continue;
            }
            if (C === 'M') {
                x = lire() + ox; y = lire() + oy;
                sx = x; sy = y;
                courant = { depart: [x, y], segments: [], ferme: false };
                chemins.push(courant);
                commande = relatif ? 'l' : 'L';
                ctrl = quad = null;
                continue;
            }
            if (C === 'L') { x = lire() + ox; y = lire() + oy; ajouter({ t: 'L', p: [x, y] }); ctrl = quad = null; }
            else if (C === 'H') { x = lire() + ox; ajouter({ t: 'L', p: [x, y] }); ctrl = quad = null; }
            else if (C === 'V') { y = lire() + oy; ajouter({ t: 'L', p: [x, y] }); ctrl = quad = null; }
            else if (C === 'C' || C === 'S') {
                let p1;
                if (C === 'C') p1 = [lire() + ox, lire() + oy];
                else p1 = ctrl ? [2 * x - ctrl[0], 2 * y - ctrl[1]] : [x, y];
                const p2 = [lire() + ox, lire() + oy];
                x = lire() + ox; y = lire() + oy;
                ajouter({ t: 'C', p1, p2, p: [x, y] });
                ctrl = p2; quad = null;
            } else if (C === 'Q' || C === 'T') {
                let q;
                if (C === 'Q') q = [lire() + ox, lire() + oy];
                else q = quad ? [2 * x - quad[0], 2 * y - quad[1]] : [x, y];
                const [x0, y0] = [x, y];
                x = lire() + ox; y = lire() + oy;
                ajouter({ t: 'C', p1: [x0 + (2 / 3) * (q[0] - x0), y0 + (2 / 3) * (q[1] - y0)], p2: [x + (2 / 3) * (q[0] - x), y + (2 / 3) * (q[1] - y)], p: [x, y] });
                quad = q; ctrl = null;
            } else if (C === 'A') {
                const rx = lire();
                const ry = lire();
                const angle = lire();
                const grand = drapeau();
                const sens = drapeau();
                const [x0, y0] = [x, y];
                x = lire() + ox; y = lire() + oy;
                for (const s of arcEnCubiques(x0, y0, rx, ry, angle, grand, sens, x, y)) ajouter(s);
                ctrl = quad = null;
            } else break; // commande inconnue : la suite est ignorée
        }
    } catch {
        // tracé tronqué : ce qui a été lu est gardé, comme le fait le navigateur
    }
    return chemins.filter((c) => c.segments.length);
}

// Formes simples du SVG, ramenées à des tracés
export function traceRectangle(x, y, l, h, rx = 0, ry = 0) {
    if (!(l > 0 && h > 0)) return [];
    if (rx > 0 || ry > 0) {
        rx = Math.min(rx || ry, l / 2);
        ry = Math.min(ry || rx, h / 2);
        return lireTrace(`M${x + rx} ${y}H${x + l - rx}A${rx} ${ry} 0 0 1 ${x + l} ${y + ry}V${y + h - ry}A${rx} ${ry} 0 0 1 ${x + l - rx} ${y + h}H${x + rx}A${rx} ${ry} 0 0 1 ${x} ${y + h - ry}V${y + ry}A${rx} ${ry} 0 0 1 ${x + rx} ${y}Z`);
    }
    return lireTrace(`M${x} ${y}H${x + l}V${y + h}H${x}Z`);
}
export function traceEllipse(cx, cy, rx, ry) {
    if (!(rx > 0 && ry > 0)) return [];
    return lireTrace(`M${cx + rx} ${cy}A${rx} ${ry} 0 0 1 ${cx} ${cy + ry}A${rx} ${ry} 0 0 1 ${cx - rx} ${cy}A${rx} ${ry} 0 0 1 ${cx} ${cy - ry}A${rx} ${ry} 0 0 1 ${cx + rx} ${cy}Z`);
}
export function tracePoints(points, ferme) {
    const n = String(points ?? '').match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) || [];
    if (n.length < 4) return [];
    return lireTrace(`M${n.slice(0, 2).join(' ')}L${n.slice(2, n.length - (n.length % 2)).join(' ')}${ferme ? 'Z' : ''}`);
}

// Tracés transformés par une matrice { a, b, c, d, e, f } puis aplatis en lignes brisées (tolérance en unités de sortie)
export function aplatir(chemins, m, tolerance = 0.05) {
    const tr = ([x, y]) => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f];
    const sorties = [];
    for (const chemin of chemins) {
        const points = [tr(chemin.depart)];
        let dernier = points[0];
        for (const s of chemin.segments) {
            if (s.t === 'L') { dernier = tr(s.p); points.push(dernier); continue; }
            const p0 = dernier;
            const p1 = tr(s.p1);
            const p2 = tr(s.p2);
            const p3 = tr(s.p);
            subdiviser(p0, p1, p2, p3, tolerance, points, 0);
            dernier = p3;
        }
        // Points confondus successifs retirés
        const nets = points.filter((p, k) => k === 0 || Math.abs(p[0] - points[k - 1][0]) > 1e-9 || Math.abs(p[1] - points[k - 1][1]) > 1e-9);
        if (nets.length >= 2 || (nets.length === 1 && chemin.ferme)) sorties.push({ points: nets, ferme: chemin.ferme });
    }
    return sorties;
}
function subdiviser(p0, p1, p2, p3, tolerance, sortie, profondeur) {
    const ecart = (p) => {
        const dx = p3[0] - p0[0];
        const dy = p3[1] - p0[1];
        const l = Math.hypot(dx, dy);
        return l < 1e-12 ? Math.hypot(p[0] - p0[0], p[1] - p0[1]) : Math.abs((p[0] - p0[0]) * dy - (p[1] - p0[1]) * dx) / l;
    };
    if (profondeur >= 12 || Math.max(ecart(p1), ecart(p2)) <= tolerance) { sortie.push(p3); return; }
    const m = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const p01 = m(p0, p1); const p12 = m(p1, p2); const p23 = m(p2, p3);
    const p012 = m(p01, p12); const p123 = m(p12, p23); const centre = m(p012, p123);
    subdiviser(p0, p01, p012, centre, tolerance, sortie, profondeur + 1);
    subdiviser(centre, p123, p23, p3, tolerance, sortie, profondeur + 1);
}

// ---------- Formes Visio ----------
//
// Objets reçus (millimètres, axe Y vers le bas) :
//   { genre: 'geo', chemins: [{ points, ferme }], style }
//   { genre: 'texte', centre: [x, y], largeur, hauteur, angle, texte, police, aligne }
//   { genre: 'image', centre, largeur, hauteur, angle, media }
//   { genre: 'groupe', enfants: [...], texte?: { centre, largeur, hauteur, texte, police } }
//   { genre: 'connecteur', points, style, texte?, debut?: objet, fin?: objet }
// style : { remplissage, transRemplissage, trait, transTrait, epaisseur (mm), motif (1 plein, 2 tirets, 3 points), debut, fin (flèches Visio) }
// police : { taille (mm), couleur, trans, gras, italique }

const cellule = (n, v, f) => `<Cell N="${n}" V="${typeof v === 'number' ? nombre(v) : echapperXml(v)}"${f ? ` F="${echapperXml(f)}"` : ''}/>`;

function cellulesStyle(s = {}) {
    const c = [];
    if (s.remplissage) c.push(cellule('FillForegnd', s.remplissage), cellule('FillBkgnd', s.remplissage), cellule('FillPattern', 1), cellule('FillForegndTrans', s.transRemplissage || 0));
    else c.push(cellule('FillPattern', 0));
    if (s.trait && s.epaisseur > 0) {
        c.push(cellule('LineColor', s.trait), cellule('LinePattern', s.motif || 1), cellule('LineWeight', s.epaisseur / POUCE), cellule('LineColorTrans', s.transTrait || 0));
    } else c.push(cellule('LinePattern', 0));
    if (s.debut) c.push(cellule('BeginArrow', s.debut), cellule('BeginArrowSize', 1));
    if (s.fin) c.push(cellule('EndArrow', s.fin), cellule('EndArrowSize', 1));
    c.push(cellule('ShdwPattern', 0));
    return c.join('');
}

function cellulesTexte(police, aligne = 1) {
    const p = police || {};
    const style = (p.gras ? 1 : 0) + (p.italique ? 2 : 0);
    return `${cellule('LeftMargin', 0)}${cellule('RightMargin', 0)}${cellule('TopMargin', 0)}${cellule('BottomMargin', 0)}${cellule('VerticalAlign', 1)}`
        + `<Section N="Character"><Row IX="0">${cellule('Font', POLICE_VISIO)}${cellule('Color', p.couleur || '#161616')}${cellule('ColorTrans', p.trans || 0)}${cellule('Size', (p.taille || 3.5) / POUCE)}${cellule('Style', style)}</Row></Section>`
        + `<Section N="Paragraph"><Row IX="0">${cellule('HorzAlign', aligne)}${cellule('SpLine', -1)}</Row></Section>`;
}

const entete = (id, type = 'Shape') => `<Shape ID="${id}" Type="${type}" LineStyle="0" FillStyle="0" TextStyle="0">`;

// Place une forme : axe X et Y Visio, relatifs au coin bas gauche du parent
function placement(cx, cy, l, h, angle = 0) {
    return `${cellule('PinX', cx)}${cellule('PinY', cy)}${cellule('Width', l)}${cellule('Height', h)}${cellule('LocPinX', l / 2, 'Width*0.5')}${cellule('LocPinY', h / 2, 'Height*0.5')}${cellule('Angle', angle)}${cellule('FlipX', 0)}${cellule('FlipY', 0)}`;
}

// Géométrie en coordonnées locales ; les formules la font suivre un redimensionnement dans Visio
function geometrie(chemins, x0, y0, l, h) {
    return chemins.map((c, ix) => {
        const lignes = [`<Section N="Geometry" IX="${ix}">${cellule('NoFill', c.ferme ? 0 : 1)}${cellule('NoLine', 0)}${cellule('NoShow', 0)}${cellule('NoSnap', 0)}${cellule('NoQuickDrag', 0)}`];
        const pts = c.ferme ? [...c.points, c.points[0]] : c.points;
        pts.forEach(([x, y], k) => {
            const lx = x - x0;
            const ly = y - y0;
            const fx = l > 1e-6 ? `Width*${nombre(lx / l)}` : null;
            const fy = h > 1e-6 ? `Height*${nombre(ly / h)}` : null;
            lignes.push(`<Row T="${k === 0 ? 'MoveTo' : 'LineTo'}" IX="${k + 1}">${cellule('X', lx, fx)}${cellule('Y', ly, fy)}</Row>`);
        });
        lignes.push('</Section>');
        return lignes.join('');
    }).join('');
}

const versVisio = (H) => ([x, y]) => [x / POUCE, (H - y) / POUCE];

function boite(points) {
    let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
    for (const [x, y] of points) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    return { x0, y0, x1, y1 };
}

// Boîte (en pouces Visio) d'un objet, pour les groupes
function boiteVisio(o, V) {
    if (o.genre === 'geo') return boite(o.chemins.flatMap((c) => c.points).map(V));
    if (o.genre === 'connecteur') return boite(o.points.map(V));
    if (o.genre === 'groupe') {
        const b = o.enfants.map((e) => boiteVisio(e, V));
        if (o.texte) b.push(boiteVisio({ genre: 'texte', ...o.texte, angle: 0 }, V));
        return { x0: Math.min(...b.map((x) => x.x0)), y0: Math.min(...b.map((x) => x.y0)), x1: Math.max(...b.map((x) => x.x1)), y1: Math.max(...b.map((x) => x.y1)) };
    }
    const [cx, cy] = V(o.centre);
    const l = o.largeur / POUCE;
    const h = o.hauteur / POUCE;
    const a = Math.abs(o.angle || 0);
    const dl = (Math.abs(Math.cos(a)) * l + Math.abs(Math.sin(a)) * h) / 2;
    const dh = (Math.abs(Math.sin(a)) * l + Math.abs(Math.cos(a)) * h) / 2;
    return { x0: cx - dl, y0: cy - dh, x1: cx + dl, y1: cy + dh };
}

// Les fragments mesurés dans le navigateur sont élargis : la police de remplacement de Visio peut être plus large
const ELARGIR = 1.25;

function formeXml(o, ctx, origine) {
    const V = ctx.V;
    if (o.genre === 'geo') {
        const pts = o.chemins.map((c) => ({ ferme: c.ferme, points: c.points.map(V) }));
        const b = boite(pts.flatMap((c) => c.points));
        const l = b.x1 - b.x0;
        const h = b.y1 - b.y0;
        return `${entete(o.id)}${placement(b.x0 + l / 2 - origine[0], b.y0 + h / 2 - origine[1], l, h)}${cellulesStyle(o.style)}${geometrie(pts, b.x0, b.y0, l, h)}</Shape>`;
    }
    if (o.genre === 'texte') {
        const [cx, cy] = V(o.centre);
        const l = (o.largeur * ELARGIR + 1) / POUCE;
        const h = o.hauteur / POUCE;
        // Texte aligné à gauche : son bord gauche reste en place malgré l'élargissement
        const decale = o.aligne === 0 ? (l - o.largeur / POUCE) / 2 : 0;
        const angle = -(o.angle || 0);
        return `${entete(o.id)}${placement(cx + decale * Math.cos(angle) - origine[0], cy + decale * Math.sin(angle) - origine[1], l, h, angle)}${cellulesStyle({})}${cellulesTexte(o.police, o.aligne ?? 1)}<Text>${echapperXml(o.texte)}</Text></Shape>`;
    }
    if (o.genre === 'image') {
        const [cx, cy] = V(o.centre);
        const l = o.largeur / POUCE;
        const h = o.hauteur / POUCE;
        const rid = ctx.relation(o.media);
        return `${entete(o.id, 'Foreign')}${placement(cx - origine[0], cy - origine[1], l, h, -(o.angle || 0))}${cellule('ImgOffsetX', 0, 'ImgWidth*0')}${cellule('ImgOffsetY', 0, 'ImgHeight*0')}${cellule('ImgWidth', l, 'Width*1')}${cellule('ImgHeight', h, 'Height*1')}${cellulesStyle({})}`
            + `<Section N="Geometry" IX="0">${cellule('NoFill', 0)}${cellule('NoLine', 1)}${cellule('NoShow', 0)}${cellule('NoSnap', 0)}${cellule('NoQuickDrag', 0)}<Row T="MoveTo" IX="1">${cellule('X', 0, 'Width*0')}${cellule('Y', 0, 'Height*0')}</Row><Row T="LineTo" IX="2">${cellule('X', l, 'Width*1')}${cellule('Y', 0, 'Height*0')}</Row><Row T="LineTo" IX="3">${cellule('X', l, 'Width*1')}${cellule('Y', h, 'Height*1')}</Row><Row T="LineTo" IX="4">${cellule('X', 0, 'Width*0')}${cellule('Y', h, 'Height*1')}</Row><Row T="LineTo" IX="5">${cellule('X', 0, 'Width*0')}${cellule('Y', 0, 'Height*0')}</Row></Section>`
            + `<ForeignData ForeignType="Bitmap" CompressionType="${ctx.formatMedia(o.media)}"><Rel r:id="${rid}"/></ForeignData></Shape>`;
    }
    if (o.genre === 'groupe') {
        const b = boiteVisio(o, V);
        const l = b.x1 - b.x0;
        const h = b.y1 - b.y0;
        let texte = '';
        if (o.texte) {
            // Le libellé du nœud est le texte du groupe : un double-clic dans Visio le modifie directement
            const [tx, ty] = V(o.texte.centre);
            const tl = (o.texte.largeur * ELARGIR + 1) / POUCE;
            const th = o.texte.hauteur / POUCE;
            texte = `${cellule('TxtPinX', tx - b.x0)}${cellule('TxtPinY', ty - b.y0)}${cellule('TxtWidth', tl)}${cellule('TxtHeight', th)}${cellule('TxtLocPinX', tl / 2, 'TxtWidth*0.5')}${cellule('TxtLocPinY', th / 2, 'TxtHeight*0.5')}${cellule('TxtAngle', 0)}${cellulesTexte(o.texte.police, 1)}`;
        }
        const enfants = o.enfants.map((e) => formeXml(e, ctx, [b.x0, b.y0])).join('');
        return `${entete(o.id, 'Group')}${placement(b.x0 + l / 2 - origine[0], b.y0 + h / 2 - origine[1], l, h)}${cellulesStyle({})}${texte}<Shapes>${enfants}</Shapes>${o.texte ? `<Text>${echapperXml(o.texte.texte)}</Text>` : ''}</Shape>`;
    }
    if (o.genre === 'connecteur') {
        // Connecteur dynamique : repère local d'origine au point de départ ; extrémités collées aux nœuds
        const pts = o.points.map(V);
        const [bx, by] = pts[0];
        const [ex, ey] = pts[pts.length - 1];
        const l = ex - bx;
        const h = ey - by;
        const lignes = pts.map(([x, y], k) => `<Row T="${k === 0 ? 'MoveTo' : 'LineTo'}" IX="${k + 1}">${cellule('X', x - bx)}${cellule('Y', y - by)}</Row>`).join('');
        const colle = (cible, autre) => (cible ? `_WALKGLUE(${autre})` : null);
        let texte = '';
        if (o.texte) {
            const [tx, ty] = V(o.texte.centre);
            const tl = (o.texte.largeur * ELARGIR + 1) / POUCE;
            const th = o.texte.hauteur / POUCE;
            texte = `${cellule('TxtPinX', tx - bx)}${cellule('TxtPinY', ty - by)}${cellule('TxtWidth', tl)}${cellule('TxtHeight', th)}${cellule('TxtLocPinX', tl / 2, 'TxtWidth*0.5')}${cellule('TxtLocPinY', th / 2, 'TxtHeight*0.5')}${cellule('TxtAngle', 0)}${cellule('TextBkgnd', '#ffffff')}${cellulesTexte(o.texte.police, 1)}`;
        }
        return `${entete(o.id)}${cellule('PinX', (bx + ex) / 2 - origine[0], 'GUARD((BeginX+EndX)/2)')}${cellule('PinY', (by + ey) / 2 - origine[1], 'GUARD((BeginY+EndY)/2)')}${cellule('Width', l, 'GUARD(EndX-BeginX)')}${cellule('Height', h, 'GUARD(EndY-BeginY)')}${cellule('LocPinX', l / 2, 'GUARD(Width*0.5)')}${cellule('LocPinY', h / 2, 'GUARD(Height*0.5)')}${cellule('Angle', 0, 'GUARD(0DA)')}${cellule('FlipX', 0)}${cellule('FlipY', 0)}`
            + `${cellule('BeginX', bx - origine[0], colle(o.debut, 'BegTrigger,EndTrigger,WalkPreference'))}${cellule('BeginY', by - origine[1], colle(o.debut, 'BegTrigger,EndTrigger,WalkPreference'))}${cellule('EndX', ex - origine[0], colle(o.fin, 'EndTrigger,BegTrigger,WalkPreference'))}${cellule('EndY', ey - origine[1], colle(o.fin, 'EndTrigger,BegTrigger,WalkPreference'))}`
            + `${o.debut ? cellule('BegTrigger', 2, `_XFTRIGGER(Sheet.${o.debut.id}!EventXFMod)`) : ''}${o.fin ? cellule('EndTrigger', 2, `_XFTRIGGER(Sheet.${o.fin.id}!EventXFMod)`) : ''}`
            + `${cellule('ObjType', 2)}${cellule('ShapeRouteStyle', 0)}${cellule('ConLineRouteExt', 0)}${cellule('ShapePlowCode', 0)}${cellule('NoAlignBox', 1)}${cellulesStyle({ ...o.style, remplissage: null })}${texte}`
            + `<Section N="Geometry" IX="0">${cellule('NoFill', 1)}${cellule('NoLine', 0)}${cellule('NoShow', 0)}${cellule('NoSnap', 0)}${cellule('NoQuickDrag', 0)}${lignes}</Section>`
            + `${o.texte ? `<Text>${echapperXml(o.texte.texte)}</Text>` : ''}</Shape>`;
    }
    return '';
}

// Numérotation des formes (identifiants uniques dans la page, enfants compris)
function numeroter(objets, compteur) {
    for (const o of objets) {
        o.id = compteur.n;
        compteur.n += 1;
        if (o.genre === 'groupe') numeroter(o.enfants, compteur);
    }
}

const NS = 'xmlns="http://schemas.microsoft.com/office/visio/2012/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xml:space="preserve"';
const PROLOGUE = '<?xml version="1.0" encoding="utf-8" standalone="yes"?>\n';
const REL_IMAGE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image';

export function pageXml(formes, hauteurMm, medias) {
    const objets = formes.filter(Boolean);
    numeroter(objets, { n: 1 });
    const relations = new Map(); // média → rId
    const ctx = {
        V: versVisio(hauteurMm),
        relation: (media) => { if (!relations.has(media)) relations.set(media, `rId${relations.size + 1}`); return relations.get(media); },
        formatMedia: (media) => (medias.get(media)?.type === 'jpeg' ? 'JPEG' : 'PNG'),
    };
    const corps = objets.map((o) => formeXml(o, ctx, [0, 0])).join('');
    const liens = [];
    const parcourir = (liste) => {
        for (const o of liste) {
            if (o.genre === 'groupe') parcourir(o.enfants);
            if (o.genre !== 'connecteur') continue;
            if (o.debut) liens.push(`<Connect FromSheet="${o.id}" FromCell="BeginX" FromPart="9" ToSheet="${o.debut.id}" ToCell="PinX" ToPart="3"/>`);
            if (o.fin) liens.push(`<Connect FromSheet="${o.id}" FromCell="EndX" FromPart="12" ToSheet="${o.fin.id}" ToCell="PinX" ToPart="3"/>`);
        }
    };
    parcourir(objets);
    const xml = `${PROLOGUE}<PageContents ${NS}><Shapes>${corps}</Shapes>${liens.length ? `<Connects>${liens.join('')}</Connects>` : ''}</PageContents>`;
    const rels = relations.size
        ? `${PROLOGUE}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${[...relations].map(([m, id]) => `<Relationship Id="${id}" Type="${REL_IMAGE}" Target="../media/${m}"/>`).join('')}</Relationships>`
        : null;
    return { xml, rels, formes: compter(objets), connecteurs: liens.length };
}

function compter(objets) {
    return objets.reduce((n, o) => n + 1 + (o.genre === 'groupe' ? compter(o.enfants) : 0), 0);
}

const STYLE_DE_BASE = `<StyleSheets><StyleSheet ID="0" NameU="No Style" IsCustomNameU="1" Name="No Style" IsCustomName="1">${[
    ['EnableLineProps', 1], ['EnableFillProps', 1], ['EnableTextProps', 1], ['HideForApply', 0],
    ['LineWeight', 0.75 / 72], ['LineColor', '#000000'], ['LinePattern', 1], ['Rounding', 0], ['EndArrowSize', 2], ['BeginArrow', 0], ['EndArrow', 0], ['LineCap', 0], ['BeginArrowSize', 2], ['LineColorTrans', 0], ['CompoundType', 0],
    ['FillForegnd', '#ffffff'], ['FillBkgnd', '#ffffff'], ['FillPattern', 1], ['ShdwForegnd', '#000000'], ['ShdwPattern', 0], ['FillForegndTrans', 0], ['FillBkgndTrans', 0], ['ShdwForegndTrans', 0],
    ['LeftMargin', 0], ['RightMargin', 0], ['TopMargin', 0], ['BottomMargin', 0], ['VerticalAlign', 1], ['TextBkgnd', 0], ['DefaultTabStop', 0.5], ['TextDirection', 0], ['TextBkgndTrans', 0],
    ['NoObjHandles', 0], ['NonPrinting', 0], ['NoCtlHandles', 0], ['NoAlignBox', 0], ['UpdateAlignBox', 0], ['HideText', 0], ['DynFeedback', 0], ['GlueType', 0], ['WalkPreference', 0], ['BegTrigger', 0], ['EndTrigger', 0], ['ObjType', 0], ['Comment', ''], ['IsDropSource', 0], ['NoLiveDynamics', 0], ['LocalizeMerge', 0], ['NoProofing', 0], ['Calendar', 0], ['LangID', 'fr-FR'], ['ShapeKeywords', ''], ['DropOnPageScale', 1],
].map(([n, v]) => cellule(n, v)).join('')}<Section N="Character"><Row IX="0">${cellule('Font', POLICE_VISIO)}${cellule('Color', '#161616')}${cellule('Style', 0)}${cellule('Case', 0)}${cellule('Pos', 0)}${cellule('FontScale', 1)}${cellule('Size', 12 / 72)}${cellule('ColorTrans', 0)}</Row></Section><Section N="Paragraph"><Row IX="0">${cellule('IndFirst', 0)}${cellule('IndLeft', 0)}${cellule('IndRight', 0)}${cellule('SpLine', -1.2)}${cellule('SpBefore', 0)}${cellule('SpAfter', 0)}${cellule('HorzAlign', 1)}${cellule('Bullet', 0)}</Row></Section></StyleSheet></StyleSheets>`;

// Paquet complet : [{ nom, donnees }] prêts pour l'archive ZIP
// pages : [{ nom, largeurMm, hauteurMm, formes }] ; medias : Map nom → { octets, type: 'png' | 'jpeg' }
export function construireVsdx({ titre = '', pages, medias = new Map() }) {
    const fichiers = [];
    const overrides = [
        ['/visio/document.xml', 'application/vnd.ms-visio.drawing.main+xml'],
        ['/visio/pages/pages.xml', 'application/vnd.ms-visio.pages+xml'],
        ['/docProps/core.xml', 'application/vnd.openxmlformats-package.core-properties+xml'],
        ['/docProps/app.xml', 'application/vnd.openxmlformats-officedocument.extended-properties+xml'],
        ...pages.map((_, i) => [`/visio/pages/page${i + 1}.xml`, 'application/vnd.ms-visio.page+xml']),
    ];
    fichiers.push({ nom: '[Content_Types].xml', donnees: `${PROLOGUE}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/>${overrides.map(([p, t]) => `<Override PartName="${p}" ContentType="${t}"/>`).join('')}</Types>` });
    fichiers.push({ nom: '_rels/.rels', donnees: `${PROLOGUE}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.microsoft.com/visio/2010/relationships/document" Target="visio/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>` });
    const maintenant = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    fichiers.push({ nom: 'docProps/core.xml', donnees: `${PROLOGUE}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${echapperXml(titre)}</dc:title><dc:creator>FUSAIN</dc:creator><dc:language>fr-FR</dc:language><dcterms:created xsi:type="dcterms:W3CDTF">${maintenant}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${maintenant}</dcterms:modified></cp:coreProperties>` });
    fichiers.push({ nom: 'docProps/app.xml', donnees: `${PROLOGUE}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>FUSAIN</Application><Template></Template><AppVersion>15.0000</AppVersion></Properties>` });
    fichiers.push({ nom: 'visio/_rels/document.xml.rels', donnees: `${PROLOGUE}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.microsoft.com/visio/2010/relationships/pages" Target="pages/pages.xml"/></Relationships>` });
    fichiers.push({ nom: 'visio/document.xml', donnees: `${PROLOGUE}<VisioDocument ${NS}><DocumentSettings TopPage="0" DefaultTextStyle="0" DefaultLineStyle="0" DefaultFillStyle="0" DefaultGuideStyle="0"><GlueSettings>9</GlueSettings><SnapSettings>65847</SnapSettings><SnapExtensions>34</SnapExtensions><SnapAngles/><DynamicGridEnabled>0</DynamicGridEnabled><ProtectStyles>0</ProtectStyles><ProtectShapes>0</ProtectShapes><ProtectMasters>0</ProtectMasters><ProtectBkgnds>0</ProtectBkgnds></DocumentSettings><FaceNames><FaceName NameU="${POLICE_VISIO}" UnicodeRanges="-1 -1 0 0" CharSets="1 0" Panos="0 0 5 0 0 0 0 0 0 0" Flags="357"/></FaceNames>${STYLE_DE_BASE}</VisioDocument>` });

    const bilan = [];
    const pagesXml = [];
    const pagesRels = [];
    // Visio exige des noms de page distincts : un doublon (après troncature à 31 caractères) reçoit un numéro
    const nomsPris = new Set();
    const nomUnique = (p, i) => {
        const base = String(p.nom || `Page ${i + 1}`).replace(/[\\/:*?"<>|[\]]/g, '-').slice(0, 31) || `Page ${i + 1}`;
        let nom = base;
        for (let n = 2; nomsPris.has(nom.toLowerCase()); n += 1) nom = `${base.slice(0, 31 - ` (${n})`.length)} (${n})`;
        nomsPris.add(nom.toLowerCase());
        return nom;
    };
    pages.forEach((p, i) => {
        const { xml, rels, formes, connecteurs } = pageXml(p.formes, p.hauteurMm, medias);
        fichiers.push({ nom: `visio/pages/page${i + 1}.xml`, donnees: xml });
        if (rels) fichiers.push({ nom: `visio/pages/_rels/page${i + 1}.xml.rels`, donnees: rels });
        bilan.push({ nom: p.nom, formes, connecteurs });
        const l = p.largeurMm / POUCE;
        const h = p.hauteurMm / POUCE;
        const nom = echapperXml(nomUnique(p, i));
        pagesXml.push(`<Page ID="${i}" NameU="${nom}" Name="${nom}" ViewScale="-1" ViewCenterX="${nombre(l / 2)}" ViewCenterY="${nombre(h / 2)}"><PageSheet LineStyle="0" FillStyle="0" TextStyle="0">${cellule('PageWidth', l)}${cellule('PageHeight', h)}${cellule('ShdwOffsetX', 0.125)}${cellule('ShdwOffsetY', -0.125)}${cellule('PageScale', 1 / POUCE)}${cellule('DrawingScale', 1 / POUCE)}${cellule('DrawingSizeType', 0)}${cellule('DrawingScaleType', 0)}${cellule('InhibitSnap', 0)}${cellule('PageLockReplace', 0)}${cellule('PageLockDuplicate', 0)}${cellule('UIVisibility', 0)}${cellule('ShdwType', 0)}${cellule('ShdwObliqueAngle', 0)}${cellule('ShdwScaleFactor', 1)}${cellule('DrawingResizeType', 0)}${cellule('PageShapeSplit', 1)}${cellule('PrintPageOrientation', p.largeurMm > p.hauteurMm ? 2 : 1)}${cellule('RouteStyle', 0)}${cellule('LineRouteExt', 0)}</PageSheet><Rel r:id="rId${i + 1}"/></Page>`);
        pagesRels.push(`<Relationship Id="rId${i + 1}" Type="http://schemas.microsoft.com/visio/2010/relationships/page" Target="page${i + 1}.xml"/>`);
    });
    fichiers.push({ nom: 'visio/pages/pages.xml', donnees: `${PROLOGUE}<Pages ${NS}>${pagesXml.join('')}</Pages>` });
    fichiers.push({ nom: 'visio/pages/_rels/pages.xml.rels', donnees: `${PROLOGUE}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${pagesRels.join('')}</Relationships>` });
    for (const [nom, { octets }] of medias) fichiers.push({ nom: `visio/media/${nom}`, donnees: octets });
    return { fichiers, bilan };
}
