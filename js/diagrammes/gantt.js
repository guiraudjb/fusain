// Diagramme de Gantt : sections et tâches saisies en grille
import { h, bouton, champTexte, champSelect, champCase } from '../dom.js';
import { separerPreambule, deplacer, actionsListe, plan, marquer } from './commun.js';

const ETATS = ['done', 'active', 'crit', 'milestone'];
const NOMS_ETATS = { done: 'Terminée', active: 'En cours', crit: 'Critique', milestone: 'Jalon' };
const REGLAGES = ['dateFormat', 'axisFormat', 'excludes', 'tickInterval', 'todayMarker', 'weekday', 'includes'];
const propre = (t) => String(t).replace(/[\n:;#]/g, ' ').replace(/\s+/g, ' ').trim();

function lireTache(nom, meta) {
    const morceaux = meta.split(',').map((x) => x.trim()).filter(Boolean);
    const etats = [];
    while (morceaux.length && ETATS.includes(morceaux[0])) etats.push(morceaux.shift());
    const tache = { t: 'tache', nom, etats, id: '', debut: '', fin: '' };
    if (morceaux.length === 3) [tache.id, tache.debut, tache.fin] = morceaux;
    else if (morceaux.length === 2) [tache.debut, tache.fin] = morceaux;
    else if (morceaux.length === 1) [tache.fin] = morceaux;
    else throw new Error('tâche incomplète');
    return tache;
}

export function analyser(code) {
    const { preambule, corps } = separerPreambule(code);
    if ((corps[0] || '').trim() !== 'gantt') throw new Error('La première ligne doit être « gantt ».');
    const modele = { preambule, titre: '', reglages: {}, lignes: [] };
    corps.slice(1).forEach((brute, n) => {
        const ligne = brute.trim();
        if (!ligne) return;
        if (ligne.startsWith('%%')) { modele.lignes.push({ t: 'brut', ligne }); return; }
        const mot = ligne.match(/^[A-Za-z]+/)?.[0] || '';
        const reste = ligne.slice(mot.length).trim();
        try {
            if (mot === 'title' && reste) { modele.titre = reste; return; }
            if (REGLAGES.includes(mot) && reste) { modele.reglages[mot] = reste; return; }
            if (mot === 'section' && reste) { modele.lignes.push({ t: 'section', nom: reste }); return; }
            if (['inclusiveEndDates', 'topAxis', 'weekend', 'displayMode', 'accTitle', 'accDescr', 'click'].includes(mot)) {
                if (mot !== 'click') modele.lignes.push({ t: 'brut', ligne });
                return;
            }
            const i = ligne.indexOf(':');
            if (i < 1) throw new Error('écriture non gérée');
            modele.lignes.push(lireTache(ligne.slice(0, i).trim(), ligne.slice(i + 1)));
        } catch (e) {
            throw new Error(`Ligne ${n + 2 + preambule.length} : ${e.message} par l'édition visuelle.`);
        }
    });
    return modele;
}

export function ecrire(modele) {
    const lignes = [...modele.preambule, 'gantt'];
    if (modele.titre) lignes.push(`    title ${propre(modele.titre)}`);
    for (const cle of REGLAGES) if (modele.reglages[cle]) lignes.push(`    ${cle} ${String(modele.reglages[cle]).replace(/[\n;]/g, ' ').trim()}`);
    for (const l of modele.lignes) {
        if (l.t === 'brut') lignes.push(`    ${l.ligne}`);
        else if (l.t === 'section') lignes.push(`    section ${propre(l.nom) || 'Section'}`);
        else {
            const meta = [...l.etats, l.id, l.debut, l.fin].map((x) => String(x).replace(/[,\n;]/g, ' ').trim()).filter(Boolean);
            lignes.push(`    ${propre(l.nom) || 'Tâche'} :${meta.join(', ')}`);
        }
    }
    return lignes.join('\n') + '\n';
}

export const elements = (modele) => modele.lignes.map((l, i) => ({
    cle: `i:${i}`, brut: l.t === 'brut',
    nom: l.t === 'section' ? `Section : ${l.nom}` : l.t === 'tache' ? `${l.nom} (${[l.debut, l.fin].filter(Boolean).join(' → ')})` : l.ligne,
}));

export function reperer(svg, modele) {
    const indices = modele.lignes.map((l, i) => [l, i]).filter(([l]) => l.t === 'tache').map(([, i]) => i);
    const textes = [...svg.querySelectorAll('text[class*="taskText"]')];
    const barres = [...svg.querySelectorAll('rect[class*="task"]:not(.section)')];
    if (textes.length === indices.length) textes.forEach((el, n) => marquer(el, `i:${indices[n]}`));
    if (barres.length === indices.length) barres.forEach((el, n) => marquer(el, `i:${indices[n]}`));
}

export function texte(modele, cle) { const l = modele.lignes[Number(cle.slice(2))]; return l ? (l.t === 'brut' ? l.ligne : l.nom) : null; }
export function renommer(modele, cle, valeur) {
    const l = modele.lignes[Number(cle.slice(2))];
    if (!l || !valeur.trim()) return;
    if (l.t === 'brut') l.ligne = valeur.trim(); else l.nom = valeur.trim();
}
export function supprimer(modele, cle) { modele.lignes.splice(Number(cle.slice(2)), 1); }

function idLibre(modele) {
    let n = 1;
    while (modele.lignes.some((l) => l.id === `t${n}`)) n += 1;
    return `t${n}`;
}

export function panneau(ctx) {
    const { modele, selection, appliquer, selectionner } = ctx;
    const i = selection?.startsWith('i:') ? Number(selection.slice(2)) : -1;
    const ligne = modele.lignes[i];
    const position = ligne ? i + 1 : modele.lignes.length;
    const inserer = (f) => appliquer((m) => { m.lignes.splice(position, 0, f(m)); }, () => `i:${position}`);
    const reglage = (cle, libelle, aide) => champTexte(libelle, modele.reglages[cle] || '', (v) => appliquer((m) => {
        if (v.trim()) m.reglages[cle] = v.trim(); else delete m.reglages[cle];
    }), { placeholder: aide });
    const precedente = [...modele.lignes.slice(0, position)].reverse().find((l) => l.t === 'tache');

    const blocs = [h('div', { class: 'fusain-bloc' },
        h('h2', {}, 'Diagramme de Gantt'),
        champTexte('Titre', modele.titre, (v) => appliquer((m) => { m.titre = v.trim(); })),
        h('div', { class: 'fusain-ligne' },
            reglage('dateFormat', 'Format des dates saisies', 'YYYY-MM-DD'),
            reglage('axisFormat', 'Format de l\'axe', '%d/%m')),
        reglage('excludes', 'Jours exclus', 'weekends, 2026-12-25'),
        h('div', { class: 'fusain-actions' },
            bouton('Tâche', { icone: 'add-line', variante: 'secondary', onclick: () => inserer((m) => {
                const id = idLibre(m);
                // Une nouvelle tâche s'enchaîne après la précédente lorsqu'elle est identifiée
                const debut = precedente?.id ? `after ${precedente.id}` : new Date().toISOString().slice(0, 10);
                return { t: 'tache', nom: 'Nouvelle tâche', etats: [], id, debut, fin: '5d' };
            }) }),
            bouton('Section', { icone: 'add-line', onclick: () => inserer(() => ({ t: 'section', nom: 'Nouvelle section' })) })),
        h('p', { class: 'fusain-aide' }, 'Les ajouts se placent après la ligne sélectionnée.'))];

    if (ligne) {
        const maj = (f) => appliquer((m) => f(m.lignes[i]));
        const ordre = actionsListe({
            monter: () => appliquer(() => {}, (m) => `i:${deplacer(m.lignes, i, -1)}`),
            descendre: () => appliquer(() => {}, (m) => `i:${deplacer(m.lignes, i, 1)}`),
            supprimer: () => appliquer((m) => { m.lignes.splice(i, 1); }, () => null),
        });
        if (ligne.t === 'tache') {
            blocs.push(h('div', { class: 'fusain-bloc' },
                h('h2', {}, 'Tâche sélectionnée'),
                champTexte('Nom', ligne.nom, (v) => maj((x) => { if (v.trim()) x.nom = v.trim(); }), { id: 'fusain-champ-texte' }),
                h('div', { class: 'fusain-ligne' },
                    champTexte('Début', ligne.debut, (v) => maj((x) => { x.debut = v.trim(); }), { placeholder: '2026-01-15 ou after t1' }),
                    champTexte('Durée ou fin', ligne.fin, (v) => maj((x) => { if (v.trim()) x.fin = v.trim(); }), { placeholder: '10d ou 2026-02-01' })),
                champTexte('Identifiant (pour enchaîner d\'autres tâches)', ligne.id, (v) => maj((x) => { x.id = v.trim().replace(/[^\p{L}\p{N}_-]/gu, ''); })),
                ETATS.map((e) => champCase(NOMS_ETATS[e], ligne.etats.includes(e), (coche) => maj((x) => {
                    x.etats = ETATS.filter((k) => (k === e ? coche : x.etats.includes(k)));
                }))),
                h('p', { class: 'fusain-aide' }, 'Durée : 5d (jours), 2w (semaines), 8h (heures). Début : une date, ou « after » suivi de l\'identifiant d\'une autre tâche.'),
                ordre));
        } else if (ligne.t === 'section') {
            blocs.push(h('div', { class: 'fusain-bloc' }, h('h2', {}, 'Section sélectionnée'),
                champTexte('Nom', ligne.nom, (v) => maj((x) => { if (v.trim()) x.nom = v.trim(); }), { id: 'fusain-champ-texte' }), ordre));
        } else {
            blocs.push(h('div', { class: 'fusain-bloc' }, h('h2', {}, 'Instruction'),
                champTexte('Ligne de code', ligne.ligne, (v) => maj((x) => { if (v.trim()) x.ligne = v.trim(); }), { id: 'fusain-champ-texte' }), ordre));
        }
    }
    blocs.push(h('div', { class: 'fusain-bloc' }, h('h2', {}, 'Planning'), plan(elements(modele), selection, selectionner)));
    return blocs;
}

export default { type: 'gantt', nom: 'Diagramme de Gantt', analyser, ecrire, elements, reperer, texte, renommer, supprimer, panneau };
