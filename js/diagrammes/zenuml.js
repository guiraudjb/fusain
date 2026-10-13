// Diagramme de séquence ZenUML : participants, messages, appels imbriqués et blocs (condition, boucle…)
import { h, bouton, champTexte, champSelect } from '../dom.js';
import { separerPreambule, deplacer, actionsListe, plan, marquer, Inconnu, parLigne, nomLibre } from './commun.js';

const ROLES = [['', 'Boîte simple'], ['Actor', 'Personne'], ['Boundary', 'Interface'], ['Control', 'Traitement'], ['Entity', 'Entité'], ['Database', 'Base de données'], ['Queue', 'File de messages']];
// Blocs : mot d'ouverture, libellé, présence d'une condition, suites possibles
const BLOCS = { if: ['Condition', true, ['else if', 'else']], while: ['Boucle', true, []], opt: ['Option', false, []], par: ['En parallèle', false, []], try: ['Essai', false, ['catch', 'finally']] };
const BOUCLES = /^(while|for|forEach|loop)$/;
const SUITES = { 'else if': 'sinon si', else: 'sinon', catch: 'en cas d\'erreur', finally: 'dans tous les cas' };
const IDENT = '[\\p{L}_][\\p{L}\\p{N}_]*';
const NOM = `(?:"([^"]+)"|(${IDENT}))`;
const RE_PARTICIPANT = new RegExp(`^(?:@(\\w+)\\s+)?${NOM}(?:\\s+as\\s+${NOM})?$`, 'u');
const RE_MESSAGE = new RegExp(`^${NOM}\\s*->\\s*${NOM}\\s*:\\s*(.*)$`, 'u');
const RE_APPEL = new RegExp(`^${NOM}\\s*->\\s*${NOM}\\.(${IDENT})\\(([^(){}]*)\\)\\s*(\\{)?$`, 'u');

// Tout texte tient sur une ligne ; les accolades ouvrent et ferment les blocs
const propre = (t) => String(t).replace(/[{}\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim();
const propreNom = (t) => propre(t).replace(/"/g, '\'');
const propreArgs = (t) => propre(t).replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();
const methode = (t) => { const m = propre(t).replace(/[^\p{L}\p{N}_]+/gu, '_').replace(/^_+|_+$/g, ''); return /^[\p{L}_]/u.test(m) ? m : m ? `_${m}` : 'appeler'; };
const ecrireNom = (n) => (new RegExp(`^${IDENT}$`, 'u').test(n) && !/^(if|else|while|for|forEach|loop|opt|par|try|catch|finally|return|new|title|as)$/.test(n) ? n : `"${propreNom(n)}"`);
// Une expression simple s'écrit telle quelle ; un texte libre, entre guillemets
const expression = (t) => { const e = propreArgs(t); return /^[\p{L}\p{N}_ .<>=!&|+*/-]*$/u.test(e) ? e : `"${e.replace(/"/g, '\'')}"`; };
// Une valeur renvoyée en plusieurs mots serait lue comme plusieurs retours : elle s'écrit entre guillemets
const valeurRetour = (t) => { const e = propreArgs(t).replace(/"/g, '\''); return /^[\p{L}\p{N}_.]+$/u.test(e) ? e : `"${e}"`; };
const lireExpression = (t) => { const e = t.trim(); return /^"[^"]*"$/.test(e) ? e.slice(1, -1) : e; };

export function analyser(code) {
    const { preambule, corps } = separerPreambule(code);
    if ((corps[0] || '').trim() !== 'zenuml') throw new Error('La première ligne doit être « zenuml ».');
    const modele = { preambule, titre: '', participants: [], corps: [] };
    const pile = [{ corps: modele.corps }];
    let debut = true;
    parLigne(corps.slice(1), preambule, (ligne) => {
        const courant = pile[pile.length - 1];
        let m = ligne.match(/^title\s+(.*)$/);
        if (m && debut) { modele.titre = m[1].trim(); return; }
        if (debut && (m = ligne.match(RE_PARTICIPANT)) && !/^(return|opt|par|try)$/.test(ligne)) {
            modele.participants.push({ role: m[1] || '', nom: m[2] ?? m[3], alias: m[4] ?? m[5] ?? null });
            return;
        }
        debut = false;
        if (ligne.startsWith('//')) { courant.corps.push({ t: 'commentaire', texte: ligne.slice(2).trim() }); return; }
        // Fin ou suite d'un bloc
        m = ligne.match(/^\}\s*(?:(else\s+if)\s*\((.*)\)|(else|finally)|(catch)\s*(?:\(.*\))?)?\s*(\{)?$/);
        if (m) {
            if (pile.length < 2) throw new Inconnu('accolade inattendue');
            const ferme = pile.pop();
            const suite = (m[1] && 'else if') || m[3] || m[4];
            if (!suite) { if (m[5]) throw new Inconnu('accolade inattendue'); return; }
            if (!m[5] || ferme.stmt.t !== 'bloc' || !BLOCS[ferme.stmt.genre][2].includes(suite)) throw new Inconnu('suite de bloc inattendue');
            const branche = { mot: suite, condition: m[2] === undefined ? '' : lireExpression(m[2]), corps: [] };
            ferme.stmt.branches.push(branche);
            pile.push({ stmt: ferme.stmt, corps: branche.corps });
            return;
        }
        m = ligne.match(/^(if|while|for|forEach|loop)\s*\((.*)\)\s*\{$/) || ligne.match(/^(opt|par|try)()\s*\{$/);
        if (m) {
            const genre = BOUCLES.test(m[1]) ? 'while' : m[1];
            const stmt = { t: 'bloc', genre, mot: m[1], branches: [{ mot: m[1], condition: lireExpression(m[2]), corps: [] }] };
            courant.corps.push(stmt);
            pile.push({ stmt, corps: stmt.branches[0].corps });
            return;
        }
        m = ligne.match(/^return\s+(.*)$/);
        if (m) { courant.corps.push({ t: 'retour', texte: lireExpression(m[1]) }); return; }
        m = ligne.match(RE_APPEL);
        if (m) {
            const stmt = { t: 'appel', de: m[1] ?? m[2], vers: m[3] ?? m[4], methode: m[5], args: m[6].trim(), corps: m[7] ? [] : null };
            courant.corps.push(stmt);
            if (m[7]) pile.push({ stmt, corps: stmt.corps });
            return;
        }
        m = ligne.match(RE_MESSAGE);
        if (!m) throw new Inconnu('créations, affectations, appels sans émetteur');
        courant.corps.push({ t: 'message', de: m[1] ?? m[2], vers: m[3] ?? m[4], texte: m[5].trim() });
    });
    if (pile.length > 1) throw new Error('Un bloc n\'est pas refermé par « } ».');
    return modele;
}

export function ecrire(modele) {
    const lignes = [...modele.preambule, 'zenuml'];
    if (propre(modele.titre)) lignes.push(`    title ${propre(modele.titre)}`);
    for (const p of modele.participants) lignes.push(`    ${p.role ? `@${p.role} ` : ''}${ecrireNom(p.nom)}${p.alias !== null && propreNom(p.alias) ? ` as ${ecrireNom(p.alias)}` : ''}`);
    const niveau = (corps, retrait) => {
        for (const s of corps) {
            if (s.t === 'commentaire') lignes.push(`${retrait}// ${propre(s.texte)}`);
            else if (s.t === 'retour') lignes.push(`${retrait}return ${valeurRetour(s.texte)}`);
            else if (s.t === 'message') lignes.push(`${retrait}${ecrireNom(s.de)}->${ecrireNom(s.vers)}: ${propre(s.texte)}`);
            else if (s.t === 'appel') {
                lignes.push(`${retrait}${ecrireNom(s.de)}->${ecrireNom(s.vers)}.${methode(s.methode)}(${propreArgs(s.args)})${s.corps ? ' {' : ''}`);
                if (s.corps) { niveau(s.corps, `${retrait}    `); lignes.push(`${retrait}}`); }
            } else {
                s.branches.forEach((b, n) => {
                    const condition = b.mot === 'else if' || (n === 0 && BLOCS[s.genre][1]) ? `(${expression(b.condition) || 'condition'}) ` : '';
                    lignes.push(`${retrait}${n ? '} ' : ''}${b.mot}${condition ? ' ' : ' '}${condition}{`);
                    niveau(b.corps, `${retrait}    `);
                });
                lignes.push(`${retrait}}`);
            }
        }
    };
    niveau(modele.corps, '    ');
    return lignes.join('\n') + '\n';
}

// Parcours en profondeur des instructions. Une clé « i:2.0.1 » se lit : instruction 2, branche 0, instruction 1.
function instructions(modele) {
    const liste = [];
    const visiter = (corps, chemin, profondeur) => corps.forEach((s, i) => {
        const c = [...chemin, i];
        liste.push({ s, corps, i, cle: `i:${c.join('.')}`, profondeur });
        if (s.t === 'appel' && s.corps) visiter(s.corps, [...c, 0], profondeur + 1);
        if (s.t === 'bloc') s.branches.forEach((b, n) => { if (n) liste.push({ s, branche: b, n, cle: `k:${c.join('.')}.${n}`, profondeur }); visiter(b.corps, [...c, n], profondeur + 1); });
    });
    visiter(modele.corps, [], 0);
    return liste;
}

// Participants déclarés, puis ceux que les messages font apparaître, dans l'ordre où ZenUML les dessine
function participants(modele) {
    const noms = modele.participants.map((p) => p.nom);
    for (const { s, branche } of instructions(modele)) if (!branche && (s.t === 'message' || s.t === 'appel')) for (const n of [s.de, s.vers]) if (!noms.includes(n)) noms.push(n);
    return noms.map((nom) => modele.participants.find((p) => p.nom === nom) || { role: '', nom, alias: null, implicite: true });
}

const libelle = (modele, nom) => { const p = modele.participants.find((x) => x.nom === nom); return p?.alias ?? nom; };

function decrire(modele, s) {
    if (s.t === 'commentaire') return `// ${s.texte}`;
    if (s.t === 'retour') return `← ${s.texte}`;
    if (s.t === 'message') return `${libelle(modele, s.de)} → ${libelle(modele, s.vers)} : ${s.texte}`;
    if (s.t === 'appel') return `${libelle(modele, s.de)} → ${libelle(modele, s.vers)} : ${s.methode}(${s.args})`;
    return `${BLOCS[s.genre][0]}${BLOCS[s.genre][1] ? ` (${s.branches[0].condition})` : ''}`;
}

export function elements(modele) {
    return [
        ...participants(modele).map((p, k) => ({ cle: `p:${k}`, nom: `Participant : ${p.alias ?? p.nom}` })),
        ...instructions(modele).map((e) => ({ cle: e.cle, nom: `${'· '.repeat(e.profondeur)}${e.branche ? `${SUITES[e.branche.mot]}${e.branche.mot === 'else if' ? ` (${e.branche.condition})` : ''}` : decrire(modele, e.s)}`, brut: Boolean(e.branche) || e.s.t === 'commentaire' })),
    ];
}

export function reperer(svg, modele) {
    const liste = instructions(modele).filter((e) => !e.branche);
    const apparier = (selecteur, cles) => { const els = [...svg.querySelectorAll(selecteur)]; if (els.length === cles.length) els.forEach((el, n) => marquer(el, cles[n])); };
    apparier('g.participant', participants(modele).map((_, k) => `p:${k}`));
    apparier('g.message', liste.filter((e) => e.s.t === 'message' || e.s.t === 'appel').map((e) => e.cle));
    apparier('g.return', liste.filter((e) => e.s.t === 'retour').map((e) => e.cle));
    apparier('g.fragment', liste.filter((e) => e.s.t === 'bloc').map((e) => e.cle));
}

function viser(modele, cle) {
    if (cle.startsWith('p:')) return { participant: participants(modele)[Number(cle.slice(2))] };
    return instructions(modele).find((e) => e.cle === cle) || {};
}

export function texte(modele, cle) {
    const v = viser(modele, cle);
    if (v.participant) return v.participant.alias ?? v.participant.nom;
    if (v.branche) return v.branche.mot === 'else if' ? v.branche.condition : null;
    if (!v.s) return null;
    return { message: v.s.texte, appel: v.s.methode, retour: v.s.texte, commentaire: v.s.texte, bloc: BLOCS[v.s.genre]?.[1] ? v.s.branches[0].condition : null }[v.s.t];
}

function renommerParticipant(modele, p, valeur) {
    const nom = propreNom(valeur);
    if (!nom) return;
    if (p.alias !== null) { p.alias = nom; return; }
    // Le nom sert d'identifiant : il reste unique, et les messages le suivent
    if (participants(modele).some((x) => x.nom === nom)) return;
    for (const { s, branche } of instructions(modele)) if (!branche && (s.t === 'message' || s.t === 'appel')) { if (s.de === p.nom) s.de = nom; if (s.vers === p.nom) s.vers = nom; }
    const declare = modele.participants.find((x) => x.nom === p.nom);
    if (declare) declare.nom = nom;
}

export function renommer(modele, cle, valeur) {
    const v = viser(modele, cle);
    if (v.participant) { renommerParticipant(modele, v.participant, valeur); return; }
    if (v.branche) { if (v.branche.mot === 'else if' && propreArgs(valeur)) v.branche.condition = propreArgs(valeur); return; }
    if (!v.s) return;
    if (v.s.t === 'appel') v.s.methode = methode(valeur);
    else if (v.s.t === 'bloc') { if (BLOCS[v.s.genre][1] && propreArgs(valeur)) v.s.branches[0].condition = propreArgs(valeur); } else if (v.s.t === 'retour') { if (propreArgs(valeur)) v.s.texte = propreArgs(valeur); } else if (propre(valeur)) v.s.texte = propre(valeur);
}

export function supprimer(modele, cle) {
    const v = viser(modele, cle);
    if (v.participant) {
        // Un participant disparaît avec les messages qu'il émet ou reçoit
        const nom = v.participant.nom;
        const purger = (corps) => {
            for (let i = corps.length - 1; i >= 0; i -= 1) {
                const s = corps[i];
                if ((s.t === 'message' || s.t === 'appel') && (s.de === nom || s.vers === nom)) { corps.splice(i, 1); continue; }
                if (s.t === 'appel' && s.corps) purger(s.corps);
                if (s.t === 'bloc') s.branches.forEach((b) => purger(b.corps));
            }
        };
        purger(modele.corps);
        modele.participants = modele.participants.filter((p) => p.nom !== nom);
    } else if (v.branche) v.s.branches.splice(v.n, 1);
    else if (v.s) v.corps.splice(v.i, 1);
}

const cleDe = (modele, s) => instructions(modele).find((e) => e.s === s && !e.branche)?.cle ?? null;

// Deux participants au moins sont nécessaires pour écrire un message
function deuxParticipants(modele) {
    while (participants(modele).length < 2) modele.participants.push({ role: '', nom: nomLibre('Participant', (n) => participants(modele).some((p) => p.nom === n)), alias: null });
    return participants(modele).slice(0, 2).map((p) => p.nom);
}

// Insère après l'instruction visée, dans le bloc ou la branche visés, ou à la fin
function inserer(modele, selection, s) {
    const v = selection ? viser(modele, selection) : {};
    if (v.branche) v.branche.corps.push(s);
    else if (v.s?.t === 'bloc') v.s.branches[0].corps.push(s);
    else if (v.s?.t === 'appel' && v.s.corps) v.s.corps.push(s);
    else if (v.corps) v.corps.splice(v.i + 1, 0, s);
    else modele.corps.push(s);
    return s;
}

export const peutRelier = (cle) => cle.startsWith('p:') || cle.startsWith('i:');

// Depuis un participant : un message vers un nouveau participant, ou vers celui sur lequel on lâche la poignée.
// Depuis un message : la réponse.
export function relier(modele, de, vers) {
    const source = viser(modele, de);
    if (source.participant) {
        let cible;
        if (vers) { cible = vers.startsWith('p:') ? viser(modele, vers).participant?.nom : null; if (!cible) return null; } else {
            cible = nomLibre('Participant', (n) => participants(modele).some((p) => p.nom === n));
            modele.participants.push(...participants(modele).filter((p) => p.implicite).map(({ role, nom, alias }) => ({ role, nom, alias })), { role: '', nom: cible, alias: null });
        }
        const s = { t: 'message', de: source.participant.nom, vers: cible, texte: 'Message' };
        modele.corps.push(s);
        return cleDe(modele, s);
    }
    if (vers || !source.s || (source.s.t !== 'message' && source.s.t !== 'appel')) return null;
    const reponse = { t: 'message', de: source.s.vers, vers: source.s.de, texte: 'Réponse' };
    source.corps.splice(source.i + 1, 0, reponse);
    return cleDe(modele, reponse);
}

export function panneau(ctx) {
    const { modele, selection, appliquer, selectionner } = ctx;
    const v = selection ? viser(modele, selection) : {};
    const noms = participants(modele).map((p) => [p.nom, p.alias ?? p.nom]);
    const ajouter = (fabrique) => () => { let s; appliquer((m) => { const [a, b] = deuxParticipants(m); s = inserer(m, selection, fabrique(a, b)); }, (m) => cleDe(m, s)); };
    const bloc = (genre) => ajouter((a, b) => ({ t: 'bloc', genre, mot: genre, branches: [{ mot: genre, condition: BLOCS[genre][1] ? 'condition' : '', corps: [{ t: 'message', de: a, vers: b, texte: 'Message' }] }] }));
    const blocs = [h('div', { class: 'fusain-bloc' },
        h('h2', {}, 'Séquence ZenUML'),
        champTexte('Titre', modele.titre, (val) => appliquer((m) => { m.titre = propre(val); })),
        h('div', { class: 'fusain-actions' },
            bouton('Participant', { icone: 'add-line', variante: 'secondary', onclick: () => appliquer((m) => { m.participants.push({ role: '', nom: nomLibre('Participant', (n) => participants(m).some((p) => p.nom === n)), alias: null }); }, (m) => `p:${m.participants.length - 1}`) }),
            bouton('Message', { icone: 'add-line', variante: 'secondary', onclick: ajouter((a, b) => ({ t: 'message', de: a, vers: b, texte: 'Message' })) }),
            bouton('Appel avec retour', { icone: 'add-line', onclick: ajouter((a, b) => ({ t: 'appel', de: a, vers: b, methode: 'traiter', args: '', corps: [{ t: 'retour', texte: 'resultat' }] })) })),
        h('div', { class: 'fusain-actions' },
            Object.entries(BLOCS).map(([genre, [nom]]) => bouton(nom, { icone: 'add-line', onclick: bloc(genre) }))),
        h('p', { class: 'fusain-aide' }, 'Les ajouts se placent après l\'élément sélectionné, ou à l\'intérieur du bloc sélectionné.'))];

    if (v.participant) {
        const p = v.participant;
        const roles = ROLES.some(([r]) => r === p.role) ? ROLES : [[p.role, p.role], ...ROLES];
        // Donner un rôle à un participant que seuls les messages faisaient apparaître revient à le déclarer
        const declarer = (m) => { const w = viser(m, selection).participant; if (!w.implicite) return w; const d = { role: '', nom: w.nom, alias: null }; m.participants.push(d); return d; };
        blocs.push(h('div', { class: 'fusain-bloc' },
            h('h2', {}, 'Participant sélectionné'),
            champTexte('Nom', p.alias ?? p.nom, (val) => appliquer((m) => renommer(m, selection, val), (m) => `p:${participants(m).findIndex((x) => (x.alias ?? x.nom) === propreNom(val))}`.replace('p:-1', selection)), { id: 'fusain-champ-texte' }),
            champSelect('Représentation', roles, p.role, (val) => appliquer((m) => { declarer(m).role = val; }, (m) => `p:${participants(m).findIndex((x) => x.nom === p.nom)}`)),
            h('div', { class: 'fusain-actions' },
                bouton('Ajouter un message vers un nouveau participant', { icone: 'add-line', variante: 'secondary', onclick: () => { let cle; appliquer((m) => { cle = relier(m, selection, null); }, () => cle); } }),
                bouton('Supprimer', { icone: 'delete-bin-line', onclick: () => appliquer((m) => supprimer(m, selection), () => null) })),
            h('p', { class: 'fusain-aide' }, 'Supprimer un participant supprime aussi ses messages.')));
    }

    const mouvements = () => actionsListe({
        monter: () => appliquer((m) => { const w = viser(m, selection); deplacer(w.corps, w.i, -1); }, (m) => cleDe(m, v.s)),
        descendre: () => appliquer((m) => { const w = viser(m, selection); deplacer(w.corps, w.i, 1); }, (m) => cleDe(m, v.s)),
        supprimer: () => appliquer((m) => supprimer(m, selection), () => null),
    });
    const dedans = (libelleBouton, fabrique) => bouton(libelleBouton, { icone: 'add-line', variante: 'secondary', onclick: () => { let s; appliquer((m) => { const [a, b] = deuxParticipants(m); s = inserer(m, selection, fabrique(a, b)); }, (m) => cleDe(m, s)); } });

    if (v.s && !v.branche) {
        const s = v.s;
        const modifier = (fonction) => appliquer((m) => fonction(viser(m, selection).s));
        const extremites = () => h('div', { class: 'fusain-ligne' },
            champSelect('De', noms, s.de, (val) => modifier((x) => { x.de = val; })),
            champSelect('Vers', noms, s.vers, (val) => modifier((x) => { x.vers = val; })));
        if (s.t === 'message') {
            blocs.push(h('div', { class: 'fusain-bloc' },
                h('h2', {}, 'Message sélectionné'),
                champTexte('Texte', s.texte, (val) => appliquer((m) => renommer(m, selection, val)), { id: 'fusain-champ-texte' }),
                extremites(),
                h('div', { class: 'fusain-actions' },
                    bouton('Ajouter la réponse', { icone: 'add-line', variante: 'secondary', onclick: () => { let cle; appliquer((m) => { cle = relier(m, selection, null); }, () => cle); } }),
                    bouton('Inverser le sens', { icone: 'arrow-left-right-line', onclick: () => modifier((x) => { [x.de, x.vers] = [x.vers, x.de]; }) })),
                mouvements()));
        } else if (s.t === 'appel') {
            blocs.push(h('div', { class: 'fusain-bloc' },
                h('h2', {}, 'Appel sélectionné'),
                h('div', { class: 'fusain-ligne' },
                    champTexte('Opération (un mot)', s.methode, (val) => appliquer((m) => renommer(m, selection, val)), { id: 'fusain-champ-texte' }),
                    champTexte('Paramètres', s.args, (val) => modifier((x) => { x.args = propreArgs(val); }))),
                extremites(),
                h('div', { class: 'fusain-actions' },
                    bouton('Message imbriqué', { icone: 'add-line', variante: 'secondary', onclick: () => { let n; appliquer((m) => { const x = viser(m, selection).s; x.corps ||= []; n = { t: 'message', de: x.vers, vers: x.de, texte: 'Message' }; x.corps.push(n); }, (m) => cleDe(m, n)); } }),
                    bouton('Retour', { icone: 'add-line', onclick: () => { let n; appliquer((m) => { const x = viser(m, selection).s; x.corps ||= []; n = { t: 'retour', texte: 'resultat' }; x.corps.push(n); }, (m) => cleDe(m, n)); } })),
                h('p', { class: 'fusain-aide' }, 'Un appel attend sa réponse : les messages imbriqués se déroulent pendant son traitement.'),
                mouvements()));
        } else if (s.t === 'bloc') {
            const [nom, condition, suites] = BLOCS[s.genre];
            const suite = (mot) => bouton(`Ajouter « ${SUITES[mot]} »`, { icone: 'add-line', onclick: () => appliquer((m) => {
                const x = viser(m, selection).s;
                const [a, b] = deuxParticipants(m);
                const branche = { mot, condition: mot === 'else if' ? 'autre condition' : '', corps: [{ t: 'message', de: a, vers: b, texte: 'Message' }] };
                // « sinon » et « dans tous les cas » ferment le bloc ; les autres suites se placent avant
                const fin = x.branches.findIndex((y) => y.mot === 'else' || y.mot === 'finally');
                if (mot === 'else' || mot === 'finally' || fin < 0) x.branches.push(branche); else x.branches.splice(fin, 0, branche);
            }) });
            blocs.push(h('div', { class: 'fusain-bloc' },
                h('h2', {}, `${nom} sélectionné${nom === 'Boucle' || nom === 'Condition' || nom === 'Option' ? 'e' : ''}`),
                condition ? champTexte(s.genre === 'if' ? 'Condition' : 'Tant que', s.branches[0].condition, (val) => appliquer((m) => renommer(m, selection, val)), { id: 'fusain-champ-texte' }) : null,
                h('div', { class: 'fusain-actions' },
                    dedans('Message dedans', (a, b) => ({ t: 'message', de: a, vers: b, texte: 'Message' })),
                    suites.filter((mot) => mot === 'else if' || !s.branches.some((b) => b.mot === mot)).map(suite)),
                mouvements()));
        } else {
            blocs.push(h('div', { class: 'fusain-bloc' },
                h('h2', {}, s.t === 'retour' ? 'Retour sélectionné' : 'Commentaire sélectionné'),
                champTexte(s.t === 'retour' ? 'Valeur renvoyée' : 'Texte (affiché au-dessus du message suivant)', s.texte, (val) => appliquer((m) => renommer(m, selection, val)), { id: 'fusain-champ-texte' }),
                mouvements()));
        }
    }

    if (v.branche) {
        blocs.push(h('div', { class: 'fusain-bloc' },
            h('h2', {}, `Branche « ${SUITES[v.branche.mot]} »`),
            v.branche.mot === 'else if' ? champTexte('Condition', v.branche.condition, (val) => appliquer((m) => renommer(m, selection, val)), { id: 'fusain-champ-texte' }) : null,
            h('div', { class: 'fusain-actions' },
                dedans('Message dedans', (a, b) => ({ t: 'message', de: a, vers: b, texte: 'Message' })),
                bouton('Supprimer la branche', { icone: 'delete-bin-line', onclick: () => appliquer((m) => supprimer(m, selection), () => null) }))));
    }
    blocs.push(h('div', { class: 'fusain-bloc' }, h('h2', {}, 'Déroulé'), plan(elements(modele), selection, selectionner)));
    return blocs;
}

export default { type: 'zenuml', nom: 'Séquence ZenUML', analyser, ecrire, elements, reperer, texte, renommer, supprimer, relier, peutRelier, panneau };
