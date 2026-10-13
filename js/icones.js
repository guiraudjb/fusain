// Icônes du DSFR pour les schémas d'architecture : un seul fichier de tracés (outils/icones.py), chargé à la demande.
// Dans le code Mermaid, une icône s'écrit « dsfr:nom », par exemple service bdd(dsfr:database-2-line)[Base].
import { h, s, modale, ouvrirModale, fermerModale } from './dom.js';

export const PREFIXE = 'dsfr';
const CATEGORIES = { arrows: 'Flèches', buildings: 'Bâtiments', business: 'Bureau et affaires', communication: 'Communication', design: 'Création', development: 'Développement', device: 'Appareils', document: 'Documents', editor: 'Édition', finance: 'Finance', health: 'Santé', logo: 'Logos', map: 'Cartes et lieux', media: 'Médias', others: 'Divers', system: 'Système', user: 'Personnes', weather: 'Météo' };
// Un tracé ne contient que des commandes et des nombres : tout autre contenu est écarté
const TRACE = /^[MmLlHhVvCcSsQqTtAaZz0-9eE\s,.+-]+$/;

let jeu = null;
export function chargerIcones() {
    jeu ||= (async () => {
        const source = document.getElementById('fusain-icones');
        // L'adresse et l'empreinte viennent de index.html : le navigateur refuse un fichier altéré
        const reponse = await fetch(source.getAttribute('href'), { integrity: source.getAttribute('integrity') || undefined });
        if (!reponse.ok) throw new Error('Les icônes du DSFR n\'ont pas pu être chargées.');
        const { categories } = await reponse.json();
        const liste = [];
        for (const [categorie, icones] of Object.entries(categories)) {
            for (const [nom, trace] of Object.entries(icones)) if (/^[a-z0-9-]+$/.test(nom) && TRACE.test(trace)) liste.push({ nom, trace, categorie });
        }
        return liste;
    })().catch((e) => { jeu = null; throw e; });
    return jeu;
}

// Jeu au format attendu par Mermaid. Chaque icône est dessinée comme celles de Mermaid : en blanc sur un carré bleu de 80 px.
export async function jeuPourMermaid() {
    const icons = {};
    for (const { nom, trace } of await chargerIcones()) icons[nom] = { body: `<rect width="80" height="80" fill="#087ebf"/><path transform="translate(16 16) scale(2)" fill="#ffffff" d="${trace}"/>` };
    return { prefix: PREFIXE, width: 80, height: 80, icons };
}

// Fenêtre de choix : recherche par nom (les noms du DSFR sont en anglais) et par catégorie
export async function choisirIcone(actuelle, surChoix) {
    const icones = await chargerIcones();
    const grille = h('div', { class: 'fusain-icones', role: 'group', 'aria-label': 'Icônes' });
    const compte = h('p', { class: 'fusain-aide', 'aria-live': 'polite' });
    const recherche = h('input', { class: 'fr-input', type: 'search', id: 'fusain-icones-recherche', placeholder: 'database, user, mail, cloud…' });
    const categorie = h('select', { class: 'fr-select', id: 'fusain-icones-categorie' }, h('option', { value: '' }, 'Toutes les catégories'), Object.entries(CATEGORIES).map(([id, nom]) => h('option', { value: id }, nom)));
    let dialogue;
    const afficher = () => {
        const mots = recherche.value.toLowerCase().split(/\s+/).filter(Boolean);
        const trouvees = icones.filter((i) => (!categorie.value || i.categorie === categorie.value) && mots.every((m) => i.nom.includes(m)));
        compte.textContent = `${trouvees.length} icône${trouvees.length > 1 ? 's' : ''}`;
        grille.replaceChildren(...trouvees.map((i) => h('button', { type: 'button', class: 'fusain-icone', title: i.nom, 'aria-label': i.nom, 'aria-pressed': String(`${PREFIXE}:${i.nom}` === actuelle), onclick: () => { fermerModale(dialogue); surChoix(`${PREFIXE}:${i.nom}`); } },
            s('svg', { viewBox: '0 0 24 24', width: 24, height: 24, 'aria-hidden': 'true' }, s('path', { d: i.trace, fill: 'currentColor' })))));
    };
    recherche.addEventListener('input', afficher);
    categorie.addEventListener('change', afficher);
    dialogue = modale('fusain-modale-icones', 'Icônes du DSFR', h('div', {},
        h('div', { class: 'fusain-ligne' },
            h('div', { class: 'fr-input-group fusain-champ' }, h('label', { class: 'fr-label', for: 'fusain-icones-recherche' }, 'Rechercher (noms en anglais)'), recherche),
            h('div', { class: 'fr-select-group fusain-champ' }, h('label', { class: 'fr-label', for: 'fusain-icones-categorie' }, 'Catégorie'), categorie)),
        compte, grille));
    afficher();
    ouvrirModale(dialogue);
    recherche.focus();
}
