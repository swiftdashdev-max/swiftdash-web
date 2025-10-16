'use client'

import React from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, Users } from 'lucide-react'

interface ChartCardProps {
  title: string
  description: string
  data: any[]
  dataKey: string
  color: string
  formatValue?: (value: number) => string
  isLoading?: boolean
  icon?: React.ReactNode
  chartType?: 'line' | 'area'
}

export function ChartCard({
  title,
  description,
  data,
  dataKey,
  color,
  formatValue = (value) => value.toLocaleString(),
  isLoading = false,
  icon,
  chartType = 'area'
}: ChartCardProps) {
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-background border border-border rounded-lg shadow-lg p-3">
          <p className="text-sm font-medium text-foreground">{label}</p>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium" style={{ color }}>
                {title}: {formatValue(payload[0].value)}
              </span>
            </p>
            {data.dailyRevenue !== undefined && (
              <p className="text-xs text-muted-foreground">
                Daily: {formatValue(data.dailyRevenue)}
              </p>
            )}
            {data.newUsers !== undefined && (
              <p className="text-xs text-muted-foreground">
                New: {data.newUsers}
              </p>
            )}
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-base font-medium">{title}</CardTitle>
          <CardDescription className="text-sm">{description}</CardDescription>
        </div>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </CardHeader>
      <CardContent className="flex-1">
        {isLoading ? (
          <div className="h-[200px] flex items-center justify-center">
            <div className="animate-pulse flex space-x-4 w-full">
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-32 bg-muted rounded"></div>
                <div className="h-4 bg-muted rounded w-1/2"></div>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'area' ? (
                <AreaChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <defs>
                    <linearGradient id={`colorGradient-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                  <XAxis 
                    dataKey="label" 
                    tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <YAxis 
                    tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                    stroke="hsl(var(--muted-foreground))"
                    tickFormatter={formatValue}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey={dataKey}
                    stroke={color}
                    strokeWidth={2}
                    fill={`url(#colorGradient-${dataKey})`}
                  />
                </AreaChart>
              ) : (
                <LineChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                  <XAxis 
                    dataKey="label" 
                    tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <YAxis 
                    tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                    stroke="hsl(var(--muted-foreground))"
                    tickFormatter={formatValue}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey={dataKey}
                    stroke={color}
                    strokeWidth={2}
                    dot={{ fill: color, strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, stroke: color, strokeWidth: 2 }}
                  />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Specialized Revenue Chart
export function RevenueChart({ data, isLoading }: { data: any[], isLoading: boolean }) {
  return (
    <ChartCard
      title="Revenue Trend"
      description="Last 7 days cumulative revenue"
      data={data}
      dataKey="cumulativeRevenue"
      color="hsl(var(--primary))"
      formatValue={(value) => `₱${value.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
      isLoading={isLoading}
      icon={<TrendingUp className="h-4 w-4" />}
      chartType="area"
    />
  )
}

// Specialized User Chart
export function UserChart({ data, isLoading }: { data: any[], isLoading: boolean }) {
  return (
    <ChartCard
      title="User Growth"
      description="Total registered users over time"
      data={data}
      dataKey="totalUsers"
      color="#3B4CCA"
      formatValue={(value) => value.toLocaleString()}
      isLoading={isLoading}
      icon={<Users className="h-4 w-4" />}
      chartType="area"
    />
  )
}