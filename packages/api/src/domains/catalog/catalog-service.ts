import {
  CookieDesign,
  CreateMenuCategoryRequest,
  CreateMenuItemVariantRequest,
  MenuCategory,
  MenuCategoryWithItems,
  MenuItemVariant,
  MenuItemWithVariants,
  PreSaleEventMenu,
  PreSaleEventSummary,
  UpdateMenuCategoryRequest,
  UpdateMenuItemVariantRequest,
  CreateCookieDesignRequest,
  CreatePackagingOptionRequest,
  CreatePreSaleEventRequest,
  PackagingOption,
  PreSaleEvent,
  UpdateCookieDesignRequest,
  UpdatePackagingOptionRequest,
  UpdatePreSaleEventRequest,
} from '@sugarsocietysc/shared';
import { CatalogRepository } from './catalog-repository';

export class CatalogError extends Error {}

export class CatalogValidationError extends CatalogError {}

export function summarizeEvent(event: PreSaleEvent, now: Date = new Date()): PreSaleEventSummary {
  return { ...event, status: now >= new Date(event.orderWindowStart) ? 'open' : 'upcoming' };
}

/** Event is publicly visible: active and its ordering window hasn't ended. */
function isPubliclyVisible(event: PreSaleEvent, now: Date): boolean {
  return event.isActive && now <= new Date(event.orderWindowEnd);
}

export class CatalogService {
  constructor(private readonly repository: CatalogRepository) {}

  // --- Public storefront ---

  async listPublicEvents(now: Date = new Date()): Promise<PreSaleEventSummary[]> {
    const events = await this.repository.listPublicPreSaleEvents();
    return events.filter((e) => isPubliclyVisible(e, now)).map((e) => summarizeEvent(e, now));
  }

  async getEventMenu(eventId: string, now: Date = new Date()): Promise<PreSaleEventMenu | undefined> {
    const event = await this.repository.getPreSaleEventById(eventId);
    if (!event || !isPubliclyVisible(event, now)) {
      return undefined;
    }
    const [categories, designs, variants, packagingOptions] = await Promise.all([
      this.repository.listActiveCategoriesForEvent(event.id),
      this.repository.listCookieDesignsForEvent(event.id),
      this.repository.listActiveVariantsForEvent(event.id),
      this.repository.listPackagingOptionsForEvent(event.id, true),
    ]);
    return buildEventMenu(summarizeEvent(event, now), categories, designs, variants, packagingOptions);
  }

  async getFirstOpenEventMenu(now: Date = new Date()): Promise<PreSaleEventMenu | undefined> {
    const event = await this.repository.getFirstOpenPreSaleEvent();
    return event ? this.getEventMenu(event.id, now) : undefined;
  }

  async getActivePreSaleSnapshot(): Promise<ActivePreSaleSnapshot | undefined> {
    const event = await this.repository.getFirstOpenPreSaleEvent();
    if (!event) {
      return undefined;
    }
    const [designs, packagingOptions] = await Promise.all([
      this.repository.listCookieDesignsForEvent(event.id),
      this.repository.listPackagingOptionsForEvent(event.id, true),
    ]);
    return { event, designs, packagingOptions };
  }

  // --- Admin: Pre-Sale events ---

  listAllPreSaleEvents(): Promise<PreSaleEvent[]> {
    return this.repository.listAllPreSaleEvents();
  }

  createPreSaleEvent(input: CreatePreSaleEventRequest): Promise<PreSaleEvent> {
    return this.repository.createPreSaleEvent(input);
  }

  async updatePreSaleEvent(id: string, input: UpdatePreSaleEventRequest): Promise<PreSaleEvent> {
    const event = await this.repository.updatePreSaleEvent(id, input);
    if (!event) {
      throw new CatalogError('Pre-Sale event not found');
    }
    return event;
  }

  // --- Admin: Cookie designs ---

  listAllCookieDesigns(preSaleEventId?: string): Promise<CookieDesign[]> {
    return this.repository.listAllCookieDesigns(preSaleEventId);
  }

  async createCookieDesign(input: CreateCookieDesignRequest): Promise<CookieDesign> {
    await this.assertCategoryBelongsToEvent(input.categoryId, input.preSaleEventId);
    return this.repository.createCookieDesign(input);
  }

  async updateCookieDesign(id: string, input: UpdateCookieDesignRequest): Promise<CookieDesign> {
    if (input.categoryId !== undefined || input.preSaleEventId !== undefined) {
      const existing = await this.repository.getCookieDesignById(id);
      if (!existing) {
        throw new CatalogError('Cookie design not found');
      }
      const categoryId = input.categoryId !== undefined ? input.categoryId : existing.categoryId;
      await this.assertCategoryBelongsToEvent(categoryId, input.preSaleEventId ?? existing.preSaleEventId);
    }
    const design = await this.repository.updateCookieDesign(id, input);
    if (!design) {
      throw new CatalogError('Cookie design not found');
    }
    return design;
  }

  private async assertCategoryBelongsToEvent(categoryId: string | null | undefined, eventId?: string) {
    if (!categoryId) return;
    const category = await this.repository.getCategoryById(categoryId);
    if (!category || category.preSaleEventId !== eventId) {
      throw new CatalogValidationError('Category does not belong to this Pre-Sale event');
    }
  }

  // --- Admin: Menu categories ---

  listCategories(preSaleEventId: string): Promise<MenuCategory[]> {
    return this.repository.listCategoriesForEvent(preSaleEventId);
  }

  async createCategory(input: CreateMenuCategoryRequest): Promise<MenuCategory> {
    if (!(await this.repository.getPreSaleEventById(input.preSaleEventId))) {
      throw new CatalogValidationError('Pre-Sale event not found');
    }
    return this.repository.createCategory(input);
  }

  async updateCategory(id: string, input: UpdateMenuCategoryRequest): Promise<MenuCategory> {
    const category = await this.repository.updateCategory(id, input);
    if (!category) {
      throw new CatalogError('Menu category not found');
    }
    return category;
  }

  // --- Admin: Pack variants ---

  listVariants(filter: { cookieDesignId?: string; preSaleEventId?: string }): Promise<MenuItemVariant[]> {
    return this.repository.listVariants(filter);
  }

  async createVariant(input: CreateMenuItemVariantRequest): Promise<MenuItemVariant> {
    const item = await this.repository.getCookieDesignById(input.cookieDesignId);
    if (!item || item.type !== 'presale') {
      throw new CatalogValidationError('Menu item not found');
    }
    return this.repository.createVariant(input);
  }

  async updateVariant(id: string, input: UpdateMenuItemVariantRequest): Promise<MenuItemVariant> {
    const variant = await this.repository.updateVariant(id, input);
    if (!variant) {
      throw new CatalogError('Pack option not found');
    }
    return variant;
  }

  // --- Admin: Event packaging assignment ---

  listEventPackaging(preSaleEventId: string): Promise<PackagingOption[]> {
    return this.repository.listPackagingOptionsForEvent(preSaleEventId, false);
  }

  async setEventPackaging(preSaleEventId: string, packagingOptionIds: string[]): Promise<PackagingOption[]> {
    const unique = [...new Set(packagingOptionIds)];
    if ((await this.repository.countPackagingOptions(unique)) !== unique.length) {
      throw new CatalogValidationError('One or more packaging options do not exist');
    }
    if (!(await this.repository.setEventPackaging(preSaleEventId, unique))) {
      throw new CatalogError('Pre-Sale event not found');
    }
    return this.repository.listPackagingOptionsForEvent(preSaleEventId, false);
  }

  // --- Admin: Packaging options ---

  listAllPackagingOptions(): Promise<PackagingOption[]> {
    return this.repository.listAllPackagingOptions();
  }

  createPackagingOption(input: CreatePackagingOptionRequest): Promise<PackagingOption> {
    return this.repository.createPackagingOption(input);
  }

  async updatePackagingOption(id: string, input: UpdatePackagingOptionRequest): Promise<PackagingOption> {
    const option = await this.repository.updatePackagingOption(id, input);
    if (!option) {
      throw new CatalogError('Packaging option not found');
    }
    return option;
  }
}

/** Groups an event's items under their categories and attaches active pack variants. Items with no
 * active variant are not purchasable and are omitted; empty categories are omitted too. */
export interface ActivePreSaleSnapshot {
  event: PreSaleEvent;
  designs: CookieDesign[];
  packagingOptions: PackagingOption[];
}

function buildEventMenu(
  event: PreSaleEventSummary,
  categories: MenuCategory[],
  designs: CookieDesign[],
  variants: MenuItemVariant[],
  packagingOptions: PackagingOption[],
): PreSaleEventMenu {
  const variantsByItem = new Map<string, MenuItemVariant[]>();
  for (const variant of variants) {
    const list = variantsByItem.get(variant.cookieDesignId) ?? [];
    list.push(variant);
    variantsByItem.set(variant.cookieDesignId, list);
  }
  const activeCategoryIds = new Set(categories.map((category) => category.id));
  const items: MenuItemWithVariants[] = designs
    .map((d) => ({ ...d, variants: variantsByItem.get(d.id) ?? [] }))
    .filter((d) => d.variants.length > 0 && (!d.categoryId || activeCategoryIds.has(d.categoryId)));
  const grouped: MenuCategoryWithItems[] = categories
    .map((c) => ({ ...c, items: items.filter((i) => i.categoryId === c.id) }))
    .filter((c) => c.items.length > 0);
  const uncategorizedItems = items.filter((i) => !i.categoryId);
  return { event, categories: grouped, uncategorizedItems, packagingOptions };
}
