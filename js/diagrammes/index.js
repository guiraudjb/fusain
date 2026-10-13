// Registre des éditeurs visuels : un module par type de schéma
import logigramme from './logigramme.js';
import sequence from './sequence.js';
import mentale from './mentale.js';
import gantt from './gantt.js';
import camembert from './camembert.js';
import frise from './frise.js';
import kanban from './kanban.js';
import quadrant from './quadrant.js';
import etats from './etats.js';

const EDITEURS = new Map([logigramme, sequence, mentale, gantt, camembert, frise, kanban, quadrant, etats].map((e) => [e.type, e]));

export function editeurPour(type) {
    return EDITEURS.get(type) || null;
}

export const TYPES_VISUELS = [...EDITEURS.keys()];
