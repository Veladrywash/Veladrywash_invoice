import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { loadOrders, removeOrder, removeAllOrders } from '@/store/orders';
import { Order } from '@/types';
import { formatDateTime, formatINR } from '@/utils/format';
import { Link, useNavigate } from 'react-router-dom';
import { Seo } from '@/components/Seo';
import { useIsMobile } from '@/hooks/use-mobile';
import { NavBar } from '@/components/NavBar';
import { OfflineBanner } from '@/components/OfflineBanner';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Bluetooth, BluetoothOff, BluetoothSearching, Printer } from 'lucide-react';
import {
  connectPrinter,
  disconnectPrinter,
  isPrinterConnected,
  getConnectedPrinterName,
  printReceiptBLE,
} from '@/utils/bluetoothPrinter';
import { toast } from 'sonner';


type FilterPeriod = 'today' | 'yesterday' | 'week' | 'month' | 'all';

// Timezone-safe date string helper
function toDateStr(date: Date): string {
  const offset = date.getTimezoneOffset();
  const d = new Date(date.getTime() - offset * 60 * 1000);
  return d.toISOString().split('T')[0];
}

function getFilterRange(period: FilterPeriod): { start: number; end: number } | null {
  const now = new Date();

  if (period === 'all') return null;

  if (period === 'today') {
    const start = new Date(toDateStr(now)).setHours(0, 0, 0, 0);
    const end = new Date(toDateStr(now)).setHours(23, 59, 59, 999);
    return { start, end };
  }

  if (period === 'yesterday') {
    const yest = new Date(now);
    yest.setDate(yest.getDate() - 1);
    const start = new Date(toDateStr(yest)).setHours(0, 0, 0, 0);
    const end = new Date(toDateStr(yest)).setHours(23, 59, 59, 999);
    return { start, end };
  }

  if (period === 'week') {
    // Monday start
    const dayOfWeek = now.getDay(); // 0=Sun
    const diffToMon = (dayOfWeek === 0 ? -6 : 1 - dayOfWeek);
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMon);
    const start = new Date(toDateStr(monday)).setHours(0, 0, 0, 0);
    const end = new Date(toDateStr(now)).setHours(23, 59, 59, 999);
    return { start, end };
  }

  if (period === 'month') {
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const start = firstDay.setHours(0, 0, 0, 0);
    const end = new Date(toDateStr(now)).setHours(23, 59, 59, 999);
    return { start, end };
  }

  return null;
}

const FILTER_LABELS: Record<FilterPeriod, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  week: 'This Week',
  month: 'This Month',
  all: 'All',
};

export default function Dashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterPeriod>('all');
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const location = useLocation();

  // Bluetooth State
  const [isConnecting, setIsConnecting] = useState(false);
  const [isBtPrinting, setIsBtPrinting] = useState<{ [key: string]: boolean }>({});
  const [printerConnected, setPrinterConnected] = useState(() => isPrinterConnected());
  const [printerName, setPrinterName] = useState(() => getConnectedPrinterName());
  const [printerError, setPrinterError] = useState('');
  const hasBluetooth = typeof navigator !== 'undefined' && 'bluetooth' in navigator;

  const handleConnect = async () => {
    setPrinterError('');
    setIsConnecting(true);
    try {
      const name = await connectPrinter();
      setPrinterConnected(true);
      setPrinterName(name);
      toast.success(`Connected to ${name}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Connection failed';
      setPrinterError(msg);
      toast.error(msg);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    disconnectPrinter();
    setPrinterConnected(false);
    setPrinterName('');
    toast.info('Printer disconnected');
  };

  const handleDirectPrint = async (order: Order) => {
    setIsBtPrinting((prev) => ({ ...prev, [order.id]: true }));
    try {
      await printReceiptBLE(order);
      toast.success(`✅ Printed Order ${order.id} successfully`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Print failed';
      toast.error(`Print failed: ${msg}`);
    } finally {
      setIsBtPrinting((prev) => ({ ...prev, [order.id]: false }));
    }
  };

  const deleteAllOrders = async () => {
    setError(null);
    setOrders([]);
    try {
      await removeAllOrders();
    } catch {
      setError('Failed to delete all orders. Please try again.');
      setOrders(await loadOrders());
    }
  };

  useEffect(() => {
    const fetchOrders = async () => {
      const fetchedOrders = await loadOrders();
      setOrders(fetchedOrders);
    };
    fetchOrders();
  }, [location]);

  const onDelete = async (id: string) => {
    setError(null);
    const prevOrders = [...orders];
    setOrders((prev) => prev.filter((order) => order.id !== id));
    try {
      await removeOrder(id);
    } catch {
      setError('Failed to delete order. Please try again.');
      setOrders(prevOrders);
    }
  };

  // Filter orders by date range
  const filteredOrders = (() => {
    const range = getFilterRange(filter);
    if (!range) return orders;
    return orders.filter((o) => {
      const t = new Date(o.createdAt).getTime();
      return t >= range.start && t <= range.end;
    });
  })();

  const exportToExcel = () => {
    const data = filteredOrders.map((order) => ({
      'Order Number': order.id,
      Customer: order.customerName || '-',
      Items: order.items.map((item) => `${item.name} (Qty: ${item.qty})`).join(', '),
      Total: formatINR(order.items.reduce((s, it) => s + it.qty * it.price, 0)),
      OrderDate: formatDateTime(order.createdAt),
      DeliveryDate: order.deliveryDate ? formatDateTime(order.deliveryDate) : '',
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Orders');
    XLSX.writeFile(wb, `vdw-orders-${filter}.xlsx`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text(`Orders Export — ${FILTER_LABELS[filter]}`, 14, 15);

    autoTable(doc, {
      startY: 20,
      head: [['Order Number', 'Customer', 'Items', 'Total', 'Order Date', 'Delivery Date']],
      body: filteredOrders.map((order) => [
        order.id,
        order.customerName || '-',
        order.items.map((item) => `${item.name} (Qty: ${item.qty})`).join(', '),
        formatINR(order.items.reduce((s, it) => s + it.qty * it.price, 0)),
        formatDateTime(order.createdAt),
        order.deliveryDate ? formatDateTime(order.deliveryDate) : '',
      ]),
    });

    doc.save(`vdw-orders-${filter}.pdf`);
  };

  return (
    <main className="min-h-screen bg-background">
      <Seo
        title="Dashboard | Vela Dry Wash POS"
        description="View all transactions and reprint receipts."
        canonicalPath="/dashboard"
      />
      <OfflineBanner />
      <NavBar />

      {/* ── Bluetooth Control Bar ── */}
      <div className="w-full bg-background border-b px-4 py-2 flex flex-wrap items-center gap-3">
        {!hasBluetooth ? (
          <p className="text-sm text-amber-600 font-medium flex items-center gap-2">
            <BluetoothOff className="w-4 h-4" />
            ⚠️ Bluetooth printing requires Chrome or Edge browser
          </p>
        ) : (
          <>
            {printerConnected ? (
              <div className="flex items-center gap-2">
                <Bluetooth className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-green-700">{printerName}</span>
                <Button variant="outline" size="sm" onClick={handleDisconnect}>
                  Disconnect
                </Button>
              </div>
            ) : isConnecting ? (
              <div className="flex items-center gap-2 text-blue-600">
                <BluetoothSearching className="w-4 h-4 animate-pulse" />
                <span className="text-sm">Connecting…</span>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={handleConnect}>
                <BluetoothOff className="w-4 h-4 mr-2" />
                Connect Printer
              </Button>
            )}
          </>
        )}
        {printerError && <p className="text-sm text-destructive">{printerError}</p>}
      </div>

      <section className="container py-6 pb-12 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <h1 className="text-2xl md:text-3xl font-bold">
            All Orders ({filteredOrders.length}{filter !== 'all' ? ` / ${orders.length}` : ''})
          </h1>
          <div className="flex gap-2 flex-wrap justify-end w-full md:w-auto">
            <Button className="w-full md:w-auto" onClick={exportToExcel}>Export to Excel</Button>
            <Button className="w-full md:w-auto" onClick={exportToPDF}>Export to PDF</Button>
            <Button className="w-full md:w-auto" variant="secondary" onClick={() => navigate('/order')}>
              New Order
            </Button>
          </div>
        </div>

        {/* Date Filter Bar */}
        <div 
          className="flex flex-nowrap overflow-x-auto gap-2 pb-1 -mx-4 px-4 md:mx-0 md:px-0" 
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {(Object.keys(FILTER_LABELS) as FilterPeriod[]).map((period) => (
            <Button
              key={period}
              size="sm"
              variant={filter === period ? 'default' : 'outline'}
              className="whitespace-nowrap flex-shrink-0"
              onClick={() => setFilter(period)}
            >
              {FILTER_LABELS[period]}
            </Button>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              {FILTER_LABELS[filter] === 'All'
                ? 'Recent Transactions'
                : `Transactions — ${FILTER_LABELS[filter]}`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isMobile ? (
              <div className="space-y-3">
                {filteredOrders.map((o) => {
                  const total = o.items.reduce((s, it) => s + it.qty * it.price, 0);
                  return (
                    <Card key={o.id} className="border">
                      <CardContent className="py-4 space-y-1">
                        <div className="flex items-start justify-between gap-1">
                          <span className="font-semibold break-all">{o.id}</span>
                          <span className="text-xs text-muted-foreground whitespace-nowrap pt-0.5">
                            {formatDateTime(o.createdAt)}
                          </span>
                        </div>
                        <div className="text-sm">Customer: {o.customerName || '-'}</div>
                        <div className="text-sm">Remark: {o.remark || '-'}</div>
                        <div className="text-sm">
                          Items:{' '}
                          {o.items.map((item) => (
                            <div key={item.id} className="ml-2">
                              - {item.name} (Qty: {item.qty})
                            </div>
                          ))}
                        </div>
                        <div className="text-base font-medium">Total: {formatINR(total)}</div>
                        <div className="pt-2 flex flex-wrap gap-2">

                          <Button
                            size="sm"
                            className="flex-1"
                            variant="secondary"
                            disabled={!printerConnected || isBtPrinting[o.id]}
                            onClick={() => handleDirectPrint(o)}
                          >
                            <Printer className="w-4 h-4 mr-1" />
                            {isBtPrinting[o.id] ? 'Printing…' : 'Print'}
                          </Button>
                          <Button
                            size="sm"
                            className="flex-1"
                            variant="destructive"
                            onClick={() => onDelete(o.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                {filteredOrders.length === 0 && (
                  <div className="py-6 text-center text-muted-foreground">
                    No orders for this period.
                  </div>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-muted-foreground">
                    <tr className="border-b">
                      <th className="py-2 pr-4">Order Number</th>
                      <th className="py-2 pr-4">Customer</th>
                      <th className="py-2 pr-4">Remark</th>
                      <th className="py-2 pr-4">Items</th>
                      <th className="py-2 pr-4">Total</th>
                      <th className="py-2 pr-4">Order Date</th>
                      <th className="py-2 pr-4">Delivery Date</th>
                      <th className="py-2 pr-0 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map((o) => {
                      const total = o.items.reduce((s, it) => s + it.qty * it.price, 0);
                      return (
                        <tr key={o.id} className="border-b last:border-0">
                          <td className="py-2 pr-4 font-medium">{o.id}</td>
                          <td className="py-2 pr-4">{o.customerName || '-'}</td>
                          <td className="py-2 pr-4">{o.remark || '-'}</td>
                          <td className="py-2 pr-4">
                            {o.items.map((item) => (
                              <div key={item.id}>
                                {item.name} (Qty: {item.qty})
                              </div>
                            ))}
                          </td>
                          <td className="py-2 pr-4">{formatINR(total)}</td>
                          <td className="py-2 pr-4">{formatDateTime(o.createdAt)}</td>
                          <td className="py-2 pr-4">
                            {o.deliveryDate ? formatDateTime(o.deliveryDate) : ''}
                          </td>
                          <td className="py-2 pr-0 text-right">
                            <div className="flex justify-end gap-2">

                              <Button
                                size="sm"
                                variant="secondary"
                                disabled={!printerConnected || isBtPrinting[o.id]}
                                onClick={() => handleDirectPrint(o)}
                              >
                                <Printer className="w-4 h-4 mr-1" />
                                {isBtPrinting[o.id] ? '…' : 'Print'}
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => onDelete(o.id)}
                              >
                                Delete
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredOrders.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-6 text-center text-muted-foreground">
                          No orders for this period.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {error && <div className="text-red-600 mt-2">{error}</div>}

            {filteredOrders.length > 0 && (
              <div className="mt-4">
                <Button size="sm" variant="destructive" onClick={deleteAllOrders}>
                  Delete All
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}