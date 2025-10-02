'use server';

import {
  suggestDeliveryStatus,
  type SuggestDeliveryStatusInput,
} from '@/ai/flows/suggest-delivery-status';

export async function getDeliveryStatusSuggestion(input: SuggestDeliveryStatusInput) {
  try {
    const result = await suggestDeliveryStatus(input);
    return {success: true, data: result};
  } catch (error) {
    console.error('Error getting suggestion:', error);
    if (error instanceof Error) {
      return {success: false, error: error.message};
    }
    return {success: false, error: 'An unknown error occurred.'};
  }
}
