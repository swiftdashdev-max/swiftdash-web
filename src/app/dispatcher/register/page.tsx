'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ThemeToggle } from '@/components/theme-toggle'
import { Loader2, ShieldCheck, Radio, Clock, AlertTriangle } from 'lucide-react'

interface CommandCenter {
  id: string
  business_name: string
}

export default function DispatcherRegisterPage() {
  const [centers, setCenters] = useState<CommandCenter[]>([])
  const [loadingCenters, setLoadingCenters] = useState(true)

  const [commandCenterId, setCommandCenterId] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      const { data } = await supabase.rpc('list_emergency_command_centers')
      if (cancelled) return

      const rows = (data ?? []) as CommandCenter[]
      setCenters(rows)
      if (rows.length === 1) setCommandCenterId(rows[0].id)
      setLoadingCenters(false)
    }

    load()
    return () => { cancelled = true }
  }, [supabase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (!commandCenterId) {
      setError('Please choose the command center you are joining.')
      return
    }

    setSubmitting(true)

    try {
      const res = await fetch('/api/dispatcher/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commandCenterId, firstName, lastName, email, phone, password,
        }),
      })

      const result = await res.json()

      if (!res.ok) {
        setError(result.error || 'Registration failed. Please try again.')
        setSubmitting(false)
        return
      }

      setSubmitted(true)
    } catch {
      setError('Something went wrong. Please try again.')
      setSubmitting(false)
    }
  }

  // ─── Submitted — awaiting approval ───
  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center">
          <div className="w-14 h-14 rounded-full bg-amber-100 border-2 border-amber-200 flex items-center justify-center mx-auto mb-5 dark:bg-amber-900/30 dark:border-amber-800">
            <Clock className="w-7 h-7 text-amber-600 dark:text-amber-400" />
          </div>
          <h1 className="text-2xl font-bold mb-3">Request received</h1>
          <p className="text-muted-foreground text-sm mb-2">
            Your account has been created but is <strong className="text-foreground">not active yet</strong>.
            A command center administrator has to approve it before you can sign in.
          </p>
          <p className="text-xs text-muted-foreground/70 mb-8">
            You&apos;ll be able to log in with {email} once approved.
          </p>
          <Link href="/business/login">
            <Button variant="outline" className="rounded-full px-6">Go to sign in</Button>
          </Link>
        </div>
      </div>
    )
  }

  // ─── No command centers configured ───
  if (!loadingCenters && centers.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="max-w-sm w-full">
          <CardContent className="p-7 text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-5 h-5 text-muted-foreground" />
            </div>
            <h1 className="text-lg font-bold mb-2">No command centers available</h1>
            <p className="text-sm text-muted-foreground">
              There are no emergency command centers set up yet. Please contact SwiftDash support.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <main className="flex flex-col items-center justify-start pt-14 pb-20 px-4">
        <div className="w-full max-w-md">

          <div className="flex items-center justify-center gap-2.5 mb-8">
            <Image src="/assets/images/swiftdash_logo.png" alt="SwiftDash" width={28} height={28} />
            <span className="text-lg font-bold">SwiftDash</span>
          </div>

          <Card className="overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-primary to-primary/40" />
            <CardContent className="p-7">

              <div className="text-center mb-6">
                <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-3">
                  <Radio className="w-5 h-5 text-primary" />
                </div>
                <p className="text-[11px] font-mono uppercase tracking-wider text-primary mb-1">
                  Emergency Command Dispatcher
                </p>
                <h1 className="text-xl font-bold leading-tight">Request console access</h1>
                <p className="text-sm text-muted-foreground mt-1.5">
                  Your account is reviewed by an administrator before it becomes active.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">

                <div className="space-y-1.5">
                  <Label htmlFor="center">Command center</Label>
                  {loadingCenters ? (
                    <div className="h-9 rounded-md border bg-muted/30 flex items-center px-3">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <Select value={commandCenterId} onValueChange={setCommandCenterId} disabled={submitting}>
                      <SelectTrigger id="center">
                        <SelectValue placeholder="Choose your command center" />
                      </SelectTrigger>
                      <SelectContent>
                        {centers.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.business_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="firstName">First name</Label>
                    <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)}
                      required disabled={submitting} autoComplete="given-name" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="lastName">Last name</Label>
                    <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)}
                      required disabled={submitting} autoComplete="family-name" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="email">Work email</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    required disabled={submitting} placeholder="you@roxascity.gov.ph" autoComplete="email" />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="phone">Mobile number</Label>
                  <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                    disabled={submitting} placeholder="+63 917 000 0000" autoComplete="tel" />
                  <p className="text-xs text-muted-foreground">Used to reach you for shift escalations.</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                    required disabled={submitting} placeholder="At least 8 characters" autoComplete="new-password" />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword">Confirm password</Label>
                  <Input id="confirmPassword" type="password" value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required disabled={submitting} autoComplete="new-password" />
                </div>

                {error && (
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
                    {error}
                  </div>
                )}

                <Button type="submit" disabled={submitting} size="lg" className="w-full rounded-full">
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Submitting request…
                    </>
                  ) : 'Request access'}
                </Button>
              </form>

              <div className="mt-5 pt-5 border-t flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  Every dispatch is recorded against your name, so each person needs their own
                  account. Never share these credentials.
                </p>
              </div>

              <p className="mt-4 text-center text-xs text-muted-foreground">
                Already approved?{' '}
                <Link href="/business/login" className="text-primary hover:underline">Sign in</Link>
              </p>

            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
