import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Seo } from '@/components/Seo';
import { Order, OrderItem } from '@/types';
import { addOrder } from '@/store/orders';
import { formatINR } from '@/utils/format';
import { useIsMobile } from '@/hooks/use-mobile';
import { NavBar } from '@/components/NavBar';
import { OfflineBanner } from '@/components/OfflineBanner';
import { printReceiptBLE, isPrinterConnected, connectPrinter, disconnectPrinter, getConnectedPrinterName } from '@/utils/bluetoothPrinter';
import { toast } from 'sonner';
import { Bluetooth, BluetoothOff, BluetoothSearching } from 'lucide-react';
import { localDb } from '@/db/localDb';

function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}

function getCurrentTime() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

export default function OrderPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // Bluetooth State
  const [isConnecting, setIsConnecting] = useState(false);
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

  const [customerName, setCustomerName] = useState('');
  const [remark, setRemark] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [items, setItems] = useState<OrderItem[]>([
    { id: crypto.randomUUID(), name: '', qty: 1, price: 0 },
  ]);
  const [activeInputId, setActiveInputId] = useState<string | null>(null);
  const [itemSearchTerms, setItemSearchTerms] = useState<{ [key: string]: string }>({});
  const [customerSearchTerm, setCustomerSearchTerm] = useState<string>('');
  const inputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  const customerInputRef = useRef<HTMLInputElement | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);

  const [orderDate, setOrderDate] = useState<string>(getTodayDate());
  const [orderTime, setOrderTime] = useState<string>(getCurrentTime());
  const [deliveryDate, setDeliveryDate] = useState<string>('');
  const [deliveryTime, setDeliveryTime] = useState<string>('');

  const resetForm = () => {
    setCustomerName('');
    setRemark('');
    setOrderNumber('');
    setItems([{ id: crypto.randomUUID(), name: '', qty: 1, price: 0 }]);
    setItemSearchTerms({});
    setCustomerSearchTerm('');
    setOrderDate(getTodayDate());
    setOrderTime(getCurrentTime());
    setDeliveryDate('');
    setDeliveryTime('');
    setIsPrinting(false);
  };

  useEffect(() => {
    resetForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const total = items.reduce(
    (sum, it) => sum + (Number(it.qty) || 0) * (Number(it.price) || 0),
    0
  );

  const [itemSuggestions, setItemSuggestions] = useState<string[]>([]);
  const [customerSuggestions, setCustomerSuggestions] = useState<string[]>([]);

  useEffect(() => {
    const loadSuggestions = async () => {
      try {
        const items = await localDb.suggestedItems.toArray();
        const customers = await localDb.suggestedCustomers.toArray();
        setItemSuggestions(items.map((i) => i.name));
        setCustomerSuggestions(customers.map((c) => c.name));
      } catch (err) {
        console.error('Failed to load suggestions:', err);
      }
    };
    loadSuggestions();
  }, []);

  const filteredItemSuggestions = (itemId: string) =>
    itemSuggestions.filter((item) =>
      item.toLowerCase().includes((itemSearchTerms[itemId] || '').toLowerCase())
    );

  const filteredCustomerSuggestions = customerSuggestions.filter((customer) =>
    customer.toLowerCase().includes(customerSearchTerm.toLowerCase())
  );

  const addItem = () =>
    setItems((prev) => [...prev, { id: crypto.randomUUID(), name: '', qty: 1, price: 0 }]);

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    setItemSearchTerms((prev) => {
      const newTerms = { ...prev };
      delete newTerms[id];
      return newTerms;
    });
  };

  const updateItem = (id: string, patch: Partial<OrderItem>) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const handleInputFocus = (id: string) => setActiveInputId(id);
  const handleCustomerInputFocus = () => setActiveInputId('customer');

  const handleInputChange = (id: string, value: string) => {
    setItemSearchTerms((prev) => ({ ...prev, [id]: value }));
    updateItem(id, { name: value });
  };

  const handleCustomerInputChange = (value: string) => {
    setCustomerSearchTerm(value);
    setCustomerName(value);
  };

  const handleSuggestionClick = (id: string, suggestion: string) => {
    updateItem(id, { name: suggestion });
    setItemSearchTerms((prev) => ({ ...prev, [id]: suggestion }));
    setActiveInputId(null);
    inputRefs.current[id]?.blur();
  };

  const handleCustomerSuggestionClick = (suggestion: string) => {
    setCustomerName(suggestion);
    setCustomerSearchTerm(suggestion);
    setActiveInputId(null);
    customerInputRef.current?.blur();
  };

  const onPrint = async () => {
    if (isPrinting) return;

    if (!orderNumber.trim()) {
      alert('Please enter an order number');
      return;
    }

    const filteredItems = items.filter((i) => i.name.trim() !== '');
    if (filteredItems.length === 0) {
      alert('Please add at least one item');
      return;
    }

    setIsPrinting(true);

    try {
      const createdAtISO =
        orderDate && orderTime
          ? new Date(`${orderDate}T${orderTime}`).toISOString()
          : new Date().toISOString();

      const deliveryDateISO = deliveryDate
        ? new Date(`${deliveryDate}T${deliveryTime || '00:00'}`).toISOString()
        : undefined;

      const order: Order = {
        id: orderNumber,
        customerName,
        remark,
        createdAt: createdAtISO,
        deliveryDate: deliveryDateISO,
        items: filteredItems,
      };

      await addOrder(order);
      
      if (isPrinterConnected()) {
        try {
          await printReceiptBLE(order);
          toast.success('✅ Order created and printed successfully');
        } catch (err) {
          toast.error('⚠️ Order saved, but Bluetooth print failed');
        }
      } else {
        toast.warning('⚠️ Order saved — connect printer on Dashboard to print');
      }

      resetForm();
      navigate('/dashboard');
    } catch (error) {
      console.error('Failed to create order:', error);
      toast.error('Failed to create order. Please try again.');
      setIsPrinting(false);
    }
  };

  return (
    <main className="min-h-screen bg-background">
      <Seo
        title="New Order | Vela Dry Wash POS"
        description="Create a new laundry order, add items, and print an 80mm thermal receipt."
        canonicalPath="/order"
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

      <section className="container space-y-6 py-6 pb-24 md:pb-12">
        <h1 className="text-2xl md:text-3xl font-bold">New Order</h1>

        {/* Customer Details */}
        <Card className="bg-secondary">
          <CardHeader>
            <CardTitle>Customer Details</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Customer Name */}
            <div className="space-y-2">
              <Label htmlFor="customer">Customer Name</Label>
              <div className="relative">
                <Input
                  id="customer"
                  ref={customerInputRef}
                  placeholder="Enter customer name"
                  value={customerName}
                  onChange={(e) => handleCustomerInputChange(e.target.value)}
                  onFocus={handleCustomerInputFocus}
                  onBlur={() => setTimeout(() => setActiveInputId(null), 200)}
                />
                {activeInputId === 'customer' && filteredCustomerSuggestions.length > 0 && (
                  <div className="absolute z-10 w-full max-h-40 overflow-y-auto bg-card border border-input rounded-md mt-1 shadow-lg">
                    {filteredCustomerSuggestions.map((suggestion) => (
                      <div
                        key={suggestion}
                        className="px-3 py-2 hover:bg-accent cursor-pointer text-sm"
                        onMouseDown={() => handleCustomerSuggestionClick(suggestion)}
                      >
                        {suggestion}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Remark */}
            <div className="space-y-2">
              <Label htmlFor="remark">Remark</Label>
              <Input
                id="remark"
                placeholder="Enter remark"
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
              />
            </div>

            {/* Order Number */}
            <div className="space-y-2">
              <Label htmlFor="orderNumber">Order Number</Label>
              <Input
                id="orderNumber"
                placeholder="Enter order number"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
              />
            </div>

            {/* Dates */}
            <div className="space-y-2">
              <div className="font-semibold text-base mb-1">Order &amp; Delivery Dates</div>
              <div className="flex flex-col gap-3">
                <div>
                  <Label className="text-xs mb-1 block">Order Date &amp; Time</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      id="order-date"
                      type="date"
                      value={orderDate}
                      onChange={(e) => setOrderDate(e.target.value)}
                    />
                    <Input
                      id="order-time"
                      type="time"
                      value={orderTime}
                      onChange={(e) => setOrderTime(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs mb-1 block">Delivery Date &amp; Time</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      id="delivery-date"
                      type="date"
                      value={deliveryDate}
                      onChange={(e) => setDeliveryDate(e.target.value)}
                    />
                    <Input
                      id="delivery-time"
                      type="time"
                      value={deliveryTime}
                      onChange={(e) => setDeliveryTime(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Order Items */}
        <Card className="bg-secondary">
          <CardHeader className="flex-row items-center justify-between gap-3">
            <CardTitle>Order Items</CardTitle>
            <Button size="sm" onClick={addItem}>+ Add Item</Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="hidden md:grid grid-cols-12 text-sm font-medium text-muted-foreground">
              <div className="col-span-6">Item</div>
              <div className="col-span-2">Qty</div>
              <div className="col-span-2">Price</div>
              <div className="col-span-2 text-right">Amount</div>
            </div>

            <div className="space-y-3">
              {items.map((it) => {
                const amount = (Number(it.qty) || 0) * (Number(it.price) || 0);
                return (
                  <div
                    key={it.id}
                    className="rounded-md border bg-card p-3 md:p-0 md:border-0 relative"
                  >
                    {/* Mobile */}
                    <div className="grid gap-3 md:hidden">
                      <div className="space-y-1">
                        <Label className="text-xs">Item</Label>
                        <div className="relative">
                          <Input
                            ref={(el) => (inputRefs.current[it.id] = el)}
                            placeholder="Item name"
                            value={it.name}
                            onChange={(e) => handleInputChange(it.id, e.target.value)}
                            onFocus={() => handleInputFocus(it.id)}
                            onBlur={() => setTimeout(() => setActiveInputId(null), 200)}
                          />
                          {activeInputId === it.id && filteredItemSuggestions(it.id).length > 0 && (
                            <div className="absolute z-10 w-full max-h-40 overflow-y-auto bg-card border border-input rounded-md mt-1 shadow-lg">
                              {filteredItemSuggestions(it.id).map((suggestion) => (
                                <div
                                  key={suggestion}
                                  className="px-3 py-2 hover:bg-accent cursor-pointer text-sm"
                                  onMouseDown={() => handleSuggestionClick(it.id, suggestion)}
                                >
                                  {suggestion}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Qty</Label>
                          <Input
                            type="number"
                            min={0}
                            value={it.qty}
                            onChange={(e) => updateItem(it.id, { qty: Number(e.target.value) })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Price</Label>
                          <Input
                            type="number"
                            min={0}
                            value={it.price}
                            onChange={(e) => updateItem(it.id, { price: Number(e.target.value) })}
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="text-sm">Amount</div>
                        <div className="text-base font-semibold">{formatINR(amount)}</div>
                      </div>
                      <div className="flex justify-end">
                        <Button variant="ghost" type="button" onClick={() => removeItem(it.id)}>
                          Remove
                        </Button>
                      </div>
                    </div>

                    {/* Desktop */}
                    <div className="hidden md:grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-6 relative">
                        <Input
                          ref={(el) => (inputRefs.current[it.id] = el)}
                          placeholder="Item name"
                          value={it.name}
                          onChange={(e) => handleInputChange(it.id, e.target.value)}
                          onFocus={() => handleInputFocus(it.id)}
                          onBlur={() => setTimeout(() => setActiveInputId(null), 200)}
                        />
                        {activeInputId === it.id && filteredItemSuggestions(it.id).length > 0 && (
                          <div className="absolute z-10 w-full max-h-40 overflow-y-auto bg-card border border-input rounded-md mt-1 shadow-lg">
                            {filteredItemSuggestions(it.id).map((suggestion) => (
                              <div
                                key={suggestion}
                                className="px-3 py-2 hover:bg-accent cursor-pointer text-sm"
                                onMouseDown={() => handleSuggestionClick(it.id, suggestion)}
                              >
                                {suggestion}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <Input
                        className="col-span-2"
                        type="number"
                        value={it.qty}
                        min={0}
                        onChange={(e) => updateItem(it.id, { qty: Number(e.target.value) })}
                      />
                      <Input
                        className="col-span-2"
                        type="number"
                        value={it.price}
                        min={0}
                        onChange={(e) => updateItem(it.id, { price: Number(e.target.value) })}
                      />
                      <div className="col-span-2 text-right font-medium">{formatINR(amount)}</div>
                      <div className="col-span-12 flex justify-end">
                        <Button variant="ghost" type="button" onClick={() => removeItem(it.id)}>
                          Remove
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Total + Submit */}
        <Card className="bg-secondary">
          <CardContent className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 py-6">
            <div className="text-lg font-semibold">Total Amount:</div>
            <div className="text-2xl font-bold">{formatINR(total)}</div>
            <Button
              id="print-receipt-btn"
              onClick={onPrint}
              className="w-full md:w-auto"
              disabled={isPrinting}
            >
              {isPrinting ? 'Processing...' : 'Print Receipt'}
            </Button>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
