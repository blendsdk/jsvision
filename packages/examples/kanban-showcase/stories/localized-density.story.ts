import type { KanbanPresentationInput } from '@jsvision/kanban';
import { Text, col, fixed, grow } from '@jsvision/ui';

import type { KanbanStory } from '../story.js';
import { createShowcaseBoard } from '../work-items.js';

/** Tall presentation budget that exposes bounded degradation and scrolling with dense card data. */
const DENSE_PRESENTATION: KanbanPresentationInput = Object.freeze({
  revision: 'showcase-localized-density-v1',
  cardRows: 18,
  cardGap: 1,
  metadataFields: 3,
  labelRows: 3,
  summarySections: 2,
  checklistMode: 'preview',
  checklistPreviewItems: 5,
});

/** Dense Dutch and German cards for inspecting wrapping, ellipsis, omission, and vertical scrolling. */
export const LOCALIZED_DENSITY_STORY: KanbanStory = {
  id: 'kanban/localized-density',
  category: 'Content',
  title: 'Dense localized cards',
  blurb: 'Long Dutch and German values stress labels, summaries, checklist previews, clipping, and scrolling.',
  build: () => {
    const { board, activity } = createShowcaseBoard({
      presentation: DENSE_PRESENTATION,
      headerAlignment: 'center',
      initialActivity: 'Scroll vertically to inspect bounded detail · resize to watch optional sections degrade',
      cards: [
        {
          key: 401,
          columnId: 'backlog',
          presentationRevision: 'nl-dense-v1',
          title: 'Klantgegevensmigratie voor de internationale rapportageomgeving voorbereiden',
          status: 'Wordt uitgevoerd',
          priority: 'Zeer hoge prioriteit',
          estimate: 'Dertien punten',
          labels: [
            { id: 'gegevensmigratie', label: 'Gegevensmigratie' },
            { id: 'toegankelijkheid', label: 'Toegankelijkheid' },
            { id: 'beveiligingscontrole', label: 'Beveiligingscontrole' },
            { id: 'klantcommunicatie', label: 'Klantcommunicatie' },
            { id: 'compatibiliteit', label: 'Achterwaartse compatibiliteit' },
            { id: 'documentatie', label: 'Gebruikersdocumentatie' },
          ],
          summaries: [
            { fieldId: 'progress', label: 'Taken', value: '5 van 11 afgerond' },
            { fieldId: 'risks', label: "Risico's", value: '2 openstaande aandachtspunten' },
          ],
          checklists: [
            {
              checklistId: 'voorbereiding',
              title: 'Voorbereiding',
              items: [
                { itemId: 'inventariseren', text: 'Alle bestaande gegevensbronnen inventariseren', completed: true },
                { itemId: 'eigenaars', text: 'Verantwoordelijke gegevenseigenaren bevestigen', completed: true },
                { itemId: 'bewaartermijnen', text: 'Wettelijke bewaartermijnen controleren', completed: false },
                { itemId: 'proefmigratie', text: 'Een volledige proefmigratie uitvoeren', completed: false },
                { itemId: 'afwijkingen', text: 'Afwijkingen documenteren en opnieuw beoordelen', completed: false },
              ],
            },
            {
              checklistId: 'acceptatie',
              title: 'Acceptatiecontrole',
              items: [
                {
                  itemId: 'steekproef',
                  text: 'Resultaten met een representatieve steekproef vergelijken',
                  completed: true,
                },
                { itemId: 'autorisatie', text: 'Autorisatiematrix met beveiliging laten goedkeuren', completed: false },
                { itemId: 'handleiding', text: 'Nederlandstalige gebruikershandleiding bijwerken', completed: false },
                {
                  itemId: 'herstelplan',
                  text: 'Herstelprocedure tijdens het onderhoudsvenster oefenen',
                  completed: false,
                },
                {
                  itemId: 'ondertekening',
                  text: 'Definitieve acceptatie door de opdrachtgever vastleggen',
                  completed: false,
                },
                { itemId: 'nazorg', text: 'Nazorgmoment met het ondersteuningsteam plannen', completed: false },
              ],
            },
          ],
        },
        {
          key: 402,
          columnId: 'active',
          presentationRevision: 'de-dense-v1',
          title: 'Berechtigungskonzept für die unternehmensweite Datenplattform überprüfen',
          status: 'Wartet auf Freigabe',
          priority: 'Hohe Priorität',
          estimate: 'Acht Punkte',
          labels: [
            { id: 'datenschutz', label: 'Datenschutzprüfung' },
            { id: 'berechtigungen', label: 'Berechtigungsverwaltung' },
            { id: 'nachvollziehbarkeit', label: 'Änderungsnachvollziehbarkeit' },
            { id: 'betriebsrat', label: 'Betriebsratsabstimmung' },
            { id: 'produktionsfreigabe', label: 'Produktionsfreigabe' },
          ],
          summaries: [
            { fieldId: 'progress', label: 'Aufgaben', value: '3 von 8 abgeschlossen' },
            { fieldId: 'risks', label: 'Risiken', value: '1 Entscheidung ausstehend' },
          ],
          checklists: [
            {
              checklistId: 'freigabe',
              title: 'Freigabeschritte',
              items: [
                { itemId: 'rollen', text: 'Rollen und Verantwortlichkeiten vollständig zuordnen', completed: true },
                { itemId: 'sonderrechte', text: 'Zeitlich begrenzte Sonderberechtigungen überprüfen', completed: true },
                {
                  itemId: 'protokollierung',
                  text: 'Protokollierung sicherheitsrelevanter Änderungen testen',
                  completed: true,
                },
                {
                  itemId: 'datenschutzbeauftragte',
                  text: 'Datenschutzbeauftragte abschließend beteiligen',
                  completed: false,
                },
                { itemId: 'betriebsrat', text: 'Rückmeldung des Betriebsrats dokumentieren', completed: false },
                {
                  itemId: 'wiederherstellung',
                  text: 'Wiederherstellungsverfahren gemeinsam erproben',
                  completed: false,
                },
                { itemId: 'freigabe', text: 'Produktionsfreigabe schriftlich bestätigen lassen', completed: false },
                { itemId: 'kommunikation', text: 'Betroffene Fachbereiche rechtzeitig informieren', completed: false },
              ],
            },
          ],
        },
      ],
    });
    const view = col(
      { padding: { left: 1, right: 1, top: 0, bottom: 0 }, gap: 1 },
      fixed(
        new Text('Dense content is bounded: resize and scroll to inspect wrapping, ellipsis, and omitted tasks.'),
        2,
      ),
      grow(board),
      fixed(new Text(() => `Activity: ${activity()}`), 2),
    );
    return { view, board, activity };
  },
};
