import { describe, it, expect } from 'vitest';
import {
  buildTenantManifest,
  getTenantManifestBySlug,
  getTenantManifestById,
} from './tenant-manifest.js';

const BASE_ROW = {
  id: 'wsp_test001',
  tenant_slug: 'test-tenant',
  display_name: 'Test Tenant',
  branding: null,
  features: null,
  updated_at: '2026-01-01 00:00:00',
};

function makeDb(row: unknown = null) {
  return {
    prepare(sql: string) {
      return {
        bind: (..._args: unknown[]) => ({
          run: async () => ({ success: true }),
          first: async <T>(): Promise<T | null> => row as T | null,
          all: async <T>() => ({ results: row ? [row as T] : [] }),
        }),
        run: async () => ({ success: true }),
        first: async <T>(): Promise<T | null> => row as T | null,
        all: async <T>() => ({ results: row ? [row as T] : [] }),
      };
    },
  };
}

describe('buildTenantManifest', () => {
  it('builds manifest with default branding when branding is null', () => {
    const manifest = buildTenantManifest(BASE_ROW);

    expect(manifest.tenantId).toBe('wsp_test001');
    expect(manifest.tenantSlug).toBe('test-tenant');
    expect(manifest.displayName).toBe('Test Tenant');
    expect(manifest.branding.primaryColour).toBe('#1a1a2e');
    expect(manifest.branding.secondaryColour).toBe('#e94560');
    expect(manifest.features.discoveryEnabled).toBe(true);
    expect(manifest.features.paymentsEnabled).toBe(false);
  });

  it('merges custom branding over defaults', () => {
    const row = {
      ...BASE_ROW,
      branding: JSON.stringify({ primaryColour: '#ff0000', logoUrl: 'https://example.com/logo.png' }),
    };
    const manifest = buildTenantManifest(row);

    expect(manifest.branding.primaryColour).toBe('#ff0000');
    expect(manifest.branding.logoUrl).toBe('https://example.com/logo.png');
    expect(manifest.branding.secondaryColour).toBe('#e94560');  // default preserved
  });

  it('merges custom features over defaults', () => {
    const row = {
      ...BASE_ROW,
      features: JSON.stringify({ paymentsEnabled: true, analyticsEnabled: true }),
    };
    const manifest = buildTenantManifest(row);

    expect(manifest.features.paymentsEnabled).toBe(true);
    expect(manifest.features.analyticsEnabled).toBe(true);
    expect(manifest.features.claimsEnabled).toBe(true);  // default preserved
  });

  it('falls back to id as tenantSlug when tenant_slug is null', () => {
    const row = { ...BASE_ROW, tenant_slug: null };
    const manifest = buildTenantManifest(row);
    expect(manifest.tenantSlug).toBe('wsp_test001');
  });

  it('sets defaultLocale to en-NG', () => {
    const manifest = buildTenantManifest(BASE_ROW);
    expect(manifest.defaultLocale).toBe('en-NG');
  });
});

describe('getTenantManifestBySlug', () => {
  it('returns null when workspace not found', async () => {
    const db = makeDb(null);
    const result = await getTenantManifestBySlug(db, 'nonexistent');
    expect(result).toBeNull();
  });

  it('returns manifest when workspace found', async () => {
    const db = makeDb(BASE_ROW);
    const result = await getTenantManifestBySlug(db, 'test-tenant');

    expect(result).not.toBeNull();
    expect(result?.tenantSlug).toBe('test-tenant');
    expect(result?.displayName).toBe('Test Tenant');
  });
});

describe('getTenantManifestById', () => {
  it('returns null when workspace not found', async () => {
    const db = makeDb(null);
    const result = await getTenantManifestById(db, 'wsp_missing');
    expect(result).toBeNull();
  });

  it('returns manifest when workspace found', async () => {
    const db = makeDb(BASE_ROW);
    const result = await getTenantManifestById(db, 'wsp_test001');

    expect(result).not.toBeNull();
    expect(result?.tenantId).toBe('wsp_test001');
  });
});
