import { describe, expect, it } from 'vitest';
import { DEFAULT_OWNER_CONFIG } from './defaults';

describe('central product configuration', () => {
  it('keeps branding, terminology, feature flags, and defaults in one owner scope', () => {
    expect(DEFAULT_OWNER_CONFIG.brand.productName).toBeTruthy();
    expect(DEFAULT_OWNER_CONFIG.terminology.project_brain).toBe('Project Brain');
    expect(DEFAULT_OWNER_CONFIG.featureFlags).toHaveProperty('project_creation');
    expect(DEFAULT_OWNER_CONFIG.defaults.projectType).toBe('feature');
  });
});
