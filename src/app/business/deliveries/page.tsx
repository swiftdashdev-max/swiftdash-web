'use client'

import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { 
  Plus, Search, Filter, Download, MapPin, Calendar,
  Truck, Clock, CheckCircle, XCircle, AlertCircle, 
  Users, Link as LinkIcon, Eye, Navigation, Copy, Check
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'
import { useUserContext } from '@/lib/supabase/user-context'

interface Delivery {
  id: string
  tracking_number: string
  status: string
  pickup_address: string
  delivery_address: string
  package_description: string
  total_amount: number
  created_at: string
  driver_id: string | null
  assigned_at: string | null
  completed_at: string | null
  is_multi_stop: boolean
  driver_profiles?: {
    user_profiles: {
      first_name: string
      last_name: string
    }
    vehicle_type: string
  }
}

interface DeliveryStop {
  stop_number: number
  tracking_code: string
  recipient_name: string
  recipient_phone: string
  address: string
  status: string
}

export default function DeliveriesPage() {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()
  const { businessId, loading: userLoading } = useUserContext()
  
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState('pending')
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null)
  const [showStopsDialog, setShowStopsDialog] = useState(false)
  const [deliveryStops, setDeliveryStops] = useState<DeliveryStop[]>([])
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  // Fetch deliveries with React Query
  const { data: deliveries = [], isLoading, refetch } = useQuery({
    queryKey: ['deliveries', businessId, activeTab],
    queryFn: async () => {
      if (!businessId) return [];
      
      let query = supabase
        .from('deliveries')
        .select(`
          *,
          driver_profiles (
            user_profiles (
              first_name,
              last_name
            ),
            vehicle_type
          )
        `)
        .eq('business_id', businessId)
        .order('created_at', { ascending: false })

      // Filter by tab
      if (activeTab === 'pending') {
        query = query.is('driver_id', null).eq('status', 'pending')
      } else if (activeTab === 'active') {
        query = query.in('status', [
          'driver_assigned',
          'going_to_pickup', 
          'arrived_at_pickup',
          'picked_up',
          'going_to_dropoff',
          'arrived_at_dropoff'
        ])
      } else if (activeTab === 'completed') {
        query = query.in('status', ['delivered', 'cancelled', 'completed'])
      }

      const { data, error } = await query

      if (error) throw error
      return data || []
    },
    enabled: !!businessId && !userLoading,
    staleTime: 30000, // 30 seconds
  })

  const loading = isLoading || userLoading

  const copyTrackingLink = async (trackingNumber: string) => {
    const link = `${window.location.origin}/track/${trackingNumber}`
    await navigator.clipboard.writeText(link)
    
    // Track share count analytics
    const supabase = createClient()
    await supabase.rpc('increment_share_count', { tracking_num: trackingNumber })
    
    toast({
      title: 'Link Copied! 🔗',
      description: 'Share this link with your customer to track their delivery'
    })
  }

  const handleViewStops = async (delivery: Delivery) => {
    if (!delivery.is_multi_stop) {
      copyTrackingLink(delivery.tracking_number)
      return
    }

    setSelectedDelivery(delivery)
    setShowStopsDialog(true)

    // Fetch delivery stops
    const { data, error } = await supabase
      .from('delivery_stops')
      .select('stop_number, tracking_code, recipient_name, recipient_phone, address, status')
      .eq('delivery_id', delivery.id)
      .gt('stop_number', 0) // Exclude pickup stop
      .order('stop_number')

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to load delivery stops',
        variant: 'destructive'
      })
      return
    }

    setDeliveryStops(data || [])
  }

  const copyStopTrackingLink = async (trackingCode: string) => {
    const baseUrl = window.location.origin
    const link = `${baseUrl}/track/${trackingCode}`
    await navigator.clipboard.writeText(link)

    setCopiedCode(trackingCode)
    setTimeout(() => setCopiedCode(null), 2000)

    toast({
      title: 'Stop Link Copied! 🔗',
      description: 'Private tracking link for this stop only'
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered':
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'going_to_pickup':
      case 'going_to_dropoff':
        return 'bg-blue-100 text-blue-800'
      case 'driver_assigned':
      case 'arrived_at_pickup':
      case 'arrived_at_dropoff':
        return 'bg-yellow-100 text-yellow-800'
      case 'picked_up':
        return 'bg-purple-100 text-purple-800'
      case 'cancelled':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      case 'pending':
        return 'bg-secondary text-secondary-foreground'
      default:
        return 'bg-secondary text-secondary-foreground'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered':
      case 'completed':
        return <CheckCircle className="h-4 w-4" />
      case 'going_to_pickup':
      case 'going_to_dropoff':
      case 'picked_up':
        return <Truck className="h-4 w-4" />
      case 'driver_assigned':
      case 'arrived_at_pickup':
      case 'arrived_at_dropoff':
        return <Clock className="h-4 w-4" />
      case 'cancelled':
        return <XCircle className="h-4 w-4" />
      case 'pending':
        return <AlertCircle className="h-4 w-4" />
      default:
        return <AlertCircle className="h-4 w-4" />
    }
  }

  const formatStatus = (status: string) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const filteredDeliveries = deliveries.filter(delivery => {
    const matchesSearch = 
      delivery.tracking_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      delivery.pickup_address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      delivery.delivery_address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      delivery.package_description?.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesSearch
  })

  const getTabCounts = () => {
    // This would ideally come from a separate count query for performance
    return {
      pending: deliveries.length,
      active: deliveries.length,
      completed: deliveries.length
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Multi-Stop Tracking Dialog */}
      <Dialog open={showStopsDialog} onOpenChange={setShowStopsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Multi-Stop Tracking Links
            </DialogTitle>
            <DialogDescription>
              {selectedDelivery && (
                <>
                  Delivery {selectedDelivery.tracking_number} • {deliveryStops.length} stops
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {deliveryStops.map((stop) => (
              <div
                key={stop.stop_number}
                className="border rounded-lg p-4 hover:bg-accent transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline">Stop {stop.stop_number}</Badge>
                      <Badge className={
                        stop.status === 'completed' ? 'bg-green-100 text-green-800' :
                        stop.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                        'bg-secondary text-secondary-foreground'
                      }>
                        {stop.status}
                      </Badge>
                    </div>
                    <p className="font-medium">{stop.recipient_name || 'No name'}</p>
                    <p className="text-sm text-muted-foreground">{stop.recipient_phone || 'No phone'}</p>
                    <p className="text-sm text-muted-foreground mt-1">{stop.address}</p>
                    <p className="text-xs font-mono text-muted-foreground mt-2">{stop.tracking_code}</p>
                  </div>
                  <Button
                    size="sm"
                    variant={copiedCode === stop.tracking_code ? "default" : "outline"}
                    onClick={() => copyStopTrackingLink(stop.tracking_code)}
                  >
                    {copiedCode === stop.tracking_code ? (
                      <>
                        <Check className="h-4 w-4 mr-1" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-1" />
                        Copy Link
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ))}
            
            {deliveryStops.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <AlertCircle className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                <p>No stops found for this delivery</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
              <p className="text-sm text-gray-600">Manage and track all your deliveries</p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
              <Button asChild>
                <Link href="/business/deliveries/create">
                  <Plus className="mr-2 h-4 w-4" />
                  New Order
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-6">
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="pending">
              Pending
              {!loading && (
                <Badge variant="secondary" className="ml-2">
                  {filteredDeliveries.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="active">
              Active
              {!loading && (
                <Badge variant="secondary" className="ml-2">
                  {filteredDeliveries.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="completed">
              Completed
              {!loading && (
                <Badge variant="secondary" className="ml-2">
                  {filteredDeliveries.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Search Bar */}
          <Card>
            <CardContent className="pt-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by tracking number, address, or description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardContent>
          </Card>

          {/* Pending Tab */}
          <TabsContent value="pending" className="space-y-4">
            <DeliveryList
              deliveries={filteredDeliveries}
              loading={loading}
              emptyMessage="No pending orders"
              emptyDescription="All orders have been assigned to drivers"
              showActions={{
                assignDriver: true,
                viewMap: false,
                copyLink: false
              }}
              getStatusColor={getStatusColor}
              getStatusIcon={getStatusIcon}
              formatStatus={formatStatus}
              formatDate={formatDate}
              router={router}
              copyTrackingLink={copyTrackingLink}
              handleViewStops={handleViewStops}
            />
          </TabsContent>

          {/* Active Tab */}
          <TabsContent value="active" className="space-y-4">
            <DeliveryList
              deliveries={filteredDeliveries}
              loading={loading}
              emptyMessage="No active deliveries"
              emptyDescription="No deliveries are currently in progress"
              showActions={{
                assignDriver: false,
                viewMap: true,
                copyLink: true
              }}
              getStatusColor={getStatusColor}
              getStatusIcon={getStatusIcon}
              formatStatus={formatStatus}
              formatDate={formatDate}
              router={router}
              copyTrackingLink={copyTrackingLink}
              handleViewStops={handleViewStops}
            />
          </TabsContent>

          {/* Completed Tab */}
          <TabsContent value="completed" className="space-y-4">
            <DeliveryList
              deliveries={filteredDeliveries}
              loading={loading}
              emptyMessage="No completed deliveries"
              emptyDescription="Completed deliveries will appear here"
              showActions={{
                assignDriver: false,
                viewMap: false,
                copyLink: true
              }}
              getStatusColor={getStatusColor}
              getStatusIcon={getStatusIcon}
              formatStatus={formatStatus}
              formatDate={formatDate}
              router={router}
              copyTrackingLink={copyTrackingLink}
              handleViewStops={handleViewStops}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

// DeliveryList Component
interface DeliveryListProps {
  deliveries: Delivery[]
  loading: boolean
  emptyMessage: string
  emptyDescription: string
  showActions: {
    assignDriver: boolean
    viewMap: boolean
    copyLink: boolean
  }
  getStatusColor: (status: string) => string
  getStatusIcon: (status: string) => React.ReactNode
  formatStatus: (status: string) => string
  formatDate: (date: string) => string
  router: any
  copyTrackingLink: (trackingNumber: string) => void
  handleViewStops: (delivery: Delivery) => void
}

function DeliveryList({
  deliveries,
  loading,
  emptyMessage,
  emptyDescription,
  showActions,
  getStatusColor,
  getStatusIcon,
  formatStatus,
  formatDate,
  router,
  copyTrackingLink,
  handleViewStops
}: DeliveryListProps) {
  if (loading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
            <p className="text-muted-foreground">Loading orders...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (deliveries.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <Truck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">{emptyMessage}</h3>
            <p className="text-muted-foreground mb-4">{emptyDescription}</p>
            {showActions.assignDriver && (
              <Button asChild>
                <Link href="/business/deliveries/create">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Order
                </Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          {deliveries.map((delivery) => (
            <motion.div
              key={delivery.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Left Section */}
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-bold text-lg">{delivery.tracking_number}</span>
                    <Badge className={getStatusColor(delivery.status)}>
                      <span className="flex items-center gap-1">
                        {getStatusIcon(delivery.status)}
                        {formatStatus(delivery.status)}
                      </span>
                    </Badge>
                  </div>

                  <div className="grid md:grid-cols-2 gap-3 text-sm">
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="text-gray-500">Pickup:</span>
                        <p className="font-medium">{delivery.pickup_address}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="text-gray-500">Dropoff:</span>
                        <p className="font-medium">{delivery.delivery_address}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-4 text-xs text-gray-600">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDate(delivery.created_at)}
                    </span>
                    {delivery.driver_profiles && (
                      <span className="flex items-center gap-1">
                        <Truck className="h-3 w-3" />
                        {delivery.driver_profiles.user_profiles.first_name}{' '}
                        {delivery.driver_profiles.user_profiles.last_name}
                        {delivery.driver_profiles.vehicle_type && 
                          ` • ${delivery.driver_profiles.vehicle_type}`
                        }
                      </span>
                    )}
                    {delivery.package_description && (
                      <span className="text-gray-700">
                        📦 {delivery.package_description}
                      </span>
                    )}
                  </div>
                </div>

                {/* Right Section */}
                <div className="flex items-center gap-4 lg:flex-col lg:items-end">
                  <div className="text-right">
                    <div className="text-2xl font-bold text-gray-900">
                      ₱{delivery.total_amount.toFixed(2)}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {showActions.assignDriver && (
                      <Button
                        size="sm"
                        onClick={() => router.push(`/business/matching?delivery=${delivery.id}`)}
                      >
                        <Users className="mr-1 h-4 w-4" />
                        Assign Driver
                      </Button>
                    )}
                    {showActions.viewMap && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => router.push(`/business/tracking?delivery=${delivery.id}`)}
                      >
                        <Navigation className="mr-1 h-4 w-4" />
                        Track
                      </Button>
                    )}
                    {showActions.copyLink && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewStops(delivery)}
                      >
                        <LinkIcon className="mr-1 h-4 w-4" />
                        {delivery.is_multi_stop ? 'View Stops' : 'Copy Link'}
                      </Button>
                    )}
                    <Button size="sm" variant="ghost">
                      <Eye className="mr-1 h-4 w-4" />
                      Details
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
