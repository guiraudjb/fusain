// Diagramme de classes : classes, membres et relations
import { h, bouton, champTexte, champSelect, champCase } from '../dom.js';
import { separerPreambule, deplacer, actionsListe, plan, marquer, marquerLien, Inconnu, parLigne, nomLibre } from './commun.js';

const SENS = [['', 'Automatique'], ['TB', 'De haut en bas'], ['LR', 'De gauche à droite'], ['BT', 'De bas en haut'], ['RL', 'De droite à gauche']];
const ID = '[\\p{L}_][\\p{L}\\p{N}_]*';
// Extrémités d'une relation : écriture du côté gauche et du côté droit
const EXTREMITES = [['', 'Aucune', '', ''], ['fleche', 'Flèche', '<', '>'], ['heritage', 'Héritage (triangle)', '<|', '|>'], ['composition', 'Composition (losange plein)', '*', '*'], ['agregation', 'Agrégation (losange vide)', 'o', 'o']];
const ANNOTATIONS = [['', 'Aucun'], ['interface', 'Interface'], ['abstract', 'Classe abstraite'], ['enumeration', 'Énumération'], ['service', 'Service']];
const RE_CLASSE = new RegExp(`^class\\s+(${ID})(?:\\["([^"]*)"\\])?(\\s*\\{)?$`, 'u');
const RE_RELATION = new RegExp(`^(${ID})\\s+(?:"([^"]*)"\\s+)?(<\\||\\*|o|<)?(--|\\.\\.)(\\|>|\\*|o|>)?\\s+(?:"([^"]*)"\\s+)?(${ID})(?:\\s*:\\s*(.*))?$`, 'u');
const RE_MEMBRE = new RegExp(`^(${ID})\\s*:\\s*(.+)$`, 'u');
const RE_ANNOTATION = new RegExp(`^<<([^<>]+)>>\\s+(${ID})$`, 'u');

const propre = (t) => String(t).replace(/"/g, '\'').replace(/[\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim();
// Le libellé d'une relation n'admet qu'un jeu de caractères réduit
const propreLibelle = (t) => String(t).replace(/[^\p{L}\p{N} .,'()!?_+*/=<>-]/gu, ' ').replace(/\s+/g, ' ').trim();
// Un membre tient sur une ligne ; les accolades fermeraient la classe
// Mermaid lit comme une méthode tout membre qui contient « ) », et échoue s'il n'a pas la forme « nom(…) »
const estMethode = (m) => m.includes(')');
function propreMembre(t) {
    let m = String(t).replace(/[{}\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim();
    if (/^<<.*>>$/.test(m)) m = m.replace(/[<>]/g, '').trim();
    return estMethode(m) && !/.\(.*\)/.test(m) ? m.replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim() : m;
}
const propreAnnotation = (t) => String(t).replace(/[^\p{L}\p{N} _-]/gu, '').trim();

function classe(modele, id) {
    let c = modele.classes.find((x) => x.id === id);
    if (!c) { c = { id, nom: null, annotation: '', membres: [] }; modele.classes.push(c); }
    return c;
}

export function analyser(code) {
    const { preambule, corps } = separerPreambule(code);
    if (!/^classDiagram(-v2)?$/.test((corps[0] || '').trim())) throw new Error('La première ligne doit être « classDiagram ».');
    const modele = { preambule, sens: '', classes: [], relations: [], brut: [] };
    let ouverte = null;
    parLigne(corps.slice(1), preambule, (ligne) => {
        if (ouverte) {
            if (ligne === '}') { ouverte = null; return; }
            const a = ligne.match(/^<<([^<>]+)>>$/);
            if (a) ouverte.annotation = a[1].trim(); else if (/[{}]/.test(ligne)) throw new Inconnu('accolades dans un membre'); else ouverte.membres.push(ligne);
            return;
        }
        let m = ligne.match(/^direction\s+(TB|TD|BT|LR|RL)$/);
        if (m) { modele.sens = m[1] === 'TD' ? 'TB' : m[1]; return; }
        if (/^(classDef|cssClass|style|accTitle|accDescr)\s/.test(ligne)) { modele.brut.push(ligne); return; }
        m = ligne.match(RE_CLASSE);
        if (m) {
            const c = classe(modele, m[1]);
            if (m[2] !== undefined) c.nom = m[2];
            if (m[3]) ouverte = c;
            return;
        }
        m = ligne.match(RE_ANNOTATION);
        if (m) { classe(modele, m[2]).annotation = m[1].trim(); return; }
        m = ligne.match(RE_RELATION);
        if (m) {
            classe(modele, m[1]);
            classe(modele, m[7]);
            modele.relations.push({ de: m[1], vers: m[7], cardDe: m[2] || '', cardVers: m[6] || '', gauche: EXTREMITES.find((e) => e[2] === (m[3] || ''))[0], droite: EXTREMITES.find((e) => e[3] === (m[5] || ''))[0], pointille: m[4] === '..', texte: (m[8] || '').trim() });
            return;
        }
        m = ligne.match(RE_MEMBRE);
        if (!m || /[{}]/.test(m[2])) throw new Inconnu('notes, espaces de noms, génériques ou liens');
        classe(modele, m[1]).membres.push(m[2].trim());
    });
    if (ouverte) throw new Error('Une classe n\'est pas refermée par « } ».');
    return modele;
}

export function ecrire(modele) {
    const lignes = [...modele.preambule, 'classDiagram'];
    if (modele.sens) lignes.push(`    direction ${modele.sens}`);
    for (const c of modele.classes) {
        const nom = c.nom === null ? '' : propre(c.nom);
        const tete = `    class ${c.id}${nom && nom !== c.id ? `["${nom}"]` : ''}`;
        const membres = c.membres.map(propreMembre).filter(Boolean);
        const annotation = propreAnnotation(c.annotation);
        if (!membres.length && !annotation) { lignes.push(tete); continue; }
        lignes.push(`${tete} {`);
        if (annotation) lignes.push(`        <<${annotation}>>`);
        for (const m of membres) lignes.push(`        ${m}`);
        lignes.push('    }');
    }
    for (const r of modele.relations) {
        const g = EXTREMITES.find((e) => e[0] === r.gauche)[2];
        const d = EXTREMITES.find((e) => e[0] === r.droite)[3];
        const card = (t) => (propre(t) ? `"${propre(t)}" ` : '');
        lignes.push(`    ${r.de} ${card(r.cardDe)}${g}${r.pointille ? '..' : '--'}${d} ${card(r.cardVers)}${r.vers}${propreLibelle(r.texte) ? ` : ${propreLibelle(r.texte)}` : ''}`);
    }
    for (const b of modele.brut) lignes.push(`    ${b}`);
    return lignes.join('\n') + '\n';
}

const nomClasse = (modele, id) => modele.classes.find((c) => c.id === id)?.nom ?? id;

export function elements(modele) {
    return [
        ...modele.classes.flatMap((c) => [{ cle: `n:${c.id}`, nom: c.nom ?? c.id }, ...c.membres.map((m, k) => ({ cle: `m:${c.id}.${k}`, nom: `— ${m}` }))]),
        ...modele.relations.map((r, i) => ({ cle: `l:${i}`, nom: `${nomClasse(modele, r.de)} — ${nomClasse(modele, r.vers)}${r.texte ? ` (${r.texte})` : ''}` })),
    ];
}

export function reperer(svg, modele) {
    const prefixe = `${svg.id}-`;
    for (const g of svg.querySelectorAll('g.node')) {
        const m = g.id.startsWith(prefixe) && g.id.slice(prefixe.length).match(/^classId-(.+)-\d+$/);
        const c = m && modele.classes.find((x) => x.id === m[1]);
        if (!c) continue;
        marquer(g, `n:${c.id}`);
        // Mermaid range les attributs puis les méthodes, chacun dans son compartiment
        for (const [groupe, methode] of [['members-group', false], ['methods-group', true]]) {
            const rangs = c.membres.map((x, k) => [x, k]).filter(([x]) => estMethode(x) === methode).map(([, k]) => k);
            const cases = g.querySelectorAll(`g.${groupe} > g.label`);
            if (cases.length === rangs.length) cases.forEach((el, n) => marquer(el, `m:${c.id}.${rangs[n]}`));
        }
    }
    const chemins = [...svg.querySelectorAll('path.relation')];
    if (chemins.length !== modele.relations.length) return;
    chemins.forEach((chemin, i) => {
        marquerLien(chemin, `l:${i}`);
        const idLien = chemin.getAttribute('data-id');
        marquer(idLien && svg.querySelector(`g.edgeLabel g.label[data-id="${CSS.escape(idLien)}"]`), `l:${i}`);
    });
}

function viser(modele, cle) {
    if (cle.startsWith('l:')) return { relation: modele.relations[Number(cle.slice(2))], i: Number(cle.slice(2)) };
    const point = cle.startsWith('m:') ? cle.lastIndexOf('.') : cle.length;
    const c = modele.classes.find((x) => x.id === cle.slice(2, point));
    const k = cle.startsWith('m:') ? Number(cle.slice(point + 1)) : -1;
    return { classe: c, k, membre: c?.membres[k] };
}

export function texte(modele, cle) {
    const v = viser(modele, cle);
    if (cle.startsWith('l:')) return v.relation?.texte ?? null;
    if (cle.startsWith('m:')) return v.membre ?? null;
    return v.classe ? v.classe.nom ?? v.classe.id : null;
}

export function renommer(modele, cle, valeur) {
    const v = viser(modele, cle);
    if (cle.startsWith('l:')) { if (v.relation) v.relation.texte = propreLibelle(valeur); } else if (cle.startsWith('m:')) { if (v.membre !== undefined && propreMembre(valeur)) v.classe.membres[v.k] = propreMembre(valeur); } else if (v.classe && propre(valeur)) v.classe.nom = propre(valeur);
}

// Le schéma garde toujours au moins une classe : vide, il ne serait plus valide
export function supprimer(modele, cle) {
    const v = viser(modele, cle);
    if (cle.startsWith('l:')) { if (v.relation) modele.relations.splice(v.i, 1); } else if (cle.startsWith('m:')) { if (v.membre !== undefined) v.classe.membres.splice(v.k, 1); } else if (v.classe && modele.classes.length > 1) {
        modele.classes = modele.classes.filter((c) => c !== v.classe);
        modele.relations = modele.relations.filter((r) => r.de !== v.classe.id && r.vers !== v.classe.id);
    }
}

function nouvelleClasse(modele) {
    const c = { id: nomLibre('Classe', (id) => modele.classes.some((x) => x.id === id)), nom: null, annotation: '', membres: ['+String attribut', '+methode()'] };
    modele.classes.push(c);
    return c;
}

export const peutRelier = (cle) => cle.startsWith('n:');

export function relier(modele, de, vers) {
    const source = viser(modele, de).classe;
    if (!source || !de.startsWith('n:')) return null;
    const relation = (cible) => modele.relations.push({ de: source.id, vers: cible, cardDe: '', cardVers: '', gauche: '', droite: 'fleche', pointille: false, texte: '' });
    if (vers) {
        const cible = vers.startsWith('l:') ? null : viser(modele, vers).classe;
        if (!cible) return null;
        relation(cible.id);
        return `l:${modele.relations.length - 1}`;
    }
    const c = nouvelleClasse(modele);
    relation(c.id);
    return `n:${c.id}`;
}

export function panneau(ctx) {
    const { modele, selection, appliquer, selectionner } = ctx;
    const v = selection ? viser(modele, selection) : {};
    const blocs = [h('div', { class: 'fusain-bloc' },
        h('h2', {}, 'Diagramme de classes'),
        champSelect('Sens de lecture', SENS, modele.sens, (val) => appliquer((m) => { m.sens = val; })),
        h('div', { class: 'fusain-actions' }, bouton('Ajouter une classe', { icone: 'add-line', variante: 'secondary', onclick: () => {
            let cle;
            appliquer((m) => { cle = `n:${nouvelleClasse(m).id}`; }, () => cle);
        } })))];

    if (selection?.startsWith('n:') && v.classe) {
        const c = v.classe;
        const autres = modele.classes.filter((x) => x !== c).map((x) => [`n:${x.id}`, x.nom ?? x.id]);
        const annotations = ANNOTATIONS.some(([a]) => a === c.annotation) ? ANNOTATIONS : [[c.annotation, c.annotation], ...ANNOTATIONS];
        const ajouter = (membre) => appliquer((m) => { viser(m, selection).classe.membres.push(membre); }, () => `m:${c.id}.${c.membres.length - 1}`);
        blocs.push(h('div', { class: 'fusain-bloc' },
            h('h2', {}, 'Classe sélectionnée'),
            champTexte('Nom', c.nom ?? c.id, (val) => appliquer((m) => renommer(m, selection, val)), { id: 'fusain-champ-texte' }),
            champSelect('Stéréotype', annotations, c.annotation, (val) => appliquer((m) => { viser(m, selection).classe.annotation = val; })),
            h('div', { class: 'fusain-actions' },
                bouton('Attribut', { icone: 'add-line', variante: 'secondary', onclick: () => ajouter('+String attribut') }),
                bouton('Méthode', { icone: 'add-line', variante: 'secondary', onclick: () => ajouter('+methode()') }),
                modele.classes.length > 1 ? bouton('Supprimer', { icone: 'delete-bin-line', onclick: () => appliquer((m) => supprimer(m, selection), () => null) }) : null),
            champSelect('Relation vers…', [['', 'Choisir une classe'], [selection, 'Elle-même'], ...autres], '', (val) => {
                if (!val) return;
                let cle;
                appliquer((m) => { cle = relier(m, selection, val); }, () => cle);
            })));
    }

    if (selection?.startsWith('m:') && v.membre !== undefined) {
        blocs.push(h('div', { class: 'fusain-bloc' },
            h('h2', {}, `Membre de « ${v.classe.nom ?? v.classe.id} »`),
            champTexte('Texte', v.membre, (val) => appliquer((m) => renommer(m, selection, val)), { id: 'fusain-champ-texte' }),
            h('p', { class: 'fusain-aide' }, 'Visibilité en tête : + public, - privé, # protégé. Des parenthèses en font une méthode.'),
            actionsListe({
                monter: () => appliquer(() => {}, (m) => `m:${v.classe.id}.${deplacer(viser(m, selection).classe.membres, v.k, -1)}`),
                descendre: () => appliquer(() => {}, (m) => `m:${v.classe.id}.${deplacer(viser(m, selection).classe.membres, v.k, 1)}`),
                supprimer: () => appliquer((m) => supprimer(m, selection), () => `n:${v.classe.id}`),
            })));
    }

    if (selection?.startsWith('l:') && v.relation) {
        const r = v.relation;
        const modifier = (fonction) => appliquer((m) => fonction(m.relations[v.i]));
        const cote = (cle, card, id) => h('div', { class: 'fusain-ligne' },
            champSelect(`Extrémité côté « ${nomClasse(modele, id)} »`, EXTREMITES.map(([e, nom]) => [e, nom]), r[cle], (val) => modifier((x) => { x[cle] = val; })),
            champTexte('Multiplicité', r[card], (val) => modifier((x) => { x[card] = propre(val); }), { placeholder: '1, 0..*, …' }));
        blocs.push(h('div', { class: 'fusain-bloc' },
            h('h2', {}, 'Relation sélectionnée'),
            champTexte('Libellé', r.texte, (val) => modifier((x) => { x.texte = propreLibelle(val); }), { id: 'fusain-champ-texte' }),
            cote('gauche', 'cardDe', r.de),
            cote('droite', 'cardVers', r.vers),
            champCase('Trait pointillé (dépendance, réalisation)', r.pointille, (coche) => modifier((x) => { x.pointille = coche; })),
            h('div', { class: 'fusain-actions' },
                bouton('Inverser le sens', { icone: 'arrow-left-right-line', onclick: () => modifier((x) => { [x.de, x.vers, x.cardDe, x.cardVers, x.gauche, x.droite] = [x.vers, x.de, x.cardVers, x.cardDe, x.droite, x.gauche]; }) }),
                bouton('Supprimer', { icone: 'delete-bin-line', onclick: () => appliquer((m) => supprimer(m, selection), () => null) }))));
    }
    blocs.push(h('div', { class: 'fusain-bloc' }, h('h2', {}, 'Plan du schéma'), plan(elements(modele), selection, selectionner)));
    return blocs;
}

export default { type: 'classDiagram', nom: 'Diagramme de classes', analyser, ecrire, elements, reperer, texte, renommer, supprimer, relier, peutRelier, panneau };
