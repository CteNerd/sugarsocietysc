import Cookie from "./cookieModel";

export interface SubmitInvoiceModel {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  taxPercentage: number;
  cookies: Cookie[];
  pickupDate: string;
  dateCreated: string;
  invoiceNumber: string;
}
