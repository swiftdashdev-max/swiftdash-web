'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { 
  Plus, X, MapPin, Package, Calendar, DollarSign,
  Truck, GripVertical, ArrowRight, Check 
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Stop {
  id: string
  address: string
  contactName: string
  contactPhone: string
  instructions: string
}

export default function CreateDeliveryPage() {
  const router = useRouter()
  const [isMultiStop, setIsMultiStop] = useState(false)
  const [isScheduled, setIsScheduled] = useState(false)
  const [loading, setLoading] = useState(false)

  // Pickup details
  const [pickupAddress, setPickupAddress] = useState('')
  const [pickupContact, setPickupContact] = useState('')
  const [pickupPhone, setPickupPhone] = useState('')
  const [pickupInstructions, setPickupInstructions] = useState('')

  // Single dropoff (if not multi-stop)
  const [dropoffAddress, setDropoffAddress] = useState('')
  const [dropoffContact, setDropoffContact] = useState('')
  const [dropoffPhone, setDropoffPhone] = useState('')
  const [dropoffInstructions, setDropoffInstructions] = useState('')

  // Multi-stop dropoffs
  const [stops, setStops] = useState<Stop[]>([
    { id: '1', address: '', contactName: '', contactPhone: '', instructions: '' }
  ])

  // Package & delivery details
  const [vehicleType, setVehicleType] = useState('')
  const [packageDesc, setPackageDesc] = useState('')
  const [packageWeight, setPackageWeight] = useState('')
  const [packageValue, setPackageValue] = useState('')
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')

  const addStop = () => {
    setStops([...stops, { 
      id: Date.now().toString(), 
      address: '', 
      contactName: '', 
      contactPhone: '', 
      instructions: '' 
    }])
  }

  const removeStop = (id: string) => {
    if (stops.length > 1) {
      setStops(stops.filter(stop => stop.id !== id))
    }
  }

  const updateStop = (id: string, field: keyof Stop, value: string) => {
    setStops(stops.map(stop => 
      stop.id === id ? { ...stop, [field]: value } : stop
    ))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    // TODO: Implement API call to create delivery
    // Mock submission
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    alert('Delivery created successfully!')
    router.push('/business/deliveries')
  }

  const estimatedCost = isMultiStop 
    ? 250 + (stops.length * 50) 
    : 180

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Create Delivery</h1>
              <p className="text-sm text-gray-600">Book a new delivery or schedule for later</p>
            </div>
            <Button variant="outline" asChild>
              <Link href="/business/deliveries">Cancel</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-6 max-w-4xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Delivery Type */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Delivery Type</CardTitle>
                <CardDescription>Choose single or multi-stop delivery</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="multi-stop" className="text-base">Multi-Stop Delivery</Label>
                    <p className="text-sm text-gray-500">
                      Deliver to multiple locations from one pickup point
                    </p>
                  </div>
                  <Switch
                    id="multi-stop"
                    checked={isMultiStop}
                    onCheckedChange={setIsMultiStop}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="scheduled" className="text-base">Schedule for Later</Label>
                    <p className="text-sm text-gray-500">
                      Set a specific pickup date and time
                    </p>
                  </div>
                  <Switch
                    id="scheduled"
                    checked={isScheduled}
                    onCheckedChange={setIsScheduled}
                  />
                </div>

                {isScheduled && (
                  <div className="grid grid-cols-2 gap-4 pt-4">
                    <div>
                      <Label>Pickup Date</Label>
                      <Input
                        type="date"
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        required={isScheduled}
                      />
                    </div>
                    <div>
                      <Label>Pickup Time</Label>
                      <Input
                        type="time"
                        value={scheduledTime}
                        onChange={(e) => setScheduledTime(e.target.value)}
                        required={isScheduled}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Pickup Details */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-green-600" />
                  Pickup Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="pickup-address">Pickup Address *</Label>
                  <Input
                    id="pickup-address"
                    placeholder="Enter pickup location"
                    value={pickupAddress}
                    onChange={(e) => setPickupAddress(e.target.value)}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="pickup-contact">Contact Name *</Label>
                    <Input
                      id="pickup-contact"
                      placeholder="Full name"
                      value={pickupContact}
                      onChange={(e) => setPickupContact(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="pickup-phone">Contact Phone *</Label>
                    <Input
                      id="pickup-phone"
                      placeholder="09XX XXX XXXX"
                      value={pickupPhone}
                      onChange={(e) => setPickupPhone(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="pickup-instructions">Special Instructions (Optional)</Label>
                  <Textarea
                    id="pickup-instructions"
                    placeholder="e.g., Ring doorbell, Building entrance code"
                    value={pickupInstructions}
                    onChange={(e) => setPickupInstructions(e.target.value)}
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Dropoff Details */}
          {!isMultiStop ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-red-600" />
                    Dropoff Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="dropoff-address">Dropoff Address *</Label>
                    <Input
                      id="dropoff-address"
                      placeholder="Enter delivery location"
                      value={dropoffAddress}
                      onChange={(e) => setDropoffAddress(e.target.value)}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="dropoff-contact">Contact Name *</Label>
                      <Input
                        id="dropoff-contact"
                        placeholder="Full name"
                        value={dropoffContact}
                        onChange={(e) => setDropoffContact(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="dropoff-phone">Contact Phone *</Label>
                      <Input
                        id="dropoff-phone"
                        placeholder="09XX XXX XXXX"
                        value={dropoffPhone}
                        onChange={(e) => setDropoffPhone(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="dropoff-instructions">Special Instructions (Optional)</Label>
                    <Textarea
                      id="dropoff-instructions"
                      placeholder="e.g., Leave at reception, Call upon arrival"
                      value={dropoffInstructions}
                      onChange={(e) => setDropoffInstructions(e.target.value)}
                      rows={2}
                    />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <MapPin className="h-5 w-5 text-red-600" />
                        Dropoff Stops ({stops.length})
                      </CardTitle>
                      <CardDescription>Add up to 10 delivery stops</CardDescription>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addStop}
                      disabled={stops.length >= 10}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Stop
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {stops.map((stop, index) => (
                    <div key={stop.id} className="border rounded-lg p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <GripVertical className="h-5 w-5 text-gray-400" />
                          <span className="font-medium">Stop {index + 1}</span>
                        </div>
                        {stops.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeStop(stop.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      <div>
                        <Label>Delivery Address *</Label>
                        <Input
                          placeholder="Enter delivery location"
                          value={stop.address}
                          onChange={(e) => updateStop(stop.id, 'address', e.target.value)}
                          required
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Contact Name *</Label>
                          <Input
                            placeholder="Full name"
                            value={stop.contactName}
                            onChange={(e) => updateStop(stop.id, 'contactName', e.target.value)}
                            required
                          />
                        </div>
                        <div>
                          <Label>Contact Phone *</Label>
                          <Input
                            placeholder="09XX XXX XXXX"
                            value={stop.contactPhone}
                            onChange={(e) => updateStop(stop.id, 'contactPhone', e.target.value)}
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <Label>Instructions (Optional)</Label>
                        <Textarea
                          placeholder="Special delivery instructions"
                          value={stop.instructions}
                          onChange={(e) => updateStop(stop.id, 'instructions', e.target.value)}
                          rows={2}
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Package Details */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-blue-600" />
                  Package Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="vehicle-type">Vehicle Type *</Label>
                  <Select value={vehicleType} onValueChange={setVehicleType} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select vehicle type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="motorcycle">Motorcycle (up to 20kg)</SelectItem>
                      <SelectItem value="sedan">Sedan (up to 200kg)</SelectItem>
                      <SelectItem value="suv">SUV (up to 300kg)</SelectItem>
                      <SelectItem value="van">Van (up to 600kg)</SelectItem>
                      <SelectItem value="truck">Truck (up to 2000kg)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="package-desc">Description</Label>
                    <Input
                      id="package-desc"
                      placeholder="e.g., Documents"
                      value={packageDesc}
                      onChange={(e) => setPackageDesc(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="package-weight">Weight (kg)</Label>
                    <Input
                      id="package-weight"
                      type="number"
                      placeholder="0.5"
                      step="0.1"
                      value={packageWeight}
                      onChange={(e) => setPackageWeight(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="package-value">Value (₱)</Label>
                    <Input
                      id="package-value"
                      type="number"
                      placeholder="1000"
                      value={packageValue}
                      onChange={(e) => setPackageValue(e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Summary & Submit */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="bg-gradient-to-br from-blue-50 to-purple-50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">Estimated Cost</h3>
                    <p className="text-sm text-gray-600">
                      {isMultiStop ? `1 pickup + ${stops.length} stops` : '1 pickup + 1 dropoff'}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-blue-600">₱{estimatedCost}</div>
                    <p className="text-xs text-gray-600">Final price may vary</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    asChild
                  >
                    <Link href="/business/deliveries">Cancel</Link>
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={loading}
                  >
                    {loading ? (
                      'Creating...'
                    ) : (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        {isScheduled ? 'Schedule Delivery' : 'Book Now'}
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </form>
      </div>
    </div>
  )
}
