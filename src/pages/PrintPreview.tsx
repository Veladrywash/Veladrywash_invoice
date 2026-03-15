import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Order } from '@/types';
import { formatINR } from '@/utils/format';
import '@/styles/print.css';
import { Button } from '@/components/ui/button';
import { Seo } from '@/components/Seo';
import { OfflineBanner } from '@/components/OfflineBanner';
import {
  connectPrinter,
  disconnectPrinter,
  isPrinterConnected,
  getConnectedPrinterName,
  printReceiptBLE,
} from '@/utils/bluetoothPrinter';
import { Bluetooth, BluetoothOff, BluetoothSearching } from 'lucide-react';
import { toast } from 'sonner';
import { useBluetooth } from '@/hooks/use-bluetooth';

export default function PrintPreview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const stateOrder = (location.state as { order?: Order } | undefined)?.order;

  const [order] = useState<Order | undefined>(stateOrder);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isBtPrinting, setIsBtPrinting] = useState(false);
  const [printerConnected, setPrinterConnected] = useState(() => isPrinterConnected());
  const [printerName, setPrinterName] = useState(() => getConnectedPrinterName());
  const [printerError, setPrinterError] = useState('');

  const { hasBluetooth } = useBluetooth();



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

  const handleBtPrint = async () => {
    if (!order) return;
    setIsBtPrinting(true);
    setPrinterError('');
    try {
      await printReceiptBLE(order);
      toast.success('✅ Printed successfully via Bluetooth');
      navigate('/dashboard');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Print failed';
      setPrinterError(msg);
      toast.error(`Print failed: ${msg}`);
    } finally {
      setIsBtPrinting(false);
    }
  };

  if (!order) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Seo
          title="Print Preview | Vela Dry Wash POS"
          description="80mm thermal receipt preview."
          canonicalPath={`/print/${id ?? ''}`}
        />
        <div className="space-y-4 text-center">
          <p>No order data found.</p>
          <Button onClick={() => navigate('/order')}>Back to Order</Button>
        </div>
      </main>
    );
  }

  const total = order.items.reduce((s, it) => s + it.qty * it.price, 0);

  return (
    <main className="min-h-screen flex flex-col items-center py-2">
      <Seo
        title={`Print: ${order.id} | Vela Dry Wash POS`}
        description="80mm thermal receipt preview."
        canonicalPath={`/print/${order.id}`}
      />

      <div className="w-full no-print">
        <OfflineBanner />
      </div>

      {/* ── Control Bar ── */}
      <div className="no-print w-full max-w-2xl px-4 py-3 border-b flex items-center justify-end bg-background">
        <Button size="sm" variant="outline" onClick={() => navigate('/dashboard')}>
          Go to Dashboard
        </Button>
      </div>

      {/* ── Receipt ── */}
      <div className="receipt-root">
        <div className="receipt-center">
          <div className="receipt-title">VELA DRY WASH</div>
          <div className="receipt-small receipt-muted">Fully Mechanised Laundry Enterprise</div>
          <div className="receipt-small">Arasa Thottam, Sellipalayam,</div>
          <div className="receipt-small">Uthukuli - 638 751</div>
          <div className="receipt-small">Mob: 95664 42121</div>
        </div>

        <hr className="receipt-hr" />

        <div className="receipt-small">
          Order Date:{' '}
          {new Date(order.createdAt).toLocaleString([], {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
        </div>
        {order.deliveryDate && (
          <div className="receipt-small">
            Delivery Date:{' '}
            {new Date(order.deliveryDate).toLocaleString([], {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </div>
        )}
        <div className="receipt-small">Order: {order.id}</div>
        <div className="receipt-small">Customer: {order.customerName || '-'}</div>
        {order.remark && (
          <div className="receipt-small">Remark: {order.remark}</div>
        )}

        <hr className="receipt-hr" />

        <div className="items receipt-small">
          <div className="item">
            <div><strong>Item</strong></div>
            <div className="num"><strong>Qty</strong></div>
            <div className="num"><strong>Price</strong></div>
            <div className="num"><strong>Total</strong></div>
          </div>
          <hr className="receipt-hr" />
          {order.items.map((it) => (
            <div className="item" key={it.id}>
              <div>{it.name || '-'}</div>
              <div className="num">{it.qty}</div>
              <div className="num">{formatINR(it.price)}</div>
              <div className="num">{formatINR(it.qty * it.price)}</div>
            </div>
          ))}
        </div>

        <hr className="receipt-hr" />

        <div className="total-row">
          <div>Total:</div>
          <div>{formatINR(total)}</div>
        </div>

        <hr className="receipt-hr" />
        <div className="receipt-center receipt-small">Thank you!</div>

        {/* Print-only timestamp */}
        <div className="receipt-small receipt-center no-screen" style={{ marginTop: 4 }}>
          Printed at:{' '}
          {new Date().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
        </div>
      </div>
    </main>
  );
}
