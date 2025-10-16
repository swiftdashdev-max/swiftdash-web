'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { 
  Plus, Search, Filter, Download, MapPin, Calendar,
  Truck, Clock, CheckCircle, XCircle, AlertCircle 
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import Link from 'next/link'

// Mock delivery data
const mockDeliveries = [
  {
    id: 'DEL-001',
    date: '2025-10-16 10:30 AM',
    status: 'in_transit',
    pickup: 'Makati City, Metro Manila',
    dropoff: 'Quezon City, Metro Manila',
    driver: 'Juan Dela Cruz',
    vehicle: 'Motorcycle',
    price: 250.00,
    tracking: 'On time',
    isMultiStop: false
  },
  {
    id: 'DEL-002',
    date: '2025-10-16 09:15 AM',
    status: 'delivered',
    pickup: 'BGC, Taguig City',
    dropoff: 'Pasig City',
    driver: 'Maria Santos',
    vehicle: 'Sedan',
    price: 350.00,
    tracking: 'Completed',
    isMultiStop: false
  },
  {
    id: 'DEL-003',
    date: '2025-10-16 08:00 AM',
    status: 'delivered',
    pickup: 'Manila',
    dropoff: 'Paranaque - Alabang - Las Pinas',
    driver: 'Pedro Reyes',
    vehicle: 'Van',
    price: 850.00,
    tracking: 'Completed',
    isMultiStop: true,
    stops: 3
  },
  {
    id: 'DEL-004',
    date: '2025-10-15 04:45 PM',
    status: 'cancelled',
    pickup: 'Pasig',
    dropoff: 'Makati',
    driver: null,
    vehicle: 'Motorcycle',
    price: 180.00,
    tracking: 'Cancelled by customer',
    isMultiStop: false
  }
]

export default function DeliveriesPage() {
  const [deliveries] = useState(mockDeliveries)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered': return 'bg-green-100 text-green-800'
      case 'in_transit': return 'bg-blue-100 text-blue-800'
      case 'picking_up': return 'bg-yellow-100 text-yellow-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      case 'scheduled': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered': return <CheckCircle className="h-4 w-4" />
      case 'in_transit': return <Truck className="h-4 w-4" />
      case 'picking_up': return <Clock className="h-4 w-4" />
      case 'cancelled': return <XCircle className="h-4 w-4" />
      case 'scheduled': return <Calendar className="h-4 w-4" />
      default: return <AlertCircle className="h-4 w-4" />
    }
  }

  const filteredDeliveries = deliveries.filter(delivery => {
    const matchesSearch = delivery.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         delivery.pickup.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         delivery.dropoff.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || delivery.status === statusFilter
    return matchesSearch && matchesStatus
  })

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Deliveries</h1>
              <p className="text-sm text-gray-600">Manage and track all your deliveries</p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
              <Button asChild>
                <Link href="/business/deliveries/create">
                  <Plus className="mr-2 h-4 w-4" />
                  New Delivery
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-6">
        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search by ID, pickup, or dropoff location..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full md:w-48">
                    <Filter className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="in_transit">In Transit</SelectItem>
                    <SelectItem value="delivered">Delivered</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Deliveries Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>
                All Deliveries ({filteredDeliveries.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredDeliveries.map((delivery) => (
                  <div 
                    key={delivery.id}
                    className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      {/* Left Section */}
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-lg">{delivery.id}</span>
                          <Badge className={getStatusColor(delivery.status)}>
                            <span className="flex items-center gap-1">
                              {getStatusIcon(delivery.status)}
                              {delivery.status.replace('_', ' ')}
                            </span>
                          </Badge>
                          {delivery.isMultiStop && (
                            <Badge variant="outline">
                              {delivery.stops} stops
                            </Badge>
                          )}
                        </div>

                        <div className="grid md:grid-cols-2 gap-3 text-sm">
                          <div className="flex items-start gap-2">
                            <MapPin className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                            <div>
                              <span className="text-gray-500">Pickup:</span>
                              <p className="font-medium">{delivery.pickup}</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <MapPin className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                            <div>
                              <span className="text-gray-500">Dropoff:</span>
                              <p className="font-medium">{delivery.dropoff}</p>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-4 text-xs text-gray-600">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {delivery.date}
                          </span>
                          {delivery.driver && (
                            <span className="flex items-center gap-1">
                              <Truck className="h-3 w-3" />
                              {delivery.driver} • {delivery.vehicle}
                            </span>
                          )}
                          <span className="font-medium text-gray-700">
                            {delivery.tracking}
                          </span>
                        </div>
                      </div>

                      {/* Right Section */}
                      <div className="flex items-center gap-4 lg:flex-col lg:items-end">
                        <div className="text-right">
                          <div className="text-2xl font-bold text-gray-900">
                            ₱{delivery.price.toFixed(2)}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm">
                            View Details
                          </Button>
                          {delivery.status === 'in_transit' && (
                            <Button size="sm">
                              <MapPin className="mr-1 h-4 w-4" />
                              Track
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {filteredDeliveries.length === 0 && (
                <div className="text-center py-12">
                  <Truck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No deliveries found</h3>
                  <p className="text-gray-600 mb-4">
                    {searchTerm || statusFilter !== 'all' 
                      ? 'Try adjusting your filters'
                      : 'Create your first delivery to get started'
                    }
                  </p>
                  {!searchTerm && statusFilter === 'all' && (
                    <Button asChild>
                      <Link href="/business/deliveries/create">
                        <Plus className="mr-2 h-4 w-4" />
                        Create Delivery
                      </Link>
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
