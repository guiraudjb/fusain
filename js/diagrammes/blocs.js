// Diagramme de blocs : des blocs rangés en colonnes, groupés et reliés
import { h, bouton, champTexte, champSelect, champCase } from '../dom.js';
import { separerPreambule, deplacer, actionsListe, plan, marquer, marquerLien, Inconnu, parLigne, nomLibre } from './commun.js';

// Formes : ouverture et fermeture autour du texte, de la plus longue à la plus courte pour la lecture
const FORMES = [['cercle', 'Cercle', '((', '))'], ['stade', 'Stade', '([', '])'], ['cylindre', 'Base de données', '[(', ')]'], ['hexagone', 'Hexagone', '{{', '}}'],
    ['rect', 'Rectangle', '[', ']'], ['arrondi', 'Rectangle arrondi', '(', ')'], ['losange', 'Losange', '{', '}']];
const ORDRE_FORMES = ['rect', 'arrondi', 'stade', 'cercle', 'hexagone', 'cylindre'];
const RESERVES = new Set(['space', 'block', 'end', 'columns', 'style', 'class', 'classDef']);
const COLONNES_MAX = 12;

// L'accent grave ouvrirait une « chaîne Markdown »
const propre = (t) => String(t).replace(/["`]/g, '\'').replace(/[\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim();
const entier = (v, max = COLONNES_MAX) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= 1 ? Math.min(max, n) : null; };

// Lit une ligne de blocs : « a["A"] b("B"):2 space:1 c »
function lireBlocs(ligne) {
    const items = [];
    let reste = ligne.trim();
    while (reste) {
        let m = reste.match(/^space(?::(\d+))?(?=\s|$)/);
        if (m) { items.push({ t: 'espace', largeur: Number(m[1] || 1) }); reste = reste.slice(m[0].length).trim(); continue; }
        m = reste.match(/^[A-Za-z0-9_]+/);
        if (!m || RESERVES.has(m[0])) throw new Inconnu('bloc mal formé');
        const bloc = { t: 'bloc', id: m[0], nom: null, forme: 'rect', largeur: 1 };
        reste = reste.slice(m[0].length);
        const forme = FORMES.find(([, , ouvre]) => reste.startsWith(ouvre));
        if (forme) {
            const [nom, , ouvre, ferme] = forme;
            const interieur = reste.slice(ouvre.length);
            const t = interieur.match(/^"([^"]*)"/) || interieur.match(/^([^"[\](){}]*)/);
            if (!interieur.slice(t[0].length).startsWith(ferme)) throw new Inconnu('forme de bloc');
            bloc.forme = nom;
            bloc.nom = t[1].trim();
            reste = interieur.slice(t[0].length + ferme.length);
        }
        m = reste.match(/^:(\d+)/);
        if (m) { bloc.largeur = Number(m[1]); reste = reste.slice(m[0].length); }
        if (reste && !/^\s/.test(reste)) throw new Inconnu('bloc mal formé');
        items.push(bloc);
        reste = reste.trim();
    }
    return items;
}

export function analyser(code) {
    const { preambule, corps } = separerPreambule(code);
    if (!/^block(-beta)?$/.test((corps[0] || '').trim())) throw new Error('La première ligne doit être « block-beta ».');
    const modele = { preambule, entete: corps[0].trim(), colonnes: null, enfants: [], liens: [], brut: [] };
    const pile = [modele];
    parLigne(corps.slice(1), preambule, (ligne) => {
        const courant = pile[pile.length - 1];
        let m = ligne.match(/^columns\s+(\d+|auto)$/);
        if (m) { courant.colonnes = m[1] === 'auto' ? null : Number(m[1]); return; }
        if (/^(style|classDef|class)\s/.test(ligne)) { modele.brut.push(ligne); return; }
        m = ligne.match(/^block(?::([A-Za-z0-9_]+))?(?::(\d+))?$/);
        if (m) {
            if (!m[1]) throw new Inconnu('groupe sans identifiant');
            const groupe = { t: 'groupe', id: m[1], largeur: Number(m[2] || 1), colonnes: null, enfants: [] };
            courant.enfants.push(groupe);
            pile.push(groupe);
            return;
        }
        if (ligne === 'end') { if (pile.length < 2) throw new Inconnu('« end » inattendu'); pile.pop(); return; }
        m = ligne.match(/^([A-Za-z0-9_]+)\s+(?:--\s*"([^"]*)"\s*)?(-->|---)\s+([A-Za-z0-9_]+)$/);
        if (m) { modele.liens.push({ de: m[1], vers: m[4], texte: m[2] || '', fleche: m[3] === '-->' }); return; }
        if (/-->|---|==|-\.|~~~|<\[/.test(ligne.replace(/"[^"]*"/g, '""'))) throw new Inconnu('liens en chaîne, pointillés ou blocs-flèches');
        courant.enfants.push(...lireBlocs(ligne));
    });
    if (pile.length > 1) throw new Error('Un groupe n\'est pas refermé par « end ».');
    return modele;
}

export function ecrire(modele) {
    const lignes = [...modele.preambule, modele.entete || 'block-beta'];
    const niveau = (conteneur, retrait) => {
        if (conteneur.colonnes) lignes.push(`${retrait}columns ${conteneur.colonnes}`);
        for (const x of conteneur.enfants) {
            const largeur = x.largeur > 1 ? `:${x.largeur}` : '';
            if (x.t === 'espace') lignes.push(`${retrait}space${largeur}`);
            else if (x.t === 'groupe') { lignes.push(`${retrait}block:${x.id}${largeur}`); niveau(x, `${retrait}    `); lignes.push(`${retrait}end`); } else {
                const [, , ouvre, ferme] = FORMES.find(([f]) => f === x.forme);
                lignes.push(`${retrait}${x.id}${x.nom === null && x.forme === 'rect' ? '' : `${ouvre}"${propre(x.nom ?? x.id) || x.id}"${ferme}`}${largeur}`);
            }
        }
    };
    niveau(modele, '    ');
    for (const l of modele.liens) lignes.push(`    ${l.de} ${propre(l.texte) ? `-- "${propre(l.texte)}" ` : ''}${l.fleche ? '-->' : '---'} ${l.vers}`);
    for (const b of modele.brut) lignes.push(`    ${b}`);
    return lignes.join('\n') + '\n';
}

// Parcours en profondeur : chaque élément avec son conteneur et son rang
function parcourir(conteneur, visite) {
    conteneur.enfants.forEach((x, i) => { visite(x, conteneur, i); if (x.t === 'groupe') parcourir(x, visite); });
}

function tous(modele) {
    const liste = [];
    let espaces = 0;
    parcourir(modele, (x, parent, i) => { liste.push({ x, parent, i, cle: x.t === 'espace' ? `v:${espaces++}` : `${x.t === 'groupe' ? 'g' : 'n'}:${x.id}` }); });
    return liste;
}

const nomDe = (modele, id) => { const t = tous(modele).find((e) => e.x.id === id); return t ? t.x.nom ?? t.x.id : id; };

export function elements(modele) {
    return [
        ...tous(modele).map(({ x, cle }) => (x.t === 'espace' ? { cle, nom: `(espace${x.largeur > 1 ? ` × ${x.largeur}` : ''})`, brut: true } : { cle, nom: x.t === 'groupe' ? `Groupe ${x.id}` : x.nom ?? x.id })),
        ...modele.liens.map((l, i) => ({ cle: `l:${i}`, nom: `${nomDe(modele, l.de)} ${l.fleche ? '→' : '—'} ${nomDe(modele, l.vers)}${l.texte ? ` (${l.texte})` : ''}` })),
    ];
}

export function reperer(svg, modele) {
    for (const { x, cle } of tous(modele)) if (x.t !== 'espace') marquer(svg.querySelector(`[id="${CSS.escape(`${svg.id}-${x.id}`)}"]`), cle);
    const chemins = [...svg.querySelectorAll('g.block > path')];
    if (chemins.length === modele.liens.length) chemins.forEach((chemin, i) => marquerLien(chemin, `l:${i}`));
    const etiquettes = [...svg.querySelectorAll('g.block > g.edgeLabel')];
    const avecTexte = modele.liens.map((l, i) => [l, i]).filter(([l]) => propre(l.texte));
    if (etiquettes.length === avecTexte.length) etiquettes.forEach((g, n) => marquer(g, `l:${avecTexte[n][1]}`));
}

function viser(modele, cle) {
    if (cle.startsWith('l:')) return { i: Number(cle.slice(2)), lien: modele.liens[Number(cle.slice(2))] };
    return tous(modele).find((e) => e.cle === cle) || {};
}

export function texte(modele, cle) {
    const v = viser(modele, cle);
    if (cle.startsWith('l:')) return v.lien?.texte ?? null;
    return v.x?.t === 'bloc' ? v.x.nom ?? v.x.id : null;
}

export function renommer(modele, cle, valeur) {
    const v = viser(modele, cle);
    if (cle.startsWith('l:')) { if (v.lien) v.lien.texte = propre(valeur); } else if (v.x?.t === 'bloc' && propre(valeur)) v.x.nom = propre(valeur);
}

const nbBlocs = (modele) => tous(modele).filter((e) => e.x.t === 'bloc').length;

// Mermaid refuse un groupe ou un schéma vides, et un lien dont une extrémité a disparu
function nettoyer(modele) {
    for (;;) {
        const vide = tous(modele).find((e) => e.x.t === 'groupe' && !e.x.enfants.length);
        if (!vide) break;
        vide.parent.enfants.splice(vide.i, 1);
    }
    const ids = new Set(tous(modele).map((e) => e.x.id).filter(Boolean));
    modele.liens = modele.liens.filter((l) => ids.has(l.de) && ids.has(l.vers));
}

export function supprimer(modele, cle) {
    const v = viser(modele, cle);
    if (cle.startsWith('l:')) { if (v.lien) modele.liens.splice(v.i, 1); return; }
    if (!v.x) return;
    if (v.x.t === 'bloc' && nbBlocs(modele) <= 1) return;
    // Le contenu d'un groupe supprimé prend sa place
    v.parent.enfants.splice(v.i, 1, ...(v.x.t === 'groupe' ? v.x.enfants : []));
    nettoyer(modele);
}

const pris = (modele) => (id) => RESERVES.has(id) || tous(modele).some((e) => e.x.id === id);

// Insère après l'élément visé, ou à la fin du schéma
function inserer(modele, apres, item) {
    const v = apres ? viser(modele, apres) : {};
    if (v.x?.t === 'groupe') { v.x.enfants.push(item); return; }
    if (v.parent) v.parent.enfants.splice(v.i + 1, 0, item); else modele.enfants.push(item);
}

function nouveauBloc(modele) {
    return { t: 'bloc', id: nomLibre('b', pris(modele)), nom: 'Nouveau bloc', forme: 'rect', largeur: 1 };
}

export const peutRelier = (cle) => cle.startsWith('n:');

export function relier(modele, de, vers) {
    const source = de.startsWith('n:') ? viser(modele, de) : {};
    if (!source.x) return null;
    if (vers) {
        const cible = vers.startsWith('n:') || vers.startsWith('g:') ? viser(modele, vers).x : null;
        if (!cible || cible === source.x) return null;
        modele.liens.push({ de: source.x.id, vers: cible.id, texte: '', fleche: true });
        return `l:${modele.liens.length - 1}`;
    }
    const bloc = nouveauBloc(modele);
    source.parent.enfants.splice(source.i + 1, 0, bloc);
    modele.liens.push({ de: source.x.id, vers: bloc.id, texte: '', fleche: true });
    return `n:${bloc.id}`;
}

// Conteneurs où ranger un élément : le schéma, ou tout groupe qui n'est ni lui-même ni l'un de ses sous-groupes
function conteneursPossibles(modele, x) {
    const interdits = new Set();
    if (x.t === 'groupe') { interdits.add(x); parcourir(x, (y) => { if (y.t === 'groupe') interdits.add(y); }); }
    return [['', 'Aucun (schéma)'], ...tous(modele).filter((e) => e.x.t === 'groupe' && !interdits.has(e.x)).map((e) => [e.x.id, `Groupe ${e.x.id}`])];
}

function ranger(modele, cle, idGroupe) {
    const v = viser(modele, cle);
    const cible = idGroupe ? tous(modele).find((e) => e.x.t === 'groupe' && e.x.id === idGroupe)?.x : modele;
    if (!v.x || !cible || cible === v.parent) return;
    v.parent.enfants.splice(v.i, 1);
    cible.enfants.push(v.x);
    nettoyer(modele);
}

export function panneau(ctx) {
    const { modele, selection, appliquer, selectionner } = ctx;
    const v = selection ? viser(modele, selection) : {};
    const ajouter = (fonction) => () => { let cle; appliquer((m) => { cle = fonction(m); }, () => cle); };
    const colonnes = (conteneur, trouver) => champTexte('Nombre de colonnes', conteneur.colonnes ?? '', (val) => appliquer((m) => { trouver(m).colonnes = entier(val); }), { type: 'number', min: 1, max: COLONNES_MAX, step: 1, placeholder: 'une seule rangée' });
    const largeur = () => champTexte('Largeur (en colonnes)', v.x.largeur, (val) => appliquer((m) => { viser(m, selection).x.largeur = entier(val) || 1; }), { type: 'number', min: 1, max: COLONNES_MAX, step: 1 });
    const deplacement = () => actionsListe({
        monter: () => appliquer(() => {}, (m) => { const w = viser(m, selection); deplacer(w.parent.enfants, w.i, -1); return tous(m).find((e) => e.x === w.x).cle; }),
        descendre: () => appliquer(() => {}, (m) => { const w = viser(m, selection); deplacer(w.parent.enfants, w.i, 1); return tous(m).find((e) => e.x === w.x).cle; }),
        supprimer: v.x?.t === 'bloc' && nbBlocs(modele) <= 1 ? null : () => appliquer((m) => supprimer(m, selection), () => null),
    });
    const rangement = () => champSelect('Dans le groupe', conteneursPossibles(modele, v.x), v.parent === modele ? '' : v.parent.id, (val) => appliquer((m) => ranger(m, selection, val), (m) => tous(m).find((e) => e.x === v.x)?.cle ?? null));

    const blocs = [h('div', { class: 'fusain-bloc' },
        h('h2', {}, 'Diagramme de blocs'),
        colonnes(modele, (m) => m),
        h('div', { class: 'fusain-actions' },
            bouton('Bloc', { icone: 'add-line', variante: 'secondary', onclick: ajouter((m) => { const b = nouveauBloc(m); inserer(m, selection, b); return `n:${b.id}`; }) }),
            bouton('Espace', { icone: 'add-line', onclick: ajouter((m) => { const e = { t: 'espace', largeur: 1 }; inserer(m, selection, e); return tous(m).find((x) => x.x === e).cle; }) }),
            bouton('Groupe', { icone: 'add-line', onclick: ajouter((m) => {
                const g = { t: 'groupe', id: nomLibre('groupe', pris(m)), largeur: 1, colonnes: null, enfants: [] };
                inserer(m, selection?.startsWith('g:') ? null : selection, g);
                g.enfants.push(nouveauBloc(m));
                return `g:${g.id}`;
            }) })),
        h('p', { class: 'fusain-aide' }, 'Les blocs remplissent les colonnes de gauche à droite, puis passent à la rangée suivante. Les ajouts se placent après l\'élément sélectionné, ou dans le groupe sélectionné.'))];

    if (v.x?.t === 'bloc') {
        const formes = [...ORDRE_FORMES, ...(ORDRE_FORMES.includes(v.x.forme) ? [] : [v.x.forme])].map((f) => [f, FORMES.find(([n]) => n === f)[1]]);
        const autres = tous(modele).filter((e) => e.x.t !== 'espace' && e.x !== v.x).map((e) => [e.cle, e.x.t === 'groupe' ? `Groupe ${e.x.id}` : e.x.nom ?? e.x.id]);
        blocs.push(h('div', { class: 'fusain-bloc' },
            h('h2', {}, 'Bloc sélectionné'),
            champTexte('Texte', v.x.nom ?? v.x.id, (val) => appliquer((m) => renommer(m, selection, val)), { id: 'fusain-champ-texte' }),
            h('div', { class: 'fusain-ligne' },
                champSelect('Forme', formes, v.x.forme, (val) => appliquer((m) => { const b = viser(m, selection).x; b.forme = val; if (b.nom === null) b.nom = b.id; })),
                largeur()),
            rangement(),
            h('div', { class: 'fusain-actions' }, bouton('Ajouter un bloc relié', { icone: 'add-line', variante: 'secondary', onclick: ajouter((m) => relier(m, selection, null)) })),
            autres.length ? champSelect('Lien vers…', [['', 'Choisir'], ...autres], '', (val) => {
                if (!val) return;
                let cle;
                appliquer((m) => { cle = relier(m, selection, val); }, () => cle);
            }) : null,
            deplacement()));
    } else if (v.x?.t === 'groupe') {
        blocs.push(h('div', { class: 'fusain-bloc' },
            h('h2', {}, 'Groupe sélectionné'),
            h('div', { class: 'fusain-ligne' }, colonnes(v.x, (m) => viser(m, selection).x), largeur()),
            rangement(),
            h('p', { class: 'fusain-aide' }, 'Un groupe vide n\'est pas admis : il disparaît avec son dernier bloc. Le supprimer conserve son contenu.'),
            deplacement()));
    } else if (v.x?.t === 'espace') {
        blocs.push(h('div', { class: 'fusain-bloc' }, h('h2', {}, 'Espace sélectionné'), largeur(), rangement(), deplacement()));
    }

    if (v.lien) {
        const modifier = (fonction) => appliquer((m) => fonction(m.liens[v.i]));
        blocs.push(h('div', { class: 'fusain-bloc' },
            h('h2', {}, 'Lien sélectionné'),
            h('p', { class: 'fusain-aide' }, `${nomDe(modele, v.lien.de)} → ${nomDe(modele, v.lien.vers)}`),
            champTexte('Texte', v.lien.texte, (val) => modifier((x) => { x.texte = propre(val); }), { id: 'fusain-champ-texte' }),
            champCase('Flèche', v.lien.fleche, (coche) => modifier((x) => { x.fleche = coche; })),
            h('div', { class: 'fusain-actions' },
                bouton('Inverser le sens', { icone: 'arrow-left-right-line', onclick: () => modifier((x) => { [x.de, x.vers] = [x.vers, x.de]; }) }),
                bouton('Supprimer', { icone: 'delete-bin-line', onclick: () => appliquer((m) => supprimer(m, selection), () => null) }))));
    }
    blocs.push(h('div', { class: 'fusain-bloc' }, h('h2', {}, 'Plan du schéma'), plan(elements(modele), selection, selectionner)));
    return blocs;
}

export default { type: 'block', nom: 'Diagramme de blocs', analyser, ecrire, elements, reperer, texte, renommer, supprimer, relier, peutRelier, panneau };
