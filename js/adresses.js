// Adresses IPv4 et clés des alias (import du routage) : sans dépendance, lu aussi par fichier.js (champ « alias »)
export const ALIAS_MAX = 20000;
export const ALIAS_NOM_MAX = 120;

const RE_IP = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
export function ipEnNombre(t) {
    const m = RE_IP.exec(String(t ?? '').trim());
    if (!m) return null;
    const o = m.slice(1).map(Number);
    if (o.some((x) => x > 255)) return null;
    return ((o[0] << 24) >>> 0) + (o[1] << 16) + (o[2] << 8) + o[3];
}
export const nombreEnIp = (n) => [24, 16, 8, 0].map((d) => (n >>> d) & 255).join('.');
const masqueDeLongueur = (l) => (l === 0 ? 0 : (0xffffffff << (32 - l)) >>> 0);

// Masque pointé (255.255.254.0) ou longueur (23) → longueur, ou null s'il n'est pas contigu ou illisible
export function longueurMasque(t) {
    const s = String(t ?? '').trim().replace(/^\//, '');
    if (/^\d{1,2}$/.test(s)) return Number(s) <= 32 ? Number(s) : null;
    const n = ipEnNombre(s);
    if (n === null) return null;
    for (let l = 0; l <= 32; l += 1) if (masqueDeLongueur(l) === n) return l;
    return null;
}

// « 10.10.20.0/23 », « 10.10.20.0 255.255.254.0 », « 10.10.20.0 23 » → { reseau, longueur, cidr, corrige }
// corrige : des bits d'hôte étaient allumés (10.10.20.5/23 → 10.10.20.0/23)
export function lireReseau(adresse, masque) {
    const n = ipEnNombre(adresse);
    const longueur = longueurMasque(masque);
    if (n === null || longueur === null) return null;
    const net = (n & masqueDeLongueur(longueur)) >>> 0;
    const reseau = nombreEnIp(net);
    return { reseau, longueur, cidr: `${reseau}/${longueur}`, corrige: net !== n };
}

// Clé d'un alias : une IP (prochain saut) ou un sous-réseau, normalisé en CIDR ; null si la clé n'est ni l'un ni l'autre
export function cleAlias(brut) {
    const t = String(brut ?? '').trim().replace(/\s+/g, ' ');
    if (ipEnNombre(t) !== null) return nombreEnIp(ipEnNombre(t));
    const m = t.match(/^(\S+)\s*(?:\/\s*|\s)(\S+)$/);
    if (!m) return null;
    const r = lireReseau(m[1], m[2]);
    return r ? r.cidr : null;
}
