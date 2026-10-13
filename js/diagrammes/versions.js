// Historique de versions : une suite d'opérations (commit, branche, bascule, fusion)
import { h, bouton, champTexte, champSelect } from '../dom.js';
import { separerPreambule, deplacer, actionsListe, plan, marquer, Inconnu, parLigne, nomLibre } from './commun.js';

const PRINCIPALE = 'main';
const TYPES = [['', 'Normal'], ['HIGHLIGHT', 'Mis en avant'], ['REVERSE', 'Annulation']];
const NOM = '(?:"([^"]+)"|([A-Za-z0-9_./-]+))';
const RE_ATTRIBUT = /^\s*(id|tag|type|msg)\s*:\s*(?:"([^"]*)"|([A-Za-z]+))/;

const propre = (t) => String(t).replace(/"/g, '\'').replace(/[\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim();
const ecrireNom = (n) => (/^[A-Za-z0-9_-]+$/.test(n) && !/^(commit|branch|checkout|switch|merge|order|cherry-pick)$/.test(n) ? n : `"${n}"`);

function attributs(texte, op) {
    let reste = texte;
    const vus = new Set();
    while (reste.trim()) {
        const m = reste.match(RE_ATTRIBUT);
        if (!m || vus.has(m[1])) throw new Inconnu('options de commit');
        vus.add(m[1]);
        const valeur = m[2] ?? m[3];
        if (m[1] === 'type') { if (!['NORMAL', 'HIGHLIGHT', 'REVERSE'].includes(valeur)) throw new Inconnu('type de commit'); op.type = valeur === 'NORMAL' ? '' : valeur; } else op[m[1]] = valeur;
        reste = reste.slice(m[0].length);
    }
    return op;
}

export function analyser(code) {
    const { preambule, corps } = separerPreambule(code);
    if (!/^gitGraph(\s+(LR|TB|BT))?\s*:?$/.test((corps[0] || '').trim())) throw new Error('La première ligne doit être « gitGraph ».');
    const modele = { preambule, entete: corps[0].trim(), ops: [], brut: [] };
    parLigne(corps.slice(1), preambule, (ligne) => {
        if (/^(accTitle|accDescr)\b/.test(ligne)) { modele.brut.push(ligne); return; }
        let m = ligne.match(/^commit\b(.*)$/);
        if (m) { modele.ops.push(attributs(m[1], { t: 'commit', id: '', tag: '', type: '', msg: '' })); return; }
        m = ligne.match(new RegExp(`^branch\\s+${NOM}$`));
        if (m) { modele.ops.push({ t: 'branche', nom: m[1] ?? m[2] }); return; }
        m = ligne.match(new RegExp(`^(?:checkout|switch)\\s+${NOM}$`));
        if (m) { modele.ops.push({ t: 'bascule', nom: m[1] ?? m[2] }); return; }
        m = ligne.match(new RegExp(`^merge\\s+${NOM}(.*)$`));
        if (m) { modele.ops.push(attributs(m[3], { t: 'fusion', nom: m[1] ?? m[2], id: '', tag: '', type: '', msg: '' })); return; }
        throw new Inconnu('ordre des branches, report de commit');
    });
    return modele;
}

export function ecrire(modele) {
    const lignes = [...modele.preambule, modele.entete || 'gitGraph'];
    for (const b of modele.brut) lignes.push(`    ${b}`);
    const options = (op) => `${propre(op.id) ? ` id: "${propre(op.id)}"` : ''}${op.msg && propre(op.msg) ? ` msg: "${propre(op.msg)}"` : ''}${op.type ? ` type: ${op.type}` : ''}${propre(op.tag) ? ` tag: "${propre(op.tag)}"` : ''}`;
    for (const op of modele.ops) {
        if (op.t === 'commit') lignes.push(`    commit${options(op)}`);
        else if (op.t === 'fusion') lignes.push(`    merge ${ecrireNom(op.nom)}${options(op)}`);
        else lignes.push(`    ${op.t === 'branche' ? 'branch' : 'checkout'} ${ecrireNom(op.nom)}`);
    }
    return lignes.join('\n') + '\n';
}

// Rejoue l'historique comme Mermaid : rend, pour chaque opération, la branche sur laquelle elle s'applique,
// ou null si Mermaid la refuserait (branche inconnue ou en double, fusion sans rien à fusionner)
function rejouer(ops) {
    const tetes = new Map([[PRINCIPALE, null]]);
    const ids = new Set();
    // Branche sur laquelle chaque commit a été créé : une branche sans commit propre ne reçoit pas de fusion de sa branche d'origine
    const origines = new Map();
    let courante = PRINCIPALE;
    let n = 0;
    const branches = ops.map((op) => {
        const avant = courante;
        if (op.t === 'branche') { if (tetes.has(op.nom)) return null; tetes.set(op.nom, tetes.get(courante)); courante = op.nom; return avant; }
        if (op.t === 'bascule') { if (!tetes.has(op.nom)) return null; courante = op.nom; return avant; }
        if (op.t === 'fusion' && (!tetes.has(op.nom) || op.nom === courante || tetes.get(courante) === null || tetes.get(op.nom) === null || tetes.get(op.nom) === tetes.get(courante) || origines.get(tetes.get(courante)) === op.nom)) return null;
        if (propre(op.id)) { if (ids.has(propre(op.id))) return null; ids.add(propre(op.id)); }
        n += 1;
        tetes.set(courante, n);
        origines.set(n, courante);
        return courante;
    });
    return { branches, courante, noms: [...tetes.keys()], tetes };
}

// Retire les opérations devenues impossibles après une modification
function assainir(modele) {
    for (;;) {
        const { branches } = rejouer(modele.ops);
        const i = branches.indexOf(null);
        if (i < 0) return;
        modele.ops.splice(i, 1);
    }
}

// Applique une modification, et la défait si elle rend une autre opération impossible
function tenter(modele, fonction) {
    const avant = JSON.stringify(modele.ops);
    fonction(modele);
    if (!rejouer(modele.ops).branches.includes(null)) return true;
    modele.ops = JSON.parse(avant);
    return false;
}

const estCommit = (op) => op.t === 'commit' || op.t === 'fusion';

export function elements(modele) {
    const { branches } = rejouer(modele.ops);
    return [{ cle: `b:${PRINCIPALE}`, nom: `Branche ${PRINCIPALE}` }, ...modele.ops.map((op, i) => {
        if (op.t === 'branche') return { cle: `b:${op.nom}`, nom: `Branche ${op.nom}` };
        if (op.t === 'bascule') return { cle: `o:${i}`, nom: `→ bascule sur ${op.nom}`, brut: true };
        return { cle: `c:${i}`, nom: op.t === 'fusion' ? `Fusion de ${op.nom} dans ${branches[i] ?? '?'}${op.tag ? ` [${op.tag}]` : ''}` : `${op.id || 'Commit'}${op.tag ? ` [${op.tag}]` : ''} (${branches[i] ?? '?'})` };
    })];
}

export function reperer(svg, modele) {
    const commits = modele.ops.map((op, i) => [op, i]).filter(([op]) => estCommit(op));
    const points = [...svg.querySelectorAll('.commit-bullets > .commit:not(.commit-merge):not(.commit-highlight-inner):not(.commit-reverse)')];
    if (points.length === commits.length) points.forEach((p, n) => marquer(p, `c:${commits[n][1]}`));
    for (const t of svg.querySelectorAll('g.commit-labels text.commit-label')) {
        const trouve = commits.find(([op]) => propre(op.id) && propre(op.id) === t.textContent.trim());
        if (trouve) marquer(t.parentNode, `c:${trouve[1]}`);
    }
    const noms = [PRINCIPALE, ...modele.ops.filter((op) => op.t === 'branche').map((op) => op.nom)];
    const etiquettes = [...svg.querySelectorAll('g.branchLabel')];
    if (etiquettes.length === noms.length) etiquettes.forEach((g, n) => { marquer(g, `b:${noms[n]}`); if (g.previousElementSibling?.localName === 'rect') marquer(g.previousElementSibling, `b:${noms[n]}`); });
}

function viser(modele, cle) {
    if (cle.startsWith('b:')) { const i = modele.ops.findIndex((op) => op.t === 'branche' && op.nom === cle.slice(2)); return { i, op: modele.ops[i], branche: cle.slice(2) }; }
    const i = Number(cle.slice(2));
    const op = modele.ops[i];
    return { i, op: op && (cle.startsWith('c:') ? estCommit(op) : op.t === 'bascule') ? op : undefined };
}

export function texte(modele, cle) {
    const v = viser(modele, cle);
    if (cle.startsWith('b:')) return v.op ? v.op.nom : null;
    return cle.startsWith('c:') && v.op ? v.op.id : null;
}

export function renommer(modele, cle, valeur) {
    const v = viser(modele, cle);
    const nom = propre(valeur);
    if (!v.op || !nom || cle.startsWith('o:')) return undefined;
    if (cle.startsWith('c:')) { tenter(modele, () => { v.op.id = nom; }); return undefined; }
    // Une branche change de nom partout où elle est citée
    if (nom === PRINCIPALE || modele.ops.some((op) => op.t === 'branche' && op.nom === nom)) return undefined;
    const ancien = v.op.nom;
    for (const op of modele.ops) if (op.t !== 'commit' && op.nom === ancien) op.nom = nom;
    return `b:${nom}`;
}

export function supprimer(modele, cle) {
    const v = viser(modele, cle);
    if (!v.op) return;
    if (cle.startsWith('b:')) {
        // La branche disparaît avec ses commits, ses bascules et ses fusions
        const { branches } = rejouer(modele.ops);
        modele.ops = modele.ops.filter((op, i) => !(op === v.op || (op.t !== 'commit' && op.nom === v.branche) || (estCommit(op) && branches[i] === v.branche)));
    } else modele.ops.splice(v.i, 1);
    assainir(modele);
}

const idsPris = (modele) => (id) => modele.ops.some((op) => estCommit(op) && propre(op.id) === id);

// Ajoute un commit en fin d'historique sur la branche voulue, en basculant dessus si besoin
function ajouterCommit(modele, branche) {
    if (rejouer(modele.ops).courante !== branche) modele.ops.push({ t: 'bascule', nom: branche });
    modele.ops.push({ t: 'commit', id: nomLibre('c', idsPris(modele)), tag: '', type: '', msg: '' });
    return `c:${modele.ops.length - 1}`;
}

function fusionner(modele, source, cible) {
    const fait = tenter(modele, (m) => {
        if (rejouer(m.ops).courante !== cible) m.ops.push({ t: 'bascule', nom: cible });
        m.ops.push({ t: 'fusion', nom: source, id: '', tag: '', type: '', msg: '' });
    });
    return fait ? `c:${modele.ops.length - 1}` : null;
}

function brancheDe(modele, cle) {
    if (cle.startsWith('b:')) return rejouer(modele.ops).noms.includes(cle.slice(2)) ? cle.slice(2) : null;
    const v = viser(modele, cle);
    return cle.startsWith('c:') && v.op ? rejouer(modele.ops).branches[v.i] : null;
}

export const peutRelier = (cle) => cle.startsWith('c:') || cle.startsWith('b:');

// La poignée ajoute un commit sur la branche ; glissée vers une autre branche, elle y fusionne la première
export function relier(modele, de, vers) {
    const source = brancheDe(modele, de);
    if (!source) return null;
    if (!vers) return ajouterCommit(modele, source);
    const cible = brancheDe(modele, vers);
    return cible && cible !== source ? fusionner(modele, source, cible) : null;
}

export function panneau(ctx) {
    const { modele, selection, appliquer, selectionner } = ctx;
    const etat = rejouer(modele.ops);
    const v = selection ? viser(modele, selection) : {};
    const fusionnables = etat.noms.filter((n) => !rejouer([...modele.ops, { t: 'fusion', nom: n, id: '' }]).branches.includes(null));
    const blocs = [h('div', { class: 'fusain-bloc' },
        h('h2', {}, 'Historique de versions'),
        champSelect('Branche de travail', etat.noms.map((n) => [n, n]), etat.courante, (val) => appliquer((m) => { m.ops.push({ t: 'bascule', nom: val }); })),
        h('div', { class: 'fusain-actions' },
            bouton('Commit', { icone: 'add-line', variante: 'secondary', onclick: () => { let cle; appliquer((m) => { cle = ajouterCommit(m, rejouer(m.ops).courante); }, () => cle); } }),
            bouton('Branche', { icone: 'add-line', onclick: () => {
                let cle;
                appliquer((m) => { const nom = nomLibre('branche-', (n) => rejouer(m.ops).noms.includes(n)); m.ops.push({ t: 'branche', nom }); cle = ajouterCommit(m, nom); }, () => cle);
            } })),
        fusionnables.length ? champSelect(`Fusionner dans « ${etat.courante} »…`, [['', 'Choisir une branche'], ...fusionnables.map((n) => [n, n])], '', (val) => {
            if (!val) return;
            let cle;
            appliquer((m) => { cle = fusionner(m, val, rejouer(m.ops).courante); }, () => cle);
        }) : null,
        h('p', { class: 'fusain-aide' }, 'Les ajouts se placent à la fin de l\'historique, sur la branche de travail.'))];

    if (selection?.startsWith('c:') && v.op) {
        const modifier = (fonction) => appliquer((m) => fonction(m.ops[v.i]));
        blocs.push(h('div', { class: 'fusain-bloc' },
            h('h2', {}, v.op.t === 'fusion' ? `Fusion de « ${v.op.nom} »` : 'Commit sélectionné'),
            h('p', { class: 'fusain-aide' }, `Sur la branche « ${etat.branches[v.i]} »`),
            champTexte('Libellé', v.op.id, (val) => appliquer((m) => { renommer(m, selection, val); }), { id: 'fusain-champ-texte' }),
            champTexte('Étiquette (version, jalon)', v.op.tag, (val) => modifier((x) => { x.tag = propre(val); })),
            champSelect('Aspect', TYPES, v.op.type, (val) => modifier((x) => { x.type = val; })),
            actionsListe({
                monter: () => appliquer(() => {}, (m) => { let cible = v.i; tenter(m, (x) => { cible = deplacer(x.ops, v.i, -1); }) || (cible = v.i); return `c:${cible}`; }),
                descendre: () => appliquer(() => {}, (m) => { let cible = v.i; tenter(m, (x) => { cible = deplacer(x.ops, v.i, 1); }) || (cible = v.i); return `c:${cible}`; }),
                supprimer: () => appliquer((m) => supprimer(m, selection), () => null),
            })));
    } else if (selection?.startsWith('b:') && etat.noms.includes(v.branche)) {
        blocs.push(h('div', { class: 'fusain-bloc' },
            h('h2', {}, 'Branche sélectionnée'),
            v.op ? champTexte('Nom', v.op.nom, (val) => { let cle; appliquer((m) => { cle = renommer(m, selection, val) || selection; }, () => cle); }, { id: 'fusain-champ-texte' })
                : h('p', { class: 'fusain-aide' }, `« ${PRINCIPALE} » est la branche principale : elle ne peut être ni renommée ni supprimée.`),
            h('div', { class: 'fusain-actions' },
                bouton('Ajouter un commit', { icone: 'add-line', variante: 'secondary', onclick: () => { let cle; appliquer((m) => { cle = ajouterCommit(m, v.branche); }, () => cle); } }),
                v.op ? bouton('Supprimer', { icone: 'delete-bin-line', onclick: () => appliquer((m) => supprimer(m, selection), () => null) }) : null)));
    } else if (selection?.startsWith('o:') && v.op) {
        blocs.push(h('div', { class: 'fusain-bloc' },
            h('h2', {}, 'Bascule sélectionnée'),
            h('p', { class: 'fusain-aide' }, `Les opérations suivantes s'appliquent à la branche « ${v.op.nom} ».`),
            actionsListe({ supprimer: () => appliquer((m) => supprimer(m, selection), () => null) })));
    }
    blocs.push(h('div', { class: 'fusain-bloc' }, h('h2', {}, 'Historique'), plan(elements(modele), selection, selectionner)));
    return blocs;
}

export default { type: 'gitGraph', nom: 'Historique de versions', analyser, ecrire, elements, reperer, texte, renommer, supprimer, relier, peutRelier, panneau };
