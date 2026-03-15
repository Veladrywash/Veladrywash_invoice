import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Seo } from '@/components/Seo';
import { NavBar } from '@/components/NavBar';
import {
  connectPrinter,
  disconnectPrinter,
  isPrinterConnected,
  getConnectedPrinterName,
  printTestBLE,
} from '@/utils/bluetoothPrinter';
import { localDb } from '@/db/localDb';
import { toast } from 'sonner';
import { Eye, EyeOff, Bluetooth, BluetoothOff, BluetoothSearching, Trash2, PrinterIcon, Pencil, Check, X, Plus } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

const SuggestionsManager = ({
  title,
  description,
  dbTable,
}: {
  title: string;
  description: string;
  dbTable: any;
}) => {
  const [items, setItems] = useState<any[]>([]);
  const [newVal, setNewVal] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editVal, setEditVal] = useState('');

  const loadItems = async () => {
    try {
      const data = await dbTable.toArray();
      setItems(data);
    } catch (err) {
      console.error('Failed to load items:', err);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  const handleAdd = async () => {
    if (!newVal.trim()) return;
    try {
      await dbTable.add({ name: newVal.trim() });
      setNewVal('');
      loadItems();
      toast.success('Added successfully');
    } catch {
      toast.error('Failed to add. Item might already exist.');
    }
  };

  const handleDelete = async (id?: number) => {
    if (!id) return;
    try {
      await dbTable.delete(id);
      loadItems();
      toast.success('Deleted');
    } catch {
      toast.error('Failed to delete');
    }
  };

  const handleEditSave = async (id?: number) => {
    if (!id || !editVal.trim()) return;
    try {
      await dbTable.update(id, { name: editVal.trim() });
      setEditingId(null);
      loadItems();
      toast.success('Updated');
    } catch {
      toast.error('Failed to update');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder={`Add new ${title.toLowerCase()}`}
          value={newVal}
          onChange={(e) => setNewVal(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <Button onClick={handleAdd} size="icon" variant="secondary">
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      <div className="border rounded-md divide-y max-h-60 overflow-y-auto bg-card">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground p-3 text-center">No items added yet</p>
        ) : (
          items.map((item) => (
            <div key={item.id} className="flex items-center justify-between p-2 text-sm">
              {editingId === item.id ? (
                <div className="flex items-center gap-2 flex-1">
                  <Input
                    value={editVal}
                    onChange={(e) => setEditVal(e.target.value)}
                    className="h-8 py-1"
                    onKeyDown={(e) => e.key === 'Enter' && handleEditSave(item.id)}
                  />
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" onClick={() => handleEditSave(item.id)}>
                    <Check className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setEditingId(null)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <span className="font-medium text-foreground">{item.name}</span>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setEditingId(item.id);
                        setEditVal(item.name);
                      }}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(item.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default function Settings() {
  // ── PIN Change ──────────────────────────────────────────────
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPins, setShowPins] = useState(false);
  const [pinError, setPinError] = useState('');

  const handlePinChange = () => {
    setPinError('');
    const storedPin = localStorage.getItem('vdw_pin') || '1234';

    if (currentPin !== storedPin) {
      setPinError('Current PIN is incorrect.');
      return;
    }
    if (!newPin) {
      setPinError('New PIN cannot be empty.');
      return;
    }
    if (newPin !== confirmPin) {
      setPinError('New PIN and Confirm PIN do not match.');
      return;
    }

    localStorage.setItem('vdw_pin', newPin);
    setCurrentPin('');
    setNewPin('');
    setConfirmPin('');
    toast.success('✅ PIN updated successfully');
  };

  // ── Bluetooth Printer ───────────────────────────────────────
  const [isConnecting, setIsConnecting] = useState(false);
  const [isTestPrinting, setIsTestPrinting] = useState(false);
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

  const handleTestPrint = async () => {
    setIsTestPrinting(true);
    setPrinterError('');
    try {
      await printTestBLE();
      toast.success('✅ Test page printed successfully');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Test print failed';
      setPrinterError(msg);
      toast.error(msg);
    } finally {
      setIsTestPrinting(false);
    }
  };

  // ── Danger Zone ─────────────────────────────────────────────
  const [clearConfirm1, setClearConfirm1] = useState(false);
  const [clearConfirm2, setClearConfirm2] = useState(false);

  // ── Data Backup / Restore ───────────────────────────────────
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const orders = await localDb.orders.toArray();
      const exportObject = {
        version: 1,
        backupTime: new Date().toISOString(),
        orders: orders
      };
      const jsonString = JSON.stringify(exportObject, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vela_dry_wash_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('✅ Data exported successfully');
    } catch (err: unknown) {
      toast.error('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const data = JSON.parse(text);

        if (!data.orders || !Array.isArray(data.orders)) {
          throw new Error('Invalid backup file format');
        }

        // Use Dexie bulkPut to restore
        await localDb.orders.bulkPut(data.orders);
        toast.success(`✅ Imported ${data.orders.length} orders successfully`);
      } catch (err: unknown) {
        toast.error('Import failed. Make sure it is a valid backup file.');
      } finally {
        setIsImporting(false);
        e.target.value = ''; // Clear input
      }
    };
    reader.readAsText(file);
  };

  const handleClearLocalOrders = async () => {
    if (!clearConfirm1) {
      setClearConfirm1(true);
      toast.warning('⚠️ Click again to confirm clearing all local orders');
      return;
    }
    if (!clearConfirm2) {
      setClearConfirm2(true);
      toast.warning('⚠️ This is irreversible. Click one more time to proceed.');
      return;
    }
    try {
      await localDb.orders.clear();
      setClearConfirm1(false);
      setClearConfirm2(false);
      toast.success('✅ All local orders cleared');
    } catch {
      toast.error('Failed to clear local orders.');
    }
  };

  return (
    <main className="min-h-screen bg-background">
      <Seo
        title="Settings | Vela Dry Wash POS"
        description="Admin settings — PIN, Bluetooth printer, and danger zone."
        canonicalPath="/settings"
      />
      <NavBar />

      <section className="container py-6 pb-12 space-y-6 max-w-2xl">
        <h1 className="text-2xl md:text-3xl font-bold">Settings</h1>

        {/* ── Section 1: Security / PIN Change ── */}
        <Card>
          <CardHeader>
            <CardTitle>Security — Change PIN</CardTitle>
            <CardDescription>
              Change your admin login PIN. Default PIN is <code>1234</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="current-pin">Current PIN</Label>
                <div className="relative">
                  <Input
                    id="current-pin"
                    type={showPins ? 'text' : 'password'}
                    inputMode="numeric"
                    placeholder="Enter current PIN"
                    value={currentPin}
                    onChange={(e) => setCurrentPin(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPins((v) => !v)}
                    tabIndex={-1}
                  >
                    {showPins ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="new-pin">New PIN</Label>
                <Input
                  id="new-pin"
                  type={showPins ? 'text' : 'password'}
                  inputMode="numeric"
                  placeholder="Enter new PIN"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="confirm-pin">Confirm New PIN</Label>
                <Input
                  id="confirm-pin"
                  type={showPins ? 'text' : 'password'}
                  inputMode="numeric"
                  placeholder="Confirm new PIN"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value)}
                />
              </div>
            </div>

            {pinError && (
              <p className="text-sm text-destructive font-medium">{pinError}</p>
            )}

            <Button onClick={handlePinChange} className="w-full md:w-auto">
              Save New PIN
            </Button>
          </CardContent>
        </Card>

        {/* ── Section 2: Bluetooth Printer ── */}
        <Card>
          <CardHeader>
            <CardTitle>Bluetooth Printer</CardTitle>
            <CardDescription>
              Connect and test your 80mm Bluetooth thermal printer.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!hasBluetooth ? (
              <p className="text-sm text-amber-600 font-medium flex items-center gap-2">
                <BluetoothOff className="w-4 h-4" />
                ⚠️ Bluetooth requires Chrome or Edge browser.
              </p>
            ) : (
              <>
                {printerConnected ? (
                  <div className="flex items-center gap-3">
                    <Bluetooth className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium text-green-700">{printerName}</span>
                    <span className="text-xs text-muted-foreground">(Connected)</span>
                  </div>
                ) : isConnecting ? (
                  <div className="flex items-center gap-2 text-blue-600">
                    <BluetoothSearching className="w-4 h-4 animate-pulse" />
                    <span className="text-sm">Connecting…</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <BluetoothOff className="w-4 h-4" />
                    <span className="text-sm">No printer connected</span>
                  </div>
                )}

                <div className="flex gap-2 flex-wrap">
                  {printerConnected ? (
                    <Button variant="outline" onClick={handleDisconnect}>
                      <BluetoothOff className="w-4 h-4 mr-2" />
                      Disconnect
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={handleConnect} disabled={isConnecting}>
                      <Bluetooth className="w-4 h-4 mr-2" />
                      Connect Printer
                    </Button>
                  )}

                  <Button
                    variant="secondary"
                    onClick={handleTestPrint}
                    disabled={!printerConnected || isTestPrinting}
                  >
                    <PrinterIcon className="w-4 h-4 mr-2" />
                    {isTestPrinting ? 'Printing…' : 'Test Print'}
                  </Button>
                </div>

                {printerError && (
                  <p className="text-sm text-destructive">{printerError}</p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* ── Section 3: Data Backup & Restore ── */}
        <Card>
          <CardHeader>
            <CardTitle>Data Management</CardTitle>
            <CardDescription>
              Export all local orders for backups or import from a previous file.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-4">
              <div className="space-y-2">
                <p className="text-sm font-medium">Backup Data</p>
                <p className="text-xs text-muted-foreground">
                  Download all local IndexedDB order rows into a <code>.json</code> file.
                </p>
                <Button onClick={handleExportData} disabled={isExporting} className="w-full md:w-auto">
                  {isExporting ? 'Exporting…' : 'Export Data (.json)'}
                </Button>
              </div>

              <hr />

              <div className="space-y-2">
                <p className="text-sm font-medium">Restore Data</p>
                <p className="text-xs text-muted-foreground">
                  Select a backup <code>.json</code> file to restore orders to this device.
                </p>
                <div className="relative">
                  <Input
                    type="file"
                    accept=".json"
                    onChange={handleImportData}
                    disabled={isImporting}
                    className="max-w-md"
                  />
                  {isImporting && (
                    <span className="absolute right-3 top-2.5 text-xs text-blue-600 animate-pulse">
                      Importing…
                    </span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        {/* ── Section 4: Manage Suggestions ── */}
        <Card>
          <CardHeader>
            <CardTitle>Manage Suggestions</CardTitle>
            <CardDescription>
              Add, edit, or delete recommendations for items and customer names.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="items" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="items">Items</TabsTrigger>
                <TabsTrigger value="customers">Customers</TabsTrigger>
              </TabsList>

              <TabsContent value="items">
                <SuggestionsManager title="Item" description="Manage suggested items" dbTable={localDb.suggestedItems} />
              </TabsContent>

              <TabsContent value="customers">
                <SuggestionsManager title="Customer" description="Manage suggested customers" dbTable={localDb.suggestedCustomers} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* ── Section 5: Danger Zone ── */}
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
            <CardDescription>
              Irreversible actions. Proceed with extreme caution.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md bg-destructive/10 border border-destructive/30 p-4 space-y-2">
              <p className="text-sm font-semibold">Clear All Local Orders</p>
              <p className="text-xs text-muted-foreground">
                Deletes all orders from this device's local IndexedDB only.
                This cannot be undone.
              </p>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleClearLocalOrders}
                className="w-full md:w-auto"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {!clearConfirm1
                  ? 'Clear All Local Orders'
                  : !clearConfirm2
                  ? '⚠️ Are you sure? Click again'
                  : '🔴 Final confirmation — Click to delete'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
