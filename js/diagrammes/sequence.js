// Diagramme de séquence : participants et échanges
import { h, bouton, champTexte, champSelect, champCase } from '../dom.js';
import { separerPreambule, deplacer, actionsListe, plan, marquer } from './commun.js';

const FLECHES = [
    ['->>', 'Appel (flèche pleine)'], ['-->>', 'Réponse (pointillé)'], ['-)', 'Asynchrone'], ['--)', 'Asynchrone (pointillé)'],
    ['->', 'Trait sans flèche'], ['-->', 'Pointillé sans flèche'], ['-x', 'Échec (croix)'], ['--x', 'Échec (pointillé)'],
    ['<<->>', 'Double flèche'], ['<<-->>', 'Double flèche (pointillé)'],
];
const RE_MESSAGE = /^(.+?)\s*(<<-->>|<<->>|-->>|->>|--x|-x|--\)|-\)|-->|->)\s*([+-])?\s*([^:]+?)\s*:\s*(.*)$/;
const RE_NOTE = /^Note\s+(over|left of|right of)\s+([^:]+?)\s*:\s*(.*)$/i;
const POSITIONS = [['over', 'Au-dessus de'], ['left of', 'À gauche de'], ['right of', 'À droite de']];
const BLOCS = [['loop', 'Boucle'], ['alt', 'Alternative'], ['opt', 'Optionnel'], ['par', 'En parallèle'], ['critical', 'Section critique'], ['break', 'Interruption']];
const OUVRE = new Set([...BLOCS.map((b) => b[0]), 'rect']);
const MILIEU = new Set(['else', 'and', 'option']);
const MOTS_BRUTS = new Set([...OUVRE, ...MILIEU, 'end', 'activate', 'deactivate', 'title', 'accTitle', 'accDescr']);
// Ces instructions lient la déclaration d'un participant à sa place dans le code : l'éditeur visuel, qui regroupe
// les déclarations en tête, en changerait le sens
const NON_GERES = new Set(['box', 'create', 'destroy']);

// Le point-virgule sépare les instructions : il est encodé dans les textes
const coder = (t) => String(t).replace(/;/g, '#59;').replace(/\r?\n/g, '<br/>');
const decoder = (t) => String(t).replace(/#59;/g, ';').replace(/<br\s*\/?>/gi, '\n');

function declarer(modele, id) {
    const nom = id.trim();
    if (!modele.participants.some((p) => p.id === nom)) modele.participants.push({ id: nom, nom, genre: 'participant' });
    return nom;
}

export function analyser(code) {
    const { preambule, corps } = separerPreambule(code);
    if ((corps[0] || '').trim() !== 'sequenceDiagram') throw new Error('La première ligne doit être « sequenceDiagram ».');
    const modele = { preambule, numeros: false, participants: [], items: [] };
    corps.slice(1).forEach((brute, n) => {
        const ligne = brute.trim();
        if (!ligne) return;
        if (ligne.startsWith('%%')) { modele.items.push({ t: 'brut', ligne }); return; }
        if (ligne === 'autonumber') { modele.numeros = true; return; }
        let m = ligne.match(/^(participant|actor)\s+(.+?)(?:\s+as\s+(.+))?$/);
        if (m) {
            const id = m[2].trim();
            const existant = modele.participants.find((p) => p.id === id);
            const p = existant || { id };
            p.nom = decoder((m[3] || id).trim());
            p.genre = m[1];
            if (!existant) modele.participants.push(p);
            return;
        }
        m = ligne.match(RE_NOTE);
        if (m) {
            m[2].split(',').forEach((c) => declarer(modele, c));
            modele.items.push({ t: 'note', position: m[1].toLowerCase(), cibles: m[2].split(',').map((c) => c.trim()), texte: decoder(m[3]) });
            return;
        }
        const mot = ligne.match(/^[A-Za-z]+/)?.[0] || '';
        if (NON_GERES.has(mot) && /\s/.test(ligne[mot.length] || ' ')) throw new Error(`Ligne ${n + 2 + preambule.length} : l'instruction « ${mot} » n'est pas gérée par l'édition visuelle.`);
        if (MOTS_BRUTS.has(mot) && (ligne.length === mot.length || /\s/.test(ligne[mot.length]))) { modele.items.push({ t: 'brut', ligne }); return; }
        m = ligne.match(RE_MESSAGE);
        if (!m) throw new Error(`Ligne ${n + 2 + preambule.length} : cette écriture n'est pas gérée par l'édition visuelle.`);
        modele.items.push({ t: 'message', de: declarer(modele, m[1]), vers: declarer(modele, m[4]), fleche: m[2], activation: m[3] || '', texte: decoder(m[5]) });
    });
    return modele;
}

export function ecrire(modele) {
    const lignes = [...modele.preambule, 'sequenceDiagram'];
    if (modele.numeros) lignes.push('    autonumber');
    for (const p of modele.participants) lignes.push(`    ${p.genre} ${p.id}${p.nom !== p.id ? ` as ${coder(p.nom)}` : ''}`);
    let p = 1;
    for (const item of modele.items) {
        if (item.t === 'brut') {
            const mot = item.ligne.match(/^[A-Za-z]+/)?.[0] || '';
            if (mot === 'end' || MILIEU.has(mot)) p = Math.max(1, p - 1);
            lignes.push('    '.repeat(p) + item.ligne);
            if (OUVRE.has(mot) || MILIEU.has(mot)) p += 1;
        } else if (item.t === 'note') {
            lignes.push(`${'    '.repeat(p)}Note ${item.position} ${item.cibles.join(',')}: ${coder(item.texte)}`);
        } else {
            lignes.push(`${'    '.repeat(p)}${item.de}${item.fleche}${item.activation}${item.vers}: ${coder(item.texte)}`);
        }
    }
    return lignes.join('\n') + '\n';
}

const nomParticipant = (modele, id) => modele.participants.find((p) => p.id === id)?.nom || id;

function nomItem(modele, item) {
    if (item.t === 'brut') return item.ligne;
    if (item.t === 'note') return `Note : ${item.texte}`;
    return `${nomParticipant(modele, item.de)} → ${nomParticipant(modele, item.vers)} : ${item.texte}`;
}

export function elements(modele) {
    return [
        ...modele.participants.map((p, i) => ({ cle: `p:${i}`, nom: `${p.genre === 'actor' ? 'Acteur' : 'Participant'} : ${p.nom}` })),
        ...modele.items.map((item, i) => ({ cle: `i:${i}`, nom: nomItem(modele, item).replace(/\s+/g, ' '), brut: item.t === 'brut' })),
    ];
}

export function reperer(svg, modele) {
    // Participants : la boîte (ou le personnage) du haut porte l'identifiant du participant
    modele.participants.forEach((p, i) => {
        for (const g of svg.querySelectorAll(`g[data-et="participant"][data-id="${CSS.escape(p.id)}"]`)) marquer(g, `p:${i}`);
    });
    // Boîtes du bas : sans identifiant, elles sont retrouvées par le nom affiché
    for (const t of svg.querySelectorAll('text.actor')) {
        if (t.closest('[data-fusain]')) continue;
        const i = modele.participants.findIndex((p) => String(p.nom).replace(/\s+/g, ' ').trim() === t.textContent.replace(/\s+/g, ' ').trim());
        if (i < 0) continue;
        marquer(t, `p:${i}`);
        if (t.previousElementSibling?.matches('rect.actor')) marquer(t.previousElementSibling, `p:${i}`);
    }
    const indices = (t) => modele.items.map((item, i) => [item, i]).filter(([item]) => item.t === t).map(([, i]) => i);
    const messages = [...svg.querySelectorAll('.messageText')];
    const idxMessages = indices('message');
    if (messages.length === idxMessages.length) messages.forEach((el, n) => marquer(el, `i:${idxMessages[n]}`));
    const notes = [...svg.querySelectorAll('.noteText')];
    const idxNotes = indices('note');
    if (notes.length === idxNotes.length) notes.forEach((el, n) => marquer(el, `i:${idxNotes[n]}`));
}

// Instruction brute : seul le libellé d'un bloc (« alt Condition ») ou d'un commentaire se renomme ;
// « end », « activate », « rect rgb(…) »… gardent leur écriture
const motDe = (ligne) => (ligne.match(/^[A-Za-z]+/)?.[0] || '').toLowerCase();
const LIBELLES = new Set([...BLOCS.map((b) => b[0]), ...MILIEU, 'else', 'group']);
function libelleBrut(ligne) {
    if (LIBELLES.has(motDe(ligne))) return ligne.slice(motDe(ligne).length).trim();
    const commentaire = ligne.match(/^(%%|')\s?(.*)$/);
    return commentaire ? commentaire[2] : null;
}

export function texte(modele, cle) {
    const i = Number(cle.slice(2));
    if (cle.startsWith('p:')) return modele.participants[i]?.nom ?? null;
    const item = modele.items[i];
    if (!item) return null;
    return item.t === 'brut' ? libelleBrut(item.ligne) ?? item.ligne : item.texte;
}

export function renommer(modele, cle, valeur) {
    const i = Number(cle.slice(2));
    const v = valeur.trim();
    if (cle.startsWith('p:')) { if (modele.participants[i] && v) modele.participants[i].nom = v; return; }
    const item = modele.items[i];
    if (!item) return;
    if (item.t !== 'brut') { item.texte = v; return; }
    if (libelleBrut(item.ligne) === null) return;
    const libelle = v.replace(/\s+/g, ' ').replace(/;/g, ',');
    const commentaire = item.ligne.match(/^(%%|')/);
    if (commentaire) item.ligne = `${commentaire[1]} ${libelle}`.trim();
    else item.ligne = `${item.ligne.match(/^[A-Za-z]+/)[0]} ${libelle}`.trim();
}

function supprimerParticipant(modele, i) {
    const [p] = modele.participants.splice(i, 1);
    if (!p) return;
    modele.items = modele.items.filter((item) => !(item.t === 'message' && (item.de === p.id || item.vers === p.id)));
    for (const item of modele.items) if (item.t === 'note') item.cibles = item.cibles.filter((c) => c !== p.id);
    // Une note sans participant disparaît ; le séparateur « == … == » de PlantUML, qui couvre tout le schéma, reste
    modele.items = modele.items.filter((item) => !(item.t === 'note' && !item.cibles.length && !item.separateur));
    // Ses activations disparaissent aussi : elles le feraient réapparaître
    const activation = new RegExp(`^(activate|deactivate)\\s+"?${p.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"?$`, 'i');
    modele.items = modele.items.filter((item) => !(item.t === 'brut' && activation.test(item.ligne)));
}

// Supprimer l'ouverture, une branche ou la fin d'un bloc retire tout son cadre (ouverture, « else », « end ») ;
// les messages qu'il contenait restent
const OUVERTURE = new Set([...OUVRE, 'group']);
function cadreDuBloc(items, i) {
    const mot = (k) => (items[k]?.t === 'brut' ? motDe(items[k].ligne) : '');
    let debut = i;
    if (!OUVERTURE.has(mot(i))) {
        for (let k = i - 1, p = 0; k >= 0; k -= 1) {
            if (mot(k) === 'end') p += 1;
            else if (OUVERTURE.has(mot(k))) { if (p === 0) { debut = k; break; } p -= 1; }
        }
        if (debut === i) return [i];
    }
    const cadre = [debut];
    for (let k = debut + 1, p = 0; k < items.length; k += 1) {
        if (OUVERTURE.has(mot(k))) p += 1;
        else if (mot(k) === 'end') { if (p === 0) { cadre.push(k); break; } p -= 1; } else if (p === 0 && (MILIEU.has(mot(k)) || mot(k) === 'else')) cadre.push(k);
    }
    return cadre;
}

export function supprimer(modele, cle) {
    const i = Number(cle.slice(2));
    if (cle.startsWith('p:')) { supprimerParticipant(modele, i); return; }
    const item = modele.items[i];
    if (!item) return;
    const mot = item.t === 'brut' ? motDe(item.ligne) : '';
    const rangs = OUVERTURE.has(mot) || MILIEU.has(mot) || mot === 'else' || mot === 'end' ? new Set(cadreDuBloc(modele.items, i)) : new Set([i]);
    // « activate X » et le « deactivate X » qui lui répond vont ensemble : l'un sans l'autre est refusé
    if (mot === 'activate' || mot === 'deactivate') {
        const cible = item.ligne.slice(mot.length).trim().toLowerCase();
        const sens = mot === 'activate' ? 1 : -1;
        const visee = (k, m) => modele.items[k]?.t === 'brut' && motDe(modele.items[k].ligne) === m && modele.items[k].ligne.slice(m.length).trim().toLowerCase() === cible;
        for (let k = i + sens, p = 0; k >= 0 && k < modele.items.length; k += sens) {
            if (visee(k, mot)) p += 1;
            else if (visee(k, mot === 'activate' ? 'deactivate' : 'activate')) { if (p === 0) { rangs.add(k); break; } p -= 1; }
        }
    }
    modele.items = modele.items.filter((_, k) => !rangs.has(k));
}

function idLibre(modele) {
    let n = 1;
    while (modele.participants.some((p) => p.id === `P${n}`)) n += 1;
    return `P${n}`;
}

export function panneau(ctx) {
    const { modele, selection, appliquer, selectionner } = ctx;
    const i = selection ? Number(selection.slice(2)) : -1;
    const liste = modele.participants.map((p) => [p.id, p.nom]);
    const position = selection?.startsWith('i:') ? i + 1 : modele.items.length;
    const inserer = (items) => appliquer((m) => { m.items.splice(position, 0, ...items); }, () => `i:${position}`);
    const deux = () => [modele.participants[0]?.id, (modele.participants[1] || modele.participants[0])?.id];

    const blocs = [h('div', { class: 'fusain-bloc' },
        h('h2', {}, 'Diagramme de séquence'),
        champCase('Numéroter les messages', modele.numeros, (v) => appliquer((m) => { m.numeros = v; })),
        h('div', { class: 'fusain-actions' },
            bouton('Participant', { icone: 'add-line', variante: 'secondary', onclick: () => appliquer((m) => {
                const id = idLibre(m);
                m.participants.push({ id, nom: `Participant ${m.participants.length + 1}`, genre: 'participant' });
            }, (m) => `p:${m.participants.length - 1}`) }),
            bouton('Message', { icone: 'add-line', variante: 'secondary', disabled: !modele.participants.length, onclick: () => {
                const [de, vers] = deux();
                inserer([{ t: 'message', de, vers, fleche: '->>', activation: '', texte: 'Nouveau message' }]);
            } }),
            bouton('Note', { icone: 'add-line', disabled: !modele.participants.length, onclick: () => inserer([{ t: 'note', position: 'over', cibles: [deux()[0]], texte: 'Nouvelle note' }]) })),
        champSelect('Ajouter un bloc', [['', 'Choisir…'], ...BLOCS], '', (v) => {
            if (v) inserer([{ t: 'brut', ligne: `${v} ${BLOCS.find((b) => b[0] === v)[1]}` }, { t: 'brut', ligne: 'end' }]);
        }),
        h('p', { class: 'fusain-aide' }, 'Les ajouts se placent après l\'élément sélectionné.'))];

    if (selection?.startsWith('p:') && modele.participants[i]) {
        const p = modele.participants[i];
        blocs.push(h('div', { class: 'fusain-bloc' },
            h('h2', {}, 'Participant sélectionné'),
            champTexte('Nom', p.nom, (v) => appliquer((m) => { if (v.trim()) m.participants[i].nom = v.trim(); }), { id: 'fusain-champ-texte' }),
            champSelect('Représentation', [['participant', 'Boîte'], ['actor', 'Personnage']], p.genre, (v) => appliquer((m) => { m.participants[i].genre = v; })),
            actionsListe({
                monter: () => appliquer(() => {}, (m) => `p:${deplacer(m.participants, i, -1)}`),
                descendre: () => appliquer(() => {}, (m) => `p:${deplacer(m.participants, i, 1)}`),
                supprimer: () => appliquer((m) => supprimerParticipant(m, i), () => null),
            })));
    }

    const item = selection?.startsWith('i:') ? modele.items[i] : null;
    if (item) {
        const maj = (f) => appliquer((m) => f(m.items[i]));
        const ordre = actionsListe({
            monter: () => appliquer(() => {}, (m) => `i:${deplacer(m.items, i, -1)}`),
            descendre: () => appliquer(() => {}, (m) => `i:${deplacer(m.items, i, 1)}`),
            supprimer: () => appliquer((m) => supprimer(m, selection), () => null),
        });
        if (item.t === 'message') {
            blocs.push(h('div', { class: 'fusain-bloc' },
                h('h2', {}, 'Message sélectionné'),
                champTexte('Texte', item.texte, (v) => maj((x) => { x.texte = v.trim(); }), { id: 'fusain-champ-texte' }),
                h('div', { class: 'fusain-ligne' },
                    champSelect('De', liste, item.de, (v) => maj((x) => { x.de = v; })),
                    champSelect('Vers', liste, item.vers, (v) => maj((x) => { x.vers = v; }))),
                champSelect('Type', FLECHES, item.fleche, (v) => maj((x) => { x.fleche = v; })),
                champSelect('Activation du destinataire', [['', 'Inchangée'], ['+', 'Activer'], ['-', 'Désactiver l\'émetteur']], item.activation, (v) => maj((x) => { x.activation = v; })),
                ordre));
        } else if (item.t === 'note') {
            blocs.push(h('div', { class: 'fusain-bloc' },
                h('h2', {}, 'Note sélectionnée'),
                champTexte('Texte', item.texte, (v) => maj((x) => { x.texte = v.trim(); }), { multiligne: true, id: 'fusain-champ-texte' }),
                champSelect('Position', POSITIONS, item.position, (v) => maj((x) => { x.position = v; if (v !== 'over') x.cibles = x.cibles.slice(0, 1); })),
                h('div', { class: 'fusain-ligne' },
                    champSelect('Participant', liste, item.cibles[0], (v) => maj((x) => { x.cibles[0] = v; })),
                    item.position === 'over' ? champSelect('Jusqu\'à', [['', 'Lui seul'], ...liste], item.cibles[1] || '', (v) => maj((x) => { x.cibles = v ? [x.cibles[0], v] : [x.cibles[0]]; })) : null),
                ordre));
        } else {
            blocs.push(h('div', { class: 'fusain-bloc' },
                h('h2', {}, 'Instruction'),
                champTexte('Ligne de code', item.ligne, (v) => maj((x) => { if (v.trim()) x.ligne = v.trim().replace(/\s+/g, ' '); }), { id: 'fusain-champ-texte' }),
                h('p', { class: 'fusain-aide' }, 'Bloc ou instruction avancée : « loop Libellé », « alt Condition », « else », « end »…'),
                ordre));
        }
    }
    blocs.push(h('div', { class: 'fusain-bloc' }, h('h2', {}, 'Déroulé'), plan(elements(modele), selection, selectionner)));
    return blocs;
}

export default { type: 'sequence', nom: 'Diagramme de séquence', analyser, ecrire, elements, reperer, texte, renommer, supprimer, panneau };
