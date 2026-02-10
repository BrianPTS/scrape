/**
 * Automatiq (SeatScouts/Broker Genius) API Client
 *
 * This module provides a typed wrapper around the Automatiq API for managing
 * ticket orders, inventory, and fulfillment.
 *
 * Authentication requires two headers:
 * - X-Api-Token: Your API token
 * - X-Company-Id: Your company ID
 */

const AUTOMATIQ_BASE_URL = 'https://app.seatscouts.com/sync/api';

// Types for Automatiq API
export interface AutomatiqOrder {
  id: number;
  order_id: string;
  status: OrderStatus;
  marketplace: string;
  event_name: string;
  occurs_at: string;
  order_date: string;
  updated_at?: string;
  city?: string;
  state?: string;
  country?: string;
  section: string;
  row: string;
  low_seat: string | number;
  high_seat: string | number;
  quantity: number;
  unit_price: number | string;
  total: number | string;
  delivery: string;
  external_id?: string;
  pos_event_id?: string;
  pos_inventory_id?: string;
  pos_invoice_id?: string;
  transfer_count?: number;
  from_csv?: boolean;
  error_reason?: string;
  last_seen_internal_notes?: string;
  last_seen_inventory_tags?: string[];
}

export type OrderStatus =
  | 'pending'
  | 'problem'
  | 'confirmed'
  | 'confirmed_delay'
  | 'delivery_problem'
  | 'delivered';

export interface OrdersResponse {
  count?: number;
  page?: number;
  data?: AutomatiqOrder[];
  orders?: AutomatiqOrder[];
}

export interface OrderFilters {
  id?: string;
  order_id?: string;
  status?: string;
  marketplace?: string;
  delivery?: string;
  event_name?: string;
  venue_name?: string;
  section?: string;
  row?: string;
  order_date_from?: string;
  order_date_to?: string;
  event_date_from?: string;
  event_date_to?: string;
  updated_at?: string;
  reason?: string;
  from_csv?: boolean;
  consigned?: boolean;
  consigned_through?: boolean;
  transfer_email?: string;
  last_seen_notes?: string;
  order_by?: string;
  order_by_direction?: 'asc' | 'desc';
  limit?: number;
  page?: number;
  no_count?: boolean;
}

export interface OrderProof {
  file: string; // Base64 encoded
  extension: 'jpg' | 'jpeg' | 'png' | 'gif';
}

export interface AutomatiqError {
  error: string;
}

// Available marketplaces
export const MARKETPLACES = [
  { value: 'axs', label: 'AXS' },
  { value: 'fanxchange', label: 'FanXchange' },
  { value: 'gametime', label: 'GameTime' },
  { value: 'seatgeek', label: 'SeatGeek' },
  { value: 'stubhub', label: 'StubHub' },
  { value: 'ticket_evo', label: 'Ticket Evolution' },
  { value: 'ticket_network_mp', label: 'TicketNetwork' },
  { value: 'ticketmaster', label: 'Ticketmaster' },
  { value: 'tickpick', label: 'TickPick' },
  { value: 'vividseats', label: 'VividSeats' },
] as const;

// Available order statuses
export const ORDER_STATUSES = [
  { value: 'pending', label: 'Pending', color: 'yellow' },
  { value: 'problem', label: 'Problem', color: 'red' },
  { value: 'confirmed', label: 'Confirmed', color: 'green' },
  { value: 'confirmed_delay', label: 'Confirmed (Delay)', color: 'blue' },
  { value: 'delivery_problem', label: 'Delivery Problem', color: 'orange' },
  { value: 'delivered', label: 'Delivered', color: 'green' },
] as const;

// Delivery types
export const DELIVERY_TYPES = [
  { value: 'barcode', label: 'Barcode' },
  { value: 'flash', label: 'Flash' },
  { value: 'paper', label: 'Paper' },
  { value: 'mobile', label: 'Mobile' },
  { value: 'pdf', label: 'PDF' },
  { value: 'mobile_qr', label: 'Mobile QR' },
] as const;

/**
 * Get headers for Automatiq API requests
 */
function getHeaders(): HeadersInit {
  const apiToken = process.env.AUTOMATIQ_API_TOKEN;
  const companyId = process.env.AUTOMATIQ_COMPANY_ID;

  if (!apiToken || !companyId) {
    throw new Error('AUTOMATIQ_API_TOKEN and AUTOMATIQ_COMPANY_ID must be set in environment variables');
  }

  return {
    'Content-Type': 'application/json',
    'X-Api-Token': apiToken,
    'X-Company-Id': companyId,
  };
}

/**
 * Make a request to the Automatiq API
 */
async function automatiqRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${AUTOMATIQ_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      ...getHeaders(),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || `API request failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Build query string from filters object
 */
function buildQueryString(filters: Record<string, unknown>): string {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.append(key, String(value));
    }
  });

  const queryString = params.toString();
  return queryString ? `?${queryString}` : '';
}

// ============================================
// ORDER ENDPOINTS
// ============================================

/**
 * Get all orders with optional filters
 */
export async function getOrders(filters: OrderFilters = {}): Promise<OrdersResponse> {
  const queryString = buildQueryString(filters);
  return automatiqRequest<OrdersResponse>(`/orders${queryString}`);
}

/**
 * Get a single order by ID
 */
export async function getOrder(orderId: string | number): Promise<AutomatiqOrder> {
  return automatiqRequest<AutomatiqOrder>(`/orders/${orderId}`);
}

/**
 * Confirm an order
 */
export async function confirmOrder(
  orderId: string | number,
  seatNumbers?: string
): Promise<AutomatiqOrder> {
  const queryString = seatNumbers ? `?seat_numbers=${encodeURIComponent(seatNumbers)}` : '';
  return automatiqRequest<AutomatiqOrder>(`/orders/${orderId}/confirm${queryString}`, {
    method: 'PATCH',
  });
}

/**
 * Reject an order
 */
export async function rejectOrder(orderId: string | number): Promise<AutomatiqOrder> {
  return automatiqRequest<AutomatiqOrder>(`/orders/${orderId}/reject`, {
    method: 'PATCH',
  });
}

/**
 * Set order as auto-fulfill
 */
export async function fulfillOrder(orderId: string | number): Promise<AutomatiqOrder> {
  return automatiqRequest<AutomatiqOrder>(`/orders/${orderId}/fulfill`, {
    method: 'PATCH',
  });
}

/**
 * Recheck order status
 */
export async function recheckOrder(orderId: string | number): Promise<AutomatiqOrder> {
  return automatiqRequest<AutomatiqOrder>(`/orders/${orderId}/recheck`);
}

/**
 * Deliver order with URLs
 */
export async function deliverOrderWithUrls(
  orderId: string | number,
  urls: string[]
): Promise<AutomatiqOrder> {
  return automatiqRequest<AutomatiqOrder>(`/orders/${orderId}/deliver_urls`, {
    method: 'PATCH',
    body: JSON.stringify({ urls }),
  });
}

/**
 * Delete URLs from order
 */
export async function deleteOrderUrls(orderId: string | number): Promise<AutomatiqOrder> {
  return automatiqRequest<AutomatiqOrder>(`/orders/${orderId}/delete_urls`, {
    method: 'DELETE',
  });
}

/**
 * Upload proof images for an order
 */
export async function uploadOrderProofs(
  orderId: string | number,
  proofs: OrderProof[]
): Promise<AutomatiqOrder> {
  return automatiqRequest<AutomatiqOrder>(`/orders/${orderId}/proofs`, {
    method: 'POST',
    body: JSON.stringify({ data: proofs }),
  });
}

/**
 * Delete proofs from an order
 */
export async function deleteOrderProofs(orderId: string | number): Promise<void> {
  return automatiqRequest<void>(`/orders/${orderId}/proofs`, {
    method: 'DELETE',
  });
}

/**
 * Get all proofs for an order
 */
export async function getOrderProofs(
  orderId: string,
  marketplace: string
): Promise<{ data: Array<{ classification: string; type: string; value: string }> }> {
  const queryString = `?order_id=${encodeURIComponent(orderId)}&marketplace=${encodeURIComponent(marketplace)}`;
  return automatiqRequest(`/orders/proofs/all${queryString}`);
}

/**
 * Create a retail order
 */
export async function createRetailOrder(orderData: {
  order_id: string;
  event_name: string;
  event_date: string;
  section: string;
  row: string;
  seats: string;
  quantity: number;
  total: string;
  pos_inventory_id?: string;
  customer_id?: string;
  customer?: {
    first_name: string;
    last_name: string;
    email: string;
    phone?: string;
    company?: string;
  };
}): Promise<AutomatiqOrder> {
  return automatiqRequest<AutomatiqOrder>('/orders/retail', {
    method: 'POST',
    body: JSON.stringify(orderData),
  });
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get status badge color for an order status
 */
export function getStatusColor(status: string): string {
  const statusConfig = ORDER_STATUSES.find(s => s.value === status);
  return statusConfig?.color || 'gray';
}

/**
 * Get human-readable status label
 */
export function getStatusLabel(status: string): string {
  const statusConfig = ORDER_STATUSES.find(s => s.value === status);
  return statusConfig?.label || status;
}

/**
 * Get marketplace label
 */
export function getMarketplaceLabel(marketplace: string): string {
  const marketplaceConfig = MARKETPLACES.find(m => m.value === marketplace);
  return marketplaceConfig?.label || marketplace;
}

/**
 * Format seat range for display
 */
export function formatSeatRange(lowSeat: string | number, highSeat: string | number): string {
  if (lowSeat === highSeat) {
    return String(lowSeat);
  }
  return `${lowSeat}-${highSeat}`;
}

/**
 * Check if Automatiq credentials are configured
 */
export function isAutomatiqConfigured(): boolean {
  return !!(process.env.AUTOMATIQ_API_TOKEN && process.env.AUTOMATIQ_COMPANY_ID);
}
