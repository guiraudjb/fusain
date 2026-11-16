// Cadre Cynefin (cynefin-beta de Mermaid) : cinq domaines, des situations rangées dans chacun, des passages entre domaines
import { h, bouton, champTexte, champSelect } from '../dom.js';
import { separerPreambule, plan, marquer, actionsListe, deplacer } from './commun.js';

export const DOMAINES = [['complex', 'Complexe'], ['complicated', 'Compliqué'], ['clear', 'Évident'], ['chaotic', 'Chaotique'], ['confusion', 'Confus']];
const RE_DOMAINE = new RegExp(`^(${DOMAINES.map(([d]) => d).join('|')})$`);
const RE_PASSAGE = new RegExp(`^(${DOMAINES.map(([d]) => d).join('|')})\\s*-->\\s*(${DOMAINES.map(([d]) => d).join('|')})(?:\\s*:\\s*"([^"]*)")?$`);
// Un texte va entre guillemets droits : ceux qu'il contiendrait deviennent typographiques
const propre = (t) => String(t ?? '').replace(/\s+/g, ' ').replace(/"/g, '”').trim();
const nomDomaine = (d) => DOMAINES.find(([x]) => x === d)?.[1] || d;

export function analyser(code) {
    const { preambule, corps } = separerPreambule(code);
    if ((corps[0] || '').trim() !== 'cynefin-beta') throw new Error('La première ligne doit être « cynefin-beta ».');
    const modele = { preambule, titre: '', situations: [], passages: [], domaines: [], brut: [] };
    let courant = null;
    corps.slice(1).forEach((brute, n) => {
        const ligne = brute.trim();
        if (!ligne || ligne.startsWith('%%')) return;
        if (/^title\s/.test(ligne)) { modele.titre = ligne.slice(6).trim(); return; }
        let m = ligne.match(RE_DOMAINE);
        if (m) { courant = m[1]; if (!modele.domaines.includes(courant)) modele.domaines.push(courant); return; }
        m = ligne.match(RE_PASSAGE);
        if (m) { modele.passages.push({ de: m[1], vers: m[2], texte: m[3] ?? '' }); return; }
        m = ligne.match(/^"([^"]*)"$/);
        if (m) {
            if (!courant) throw new Error(`Ligne ${n + 2 + preambule.length} : cette écriture n'est pas gérée par l'édition visuelle (une situation se place sous un domaine).`);
            modele.situations.push({ domaine: courant, texte: m[1] });
            return;
        }
        modele.brut.push(ligne);
    });
    return modele;
}

export function ecrire(modele) {
    const lignes = [...modele.preambule, 'cynefin-beta'];
    if (propre(modele.titre)) lignes.push(`    title ${propre(modele.titre)}`);
    // Les domaines gardent l'ordre du code ; un domaine sans situation n'est écrit que s'il l'était déjà
    const ordre = [...modele.domaines.filter((d) => DOMAINES.some(([x]) => x === d)), ...DOMAINES.map(([d]) => d).filter((d) => !modele.domaines.includes(d))];
    for (const d of ordre) {
        const liste = modele.situations.filter((s) => s.domaine === d);
        if (!liste.length && !modele.domaines.includes(d)) continue;
        lignes.push(`    ${d}`);
        for (const s of liste) lignes.push(`        "${propre(s.texte)}"`);
    }
    for (const p of modele.passages) lignes.push(`    ${p.de} --> ${p.vers}${propre(p.texte) ? ` : "${propre(p.texte)}"` : ''}`);
    for (const b of modele.brut) lignes.push(`    ${b}`);
    return lignes.join('\n') + '\n';
}

export const elements = (modele) => [
    ...DOMAINES.map(([d, nom]) => ({ cle: `d:${d}`, nom: `Domaine : ${nom}` })),
    ...modele.situations.map((s, i) => ({ cle: `s:${i}`, nom: `${nomDomaine(s.domaine)} — ${s.texte}` })),
    ...modele.passages.map((p, i) => ({ cle: `p:${i}`, nom: `${nomDomaine(p.de)} → ${nomDomaine(p.vers)}${p.texte ? ` : ${p.texte}` : ''}` })),
];

export function reperer(svg, modele) {
    // Les domaines sont nommés en anglais par Mermaid, dans un ordre qui lui est propre
    for (const t of svg.querySelectorAll('text.cynefinDomainLabel')) {
        const d = t.textContent.trim().toLowerCase();
        if (DOMAINES.some(([x]) => x === d)) marquer(t, `d:${d}`);
    }
    // Les situations sont dessinées domaine par domaine : elles sont retrouvées par leur texte
    const restantes = modele.situations.map((s, i) => ({ i, texte: propre(s.texte) }));
    for (const g of svg.querySelectorAll('g.cynefin-items > g')) {
        const k = restantes.findIndex((s) => s.texte === propre(g.textContent));
        if (k >= 0) { marquer(g, `s:${restantes[k].i}`); restantes.splice(k, 1); }
    }
    const traits = [...svg.querySelectorAll('.cynefinArrowLine')];
    const libelles = [...svg.querySelectorAll('.cynefinArrowLabel')];
    if (traits.length === modele.passages.length) traits.forEach((t, i) => marquer(t, `p:${i}`));
    const avecTexte = modele.passages.map((p, i) => [p, i]).filter(([p]) => propre(p.texte));
    if (libelles.length === avecTexte.length) libelles.forEach((t, k) => marquer(t, `p:${avecTexte[k][1]}`));
}

export function texte(modele, cle) {
    const i = Number(cle.slice(2));
    if (cle.startsWith('s:')) return modele.situations[i]?.texte ?? null;
    if (cle.startsWith('p:')) return modele.passages[i]?.texte ?? null;
    return null;
}

export function renommer(modele, cle, valeur) {
    const i = Number(cle.slice(2));
    if (cle.startsWith('s:') && modele.situations[i] && propre(valeur)) modele.situations[i].texte = propre(valeur);
    if (cle.startsWith('p:') && modele.passages[i]) modele.passages[i].texte = propre(valeur);
}

export function supprimer(modele, cle) {
    const i = Number(cle.slice(2));
    if (cle.startsWith('s:')) modele.situations.splice(i, 1);
    if (cle.startsWith('p:')) modele.passages.splice(i, 1);
}

export const peutRelier = (cle) => cle.startsWith('d:');
export function relier(modele, de, vers) {
    if (!vers || !vers.startsWith('d:') || vers === de) return de;
    modele.passages.push({ de: de.slice(2), vers: vers.slice(2), texte: '' });
    return `p:${modele.passages.length - 1}`;
}

function ajouterSituation(modele, domaine) {
    // Placée après la dernière situation du domaine
    let rang = modele.situations.length;
    for (let k = modele.situations.length - 1; k >= 0; k -= 1) if (modele.situations[k].domaine === domaine) { rang = k + 1; break; }
    modele.situations.splice(rang, 0, { domaine, texte: 'Nouvelle situation' });
    if (!modele.domaines.includes(domaine)) modele.domaines.push(domaine);
    return `s:${rang}`;
}

export function panneau(ctx) {
    const { modele, selection, appliquer, selectionner } = ctx;
    const i = selection ? Number(selection.slice(2)) : -1;
    const domaineChoisi = selection?.startsWith('d:') ? selection.slice(2) : selection?.startsWith('s:') ? modele.situations[i]?.domaine : 'complex';
    const blocs = [h('div', { class: 'fusain-bloc' },
        h('h2', {}, 'Cadre Cynefin'),
        champTexte('Titre', modele.titre, (v) => appliquer((m) => { m.titre = propre(v); })),
        h('div', { class: 'fusain-actions' },
            bouton('Ajouter une situation', { icone: 'add-line', variante: 'secondary', onclick: () => { let cle; appliquer((m) => { cle = ajouterSituation(m, domaineChoisi || 'complex'); }, () => cle); } }),
            bouton('Ajouter un passage', { icone: 'add-line', onclick: () => appliquer((m) => { m.passages.push({ de: 'chaotic', vers: 'complex', texte: 'Situation stabilisée' }); }, (m) => `p:${m.passages.length - 1}`) })),
        h('p', { class: 'fusain-aide' }, 'Une situation s\'ajoute dans le domaine sélectionné. Complexe : sonder, comprendre, réagir ; compliqué : analyser ; évident : appliquer les bonnes pratiques ; chaotique : agir d\'abord.'))];

    if (selection?.startsWith('d:')) {
        const d = selection.slice(2);
        blocs.push(h('div', { class: 'fusain-bloc' }, h('h2', {}, `Domaine : ${nomDomaine(d)}`),
            h('p', { class: 'fusain-aide' }, `${modele.situations.filter((s) => s.domaine === d).length} situation(s).`),
            h('div', { class: 'fusain-actions' }, bouton('Ajouter une situation ici', { icone: 'add-line', variante: 'secondary', onclick: () => { let cle; appliquer((m) => { cle = ajouterSituation(m, d); }, () => cle); } }))));
    } else if (selection?.startsWith('s:') && modele.situations[i]) {
        const s = modele.situations[i];
        blocs.push(h('div', { class: 'fusain-bloc' }, h('h2', {}, 'Situation sélectionnée'),
            champTexte('Texte', s.texte, (v) => appliquer((m) => renommer(m, selection, v)), { id: 'fusain-champ-texte' }),
            champSelect('Domaine', DOMAINES, s.domaine, (v) => appliquer((m) => { m.situations[i].domaine = v; if (!m.domaines.includes(v)) m.domaines.push(v); })),
            actionsListe({
                monter: () => appliquer(() => {}, (m) => `s:${deplacer(m.situations, i, -1)}`),
                descendre: () => appliquer(() => {}, (m) => `s:${deplacer(m.situations, i, 1)}`),
                supprimer: () => appliquer((m) => supprimer(m, selection), () => null),
            })));
    } else if (selection?.startsWith('p:') && modele.passages[i]) {
        const p = modele.passages[i];
        const maj = (f) => appliquer((m) => f(m.passages[i]));
        blocs.push(h('div', { class: 'fusain-bloc' }, h('h2', {}, 'Passage sélectionné'),
            champTexte('Libellé', p.texte, (v) => appliquer((m) => renommer(m, selection, v)), { id: 'fusain-champ-texte' }),
            h('div', { class: 'fusain-ligne' },
                champSelect('Depuis', DOMAINES, p.de, (v) => maj((x) => { x.de = v; })),
                champSelect('Vers', DOMAINES, p.vers, (v) => maj((x) => { x.vers = v; }))),
            actionsListe({ supprimer: () => appliquer((m) => supprimer(m, selection), () => null) })));
    }
    blocs.push(h('div', { class: 'fusain-bloc' }, h('h2', {}, 'Contenu'), plan(elements(modele), selection, selectionner)));
    return blocs;
}

export default { type: 'cynefin', nom: 'Cadre Cynefin', analyser, ecrire, elements, reperer, texte, renommer, supprimer, relier, peutRelier, panneau };
