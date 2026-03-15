// store/orders.ts
import { Order } from '@/types';
import { localDb } from '@/db/localDb';

export async function loadOrders(): Promise<Order[]> {
  try {
    // Exclusively load from local IndexedDB
    return await localDb.orders.toArray();
  } catch (error) {
    console.error('Failed to load orders from local storage:', error);
    return [];
  }
}

export async function addOrder(order: Order): Promise<void> {
  try {
    // Always save locally, synced flag is redundant but kept for type compatibility
    await localDb.orders.put({ ...order, synced: true });
  } catch (error) {
    console.error('Failed to add order to local storage:', error);
    throw error;
  }
}

export async function removeOrder(id: string): Promise<void> {
  try {
    await localDb.orders.delete(id);
  } catch (error) {
    console.error('Failed to remove order from local storage:', error);
    throw error;
  }
}

export async function removeAllOrders(): Promise<void> {
  try {
    await localDb.orders.clear();
  } catch (error) {
    console.error('Failed to clear local storage:', error);
    throw error;
  }
}

export async function getOrderById(id: string): Promise<Order | undefined> {
  try {
    return await localDb.orders.get(id);
  } catch (error) {
    console.error('Failed to get order from local storage:', error);
    return undefined;
  }
}

// Dummy sync functions so that existing imports might not break immediately
export async function syncPendingOrders(): Promise<{ synced: number; failed: number }> {
  return { synced: 0, failed: 0 };
}

export async function getUnsyncedCount(): Promise<number> {
  return 0;
}