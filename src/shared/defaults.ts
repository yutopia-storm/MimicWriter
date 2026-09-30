import type { AppState, OwnerConfig, UserPreferences } from './models';

export const DEFAULT_OWNER_CONFIG: OwnerConfig = {
  schemaVersion: 1,
  brand: {
    productName: 'MimicWriter', shortName: 'MW', developerName: 'Independent Story Tools',
    tagline: 'Write with clarity. Keep creative control.',
    description: 'A local-first workspace for developing screen stories with confidence.',
    accentColor: '#d6a85f'
  },
  terminology: { project: 'Project', projects: 'Projects', series: 'Series', episode: 'Episode', collection: 'Collection', project_brain: 'Project Brain', plot: 'Plot', story_timeline: 'Story Timeline' },
  featureFlags: { project_creation: true, series_projects: true },
  defaults: { projectType: 'feature' }
};

export const DEFAULT_PREFERENCES: UserPreferences = { schemaVersion: 1, theme: 'dark', compactLibrary: false, spellingLanguage: 'en-GB' };
export const DEFAULT_APP_STATE: AppState = { schemaVersion: 1, storageRoot: null, setupCompleted: false };
