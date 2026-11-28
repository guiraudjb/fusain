// Schéma de routage d'un commutateur HPE Comware, d'après sa configuration brute (« display current-configuration »
// ou seulement les lignes « ip route-static ») : le commutateur, ses prochains sauts (pare-feu, routeurs…), puis les
// sous-réseaux routés, un cadre par VRF (vpn-instance). Les alias (« IP = nom », « réseau/longueur = nom ») nomment
// prochains sauts et sous-réseaux ; ils sont gardés avec le document. Logique pure, sans DOM : tout se calcule dans
// le navigateur et se teste sous bun ou node.
import { ALIAS_MAX, ALIAS_NOM_MAX, ipEnNombre, nombreEnIp, longueurMasque, lireReseau, cleAlias } from './adresses.js';
import { CATEGORIES_RESEAU, categorieDe, categorieDuNom, idsUniques, ecrirePage, nettoyerNom, protegerTexte } from './reseau.js';

export const PREFIXE_ROUTAGE = 'Routage';
export const TABLE_GLOBALE = 'Table globale';
export { ALIAS_MAX, ALIAS_NOM_MAX, ipEnNombre, nombreEnIp, longueurMasque, lireReseau, cleAlias };
export const PREFERENCE_DEFAUT = 60; // préférence d'une route statique sous Comware

// ---------- Lecture de la configuration ----------

const RE_INTERFACE = /^[A-Za-z][A-Za-z-]*\d[\d/:.]*$/;
const MOTS_A_VALEUR = new Set(['preference', 'tag', 'track']);
const MOTS_SEULS = new Set(['permanent', 'no-advertise', 'recursive-lookup', 'host-route']);

// Une ligne « ip route-static … » → route, ou { erreur } ; null si la ligne n'est pas une route statique IPv4
export function lireLigneRoute(ligne) {
    const m = String(ligne).match(/^\s*ip\s+route-static\s+(.*)$/i);
    if (!m) return null;
    let reste = m[1];
    let description = '';
    const d = reste.match(/(?:^|\s)description\s+(.*)$/i);
    if (d) { description = nettoyerNom(d[1]); reste = reste.slice(0, d.index); }
    const t = reste.trim().split(/\s+/).filter(Boolean);
    let i = 0;
    let vrf = '';
    if (/^vpn-instance$/i.test(t[i])) { vrf = t[i + 1] || ''; i += 2; if (!vrf) return { erreur: 'nom de vpn-instance manquant' }; }
    if (/^group$/i.test(t[i])) return { erreur: 'route vers un groupe d\'adresses non prise en charge' };
    const reseau = lireReseau(t[i], t[i + 1]);
    if (!reseau) return { erreur: longueurMasque(t[i + 1]) === null && ipEnNombre(t[i + 1]) !== null ? 'masque non contigu' : 'réseau ou masque illisible' };
    i += 2;
    const route = { vrf: nettoyerNom(vrf), ...reseau, nh: '', nhVrf: '', interface: '', preference: null, tag: null, permanent: false, description };
    let options = false; // après le premier mot-clé, une IP n'est plus le prochain saut (bfd-source…)
    while (i < t.length) {
        const mot = t[i];
        const bas = mot.toLowerCase();
        if (!options && bas === 'vpn-instance' && t[i + 1]) { route.nhVrf = nettoyerNom(t[i + 1]); i += 2; continue; }
        if (!options && !route.nh && ipEnNombre(mot) !== null) { route.nh = nombreEnIp(ipEnNombre(mot)); i += 1; continue; }
        if (!options && !route.interface && !route.nh && RE_INTERFACE.test(mot) && !MOTS_A_VALEUR.has(bas)) { route.interface = mot; i += 1; continue; }
        options = true;
        if (MOTS_A_VALEUR.has(bas) && /^\d+$/.test(t[i + 1] || '')) {
            if (bas === 'preference') route.preference = Number(t[i + 1]);
            else if (bas === 'tag') route.tag = Number(t[i + 1]);
            i += 2;
            continue;
        }
        if (bas === 'permanent') route.permanent = true;
        if (!MOTS_SEULS.has(bas)) { /* bfd, bfd-source, mots inconnus : sans effet sur le schéma */ }
        i += 1;
    }
    if (!route.nh && !route.interface) return { erreur: 'prochain saut manquant' };
    return route;
}

// texte : configuration brute → { commutateur, routes, bilan }
// bilan : { lignes, doublons, ipv6, undo, invalides: [{ ligne, texte, erreur }], corrigees: [{ ligne, avant, cidr }] }
export function lireRoutesComware(texte) {
    const lignes = String(texte ?? '').replace(/^﻿/, '').split(/\r\n|\r|\n/);
    let commutateur = '';
    const routes = [];
    const vues = new Set();
    const bilan = { lignes: 0, doublons: 0, ipv6: 0, undo: 0, invalides: [], corrigees: [] };
    lignes.forEach((brute, n) => {
        const l = brute.trim();
        if (!l) return;
        const s = l.match(/^sysname\s+(.+)$/i);
        if (s && !commutateur) { commutateur = nettoyerNom(s[1]); return; }
        if (/^ipv6\s+route-static\b/i.test(l)) { bilan.ipv6 += 1; return; }
        if (/^undo\s+(ip|ipv6)\s+route-static\b/i.test(l)) { bilan.undo += 1; return; }
        const r = lireLigneRoute(l);
        if (!r) return;
        bilan.lignes += 1;
        if (r.erreur) { bilan.invalides.push({ ligne: n + 1, texte: l.slice(0, 200), erreur: r.erreur }); return; }
        const cle = [r.vrf, r.cidr, r.nhVrf, r.interface.toLowerCase(), r.nh].join('|');
        if (vues.has(cle)) { bilan.doublons += 1; return; }
        vues.add(cle);
        if (r.corrige) bilan.corrigees.push({ ligne: n + 1, cidr: r.cidr });
        routes.push({ ...r, ligne: n + 1 });
    });
    return { commutateur, routes, bilan };
}

// ---------- Alias ----------

// « clé = nom », « clé ; nom » ou « clé<tab>nom », une ligne par alias, « # » en tête de ligne pour un commentaire.
// → { alias: Map(clé normalisée → nom), invalides: [{ ligne, texte }] } ; la dernière définition d'une clé l'emporte
export function lireAlias(texte) {
    const alias = new Map();
    const invalides = [];
    String(texte ?? '').split(/\r\n|\r|\n/).forEach((brute, n) => {
        const l = brute.trim();
        if (!l || l.startsWith('#') || l.startsWith('//')) return;
        const m = l.match(/^([^=;\t]+?)\s*(?:=|;|\t)\s*(.+)$/);
        const cle = m && cleAlias(m[1]);
        const nom = m && nettoyerNom(m[2]).slice(0, ALIAS_NOM_MAX);
        if (!cle || !nom) { invalides.push({ ligne: n + 1, texte: l.slice(0, 120) }); return; }
        if (alias.size >= ALIAS_MAX && !alias.has(cle)) { invalides.push({ ligne: n + 1, texte: l.slice(0, 120) }); return; }
        alias.set(cle, nom);
    });
    return { alias, invalides };
}

// Map (ou liste de paires) → texte, prochains sauts d'abord puis sous-réseaux, dans l'ordre des adresses
export function ecrireAlias(alias) {
    const paires = [...(alias instanceof Map ? alias : new Map(alias || []))];
    const rang = (k) => { const [ip, l] = k.split('/'); return [l === undefined ? 0 : 1, ipEnNombre(ip) ?? 0, Number(l ?? 32)]; };
    paires.sort((a, b) => { const [x, y] = [rang(a[0]), rang(b[0])]; return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]; });
    return paires.map(([k, v]) => `${k} = ${v}`).join('\n');
}

// Nom d'un sous-réseau : alias de son CIDR, sinon alias écrit sur l'adresse seule (« 10.10.10.0 = … »)
const aliasReseau = (alias, r) => alias.get(r.cidr) || (r.longueur < 32 ? alias.get(r.reseau) : '') || '';

// ---------- Pages ----------

const libelleVrf = (vrf) => vrf || TABLE_GLOBALE;
const nomPage = (...parties) => [PREFIXE_ROUTAGE, ...parties].join(' — ').slice(0, 100);
const pluriel = (n, mot, motPluriel = `${mot}s`) => `${n} ${n > 1 ? motPluriel : mot}`;

// Prochains sauts d'une VRF : clé → { cle, nh, nhVrf, interface, routes }
function prochainsSauts(routes) {
    const sauts = new Map();
    for (const r of routes) {
        const cle = [r.nhVrf, r.nh || `if:${r.interface.toLowerCase()}`].join('|');
        const s = sauts.get(cle) || { cle, nh: r.nh, nhVrf: r.nhVrf, interfaces: new Set(), routes: [] };
        if (r.interface) s.interfaces.add(r.interface);
        s.routes.push(r);
        sauts.set(cle, s);
    }
    return [...sauts.values()];
}

// routes groupées par VRF, dans l'ordre d'apparition ; la table globale en dernier
function parVrf(routes) {
    const vrfs = new Map();
    for (const r of routes) (vrfs.get(r.vrf) || vrfs.set(r.vrf, []).get(r.vrf)).push(r);
    return [...vrfs].sort((a, b) => (a[0] === '') - (b[0] === ''));
}

function iconeSaut(jeu, s, nom) {
    if (!s.nh) return `${jeu}:${jeu === 'illus' ? 'cable-reseau-rj45' : 'prise-rj45'}`;
    const cat = categorieDuNom(nom) || categorieDe(nom) || 'routeur';
    const c = CATEGORIES_RESEAU[CATEGORIES_RESEAU[cat]?.rang <= 1 ? cat : 'routeur'];
    return `${jeu}:${c[jeu]}`;
}
const iconeReseau = (jeu, r) => (r.longueur === 0 ? (jeu === 'illus' ? 'illus:box-internet' : 'picto:internet') : `${jeu}:vlan`);

// Texte d'un prochain saut : alias, puis l'adresse (et la VRF de destination si elle diffère)
function texteSaut(s, alias, vrf) {
    const nom = s.nh ? alias.get(s.nh) : '';
    const lignes = s.nh ? (nom ? [nom, s.nh] : [s.nh]) : [`Interface ${[...s.interfaces][0]}`];
    if (s.nhVrf && s.nhVrf !== vrf) lignes.push(`(VRF ${s.nhVrf})`);
    return { nom: nom || lignes[0], texte: lignes.map(protegerTexte).join('\n') };
}

// Une page (de gauche à droite ; la vue d'ensemble de haut en bas) : le commutateur, puis pour chaque VRF un cadre avec ses prochains sauts et leurs sous-réseaux.
// blocs : [{ vrf, sauts: [{ saut, routes }] }] ; resumer(vrf, saut) → texte du renvoi (vue d'ensemble) ou null
function construire({ commutateur, blocs, alias, jeu, descriptions, resumer = null, sens = 'LR' }) {
    const modele = { preambule: [], couloirs: false, sens, noeuds: [], liens: [], groupes: [], styles: {}, brut: [] };
    const nouvelId = idsUniques();
    const racine = nouvelId(commutateur);
    modele.noeuds.push({ id: racine, texte: protegerTexte(commutateur), forme: 'rectangle', groupe: null, classe: null, icone: `${jeu}:${CATEGORIES_RESEAU['commutateur-l3'][jeu]}` });
    for (const { vrf, sauts } of blocs) {
        const groupe = nouvelId(`g_${libelleVrf(vrf)}`);
        modele.groupes.push({ id: groupe, titre: protegerTexte(!vrf ? TABLE_GLOBALE : /^vrf/i.test(vrf) ? vrf : `VRF ${vrf}`), parent: null, sens: null });
        const idsReseaux = new Map(); // CIDR → id : un sous-réseau routé par plusieurs prochains sauts n'a qu'un nœud
        const meilleure = new Map(); // CIDR → plus petite préférence (route active)
        for (const { routes } of sauts) for (const r of routes) meilleure.set(r.cidr, Math.min(meilleure.get(r.cidr) ?? Infinity, r.preference ?? PREFERENCE_DEFAUT));
        for (const { saut, routes } of sauts) {
            const { nom, texte } = texteSaut(saut, alias, vrf);
            const id = nouvelId(`${vrf}_${nom}`);
            // Vue d'ensemble : le prochain saut porte le décompte de ses sous-réseaux (et le renvoi), sans les détailler
            const resume = resumer?.(vrf, saut);
            modele.noeuds.push({ id, texte: resume ? `${texte}\n${resume}` : texte, forme: 'rectangle', groupe, classe: null, icone: iconeSaut(jeu, saut, nom) });
            const sortie = saut.nh ? [...saut.interfaces].join(', ') : '';
            modele.liens.push({ de: racine, vers: id, debut: '', fin: '>', texte: protegerTexte(sortie), trait: 'plein', longueur: 1 });
            if (resume) continue;
            for (const r of routes) {
                let idN = idsReseaux.get(r.cidr);
                if (!idN) {
                    const nomR = aliasReseau(alias, r);
                    const lignes = r.longueur === 0 ? [nomR || 'Route par défaut', r.cidr] : nomR ? [nomR, r.cidr] : [r.cidr];
                    idN = nouvelId(`${vrf}_${r.cidr}`);
                    idsReseaux.set(r.cidr, idN);
                    modele.noeuds.push({ id: idN, texte: lignes.map(protegerTexte).join('\n'), forme: 'rectangle', groupe, classe: null, icone: iconeReseau(jeu, r) });
                }
                const pref = r.preference ?? PREFERENCE_DEFAUT;
                const textes = [descriptions && r.description ? r.description.replace(/^via\s+/i, '') : '', r.preference !== null ? `préférence ${r.preference}` : ''].filter(Boolean);
                modele.liens.push({ de: id, vers: idN, debut: '', fin: '>', texte: textes.map(protegerTexte).join('\n'), trait: pref > meilleure.get(r.cidr) ? 'pointille' : 'plein', longueur: 1 });
            }
        }
    }
    return modele;
}

// Découpe des prochains sauts d'une VRF en pages de parPage sous-réseaux au plus (un prochain saut trop chargé est
// lui-même coupé en parties) → [{ sauts: [{ saut, routes }], titre }]
function decouper(vrf, sauts, parPage, alias) {
    const total = sauts.reduce((n, s) => n + s.routes.length, 0);
    if (!parPage || total <= parPage) return [{ sauts: sauts.map((saut) => ({ saut, routes: saut.routes })), titre: nomPage(libelleVrf(vrf)) }];
    const parties = [];
    for (const saut of sauts) {
        const nom = texteSaut(saut, alias, vrf).nom;
        const n = Math.ceil(saut.routes.length / parPage);
        for (let k = 0; k < n; k += 1) {
            parties.push({ sauts: [{ saut, routes: saut.routes.slice(k * parPage, (k + 1) * parPage) }], titre: nomPage(libelleVrf(vrf), nom + (n > 1 ? ` (${k + 1}/${n})` : '')) });
        }
    }
    return parties;
}

// lu : { commutateur, routes } (lireRoutesComware) ; alias : Map ; options :
// presentation : 'ensemble-vrf' (vue d'ensemble puis une page par VRF) | 'vrf' | 'unique' ; jeu : 'illus' | 'picto' ;
// descriptions : description de la route écrite sur le trait ; parPage : sous-réseaux au plus par page (0 : sans limite)
// → { pages: [{ nom, code, equipements }], alertes, bilan: { vrfs, sauts, reseaux, aliasUtilises: Set } }
export function produirePagesRoutage({ commutateur, routes }, alias = new Map(), options = {}) {
    const { presentation = 'ensemble-vrf', jeu = 'illus', descriptions = true, parPage = 60 } = options;
    const nom = nettoyerNom(commutateur) || 'Commutateur';
    const alertes = [];
    const pages = [];
    const vrfs = parVrf(routes).map(([vrf, rs]) => ({ vrf, sauts: prochainsSauts(rs) }));
    const aliasUtilises = new Set();
    for (const r of routes) {
        if (r.nh && alias.has(r.nh)) aliasUtilises.add(r.nh);
        if (alias.has(r.cidr)) aliasUtilises.add(r.cidr);
        else if (r.longueur < 32 && alias.has(r.reseau)) aliasUtilises.add(r.reseau);
    }
    const bilan = { vrfs: vrfs.length, sauts: vrfs.reduce((n, v) => n + v.sauts.length, 0), reseaux: new Set(routes.map((r) => `${r.vrf}|${r.cidr}`)).size, aliasUtilises };
    if (!routes.length) return { pages, alertes, bilan };
    const ajouter = (titre, blocs, resumer, sens) => {
        const modele = construire({ commutateur: nom, blocs, alias, jeu, descriptions, resumer, sens });
        pages.push({ nom: titre, code: ecrirePage(modele, alertes, titre), equipements: modele.noeuds.length });
    };
    if (presentation === 'unique') {
        ajouter(nomPage(nom), vrfs.map(({ vrf, sauts }) => ({ vrf, sauts: sauts.map((saut) => ({ saut, routes: saut.routes })) })));
        return { pages, alertes, bilan };
    }
    const detail = vrfs.map(({ vrf, sauts }) => ({ vrf, parties: decouper(vrf, sauts, parPage, alias) }));
    if (presentation === 'ensemble-vrf') {
        // Décompte des sous-réseaux de chaque prochain saut ; renvoi vers ses pages quand la VRF en a plusieurs
        // (sinon le cadre de la VRF porte déjà le nom de sa page)
        const pagesDe = new Map();
        for (const { vrf, parties } of detail) {
            if (parties.length < 2) continue;
            for (const p of parties) for (const { saut } of p.sauts) (pagesDe.get(`${vrf}#${saut.cle}`) || pagesDe.set(`${vrf}#${saut.cle}`, []).get(`${vrf}#${saut.cle}`)).push(p.titre);
        }
        ajouter(nomPage(`${nom} : vue d'ensemble`), vrfs.map(({ vrf, sauts }) => ({ vrf, sauts: sauts.map((saut) => ({ saut, routes: saut.routes })) })),
            (vrf, saut) => {
                const n = new Set(saut.routes.map((r) => r.cidr)).size;
                const titres = pagesDe.get(`${vrf}#${saut.cle}`) || [];
                const renvoi = titres.length === 1 ? `\n→ page « ${protegerTexte(titres[0])} »`
                    : titres.length > 1 ? `\n→ ${titres.length} pages « ${protegerTexte(titres[0].replace(/ \(1\/\d+\)$/, ''))} »` : '';
                return pluriel(n, 'sous-réseau routé', 'sous-réseaux routés') + renvoi;
            }, 'TD'); // le commutateur en haut, les VRF côte à côte : la page est en paysage
    }
    for (const { vrf, parties } of detail) for (const p of parties) ajouter(p.titre, [{ vrf, sauts: p.sauts }]);
    return { pages, alertes, bilan };
}
