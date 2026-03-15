// ── 3-inch (80mm) thermal printer — FIXED at 48 chars/line ──
import type { Order } from '@/types';

const LINE_W = 48;
const COL_NAME = 24;  // Item name col width
const COL_QTY = 6;   // Qty col width
const COL_PRICE = 9;  // Unit price col width
const COL_AMT = 9;   // Line total col width
// 24 + 6 + 9 + 9 = 48 chars ✅

// ── BLE Printer GATT Profiles (try all until one succeeds) ──
const PRINTER_PROFILES = [
  {
    service: '000018f0-0000-1000-8000-00805f9b34fb',
    characteristic: '00002af1-0000-1000-8000-00805f9b34fb',
  },
  {
    service: 'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
    characteristic: 'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f',
  },
  {
    service: '49535343-fe7d-4ae5-8fa9-9fafd205e455',
    characteristic: '49535343-8841-43f4-a8d4-ecbe34729bb3',
  },
  {
    service: '0000ff00-0000-1000-8000-00805f9b34fb',
    characteristic: '0000ff02-0000-1000-8000-00805f9b34fb',
  },
];

// ── Module-level connection cache (persists across React re-renders) ──
let cachedCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
let cachedDeviceName: string = '';

export function isPrinterConnected(): boolean {
  return cachedCharacteristic !== null;
}

export function getConnectedPrinterName(): string {
  return cachedDeviceName;
}

export function disconnectPrinter(): void {
  cachedCharacteristic = null;
  cachedDeviceName = '';
}

export async function connectPrinter(): Promise<string> {
  if (!navigator.bluetooth) {
    const nav = navigator as any;
    const isBrave = typeof nav.brave?.isBrave === 'function' && (await nav.brave.isBrave());

    if (isBrave) {
      throw new Error(
        'Web Bluetooth is disabled in Brave by default. Please go to `brave://flags`, search for "Web Bluetooth API", set it to "Enabled", and relaunch the browser.'
      );
    }

    throw new Error(
      'Web Bluetooth is not supported in this browser. Please use Chrome or Edge.'
    );
  }

  const allServiceUUIDs = PRINTER_PROFILES.map((p) => p.service);

  const device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: allServiceUUIDs,
  });

  device.addEventListener('gattserverdisconnected', () => {
    cachedCharacteristic = null;
    cachedDeviceName = '';
  });

  const server = await device.gatt!.connect();
  cachedDeviceName = device.name ?? 'Bluetooth Printer';

  for (const profile of PRINTER_PROFILES) {
    try {
      const service = await server.getPrimaryService(profile.service);
      const characteristic = await service.getCharacteristic(profile.characteristic);
      cachedCharacteristic = characteristic;
      return cachedDeviceName;
    } catch {
      // Try next profile
    }
  }

  throw new Error(
    'Could not find a compatible GATT service on this printer. Please check the device.'
  );
}

// ── Send data in 100-byte chunks with 30ms delay ──
async function sendChunked(data: Uint8Array): Promise<void> {
  if (!cachedCharacteristic) throw new Error('Printer not connected');
  const CHUNK_SIZE = 100;
  for (let i = 0; i < data.length; i += CHUNK_SIZE) {
    const chunk = data.slice(i, i + CHUNK_SIZE);
    await cachedCharacteristic.writeValue(chunk);
    await new Promise((res) => setTimeout(res, 30));
  }
}

export async function sendRawBytes(data: Uint8Array): Promise<void> {
  await sendChunked(data);
}

// ── String helpers ──
function centerText(text: string, width = LINE_W): string {
  const trimmed = text.slice(0, width);
  const totalPad = width - trimmed.length;
  const leftPad = Math.floor(totalPad / 2);
  return ' '.repeat(leftPad) + trimmed + ' '.repeat(totalPad - leftPad);
}

function padRight(text: string, width: number): string {
  const t = text.slice(0, width);
  return t + ' '.repeat(width - t.length);
}

function padLeft(text: string, width: number): string {
  const t = text.slice(0, width);
  return ' '.repeat(width - t.length) + t;
}

function divider(): string {
  return '-'.repeat(LINE_W);
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

// ── Build the full ESC/POS receipt bytes ──
export function buildReceiptBLE(order: Order): Uint8Array {
  const encoder = new TextEncoder();
  const buffer: number[] = [];

  // Init printer
  buffer.push(0x1b, 0x40);

  // ── 1. CENTER ALIGNMENT FOR HEADER ──
  buffer.push(0x1b, 0x61, 0x01); 

  // Bold ON for Title
  buffer.push(0x1b, 0x45, 0x01); 
  // 18 manual leading spaces to perfectly balance visual offsets
  buffer.push(...encoder.encode('                  VELA DRY WASH\n'));
  buffer.push(0x1b, 0x45, 0x00); // Bold OFF

  buffer.push(...encoder.encode(centerText('Fully Mechanised Laundry Enterprise') + '\n'));
  buffer.push(...encoder.encode(centerText('Arasa Thottam, Sellipalayam,') + '\n'));
  buffer.push(...encoder.encode(centerText('Uthukuli - 638 751') + '\n'));
  buffer.push(...encoder.encode(centerText('Mob: 95664 42121') + '\n'));

  // ── 2. LEFT ALIGNMENT FOR BODY ──
  buffer.push(0x1b, 0x61, 0x00); 

  buffer.push(...encoder.encode(divider()));
  buffer.push(...encoder.encode(`Order Date: ${formatDate(order.createdAt)}\n`));
  if (order.deliveryDate) {
    buffer.push(...encoder.encode(`Delivery Date: ${formatDate(order.deliveryDate)}\n`));
  }
  buffer.push(...encoder.encode(`Order: ${order.id}\n`));
  buffer.push(...encoder.encode(`Customer: ${order.customerName || '-'}\n`));
  if (order.remark) {
    buffer.push(...encoder.encode(`Remark: ${order.remark}\n`));
  }
  buffer.push(...encoder.encode(divider()));

  // ── Items Table Header (Bold) ──
  buffer.push(0x1b, 0x45, 0x01); // Bold ON
  const headerLine =
    padRight('Item', COL_NAME) +
    padLeft('Qty', COL_QTY) +
    padLeft('Price', COL_PRICE) +
    padLeft('Total', COL_AMT);
  buffer.push(...encoder.encode(headerLine + '\n'));
  buffer.push(0x1b, 0x45, 0x00); // Bold OFF
  buffer.push(...encoder.encode(divider()));

  // Items
  let grandTotal = 0;
  for (const item of order.items) {
    const lineTotal = item.qty * item.price;
    grandTotal += lineTotal;
    const namePart = padRight(item.name || '-', COL_NAME);
    const qtyPart = padLeft(String(item.qty), COL_QTY);
    const pricePart = padLeft(`₹${item.price.toFixed(2)}`, COL_PRICE);
    const amtPart = padLeft(`₹${lineTotal.toFixed(2)}`, COL_AMT);
    buffer.push(...encoder.encode(namePart + qtyPart + pricePart + amtPart + '\n'));
  }

  buffer.push(...encoder.encode(divider()));

  // Subtotal
  const subtotalLabel = padRight('Subtotal:', COL_NAME + COL_QTY + COL_PRICE);
  const subtotalAmt = padLeft(`₹${grandTotal.toFixed(2)}`, COL_AMT);
  buffer.push(...encoder.encode(subtotalLabel + subtotalAmt + '\n'));
  buffer.push(...encoder.encode(divider()));

  // Total
  const totalLabel = padRight('Total:', COL_NAME + COL_QTY + COL_PRICE);
  const totalAmt = padLeft(`₹${grandTotal.toFixed(2)}`, COL_AMT);
  buffer.push(...encoder.encode(totalLabel + totalAmt + '\n'));
  buffer.push(...encoder.encode(divider() + '\n'));

  // ── 3. CENTER ALIGNMENT FOR FOOTER ──
  buffer.push(0x1b, 0x61, 0x01); 
  buffer.push(...encoder.encode('Thank you!\n\n'));

  // Paper Feed & Cut
  buffer.push(0x1b, 0x64, 0x03); // Feed 3 lines
  buffer.push(0x1d, 0x56, 0x42, 0x00); // Cut paper

  return new Uint8Array(buffer);
}

export async function printReceiptBLE(order: Order): Promise<void> {
  if (!cachedCharacteristic) throw new Error('Printer not connected');
  const bytes = buildReceiptBLE(order);
  await sendChunked(bytes);
}

export async function printTestBLE(): Promise<void> {
  if (!cachedCharacteristic) throw new Error('Printer not connected');
  const encoder = new TextEncoder();
  const ESC_INIT = new Uint8Array([0x1b, 0x40]);
  const testText = encoder.encode('\n' + centerText('VELA DRY WASH - Printer OK') + '\n\n\n');
  const PAPER_FEED = new Uint8Array([0x1b, 0x64, 0x03]);
  const totalLen = ESC_INIT.length + testText.length + PAPER_FEED.length;
  const result = new Uint8Array(totalLen);
  let offset = 0;
  result.set(ESC_INIT, offset); offset += ESC_INIT.length;
  result.set(testText, offset); offset += testText.length;
  result.set(PAPER_FEED, offset);
  await sendChunked(result);
}
