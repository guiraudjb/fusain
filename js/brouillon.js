// Brouillon automatique local (IndexedDB) — une commodité, pas une sauvegarde
const BASE = 'fusain';
const MAGASIN = 'brouillon';
const CLE = 'courant';

function ouvrir() {
    return new Promise((resoudre, rejeter) => {
        const demande = indexedDB.open(BASE, 1);
        demande.onupgradeneeded = () => demande.result.createObjectStore(MAGASIN);
        demande.onsuccess = () => resoudre(demande.result);
        demande.onerror = () => rejeter(demande.error);
    });
}

async function transaction(mode, action) {
    const base = await ouvrir();
    try {
        return await new Promise((resoudre, rejeter) => {
            const tx = base.transaction(MAGASIN, mode);
            const demande = action(tx.objectStore(MAGASIN));
            tx.oncomplete = () => resoudre(demande.result);
            tx.onerror = () => rejeter(tx.error);
        });
    } finally {
        base.close();
    }
}

export async function enregistrerBrouillon(texte) {
    try { await transaction('readwrite', (m) => m.put(texte, CLE)); } catch { /* stockage indisponible : le brouillon est simplement absent */ }
}

export async function lireBrouillon() {
    try { return (await transaction('readonly', (m) => m.get(CLE))) || null; } catch { return null; }
}

export async function effacerBrouillon() {
    try { await transaction('readwrite', (m) => m.delete(CLE)); } catch { /* idem */ }
}

export async function effacerDonneesLocales() {
    await effacerBrouillon();
    try { localStorage.clear(); } catch { /* idem */ }
}
