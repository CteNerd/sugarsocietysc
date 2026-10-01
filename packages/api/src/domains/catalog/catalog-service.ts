import {
  CookieDesign,
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

/** Public-facing snapshot of the active Pre-Sale: the event plus its sellable designs and packaging
 * choices, exactly what the Phase 4 storefront needs to render in one request. */
export interface ActivePreSaleSnapshot {
  event: PreSaleEvent;
  designs: CookieDesign[];
  packagingOptions: PackagingOption[];
}

export class CatalogService {
  constructor(private readonly repository: CatalogRepository) {}

  async getActivePreSale(): Promise<ActivePreSaleSnapshot | undefined> {
    const event = await this.repository.getActivePreSaleEvent();
    if (!event) {
      return undefined;
    }
    const [designs, packagingOptions] = await Promise.all([
      this.repository.listCookieDesignsForEvent(event.id),
      this.repository.listActivePackagingOptions(),
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

  createCookieDesign(input: CreateCookieDesignRequest): Promise<CookieDesign> {
    return this.repository.createCookieDesign(input);
  }

  async updateCookieDesign(id: string, input: UpdateCookieDesignRequest): Promise<CookieDesign> {
    const design = await this.repository.updateCookieDesign(id, input);
    if (!design) {
      throw new CatalogError('Cookie design not found');
    }
    return design;
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
