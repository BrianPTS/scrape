'use client';

import React, { useState, useEffect, useCallback } from 'react';
import moment from 'moment';
import {
  RefreshCw,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Eye,
  RotateCcw,
  Clock,
  AlertTriangle,
  Package,
  ChevronLeft,
  ChevronRight,
  X,
  Zap,
  ExternalLink,
} from 'lucide-react';

// Order type definition
interface Order {
  id: number;
  order_id: string;
  status: string;
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

interface OrderStats {
  pending: number;
  problem: number;
  confirmed: number;
  delivered: number;
  total: number;
}

// Available marketplaces
const MARKETPLACES = [
  { value: '', label: 'All Marketplaces' },
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
];

// Available statuses
const STATUSES = [
  { value: '', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'problem', label: 'Problem' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'confirmed_delay', label: 'Confirmed (Delay)' },
  { value: 'delivery_problem', label: 'Delivery Problem' },
  { value: 'delivered', label: 'Delivered' },
];

// Toast notification
const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
  const toast = document.createElement('div');
  toast.className = `fixed top-4 right-4 px-4 py-2 rounded-md text-white z-50 ${
    type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500'
  }`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    if (document.body.contains(toast)) {
      document.body.removeChild(toast);
    }
  }, 3000);
};

// Status badge component
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const getStatusConfig = (s: string) => {
    switch (s) {
      case 'pending':
        return { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pending' };
      case 'problem':
        return { bg: 'bg-red-100', text: 'text-red-800', label: 'Problem' };
      case 'confirmed':
        return { bg: 'bg-green-100', text: 'text-green-800', label: 'Confirmed' };
      case 'confirmed_delay':
        return { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Confirmed (Delay)' };
      case 'delivery_problem':
        return { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Delivery Problem' };
      case 'delivered':
        return { bg: 'bg-emerald-100', text: 'text-emerald-800', label: 'Delivered' };
      default:
        return { bg: 'bg-gray-100', text: 'text-gray-800', label: status };
    }
  };

  const config = getStatusConfig(status);
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  );
};

// Marketplace badge component
const MarketplaceBadge: React.FC<{ marketplace: string }> = ({ marketplace }) => {
  const getLabel = (m: string) => {
    const mp = MARKETPLACES.find((x) => x.value === m);
    return mp?.label || m;
  };

  return (
    <span className="px-2 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-700">
      {getLabel(marketplace)}
    </span>
  );
};

// Format seat range
const formatSeats = (low: string | number, high: string | number) => {
  if (low === high) return String(low);
  return `${low}-${high}`;
};

// Format currency
const formatCurrency = (amount: number | string) => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
};

// Main Orders Page Component
const OrdersPage: React.FC = () => {
  // State
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<OrderStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [marketplaceFilter, setMarketplaceFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [limit] = useState(25);

  // Auto-refresh
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(60); // seconds
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Modal
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showModal, setShowModal] = useState(false);

  // Fetch orders
  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (marketplaceFilter) params.append('marketplace', marketplaceFilter);
      if (searchTerm) params.append('event_name', searchTerm);
      params.append('limit', String(limit));
      params.append('page', String(page));
      params.append('order_by', 'created_at');
      params.append('order_by_direction', 'desc');

      const response = await fetch(`/api/orders?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        const orderData = result.data?.orders || result.data?.data || [];
        setOrders(orderData);
        setTotalCount(result.data?.count || orderData.length);
        setLastRefresh(new Date());
        setConfigError(null);
      } else {
        setConfigError(result.error);
        setOrders([]);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
      setConfigError('Failed to connect to the API');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, marketplaceFilter, searchTerm, limit, page]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/api/orders?stats=true');
      const result = await response.json();
      if (result.success && result.stats) {
        setStats(result.stats);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }, []);

  // Initial load and auto-refresh
  useEffect(() => {
    fetchOrders();
    fetchStats();
  }, [fetchOrders, fetchStats]);

  // Auto-refresh interval
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchOrders();
      fetchStats();
    }, refreshInterval * 1000);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchOrders, fetchStats]);

  // Handle order action
  const handleOrderAction = async (
    action: 'confirm' | 'reject' | 'recheck' | 'fulfill',
    orderId: number
  ) => {
    try {
      setActionLoading(orderId);

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, orderId }),
      });

      const result = await response.json();

      if (result.success) {
        showToast(result.message || `Order ${action} successful`, 'success');
        fetchOrders();
        fetchStats();
      } else {
        showToast(result.error || `Failed to ${action} order`, 'error');
      }
    } catch (error) {
      showToast(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // Open order details modal
  const openOrderDetails = (order: Order) => {
    setSelectedOrder(order);
    setShowModal(true);
  };

  // Pagination
  const totalPages = Math.ceil(totalCount / limit);

  // Render configuration error
  if (configError && !loading) {
    return (
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-6">Orders</h2>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-yellow-800 mb-2">Configuration Required</h3>
          <p className="text-yellow-700 mb-4">{configError}</p>
          <p className="text-sm text-yellow-600">
            Add the following to your environment variables:
            <br />
            <code className="bg-yellow-100 px-2 py-1 rounded mt-2 inline-block">
              AUTOMATIQ_API_TOKEN=your_api_token
            </code>
            <br />
            <code className="bg-yellow-100 px-2 py-1 rounded mt-1 inline-block">
              AUTOMATIQ_COMPANY_ID=your_company_id
            </code>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold">Orders</h2>
          <p className="text-sm text-gray-500">
            Last updated: {moment(lastRefresh).format('HH:mm:ss')}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Auto-refresh toggle */}
          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border">
            <Clock className="w-4 h-4 text-gray-500" />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded"
              />
              Auto-refresh
            </label>
            {autoRefresh && (
              <select
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(Number(e.target.value))}
                className="text-sm border-l pl-2 ml-2"
              >
                <option value={30}>30s</option>
                <option value={60}>1m</option>
                <option value={120}>2m</option>
                <option value={300}>5m</option>
              </select>
            )}
          </div>

          {/* Refresh button */}
          <button
            onClick={() => {
              fetchOrders();
              fetchStats();
            }}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-sm text-gray-500">Total Orders</div>
          </div>
          <div className="bg-yellow-50 rounded-lg shadow p-4 border-l-4 border-yellow-500">
            <div className="text-2xl font-bold text-yellow-700">{stats.pending}</div>
            <div className="text-sm text-yellow-600">Pending</div>
          </div>
          <div className="bg-red-50 rounded-lg shadow p-4 border-l-4 border-red-500">
            <div className="text-2xl font-bold text-red-700">{stats.problem}</div>
            <div className="text-sm text-red-600">Problems</div>
          </div>
          <div className="bg-blue-50 rounded-lg shadow p-4 border-l-4 border-blue-500">
            <div className="text-2xl font-bold text-blue-700">{stats.confirmed}</div>
            <div className="text-sm text-blue-600">Confirmed</div>
          </div>
          <div className="bg-green-50 rounded-lg shadow p-4 border-l-4 border-green-500">
            <div className="text-2xl font-bold text-green-700">{stats.delivered}</div>
            <div className="text-sm text-green-600">Delivered</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-4 border-b flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by event name..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>

          {/* Marketplace filter */}
          <select
            value={marketplaceFilter}
            onChange={(e) => {
              setMarketplaceFilter(e.target.value);
              setPage(1);
            }}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            {MARKETPLACES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>

          {/* Advanced filters toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg ${
              showFilters ? 'bg-blue-50 border-blue-300' : ''
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
          </button>
        </div>

        {/* Advanced filters panel */}
        {showFilters && (
          <div className="p-4 bg-gray-50 border-b grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Order Date From</label>
              <input type="date" className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Order Date To</label>
              <input type="date" className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Event Date From</label>
              <input type="date" className="w-full px-3 py-2 border rounded-lg" />
            </div>
          </div>
        )}
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Order ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Event
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Marketplace
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Seats
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Order Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading && orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <RefreshCw className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-2" />
                    <p className="text-gray-500">Loading orders...</p>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <Package className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500">No orders found</p>
                    <p className="text-sm text-gray-400">
                      Try adjusting your filters or check back later
                    </p>
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-mono text-sm">{order.order_id}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="max-w-xs">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {order.event_name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {moment(order.occurs_at).format('MMM D, YYYY h:mm A')}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <MarketplaceBadge marketplace={order.marketplace} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      <div>
                        Sec {order.section}, Row {order.row}
                      </div>
                      <div className="text-xs text-gray-500">
                        Seats {formatSeats(order.low_seat, order.high_seat)} ({order.quantity} tickets)
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm font-medium">{formatCurrency(order.total)}</div>
                      <div className="text-xs text-gray-500">
                        {formatCurrency(order.unit_price)}/ea
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {moment(order.order_date).format('MMM D, YYYY')}
                      <div className="text-xs">{moment(order.order_date).format('h:mm A')}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        {/* View details */}
                        <button
                          onClick={() => openOrderDetails(order)}
                          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {/* Confirm (only for pending/problem orders) */}
                        {['pending', 'problem'].includes(order.status) && (
                          <button
                            onClick={() => handleOrderAction('confirm', order.id)}
                            disabled={actionLoading === order.id}
                            className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded disabled:opacity-50"
                            title="Confirm Order"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}

                        {/* Reject (only for pending/problem orders) */}
                        {['pending', 'problem'].includes(order.status) && (
                          <button
                            onClick={() => handleOrderAction('reject', order.id)}
                            disabled={actionLoading === order.id}
                            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                            title="Reject Order"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}

                        {/* Recheck */}
                        <button
                          onClick={() => handleOrderAction('recheck', order.id)}
                          disabled={actionLoading === order.id}
                          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded disabled:opacity-50"
                          title="Recheck Status"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>

                        {/* Auto-fulfill */}
                        {order.status === 'pending' && (
                          <button
                            onClick={() => handleOrderAction('fulfill', order.id)}
                            disabled={actionLoading === order.id}
                            className="p-1.5 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded disabled:opacity-50"
                            title="Set Auto-Fulfill"
                          >
                            <Zap className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t flex items-center justify-between">
            <div className="text-sm text-gray-500">
              Showing {(page - 1) * limit + 1} to {Math.min(page * limit, totalCount)} of{' '}
              {totalCount} orders
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Order Details Modal */}
      {showModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Order Details</h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Order Status */}
              <div className="flex items-center justify-between">
                <StatusBadge status={selectedOrder.status} />
                <MarketplaceBadge marketplace={selectedOrder.marketplace} />
              </div>

              {/* Order Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-500">Order ID</div>
                  <div className="font-mono">{selectedOrder.order_id}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Sync ID</div>
                  <div className="font-mono">{selectedOrder.id}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Order Date</div>
                  <div>{moment(selectedOrder.order_date).format('MMM D, YYYY h:mm A')}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Delivery Type</div>
                  <div className="capitalize">{selectedOrder.delivery?.replace('_', ' ')}</div>
                </div>
              </div>

              {/* Event Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium mb-2">Event Information</h4>
                <div className="text-lg font-semibold">{selectedOrder.event_name}</div>
                <div className="text-sm text-gray-600">
                  {moment(selectedOrder.occurs_at).format('dddd, MMMM D, YYYY @ h:mm A')}
                </div>
                {selectedOrder.city && (
                  <div className="text-sm text-gray-500 mt-1">
                    {selectedOrder.city}
                    {selectedOrder.state && `, ${selectedOrder.state}`}
                    {selectedOrder.country && ` (${selectedOrder.country})`}
                  </div>
                )}
              </div>

              {/* Ticket Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium mb-2">Ticket Information</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Section:</span> {selectedOrder.section}
                  </div>
                  <div>
                    <span className="text-gray-500">Row:</span> {selectedOrder.row}
                  </div>
                  <div>
                    <span className="text-gray-500">Seats:</span>{' '}
                    {formatSeats(selectedOrder.low_seat, selectedOrder.high_seat)}
                  </div>
                  <div>
                    <span className="text-gray-500">Quantity:</span> {selectedOrder.quantity}
                  </div>
                </div>
              </div>

              {/* Pricing */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium mb-2">Pricing</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Unit Price:</span>{' '}
                    {formatCurrency(selectedOrder.unit_price)}
                  </div>
                  <div>
                    <span className="text-gray-500">Total:</span>{' '}
                    <span className="font-semibold">{formatCurrency(selectedOrder.total)}</span>
                  </div>
                </div>
              </div>

              {/* Error Reason */}
              {selectedOrder.error_reason && (
                <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                  <h4 className="font-medium text-red-800 mb-1">Error Reason</h4>
                  <div className="text-sm text-red-700">{selectedOrder.error_reason}</div>
                </div>
              )}

              {/* Internal Notes */}
              {selectedOrder.last_seen_internal_notes && (
                <div className="bg-blue-50 rounded-lg p-4">
                  <h4 className="font-medium text-blue-800 mb-1">Internal Notes</h4>
                  <div className="text-sm text-blue-700">
                    {selectedOrder.last_seen_internal_notes}
                  </div>
                </div>
              )}

              {/* Tags */}
              {selectedOrder.last_seen_inventory_tags &&
                selectedOrder.last_seen_inventory_tags.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Tags</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedOrder.last_seen_inventory_tags.map((tag, i) => (
                        <span
                          key={i}
                          className="px-2 py-1 bg-gray-100 rounded-full text-xs text-gray-700"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

              {/* POS IDs */}
              {(selectedOrder.pos_event_id ||
                selectedOrder.pos_inventory_id ||
                selectedOrder.pos_invoice_id) && (
                <div className="text-xs text-gray-500 space-y-1">
                  {selectedOrder.pos_event_id && <div>POS Event: {selectedOrder.pos_event_id}</div>}
                  {selectedOrder.pos_inventory_id && (
                    <div>POS Inventory: {selectedOrder.pos_inventory_id}</div>
                  )}
                  {selectedOrder.pos_invoice_id && (
                    <div>POS Invoice: {selectedOrder.pos_invoice_id}</div>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="sticky bottom-0 bg-gray-50 border-t px-6 py-4 flex justify-between">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-100"
              >
                Close
              </button>
              <div className="flex gap-2">
                {['pending', 'problem'].includes(selectedOrder.status) && (
                  <>
                    <button
                      onClick={() => {
                        handleOrderAction('confirm', selectedOrder.id);
                        setShowModal(false);
                      }}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Confirm
                    </button>
                    <button
                      onClick={() => {
                        handleOrderAction('reject', selectedOrder.id);
                        setShowModal(false);
                      }}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
                    >
                      <XCircle className="w-4 h-4" />
                      Reject
                    </button>
                  </>
                )}
                <button
                  onClick={() => handleOrderAction('recheck', selectedOrder.id)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Recheck
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrdersPage;
