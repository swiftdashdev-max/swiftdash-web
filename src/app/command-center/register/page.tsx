'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { ThemeToggle } from '@/components/theme-toggle'
import { Loader2, Building2, UserCog, CheckCircle2, ShieldCheck } from 'lucide-react'

export default function CommandCenterRegisterPage() {
  const router = useRouter()

  const [centerName, setCenterName] = useState('')
  const [centerEmail, setCenterEmail] = useState('')
  const [centerPhone, setCenterPhone] = useState('')
  const [centerAddress, setCenterAddress] = useState('')

  const [adminFirstName, setAdminFirstName] = useState('')
  const [adminLastName, setAdminLastName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPhone, setAdminPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errorField, setErrorField] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setErrorField(null)

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
      const res = await fetch('/api/command-center/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          centerName, centerEmail, centerPhone, centerAddress,
          adminFirstName, adminLastName, adminEmail, adminPhone, password,
        }),
      })

      const result = await res.json()

      if (!res.ok) {
        setError(result.error || 'Registration failed. Please try again.')
        setSubmitting(false)

        // The error box sits below a long form — take them to the offending field.
        if (result.field) {
          setErrorField(result.field)
          document.getElementById(result.field)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
          document.getElementById(result.field)?.focus({ preventScroll: true })
        }
        return
      }

      // Sign the administrator in so they land inside their own account
      await supabase.auth.signInWithPassword({ email: adminEmail, password })
      setDone(true)
      setTimeout(() => router.push('/business/dashboard'), 1600)
    } catch {
      setError('Something went wrong. Please try again.')
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-14 h-14 rounded-full bg-green-100 border-2 border-green-200 flex items-center justify-center mx-auto mb-5 dark:bg-green-900/30 dark:border-green-800">
            <CheckCircle2 className="w-7 h-7 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-2xl font-bold mb-3">{centerName} is registered</h1>
          <p className="text-muted-foreground text-sm mb-2">
            You&apos;re signed in as the administrator. Your account is
            <strong className="text-foreground"> pending SwiftDash approval</strong> before
            live dispatch is enabled.
          </p>
          <p className="text-xs text-muted-foreground/70">
            Meanwhile you can add your responder units and invite dispatchers.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <main className="flex flex-col items-center justify-start pt-14 pb-20 px-4">
        <div className="w-full max-w-lg">

          <div className="flex items-center justify-center gap-2.5 mb-8">
            <Image src="/assets/images/swiftdash_logo.png" alt="SwiftDash" width={28} height={28} />
            <span className="text-lg font-bold">SwiftDash</span>
          </div>

          <div className="text-center mb-7">
            <p className="text-[11px] font-mono uppercase tracking-wider text-primary mb-2">
              Emergency Dispatch
            </p>
            <h1 className="text-2xl font-bold leading-tight mb-2">
              Register your command center
            </h1>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Set up your emergency dispatch console. You&apos;ll be the administrator
              and can add dispatchers and responder units afterwards.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* ── The organization ── */}
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-2.5 pb-1">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Building2 className="w-4 h-4 text-primary" />
                  </div>
                  <h2 className="font-semibold text-sm">Command center</h2>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="centerName">Official name</Label>
                  <Input id="centerName" value={centerName} onChange={(e) => setCenterName(e.target.value)}
                    required disabled={submitting}
                    placeholder="Roxas City Emergency Command Center" />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="centerEmail">Official email</Label>
                  <Input id="centerEmail" type="email" value={centerEmail}
                    onChange={(e) => { setCenterEmail(e.target.value); setErrorField(null) }}
                    required disabled={submitting} placeholder="emergency@roxascity.gov.ph"
                    aria-invalid={errorField === 'centerEmail'}
                    className={errorField === 'centerEmail'
                      ? 'border-destructive focus-visible:ring-destructive' : ''} />
                  <p className="text-xs text-muted-foreground">
                    An organizational address, not a personal one.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="centerPhone">Hotline number</Label>
                  <Input id="centerPhone" type="tel" value={centerPhone}
                    onChange={(e) => setCenterPhone(e.target.value)}
                    disabled={submitting} placeholder="+63 36 000 0000" />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="centerAddress">Address</Label>
                  <Input id="centerAddress" value={centerAddress}
                    onChange={(e) => setCenterAddress(e.target.value)}
                    disabled={submitting} placeholder="City Hall, Roxas City, Capiz" />
                </div>
              </CardContent>
            </Card>

            {/* ── The administrator ── */}
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-2.5 pb-1">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <UserCog className="w-4 h-4 text-primary" />
                  </div>
                  <h2 className="font-semibold text-sm">Your administrator account</h2>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="adminFirstName">First name</Label>
                    <Input id="adminFirstName" value={adminFirstName}
                      onChange={(e) => setAdminFirstName(e.target.value)}
                      required disabled={submitting} autoComplete="given-name" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="adminLastName">Last name</Label>
                    <Input id="adminLastName" value={adminLastName}
                      onChange={(e) => setAdminLastName(e.target.value)}
                      required disabled={submitting} autoComplete="family-name" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="adminEmail">Your email</Label>
                  <Input id="adminEmail" type="email" value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    required disabled={submitting} autoComplete="email"
                    placeholder="you@roxascity.gov.ph" />
                  <p className="text-xs text-muted-foreground">This is your sign-in.</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="adminPhone">Your mobile number</Label>
                  <Input id="adminPhone" type="tel" value={adminPhone}
                    onChange={(e) => setAdminPhone(e.target.value)}
                    disabled={submitting} autoComplete="tel" placeholder="+63 917 000 0000" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" type="password" value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required disabled={submitting} autoComplete="new-password"
                      placeholder="8+ characters" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="confirmPassword">Confirm</Label>
                    <Input id="confirmPassword" type="password" value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required disabled={submitting} autoComplete="new-password" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button type="submit" disabled={submitting} size="lg" className="w-full rounded-full">
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating your command center…
                </>
              ) : 'Create command center'}
            </Button>

            <div className="flex items-start gap-2.5 px-1">
              <ShieldCheck className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                Your account is reviewed by SwiftDash before live dispatch is enabled.
                You can set up your units and dispatchers while that&apos;s in progress.
              </p>
            </div>

            <p className="text-center text-xs text-muted-foreground">
              Already registered?{' '}
              <Link href="/business/login" className="text-primary hover:underline">Sign in</Link>
            </p>
          </form>
        </div>
      </main>
    </div>
  )
}
