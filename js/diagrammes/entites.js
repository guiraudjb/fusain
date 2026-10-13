// Modèle de données (entités et associations)
import { h, bouton, champTexte, champSelect, champCase } from '../dom.js';
import { separerPreambule, deplacer, actionsListe, sansGuillemets, plan, marquer, marquerLien, Inconnu, parLigne, nomLibre } from './commun.js';

const SENS = [['', 'Automatique'], ['TB', 'De haut en bas'], ['LR', 'De gauche à droite'], ['BT', 'De bas en haut'], ['RL', 'De droite à gauche']];
const ID = '[\\p{L}_][\\p{L}\\p{N}_-]*';
// Cardinalités : écriture du côté gauche et du côté droit de l'association
const CARDINALITES = [['un', 'Exactement un', '||', '||'], ['zero-un', 'Zéro ou un', '|o', 'o|'], ['plusieurs', 'Zéro ou plusieurs', '}o', 'o{'], ['un-plusieurs', 'Un ou plusieurs', '}|', '|{']];
const CLES = [['', 'Aucune'], ['PK', 'Clé primaire (PK)'], ['FK', 'Clé étrangère (FK)'], ['UK', 'Unique (UK)'], ['PK, FK', 'Primaire et étrangère']];
const RE_ENTITE = new RegExp(`^(${ID})(?:\\["([^"]*)"\\])?(\\s*\\{)?$`, 'u');
const RE_RELATION = new RegExp(`^(${ID})\\s+(\\|\\||\\|o|\\}o|\\}\\|)(--|\\.\\.)(\\|\\||o\\||o\\{|\\|\\{)\\s+(${ID})\\s*:\\s*(.+)$`, 'u');
const RE_ATTRIBUT = /^(\S+)\s+(\S+)(?:\s+((?:PK|FK|UK)(?:\s*,\s*(?:PK|FK|UK))*))?(?:\s+"([^"]*)")?$/;

// Les textes entre guillemets ne peuvent contenir ni guillemet ni retour à la ligne
const propre = (t) => String(t).replace(/"/g, '\'').replace(/[\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim();
// Type et nom d'un attribut tiennent en un mot
const mot = (t, repli) => {
    const m = String(t).trim().replace(/\s+/g, '_').replace(/[^A-Za-z0-9_À-ɏ()[\]-]/g, '');
    return (/^[A-Za-z_À-ɏ]/.test(m) ? m : m ? `_${m}` : repli).slice(0, 60);
};

function entite(modele, id) {
    let e = modele.entites.find((x) => x.id === id);
    if (!e) { e = { id, nom: null, attributs: [] }; modele.entites.push(e); }
    return e;
}

export function analyser(code) {
    const { preambule, corps } = separerPreambule(code);
    if ((corps[0] || '').trim() !== 'erDiagram') throw new Error('La première ligne doit être « erDiagram ».');
    const modele = { preambule, sens: '', entites: [], relations: [], brut: [] };
    let ouverte = null;
    parLigne(corps.slice(1), preambule, (ligne) => {
        if (ouverte) {
            if (ligne === '}') { ouverte = null; return; }
            const a = ligne.match(RE_ATTRIBUT);
            if (!a) throw new Inconnu('un attribut s\'écrit « type nom »');
            ouverte.attributs.push({ type: a[1], nom: a[2], cle: (a[3] || '').split(',').map((x) => x.trim()).filter(Boolean).join(', '), commentaire: a[4] || '' });
            return;
        }
        let m = ligne.match(/^direction\s+(TB|TD|BT|LR|RL)$/);
        if (m) { modele.sens = m[1] === 'TD' ? 'TB' : m[1]; return; }
        if (/^(classDef|class|style|accTitle|accDescr)\s/.test(ligne)) { modele.brut.push(ligne); return; }
        m = ligne.match(RE_RELATION);
        if (m) {
            entite(modele, m[1]);
            entite(modele, m[5]);
            modele.relations.push({ de: m[1], vers: m[5], cardDe: CARDINALITES.find((c) => c[2] === m[2])[0], cardVers: CARDINALITES.find((c) => c[3] === m[4])[0], pointille: m[3] === '..', texte: sansGuillemets(m[6]) });
            return;
        }
        m = ligne.match(RE_ENTITE);
        if (!m) throw new Inconnu('entité ou association');
        const e = entite(modele, m[1]);
        if (m[2] !== undefined) e.nom = m[2];
        if (m[3]) ouverte = e;
    });
    if (ouverte) throw new Error('Une entité n\'est pas refermée par « } ».');
    return modele;
}

export function ecrire(modele) {
    const lignes = [...modele.preambule, 'erDiagram'];
    if (modele.sens) lignes.push(`    direction ${modele.sens}`);
    for (const e of modele.entites) {
        const nom = e.nom === null ? '' : propre(e.nom);
        const tete = `    ${e.id}${nom && nom !== e.id ? `["${nom}"]` : ''}`;
        if (!e.attributs.length) { lignes.push(tete); continue; }
        lignes.push(`${tete} {`);
        for (const a of e.attributs) lignes.push(`        ${mot(a.type, 'texte')} ${mot(a.nom, 'attribut')}${a.cle ? ` ${a.cle}` : ''}${propre(a.commentaire) ? ` "${propre(a.commentaire)}"` : ''}`);
        lignes.push('    }');
    }
    for (const r of modele.relations) {
        const g = CARDINALITES.find((c) => c[0] === r.cardDe)[2];
        const d = CARDINALITES.find((c) => c[0] === r.cardVers)[3];
        lignes.push(`    ${r.de} ${g}${r.pointille ? '..' : '--'}${d} ${r.vers} : "${propre(r.texte)}"`);
    }
    for (const b of modele.brut) lignes.push(`    ${b}`);
    return lignes.join('\n') + '\n';
}

const nomEntite = (modele, id) => modele.entites.find((e) => e.id === id)?.nom ?? id;

export function elements(modele) {
    return [
        ...modele.entites.flatMap((e) => [{ cle: `n:${e.id}`, nom: e.nom ?? e.id }, ...e.attributs.map((a, k) => ({ cle: `a:${e.id}.${k}`, nom: `— ${a.type} ${a.nom}` }))]),
        ...modele.relations.map((r, i) => ({ cle: `l:${i}`, nom: `${nomEntite(modele, r.de)} — ${nomEntite(modele, r.vers)}${r.texte ? ` (${r.texte})` : ''}` })),
    ];
}

export function reperer(svg, modele) {
    const prefixe = `${svg.id}-`;
    for (const g of svg.querySelectorAll('g.node')) {
        const m = g.id.startsWith(prefixe) && g.id.slice(prefixe.length).match(/^entity-(.+)-\d+$/);
        const e = m && modele.entites.find((x) => x.id === m[1]);
        if (!e) continue;
        marquer(g, `n:${e.id}`);
        for (const colonne of ['type', 'name', 'keys', 'comment']) {
            const cases = g.querySelectorAll(`g.label.attribute-${colonne}`);
            if (cases.length === e.attributs.length) cases.forEach((c, k) => marquer(c, `a:${e.id}.${k}`));
        }
    }
    const chemins = [...svg.querySelectorAll('path.relationshipLine')];
    if (chemins.length !== modele.relations.length) return;
    chemins.forEach((chemin, i) => {
        marquerLien(chemin, `l:${i}`);
        const idLien = chemin.getAttribute('data-id');
        marquer(idLien && svg.querySelector(`g.edgeLabel g.label[data-id="${CSS.escape(idLien)}"]`), `l:${i}`);
    });
}

function viser(modele, cle) {
    if (cle.startsWith('l:')) return { relation: modele.relations[Number(cle.slice(2))], i: Number(cle.slice(2)) };
    const point = cle.startsWith('a:') ? cle.lastIndexOf('.') : cle.length;
    const e = modele.entites.find((x) => x.id === cle.slice(2, point));
    const k = cle.startsWith('a:') ? Number(cle.slice(point + 1)) : -1;
    return { entite: e, k, attribut: e?.attributs[k] };
}

export function texte(modele, cle) {
    const v = viser(modele, cle);
    if (cle.startsWith('l:')) return v.relation?.texte ?? null;
    if (cle.startsWith('a:')) return v.attribut?.nom ?? null;
    return v.entite ? v.entite.nom ?? v.entite.id : null;
}

export function renommer(modele, cle, valeur) {
    const v = viser(modele, cle);
    if (cle.startsWith('l:')) { if (v.relation) v.relation.texte = propre(valeur); } else if (cle.startsWith('a:')) { if (v.attribut && mot(valeur, '')) v.attribut.nom = mot(valeur, ''); } else if (v.entite && propre(valeur)) v.entite.nom = propre(valeur);
}

export function supprimer(modele, cle) {
    const v = viser(modele, cle);
    if (cle.startsWith('l:')) { if (v.relation) modele.relations.splice(v.i, 1); } else if (cle.startsWith('a:')) { if (v.attribut) v.entite.attributs.splice(v.k, 1); } else if (v.entite) {
        modele.entites = modele.entites.filter((e) => e !== v.entite);
        modele.relations = modele.relations.filter((r) => r.de !== v.entite.id && r.vers !== v.entite.id);
    }
}

function nouvelleEntite(modele) {
    const e = { id: nomLibre('ENTITE', (id) => modele.entites.some((x) => x.id === id)), nom: 'Nouvelle entité', attributs: [{ type: 'int', nom: 'identifiant', cle: 'PK', commentaire: '' }] };
    modele.entites.push(e);
    return e;
}

export const peutRelier = (cle) => cle.startsWith('n:');

export function relier(modele, de, vers) {
    const source = viser(modele, de).entite;
    if (!source || !de.startsWith('n:')) return null;
    const relation = (cible) => modele.relations.push({ de: source.id, vers: cible, cardDe: 'un', cardVers: 'plusieurs', pointille: false, texte: '' });
    if (vers) {
        const cible = vers.startsWith('l:') ? null : viser(modele, vers).entite;
        if (!cible) return null;
        relation(cible.id);
        return `l:${modele.relations.length - 1}`;
    }
    const e = nouvelleEntite(modele);
    relation(e.id);
    return `n:${e.id}`;
}

export function panneau(ctx) {
    const { modele, selection, appliquer, selectionner } = ctx;
    const v = selection ? viser(modele, selection) : {};
    const blocs = [h('div', { class: 'fusain-bloc' },
        h('h2', {}, 'Modèle de données'),
        champSelect('Sens de lecture', SENS, modele.sens, (val) => appliquer((m) => { m.sens = val; })),
        h('div', { class: 'fusain-actions' }, bouton('Ajouter une entité', { icone: 'add-line', variante: 'secondary', onclick: () => {
            let cle;
            appliquer((m) => { cle = `n:${nouvelleEntite(m).id}`; }, () => cle);
        } })))];

    if (selection?.startsWith('n:') && v.entite) {
        const e = v.entite;
        const autres = modele.entites.filter((x) => x !== e).map((x) => [`n:${x.id}`, x.nom ?? x.id]);
        blocs.push(h('div', { class: 'fusain-bloc' },
            h('h2', {}, 'Entité sélectionnée'),
            champTexte('Nom', e.nom ?? e.id, (val) => appliquer((m) => renommer(m, selection, val)), { id: 'fusain-champ-texte' }),
            h('div', { class: 'fusain-actions' },
                bouton('Ajouter un attribut', { icone: 'add-line', variante: 'secondary', onclick: () => appliquer((m) => { viser(m, selection).entite.attributs.push({ type: 'texte', nom: 'attribut', cle: '', commentaire: '' }); }, () => `a:${e.id}.${e.attributs.length - 1}`) }),
                bouton('Supprimer', { icone: 'delete-bin-line', onclick: () => appliquer((m) => supprimer(m, selection), () => null) })),
            champSelect('Association avec…', [['', 'Choisir une entité'], [selection, 'Elle-même'], ...autres], '', (val) => {
                if (!val) return;
                let cle;
                appliquer((m) => { cle = relier(m, selection, val); }, () => cle);
            })));
    }

    if (selection?.startsWith('a:') && v.attribut) {
        const a = v.attribut;
        const modifier = (fonction) => appliquer((m) => fonction(viser(m, selection).attribut));
        const cles = CLES.some(([c]) => c === a.cle) ? CLES : [[a.cle, a.cle], ...CLES];
        blocs.push(h('div', { class: 'fusain-bloc' },
            h('h2', {}, `Attribut de « ${v.entite.nom ?? v.entite.id} »`),
            h('div', { class: 'fusain-ligne' },
                champTexte('Type', a.type, (val) => modifier((x) => { x.type = mot(val, 'texte'); })),
                champTexte('Nom', a.nom, (val) => modifier((x) => { x.nom = mot(val, 'attribut'); }), { id: 'fusain-champ-texte' })),
            champSelect('Clé', cles, a.cle, (val) => modifier((x) => { x.cle = val; })),
            champTexte('Commentaire', a.commentaire, (val) => modifier((x) => { x.commentaire = propre(val); })),
            h('p', { class: 'fusain-aide' }, 'Type et nom tiennent en un seul mot : les espaces deviennent des tirets bas.'),
            actionsListe({
                monter: () => appliquer(() => {}, (m) => `a:${v.entite.id}.${deplacer(viser(m, selection).entite.attributs, v.k, -1)}`),
                descendre: () => appliquer(() => {}, (m) => `a:${v.entite.id}.${deplacer(viser(m, selection).entite.attributs, v.k, 1)}`),
                supprimer: () => appliquer((m) => supprimer(m, selection), () => `n:${v.entite.id}`),
            })));
    }

    if (selection?.startsWith('l:') && v.relation) {
        const r = v.relation;
        const modifier = (fonction) => appliquer((m) => fonction(m.relations[v.i]));
        const cardinalite = (cle, id) => champSelect(`Côté « ${nomEntite(modele, id)} »`, CARDINALITES.map(([c, nom]) => [c, nom]), r[cle], (val) => modifier((x) => { x[cle] = val; }));
        blocs.push(h('div', { class: 'fusain-bloc' },
            h('h2', {}, 'Association sélectionnée'),
            champTexte('Libellé', r.texte, (val) => modifier((x) => { x.texte = propre(val); }), { id: 'fusain-champ-texte' }),
            cardinalite('cardDe', r.de),
            cardinalite('cardVers', r.vers),
            champCase('Trait pointillé (association non identifiante)', r.pointille, (coche) => modifier((x) => { x.pointille = coche; })),
            h('div', { class: 'fusain-actions' },
                bouton('Inverser le sens', { icone: 'arrow-left-right-line', onclick: () => modifier((x) => { [x.de, x.vers, x.cardDe, x.cardVers] = [x.vers, x.de, x.cardVers, x.cardDe]; }) }),
                bouton('Supprimer', { icone: 'delete-bin-line', onclick: () => appliquer((m) => supprimer(m, selection), () => null) }))));
    }
    blocs.push(h('div', { class: 'fusain-bloc' }, h('h2', {}, 'Plan du schéma'), plan(elements(modele), selection, selectionner)));
    return blocs;
}

export default { type: 'erDiagram', nom: 'Modèle de données', analyser, ecrire, elements, reperer, texte, renommer, supprimer, relier, peutRelier, panneau };
