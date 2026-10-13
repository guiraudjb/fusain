// Dessin d'une diapositive de texte en SVG. Les mesures (en pixels CSS) sont celles des diapositives libres de VALOR,
// relevées dans un navigateur : zone de 1474 px de large, fond gris, filet bleu à gauche, police Marianne.
import { s } from './dom.js';
import { analyser } from './diagrammes/diapo.js';

export const LARGEUR = 1474;
export const HAUTEUR = 1006;
const BLEU = '#000091';
const ROUGE = '#ce0500';
const NOIR = '#161616';
const GRIS = '#666666';
const FOND = '#f6f6f6';
const POLICE = 'Marianne, arial, sans-serif';
const X0 = 36; // filet de 4 px et marge intérieure de 2 rem
const Y0 = 32;
const LI = LARGEUR - 2 * 32 - 4;

let toile = null;
function regler(taille, gras) {
    toile ||= document.createElement('canvas').getContext('2d');
    toile.font = `${gras ? 700 : 400} ${taille}px ${POLICE}`;
    return toile;
}
const largeurDe = (texte, taille, gras) => regler(taille, gras).measureText(texte).width;

// Découpe un texte en lignes de mots ; « ** » bascule le gras, <br> force le retour à la ligne
function couper(texte, taille, gras, max) {
    const lignes = [];
    const espace = largeurDe(' ', taille, gras);
    for (const paragraphe of String(texte).split(/<br\s*\/?>/i)) {
        let fort = false;
        let ligne = [];
        let largeur = 0;
        for (const morceau of paragraphe.split(/(\*\*)/)) {
            if (morceau === '**') { fort = !fort; continue; }
            for (const mot of morceau.split(/\s+/).filter(Boolean)) {
                const l = largeurDe(mot, taille, gras || fort);
                if (ligne.length && largeur + espace + l > max) { lignes.push({ mots: ligne, largeur }); ligne = []; largeur = 0; }
                largeur += (ligne.length ? espace : 0) + l;
                ligne.push({ t: mot, gras: gras || fort });
            }
        }
        lignes.push({ mots: ligne, largeur });
    }
    return lignes;
}

// Écrit un texte replié dans une largeur et rend sa hauteur. La ligne de base est placée comme le ferait le navigateur
// pour une boîte de ligne de la hauteur donnée.
function ecrire(g, texte, { x, y, l, taille, interligne, gras = false, couleur = NOIR, align = 'start', majuscules = false, cle = null }) {
    const contenu = majuscules ? String(texte).toLocaleUpperCase('fr') : String(texte);
    const lignes = couper(contenu, taille, gras, l);
    const m = regler(taille, gras).measureText('Hg');
    const haut = m.fontBoundingBoxAscent ?? taille * 0.95;
    const bas = m.fontBoundingBoxDescent ?? taille * 0.25;
    const base = (interligne - (haut + bas)) / 2 + haut;
    const ancre = align === 'center' ? x + l / 2 : align === 'end' ? x + l : x;
    const el = s('text', { 'font-family': POLICE, 'font-size': taille, 'font-weight': gras ? 700 : 400, fill: couleur, 'text-anchor': align === 'center' ? 'middle' : align, 'data-champ': cle });
    lignes.forEach((ligne, n) => {
        // Les mots de même graisse qui se suivent forment un seul fragment
        const fragments = [];
        for (const mot of ligne.mots) {
            const dernier = fragments[fragments.length - 1];
            if (dernier && dernier.gras === mot.gras) dernier.t += ` ${mot.t}`; else fragments.push({ t: mot.t, gras: mot.gras });
        }
        fragments.forEach((f, k) => el.append(s('tspan', { ...(k ? {} : { x: ancre, y: y + n * interligne + base }), 'font-weight': f.gras ? 700 : 400 }, `${k ? ' ' : ''}${f.t}`)));
    });
    if (lignes.some((ligne) => ligne.mots.length)) g.append(el);
    return { hauteur: lignes.length * interligne, largeur: Math.max(0, ...lignes.map((ligne) => ligne.largeur)) };
}

const rect = (g, x, y, l, h, attrs = {}) => { const r = s('rect', { x, y, width: Math.max(0, l), height: Math.max(0, h), ...attrs }); g.append(r); return r; };
// Bloc gris coiffé d'un filet bleu de 4 px
function bloc(g, x, y, l, h, cle) {
    rect(g, x, y, l, h, { fill: FOND, 'data-champ': cle });
    rect(g, x, y, l, 4, { fill: BLEU });
}
const pastille = (g, cx, cy, r, cle) => g.append(s('circle', { cx, cy, r, fill: BLEU, 'data-champ': cle }));

// « 1. Titre de partie > a. Titre de sous-partie » : rend la hauteur occupée, marge comprise
function filAriane(g, m, y) {
    const partie = m.champs.partie || '';
    const a = ecrire(g, partie, { x: X0, y, l: LI, taille: 24, interligne: 40, gras: true, couleur: BLEU, cle: 'c:partie' });
    if (m.champs['sous-partie']) ecrire(g, `> ${m.champs['sous-partie']}`, { x: X0 + a.largeur + (partie ? 7 : 0), y, l: LI, taille: 19.2, interligne: 40, couleur: GRIS, cle: 'c:sous-partie' });
    return 40 + 26;
}

const colonnes = (n, ecart) => { const l = (LI - ecart * (n - 1)) / n; return Array.from({ length: n }, (_, i) => ({ x: X0 + i * (l + ecart), l })); };

const DESSINS = {
    titre(g, m, hi) {
        const l = 800;
        const x = X0 + (LI - l) / 2;
        const corps = s('g', {});
        let y = 0;
        corps.append(s('polyline', { points: `${x + 1.5},40 ${x + 1.5},1.5 ${x + l - 1.5},1.5 ${x + l - 1.5},40`, fill: 'none', stroke: BLEU, 'stroke-width': 3 }));
        y += 40 + 20;
        y += ecrire(corps, m.champs.titre || '', { x, y, l, taille: 64, interligne: 76.8, gras: true, align: 'center', cle: 'c:titre' }).hauteur + 20;
        y += Math.max(24, ecrire(corps, m.champs['sous-titre'] || '', { x, y, l, taille: 28.8, interligne: 24, align: 'center', cle: 'c:sous-titre' }).hauteur) + 20;
        corps.append(s('polyline', { points: `${x + 1.5},${y} ${x + 1.5},${y + 38.5} ${x + l - 1.5},${y + 38.5} ${x + l - 1.5},${y}`, fill: 'none', stroke: ROUGE, 'stroke-width': 3 }));
        y += 40 + 50;
        y += ecrire(corps, m.champs.date || '', { x, y, l, taille: 20.8, interligne: 29.12, couleur: '#929292', align: 'center', cle: 'c:date' }).hauteur;
        y += ecrire(corps, m.champs.annee || '', { x, y, l, taille: 24, interligne: 33.6, gras: true, couleur: GRIS, align: 'center', cle: 'c:annee' }).hauteur;
        corps.setAttribute('transform', `translate(0, ${Y0 + Math.max(0, (hi - y) / 2)})`);
        g.append(corps);
    },
    'titre-epure'(g, m, hi) {
        const corps = s('g', {});
        let y = ecrire(corps, m.champs.titre || '', { x: X0, y: 0, l: LI, taille: 56, interligne: 67.2, gras: true, couleur: BLEU, align: 'center', majuscules: true, cle: 'c:titre' }).hauteur + 20;
        y += ecrire(corps, m.champs['sous-titre'] || '', { x: X0, y, l: LI, taille: 24, interligne: 24, align: 'center', cle: 'c:sous-titre' }).hauteur;
        corps.setAttribute('transform', `translate(0, ${Y0 + Math.max(0, (hi - y) / 2)})`);
        g.append(corps);
    },
    sommaire(g, m) {
        let y = Y0 + ecrire(g, m.champs.titre || '', { x: X0, y: Y0, l: LI, taille: 32, interligne: 40, gras: true, couleur: BLEU, cle: 'c:titre' }).hauteur + 32;
        m.items.forEach((item, n) => {
            const numero = `${String(n + 1).padStart(2, '0')}.`;
            const nl = ecrire(g, numero, { x: X0, y, l: 200, taille: 48, interligne: 76.8, gras: true, couleur: BLEU, cle: `e:${n}.0` }).largeur;
            const x = X0 + nl + 32;
            const titre = ecrire(g, item[0], { x, y: y + 6.4, l: LI - nl - 32, taille: 24, interligne: 32, gras: true, cle: `e:${n}.0` }).hauteur;
            const texte = ecrire(g, item[1], { x, y: y + 6.4 + titre + 8, l: LI - nl - 32, taille: 16, interligne: 24, couleur: GRIS, cle: `e:${n}.1` }).hauteur;
            const h = Math.max(76.8, titre + 8 + texte + 12.8);
            rect(g, X0, y + h + 16, LI, 1, { fill: '#dddddd' });
            y += h + 17 + 24;
        });
    },
    'sommaire-colonnes'(g, m) {
        const y = Y0 + ecrire(g, m.champs.titre || '', { x: X0, y: Y0, l: LI, taille: 32, interligne: 40, gras: true, couleur: BLEU, majuscules: true, cle: 'c:titre' }).hauteur + 32;
        colonnes(Math.max(1, m.items.length), 32).forEach((c, n) => {
            const item = m.items[n];
            if (!item) return;
            let yc = y + ecrire(g, item[0], { x: c.x, y, l: c.l, taille: 20.8, interligne: 36, gras: true, cle: `e:${n}.0` }).hauteur + 24;
            const liste = s('g', { 'data-champ': `e:${n}.1` });
            for (const sous of item[1].split(';').map((x) => x.trim()).filter(Boolean)) yc += ecrire(liste, sous, { x: c.x + 16, y: yc, l: c.l - 16, taille: 19.2, interligne: 34.56, couleur: GRIS }).hauteur + 4;
            g.append(liste);
        });
    },
    intercalaire(g, m, hi) {
        rect(g, X0, Y0, LI, hi, { fill: '#f4f6ff', rx: 4 });
        rect(g, X0, Y0, 10, hi, { fill: BLEU });
        const corps = s('g', {});
        let y = ecrire(corps, m.champs.numero || '', { x: X0 + 10, y: 0, l: LI - 10, taille: 96, interligne: 96, gras: true, couleur: BLEU, align: 'center', cle: 'c:numero' }).hauteur + 16;
        y += ecrire(corps, m.champs.titre || '', { x: X0 + 10, y, l: LI - 10, taille: 40, interligne: 40, gras: true, align: 'center', cle: 'c:titre' }).hauteur + 24;
        corps.setAttribute('transform', `translate(0, ${Y0 + Math.max(0, (hi - y) / 2)})`);
        g.append(corps);
    },
    'intercalaire-centre'(g, m, hi) {
        const corps = s('g', {});
        // Sur une ligne, la boîte fait 40 px comme dans VALOR ; sur plusieurs, les lignes sont espacées pour ne pas se toucher
        const plusieurs = couper(m.champs.titre || '', 64, true, LI).length > 1;
        const h = ecrire(corps, m.champs.titre || '', { x: X0, y: 0, l: LI, taille: 64, interligne: plusieurs ? 76.8 : 40, gras: true, couleur: BLEU, align: 'center', cle: 'c:titre' }).hauteur;
        corps.setAttribute('transform', `translate(0, ${Y0 + Math.max(0, (hi - h) / 2)})`);
        g.append(corps);
    },
    colonne(g, m) {
        const y = Y0 + ecrire(g, m.champs.titre || '', { x: X0, y: Y0, l: LI, taille: 28, interligne: 36, gras: true, cle: 'c:titre' }).hauteur + 16;
        const corps = s('g', {});
        const h = ecrire(corps, m.champs.texte || '', { x: X0 + 32, y: y + 36, l: LI - 64, taille: 17.6, interligne: 28.16, cle: 'c:texte' }).hauteur;
        bloc(g, X0, y, LI, 4 + 32 + h + 24 + 32, 'c:texte');
        g.append(corps);
    },
    colonnes(g, m, hi) {
        const deux = m.items.length <= 2;
        const y = Y0 + 16;
        colonnes(Math.max(1, m.items.length), deux ? 32 : 24).forEach((c, n) => {
            const item = m.items[n];
            if (!item) return;
            const taille = deux ? 28 : 24;
            const interligne = deux ? 36 : 32;
            const numero = ecrire(g, `${n + 1}.`, { x: c.x, y, l: c.l, taille, interligne, gras: true, couleur: BLEU, cle: `e:${n}.0` }).largeur;
            const titre = ecrire(g, item[0], { x: c.x + numero + taille * 0.25, y, l: c.l - numero - taille * 0.25, taille, interligne, gras: true, cle: `e:${n}.0` }).hauteur;
            const yb = y + Math.max(interligne, titre) + (deux ? 16 : 8);
            const marge = deux ? 24 : 16;
            const corps = s('g', {});
            const h = ecrire(corps, item[1], { x: c.x + marge, y: yb + 4 + marge, l: c.l - 2 * marge, taille: 16, interligne: 24, cle: `e:${n}.1` }).hauteur;
            // À deux colonnes, les blocs descendent jusqu'en bas ; à trois et plus, ils font au moins 200 px
            bloc(g, c.x, yb, c.l, deux ? Math.max(Y0 + hi - yb, 4 + 2 * marge + h + 24) : Math.max(200, 4 + 2 * marge + h + 24), `e:${n}.1`);
            g.append(corps);
        });
    },
    'texte-colonnes'(g, m) {
        const y = Y0 + filAriane(g, m, Y0);
        colonnes(Math.max(1, m.items.length), 32).forEach((c, n) => {
            let yc = y;
            if (n === 0) {
                if (m.champs.titre) yc += ecrire(g, m.champs.titre, { x: c.x, y: yc, l: c.l, taille: 19.2, interligne: 36, gras: true, cle: 'c:titre' }).hauteur + 24;
                if (m.champs.accroche) yc += ecrire(g, m.champs.accroche, { x: c.x, y: yc, l: c.l, taille: 17.6, interligne: 24, gras: true, cle: 'c:accroche' }).hauteur + 24;
            }
            if (m.items[n]) ecrire(g, m.items[n][0], { x: c.x, y: yc, l: c.l, taille: 15.2, interligne: 22.8, couleur: GRIS, cle: `e:${n}.0` });
        });
    },
    chiffres(g, m) {
        const y = Y0 + 64;
        colonnes(Math.max(1, m.items.length), 32).forEach((c, n) => {
            const item = m.items[n];
            if (!item) return;
            const cx = c.x + c.l / 2;
            pastille(g, cx, y + 60, 60, `e:${n}.0`);
            ecrire(g, item[0], { x: cx - 56, y: y + 60 - 25.6, l: 112, taille: 32, interligne: 51.2, gras: true, couleur: '#ffffff', align: 'center', cle: `e:${n}.0` });
            for (const dy of [-5, 0, 5]) g.append(s('circle', { cx, cy: y + 138 + dy, r: 1.6, fill: BLEU }));
            ecrire(g, item[1], { x: c.x, y: y + 166, l: c.l, taille: 17.6, interligne: 24, gras: true, align: 'center', cle: `e:${n}.1` });
        });
    },
    frise(g, m) {
        let y = Y0 + 32;
        const x = X0 + 74;
        const l = LI - 74;
        m.items.forEach((item, n) => {
            const corps = s('g', {});
            const titre = ecrire(corps, item[0], { x, y, l, taille: 24, interligne: 32, gras: true, cle: `e:${n}.0` }).hauteur;
            const yt = y + Math.max(32, titre) + 24;
            const texte = ecrire(corps, item[1], { x: x + 16, y: yt + 16, l: l - 32, taille: 16, interligne: 24, cle: `e:${n}.1` }).hauteur;
            const h = yt + 32 + texte + 24 - y;
            if (n < m.items.length - 1) g.append(s('line', { x1: X0 + 40.5, y1: y, x2: X0 + 40.5, y2: y + h, stroke: BLEU, 'stroke-width': 3, 'stroke-dasharray': '9 6' }));
            rect(g, x, yt, l, 32 + texte, { fill: FOND, rx: 4, 'data-champ': `e:${n}.1` });
            pastille(g, X0 + 25, y + 25, 25, `e:${n}.0`);
            ecrire(g, String(n + 1), { x: X0, y: y + 25 - 19.2, l: 50, taille: 24, interligne: 38.4, gras: true, couleur: '#ffffff', align: 'center', cle: `e:${n}.0` });
            g.append(corps);
            y += h + 32;
        });
    },
    blocs(g, m) {
        let y = Y0 + filAriane(g, m, Y0);
        if (m.champs.titre) y += ecrire(g, m.champs.titre, { x: X0, y, l: LI, taille: 20.8, interligne: 36, gras: true, cle: 'c:titre' }).hauteur + 24;
        if (m.champs.texte) y += ecrire(g, m.champs.texte, { x: X0, y, l: 800, taille: 16, interligne: 24, couleur: GRIS, cle: 'c:texte' }).hauteur + 24;
        y += 32;
        const places = colonnes(Math.max(1, m.items.length), 16);
        // Les blocs d'une même rangée ont la hauteur du plus haut
        const contenus = places.map((c, n) => {
            const corps = s('g', {});
            if (!m.items[n]) return { corps, h: 0 };
            const titre = ecrire(corps, m.items[n][0], { x: c.x + 24, y: y + 28, l: c.l - 48, taille: 24, interligne: 32, gras: true, cle: `e:${n}.0` }).hauteur;
            const texte = ecrire(corps, m.items[n][1], { x: c.x + 24, y: y + 28 + titre + 8, l: c.l - 48, taille: 14.4, interligne: 24, couleur: GRIS, cle: `e:${n}.1` }).hauteur;
            return { corps, h: 28 + titre + 8 + texte + 24 + 24 };
        });
        const h = Math.max(140, ...contenus.map((c) => c.h));
        places.forEach((c, n) => { if (m.items[n]) { bloc(g, c.x, y, c.l, h, `e:${n}.0`); g.append(contenus[n].corps); } });
    },
    libre(g, m) {
        let y = Y0;
        let n = 0;
        while (n < m.blocs.length) {
            const b = m.blocs[n];
            const cle = `b:${n}`;
            if (b.t === 'h2') y += ecrire(g, b.texte, { x: X0, y, l: LI, taille: 32, interligne: 40, gras: true, couleur: BLEU, cle }).hauteur + 24;
            else if (b.t === 'h3') y += ecrire(g, b.texte, { x: X0, y, l: LI, taille: 28, interligne: 36, gras: true, couleur: BLEU, cle }).hauteur + 24;
            else if (b.t === 'p') y += ecrire(g, b.texte, { x: X0, y, l: LI, taille: 16, interligne: 24, cle }).hauteur + 24;
            else if (b.t === 'li') {
                g.append(s('circle', { cx: X0 + 22, cy: y + 15.36, r: 3.2, fill: NOIR }));
                y += ecrire(g, b.texte, { x: X0 + 40, y, l: LI - 40, taille: 19.2, interligne: 30.72, cle }).hauteur + 4;
                if (m.blocs[n + 1]?.t !== 'li') y += 24;
            } else {
                // Tableau : les lignes qui se suivent, la première en en-tête ; cellules de même largeur, bordures grises
                const debut = n;
                while (m.blocs[n + 1]?.t === 'ligne') n += 1;
                const rangees = m.blocs.slice(debut, n + 1).map((r) => r.texte.split('|').map((c) => c.trim()));
                const nb = Math.max(1, ...rangees.map((r) => r.length));
                const lc = LI / nb;
                rangees.forEach((cellules, r) => {
                    const corps = s('g', { 'data-champ': `b:${debut + r}` });
                    const h = 16 + Math.max(24, ...Array.from({ length: nb }, (_, c) => ecrire(corps, cellules[c] || '', { x: X0 + c * lc + 8, y: y + 8, l: lc - 16, taille: 16, interligne: 24, gras: r === 0 }).hauteur));
                    for (let c = 0; c < nb; c += 1) rect(g, X0 + c * lc, y, lc, h, { fill: r === 0 ? '#f0f0f0' : '#ffffff', stroke: '#cccccc', 'stroke-width': 1, 'data-champ': `b:${debut + r}` });
                    g.append(corps);
                    y += h;
                });
                y += 24;
            }
            n += 1;
        }
    },
};

// Rend le schéma d'une diapositive : même forme de résultat qu'un schéma Mermaid ({ svg, l, h }).
// « rapport » est le rapport hauteur / largeur de la zone à remplir sur la page.
export async function rendreDiapo(code, rapport = HAUTEUR / LARGEUR) {
    await Promise.all([document.fonts.load(`400 16px ${POLICE}`), document.fonts.load(`700 16px ${POLICE}`)]).catch(() => {});
    const modele = analyser(code);
    const h = Math.round(LARGEUR * Math.max(0.3, Math.min(3, rapport)));
    const svg = s('svg', { xmlns: 'http://www.w3.org/2000/svg', viewBox: `0 0 ${LARGEUR} ${h}`, class: 'fusain-diapo' },
        s('rect', { x: 0, y: 0, width: LARGEUR, height: h, fill: FOND }),
        s('rect', { x: 0, y: 0, width: 4, height: h, fill: BLEU }));
    const g = s('g', {});
    svg.append(g);
    DESSINS[modele.disposition](g, modele, h - 2 * Y0);
    return { svg, l: LARGEUR, h, htmlIncorpore: false };
}
