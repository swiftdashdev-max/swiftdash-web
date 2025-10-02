'use client';

import {File, Download} from 'lucide-react';
import {Bar, BarChart, CartesianGrid, XAxis, YAxis} from 'recharts';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {Button} from '@/components/ui/button';
import {Badge} from '@/components/ui/badge';
import {mockInvoices} from '@/lib/data';

const chartData = [
  {month: 'Jan', cost: 1860, volume: 80},
  {month: 'Feb', cost: 3050, volume: 200},
  {month: 'Mar', cost: 2370, volume: 120},
  {month: 'Apr', cost: 4300, volume: 190},
  {month: 'May', cost: 3900, volume: 130},
];

const chartConfig = {
  cost: {
    label: 'Cost',
    color: 'hsl(var(--primary))',
  },
  volume: {
    label: 'Volume',
    color: 'hsl(var(--secondary))',
  },
} satisfies ChartConfig;

const statusVariant: {[key: string]: 'default' | 'secondary' | 'destructive'} = {
  Paid: 'default',
  Pending: 'secondary',
  Overdue: 'destructive',
};

export default function BusinessReportsPage() {
  return (
    <div className="grid flex-1 items-start gap-4 md:gap-8">
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="flex flex-row items-center">
          <div className="grid gap-2">
            <CardTitle>Invoices</CardTitle>
            <CardDescription>Download your monthly statements.</CardDescription>
          </div>
          <Button size="sm" variant="outline" className="ml-auto gap-1">
            <File className="h-4 w-4" />
            Download All
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-[100px] text-right">
                  <span className="sr-only">Download</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockInvoices.map(invoice => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-medium">{invoice.month}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[invoice.status]}>{invoice.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">${invoice.amount.toFixed(2)}</TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost">
                      <Download className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle>Delivery Costs vs. Volume</CardTitle>
          <CardDescription>January - May 2024</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="min-h-[200px] w-full">
            <BarChart accessibilityLayer data={chartData}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="month"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
                tickFormatter={value => value.slice(0, 3)}
              />
              <YAxis yAxisId="left" orientation="left" stroke="hsl(var(--primary))" />
              <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="cost" fill="var(--color-cost)" radius={4} yAxisId="left" />
              <Bar dataKey="volume" fill="var(--color-volume)" radius={4} yAxisId="right" />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}
