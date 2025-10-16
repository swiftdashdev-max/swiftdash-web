'use client'

import React, { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import { Loader2, User, Building2, Phone, Mail, Lock, UserCheck } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { UserCredentialsDialog } from '@/components/user-credentials-dialog'

// Form validation schema
const addUserSchema = z.object({
  userType: z.enum(['customer', 'driver', 'business', 'crm', 'admin']),
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  phoneNumber: z.string().min(11, 'Phone number must be at least 11 characters').regex(/^\+63\d{10}$/, 'Phone number must be in format +63XXXXXXXXXX'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  businessName: z.string().optional(),
  businessDescription: z.string().optional(),
  businessAddress: z.string().optional(),
  // For CRM and Admin users (these will be stored as notes for now)
  role: z.string().optional(),
  permissions: z.string().optional(),
}).refine((data) => {
  // Business accounts must have business name
  if (data.userType === 'business' && !data.businessName) {
    return false
  }
  return true
}, {
  message: "Business name is required for business accounts",
  path: ["businessName"],
})

type FormData = z.infer<typeof addUserSchema>

interface AddUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onUserAdded: () => void
}

interface UserCredentials {
  email: string
  password: string
  isTemporaryEmail: boolean
}

interface CreatedUserInfo {
  name: string
  userType: string
  phone: string
}

export function AddUserDialog({ open, onOpenChange, onUserAdded }: AddUserDialogProps) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [showCredentials, setShowCredentials] = useState(false)
  const [userCredentials, setUserCredentials] = useState<UserCredentials | null>(null)
  const [createdUserInfo, setCreatedUserInfo] = useState<CreatedUserInfo | null>(null)

  const form = useForm<FormData>({
    resolver: zodResolver(addUserSchema),
    defaultValues: {
      userType: 'customer',
      firstName: '',
      lastName: '',
      phoneNumber: '+63',
      email: '',
      businessName: '',
      businessDescription: '',
      businessAddress: '',
      role: '',
      permissions: '',
    },
  })

  const userType = form.watch('userType')

  const onSubmit = async (data: FormData) => {
    try {
      setIsLoading(true)
      
      // Prepare user data (only include fields that exist in database)
      const userData = {
        phone_number: data.phoneNumber,
        first_name: data.firstName,
        last_name: data.lastName,
        user_type: data.userType,
        status: 'active',
        business_name: data.userType === 'business' ? data.businessName : null,
        // Note: business_description, business_address, role, and permissions 
        // are collected but not stored in database yet - will need schema updates
      }

      // Make API call to create user
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create user')
      }

      // Store user info and credentials to show in the credentials dialog
      setCreatedUserInfo({
        name: `${data.firstName} ${data.lastName}`,
        userType: data.userType,
        phone: data.phoneNumber
      })
      
      setUserCredentials(result.credentials)

      toast({
        title: "Success",
        description: `${data.userType} account created successfully for ${data.firstName} ${data.lastName}`,
      })

      // Reset form, close this dialog, and show credentials
      form.reset()
      onOpenChange(false)
      setShowCredentials(true)
      onUserAdded()

    } catch (error) {
      console.error('Error creating user:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create user. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const getUserTypeIcon = (type: string) => {
    switch (type) {
      case 'business': return Building2
      case 'crm':
      case 'admin': return UserCheck
      default: return User
    }
  }

  const getUserTypeDescription = (type: string) => {
    switch (type) {
      case 'customer': return 'Regular customer account for placing orders'
      case 'driver': return 'Driver account for delivery services'
      case 'business': return 'Business account for restaurants/shops'
      case 'crm': return 'CRM staff account with customer service permissions'
      case 'admin': return 'Administrator account with full system access'
      default: return ''
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Add New User
          </DialogTitle>
          <DialogDescription>
            Create a new user account for the platform. Choose the appropriate user type and fill in the required information.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* User Type Selection */}
            <FormField
              control={form.control}
              name="userType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>User Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select user type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="customer">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          Customer
                        </div>
                      </SelectItem>
                      <SelectItem value="driver">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          Driver
                        </div>
                      </SelectItem>
                      <SelectItem value="business">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
                          Business
                        </div>
                      </SelectItem>
                      <SelectItem value="crm">
                        <div className="flex items-center gap-2">
                          <UserCheck className="h-4 w-4" />
                          CRM Staff
                        </div>
                      </SelectItem>
                      <SelectItem value="admin">
                        <div className="flex items-center gap-2">
                          <UserCheck className="h-4 w-4" />
                          Administrator
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {getUserTypeDescription(userType)}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Basic Information */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter first name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter last name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Contact Information */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="phoneNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input 
                          placeholder="+639XXXXXXXXX" 
                          className="pl-9"
                          {...field} 
                        />
                      </div>
                    </FormControl>
                    <FormDescription>
                      Philippines mobile number format
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input 
                          type="email"
                          placeholder="email@example.com" 
                          className="pl-9"
                          {...field} 
                        />
                      </div>
                    </FormControl>
                    <FormDescription>
                      If not provided, a temporary email will be generated. User will be auto-confirmed.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Business Information (only for business accounts) */}
            {userType === 'business' && (
              <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Business Information
                  </h4>
                  <span className="text-xs text-muted-foreground">Only business name is stored currently</span>
                </div>
                
                <FormField
                  control={form.control}
                  name="businessName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Business Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter business name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="businessDescription"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Business Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Describe the business (e.g., Fast food restaurant, Electronics store)"
                          className="resize-none"
                          rows={3}
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="businessAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Business Address</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Enter complete business address"
                          className="resize-none"
                          rows={2}
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* Staff Information (for CRM and Admin) */}
            {['crm', 'admin'].includes(userType) && (
              <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium flex items-center gap-2">
                    <UserCheck className="h-4 w-4" />
                    Staff Information
                  </h4>
                  <span className="text-xs text-muted-foreground">For reference only</span>
                </div>
                
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role/Position</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder={userType === 'crm' ? 'Customer Service Representative' : 'System Administrator'} 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="permissions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Permissions</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Describe the permissions and responsibilities"
                          className="resize-none"
                          rows={2}
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription>
                        {userType === 'crm' 
                          ? 'CRM staff typically handle customer inquiries, order management, and support'
                          : 'Admin users have full system access and management capabilities'
                        }
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create {userType.charAt(0).toUpperCase() + userType.slice(1)} Account
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>

      {/* Credentials Dialog - shows after user creation */}
      {userCredentials && createdUserInfo && (
        <UserCredentialsDialog
          open={showCredentials}
          onOpenChange={setShowCredentials}
          userInfo={createdUserInfo}
          credentials={userCredentials}
        />
      )}
    </Dialog>
  )
}