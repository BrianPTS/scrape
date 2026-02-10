'use server';

/**
 * Order Actions for Automatiq Integration
 *
 * Server-side actions for managing orders through the Automatiq API.
 * These actions handle fetching, confirming, rejecting, and managing orders.
 */

import {
  getOrders,
  getOrder,
  confirmOrder as apiConfirmOrder,
  rejectOrder as apiRejectOrder,
  recheckOrder as apiRecheckOrder,
  fulfillOrder as apiFulfillOrder,
  deliverOrderWithUrls as apiDeliverOrderWithUrls,
  getOrderProofs as apiGetOrderProofs,
  isAutomatiqConfigured,
  type OrderFilters,
  type AutomatiqOrder,
  type OrdersResponse,
} from '@/lib/automatiq';

export interface OrderActionResult {
  success: boolean;
  data?: AutomatiqOrder | AutomatiqOrder[] | OrdersResponse;
  error?: string;
  message?: string;
}

/**
 * Check if Automatiq is configured
 */
export async function checkAutomatiqConfig(): Promise<{ configured: boolean; message?: string }> {
  const configured = isAutomatiqConfigured();
  return {
    configured,
    message: configured
      ? undefined
      : 'Automatiq API credentials not configured. Please set AUTOMATIQ_API_TOKEN and AUTOMATIQ_COMPANY_ID in your environment variables.',
  };
}

/**
 * Fetch orders with optional filters
 */
export async function fetchOrders(filters: OrderFilters = {}): Promise<OrderActionResult> {
  try {
    const configCheck = await checkAutomatiqConfig();
    if (!configCheck.configured) {
      return { success: false, error: configCheck.message };
    }

    const response = await getOrders(filters);

    // Handle both response formats (data or orders array)
    const orders = response.data || response.orders || [];

    return {
      success: true,
      data: {
        ...response,
        orders,
        data: orders,
      },
    };
  } catch (error) {
    console.error('Error fetching orders:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch orders',
    };
  }
}

/**
 * Fetch a single order by ID
 */
export async function fetchOrder(orderId: string | number): Promise<OrderActionResult> {
  try {
    const configCheck = await checkAutomatiqConfig();
    if (!configCheck.configured) {
      return { success: false, error: configCheck.message };
    }

    const order = await getOrder(orderId);
    return { success: true, data: order };
  } catch (error) {
    console.error('Error fetching order:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch order',
    };
  }
}

/**
 * Confirm an order
 */
export async function confirmOrder(
  orderId: string | number,
  seatNumbers?: string
): Promise<OrderActionResult> {
  try {
    const configCheck = await checkAutomatiqConfig();
    if (!configCheck.configured) {
      return { success: false, error: configCheck.message };
    }

    const order = await apiConfirmOrder(orderId, seatNumbers);
    return {
      success: true,
      data: order,
      message: `Order ${orderId} confirmed successfully`,
    };
  } catch (error) {
    console.error('Error confirming order:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to confirm order',
    };
  }
}

/**
 * Reject an order
 */
export async function rejectOrder(orderId: string | number): Promise<OrderActionResult> {
  try {
    const configCheck = await checkAutomatiqConfig();
    if (!configCheck.configured) {
      return { success: false, error: configCheck.message };
    }

    const order = await apiRejectOrder(orderId);
    return {
      success: true,
      data: order,
      message: `Order ${orderId} rejected successfully`,
    };
  } catch (error) {
    console.error('Error rejecting order:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to reject order',
    };
  }
}

/**
 * Recheck order status
 */
export async function recheckOrder(orderId: string | number): Promise<OrderActionResult> {
  try {
    const configCheck = await checkAutomatiqConfig();
    if (!configCheck.configured) {
      return { success: false, error: configCheck.message };
    }

    const order = await apiRecheckOrder(orderId);
    return {
      success: true,
      data: order,
      message: `Order ${orderId} rechecked successfully`,
    };
  } catch (error) {
    console.error('Error rechecking order:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to recheck order',
    };
  }
}

/**
 * Set order to auto-fulfill
 */
export async function setOrderAutoFulfill(orderId: string | number): Promise<OrderActionResult> {
  try {
    const configCheck = await checkAutomatiqConfig();
    if (!configCheck.configured) {
      return { success: false, error: configCheck.message };
    }

    const order = await apiFulfillOrder(orderId);
    return {
      success: true,
      data: order,
      message: `Order ${orderId} set to auto-fulfill`,
    };
  } catch (error) {
    console.error('Error setting auto-fulfill:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to set auto-fulfill',
    };
  }
}

/**
 * Deliver order with URLs
 */
export async function deliverOrderWithUrls(
  orderId: string | number,
  urls: string[]
): Promise<OrderActionResult> {
  try {
    const configCheck = await checkAutomatiqConfig();
    if (!configCheck.configured) {
      return { success: false, error: configCheck.message };
    }

    if (!urls || urls.length === 0) {
      return { success: false, error: 'At least one URL is required' };
    }

    const order = await apiDeliverOrderWithUrls(orderId, urls);
    return {
      success: true,
      data: order,
      message: `Order ${orderId} delivery URLs set successfully`,
    };
  } catch (error) {
    console.error('Error delivering with URLs:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to set delivery URLs',
    };
  }
}

/**
 * Get order proofs
 */
export async function fetchOrderProofs(
  orderId: string,
  marketplace: string
): Promise<OrderActionResult> {
  try {
    const configCheck = await checkAutomatiqConfig();
    if (!configCheck.configured) {
      return { success: false, error: configCheck.message };
    }

    const proofs = await apiGetOrderProofs(orderId, marketplace);
    return { success: true, data: proofs as unknown as AutomatiqOrder };
  } catch (error) {
    console.error('Error fetching order proofs:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch order proofs',
    };
  }
}

/**
 * Get order statistics
 */
export async function getOrderStats(): Promise<{
  success: boolean;
  stats?: {
    pending: number;
    problem: number;
    confirmed: number;
    delivered: number;
    total: number;
  };
  error?: string;
}> {
  try {
    const configCheck = await checkAutomatiqConfig();
    if (!configCheck.configured) {
      return { success: false, error: configCheck.message };
    }

    // Fetch counts for each status
    const [pendingRes, problemRes, confirmedRes, deliveredRes] = await Promise.all([
      getOrders({ status: 'pending', limit: 1 }),
      getOrders({ status: 'problem,delivery_problem', limit: 1 }),
      getOrders({ status: 'confirmed,confirmed_delay', limit: 1 }),
      getOrders({ status: 'delivered', limit: 1 }),
    ]);

    return {
      success: true,
      stats: {
        pending: pendingRes.count || 0,
        problem: problemRes.count || 0,
        confirmed: confirmedRes.count || 0,
        delivered: deliveredRes.count || 0,
        total:
          (pendingRes.count || 0) +
          (problemRes.count || 0) +
          (confirmedRes.count || 0) +
          (deliveredRes.count || 0),
      },
    };
  } catch (error) {
    console.error('Error fetching order stats:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch order stats',
    };
  }
}
