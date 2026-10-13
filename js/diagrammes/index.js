// Registre des éditeurs visuels : un module par type de schéma
import logigramme from './logigramme.js';
import sequence from './sequence.js';
import mentale from './mentale.js';
import gantt from './gantt.js';
import camembert from './camembert.js';

const EDITEURS = new Map([logigramme, sequence, mentale, gantt, camembert].map((e) => [e.type, e]));

export function editeurPour(type) {
    return EDITEURS.get(type) || null;
}

export const TYPES_VISUELS = [...EDITEURS.keys()];
