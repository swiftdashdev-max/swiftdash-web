import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'

interface MetricCardProps {
  title: string
  value: string | number
  change?: {
    value: string | number
    type: 'increase' | 'decrease' | 'neutral'
    label?: string
  }
  icon: LucideIcon
  iconColor?: string
  description?: string
  isLoading?: boolean
  className?: string
  badge?: {
    text: string
    variant?: 'default' | 'secondary' | 'destructive' | 'outline'
  }
}

export function MetricCard({
  title,
  value,
  change,
  icon: Icon,
  iconColor = 'text-primary',
  description,
  isLoading = false,
  className,
  badge
}: MetricCardProps) {
  const formatValue = (val: string | number) => {
    if (typeof val === 'number') {
      // Format currency values
      if (title.toLowerCase().includes('revenue')) {
        return `₱${val.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
      }
      // Format regular numbers
      return val.toLocaleString()
    }
    return val
  }

  const getChangeColor = (type: 'increase' | 'decrease' | 'neutral') => {
    switch (type) {
      case 'increase':
        return 'text-green-600 dark:text-green-400'
      case 'decrease':
        return 'text-red-600 dark:text-red-400'
      case 'neutral':
        return 'text-yellow-600 dark:text-yellow-400'
      default:
        return 'text-muted-foreground'
    }
  }

  const getChangeIcon = (type: 'increase' | 'decrease' | 'neutral') => {
    switch (type) {
      case 'increase':
        return '↗'
      case 'decrease':
        return '↘'
      case 'neutral':
        return '→'
      default:
        return ''
    }
  }

  return (
    <Card className={cn('transition-all hover:shadow-md', className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className="flex items-center gap-2">
          {badge && (
            <Badge variant={badge.variant || 'secondary'} className="text-xs">
              {badge.text}
            </Badge>
          )}
          <Icon className={cn('h-4 w-4', iconColor)} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {isLoading ? (
            <div className="animate-pulse">
              <div className="h-8 bg-muted rounded w-24 mb-2"></div>
              <div className="h-4 bg-muted rounded w-16"></div>
            </div>
          ) : (
            <>
              <div className="text-2xl font-bold">
                {formatValue(value)}
              </div>
              
              {change && (
                <div className={cn(
                  'flex items-center text-xs font-medium',
                  getChangeColor(change.type)
                )}>
                  <span className="mr-1">
                    {getChangeIcon(change.type)}
                  </span>
                  <span>{formatValue(change.value)}</span>
                  {change.label && (
                    <span className="ml-1 text-muted-foreground">
                      {change.label}
                    </span>
                  )}
                </div>
              )}
              
              {description && (
                <p className="text-xs text-muted-foreground mt-1">
                  {description}
                </p>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}