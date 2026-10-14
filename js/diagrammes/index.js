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
import exigences from './exigences.js';
import c4 from './c4.js';
import blocs from './blocs.js';
import radar from './radar.js';
import treemap from './treemap.js';
import zenuml from './zenuml.js';
import diapo from './diapo.js';
import carte from './carte.js';

// Un éditeur peut couvrir plusieurs types voisins (les trois niveaux d'un diagramme C4)
const EDITEURS = new Map([logigramme, sequence, mentale, gantt, camembert, frise, kanban, quadrant, etats, parcours, graphique, flux, entites, classes, architecture, versions, paquet, exigences, c4, blocs, radar, treemap, zenuml, diapo, carte]
    .flatMap((e) => (e.types || [e.type]).map((type) => [type, e])));

export function editeurPour(type) {
    return EDITEURS.get(type) || null;
}

export const TYPES_VISUELS = [...EDITEURS.keys()];
