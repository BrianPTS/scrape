import { NextRequest, NextResponse } from 'next/server';
import {
  fetchOrders,
  fetchOrder,
  confirmOrder,
  rejectOrder,
  recheckOrder,
  setOrderAutoFulfill,
  getOrderStats,
} from '@/actions/orderActions';

// Force dynamic rendering - no caching
export const dynamic = 'force-dynamic';

// No-cache headers
const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',
};

/**
 * GET /api/orders
 *
 * Fetch orders with optional filters
 * Query params: status, marketplace, event_name, limit, page, etc.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Check if this is a stats request
    if (searchParams.get('stats') === 'true') {
      const result = await getOrderStats();
      return NextResponse.json(result, { headers: NO_CACHE_HEADERS });
    }

    // Check if this is a single order request
    const orderId = searchParams.get('id');
    if (orderId) {
      const result = await fetchOrder(orderId);
      return NextResponse.json(result, { headers: NO_CACHE_HEADERS });
    }

    // Build filters from query params
    const filters: Record<string, string | number | boolean> = {};

    // String filters
    const stringParams = [
      'status',
      'marketplace',
      'delivery',
      'event_name',
      'venue_name',
      'section',
      'row',
      'order_id',
      'order_date_from',
      'order_date_to',
      'event_date_from',
      'event_date_to',
      'updated_at',
      'reason',
      'transfer_email',
      'last_seen_notes',
      'order_by',
      'order_by_direction',
    ];

    stringParams.forEach((param) => {
      const value = searchParams.get(param);
      if (value) {
        filters[param] = value;
      }
    });

    // Number filters
    const numberParams = ['limit', 'page'];
    numberParams.forEach((param) => {
      const value = searchParams.get(param);
      if (value) {
        filters[param] = parseInt(value, 10);
      }
    });

    // Boolean filters
    const booleanParams = ['from_csv', 'consigned', 'consigned_through', 'no_count'];
    booleanParams.forEach((param) => {
      const value = searchParams.get(param);
      if (value) {
        filters[param] = value === 'true';
      }
    });

    const result = await fetchOrders(filters);
    return NextResponse.json(result, { headers: NO_CACHE_HEADERS });
  } catch (error) {
    console.error('Error in GET /api/orders:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch orders',
      },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

/**
 * POST /api/orders
 *
 * Perform actions on orders: confirm, reject, recheck, fulfill
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, orderId, seatNumbers, urls } = body;

    if (!action || !orderId) {
      return NextResponse.json(
        { success: false, error: 'action and orderId are required' },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    let result;

    switch (action) {
      case 'confirm':
        result = await confirmOrder(orderId, seatNumbers);
        break;

      case 'reject':
        result = await rejectOrder(orderId);
        break;

      case 'recheck':
        result = await recheckOrder(orderId);
        break;

      case 'fulfill':
        result = await setOrderAutoFulfill(orderId);
        break;

      case 'deliver_urls':
        if (!urls || !Array.isArray(urls) || urls.length === 0) {
          return NextResponse.json(
            { success: false, error: 'urls array is required for deliver_urls action' },
            { status: 400, headers: NO_CACHE_HEADERS }
          );
        }
        // Import and call the delivery function
        const { deliverOrderWithUrls } = await import('@/actions/orderActions');
        result = await deliverOrderWithUrls(orderId, urls);
        break;

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400, headers: NO_CACHE_HEADERS }
        );
    }

    return NextResponse.json(result, { headers: NO_CACHE_HEADERS });
  } catch (error) {
    console.error('Error in POST /api/orders:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process order action',
      },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
