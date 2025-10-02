'use client';

import {Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis} from 'recharts';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import {mockRevenueData} from '@/lib/data';

const revenueChartConfig = {
  revenue: {
    label: 'Revenue',
    color: 'hsl(var(--primary))',
  },
} satisfies ChartConfig;

const driverPerformanceData = [
  {driver: 'John D.', deliveries: 120, rating: 4.9},
  {driver: 'Jane S.', deliveries: 98, rating: 4.7},
  {driver: 'Carlos R.', deliveries: 150, rating: 4.8},
  {driver: 'Aisha K.', deliveries: 85, rating: 4.6},
  {driver: 'Mike L.', deliveries: 110, rating: 4.9},
];

const driverPerformanceChartConfig = {
  deliveries: {
    label: 'Deliveries',
    color: 'hsl(var(--primary))',
  },
} satisfies ChartConfig;

export default function ReportsPage() {
  return (
    <div className="grid flex-1 items-start gap-4 md:gap-8">
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle>Revenue Trends</CardTitle>
            <CardDescription>January - June 2024</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={revenueChartConfig} className="min-h-[200px] w-full">
              <LineChart
                accessibilityLayer
                data={mockRevenueData}
                margin={{
                  left: 12,
                  right: 12,
                }}
              >
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={value => value.slice(0, 3)}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={value => `$${value / 1000}k`}
                />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent indicator="dot" />}
                />
                <Line
                  dataKey="revenue"
                  type="monotone"
                  stroke="var(--color-revenue)"
                  strokeWidth={2}
                  dot={true}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
          <CardFooter>
            <div className="flex w-full items-start gap-2 text-sm">
              <div className="grid gap-2">
                <div className="flex items-center gap-2 font-medium leading-none">
                  Trending up by 5.2% this month <span className="text-green-500">↗</span>
                </div>
                <div className="flex items-center gap-2 leading-none text-muted-foreground">
                  Showing total revenue for the last 6 months
                </div>
              </div>
            </div>
          </CardFooter>
        </Card>
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle>Driver Performance</CardTitle>
            <CardDescription>Top 5 drivers by deliveries</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={driverPerformanceChartConfig} className="min-h-[200px] w-full">
              <BarChart accessibilityLayer data={driverPerformanceData}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="driver"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                  tickFormatter={value => value}
                />
                <YAxis />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent indicator="dashed" />}
                />
                <Bar dataKey="deliveries" fill="var(--color-deliveries)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
          <CardFooter>
            <div className="flex w-full items-start gap-2 text-sm">
              <div className="grid gap-2">
                <div className="flex items-center gap-2 font-medium leading-none">
                  Carlos R. is the top performer this period.
                </div>
                <div className="flex items-center gap-2 leading-none text-muted-foreground">
                  Driver ratings are consistently high.
                </div>
              </div>
            </div>
          </CardFooter>
        </Card>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle>Delivery Volume Heatmap</CardTitle>
            <CardDescription>Placeholder for delivery volume by location.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center bg-muted/50 rounded-lg h-64">
            <p className="text-muted-foreground">[Heatmap Visualization]</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle>Customer Support KPIs</CardTitle>
            <CardDescription>Key metrics for the support team.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center bg-muted/50 rounded-lg h-64">
            <p className="text-muted-foreground">[KPI Charts]</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
