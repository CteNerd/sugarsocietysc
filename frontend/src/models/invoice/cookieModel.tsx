import AddOns from "../cookie/addOnModel";

export default interface CookieModel {
  id: string;
  name: string;
  pricePerEach: number;
  add_ons: AddOns[];
  colors: string[];
  inspiration_images: string[];
  quantity: number;
  cookieTotals?: number;
  addOnsTotal?: number;
}
