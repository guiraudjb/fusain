// Diagramme de cas d'utilisation (usecase-beta de Mermaid) : acteurs, cas rangés dans des limites de système, relations
import { h, bouton, champTexte, champSelect } from '../dom.js';
import { separerPreambule, plan, marquer, marquerLien, actionsListe, Inconnu, parLigne, nomLibre, ligneAccessible } from './commun.js';

const SENS = [['', 'Automatique'], ['LR', 'De gauche à droite'], ['TB', 'De haut en bas'], ['RL', 'De droite à gauche'], ['BT', 'De bas en haut']];
const FORMES = [['ellipse', 'Ellipse'], ['rect', 'Rectangle']];
// [genre, libellé, écriture] ; seule l'association porte un texte
const RELATIONS = [['association', 'Association (flèche)', '-->'], ['ligne', 'Association (trait)', '--'], ['generalisation', 'Généralisation', '--|>'],
    ['include', 'Inclusion (include)', '..> : include'], ['extend', 'Extension (extend)', '..> : extend']];
const ID = String.raw`[A-Za-z_][A-Za-z0-9_]*`;
const RE_ACTEUR = new RegExp(`^actor\\s+(${ID})(?:\\s*\\("([^"]*)"\\))?$`);
const RE_CAS = new RegExp(`^(${ID})\\s*(?:\\("([^"]*)"\\)|\\[("[^"]*"|[^\\]"]*)\\])$`);
const RE_LIMITE = new RegExp(`^systemBoundary\\s+(?:"([^"]*)"|(${ID}))$`);
const RE_DEPENDANCE = new RegExp(`^(${ID})\\s*\\.\\.>\\s*:\\s*(include|extend)\\s+(${ID})$`);
const RE_TEXTE = new RegExp(`^(${ID})\\s*--\\s+(.+?)\\s+-->\\s*(${ID})$`);
const RE_FLECHE = new RegExp(`^(${ID})\\s*(-->|--\\|>|--|<--)\\s*(${ID})$`);

// Un libellé va entre guillemets droits ; l'accent grave en tête ouvrirait un texte Markdown
const propre = (t) => String(t ?? '').replace(/\s+/g, ' ').replace(/"/g, '”').replace(/`/g, '’').trim();
// Le texte d'une association n'est pas entre guillemets : seuls lettres, chiffres, espaces et quelques signes y sont admis
// « ::: » (trois deux-points ou plus) est lu par Mermaid comme l'attribution d'une classe : ramené à « :: »
const propreLien = (t) => propre(t).replace(/[^\p{L}\p{N} .,!?%+*=&:#_/]|-{2,}/gu, ' ').replace(/:{3,}/g, '::').replace(/\s+/g, ' ').trim();

export function analyser(code) {
    const { preambule, corps } = separerPreambule(code);
    if ((corps[0] || '').trim() !== 'usecase-beta') throw new Error('La première ligne doit être « usecase-beta ».');
    const modele = { preambule, sens: '', acteurs: [], cas: [], limites: [], relations: [], brut: [] };
    let limite = null;
    parLigne(corps.slice(1), preambule, (ligne) => {
        let m = ligne.match(/^direction\s+(LR|RL|TB|BT|TD)$/);
        if (m) { modele.sens = m[1] === 'TD' ? 'TB' : m[1]; return; }
        if (ligne === 'end') { if (limite === null) throw new Inconnu('« end » sans limite de système'); limite = null; return; }
        m = ligne.match(RE_LIMITE);
        if (m) {
            if (limite !== null) throw new Inconnu('limites imbriquées');
            modele.limites.push({ titre: m[1] ?? m[2] });
            limite = modele.limites.length - 1;
            return;
        }
        m = ligne.match(RE_ACTEUR);
        if (m) { modele.acteurs.push({ id: m[1], nom: m[2] ?? m[1] }); return; }
        m = ligne.match(RE_DEPENDANCE);
        if (m) { modele.relations.push({ de: m[1], vers: m[3], genre: m[2], texte: '' }); return; }
        m = ligne.match(RE_TEXTE);
        if (m) { modele.relations.push({ de: m[1], vers: m[3], genre: 'association', texte: m[2] }); return; }
        m = ligne.match(RE_FLECHE);
        if (m) {
            // « B <-- A » se dessine comme « A --> B »
            if (m[2] === '<--') modele.relations.push({ de: m[3], vers: m[1], genre: 'association', texte: '' });
            else modele.relations.push({ de: m[1], vers: m[3], genre: RELATIONS.find((r) => r[2] === m[2])[0], texte: '' });
            return;
        }
        m = ligne.match(RE_CAS);
        if (m) {
            if (modele.cas.some((c) => c.id === m[1])) throw new Inconnu('cas déclaré deux fois');
            modele.cas.push({ id: m[1], nom: m[2] ?? m[3].replace(/^"|"$/g, '').trim(), forme: m[2] !== undefined ? 'ellipse' : 'rect', limite });
            return;
        }
        if (/^(style|classDef|class)\s/.test(ligne) || ligneAccessible(ligne)) { modele.brut.push(ligne); return; }
        throw new Inconnu('instruction inconnue');
    });
    if (limite !== null) throw new Error('Une limite de système n\'est pas refermée par « end ».');
    const ids = new Set([...modele.acteurs, ...modele.cas].map((x) => x.id));
    const orpheline = modele.relations.find((r) => !ids.has(r.de) || !ids.has(r.vers));
    if (orpheline) throw new Error(`Cette écriture n'est pas gérée par l'édition visuelle : la relation ${orpheline.de} → ${orpheline.vers} vise un élément qui n'est pas déclaré (actor … ou Id("…")).`);
    return modele;
}

const ecrireCas = (c) => (c.forme === 'rect' ? `${c.id}["${propre(c.nom)}"]` : `${c.id}("${propre(c.nom)}")`);

export function ecrire(modele) {
    const lignes = [...modele.preambule, 'usecase-beta'];
    if (modele.sens) lignes.push(`    direction ${modele.sens}`);
    for (const a of modele.acteurs) lignes.push(`    actor ${a.id}${propre(a.nom) && a.nom !== a.id ? `("${propre(a.nom)}")` : ''}`);
    modele.limites.forEach((l, i) => {
        lignes.push(`    systemBoundary "${propre(l.titre) || 'Système'}"`);
        for (const c of modele.cas.filter((x) => x.limite === i)) lignes.push(`        ${ecrireCas(c)}`);
        lignes.push('    end');
    });
    for (const c of modele.cas.filter((x) => x.limite === null || !modele.limites[x.limite])) lignes.push(`    ${ecrireCas(c)}`);
    for (const r of modele.relations) {
        if (r.genre === 'include' || r.genre === 'extend') lignes.push(`    ${r.de} ..> : ${r.genre} ${r.vers}`);
        else if (r.genre === 'association' && propreLien(r.texte)) lignes.push(`    ${r.de} -- ${propreLien(r.texte)} --> ${r.vers}`);
        else lignes.push(`    ${r.de} ${RELATIONS.find((x) => x[0] === r.genre)?.[2] || '-->'} ${r.vers}`);
    }
    for (const b of modele.brut) lignes.push(`    ${b}`);
    return lignes.join('\n') + '\n';
}

const nomDe = (modele, id) => [...modele.acteurs, ...modele.cas].find((x) => x.id === id)?.nom || id;
const nomRelation = (genre) => RELATIONS.find((r) => r[0] === genre)?.[1] || genre;

export const elements = (modele) => [
    ...modele.acteurs.map((a, i) => ({ cle: `a:${i}`, nom: `Acteur : ${a.nom}` })),
    ...modele.cas.map((c, i) => ({ cle: `c:${i}`, nom: `Cas : ${c.nom}` })),
    ...modele.limites.map((l, i) => ({ cle: `b:${i}`, nom: `Système : ${l.titre}` })),
    ...modele.relations.map((r, i) => ({ cle: `r:${i}`, nom: `${nomDe(modele, r.de)} → ${nomDe(modele, r.vers)} (${nomRelation(r.genre)}${r.texte ? ` : ${r.texte}` : ''})` })),
];

export function reperer(svg, modele) {
    const noeud = (id) => svg.querySelector(`[id="${CSS.escape(`${svg.id}-usecase-${id}`)}"]`);
    modele.acteurs.forEach((a, i) => marquer(noeud(a.id), `a:${i}`));
    modele.cas.forEach((c, i) => marquer(noeud(c.id), `c:${i}`));
    const limites = [...svg.querySelectorAll('g.usecase-system-boundary')];
    if (limites.length === modele.limites.length) limites.forEach((g, i) => marquer(g, `b:${i}`));
    modele.relations.forEach((_, i) => {
        const chemin = svg.querySelector(`[id="${CSS.escape(`usecase-${svg.id}-edge-${i}`)}"]`);
        if (!chemin) return;
        marquerLien(chemin, `r:${i}`);
        marquer(svg.querySelector(`g.edgeLabel g.label[data-id="edge-${i}"]`), `r:${i}`);
    });
}

function viser(modele, cle) {
    const i = Number(cle.slice(2));
    return { a: modele.acteurs, c: modele.cas, b: modele.limites, r: modele.relations }[cle[0]]?.[i] || null;
}

export function texte(modele, cle) {
    const x = viser(modele, cle);
    if (!x) return null;
    return cle.startsWith('b:') ? x.titre : cle.startsWith('r:') ? x.texte : x.nom;
}

export function renommer(modele, cle, valeur) {
    const x = viser(modele, cle);
    const v = propre(valeur);
    if (!x) return;
    if (cle.startsWith('b:')) { if (v) x.titre = v; } else if (cle.startsWith('r:')) { x.texte = x.genre === 'association' ? propreLien(v) : ''; } else if (v) x.nom = v;
}

export function supprimer(modele, cle) {
    const i = Number(cle.slice(2));
    if (cle.startsWith('r:')) { modele.relations.splice(i, 1); return; }
    if (cle.startsWith('b:')) {
        // Les cas de la limite supprimée restent, hors de toute limite
        modele.limites.splice(i, 1);
        for (const c of modele.cas) { if (c.limite === i) c.limite = null; else if (c.limite > i) c.limite -= 1; }
        return;
    }
    const liste = cle.startsWith('a:') ? modele.acteurs : modele.cas;
    const [x] = liste.splice(i, 1);
    if (x) modele.relations = modele.relations.filter((r) => r.de !== x.id && r.vers !== x.id);
}

const pris = (modele) => (id) => [...modele.acteurs, ...modele.cas].some((x) => x.id === id);
export const peutRelier = (cle) => /^[ac]:/.test(cle);

export function relier(modele, de, vers) {
    const source = viser(modele, de);
    if (!source) return de;
    let cible = vers && /^[ac]:/.test(vers) && vers !== de ? viser(modele, vers) : null;
    if (!cible) {
        const limite = de.startsWith('c:') ? source.limite : (modele.limites.length ? 0 : null);
        cible = { id: nomLibre('cas', pris(modele)), nom: 'Nouveau cas', forme: 'ellipse', limite };
        modele.cas.push(cible);
    }
    const genre = de.startsWith('c:') && cible && modele.cas.includes(cible) ? 'include' : 'association';
    modele.relations.push({ de: source.id, vers: cible.id, genre, texte: '' });
    return `r:${modele.relations.length - 1}`;
}

export function panneau(ctx) {
    const { modele, selection, appliquer, selectionner } = ctx;
    const i = selection ? Number(selection.slice(2)) : -1;
    const x = selection ? viser(modele, selection) : null;
    const limiteCourante = selection?.startsWith('b:') ? i : selection?.startsWith('c:') ? x?.limite ?? null : (modele.limites.length ? 0 : null);
    const ajouterCas = (m) => { m.cas.push({ id: nomLibre('cas', pris(m)), nom: 'Nouveau cas', forme: 'ellipse', limite: limiteCourante }); return `c:${m.cas.length - 1}`; };
    const tous = [...modele.acteurs, ...modele.cas].map((e) => [e.id, e.nom]);
    const blocs = [h('div', { class: 'fusain-bloc' },
        h('h2', {}, 'Cas d\'utilisation'),
        champSelect('Sens de lecture', SENS, modele.sens, (v) => appliquer((m) => { m.sens = v; })),
        h('div', { class: 'fusain-actions' },
            bouton('Acteur', { icone: 'add-line', variante: 'secondary', onclick: () => appliquer((m) => { const id = nomLibre('acteur', pris(m)); m.acteurs.push({ id, nom: 'Nouvel acteur' }); }, (m) => `a:${m.acteurs.length - 1}`) }),
            bouton('Cas', { icone: 'add-line', variante: 'secondary', onclick: () => { let cle; appliquer((m) => { cle = ajouterCas(m); }, () => cle); } }),
            bouton('Limite de système', { icone: 'add-line', onclick: () => appliquer((m) => { m.limites.push({ titre: 'Nouveau système' }); m.cas.push({ id: nomLibre('cas', pris(m)), nom: 'Nouveau cas', forme: 'ellipse', limite: m.limites.length - 1 }); }, (m) => `b:${m.limites.length - 1}`) })),
        h('p', { class: 'fusain-aide' }, 'Un cas s\'ajoute dans la limite de système sélectionnée. Tirez la poignée d\'un acteur ou d\'un cas pour créer une relation.'))];

    if (x && (selection.startsWith('a:') || selection.startsWith('c:'))) {
        const estCas = selection.startsWith('c:');
        const maj = (f) => appliquer((m) => f(viser(m, selection)));
        blocs.push(h('div', { class: 'fusain-bloc' }, h('h2', {}, estCas ? 'Cas sélectionné' : 'Acteur sélectionné'),
            champTexte('Nom', x.nom, (v) => appliquer((m) => renommer(m, selection, v)), { id: 'fusain-champ-texte' }),
            estCas ? h('div', { class: 'fusain-ligne' },
                champSelect('Forme', FORMES, x.forme, (v) => maj((y) => { y.forme = v; })),
                champSelect('Dans le système', [['', 'Aucun'], ...modele.limites.map((l, k) => [String(k), l.titre])], x.limite === null ? '' : String(x.limite), (v) => maj((y) => { y.limite = v === '' ? null : Number(v); }))) : null,
            champSelect('Relier à…', [['', 'Choisir un élément'], ...tous.filter(([id]) => id !== x.id)], '', (v) => {
                if (!v) return;
                const cible = modele.acteurs.findIndex((a) => a.id === v);
                let cle;
                appliquer((m) => { cle = relier(m, selection, cible >= 0 ? `a:${cible}` : `c:${m.cas.findIndex((c) => c.id === v)}`); }, () => cle);
            }),
            actionsListe({ supprimer: () => appliquer((m) => supprimer(m, selection), () => null) })));
    } else if (x && selection.startsWith('b:')) {
        blocs.push(h('div', { class: 'fusain-bloc' }, h('h2', {}, 'Limite de système sélectionnée'),
            champTexte('Nom du système', x.titre, (v) => appliquer((m) => renommer(m, selection, v)), { id: 'fusain-champ-texte' }),
            h('div', { class: 'fusain-actions' }, bouton('Ajouter un cas dans ce système', { icone: 'add-line', variante: 'secondary', onclick: () => { let cle; appliquer((m) => { cle = ajouterCas(m); }, () => cle); } })),
            h('p', { class: 'fusain-aide' }, 'Supprimer la limite conserve ses cas, hors de tout système.'),
            actionsListe({ supprimer: () => appliquer((m) => supprimer(m, selection), () => null) })));
    } else if (x && selection.startsWith('r:')) {
        const maj = (f) => appliquer((m) => f(m.relations[i]));
        blocs.push(h('div', { class: 'fusain-bloc' }, h('h2', {}, 'Relation sélectionnée'),
            h('div', { class: 'fusain-ligne' },
                champSelect('De', tous, x.de, (v) => maj((y) => { y.de = v; })),
                champSelect('Vers', tous, x.vers, (v) => maj((y) => { y.vers = v; }))),
            champSelect('Nature', RELATIONS.map(([g, nom]) => [g, nom]), x.genre, (v) => maj((y) => { y.genre = v; if (v !== 'association') y.texte = ''; })),
            x.genre === 'association' ? champTexte('Texte', x.texte, (v) => appliquer((m) => renommer(m, selection, v)), { id: 'fusain-champ-texte' }) : null,
            actionsListe({ extra: [bouton('Inverser', { icone: 'arrow-left-right-line', onclick: () => maj((y) => { [y.de, y.vers] = [y.vers, y.de]; }) })], supprimer: () => appliquer((m) => supprimer(m, selection), () => null) })));
    }
    blocs.push(h('div', { class: 'fusain-bloc' }, h('h2', {}, 'Plan du schéma'), plan(elements(modele), selection, selectionner)));
    return blocs;
}

export default { type: 'usecase', nom: 'Cas d\'utilisation', analyser, ecrire, elements, reperer, texte, renommer, supprimer, relier, peutRelier, panneau };
