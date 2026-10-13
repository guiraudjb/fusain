// Icônes du DSFR pour les schémas d'architecture : un seul fichier de tracés (outils/icones.py), chargé à la demande.
// Dans le code Mermaid, une icône s'écrit « dsfr:nom », par exemple service bdd(dsfr:database-2-line)[Base].
import { h, s, modale, ouvrirModale, fermerModale } from './dom.js';
import { PREFIXE_ILLUS, chargerIndex, chargerTheme } from './illustrations.js';

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

const sansAccent = (texte) => texte.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Fenêtre de choix, pour les deux jeux : icônes du DSFR (au trait, noms en anglais) et icônes illustrées (en couleur,
// noms en français). Recherche par nom et par catégorie.
export async function choisirIcone(actuelle, surChoix) {
    const illustree = String(actuelle).startsWith(`${PREFIXE_ILLUS}:`);
    const grille = h('div', { class: 'fusain-icones', role: 'group', 'aria-label': 'Icônes' });
    const compte = h('p', { class: 'fusain-aide', 'aria-live': 'polite' });
    const recherche = h('input', { class: 'fr-input', type: 'search', id: 'fusain-icones-recherche' });
    const jeu = h('select', { class: 'fr-select', id: 'fusain-icones-jeu' },
        h('option', { value: PREFIXE, selected: !illustree }, 'Icônes du DSFR (au trait)'),
        h('option', { value: PREFIXE_ILLUS, selected: illustree }, 'Icônes illustrées (en couleur)'));
    const categorie = h('select', { class: 'fr-select', id: 'fusain-icones-categorie' });
    let dialogue;
    let tour = 0;
    const choisir = (nom) => () => { fermerModale(dialogue); surChoix(nom); };
    const bouton = (nom, titre, contenu) => h('button', { type: 'button', class: 'fusain-icone', title: titre, 'aria-label': titre, 'aria-pressed': String(nom === actuelle), onclick: choisir(nom) }, contenu);

    const remplirCategories = async () => {
        const options = jeu.value === PREFIXE
            ? [['', 'Toutes les catégories'], ...Object.entries(CATEGORIES)]
            : (await chargerIndex()).themes.map((t) => [t.id, t.nom]);
        categorie.replaceChildren(...options.map(([id, nom]) => h('option', { value: id }, nom)));
        recherche.placeholder = jeu.value === PREFIXE ? 'database, user, mail, cloud…' : 'serveur, routeur, tribunal, réunion…';
    };

    const afficher = async () => {
        const moi = ++tour;
        const mots = sansAccent(recherche.value).split(/\s+/).filter(Boolean);
        let boutons;
        if (jeu.value === PREFIXE) {
            const trouvees = (await chargerIcones()).filter((i) => (!categorie.value || i.categorie === categorie.value) && mots.every((m) => i.nom.includes(m)));
            boutons = trouvees.map((i) => bouton(`${PREFIXE}:${i.nom}`, i.nom, s('svg', { viewBox: '0 0 24 24', width: 24, height: 24, 'aria-hidden': 'true' }, s('path', { d: i.trace, fill: 'currentColor' }))));
        } else {
            // Sans recherche, seul le thème choisi est affiché ; une recherche porte sur tous les thèmes
            const { parIcone } = await chargerIndex();
            const trouvees = [...parIcone.values()].filter((i) => (mots.length ? mots.every((m) => sansAccent(`${i.nom} ${i.nomTheme}`).includes(m) || i.id.includes(m)) : i.theme === categorie.value));
            const images = new Map(await Promise.all([...new Set(trouvees.map((i) => i.theme))].map(async (theme) => [theme, await chargerTheme(theme)])));
            boutons = trouvees.map((i) => bouton(`${PREFIXE_ILLUS}:${i.id}`, i.nom, h('img', { src: `data:image/png;base64,${images.get(i.theme)[i.id]}`, width: 40, height: 40, alt: '' })));
        }
        if (moi !== tour) return;
        compte.textContent = `${boutons.length} icône${boutons.length > 1 ? 's' : ''}`;
        grille.classList.toggle('fusain-icones--images', jeu.value !== PREFIXE);
        grille.replaceChildren(...boutons);
    };
    const signaler = (e) => { compte.textContent = e.message; grille.replaceChildren(); };
    recherche.addEventListener('input', () => afficher().catch(signaler));
    categorie.addEventListener('change', () => afficher().catch(signaler));
    jeu.addEventListener('change', () => remplirCategories().then(afficher).catch(signaler));

    const champ = (libelle, controle) => h('div', { class: 'fr-select-group fusain-champ' }, h('label', { class: 'fr-label', for: controle.id }, libelle), controle);
    dialogue = modale('fusain-modale-icones', 'Choisir une icône', h('div', {},
        h('div', { class: 'fusain-ligne' }, champ('Jeu d\'icônes', jeu), champ('Catégorie', categorie)),
        champ('Rechercher par nom', recherche),
        compte, grille));
    await remplirCategories();
    if (illustree) { const { parIcone } = await chargerIndex(); categorie.value = parIcone.get(String(actuelle).slice(PREFIXE_ILLUS.length + 1))?.theme || categorie.value; }
    await afficher();
    ouvrirModale(dialogue);
    recherche.focus();
}
