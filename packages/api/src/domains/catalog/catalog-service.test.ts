import { describe, expect, it } from 'vitest';
import {
  CookieDesign,
  MenuCategory,
  MenuItemVariant,
  PackagingOption,
  PreSaleEvent,
  updateCookieDesignSchema,
} from '@sugarsocietysc/shared';
import { CatalogRepository } from './catalog-repository';
import { CatalogError, CatalogService, CatalogValidationError } from './catalog-service';

function fakeEvent(overrides: Partial<PreSaleEvent> = {}): PreSaleEvent {
  return {
    id: 'event-1',
    name: 'Halloween 2026 Pre-Sale',
    holidayTag: 'halloween',
    orderWindowStart: '2026-10-01T00:00:00.000Z',
    orderWindowEnd: '2026-10-20T00:00:00.000Z',
    pickupDate: '2026-10-25T00:00:00.000Z',
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
    preSaleEventId: 'event-1',
    categoryId: 'category-1',
    sortOrder: 0,
    type: 'presale',
    colors: ['white', 'black'],
    quantitySold: 0,
    isActive: true,
    ...overrides,
  };
}

function fakeCategory(overrides: Partial<MenuCategory> = {}): MenuCategory {
  return {
    id: 'category-1',
    preSaleEventId: 'event-1',
    name: 'Classic cookies',
    sortOrder: 0,
    isActive: true,
    ...overrides,
  };
}

function fakeVariant(overrides: Partial<MenuItemVariant> = {}): MenuItemVariant {
  return {
    id: 'variant-1',
    cookieDesignId: 'design-1',
    packSize: 6,
    priceCents: 1400,
    sortOrder: 0,
    isActive: true,
    ...overrides,
  };
}

function fakePackaging(overrides: Partial<PackagingOption> = {}): PackagingOption {
  return {
    id: 'pkg-1',
    name: 'Gift box',
    price: 500,
    type: 'box',
    isActive: true,
    ...overrides,
  };
}

function fakeRepository(overrides: Partial<CatalogRepository> = {}): CatalogRepository {
  return {
    listPublicPreSaleEvents: async () => [fakeEvent()],
    getFirstOpenPreSaleEvent: async () => fakeEvent(),
    getPreSaleEventById: async () => fakeEvent(),
    getCookieDesignById: async () => fakeDesign(),
    getCategoryById: async () => fakeCategory(),
    listAllPackagingOptions: async () => [fakePackaging()],
    listActiveCategoriesForEvent: async () => [fakeCategory()],
    listCookieDesignsForEvent: async () => [fakeDesign()],
    listActiveVariantsForEvent: async () => [fakeVariant()],
    listPackagingOptionsForEvent: async () => [fakePackaging()],
    updatePreSaleEvent: async (id: string) => fakeEvent({ id }),
    updateCookieDesign: async (id: string) => fakeDesign({ id }),
    updatePackagingOption: async (id: string) => fakePackaging({ id }),
    ...overrides,
  } as unknown as CatalogRepository;
}

describe('CatalogService', () => {
  it('groups active menu items and variants under their event category', async () => {
    const service = new CatalogService(fakeRepository());

    const menu = await service.getEventMenu('event-1', new Date('2026-10-02T00:00:00Z'));

    expect(menu?.event.status).toBe('open');
    expect(menu?.categories[0].items[0].variants[0].priceCents).toBe(1400);
    expect(menu?.packagingOptions).toHaveLength(1);
  });

  it('marks an event before its order window as upcoming', async () => {
    const service = new CatalogService(fakeRepository({
      listPublicPreSaleEvents: async () => [fakeEvent({ orderWindowStart: '2026-11-01T00:00:00.000Z' })],
    }));

    const events = await service.listPublicEvents(new Date('2026-10-02T00:00:00Z'));

    expect(events[0].status).toBe('upcoming');
  });

  it('hides inactive or ended events from the event menu', async () => {
    const service = new CatalogService(fakeRepository({
      getPreSaleEventById: async () => fakeEvent({ isActive: false }),
    }));

    expect(await service.getEventMenu('event-1', new Date('2026-10-02T00:00:00Z'))).toBeUndefined();
  });

  it('returns the first currently open event menu for the compatibility route', async () => {
    const service = new CatalogService(fakeRepository());

    expect((await service.getFirstOpenEventMenu(new Date('2026-10-02T00:00:00Z')))?.event.id).toBe('event-1');
  });

  it('keeps the legacy active Pre-Sale response shape', async () => {
    const service = new CatalogService(fakeRepository());

    const snapshot = await service.getActivePreSaleSnapshot();

    expect(snapshot).toEqual({
      event: fakeEvent(),
      designs: [fakeDesign()],
      packagingOptions: [fakePackaging()],
    });
    expect(snapshot?.event).not.toHaveProperty('status');
  });

  it('rejects moving an item when its existing category belongs to another event', async () => {
    const service = new CatalogService(fakeRepository());

    await expect(service.updateCookieDesign('design-1', { preSaleEventId: 'event-2' }))
      .rejects.toThrow(CatalogValidationError);
  });

  it('accepts an explicit null to clear the menu item inventory cap', () => {
    expect(updateCookieDesignSchema.parse({ maxQuantity: null })).toEqual({ maxQuantity: null });
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
