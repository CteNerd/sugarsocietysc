import { describe, expect, it } from 'vitest';
import { CookieDesign, PackagingOption, PreSaleEvent } from '@sugarsocietysc/shared';
import { CatalogRepository } from './catalog-repository';
import { CatalogError, CatalogService } from './catalog-service';

function fakeEvent(overrides: Partial<PreSaleEvent> = {}): PreSaleEvent {
  return {
    id: 'event-1',
    name: 'Halloween 2025 Pre-Sale',
    holidayTag: 'halloween',
    orderWindowStart: '2025-10-01T00:00:00.000Z',
    orderWindowEnd: '2025-10-20T00:00:00.000Z',
    pickupDate: '2025-10-25T00:00:00.000Z',
    depositPercent: 50,
    isActive: true,
    ...overrides,
  };
}

function fakeDesign(overrides: Partial<CookieDesign> = {}): CookieDesign {
  return {
    id: 'design-1',
    name: 'Spooky Ghost',
    imageUrls: ['https://example.com/ghost.png'],
    basePrice: 400,
    preSaleEventId: 'event-1',
    type: 'presale',
    colors: ['white', 'black'],
    quantitySold: 0,
    isActive: true,
    ...overrides,
  };
}

function fakePackaging(overrides: Partial<PackagingOption> = {}): PackagingOption {
  return {
    id: 'pkg-1',
    name: 'Dozen Box',
    price: 500,
    type: 'box',
    isActive: true,
    ...overrides,
  };
}

function fakeRepository(overrides: Partial<CatalogRepository> = {}): CatalogRepository {
  return {
    getActivePreSaleEvent: async () => fakeEvent(),
    listCookieDesignsForEvent: async () => [fakeDesign()],
    listActivePackagingOptions: async () => [fakePackaging()],
    updatePreSaleEvent: async (id: string) => fakeEvent({ id }),
    updateCookieDesign: async (id: string) => fakeDesign({ id }),
    updatePackagingOption: async (id: string) => fakePackaging({ id }),
    ...overrides,
  } as unknown as CatalogRepository;
}

describe('CatalogService', () => {
  it('returns the active Pre-Sale snapshot with designs and packaging', async () => {
    const service = new CatalogService(fakeRepository());

    const snapshot = await service.getActivePreSale();

    expect(snapshot?.event.id).toBe('event-1');
    expect(snapshot?.designs).toHaveLength(1);
    expect(snapshot?.packagingOptions).toHaveLength(1);
  });

  it('returns undefined when no Pre-Sale event is active', async () => {
    const service = new CatalogService(fakeRepository({ getActivePreSaleEvent: async () => undefined }));

    expect(await service.getActivePreSale()).toBeUndefined();
  });

  it('throws when updating a Pre-Sale event that does not exist', async () => {
    const service = new CatalogService(fakeRepository({ updatePreSaleEvent: async () => undefined }));

    await expect(service.updatePreSaleEvent('missing', {})).rejects.toThrow(CatalogError);
  });

  it('throws when updating a cookie design that does not exist', async () => {
    const service = new CatalogService(fakeRepository({ updateCookieDesign: async () => undefined }));

    await expect(service.updateCookieDesign('missing', {})).rejects.toThrow(CatalogError);
  });

  it('throws when updating a packaging option that does not exist', async () => {
    const service = new CatalogService(fakeRepository({ updatePackagingOption: async () => undefined }));

    await expect(service.updatePackagingOption('missing', {})).rejects.toThrow(CatalogError);
  });
});
