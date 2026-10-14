// Dessin d'une diapositive de carte : moteur cartographique de SimpleCarto (js/geo-engine.js), repris pour FUSAIN.
// D3 calcule la projection, les tracés, l'échelle de couleurs et le placement des étiquettes ; chaque élément est
// construit par s(), sans jamais interpréter de texte comme du balisage (cahier des charges §7.3).
import { s } from './dom.js';
import { analyser, ecrire, option, couleursPersonnalisees, estMonde, departementDe } from './diagrammes/carte.js';
import { chargerBibliotheques, chargerReferentiels, lireDonnees, lireCommunes, referentiels, nomsDesZones, retenirCarte } from './geo.js';
import { chargerIcones } from './icones.js';
import { adresseImage } from './illustrations.js';

export const LARGEUR = 1000;
const POLICE = 'Marianne, arial, sans-serif';
const BLEU = '#000091';
const BLEU_PALE = '#f5f5fe';
const NOIR = '#1e1e1e';
const PALETTES = { divergente: ['#298641', '#EFB900', '#E91719'], 'divergente-inverse': ['#E91719', '#EFB900', '#298641'] };
// Pays trop étendus pour cadrer une carte du monde sur eux
const GEANTS = ['FRA', 'RUS', 'USA', 'ATA'];
// Bornes exactes, en longitude et latitude, de l'image de relief (requête WMS de l'IGN d'origine)
const RELIEF = { lonMin: -5.2, latMin: 41.2, lonMax: 9.7, latMax: 51.3 };
const ETIQUETTES_LEGENDE_MAX = 12;
const format = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });

// Les identifiants internes (dégradés, découpes, flèches) sont uniques dans toute la session : plusieurs cartes
// coexistent dans la page (vignettes, feuille)
let compteur = 0;
const idUnique = (prefixe) => `fusain-${prefixe}-${compteur += 1}`;

let toile = null;
function largeurTexte(texte, taille, gras = false) {
    toile ||= document.createElement('canvas').getContext('2d');
    toile.font = `${gras ? 700 : 400} ${taille}px ${POLICE}`;
    return toile.measureText(texte).width;
}

function couperTexte(texte, taille, max) {
    const lignes = [];
    for (const paragraphe of String(texte).split(/<br\s*\/?>/i)) {
        let ligne = '';
        for (const mot of paragraphe.split(/\s+/).filter(Boolean)) {
            const essai = ligne ? `${ligne} ${mot}` : mot;
            if (ligne && largeurTexte(essai, taille) > max) { lignes.push(ligne); ligne = mot; } else ligne = essai;
        }
        lignes.push(ligne);
    }
    return lignes;
}

// ---------- Territoires de l'échelle choisie ----------

async function territoires(m, lignes) {
    const { d3, topojson } = window;
    if (estMonde(m.echelle)) {
        const monde = await lireDonnees('monde');
        const tous = monde.features.map((f) => ({ f, code: String(f.id), nom: f.properties.nom }));
        let cibles = tous;
        if (m.echelle === 'region-du-monde' && m.zone === 'auto') cibles = tous.filter((t) => lignes.has(t.code));
        else if (m.echelle === 'region-du-monde') {
            const region = referentiels.regionsDuMonde.find((r) => r.code === m.zone);
            if (!region) throw new Error(`Région du monde inconnue : ${m.zone}.`);
            cibles = tous.filter((t) => region.pays.includes(t.code));
        }
        const camera = cibles.filter((t) => !GEANTS.includes(t.code));
        return { tous, cibles, camera: camera.length ? camera : cibles, contexte: true, projection: d3.geoMercator() };
    }

    const conique = () => d3.geoConicConformal().center([2.45, 46.2]);
    if (m.echelle === 'france' || m.echelle === 'region') {
        const topo = await lireDonnees('departements');
        const tous = topojson.feature(topo, topo.objects.departements).features
            .map((f) => ({ f, code: f.properties.code_insee, nom: f.properties.nom_officiel, region: f.properties.code_insee_de_la_region }));
        const cibles = m.echelle === 'region' ? tous.filter((t) => t.region === m.zone) : tous;
        // Vue de la France : l'outre-mer, dessiné à sa place réelle, n'entre pas dans le cadrage
        const camera = m.echelle === 'france' ? cibles.filter((t) => !t.code.startsWith('97')) : cibles;
        return { tous, cibles, camera, contexte: true, projection: conique() };
    }

    // Échelles communales : les contours sont lus région par région
    const regionDe = (dep) => referentiels.regionDuDepartement.get(dep);
    let regions = [];
    if (m.echelle === 'region-communes') regions = [m.zone];
    else if (m.echelle === 'departement') regions = [regionDe(m.zone)];
    else if (m.echelle === 'commune') regions = [regionDe(departementDe(m.zone))];
    else if (m.echelle === 'epci') regions = referentiels.epci.find((e) => e.code === m.zone)?.regions || [];
    regions = regions.filter(Boolean);
    if (!regions.length) throw new Error(`Zone inconnue : ${m.zone}.`);
    const topos = await Promise.all(regions.map(lireCommunes));
    let tous = [];
    for (const topo of topos) {
        const communes = topojson.feature(topo, topo.objects.communes).features;
        const arrondissements = topojson.feature(topo, topo.objects.arrondissements).features;
        // Paris, Lyon et Marseille sont remplacées par leurs arrondissements municipaux quand les données les utilisent,
        // ou à l'échelle de la commune
        const parent = (f) => f.properties.code_insee_de_la_commune_parente;
        const detaillees = new Set(arrondissements.filter((f) => m.echelle === 'commune' || lignes.has(f.properties.code_insee)).map(parent));
        tous = tous.concat(communes.filter((f) => !detaillees.has(f.properties.code_insee)), arrondissements.filter((f) => detaillees.has(parent(f))));
    }
    tous = tous.filter((f) => f.geometry).map((f) => ({ f, code: f.properties.code_insee, nom: f.properties.nom_officiel }));
    const p = (t) => t.f.properties;
    const filtre = {
        'region-communes': (t) => p(t).code_insee_de_la_region === m.zone,
        departement: (t) => p(t).code_insee_du_departement === m.zone,
        epci: (t) => String(p(t).codes_siren_des_epci || '').split('/').includes(m.zone),
        commune: (t) => (p(t).code_insee_de_la_commune_parente || p(t).code_insee) === m.zone,
    }[m.echelle];
    const cibles = tous.filter(filtre);
    // Région détaillée à la commune : les limites des départements gardent des repères lisibles
    const maillage = m.echelle === 'region-communes'
        ? topojson.mesh(topos[0], topos[0].objects.communes, (a, b) => a !== b && a.properties.code_insee_du_departement !== b.properties.code_insee_du_departement)
        : null;
    return { tous: cibles, cibles, camera: cibles, contexte: false, projection: conique(), maillage };
}

// Relief, cours d'eau, rail et routes ne couvrent que la France métropolitaine
function metropolitaine(m) {
    if (estMonde(m.echelle)) return false;
    if ((m.echelle === 'region' || m.echelle === 'region-communes') && /^0\d$/.test(m.zone)) return false;
    if (m.echelle === 'departement' && m.zone.startsWith('97')) return false;
    return true;
}

// ---------- Calques ----------

// Le relief est reprojeté point par point dans la projection de la carte, puis découpé sur les territoires représentés
async function dessinerRelief(svg, defs, projection, chemin, cibles, l, h, opacite) {
    const image = await createImageBitmap(await lireDonnees('calques/relief', 'blob'));
    const source = document.createElement('canvas');
    source.width = image.width;
    source.height = image.height;
    const cs = source.getContext('2d');
    cs.drawImage(image, 0, 0);
    const pixels = cs.getImageData(0, 0, image.width, image.height).data;
    const [[ax, ay], [bx, by]] = chemin.bounds({ type: 'FeatureCollection', features: cibles.map((t) => t.f) });
    const x0 = Math.max(0, Math.floor(ax));
    const y0 = Math.max(0, Math.floor(ay));
    const x1 = Math.min(l, Math.ceil(bx));
    const y1 = Math.min(h, Math.ceil(by));
    if (x1 <= x0 || y1 <= y0) return;
    const finesse = 1.5;
    const lw = Math.ceil((x1 - x0) * finesse);
    const lh = Math.ceil((y1 - y0) * finesse);
    const sortie = document.createElement('canvas');
    sortie.width = lw;
    sortie.height = lh;
    const co = sortie.getContext('2d');
    co.fillStyle = '#ffffff';
    co.fillRect(0, 0, lw, lh);
    const cible = co.getImageData(0, 0, lw, lh);
    const { lonMin, latMin, lonMax, latMax } = RELIEF;
    for (let j = 0; j < lh; j += 1) {
        for (let i = 0; i < lw; i += 1) {
            const lieu = projection.invert([x0 + (i + 0.5) / finesse, y0 + (j + 0.5) / finesse]);
            if (!lieu) continue;
            const sx = Math.floor(((lieu[0] - lonMin) / (lonMax - lonMin)) * image.width);
            const sy = Math.floor(((latMax - lieu[1]) / (latMax - latMin)) * image.height);
            if (sx < 0 || sy < 0 || sx >= image.width || sy >= image.height) continue;
            const a = (sy * image.width + sx) * 4;
            const b = (j * lw + i) * 4;
            const alpha = pixels[a + 3] / 255;
            for (let c = 0; c < 3; c += 1) cible.data[b + c] = pixels[a + c] * alpha + 255 * (1 - alpha);
        }
    }
    co.putImageData(cible, 0, 0);
    const decoupe = idUnique('relief');
    defs.append(s('clipPath', { id: decoupe }, cibles.map((t) => s('path', { d: chemin(t.f) || '' }))));
    svg.append(s('image', { href: sortie.toDataURL('image/jpeg', 0.85), x: x0, y: y0, width: x1 - x0, height: y1 - y0, preserveAspectRatio: 'none', opacity: opacite, 'clip-path': `url(#${decoupe})` }));
}

// Un seul tracé par calque : des milliers de tronçons séparés rendraient le dessin très lent
async function dessinerLignes(svg, chemin, nom, style) {
    const topo = await lireDonnees(`calques/${nom}`);
    const traits = window.topojson.feature(topo, topo.objects[nom]).features;
    const d = chemin({ type: 'GeometryCollection', geometries: traits.map((f) => f.geometry) });
    if (d) svg.append(s('path', { d, fill: 'none', 'stroke-linecap': 'round', ...style }));
}

// Icône du DSFR (tracé recoloré) ou icône illustrée (image), dans un carré de « taille » posé en (x, y)
async function dessinerIcone(g, nom, x, y, taille, couleur) {
    const [jeu, id] = String(nom).split(':');
    if (jeu === 'dsfr') {
        const trouvee = (await chargerIcones()).find((i) => i.nom === id);
        if (trouvee) g.append(s('path', { d: trouvee.trace, fill: couleur, transform: `translate(${x} ${y}) scale(${taille / 24})` }));
    } else {
        const adresse = await adresseImage(id);
        if (adresse) g.append(s('image', { x, y, width: taille, height: taille, href: adresse, preserveAspectRatio: 'xMidYMid meet' }));
    }
}

// ---------- Étiquettes : placement sans chevauchement (simulation de forces de SimpleCarto) ----------

function forceRectangles(espacement) {
    let noeuds;
    function force(alpha) {
        const arbre = window.d3.quadtree().x((d) => d.x).y((d) => d.y).addAll(noeuds);
        for (const d of noeuds) {
            arbre.visit((q, x1, y1, x2, y2) => {
                if (!q.length && q.data !== d) {
                    const d2 = q.data;
                    const w = (d.largeur + d2.largeur) / 2 + espacement;
                    const hh = (d.hauteur + d2.hauteur) / 2 + espacement;
                    let x = d.x - d2.x;
                    let y = d.y - d2.y;
                    const ax = Math.abs(x);
                    const ay = Math.abs(y);
                    if (ax < w && ay < hh) {
                        const lx = (w - ax) / w;
                        const ly = (hh - ay) / hh;
                        if (lx < ly) { x *= lx * alpha; d.x += x; d2.x -= x; } else { y *= ly * alpha; d.y += y; d2.y -= y; }
                    }
                }
                return x1 > d.x + d.largeur / 2 || x2 < d.x - d.largeur / 2 || y1 > d.y + d.hauteur / 2 || y2 < d.y - d.hauteur / 2;
            });
        }
    }
    force.initialize = (n) => { noeuds = n; };
    return force;
}

function filtreAccepte(regle, valeur) {
    const r = String(regle || '').match(/^(>=|<=|>|<|=)\s*(-?\d+(?:[.,]\d+)?)$/);
    if (!r) return true;
    const seuil = Number(r[2].replace(',', '.'));
    const v = valeur ?? 0;
    return { '>': v > seuil, '>=': v >= seuil, '=': v === seuil, '<=': v <= seuil, '<': v < seuil }[r[1]];
}

function dessinerEtiquettes(svg, m, t, chemin, lignes) {
    const nature = option(m, 'etiquettes');
    if (nature === 'aucune') return;
    const taille = option(m, 'taille-etiquettes');
    const noms = String(option(m, 'filtre-noms') || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
    const regle = option(m, 'filtre');
    const noeuds = [];
    for (const z of t.cibles) {
        const [cx, cy] = chemin.centroid(z.f);
        if (Number.isNaN(cx)) continue;
        const ligne = lignes.get(z.code);
        const nom = ligne?.texte || z.nom || '';
        const valeur = ligne && ligne.valeur !== null ? format.format(ligne.valeur) : '';
        if (regle && !filtreAccepte(regle, ligne ? ligne.filtre ?? ligne.valeur : null)) continue;
        if (noms.length && !noms.some((f) => nom.toLowerCase().includes(f) || z.code.toLowerCase() === f)) continue;
        const longueur = nature === 'nom-valeur' ? Math.max(nom.length, valeur.length) : nature === 'nom' ? nom.length : valeur.length;
        if (!longueur) continue;
        noeuds.push({ cx, cy, x: cx, y: cy, code: z.code, nom, valeur, largeur: longueur * taille * 0.62, hauteur: taille * (nature === 'nom-valeur' ? 2.4 : 1.2) });
    }
    const { d3 } = window;
    const force = option(m, 'force');
    const simulation = d3.forceSimulation(noeuds)
        .force('x', d3.forceX((d) => d.cx).strength(force)).force('y', d3.forceY((d) => d.cy).strength(force))
        .force('collision', forceRectangles(option(m, 'espacement'))).stop();
    for (let i = 0; i < 200; i += 1) simulation.tick();
    const g = s('g', { 'font-family': POLICE, 'font-size': taille, 'font-weight': 700, fill: BLEU, stroke: '#ffffff', 'stroke-width': taille * 0.25, 'stroke-linejoin': 'round', 'paint-order': 'stroke fill', 'text-anchor': 'middle' });
    for (const d of noeuds) {
        const texte = s('text', { x: d.x, y: d.y, 'data-champ': `z:${d.code}` });
        if (nature !== 'valeur') texte.append(s('tspan', { x: d.x, dy: nature === 'nom-valeur' ? '-0.2em' : '0.3em' }, d.nom));
        if (nature !== 'nom') texte.append(s('tspan', { x: d.x, dy: nature === 'nom-valeur' ? '1.1em' : '0.3em' }, d.valeur));
        g.append(texte);
    }
    svg.append(g);
}

// ---------- Épingles, pictogrammes, annotations ----------

async function dessinerEpingles(svg, m, projection, l, h) {
    const rayon = option(m, 'taille-epingles');
    const tailleIcone = option(m, 'taille-icones');
    const points = m.epingles.map((e, n) => ({ ...e, n, xy: projection([e.lon, e.lat]) }))
        .filter((p) => p.xy && p.xy[0] >= 0 && p.xy[0] <= l && p.xy[1] >= 0 && p.xy[1] <= h);
    const g = s('g', {});
    svg.append(g);
    const chargements = [];
    for (const p of points) {
        const [x, y] = p.xy;
        const groupe = s('g', { 'data-champ': `e:${p.n}` });
        g.append(groupe);
        if (p.icone) {
            groupe.append(s('rect', { x: x - tailleIcone / 2, y: y - tailleIcone / 2, width: tailleIcone, height: tailleIcone, fill: 'transparent' }));
            chargements.push(dessinerIcone(groupe, p.icone, x - tailleIcone / 2, y - tailleIcone / 2, tailleIcone, p.couleur).catch(() => {}));
        } else groupe.append(s('circle', { cx: x, cy: y, r: rayon, fill: p.couleur, stroke: '#ffffff', 'stroke-width': 1.2 }));
        if (option(m, 'libelles-epingles') && p.texte) {
            groupe.append(s('text', { x: x + (p.icone ? tailleIcone / 2 : rayon) + 3, y: y + 3.5, 'font-size': 10, 'font-family': POLICE, 'font-weight': 700, fill: NOIR, stroke: '#ffffff', 'stroke-width': 2.5, 'stroke-linejoin': 'round', 'paint-order': 'stroke fill' }, p.texte));
        }
    }
    await Promise.all(chargements);
    if (!option(m, 'legende-epingles')) return;

    // Encadré en bas à gauche : un couple couleur (ou icône) et libellé par épingle visible
    const entrees = [];
    const vues = new Set();
    for (const p of points) {
        const cle = `${p.icone || p.couleur}|${p.texte}`;
        if (!p.texte || vues.has(cle)) continue;
        vues.add(cle);
        entrees.push(p);
    }
    if (!entrees.length) return;
    const montrees = entrees.slice(0, ETIQUETTES_LEGENDE_MAX);
    const reste = entrees.length - montrees.length;
    const pas = 17;
    const marge = 8;
    const hauteur = 12 + (montrees.length + (reste > 0 ? 1 : 0)) * pas;
    const largeur = marge * 2 + 15 + Math.max(...montrees.map((e) => largeurTexte(e.texte, 10)), reste > 0 ? largeurTexte(`+${reste} autres`, 10) : 0);
    const legende = s('g', { transform: `translate(12 ${h - 12 - hauteur})`, 'font-family': POLICE, 'font-size': 10 });
    legende.append(s('rect', { width: largeur, height: hauteur, rx: 4, fill: '#ffffff', 'fill-opacity': 0.88, stroke: '#cccccc' }));
    const icones = [];
    montrees.forEach((e, i) => {
        const cy = 6 + i * pas + pas / 2;
        if (e.icone) icones.push(dessinerIcone(legende, e.icone, marge - 2, cy - 7, 14, e.couleur).catch(() => {}));
        else legende.append(s('circle', { cx: marge + 5, cy, r: 5, fill: e.couleur, stroke: '#ffffff', 'stroke-width': 1 }));
        legende.append(s('text', { x: marge + 15, y: cy + 3.5, fill: NOIR }, e.texte));
    });
    if (reste > 0) legende.append(s('text', { x: marge, y: 6 + montrees.length * pas + pas / 2 + 3.5, fill: '#555555', 'font-style': 'italic' }, `+${reste} autre${reste > 1 ? 's' : ''}`));
    await Promise.all(icones);
    svg.append(legende);
}

async function dessinerPictogrammes(svg, m, l, h) {
    await Promise.all(m.pictogrammes.map((p, n) => {
        const x = (p.x / 100) * l - p.taille / 2;
        const y = (p.y / 100) * h - p.taille / 2;
        const g = s('g', { 'data-champ': `p:${n}` }, s('rect', { x, y, width: p.taille, height: p.taille, fill: 'transparent' }));
        svg.append(g);
        return dessinerIcone(g, p.icone, x, y, p.taille, p.couleur).catch(() => {});
    }));
}

function dessinerAnnotations(svg, defs, m, l, h) {
    if (!m.annotations.length) return;
    const fleche = idUnique('fleche');
    defs.append(s('marker', { id: fleche, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 8, markerHeight: 8, orient: 'auto-start-reverse' },
        s('path', { d: 'M0 0 L10 5 L0 10 z', fill: NOIR })));
    m.annotations.forEach((a, n) => {
        const bx = (a.x / 100) * l;
        const by = (a.y / 100) * h;
        const px = (a.cx / 100) * l;
        const py = (a.cy / 100) * h;
        const taille = 12;
        const lignes = couperTexte(a.texte || ' ', taille, 220);
        const largeur = Math.max(40, ...lignes.map((x) => largeurTexte(x, taille))) + 16;
        const hauteur = lignes.length * taille * 1.3 + 12;
        // Flèche légèrement courbe, de la bulle vers la pointe
        const qx = (bx + px) / 2 - (py - by) * 0.15;
        const qy = (by + py) / 2 + (px - bx) * 0.15;
        svg.append(s('path', { d: `M${bx} ${by} Q${qx} ${qy} ${px} ${py}`, fill: 'none', stroke: NOIR, 'stroke-width': 1.5, 'marker-end': `url(#${fleche})` }));
        svg.append(s('circle', { cx: px, cy: py, r: 8, fill: 'transparent', 'data-champ': `a:${n}.pointe` }));
        const bulle = s('g', { 'data-champ': `a:${n}` },
            s('rect', { x: bx - largeur / 2, y: by - hauteur / 2, width: largeur, height: hauteur, rx: 4, fill: '#ffffff', stroke: NOIR, 'stroke-width': 1 }));
        const texte = s('text', { 'font-family': POLICE, 'font-size': taille, fill: NOIR, 'text-anchor': 'middle' });
        lignes.forEach((ligne, i) => texte.append(s('tspan', { x: bx, y: by - hauteur / 2 + 6 + taille + i * taille * 1.3 }, ligne)));
        bulle.append(texte);
        svg.append(bulle);
    });
}

// ---------- Rendu ----------

// Rend une carte : même forme de résultat qu'un schéma Mermaid ({ svg, l, h }). « rapport » est le rapport hauteur / largeur
// de la zone à remplir sur la page.
export async function rendreCarte(code, rapport = 0.7) {
    const m = analyser(code);
    await Promise.all([chargerBibliotheques(), chargerReferentiels(), document.fonts.load(`700 12px ${POLICE}`).catch(() => {})]);
    const { d3 } = window;
    const l = LARGEUR;
    const h = Math.round(l * Math.max(0.3, Math.min(3, rapport)));
    const lignes = new Map(m.donnees.map((d) => [d.code, d]));
    const t = await territoires(m, lignes);
    if (!t.cibles.length) throw new Error('Aucun territoire à représenter pour cette zone.');
    for (const z of t.tous) nomsDesZones.set(z.code, z.nom);

    // Cadrage de SimpleCarto : 85 % de la place, une bande libre en haut et 40 unités en bas pour la légende
    const projection = t.projection.scale(1).translate([0, 0]);
    const chemin = d3.geoPath(projection);
    const [[ax, ay], [bx, by]] = chemin.bounds({ type: 'FeatureCollection', features: t.camera.map((z) => z.f) });
    const haut = 24;
    const disponible = Math.max(40, h - 40 - haut);
    const k = 0.85 / Math.max((bx - ax) / l, (by - ay) / disponible);
    projection.scale(k).translate([(l - k * (bx + ax)) / 2, ((haut + h - 40) - k * (by + ay)) / 2]);
    // Tout tracé est découpé au cadre : les calques de la France entière ne pèsent plus que ce qui est visible
    projection.clipExtent([[-5, -5], [l + 5, h + 5]]);
    retenirCarte(ecrire(m), { inverser: (x, y) => projection.invert([x * l, y * h]), codes: new Set(t.cibles.map((z) => z.code)) });

    // Échelle de couleurs, sur les seuls territoires représentés
    const valeurs = t.cibles.map((z) => lignes.get(z.code)?.valeur).filter((v) => v !== null && v !== undefined);
    let min = valeurs.length ? d3.min(valeurs) : 0;
    let max = valeurs.length ? d3.max(valeurs) : 0;
    if (min === max) { min = 0; max = max || 100; }
    const palette = option(m, 'palette');
    const personnalisees = couleursPersonnalisees(option(m, 'couleurs'));
    const etapes = palette === 'personnalisee' && personnalisees.length >= 2 ? personnalisees : PALETTES[palette] || [BLEU_PALE, BLEU];
    const interpolation = d3.interpolateRgbBasis(etapes);
    const couleurDe = d3.scaleSequential(interpolation).domain([min, max]);

    const svg = s('svg', { xmlns: 'http://www.w3.org/2000/svg', viewBox: `0 0 ${l} ${h}`, class: 'fusain-carte' });
    const defs = s('defs', {});
    svg.append(defs, s('rect', { class: 'fusain-carte-cadre', x: 0, y: 0, width: l, height: h, fill: option(m, 'fond') }));

    const cibles = new Set(t.cibles);
    const contexte = option(m, 'contexte');
    const voisin = d3.color(contexte).darker(0.3).formatHex();
    const zones = s('g', { 'stroke-linejoin': 'round' });
    for (const z of t.contexte ? t.tous : t.cibles) {
        const d = chemin(z.f);
        if (!d) continue;
        const cible = cibles.has(z);
        const ligne = lignes.get(z.code);
        const remplissage = !cible ? contexte : ligne && ligne.valeur !== null ? couleurDe(ligne.valeur) : option(m, 'sans-donnee');
        zones.append(s('path', { d, fill: remplissage, stroke: cible ? '#ffffff' : voisin, 'stroke-width': cible ? 0.5 : 0.2, 'data-champ': cible ? `z:${z.code}` : null }));
    }
    svg.append(zones);
    if (t.maillage) svg.append(s('path', { d: chemin(t.maillage), fill: 'none', stroke: '#555555', 'stroke-width': 1.2, 'stroke-linejoin': 'round' }));

    if (metropolitaine(m)) {
        if (option(m, 'relief')) await dessinerRelief(svg, defs, projection, chemin, t.cibles, l, h, option(m, 'opacite-relief'));
        if (option(m, 'hydrographie')) await dessinerLignes(svg, chemin, 'hydro', { stroke: '#5b8dd6', 'stroke-width': 0.8 });
        if (option(m, 'rail')) await dessinerLignes(svg, chemin, 'rail', { stroke: '#333333', 'stroke-width': 0.7, 'stroke-dasharray': '4,2' });
        if (option(m, 'routes')) await dessinerLignes(svg, chemin, 'routes', { stroke: '#6b3f1d', 'stroke-width': 0.9, 'stroke-opacity': 0.85 });
    }

    await dessinerEpingles(svg, m, projection, l, h);
    dessinerEtiquettes(svg, m, t, chemin, lignes);

    // Légende des valeurs : dégradé et bornes, en bas à droite
    if (valeurs.length && min !== max && option(m, 'legende')) {
        const degrade = idUnique('degrade');
        defs.append(s('linearGradient', { id: degrade, x1: 0, y1: 0, x2: 1, y2: 0 },
            Array.from({ length: 11 }, (_, i) => s('stop', { offset: i / 10, 'stop-color': d3.color(interpolation(i / 10)).formatHex() }))));
        svg.append(s('g', { transform: `translate(${l - 230} ${h - 30})`, 'font-family': POLICE, 'font-size': 12, fill: NOIR },
            s('rect', { width: 200, height: 12, fill: `url(#${degrade})`, stroke: '#cccccc' }),
            s('text', { x: 0, y: -6 }, format.format(min)),
            s('text', { x: 200, y: -6, 'text-anchor': 'end' }, format.format(max))));
    }

    await dessinerPictogrammes(svg, m, l, h);
    dessinerAnnotations(svg, defs, m, l, h);
    return { svg, l, h, htmlIncorpore: false };
}
