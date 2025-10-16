'use client'

import React, { useState } from 'react'
import { Copy, Eye, EyeOff, CheckCircle, Mail, Lock, User, AlertTriangle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'

interface UserCredentialsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userInfo: {
    name: string
    userType: string
    phone: string
  }
  credentials: {
    email: string
    password: string
    isTemporaryEmail: boolean
  }
}

export function UserCredentialsDialog({ 
  open, 
  onOpenChange, 
  userInfo, 
  credentials 
}: UserCredentialsDialogProps) {
  const { toast } = useToast()
  const [showPassword, setShowPassword] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      toast({
        title: "Copied!",
        description: `${field} copied to clipboard`,
      })
      
      // Reset the copied state after 2 seconds
      setTimeout(() => setCopiedField(null), 2000)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      })
    }
  }

  const copyAllCredentials = async () => {
    const credentialsText = `SwiftDash Login Credentials

User: ${userInfo.name}
Type: ${userInfo.userType}
Phone: ${userInfo.phone}

Login Details:
Email: ${credentials.email}
Password: ${credentials.password}

${credentials.isTemporaryEmail ? 
  'Note: This is a temporary email address. The user should update their email in their profile.' : 
  ''
}

Instructions:
1. Go to the SwiftDash app login page
2. Enter the email and password above
3. Change password after first login
4. ${credentials.isTemporaryEmail ? 'Update email address in profile settings' : 'Email is confirmed and ready to use'}`

    await copyToClipboard(credentialsText, 'All credentials')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            User Created Successfully!
          </DialogTitle>
          <DialogDescription>
            Share these login credentials with {userInfo.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* User Info */}
          <div className="bg-muted/50 p-4 rounded-lg">
            <h4 className="font-medium flex items-center gap-2 mb-3">
              <User className="h-4 w-4" />
              User Information
            </h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Name:</span>
                <p className="font-medium">{userInfo.name}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Type:</span>
                <p className="font-medium capitalize">{userInfo.userType}</p>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">Phone:</span>
                <p className="font-medium font-mono">{userInfo.phone}</p>
              </div>
            </div>
          </div>

          {/* Login Credentials */}
          <div className="space-y-4">
            <h4 className="font-medium flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Login Credentials
            </h4>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    value={credentials.email}
                    readOnly
                    className="pl-9 font-mono text-sm"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(credentials.email, 'Email')}
                  className="px-3"
                >
                  {copiedField === 'Email' ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password">Temporary Password</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={credentials.password}
                    readOnly
                    className="pl-9 pr-10 font-mono text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(credentials.password, 'Password')}
                  className="px-3"
                >
                  {copiedField === 'Password' ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Warnings/Notes */}
          {credentials.isTemporaryEmail && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                This is a temporary email address. The user should update their email in their profile settings after logging in.
              </AlertDescription>
            </Alert>
          )}

          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Make sure to share these credentials securely. The user should change their password after first login.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button 
            variant="outline" 
            onClick={copyAllCredentials}
            className="w-full sm:w-auto"
          >
            <Copy className="mr-2 h-4 w-4" />
            Copy All Details
          </Button>
          <Button 
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}