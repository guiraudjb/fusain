// Diagrammes C4 (contexte, conteneurs, composants) : acteurs, systèmes, limites et relations
import { h, bouton, champTexte, champSelect, champCase } from '../dom.js';
import { separerPreambule, plan, marquer, marquerLien, Inconnu, parLigne, nomLibre } from './commun.js';

const TITRES = { C4Context: 'Diagramme de contexte (C4)', C4Container: 'Diagramme de conteneurs (C4)', C4Component: 'Diagramme de composants (C4)' };
// Nature d'un élément : radical de l'instruction Mermaid, à laquelle « _Ext » s'ajoute pour un élément externe
const NATURES = [['Person', 'Personne'], ['System', 'Système'], ['SystemDb', 'Système — base de données'], ['SystemQueue', 'Système — file de messages'],
    ['Container', 'Conteneur'], ['ContainerDb', 'Conteneur — base de données'], ['ContainerQueue', 'Conteneur — file de messages'],
    ['Component', 'Composant'], ['ComponentDb', 'Composant — base de données'], ['ComponentQueue', 'Composant — file de messages']];
const LIMITES = [['Boundary', 'Limite'], ['Enterprise_Boundary', 'Organisation'], ['System_Boundary', 'Système'], ['Container_Boundary', 'Conteneur']];
const SENS = [['Rel', 'Automatique'], ['BiRel', 'Double sens'], ['Rel_D', 'Vers le bas'], ['Rel_U', 'Vers le haut'], ['Rel_R', 'Vers la droite'], ['Rel_L', 'Vers la gauche'], ['Rel_Back', 'Retour']];
const SYNONYMES = { Rel_Down: 'Rel_D', Rel_Up: 'Rel_U', Rel_Right: 'Rel_R', Rel_Left: 'Rel_L' };
const ALIAS = /^[A-Za-z0-9_]+$/;
const avecTechno = (nature) => !/^(Person|System)/.test(nature);

const propre = (t) => String(t).replace(/"/g, '\'').replace(/[\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim();
const propreTitre = (t) => propre(t).replace(/[;#]/g, ' ').replace(/\s+/g, ' ').trim();

// Arguments d'une instruction : textes entre guillemets ou mots nus, séparés par des virgules
function arguments_(texte) {
    const args = [];
    let reste = texte.trim();
    while (reste) {
        const m = reste.match(/^(?:"([^"]*)"|([^,"$=]*))\s*(?:,\s*(.*))?$/);
        if (!m) throw new Inconnu('options avancées d\'un élément');
        args.push(m[1] !== undefined ? m[1] : m[2].trim());
        reste = m[3] === undefined ? '' : m[3].trim();
        if (m[3] !== undefined && !reste) args.push('');
    }
    return args;
}

export function analyser(code) {
    const { preambule, corps } = separerPreambule(code);
    const entete = (corps[0] || '').trim();
    if (!TITRES[entete]) throw new Error('La première ligne doit être « C4Context », « C4Container » ou « C4Component ».');
    const modele = { preambule, entete, titre: '', items: [], relations: [], brut: [] };
    const pile = [];
    parLigne(corps.slice(1), preambule, (ligne) => {
        if (ligne === '}') { if (!pile.length) throw new Inconnu('accolade inattendue'); pile.pop(); return; }
        let m = ligne.match(/^title\s+(.*)$/);
        if (m) { modele.titre = m[1].trim(); return; }
        if (/^(Update\w+\s*\(|accTitle|accDescr)/.test(ligne)) { modele.brut.push(ligne); return; }
        m = ligne.match(/^([A-Za-z_]+)\s*\((.*)\)\s*(\{)?$/);
        if (!m) throw new Inconnu('instruction inconnue');
        const macro = SYNONYMES[m[1]] || m[1];
        const args = arguments_(m[2]);
        const parent = pile[pile.length - 1] || '';
        if (LIMITES.some(([l]) => l === macro)) {
            if (!m[3] || args.length < 1 || args.length > 2 || !ALIAS.test(args[0])) throw new Inconnu('limite mal formée');
            modele.items.push({ t: 'limite', macro, id: args[0], nom: args[1] ?? '', parent });
            pile.push(args[0]);
            return;
        }
        if (m[3]) throw new Inconnu('nœuds de déploiement');
        if (SENS.some(([s]) => s === macro)) {
            if (args.length < 2 || args.length > 4 || !ALIAS.test(args[0]) || !ALIAS.test(args[1])) throw new Inconnu('relation mal formée');
            modele.relations.push({ macro, de: args[0], vers: args[1], texte: args[2] ?? '', techno: args[3] ?? '' });
            return;
        }
        const nature = macro.replace(/_Ext$/, '');
        if (!NATURES.some(([n]) => n === nature)) throw new Inconnu('instruction inconnue');
        const max = avecTechno(nature) ? 4 : 3;
        if (args.length < 1 || args.length > max || !ALIAS.test(args[0])) throw new Inconnu('élément mal formé');
        modele.items.push({ t: 'noeud', nature, externe: macro.endsWith('_Ext'), id: args[0], nom: args[1] ?? '', techno: avecTechno(nature) ? args[2] ?? '' : '', desc: (avecTechno(nature) ? args[3] : args[2]) ?? '', parent });
    });
    if (pile.length) throw new Error('Une limite n\'est pas refermée par « } ».');
    return modele;
}

const cite = (t) => `"${propre(t)}"`;

export function ecrire(modele) {
    const lignes = [...modele.preambule, modele.entete];
    if (propreTitre(modele.titre)) lignes.push(`    title ${propreTitre(modele.titre)}`);
    const ecrireNiveau = (parent, retrait) => {
        for (const x of modele.items.filter((i) => i.parent === parent)) {
            if (x.t === 'limite') {
                lignes.push(`${retrait}${x.macro}(${x.id}, ${cite(x.nom || x.id)}) {`);
                ecrireNiveau(x.id, `${retrait}    `);
                lignes.push(`${retrait}}`);
                continue;
            }
            const args = [x.id, cite(x.nom || x.id)];
            if (avecTechno(x.nature)) { if (propre(x.techno) || propre(x.desc)) args.push(cite(x.techno)); if (propre(x.desc)) args.push(cite(x.desc)); } else if (propre(x.desc)) args.push(cite(x.desc));
            lignes.push(`${retrait}${x.nature}${x.externe ? '_Ext' : ''}(${args.join(', ')})`);
        }
    };
    ecrireNiveau('', '    ');
    for (const r of modele.relations) lignes.push(`    ${r.macro}(${r.de}, ${r.vers}, ${cite(r.texte)}${propre(r.techno) ? `, ${cite(r.techno)}` : ''})`);
    for (const b of modele.brut) lignes.push(`    ${b}`);
    return lignes.join('\n') + '\n';
}

const nomDe = (modele, id) => { const x = modele.items.find((i) => i.id === id); return x ? x.nom || x.id : id; };

export function elements(modele) {
    return [
        ...modele.items.map((x) => (x.t === 'limite' ? { cle: `g:${x.id}`, nom: `Limite : ${x.nom || x.id}` } : { cle: `n:${x.id}`, nom: x.nom || x.id })),
        ...modele.relations.map((r, i) => ({ cle: `l:${i}`, nom: `${nomDe(modele, r.de)} → ${nomDe(modele, r.vers)}${r.texte ? ` (${r.texte})` : ''}` })),
    ];
}

export function reperer(svg, modele) {
    const groupes = [...svg.querySelectorAll(':scope > g')];
    for (const x of modele.items.filter((i) => i.t === 'noeud')) marquer(svg.querySelector(`[id="${CSS.escape(`${svg.id}-${x.id}`)}"]`), `n:${x.id}`);
    // Une limite est un cadre suivi de son nom, sans identifiant : elle est reconnue à son nom
    const cadres = groupes.filter((g) => g.firstElementChild?.localName === 'rect' && g.children[1]?.localName === 'text');
    for (const x of modele.items.filter((i) => i.t === 'limite')) {
        const rang = cadres.findIndex((g) => g.children[1].textContent.replace(/\s+/g, ' ').trim() === propre(x.nom || x.id));
        if (rang >= 0) marquer(cadres.splice(rang, 1)[0], `g:${x.id}`);
    }
    // Les relations sont dessinées à la suite dans un même groupe : un trait, puis ses textes
    const liens = groupes.find((g) => [...g.children].some((e) => e.localName === 'line' || e.localName === 'path') && [...g.children].every((e) => ['line', 'path', 'text'].includes(e.localName)));
    const traits = liens ? [...liens.children].filter((e) => e.localName !== 'text') : [];
    if (traits.length !== modele.relations.length) return;
    let n = -1;
    for (const el of [...liens.children]) {
        if (el.localName === 'text') { if (n >= 0) marquer(el, `l:${n}`); } else { n += 1; marquerLien(el, `l:${n}`); }
    }
}

function viser(modele, cle) {
    if (cle.startsWith('l:')) return { i: Number(cle.slice(2)), relation: modele.relations[Number(cle.slice(2))] };
    return { item: modele.items.find((x) => x.id === cle.slice(2) && (x.t === 'limite') === cle.startsWith('g:')) };
}

export function texte(modele, cle) {
    const v = viser(modele, cle);
    return cle.startsWith('l:') ? v.relation?.texte ?? null : v.item ? v.item.nom || v.item.id : null;
}

export function renommer(modele, cle, valeur) {
    const v = viser(modele, cle);
    if (cle.startsWith('l:')) { if (v.relation) v.relation.texte = propre(valeur); } else if (v.item && propre(valeur)) v.item.nom = propre(valeur);
}

// Mermaid refuse une limite vide : elle disparaît avec son dernier contenu
function nettoyer(modele) {
    for (;;) {
        const vide = modele.items.find((x) => x.t === 'limite' && !modele.items.some((y) => y.parent === x.id));
        if (!vide) return;
        modele.items = modele.items.filter((x) => x !== vide);
    }
}

// Le schéma garde toujours au moins un élément : vide, il ne serait plus valide
export function supprimer(modele, cle) {
    const v = viser(modele, cle);
    if (cle.startsWith('l:')) { if (v.relation) modele.relations.splice(v.i, 1); return; }
    if (!v.item) return;
    if (v.item.t === 'limite') {
        // Le contenu de la limite remonte d'un niveau
        for (const x of modele.items) if (x.parent === v.item.id) x.parent = v.item.parent;
        modele.items = modele.items.filter((x) => x !== v.item);
    } else {
        if (modele.items.filter((x) => x.t === 'noeud').length <= 1) return;
        modele.items = modele.items.filter((x) => x !== v.item);
        modele.relations = modele.relations.filter((r) => r.de !== v.item.id && r.vers !== v.item.id);
    }
    nettoyer(modele);
}

const pris = (modele) => (id) => modele.items.some((x) => x.id === id);

function nouveauNoeud(modele, nature, parent = '') {
    const noms = { Person: ['personne', 'Nouvelle personne'], System: ['systeme', 'Nouveau système'], Container: ['conteneur', 'Nouveau conteneur'], Component: ['composant', 'Nouveau composant'] };
    const [prefixe, nom] = noms[nature];
    const x = { t: 'noeud', nature, externe: false, id: nomLibre(prefixe, pris(modele)), nom, techno: '', desc: '', parent };
    modele.items.push(x);
    return x;
}

// Ce que l'on ajoute par défaut dépend du niveau du diagramme
const natureParDefaut = (modele) => ({ C4Context: 'System', C4Container: 'Container', C4Component: 'Component' }[modele.entete]);

export const peutRelier = (cle) => cle.startsWith('n:');

export function relier(modele, de, vers) {
    const source = de.startsWith('n:') ? viser(modele, de).item : null;
    if (!source) return null;
    const relation = (cible) => modele.relations.push({ macro: 'Rel', de: source.id, vers: cible, texte: 'Utilise', techno: '' });
    if (vers) {
        const cible = vers.startsWith('n:') ? viser(modele, vers).item : null;
        if (!cible || cible === source) return null;
        relation(cible.id);
        return `l:${modele.relations.length - 1}`;
    }
    const x = nouveauNoeud(modele, natureParDefaut(modele), source.parent);
    relation(x.id);
    return `n:${x.id}`;
}

// Une limite ne peut pas être rangée dans elle-même ni dans une de ses sous-limites
function limitesPossibles(modele, item) {
    const interdites = new Set(item.t === 'limite' ? [item.id] : []);
    let change = item.t === 'limite';
    while (change) {
        change = false;
        for (const x of modele.items) if (x.t === 'limite' && interdites.has(x.parent) && !interdites.has(x.id)) { interdites.add(x.id); change = true; }
    }
    return [['', 'Aucune'], ...modele.items.filter((x) => x.t === 'limite' && !interdites.has(x.id)).map((x) => [x.id, x.nom || x.id])];
}

export function panneau(ctx) {
    const { modele, selection, appliquer, selectionner } = ctx;
    const v = selection ? viser(modele, selection) : {};
    const ajouter = (fonction) => () => { let cle; appliquer((m) => { cle = fonction(m); }, () => cle); };
    const dans = v.item ? (v.item.t === 'limite' ? v.item.id : v.item.parent) : '';
    const defaut = natureParDefaut(modele);
    const blocs = [h('div', { class: 'fusain-bloc' },
        h('h2', {}, TITRES[modele.entete]),
        champTexte('Titre', modele.titre, (val) => appliquer((m) => { m.titre = propreTitre(val); })),
        h('div', { class: 'fusain-actions' },
            bouton('Personne', { icone: 'add-line', variante: 'secondary', onclick: ajouter((m) => `n:${nouveauNoeud(m, 'Person', dans).id}`) }),
            bouton(NATURES.find(([n]) => n === defaut)[1], { icone: 'add-line', variante: 'secondary', onclick: ajouter((m) => `n:${nouveauNoeud(m, defaut, dans).id}`) }),
            bouton('Limite', { icone: 'add-line', onclick: ajouter((m) => {
                const limite = { t: 'limite', macro: 'Boundary', id: nomLibre('limite', pris(m)), nom: 'Nouvelle limite', parent: dans };
                m.items.push(limite);
                nouveauNoeud(m, defaut, limite.id);
                return `g:${limite.id}`;
            }) })),
        h('p', { class: 'fusain-aide' }, 'Les ajouts se placent dans la limite sélectionnée, ou à côté de l\'élément sélectionné.'))];

    if (v.item?.t === 'noeud') {
        const x = v.item;
        const modifier = (fonction) => appliquer((m) => fonction(viser(m, selection).item));
        const autres = modele.items.filter((y) => y.t === 'noeud' && y !== x).map((y) => [`n:${y.id}`, y.nom || y.id]);
        blocs.push(h('div', { class: 'fusain-bloc' },
            h('h2', {}, 'Élément sélectionné'),
            champTexte('Nom', x.nom, (val) => appliquer((m) => renommer(m, selection, val)), { id: 'fusain-champ-texte' }),
            champSelect('Nature', NATURES, x.nature, (val) => modifier((y) => { y.nature = val; if (!avecTechno(val)) y.techno = ''; })),
            champCase('Externe au périmètre décrit', x.externe, (coche) => modifier((y) => { y.externe = coche; })),
            avecTechno(x.nature) ? champTexte('Technologie', x.techno, (val) => modifier((y) => { y.techno = propre(val); })) : null,
            champTexte('Description', x.desc, (val) => modifier((y) => { y.desc = propre(val); }), { multiligne: true }),
            champSelect('Dans la limite', limitesPossibles(modele, x), x.parent, (val) => appliquer((m) => { viser(m, selection).item.parent = val; nettoyer(m); })),
            h('div', { class: 'fusain-actions' },
                bouton('Ajouter un élément relié', { icone: 'add-line', variante: 'secondary', onclick: ajouter((m) => relier(m, selection, null)) }),
                autres.length ? bouton('Supprimer', { icone: 'delete-bin-line', onclick: () => appliquer((m) => supprimer(m, selection), () => null) }) : null),
            autres.length ? champSelect('Relation vers…', [['', 'Choisir un élément'], ...autres], '', (val) => {
                if (!val) return;
                let cle;
                appliquer((m) => { cle = relier(m, selection, val); }, () => cle);
            }) : null));
    }

    if (v.item?.t === 'limite') {
        const x = v.item;
        const modifier = (fonction) => appliquer((m) => fonction(viser(m, selection).item));
        blocs.push(h('div', { class: 'fusain-bloc' },
            h('h2', {}, 'Limite sélectionnée'),
            champTexte('Nom', x.nom, (val) => appliquer((m) => renommer(m, selection, val)), { id: 'fusain-champ-texte' }),
            h('div', { class: 'fusain-ligne' },
                champSelect('Périmètre', LIMITES, x.macro, (val) => modifier((y) => { y.macro = val; })),
                champSelect('Dans la limite', limitesPossibles(modele, x), x.parent, (val) => appliquer((m) => { viser(m, selection).item.parent = val; nettoyer(m); }))),
            h('p', { class: 'fusain-aide' }, 'Une limite vide n\'est pas admise : elle disparaît avec son dernier élément. La supprimer conserve son contenu.'),
            h('div', { class: 'fusain-actions' }, bouton('Supprimer la limite', { icone: 'delete-bin-line', onclick: () => appliquer((m) => supprimer(m, selection), () => null) }))));
    }

    if (v.relation) {
        const r = v.relation;
        const modifier = (fonction) => appliquer((m) => fonction(m.relations[v.i]));
        blocs.push(h('div', { class: 'fusain-bloc' },
            h('h2', {}, 'Relation sélectionnée'),
            h('p', { class: 'fusain-aide' }, `${nomDe(modele, r.de)} → ${nomDe(modele, r.vers)}`),
            champTexte('Libellé', r.texte, (val) => modifier((y) => { y.texte = propre(val); }), { id: 'fusain-champ-texte' }),
            champTexte('Technologie ou protocole', r.techno, (val) => modifier((y) => { y.techno = propre(val); })),
            champSelect('Sens du tracé', SENS, r.macro, (val) => modifier((y) => { y.macro = val; })),
            h('div', { class: 'fusain-actions' },
                bouton('Inverser le sens', { icone: 'arrow-left-right-line', onclick: () => modifier((y) => { [y.de, y.vers] = [y.vers, y.de]; }) }),
                bouton('Supprimer', { icone: 'delete-bin-line', onclick: () => appliquer((m) => supprimer(m, selection), () => null) }))));
    }
    blocs.push(h('div', { class: 'fusain-bloc' }, h('h2', {}, 'Plan du schéma'), plan(elements(modele), selection, selectionner)));
    return blocs;
}

export default { type: 'C4Context', types: ['C4Context', 'C4Container', 'C4Component'], nom: 'Diagramme C4', analyser, ecrire, elements, reperer, texte, renommer, supprimer, relier, peutRelier, panneau };
