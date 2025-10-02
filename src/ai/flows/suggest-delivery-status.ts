'use server';

/**
 * @fileOverview This file defines a Genkit flow for suggesting delivery statuses based on real-time data.
 *
 * The flow takes real-time data as input and suggests an optimal delivery status.
 * It exports the SuggestDeliveryStatusInput and SuggestDeliveryStatusOutput types, as well as the suggestDeliveryStatus function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestDeliveryStatusInputSchema = z.object({
  currentStatus: z.string().describe('The current status of the delivery.'),
  location: z.string().describe('The current location of the delivery vehicle.'),
  trafficConditions: z.string().describe('The current traffic conditions along the delivery route.'),
  weatherConditions: z.string().describe('The current weather conditions along the delivery route.'),
  scheduledDeliveryTime: z.string().describe('The originally scheduled delivery time.'),
  customerName: z.string().describe('The name of the customer receiving the delivery.'),
  deliveryAddress: z.string().describe('The delivery address.'),
});

export type SuggestDeliveryStatusInput = z.infer<typeof SuggestDeliveryStatusInputSchema>;

const SuggestDeliveryStatusOutputSchema = z.object({
  suggestedStatus: z.string().describe('The suggested delivery status based on the input data.'),
  reason: z.string().describe('The reasoning behind the suggested status.'),
});

export type SuggestDeliveryStatusOutput = z.infer<typeof SuggestDeliveryStatusOutputSchema>;

export async function suggestDeliveryStatus(input: SuggestDeliveryStatusInput): Promise<SuggestDeliveryStatusOutput> {
  return suggestDeliveryStatusFlow(input);
}

const suggestDeliveryStatusPrompt = ai.definePrompt({
  name: 'suggestDeliveryStatusPrompt',
  input: {schema: SuggestDeliveryStatusInputSchema},
  output: {schema: SuggestDeliveryStatusOutputSchema},
  prompt: `You are an AI assistant designed to suggest optimal delivery statuses based on real-time data.

  Consider the following information to determine the most appropriate delivery status for a delivery to {{{customerName}}} at {{{deliveryAddress}}}.

  Current Status: {{{currentStatus}}}
  Location: {{{location}}}
  Traffic Conditions: {{{trafficConditions}}}
  Weather Conditions: {{{weatherConditions}}}
  Scheduled Delivery Time: {{{scheduledDeliveryTime}}}

  Based on this information, suggest a delivery status and provide a brief reason for your suggestion.

  Ensure the suggested status is concise and informative.
  Format the output in JSON format and make sure that the suggestedStatus and reason fields are populated.
  If any of traffic or weather conditions are not available, ignore those factors.
  If no delays are expected given current data, suggest a status that indicates the delivery is on track.
  When suggesting new status, be specific about the timing.  For example, instead of just 'delayed', say "Likely delayed by 15 minutes due to heavy traffic".`,
});

const suggestDeliveryStatusFlow = ai.defineFlow(
  {
    name: 'suggestDeliveryStatusFlow',
    inputSchema: SuggestDeliveryStatusInputSchema,
    outputSchema: SuggestDeliveryStatusOutputSchema,
  },
  async input => {
    const {output} = await suggestDeliveryStatusPrompt(input);
    return output!;
  }
);
