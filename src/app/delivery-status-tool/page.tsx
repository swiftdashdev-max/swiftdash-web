'use client';

import {useForm} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import {z} from 'zod';
import {Bot, Loader2} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {Input} from '@/components/ui/input';
import {Textarea} from '@/components/ui/textarea';
import {getDeliveryStatusSuggestion} from '../actions';
import {useState} from 'react';
import type {SuggestDeliveryStatusOutput} from '@/ai/flows/suggest-delivery-status';
import {Alert, AlertDescription, AlertTitle} from '@/components/ui/alert';

const formSchema = z.object({
  currentStatus: z.string().min(1, 'Current status is required.'),
  location: z.string().min(1, 'Location is required.'),
  trafficConditions: z.string().min(1, 'Traffic conditions are required.'),
  weatherConditions: z.string().min(1, 'Weather conditions are required.'),
  scheduledDeliveryTime: z.string().min(1, 'Scheduled time is required.'),
  customerName: z.string().min(1, 'Customer name is required.'),
  deliveryAddress: z.string().min(1, 'Delivery address is required.'),
});

type FormData = z.infer<typeof formSchema>;

export default function DeliveryStatusToolPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SuggestDeliveryStatusOutput | null>(null);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      currentStatus: 'In Transit',
      location: 'I-5 North, near downtown exit',
      trafficConditions: 'Heavy',
      weatherConditions: 'Light rain',
      scheduledDeliveryTime: '2024-07-28T15:00:00Z',
      customerName: 'Global Tech Inc.',
      deliveryAddress: '456 Innovation Dr, Tech City',
    },
  });

  async function onSubmit(values: FormData) {
    setLoading(true);
    setResult(null);
    setError(null);
    const response = await getDeliveryStatusSuggestion(values);
    if (response.success) {
      setResult(response.data);
    } else {
      setError(response.error ?? 'An unexpected error occurred.');
    }
    setLoading(false);
  }

  return (
    <div className="flex justify-center items-start py-8">
      <Card className="w-full max-w-2xl rounded-2xl shadow-sm">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardHeader>
              <CardTitle>AI-Enhanced Delivery Status Tool</CardTitle>
              <CardDescription>
                Provide real-time data to get an AI-powered delivery status suggestion.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="customerName"
                  render={({field}) => (
                    <FormItem>
                      <FormLabel>Customer Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="deliveryAddress"
                  render={({field}) => (
                    <FormItem>
                      <FormLabel>Delivery Address</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="currentStatus"
                  render={({field}) => (
                    <FormItem>
                      <FormLabel>Current Status</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="scheduledDeliveryTime"
                  render={({field}) => (
                    <FormItem>
                      <FormLabel>Scheduled Time</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="location"
                render={({field}) => (
                  <FormItem>
                    <FormLabel>Current Location</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="trafficConditions"
                render={({field}) => (
                  <FormItem>
                    <FormLabel>Traffic Conditions</FormLabel>
                    <FormControl>
                      <Textarea {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="weatherConditions"
                render={({field}) => (
                  <FormItem>
                    <FormLabel>Weather Conditions</FormLabel>
                    <FormControl>
                      <Textarea {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter className="flex-col items-start gap-4">
              <Button type="submit" disabled={loading} className="w-full sm:w-auto">
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Bot className="mr-2 h-4 w-4" />
                )}
                Suggest Status
              </Button>
              {error && (
                <Alert variant="destructive">
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {result && (
                <Card className="w-full bg-secondary">
                  <CardHeader>
                    <CardTitle className="text-lg">AI Suggestion</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-2">
                    <div className="font-semibold text-primary">{result.suggestedStatus}</div>
                    <p className="text-sm text-muted-foreground">{result.reason}</p>
                  </CardContent>
                  <CardFooter className="gap-2">
                    <Button>Approve Suggestion</Button>
                    <Button variant="outline">Override</Button>
                  </CardFooter>
                </Card>
              )}
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}
