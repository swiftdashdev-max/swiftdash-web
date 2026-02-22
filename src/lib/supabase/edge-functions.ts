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
   * Create single delivery using Edge Function (Web version with Mapbox & VAT)
   */
  async bookDelivery(params: {
    vehicleTypeId?: string;
    fleetVehicleId?: string;
    assignmentType?: 'manual' | 'auto';
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
    isScheduled?: boolean;
    scheduledPickupTime?: string;
  }) {
    const { data, error } = await this.supabase.functions.invoke('book_delivery_web', {
      body: params
    });

    if (error) {
      throw new Error(error.message || 'Failed to create delivery');
    }

    return data;
  }

  /**
   * Create multi-stop delivery using Edge Function (Web version with Mapbox & VAT)
   */
  async createMultiStopDelivery(params: {
    vehicleTypeId?: string;
    fleetVehicleId?: string;
    assignmentType?: 'manual' | 'auto';
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
      packageDescription?: string;
      packageWeight?: number;
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
    const { data, error } = await this.supabase.functions.invoke('book_multi_stop_delivery_web', {
      body: params
    });

    if (error) {
      throw new Error(error.message || 'Failed to create multi-stop delivery');
    }

    return data;
  }

  /**
   * Send booking confirmation SMS with tracking link
   */
  async sendTrackingSms(params: {
    deliveryId: string;
    isMultiStop?: boolean;
    stopTrackingCodes?: Array<{
      trackingCode: string;
      recipientPhone: string;
      recipientName?: string;
      stopNumber?: number;
    }>;
  }) {
    const { data, error } = await this.supabase.functions.invoke('send-tracking-sms', {
      body: params
    });

    if (error) {
      // Non-fatal — log but don't throw so booking still succeeds
      console.warn('⚠️ SMS send failed (non-fatal):', error.message);
      return null;
    }

    return data;
  }

  /**
   * Send booking confirmation email with tracking link
   */
  async sendTrackingEmail(params: {
    deliveryId: string;
    isMultiStop?: boolean;
    stopTrackingCodes?: Array<{
      trackingCode: string;
      recipientEmail: string;
      recipientName?: string;
      stopNumber?: number;
      address?: string;
    }>;
  }) {
    const { data, error } = await this.supabase.functions.invoke('send-tracking-email', {
      body: params
    });

    if (error) {
      console.warn('⚠️ Email send failed (non-fatal):', error.message);
      return null;
    }

    return data;
  }

  /**
   * Pair driver with delivery using Edge Function
   */
  async pairDriver(deliveryId: string) {
    const { data, error } = await this.supabase.functions.invoke('pair-business-driver', {
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
export const sendTrackingSms = edgeFunctions.sendTrackingSms.bind(edgeFunctions);
export const sendTrackingEmail = edgeFunctions.sendTrackingEmail.bind(edgeFunctions);
export const pairDriver = edgeFunctions.pairDriver.bind(edgeFunctions);