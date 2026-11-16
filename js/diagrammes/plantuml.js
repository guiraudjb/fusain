// Diagramme de séquence PlantUML (@startuml … @enduml) modifié à la souris SANS quitter la syntaxe PlantUML.
// Le code est lu dans le modèle de l'éditeur de séquence (participants, messages, notes, blocs), dont le panneau et le
// repérage sont repris : la page est dessinée par la traduction de js/plantuml.js, qui produit les mêmes messages et
// les mêmes notes, dans le même ordre. Les autres familles PlantUML passent par « Convertir pour l'édition visuelle ».
import { h, champTexte, champSelect, bouton } from '../dom.js';
import { separerPreambule } from './commun.js';
import sequence from './sequence.js';
import { detecterFamillePlantUml, extraireParticipantSequence, nettoyerId, traduirePlantUml } from '../plantuml.js';

const FORMES = [['participant', 'Boîte (participant)'], ['actor', 'Personnage (actor)'], ['boundary', 'Frontière (boundary)'], ['control', 'Contrôle (control)'],
    ['entity', 'Entité (entity)'], ['database', 'Base de données (database)'], ['collections', 'Collection (collections)'], ['queue', 'File (queue)']];
// Flèches PlantUML ↔ flèches du modèle de séquence (écriture Mermaid)
const VERS_MODELE = { '->': '->>', '-->': '-->>', '->>': '-)', '-->>': '--)', '->x': '-x' };
const VERS_PLANTUML = { '->>': '->', '-->>': '-->', '-)': '->>', '--)': '-->>', '-x': '->x', '--x': '->x', '->': '->', '-->': '-->', '<<->>': '->', '<<-->>': '-->' };
const RE_MESSAGE = /^("[^"]+"|[^\s\->:<]+)\s*(<--|<-|-->>|->>|-->|->x|->)\s*(\+\+|--)?\s*("[^"]+"|[^\s\->:<]+)\s*(\+\+|--)?\s*(?::\s*(.*))?$/;
const RE_NOTE = /^note\s+(left|right|over)(?:\s+of)?\s+([^:]+?)\s*(?::\s*(.*))?$/i;
const RE_BLOC = /^(alt|else|opt|loop|par|break|critical|group|end|activate|deactivate)\b/i;

// Le point-virgule terminerait l'instruction une fois traduite pour Mermaid : il devient une virgule
const coder = (t) => String(t ?? '').replace(/;/g, ',').replace(/\r?\n/g, '\\n');
// Nom d'un participant : ni guillemet, ni point-virgule, ni « # », « @ » ou accolade (syntaxes de Mermaid après traduction)
const propreNom = (t) => String(t ?? '').replace(/["#@{};]/g, ' ').replace(/\s+/g, ' ').trim();
const decoder = (t) => String(t ?? '').replace(/\\n/g, '\n');

export function analyser(code) {
    const { preambule, corps } = separerPreambule(code);
    const debut = corps.findIndex((l) => l.trim());
    const entete = (corps[debut] || '').trim();
    if (!/^@startuml\b/i.test(entete)) throw new Error('Ce schéma PlantUML n\'est pas géré par l\'édition visuelle directe (seuls les diagrammes de séquence « @startuml » le sont) : convertissez-le pour l\'éditer à la souris.');
    let famille;
    try { famille = detecterFamillePlantUml(code); } catch (e) {
        throw new Error(`${e.message} Le schéma n'est pas géré par l'édition visuelle tant qu'il est incomplet.`);
    }
    if (famille !== 'sequence') {
        throw new Error('Ce schéma PlantUML n\'est pas un diagramme de séquence : il n\'est pas géré par l\'édition visuelle directe. Convertissez-le pour l\'éditer à la souris, ou modifiez-le dans le code.');
    }
    const modele = { preambule, entete, titre: '', numeros: false, participants: [], items: [], fin: '@enduml', apres: [] };
    const alias = new Map();
    const declarer = (nomBrut) => {
        const nom = nomBrut.trim().replace(/^"|"$/g, '');
        if (alias.has(nom)) return alias.get(nom);
        const id = nettoyerId(nom);
        alias.set(nom, id);
        if (!modele.participants.some((p) => p.id === id)) modele.participants.push({ id, nom, genre: 'participant', forme: 'participant' });
        return id;
    };
    const activations = [];
    let note = null;
    let commentaire = false;
    let termine = false;
    corps.slice(debut + 1).forEach((brute, n) => {
        const ligne = brute.trim();
        const erreur = (t) => new Error(`Ligne ${n + 2 + debut + preambule.length} : ${t}`);
        if (termine) { if (ligne) modele.apres.push(brute); return; }
        if (!ligne) return;
        if (commentaire) { modele.items.push({ t: 'brut', ligne }); if (ligne.includes('\'/')) commentaire = false; return; }
        if (note) {
            if (/^end\s*note$/i.test(ligne)) { modele.items.push({ ...note, texte: note.lignes.join('\n') }); delete modele.items[modele.items.length - 1].lignes; note = null; } else note.lignes.push(ligne);
            return;
        }
        if (/^@enduml\b/i.test(ligne)) { modele.fin = ligne; termine = true; return; }
        if (ligne.startsWith('/\'')) { modele.items.push({ t: 'brut', ligne }); if (!ligne.includes('\'/')) commentaire = true; return; }
        if (ligne.startsWith('\'') || /^(skinparam|hide|show|scale|header|footer|!)/i.test(ligne)) { modele.items.push({ t: 'brut', ligne }); return; }
        let m = ligne.match(/^title\s+(.+)$/i);
        if (m) { modele.titre = m[1].replace(/^["']|["']$/g, '').trim(); return; }
        if (/^autonumber\b/i.test(ligne)) { modele.numeros = true; return; }
        m = ligne.match(/^(actor|participant|boundary|control|entity|database|collections|queue)\b/i);
        const p = m && extraireParticipantSequence(ligne);
        if (p) {
            alias.set(p.id, p.id);
            alias.set(p.libelle, p.id);
            const existant = modele.participants.find((x) => x.id === p.id);
            const forme = m[1].toLowerCase();
            const fiche = { id: p.id, nom: p.libelle, genre: forme === 'actor' ? 'actor' : 'participant', forme };
            if (existant) Object.assign(existant, fiche); else modele.participants.push(fiche);
            return;
        }
        m = ligne.match(/^==\s*(.+?)\s*==$/);
        if (m) { modele.items.push({ t: 'note', separateur: true, position: 'over', cibles: [], texte: m[1] }); return; }
        m = ligne.match(/^return\b\s*(.*)$/i);
        if (m) {
            const dernier = activations.pop();
            if (!dernier) throw erreur('« return » sans message activé (++) avant lui.');
            modele.items.push({ t: 'message', retour: true, de: dernier.vers, vers: dernier.de, fleche: '-->>', activation: '', texte: m[1].trim() });
            return;
        }
        m = ligne.match(RE_NOTE);
        if (m) {
            const cibles = m[2].split(',').map((c) => declarer(c));
            const base = { t: 'note', position: m[1].toLowerCase() === 'over' ? 'over' : `${m[1].toLowerCase()} of`, cibles };
            if (m[3] === undefined) note = { ...base, lignes: [] }; else modele.items.push({ ...base, texte: decoder(m[3].trim()) });
            return;
        }
        if (RE_BLOC.test(ligne)) { modele.items.push({ t: 'brut', ligne }); return; }
        m = ligne.match(RE_MESSAGE);
        if (m) {
            let de = declarer(m[1]);
            let vers = declarer(m[4]);
            let fleche = VERS_MODELE[m[2]];
            if (m[2].startsWith('<')) { [de, vers] = [vers, de]; fleche = m[2] === '<--' ? '-->>' : '->>'; }
            const mod = m[3] || m[5] || '';
            if (mod === '++') activations.push({ de, vers });
            modele.items.push({ t: 'message', de, vers, fleche, activation: mod === '++' ? '+' : mod === '--' ? '-' : '', texte: decoder((m[6] || '').trim()) });
            return;
        }
        throw erreur(`cette écriture PlantUML n'est pas gérée par l'édition visuelle (« ${ligne} »).`);
    });
    if (note) throw new Error('Une note n\'est pas refermée par « end note ».');
    if (!termine) throw new Error('Le schéma ne se termine pas par « @enduml ».');
    // Le séparateur « == … == » couvre tous les participants, comme dans la traduction
    return modele;
}

function ecrirePlantUml(modele) {
    const lignes = [...modele.preambule, modele.entete || '@startuml'];
    if (modele.titre.trim()) lignes.push(`title ${modele.titre.replace(/\s+/g, ' ').trim()}`);
    if (modele.numeros) lignes.push('autonumber');
    for (const p of modele.participants) {
        const forme = p.genre === 'actor' ? 'actor' : (p.forme && p.forme !== 'actor' ? p.forme : 'participant');
        const nom = propreNom(p.nom ?? p.id);
        lignes.push(nom && nom !== p.id ? `${forme} "${nom}" as ${p.id}` : `${forme} ${p.id}`);
    }
    lignes.push('');
    let retrait = 0;
    const marge = () => '    '.repeat(retrait);
    for (const item of modele.items) {
        if (item.t === 'brut') {
            const mot = (item.ligne.match(/^[A-Za-z]+/)?.[0] || '').toLowerCase();
            if (mot === 'end' || mot === 'else') retrait = Math.max(0, retrait - 1);
            lignes.push(marge() + item.ligne);
            if (['alt', 'else', 'opt', 'loop', 'par', 'break', 'critical', 'group'].includes(mot)) retrait += 1;
        } else if (item.t === 'note') {
            if (item.separateur) { lignes.push(`${marge()}== ${coder(item.texte).replace(/=+/g, ' ').replace(/\s+/g, ' ').trim() || 'Étape'} ==`); continue; }
            const cibles = item.cibles.join(', ');
            const position = item.position === 'over' ? 'over' : item.position.replace(' of', '');
            const texte = String(item.texte ?? '');
            if (texte.includes('\n')) {
                lignes.push(`${marge()}note ${position}${item.position === 'over' ? '' : ' of'} ${cibles}`);
                for (const l of texte.split('\n')) lignes.push(`${marge()}    ${coder(l).trim()}`);
                lignes.push(`${marge()}end note`);
            } else lignes.push(`${marge()}note ${position}${item.position === 'over' ? '' : ' of'} ${cibles} : ${coder(texte).trim()}`);
        } else if (item.retour) {
            lignes.push(`${marge()}return ${coder(item.texte)}`.trimEnd());
        } else {
            const suffixe = item.activation === '+' ? ' ++' : item.activation === '-' ? ' --' : '';
            const texte = coder(item.texte).trim();
            lignes.push(`${marge()}${item.de} ${VERS_PLANTUML[item.fleche] || '->'} ${item.vers}${suffixe}${texte ? ` : ${texte}` : ''}`);
        }
    }
    lignes.push(modele.fin || '@enduml', ...modele.apres);
    return lignes.join('\n') + '\n';
}

export function ecrire(modele) {
    // « Convertir en Mermaid » : la page quitte PlantUML pour la syntaxe de Mermaid, éditable par l'éditeur de séquence
    const code = ecrirePlantUml(modele);
    return modele.versMermaid ? traduirePlantUml(code) : code;
}

export function panneau(ctx) {
    const { modele, selection, appliquer } = ctx;
    const blocs = sequence.panneau(ctx);
    blocs.unshift(h('div', { class: 'fusain-bloc' },
        h('h2', {}, 'Schéma PlantUML'),
        champTexte('Titre', modele.titre, (v) => appliquer((m) => { m.titre = v.replace(/\s+/g, ' ').trim(); })),
        h('p', { class: 'fusain-aide' }, 'Le schéma reste écrit en PlantUML (@startuml … @enduml) : chaque modification à la souris réécrit le code PlantUML.'),
        h('div', { class: 'fusain-actions' },
            bouton('Convertir en code Mermaid', { icone: 'refresh-line', onclick: () => appliquer((m) => { m.versMermaid = true; }, () => null) }))));
    const i = selection?.startsWith('p:') ? Number(selection.slice(2)) : -1;
    const p = modele.participants[i];
    if (p) {
        // La forme PlantUML précise la représentation du participant (base de données, file…)
        const forme = p.genre === 'actor' ? 'actor' : p.forme || 'participant';
        blocs.splice(blocs.length - 1, 0, h('div', { class: 'fusain-bloc' },
            h('h2', {}, 'Forme PlantUML'),
            champSelect('Représentation PlantUML', FORMES, forme, (v) => appliquer((m) => { m.participants[i].forme = v; m.participants[i].genre = v === 'actor' ? 'actor' : 'participant'; }))));
    }
    const item = selection?.startsWith('i:') ? modele.items[Number(selection.slice(2))] : null;
    if (item?.retour) blocs.splice(blocs.length - 1, 0, h('p', { class: 'fusain-aide' }, 'Message « return » : il répond au dernier message activé (++) ; seul son texte est repris dans le code.'));
    return blocs;
}

export default { ...sequence, type: 'plantuml', nom: 'Diagramme de séquence PlantUML', analyser, ecrire, panneau };
