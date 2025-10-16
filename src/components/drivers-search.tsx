'use client'

import React, { useState, useEffect } from 'react'
import { Search, Filter, Download, Star, Truck, CheckCircle, Clock } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
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
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { getVehicleTypes } from '@/lib/supabase/driver-queries'
import type { DriverFilters } from '@/lib/supabase/driver-queries'

interface DriversSearchProps {
  filters: DriverFilters
  onFiltersChange: (filters: DriverFilters) => void
  onExport: () => void
  isLoading: boolean
  totalResults: number
}

export function DriversSearch({
  filters,
  onFiltersChange,
  onExport,
  isLoading,
  totalResults
}: DriversSearchProps) {
  const [searchTerm, setSearchTerm] = useState(filters.search || '')
  const [vehicleTypes, setVehicleTypes] = useState<any[]>([])
  const [activeFiltersCount, setActiveFiltersCount] = useState(0)

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      onFiltersChange({ ...filters, search: searchTerm })
    }, 300)

    return () => clearTimeout(timer)
  }, [searchTerm])

  // Load vehicle types
  useEffect(() => {
    const loadVehicleTypes = async () => {
      const types = await getVehicleTypes()
      setVehicleTypes(types)
    }
    loadVehicleTypes()
  }, [])

  // Count active filters
  useEffect(() => {
    let count = 0
    if (filters.status && filters.status !== 'all') count++
    if (filters.onlineStatus && filters.onlineStatus !== 'all') count++
    if (filters.vehicleType && filters.vehicleType !== 'all') count++
    if (filters.ratingMin && filters.ratingMin > 0) count++
    if (filters.deliveriesMin && filters.deliveriesMin > 0) count++
    setActiveFiltersCount(count)
  }, [filters])

  const handleFilterChange = (key: keyof DriverFilters, value: any) => {
    onFiltersChange({ ...filters, [key]: value })
  }

  const clearFilters = () => {
    setSearchTerm('')
    onFiltersChange({
      search: '',
      status: 'all',
      onlineStatus: 'all',
      vehicleType: 'all',
      ratingMin: 0,
      deliveriesMin: 0
    })
  }

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search drivers by name, phone, license, or plate number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Advanced Filters */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="relative">
              <Filter className="mr-2 h-4 w-4" />
              Filters
              {activeFiltersCount > 0 && (
                <Badge 
                  variant="destructive" 
                  className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 text-xs"
                >
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="end">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Filter Drivers</h4>
                {activeFiltersCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    Clear all
                  </Button>
                )}
              </div>

              {/* Verification Status */}
              <div className="space-y-2">
                <Label>Verification Status</Label>
                <Select
                  value={filters.status || 'all'}
                  onValueChange={(value) => handleFilterChange('status', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Drivers</SelectItem>
                    <SelectItem value="verified">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        Verified
                      </div>
                    </SelectItem>
                    <SelectItem value="pending">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-yellow-600" />
                        Pending Verification
                      </div>
                    </SelectItem>
                    <SelectItem value="suspended">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-red-600" />
                        Suspended
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Online Status */}
              <div className="space-y-2">
                <Label>Online Status</Label>
                <Select
                  value={filters.onlineStatus || 'all'}
                  onValueChange={(value) => handleFilterChange('onlineStatus', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="online">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-green-600" />
                        Online
                      </div>
                    </SelectItem>
                    <SelectItem value="offline">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-gray-400" />
                        Offline
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Vehicle Type */}
              <div className="space-y-2">
                <Label>Vehicle Type</Label>
                <Select
                  value={filters.vehicleType || 'all'}
                  onValueChange={(value) => handleFilterChange('vehicleType', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Vehicles</SelectItem>
                    {vehicleTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        <div className="flex items-center gap-2">
                          <Truck className="h-4 w-4" />
                          {type.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Minimum Rating */}
              <div className="space-y-2">
                <Label>Minimum Rating: {filters.ratingMin || 0}/5</Label>
                <div className="px-2">
                  <Slider
                    value={[filters.ratingMin || 0]}
                    onValueChange={([value]) => handleFilterChange('ratingMin', value)}
                    max={5}
                    step={0.5}
                    className="w-full"
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>0</span>
                  <span>5</span>
                </div>
              </div>

              {/* Minimum Deliveries */}
              <div className="space-y-2">
                <Label>Minimum Deliveries: {filters.deliveriesMin || 0}</Label>
                <div className="px-2">
                  <Slider
                    value={[filters.deliveriesMin || 0]}
                    onValueChange={([value]) => handleFilterChange('deliveriesMin', value)}
                    max={1000}
                    step={10}
                    className="w-full"
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>0</span>
                  <span>1000+</span>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Export Button */}
        <Button variant="outline" onClick={onExport} disabled={isLoading}>
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </div>

      {/* Results Summary */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {isLoading ? 'Searching...' : `${totalResults} driver${totalResults !== 1 ? 's' : ''} found`}
        </span>
        
        {/* Active Filters Summary */}
        {activeFiltersCount > 0 && (
          <div className="flex items-center gap-2">
            <span>Filters:</span>
            <div className="flex gap-1">
              {filters.status && filters.status !== 'all' && (
                <Badge variant="secondary" className="text-xs">
                  {filters.status === 'verified' && <CheckCircle className="mr-1 h-3 w-3" />}
                  {filters.status === 'pending' && <Clock className="mr-1 h-3 w-3" />}
                  {filters.status}
                </Badge>
              )}
              {filters.onlineStatus && filters.onlineStatus !== 'all' && (
                <Badge variant="secondary" className="text-xs">
                  {filters.onlineStatus}
                </Badge>
              )}
              {filters.ratingMin && filters.ratingMin > 0 && (
                <Badge variant="secondary" className="text-xs">
                  <Star className="mr-1 h-3 w-3" />
                  {filters.ratingMin}+ rating
                </Badge>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}