'use client'

import React, { useState, useCallback } from 'react'
import { Search, Filter, X, Calendar, Download } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Calendar as CalendarComponent } from '@/components/ui/calendar'
import { format } from 'date-fns'
import { UserFilters } from '@/lib/supabase/users-queries'

interface UsersSearchProps {
  filters: UserFilters
  onFiltersChange: (filters: UserFilters) => void
  onExport?: () => void
  isLoading?: boolean
  totalResults?: number
}

export function UsersSearch({ 
  filters, 
  onFiltersChange, 
  onExport, 
  isLoading = false, 
  totalResults = 0 
}: UsersSearchProps) {
  const [localSearch, setLocalSearch] = useState(filters.search || '')
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)

  // Debounced search
  const debouncedSearch = useCallback(
    debounce((searchTerm: string) => {
      onFiltersChange({ ...filters, search: searchTerm || undefined })
    }, 500),
    [filters, onFiltersChange]
  )

  const handleSearchChange = (value: string) => {
    setLocalSearch(value)
    debouncedSearch(value)
  }

  const handleFilterChange = (key: keyof UserFilters, value: string | undefined) => {
    if (value === 'all' || value === '') {
      const newFilters = { ...filters }
      delete newFilters[key]
      onFiltersChange(newFilters)
    } else {
      onFiltersChange({ ...filters, [key]: value })
    }
  }

  const clearAllFilters = () => {
    setLocalSearch('')
    onFiltersChange({})
  }

  const getActiveFiltersCount = () => {
    let count = 0
    if (filters.search) count++
    if (filters.userType) count++
    if (filters.status) count++
    if (filters.dateFrom) count++
    if (filters.dateTo) count++
    return count
  }

  const activeFiltersCount = getActiveFiltersCount()

  return (
    <div className="space-y-4">
      {/* Main Search Bar */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users by name, phone, or business..."
            value={localSearch}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10 pr-4"
            disabled={isLoading}
          />
          {localSearch && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
              onClick={() => handleSearchChange('')}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <Button
          variant="outline"
          onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
          className="relative"
        >
          <Filter className="h-4 w-4 mr-2" />
          Filters
          {activeFiltersCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs"
            >
              {activeFiltersCount}
            </Badge>
          )}
        </Button>

        {onExport && (
          <Button variant="outline" onClick={onExport} disabled={isLoading}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        )}
      </div>

      {/* Results Summary */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div>
          {isLoading ? (
            <span>Searching...</span>
          ) : (
            <span>{totalResults.toLocaleString()} users found</span>
          )}
        </div>
        {activeFiltersCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearAllFilters}>
            Clear all filters
          </Button>
        )}
      </div>

      {/* Advanced Filters */}
      {showAdvancedFilters && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
          {/* User Type Filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium">User Type</label>
            <Select
              value={filters.userType || 'all'}
              onValueChange={(value) => handleFilterChange('userType', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="customer">Customer</SelectItem>
                <SelectItem value="driver">Driver</SelectItem>
                <SelectItem value="business">Business</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="crm">CRM</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Status Filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Status</label>
            <Select
              value={filters.status || 'all'}
              onValueChange={(value) => handleFilterChange('status', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date From Filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Created From</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <Calendar className="mr-2 h-4 w-4" />
                  {filters.dateFrom ? (
                    format(new Date(filters.dateFrom), 'MMM dd, yyyy')
                  ) : (
                    <span>Pick a date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <CalendarComponent
                  mode="single"
                  selected={filters.dateFrom ? new Date(filters.dateFrom) : undefined}
                  onSelect={(date) => 
                    handleFilterChange('dateFrom', date ? date.toISOString().split('T')[0] : undefined)
                  }
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Date To Filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Created To</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <Calendar className="mr-2 h-4 w-4" />
                  {filters.dateTo ? (
                    format(new Date(filters.dateTo), 'MMM dd, yyyy')
                  ) : (
                    <span>Pick a date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <CalendarComponent
                  mode="single"
                  selected={filters.dateTo ? new Date(filters.dateTo) : undefined}
                  onSelect={(date) => 
                    handleFilterChange('dateTo', date ? date.toISOString().split('T')[0] : undefined)
                  }
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      )}

      {/* Active Filters Display */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {filters.search && (
            <Badge variant="secondary">
              Search: "{filters.search}"
              <Button
                variant="ghost"
                size="sm"
                className="ml-1 h-4 w-4 p-0"
                onClick={() => handleFilterChange('search', undefined)}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}
          {filters.userType && (
            <Badge variant="secondary">
              Type: {filters.userType}
              <Button
                variant="ghost"
                size="sm"
                className="ml-1 h-4 w-4 p-0"
                onClick={() => handleFilterChange('userType', undefined)}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}
          {filters.status && (
            <Badge variant="secondary">
              Status: {filters.status}
              <Button
                variant="ghost"
                size="sm"
                className="ml-1 h-4 w-4 p-0"
                onClick={() => handleFilterChange('status', undefined)}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}
          {filters.dateFrom && (
            <Badge variant="secondary">
              From: {format(new Date(filters.dateFrom), 'MMM dd, yyyy')}
              <Button
                variant="ghost"
                size="sm"
                className="ml-1 h-4 w-4 p-0"
                onClick={() => handleFilterChange('dateFrom', undefined)}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}
          {filters.dateTo && (
            <Badge variant="secondary">
              To: {format(new Date(filters.dateTo), 'MMM dd, yyyy')}
              <Button
                variant="ghost"
                size="sm"
                className="ml-1 h-4 w-4 p-0"
                onClick={() => handleFilterChange('dateTo', undefined)}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}
        </div>
      )}
    </div>
  )
}

// Debounce utility function
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}