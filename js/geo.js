// Données et bibliothèques des diapositives de carte. D3 et le client TopoJSON ne sont chargés qu'à la première carte ;
// les fonds (cartes/, produits par outils/cartes.py) sont lus avec l'empreinte que donne cartes/index.json, lui-même
// contrôlé par index.html : un fichier altéré est refusé par le navigateur.

const DOSSIER = './cartes/';

function chargerScript(id) {
    return new Promise((resolve, reject) => {
        const source = document.getElementById(id);
        const script = document.createElement('script');
        script.integrity = source.getAttribute('integrity') || '';
        script.onload = resolve;
        script.onerror = () => reject(new Error('La bibliothèque cartographique n\'a pas pu être chargée.'));
        script.src = source.getAttribute('href');
        document.head.append(script);
    });
}

let bibliotheques = null;
export function chargerBibliotheques() {
    bibliotheques ||= Promise.all([chargerScript('fusain-d3'), chargerScript('fusain-topojson')]).catch((e) => { bibliotheques = null; throw e; });
    return bibliotheques;
}

let index = null;
function lireIndex() {
    index ||= (async () => {
        const source = document.getElementById('fusain-cartes');
        const reponse = await fetch(source.getAttribute('href'), { integrity: source.getAttribute('integrity') || undefined });
        if (!reponse.ok) throw new Error('Le catalogue des fonds de carte n\'a pas pu être lu.');
        return reponse.json();
    })().catch((e) => { index = null; throw e; });
    return index;
}

const lus = new Map();
// Un fichier des fonds de carte, par son nom dans l'index (« monde », « communes/84 », « calques/relief »…)
export function lireDonnees(nom, nature = 'json') {
    if (!lus.has(nom)) {
        lus.set(nom, (async () => {
            const entree = (await lireIndex())[nom];
            if (!entree) throw new Error(`Fond de carte inconnu : ${nom}.`);
            const reponse = await fetch(DOSSIER + entree.fichier, { integrity: entree.integrite });
            if (!reponse.ok) throw new Error(`Le fond de carte « ${nom} » n'a pas pu être chargé${navigator.onLine ? '' : ' : il n\'est pas encore disponible hors ligne'}.`);
            return nature === 'blob' ? reponse.blob() : reponse.json();
        })().catch((e) => { lus.delete(nom); throw e; }));
    }
    return lus.get(nom);
}

export const estCharge = (nom) => lus.has(nom);

// Référentiels lus d'avance pour les listes du panneau : régions du monde, EPCI, région de chaque département
export const referentiels = { regionsDuMonde: [], epci: [], regionDuDepartement: new Map(), communes: new Map() };
let refs = null;
export function chargerReferentiels() {
    refs ||= Promise.all([lireDonnees('regions-du-monde'), lireDonnees('epci'), lireDonnees('departements')]).then(([regions, epci, deps]) => {
        referentiels.regionsDuMonde = regions;
        referentiels.epci = epci;
        for (const g of deps.objects.departements.geometries) referentiels.regionDuDepartement.set(g.properties.code_insee, g.properties.code_insee_de_la_region);
    }).catch((e) => { refs = null; throw e; });
    return refs;
}

// Communes d'une région ; la liste des noms par département est tenue à jour pour le panneau
const regionsListees = new Set();
export async function lireCommunes(region) {
    const topo = await lireDonnees(`communes/${region}`);
    if (regionsListees.has(region)) return topo;
    regionsListees.add(region);
    for (const g of topo.objects.communes.geometries) {
        const p = g.properties;
        if (!referentiels.communes.has(p.code_insee_du_departement)) referentiels.communes.set(p.code_insee_du_departement, []);
        referentiels.communes.get(p.code_insee_du_departement).push([p.code_insee, p.nom_officiel]);
    }
    for (const liste of referentiels.communes.values()) liste.sort((a, b) => a[1].localeCompare(b[1], 'fr'));
    return topo;
}

// Noms des territoires dessinés, pour le panneau et la liste des éléments
export const nomsDesZones = new Map();

// Projection et territoires de chaque carte rendue (par son code) : une épingle glissée est ramenée en longitude et
// latitude, un import de données ne garde que les territoires représentés
const cartes = new Map();
export function retenirCarte(code, carte) {
    cartes.delete(code);
    cartes.set(code, carte);
    if (cartes.size > 30) cartes.delete(cartes.keys().next().value);
}
export const inverserPosition = (code, x, y) => cartes.get(code)?.inverser(x, y) ?? null;
export const territoiresRepresentes = (code) => cartes.get(code)?.codes ?? null;

// ---------- Adresses (Base Adresse Nationale, outils/adresses.py) ----------

// Départements dont les adresses sont disponibles, d'après le catalogue des fonds
export async function departementsAdresses() {
    return Object.keys(await lireIndex()).filter((n) => n.startsWith('adresses/')).map((n) => n.slice(9));
}

// Communes d'un département : [code INSEE, nom, empreinte du fichier de ses adresses]
export const communesAdresses = (dep) => lireDonnees(`adresses/${dep}`);

// Adresses d'une commune, regroupées par voie : [[voie, [[numéro, longitude, latitude]…]]…]. Le fichier est lu avec
// l'empreinte que donne l'index du département, lui-même vérifié : le service worker le garde ensuite hors ligne.
export async function adressesCommune(dep, code) {
    const commune = (await communesAdresses(dep)).find(([c]) => c === code);
    if (!commune) throw new Error(`Aucune adresse connue pour la commune ${code}.`);
    const reponse = await fetch(`${DOSSIER}adresses/${dep}/${code}.json`, { integrity: commune[2] });
    if (!reponse.ok) throw new Error(`Les adresses de ${commune[1]} n'ont pas pu être chargées${navigator.onLine ? '' : ' : elles ne sont pas encore disponibles hors ligne'}.`);
    const { o, v } = await reponse.json();
    let [lon, lat] = o;
    return v.map(([voie, numeros, ecarts]) => [voie, numeros.map((n, i) => {
        lon += ecarts[2 * i];
        lat += ecarts[2 * i + 1];
        return [n, lon / 1e5, lat / 1e5];
    })]);
}
