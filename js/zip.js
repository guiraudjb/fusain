// Archives ZIP, sans bibliothèque : lecture (classeurs .xlsx) et écriture (documents Visio .vsdx).
// La compression et la décompression sont celles du navigateur (deflate-raw).

const TABLE_CRC = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
        let c = n;
        for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c >>> 0;
    }
    return t;
})();

export function crc32(octets) {
    let c = 0xffffffff;
    for (let i = 0; i < octets.length; i += 1) c = TABLE_CRC[(c ^ octets[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}

async function transformer(octets, flux) {
    return new Uint8Array(await new Response(new Blob([octets]).stream().pipeThrough(flux)).arrayBuffer());
}

// Lecture : rend une fonction qui donne le contenu (octets) d'un fichier de l'archive, ou null s'il n'y est pas
export async function lireZip(octets, { tailleMax = Infinity } = {}) {
    const vue = new DataView(octets.buffer, octets.byteOffset, octets.byteLength);
    let fin = -1;
    for (let i = octets.length - 22; i >= Math.max(0, octets.length - 65558); i -= 1) if (vue.getUint32(i, true) === 0x06054b50) { fin = i; break; }
    if (fin < 0) throw new Error('L\'archive est endommagée.');
    const nombre = vue.getUint16(fin + 10, true);
    let p = vue.getUint32(fin + 16, true);
    const entrees = new Map();
    for (let n = 0; n < nombre && p + 46 <= octets.length; n += 1) {
        if (vue.getUint32(p, true) !== 0x02014b50) break;
        const methode = vue.getUint16(p + 10, true);
        const taille = vue.getUint32(p + 20, true);
        const longNom = vue.getUint16(p + 28, true);
        const total = 46 + longNom + vue.getUint16(p + 30, true) + vue.getUint16(p + 32, true);
        const local = vue.getUint32(p + 42, true);
        entrees.set(new TextDecoder().decode(octets.subarray(p + 46, p + 46 + longNom)), { methode, taille, local });
        p += total;
    }
    return async (nom) => {
        const e = entrees.get(nom);
        if (!e) return null;
        const debut = e.local + 30 + vue.getUint16(e.local + 26, true) + vue.getUint16(e.local + 28, true);
        const donnees = octets.subarray(debut, debut + e.taille);
        if (e.methode === 0) return donnees;
        if (e.methode !== 8) throw new Error('L\'archive utilise une compression non prise en charge.');
        const brut = await transformer(donnees, new DecompressionStream('deflate-raw'));
        if (brut.length > tailleMax) throw new Error('Le contenu de l\'archive est trop volumineux.');
        return brut;
    };
}

// Écriture : [{ nom, donnees (texte ou octets) }] → octets de l'archive. Noms en UTF-8 ; chaque fichier est
// compressé s'il y gagne, sinon stocké tel quel.
export async function ecrireZip(fichiers, date = new Date()) {
    const encodeur = new TextEncoder();
    const heure = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
    const jour = ((Math.max(1980, date.getFullYear()) - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
    const morceaux = [];
    const central = [];
    let position = 0;
    for (const { nom, donnees } of fichiers) {
        const brut = typeof donnees === 'string' ? encodeur.encode(donnees) : donnees;
        const nomOctets = encodeur.encode(nom);
        const crc = crc32(brut);
        let contenu = brut;
        let methode = 0;
        if (typeof CompressionStream !== 'undefined' && brut.length > 64) {
            const compresse = await transformer(brut, new CompressionStream('deflate-raw'));
            if (compresse.length < brut.length) { contenu = compresse; methode = 8; }
        }
        const local = new Uint8Array(30 + nomOctets.length);
        const l = new DataView(local.buffer);
        l.setUint32(0, 0x04034b50, true);
        l.setUint16(4, 20, true);
        l.setUint16(6, 0x0800, true); // noms en UTF-8
        l.setUint16(8, methode, true);
        l.setUint16(10, heure, true);
        l.setUint16(12, jour, true);
        l.setUint32(14, crc, true);
        l.setUint32(18, contenu.length, true);
        l.setUint32(22, brut.length, true);
        l.setUint16(26, nomOctets.length, true);
        local.set(nomOctets, 30);
        const entree = new Uint8Array(46 + nomOctets.length);
        const c = new DataView(entree.buffer);
        c.setUint32(0, 0x02014b50, true);
        c.setUint16(4, 20, true);
        c.setUint16(6, 20, true);
        c.setUint16(8, 0x0800, true);
        c.setUint16(10, methode, true);
        c.setUint16(12, heure, true);
        c.setUint16(14, jour, true);
        c.setUint32(16, crc, true);
        c.setUint32(20, contenu.length, true);
        c.setUint32(24, brut.length, true);
        c.setUint16(28, nomOctets.length, true);
        c.setUint32(42, position, true);
        entree.set(nomOctets, 46);
        morceaux.push(local, contenu);
        central.push(entree);
        position += local.length + contenu.length;
    }
    const tailleCentral = central.reduce((n, e) => n + e.length, 0);
    const fin = new Uint8Array(22);
    const f = new DataView(fin.buffer);
    f.setUint32(0, 0x06054b50, true);
    f.setUint16(8, fichiers.length, true);
    f.setUint16(10, fichiers.length, true);
    f.setUint32(12, tailleCentral, true);
    f.setUint32(16, position, true);
    const tout = new Uint8Array(position + tailleCentral + 22);
    let k = 0;
    for (const m of [...morceaux, ...central, fin]) { tout.set(m, k); k += m.length; }
    return tout;
}
