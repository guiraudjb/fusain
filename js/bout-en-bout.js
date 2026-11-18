// Liaison de bout en bout : depuis la barre principale, choisir deux équipements des pages réseau du document ; le chemin
// qui les relie (commutateurs, routeurs, pare-feu traversés) est dessiné sur une nouvelle page, en traits animés de la
// couleur choisie, avec le nom du lien et les VLAN de chaque tronçon. Plusieurs liaisons peuvent figurer sur la même page.
import { h, bouton, champSelect, champCase, message, modale, ouvrirModale, fermerModale, idUnique } from './dom.js';
import { grapheReseau, cheminReseau, pageBoutEnBout, COULEURS_BOUT_EN_BOUT } from './reseau.js';

const COLLATEUR = new Intl.Collator('fr', { numeric: true, sensitivity: 'base' });
const ANIMATIONS = [['lente', 'Animé lent'], ['rapide', 'Animé rapide'], ['', 'Sans animation']];

export function ouvrirBoutEnBout(pages, ajouterPages) {
    const graphe = grapheReseau(pages);
    if (!graphe.equipements.size) {
        message('Aucune page réseau', 'Les liaisons de bout en bout se tracent sur les pages produites par les modèles réseau (import IMC, commutateurs et périphériques, data center).', 'info', 9000);
        return;
    }
    const noms = [...graphe.equipements.values()].map((e) => e.nom).sort(COLLATEUR.compare);
    const parNom = new Map(noms.map((n) => [n.toLowerCase(), n]));
    const avecVlans = [...graphe.aretes.values()].some((a) => a.vlans);
    const idListe = idUnique('equipements');
    const liste = h('datalist', { id: idListe }, noms.map((n) => h('option', { value: n })));
    const etat = { liaisons: [], vlans: avecVlans };
    const nouvelle = () => ({ a: '', b: '', couleur: COULEURS_BOUT_EN_BOUT[etat.liaisons.length % COULEURS_BOUT_EN_BOUT.length][0], animation: 'lente' });
    etat.liaisons.push(nouvelle());

    const zone = h('div', {});
    const creer = bouton('Créer la page', { variante: 'primary', taille: 'md', onclick: () => {
        const valides = etat.liaisons.filter((l) => parNom.has(l.a.toLowerCase()) && parNom.has(l.b.toLowerCase()) && cheminReseau(graphe, l.a, l.b));
        const r = pageBoutEnBout(graphe, valides.map((l) => ({ ...l, a: parNom.get(l.a.toLowerCase()), b: parNom.get(l.b.toLowerCase()) })), { vlans: etat.vlans });
        if (!r.code) return;
        fermerModale(dialogue);
        ajouterPages([{ nom: r.nom, code: r.code, format: r.equipements > 9 ? 'A3' : 'A4', orientation: 'paysage' }]);
        for (const t of r.alertes) message('Liaison de bout en bout', t, 'warning', 9000);
    } });

    // Bilan d'une liaison : le chemin trouvé, ou ce qui manque
    const bilan = (l) => {
        if (!l.a || !l.b) return ['Choisissez les deux équipements.', ''];
        const inconnu = [l.a, l.b].filter((n) => !parNom.has(n.toLowerCase()));
        if (inconnu.length) return [`Équipement inconnu sur les pages réseau : ${inconnu.join(', ')}.`, 'error'];
        const chemin = cheminReseau(graphe, l.a, l.b);
        if (!chemin) return [l.a.toLowerCase() === l.b.toLowerCase() ? 'Choisissez deux équipements différents.' : 'Aucun chemin entre ces deux équipements sur les pages réseau.', 'error'];
        const nomsChemin = chemin.map((k) => graphe.equipements.get(k).nom);
        return [`${chemin.length - 1} tronçon${chemin.length > 2 ? 's' : ''} : ${nomsChemin.join(' → ')}`, 'valid'];
    };

    function redessiner() {
        const lignes = etat.liaisons.map((l, i) => {
            const [texte, statut] = bilan(l);
            const entree = (cle, libelle) => {
                const id = idUnique('equipement');
                const champ = h('input', { class: 'fr-input', id, list: idListe, value: l[cle], autocomplete: 'off', placeholder: 'Nom de l\'équipement' });
                champ.addEventListener('change', () => { l[cle] = champ.value.trim(); redessiner(); });
                return h('div', { class: 'fusain-champ fr-col-12 fr-col-md-6' }, h('label', { class: 'fr-label', for: id }, libelle), champ);
            };
            return h('fieldset', { class: 'fr-fieldset fr-mb-2w fusain-bout-en-bout' },
                h('legend', { class: 'fr-fieldset__legend fr-text--md' }, `Liaison ${i + 1}`,
                    h('span', { class: 'fusain-bout-en-bout__pastille', style: `background:${l.couleur}`, 'aria-hidden': 'true' })),
                h('div', { class: 'fr-grid-row fr-grid-row--gutters fr-mb-1w' }, entree('a', 'De l\'équipement'), entree('b', 'À l\'équipement')),
                h('div', { class: 'fr-grid-row fr-grid-row--gutters fr-mb-1w' },
                    h('div', { class: 'fr-col-12 fr-col-md-5' }, champSelect('Couleur', COULEURS_BOUT_EN_BOUT, l.couleur, (v) => { l.couleur = v; redessiner(); })),
                    h('div', { class: 'fr-col-12 fr-col-md-5' }, champSelect('Trait', ANIMATIONS, l.animation, (v) => { l.animation = v; redessiner(); })),
                    etat.liaisons.length > 1 ? h('div', { class: 'fr-col-12 fr-col-md-2 fusain-bout-en-bout__retirer' },
                        bouton('Retirer', { icone: 'delete-bin-line', seulIcone: true, titre: `Retirer la liaison ${i + 1}`, onclick: () => { etat.liaisons.splice(i, 1); redessiner(); } })) : null),
                h('p', { class: `fr-message fr-message--${statut || 'info'} fr-text--sm fr-mb-0` }, texte));
        });
        const pretes = etat.liaisons.filter((l) => bilan(l)[1] === 'valid').length;
        creer.disabled = !pretes;
        creer.textContent = pretes > 1 ? `Créer la page (${pretes} liaisons)` : 'Créer la page';
        zone.replaceChildren(...lignes,
            bouton('Ajouter une liaison', { icone: 'add-line', variante: 'secondary', onclick: () => { etat.liaisons.push(nouvelle()); redessiner(); } }),
            avecVlans ? champCase('Écrire les VLAN propagés sur chaque tronçon', etat.vlans, (v) => { etat.vlans = v; }) : null);
    }

    const dialogue = modale('fusain-modale-bout-en-bout', 'Liaison de bout en bout', h('div', {},
        h('p', { class: 'fr-text--sm' }, `Choisissez deux équipements parmi les ${noms.length} des pages réseau du document (${graphe.pages} page${graphe.pages > 1 ? 's' : ''}) : le chemin qui les relie est dessiné sur une nouvelle page, après la page courante, en trait animé de la couleur choisie, avec le nom des liens et les VLAN. Plusieurs liaisons peuvent figurer sur la même page ; un tronçon commun est doublé, un trait par liaison.`),
        liste, zone), [creer]);
    redessiner();
    ouvrirModale(dialogue);
}
