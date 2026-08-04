'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { ThemeToggle } from '@/components/theme-toggle'
import { Loader2, ShieldCheck, AlertTriangle, CheckCircle2, Radio } from 'lucide-react'

interface Invitation {
  business_name: string
  business_role: string
  is_valid: boolean
}

const ROLE_LABEL: Record<string, string> = {
  dispatcher: 'Emergency Command Dispatcher',
  owner: 'Command Center Administrator',
}

export default function DispatcherJoinPage() {
  const params = useParams()
  const router = useRouter()
  const code = typeof params.code === 'string' ? params.code : ''

  const [invitation, setInvitation] = useState<Invitation | null>(null)
  const [checking, setChecking] = useState(true)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const supabase = createClient()

  // Look up who is inviting, without consuming the code
  useEffect(() => {
    let cancelled = false

    const check = async () => {
      const { data, error: rpcError } = await supabase
        .rpc('peek_staff_invitation', { p_code: code })

      if (cancelled) return

      const row = Array.isArray(data) ? data[0] : data
      if (rpcError || !row) {
        setInvitation(null)
      } else {
        setInvitation(row as Invitation)
      }
      setChecking(false)
    }

    if (code) check()
    else setChecking(false)

    return () => { cancelled = true }
  }, [code, supabase])

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

    setSubmitting(true)

    try {
      const res = await fetch('/api/dispatcher/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, email, password, firstName, lastName, phone }),
      })

      const result = await res.json()

      if (!res.ok) {
        setError(result.error || 'Registration failed. Please try again.')
        setSubmitting(false)
        return
      }

      // Sign in with the credentials just created
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

      if (signInError) {
        setDone(true)
        setSubmitting(false)
        return
      }

      setDone(true)
      setTimeout(() => router.push('/business/dashboard'), 1200)
    } catch {
      setError('Something went wrong. Please try again.')
      setSubmitting(false)
    }
  }

  // ─── Checking the link ───
  if (checking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-7 h-7 animate-spin text-primary mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Checking your invitation…</p>
        </div>
      </div>
    )
  }

  // ─── Bad link ───
  if (!invitation || !invitation.is_valid) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="max-w-sm w-full border-destructive/20">
          <CardContent className="p-7 text-center">
            <div className="w-12 h-12 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-5 h-5 text-destructive" />
            </div>
            <h1 className="text-lg font-bold mb-2">This invitation isn&apos;t valid</h1>
            <p className="text-sm text-muted-foreground mb-1">
              The link may have expired, already been used, or been typed incorrectly.
            </p>
            <p className="text-xs text-muted-foreground/70">
              Ask your command center administrator for a new one.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ─── Success ───
  if (done) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center">
          <div className="w-14 h-14 rounded-full bg-green-100 border-2 border-green-200 flex items-center justify-center mx-auto mb-5 dark:bg-green-900/30 dark:border-green-800">
            <CheckCircle2 className="w-7 h-7 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-2xl font-bold mb-2">You&apos;re registered</h1>
          <p className="text-muted-foreground text-sm mb-6">
            Your dispatcher account for {invitation.business_name} is ready.
          </p>
          <Link href="/business/dashboard">
            <Button className="rounded-full px-6">Go to the console</Button>
          </Link>
        </div>
      </div>
    )
  }

  // ─── Registration form ───
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
                  {ROLE_LABEL[invitation.business_role] ?? invitation.business_role}
                </p>
                <h1 className="text-xl font-bold leading-tight">
                  Join {invitation.business_name}
                </h1>
                <p className="text-sm text-muted-foreground mt-1.5">
                  Create your login to access the dispatch console.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
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
                  <p className="text-xs text-muted-foreground">
                    Used to reach you for shift escalations.
                  </p>
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
                      Creating your account…
                    </>
                  ) : 'Create my account'}
                </Button>
              </form>

              <div className="mt-5 pt-5 border-t flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  Every dispatch you make is recorded against your name. Don&apos;t share
                  this account — ask your administrator for a separate invitation for each person.
                </p>
              </div>

            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
