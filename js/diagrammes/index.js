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
import parcours from './parcours.js';
import graphique from './graphique.js';
import flux from './flux.js';
import entites from './entites.js';
import classes from './classes.js';
import architecture from './architecture.js';
import versions from './versions.js';
import paquet from './paquet.js';

const EDITEURS = new Map([logigramme, sequence, mentale, gantt, camembert, frise, kanban, quadrant, etats, parcours, graphique, flux, entites, classes, architecture, versions, paquet].map((e) => [e.type, e]));

export function editeurPour(type) {
    return EDITEURS.get(type) || null;
}

export const TYPES_VISUELS = [...EDITEURS.keys()];
