import { createClient } from './client';

// Edge Functions utility functions
export class EdgeFunctions {
  private supabase = createClient();

  /**
   * Get delivery quote using Edge Function
   */
  async getQuote(params: {
    vehicleTypeId: string;
    pickup: { lat: number; lng: number };
    dropoff: { lat: number; lng: number };
    weightKg?: number;
    surge?: number;
  }) {
    const { data, error } = await this.supabase.functions.invoke('quote', {
      body: params
    });

    if (error) {
      throw new Error(error.message || 'Failed to get quote');
    }

    return data;
  }

  /**
   * Create single delivery using Edge Function
   */
  async bookDelivery(params: {
    vehicleTypeId: string;
    pickup: {
      address: string;
      location: { lat: number; lng: number };
      contactName: string;
      contactPhone: string;
      instructions?: string;
    };
    dropoff: {
      address: string;
      location: { lat: number; lng: number };
      contactName: string;
      contactPhone: string;
      instructions?: string;
    };
    package?: {
      description?: string;
      weightKg?: number;
      value?: number;
    };
    payment?: {
      paymentBy?: 'sender' | 'recipient';
      paymentMethod?: 'cash' | 'creditCard' | 'debitCard' | 'maya';
      paymentStatus?: 'pending' | 'paid' | 'failed';
    };
  }) {
    const { data, error } = await this.supabase.functions.invoke('book-delivery', {
      body: params
    });

    if (error) {
      throw new Error(error.message || 'Failed to create delivery');
    }

    return data;
  }

  /**
   * Create multi-stop delivery using Edge Function
   */
  async createMultiStopDelivery(params: {
    vehicleTypeId: string;
    pickup: {
      address: string;
      location: { lat: number; lng: number };
      contactName: string;
      contactPhone: string;
      instructions?: string;
    };
    dropoffStops: Array<{
      address: string;
      location: { lat: number; lng: number };
      contactName: string;
      contactPhone: string;
      instructions?: string;
    }>;
    package?: {
      description?: string;
      weightKg?: number;
      value?: number;
    };
    payment?: {
      paymentBy?: 'sender' | 'recipient';
      paymentMethod?: 'cash' | 'creditCard' | 'debitCard' | 'maya';
      paymentStatus?: 'pending' | 'paid' | 'failed';
    };
    isScheduled?: boolean;
    scheduledPickupTime?: string;
  }) {
    const { data, error } = await this.supabase.functions.invoke('create-multi-stop-delivery', {
      body: params
    });

    if (error) {
      throw new Error(error.message || 'Failed to create multi-stop delivery');
    }

    return data;
  }

  /**
   * Pair driver with delivery using Edge Function
   */
  async pairDriver(deliveryId: string) {
    const { data, error } = await this.supabase.functions.invoke('pair-driver', {
      body: { deliveryId }
    });

    if (error) {
      throw new Error(error.message || 'Failed to pair driver');
    }

    return data;
  }
}

// Export singleton instance
export const edgeFunctions = new EdgeFunctions();

// Export individual functions for convenience with proper binding
export const getQuote = edgeFunctions.getQuote.bind(edgeFunctions);
export const bookDelivery = edgeFunctions.bookDelivery.bind(edgeFunctions);
export const createMultiStopDelivery = edgeFunctions.createMultiStopDelivery.bind(edgeFunctions);
export const pairDriver = edgeFunctions.pairDriver.bind(edgeFunctions);