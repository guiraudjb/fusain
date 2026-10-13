// Frise chronologique : périodes et événements
import { h, bouton, champTexte } from '../dom.js';
import { separerPreambule, deplacer, actionsListe, plan, marquer } from './commun.js';

// Deux-points, point-virgule et dièse structurent la syntaxe : ils sont retirés des textes
const propre = (t) => String(t).replace(/[:;#\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim();
const MOT_CLE = /^(title|section|timeline|accTitle|accDescr)(\s|$)/i;
const nomSur = (t, repli) => { const n = propre(t) || repli; return MOT_CLE.test(n) ? `« ${n} »` : n; };

export function analyser(code) {
    const { preambule, corps } = separerPreambule(code);
    if (!/^timeline(\s+(LR|TD))?$/.test((corps[0] || '').trim())) throw new Error('La première ligne doit être « timeline ».');
    const modele = { preambule, entete: corps[0].trim(), titre: '', items: [] };
    corps.slice(1).forEach((brute, n) => {
        const ligne = brute.trim();
        if (!ligne || ligne.startsWith('%%')) return;
        const mot = ligne.match(/^([A-Za-z]+)(?=\s|$)/)?.[1] || '';
        const reste = ligne.slice(mot.length).trim();
        if (mot === 'title') { modele.titre = reste; return; }
        if (mot === 'section') { modele.items.push({ t: 'section', nom: reste }); return; }
        if (mot === 'accTitle' || mot === 'accDescr') return;
        const morceaux = ligne.split(':').map((x) => x.trim());
        if (ligne.startsWith(':')) {
            const derniere = modele.items[modele.items.length - 1];
            if (derniere?.t !== 'periode') throw new Error(`Ligne ${n + 2 + preambule.length} : événement sans période.`);
            derniere.evenements.push(...morceaux.slice(1).filter(Boolean));
        } else {
            modele.items.push({ t: 'periode', nom: morceaux[0], evenements: morceaux.slice(1).filter(Boolean) });
        }
    });
    return modele;
}

export function ecrire(modele) {
    const lignes = [...modele.preambule, modele.entete || 'timeline'];
    if (propre(modele.titre)) lignes.push(`    title ${propre(modele.titre)}`);
    for (const item of modele.items) {
        if (item.t === 'section') { lignes.push(`    section ${propre(item.nom) || 'Section'}`); continue; }
        const evenements = item.evenements.map(propre).filter(Boolean);
        const nom = nomSur(item.nom, 'Période');
        lignes.push(`    ${nom}${evenements.length ? ` : ${evenements[0]}` : ''}`);
        for (const e of evenements.slice(1)) lignes.push(`    ${' '.repeat(nom.length)} : ${e}`);
    }
    return lignes.join('\n') + '\n';
}

export function elements(modele) {
    return modele.items.flatMap((item, i) => (item.t === 'section'
        ? [{ cle: `i:${i}`, nom: `Section : ${item.nom}` }]
        : [{ cle: `i:${i}`, nom: item.nom }, ...item.evenements.map((e, k) => ({ cle: `e:${i}.${k}`, nom: `— ${e}` }))]));
}

export function reperer(svg, modele) {
    const periodes = modele.items.map((item, i) => [item, i]).filter(([item]) => item.t === 'periode');
    const noeudsPeriodes = [...svg.querySelectorAll('g.taskWrapper g.timeline-node')];
    const noeudsEvenements = [...svg.querySelectorAll('g.eventWrapper g.timeline-node')];
    if (noeudsPeriodes.length === periodes.length) noeudsPeriodes.forEach((g, n) => marquer(g, `i:${periodes[n][1]}`));
    const cles = periodes.flatMap(([item, i]) => item.evenements.map((_, k) => `e:${i}.${k}`));
    if (noeudsEvenements.length === cles.length) noeudsEvenements.forEach((g, n) => marquer(g, cles[n]));
}

function viser(modele, cle) {
    const [i, k] = cle.slice(2).split('.').map(Number);
    return { item: modele.items[i], i, k, evenement: cle.startsWith('e:') };
}

export function texte(modele, cle) {
    const v = viser(modele, cle);
    if (!v.item) return null;
    return v.evenement ? v.item.evenements[v.k] ?? null : v.item.nom;
}

export function renommer(modele, cle, valeur) {
    const v = viser(modele, cle);
    const t = propre(valeur);
    if (!v.item || !t) return;
    if (v.evenement) { if (v.k < v.item.evenements.length) v.item.evenements[v.k] = t; } else v.item.nom = t;
}

export function supprimer(modele, cle) {
    const v = viser(modele, cle);
    if (!v.item) return;
    if (v.evenement) v.item.evenements.splice(v.k, 1); else modele.items.splice(v.i, 1);
}

export const peutRelier = (cle) => cle.startsWith('i:') || cle.startsWith('e:');

// La poignée ajoute un événement à la période
export function relier(modele, de, vers) {
    if (vers) return null;
    const v = viser(modele, de);
    if (v.item?.t !== 'periode') return null;
    const k = v.evenement ? v.k + 1 : v.item.evenements.length;
    v.item.evenements.splice(k, 0, 'Nouvel événement');
    return `e:${v.i}.${k}`;
}

export function panneau(ctx) {
    const { modele, selection, appliquer, selectionner } = ctx;
    const v = selection ? viser(modele, selection) : null;
    const position = v?.item ? v.i + 1 : modele.items.length;
    const blocs = [h('div', { class: 'fusain-bloc' },
        h('h2', {}, 'Frise chronologique'),
        champTexte('Titre', modele.titre, (val) => appliquer((m) => { m.titre = propre(val); })),
        h('div', { class: 'fusain-actions' },
            bouton('Période', { icone: 'add-line', variante: 'secondary', onclick: () => appliquer((m) => { m.items.splice(position, 0, { t: 'periode', nom: 'Nouvelle période', evenements: ['Événement'] }); }, () => `i:${position}`) }),
            bouton('Section', { icone: 'add-line', onclick: () => appliquer((m) => { m.items.splice(position, 0, { t: 'section', nom: 'Nouvelle section' }); }, () => `i:${position}`) })),
        h('p', { class: 'fusain-aide' }, 'Les ajouts se placent après l\'élément sélectionné. Une section regroupe les périodes qui la suivent.'))];

    if (v?.item && v.evenement && v.k < v.item.evenements.length) {
        blocs.push(h('div', { class: 'fusain-bloc' },
            h('h2', {}, `Événement de « ${v.item.nom} »`),
            champTexte('Texte', v.item.evenements[v.k], (val) => appliquer((m) => renommer(m, selection, val)), { multiligne: true, id: 'fusain-champ-texte' }),
            actionsListe({
                monter: () => appliquer(() => {}, (m) => `e:${v.i}.${deplacer(m.items[v.i].evenements, v.k, -1)}`),
                descendre: () => appliquer(() => {}, (m) => `e:${v.i}.${deplacer(m.items[v.i].evenements, v.k, 1)}`),
                supprimer: () => appliquer((m) => supprimer(m, selection), () => `i:${v.i}`),
            })));
    } else if (v?.item) {
        blocs.push(h('div', { class: 'fusain-bloc' },
            h('h2', {}, v.item.t === 'section' ? 'Section sélectionnée' : 'Période sélectionnée'),
            champTexte('Nom', v.item.nom, (val) => appliquer((m) => renommer(m, selection, val)), { id: 'fusain-champ-texte' }),
            v.item.t === 'periode' ? h('div', { class: 'fusain-actions' }, bouton('Ajouter un événement', { icone: 'add-line', variante: 'secondary', onclick: () => {
                let cle;
                appliquer((m) => { cle = relier(m, selection, null); }, () => cle);
            } })) : null,
            actionsListe({
                monter: () => appliquer(() => {}, (m) => `i:${deplacer(m.items, v.i, -1)}`),
                descendre: () => appliquer(() => {}, (m) => `i:${deplacer(m.items, v.i, 1)}`),
                supprimer: () => appliquer((m) => supprimer(m, selection), () => null),
            })));
    }
    blocs.push(h('div', { class: 'fusain-bloc' }, h('h2', {}, 'Déroulé'), plan(elements(modele), selection, selectionner)));
    return blocs;
}

export default { type: 'timeline', nom: 'Frise chronologique', analyser, ecrire, elements, reperer, texte, renommer, supprimer, relier, peutRelier, panneau };
