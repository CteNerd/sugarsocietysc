export type OrderType = 'presale' | 'custom';
export type OrderStatus =
  | 'received'
  | 'payment_received'
  | 'ready_for_pickup'
  | 'complete'
  | 'cancelled';
export type PaymentType = 'deposit' | 'balance';
export type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'refunded';

/**
 * Either `userId` is set, or both `guestEmail` and `guestPhone` are set — never neither.
 * Guest contact fields are purged by a scheduled retention job once an order is
 * complete/cancelled past the configured retention window (see infra EventBridge rule).
 */
export interface Order {
  id: string;
  orderNumber: string;
  userId?: string;
  guestEmail?: string;
  guestPhone?: string;
  type: OrderType;
  status: OrderStatus;
  pickupDate: string;
  subtotal: number;
  tax: number;
  depositAmount: number;
  depositPaidAt?: string;
  total: number;
  stripePaymentIntentId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  cookieDesignId?: string;
  baseCookieOptionId?: string;
  icingOptionId?: string;
  customDesignImageUrl?: string;
  colorSelection?: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface OrderPackaging {
  id: string;
  orderId: string;
  packagingOptionId: string;
  addOnOptionIds: string[];
  quantity: number;
  price: number;
}

export interface OrderStatusHistoryEntry {
  id: string;
  orderId: string;
  status: OrderStatus;
  changedByAdminId: string;
  changedAt: string;
  note?: string;
}

export interface PaymentTransaction {
  id: string;
  orderId: string;
  provider: string;
  providerRef: string;
  amount: number;
  type: PaymentType;
  status: PaymentStatus;
  createdAt: string;
}
