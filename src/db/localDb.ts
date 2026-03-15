import Dexie from 'dexie';
import type { Table } from 'dexie';
import type { Order } from '../types';

export interface SuggestedItem {
  id?: number;
  name: string;
}

export interface SuggestedCustomer {
  id?: number;
  name: string;
}

export class VDWLocalDB extends Dexie {
  orders!: Table<Order & { synced?: boolean }, string>;
  suggestedItems!: Table<SuggestedItem, number>;
  suggestedCustomers!: Table<SuggestedCustomer, number>;

  constructor() {
    super('VDWLocalDB');
    this.version(1).stores({
      orders: 'id, customerName, createdAt, synced',
    });
    this.version(2).stores({
      orders: 'id, customerName, createdAt, synced',
      suggestedItems: '++id, &name',
      suggestedCustomers: '++id, &name',
    });
  }
}

export const localDb = new VDWLocalDB();

export const defaultItemSuggestions = [
  'shirt', 'pant', 't-shirt', 'lower', 'inner', 'vest', 'vesti', 'lungi',
  'kerchief', 'socks', 'saree', 'blouse', 'white-pillow-cover', 'white-towel',
  'white-bed-cover-double', 'white-bed-cover-single', 'colour-pillow-cover',
  'colour-towel', 'colour-bed-cover-double', 'colour-bed-cover-single',
  'double-bedcover', 'bed-sheet', 'colour-blanket', 'white-blanket',
];

export const defaultCustomerSuggestions = [
  'JK Residency Toll Plaza', 'JK Resort', 'JK Village Resort Ukl',
  'URC Lodge', 'URC Resort', 'JK Paradise',
];

export async function initializeSuggestions() {
  try {
    const itemCount = await localDb.suggestedItems.count();
    if (itemCount === 0) {
      await localDb.suggestedItems.bulkAdd(
        defaultItemSuggestions.map(name => ({ name }))
      ).catch(e => console.warn('Some items already exist', e));
    }

    const customerCount = await localDb.suggestedCustomers.count();
    if (customerCount === 0) {
      await localDb.suggestedCustomers.bulkAdd(
        defaultCustomerSuggestions.map(name => ({ name }))
      ).catch(e => console.warn('Some customers already exist', e));
    }
  } catch (error) {
    console.error('Failed to initialize suggestions:', error);
  }
}
