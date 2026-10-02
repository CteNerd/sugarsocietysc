export type CookieDesignType = 'presale' | 'custom-catalog';
export type IcingOptionType = 'solid-color' | 'custom-print';
export type PackagingOptionType = 'box' | 'addon';

export interface PreSaleEvent {
  id: string;
  name: string;
  holidayTag: string;
  orderWindowStart: string;
  orderWindowEnd: string;
  pickupDate: string;
  /** Percentage (whole number, e.g. 50 for 50%) of order subtotal collected as a deposit at checkout. */
  depositPercent: number;
  isActive: boolean;
}

/** A Pre-Sale menu item (e.g. "Love Letter"). Prices live on its pack variants, never on the item. */
export interface CookieDesign {
  id: string;
  name: string;
  description?: string;
  imageUrls: string[];
  preSaleEventId?: string;
  categoryId?: string;
  sortOrder: number;
  type: CookieDesignType;
  colors: string[];
  /** Inventory cap in individual cookies (packs x pack size count against it). */
  maxQuantity?: number;
  quantitySold: number;
  isActive: boolean;
}

/** A menu section within one Pre-Sale event (e.g. "Mini Sugar Cookies", "Teacher Gifts"). */
export interface MenuCategory {
  id: string;
  preSaleEventId: string;
  name: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
}

/** A purchasable pack of a menu item, e.g. "Love Letter (6)" for $14.00. */
export interface MenuItemVariant {
  id: string;
  cookieDesignId: string;
  /** Optional display label; defaults to "(packSize)" when omitted. */
  label?: string;
  /** Cookies (or kits/units) in one pack. */
  packSize: number;
  /** Fixed price for one pack, integer cents. */
  priceCents: number;
  sortOrder: number;
  isActive: boolean;
}

export type PreSaleEventStatus = 'open' | 'upcoming';

/** Public listing entry for the Pre-Sale landing page. */
export interface PreSaleEventSummary extends PreSaleEvent {
  status: PreSaleEventStatus;
}

export interface MenuItemWithVariants extends CookieDesign {
  variants: MenuItemVariant[];
}

export interface MenuCategoryWithItems extends MenuCategory {
  items: MenuItemWithVariants[];
}

/** Everything the storefront needs to render one event's menu and checkout. */
export interface PreSaleEventMenu {
  event: PreSaleEventSummary;
  categories: MenuCategoryWithItems[];
  /** Active items with no (active) category, shown under a generic heading. */
  uncategorizedItems: MenuItemWithVariants[];
  /** Packaging/add-ons assigned to this event (all optional for the customer). */
  packagingOptions: PackagingOption[];
}

export interface BaseCookieOption {
  id: string;
  name: string;
  price: number;
  isActive: boolean;
}

export interface IcingOption {
  id: string;
  type: IcingOptionType;
  name: string;
  price: number;
}

export interface PackagingOption {
  id: string;
  name: string;
  /** Integer cents. */
  price: number;
  type: PackagingOptionType;
  isActive: boolean;
}
