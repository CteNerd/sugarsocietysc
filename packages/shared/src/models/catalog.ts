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
  isActive: boolean;
}

export interface CookieDesign {
  id: string;
  name: string;
  imageUrls: string[];
  basePrice: number;
  preSaleEventId?: string;
  type: CookieDesignType;
  colors: string[];
  maxQuantity?: number;
  quantitySold: number;
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
  price: number;
  type: PackagingOptionType;
  isActive: boolean;
}
