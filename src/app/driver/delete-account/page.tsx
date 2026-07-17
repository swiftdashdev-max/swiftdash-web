'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { ThemeToggle } from '@/components/theme-toggle'
import { ArrowLeft, Trash2, Lock, AlertTriangle, CheckCircle2, Loader2, Clock, FileText, ShieldAlert } from 'lucide-react'

type Step = 'info' | 'login' | 'confirm' | 'deleting' | 'done'

const DATA_DELETED = [
  { icon: '👤', label: 'Profile & personal info', desc: 'Name, profile photo, bank details, and contact information' },
  { icon: '🚗', label: 'Vehicle information', desc: 'Vehicle model, plate number, LTFRB number, and vehicle photos' },
  { icon: '📍', label: 'Location history', desc: 'All GPS location records and tracking history' },
  { icon: '📋', label: 'Verification documents', desc: 'Driver ID submissions and verification photos' },
  { icon: '🔔', label: 'Account status & preferences', desc: 'Online/offline status, availability settings, and FCM tokens' },
]

const DATA_RETAINED = [
  { icon: '💰', label: 'Earnings records', desc: 'Delivery earnings history retained for tax and financial compliance', period: '5 years' },
  { icon: '🏦', label: 'Payout history', desc: 'Bank transfer and cash-out records retained for audit purposes', period: '5 years' },
]

export default function DriverDeleteAccountPage() {
  const [step, setStep] = useState<Step>('info')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmText, setConfirmText] = useState('')

  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) {
        setError('Invalid email or password. Please try again.')
        return
      }
      setStep('confirm')
    } catch {
      setError('An unexpected error occurred.')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (confirmText !== 'DELETE') return

    setStep('deleting')
    setError(null)

    try {
      const { error: fnError } = await supabase.functions.invoke('delete-driver-account')

      if (fnError) {
        setError(fnError.message || 'Failed to delete account. Please contact support.')
        setStep('confirm')
        return
      }

      await supabase.auth.signOut()
      setStep('done')
    } catch {
      setError('An unexpected error occurred. Please contact support@swiftdashdms.com')
      setStep('confirm')
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <main className="flex flex-col items-center justify-start pt-16 pb-16 px-4">
        <div className="w-full max-w-2xl space-y-8">

          {/* ─── STEP: INFO ─── */}
          {step === 'info' && (
            <div className="space-y-8 animate-in fade-in duration-500">
              <Link href="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="w-4 h-4 mr-1.5" />
                Back to Home
              </Link>

              <div className="space-y-1 border-b pb-6">
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">SwiftDash Driver</p>
                <h1 className="text-3xl font-bold">Delete Your Account</h1>
                <p className="text-muted-foreground text-sm">
                  Please review what will be deleted before continuing.
                </p>
              </div>

              {/* Steps */}
              <section>
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <FileText className="w-4 h-4 text-primary" />
                  </div>
                  <h2 className="text-lg font-semibold">How it works</h2>
                </div>
                <Card>
                  <CardContent className="p-5 space-y-3">
                    {[
                      'Sign in with your SwiftDash driver email and password.',
                      'Review the data that will be permanently deleted.',
                      'Type DELETE to confirm and submit your request.',
                      'Your account and personal data will be permanently removed.',
                    ].map((text, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-semibold text-primary">
                          {i + 1}
                        </span>
                        <p className="text-sm text-muted-foreground pt-0.5">{text}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </section>

              {/* Data deleted */}
              <section>
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center">
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </div>
                  <h2 className="text-lg font-semibold">Permanently Deleted</h2>
                </div>
                <div className="grid sm:grid-cols-2 gap-2.5">
                  {DATA_DELETED.map(({ icon, label, desc }) => (
                    <Card key={label} className="border-destructive/10 bg-destructive/[0.02]">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2.5 mb-1">
                          <span className="text-base">{icon}</span>
                          <span className="font-medium text-sm">{label}</span>
                        </div>
                        <p className="text-xs text-muted-foreground pl-8">{desc}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>

              {/* Data retained */}
              <section>
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <Clock className="w-4 h-4 text-amber-600" />
                  </div>
                  <h2 className="text-lg font-semibold">Retained for Legal Compliance</h2>
                </div>
                <div className="space-y-2.5">
                  {DATA_RETAINED.map(({ icon, label, desc, period }) => (
                    <Card key={label} className="border-amber-500/15 bg-amber-500/[0.02]">
                      <CardContent className="p-4 flex items-start gap-3">
                        <span className="text-base flex-shrink-0">{icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-0.5">
                            <span className="font-medium text-sm">{label}</span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 flex-shrink-0 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800">
                              {period}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">{desc}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>

              <Card className="border-border/60 bg-muted/30">
                <CardContent className="p-4 flex items-start gap-3">
                  <ShieldAlert className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium mb-0.5">Need help instead?</p>
                    <p className="text-xs text-muted-foreground">
                      Contact us at{' '}
                      <a href="mailto:support@swiftdashdms.com" className="text-primary hover:underline">
                        support@swiftdashdms.com
                      </a>{' '}
                      if you have questions or issues with your account.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Button onClick={() => setStep('login')} variant="destructive" size="lg" className="rounded-full px-8">
                Continue to Sign In
              </Button>
            </div>
          )}

          {/* ─── STEP: LOGIN ─── */}
          {step === 'login' && (
            <div className="animate-in fade-in duration-500 max-w-sm mx-auto w-full">
              <button
                onClick={() => setStep('info')}
                className="text-sm text-muted-foreground hover:text-foreground mb-6 flex items-center gap-1.5 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back
              </button>

              <Card>
                <CardContent className="p-7">
                  <div className="text-center mb-6">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-3">
                      <Lock className="w-5 h-5 text-primary" />
                    </div>
                    <h2 className="text-lg font-bold">Verify Your Identity</h2>
                    <p className="text-sm text-muted-foreground mt-1">Sign in to confirm this is your account</p>
                  </div>

                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="del-email">Email</Label>
                      <Input
                        id="del-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={loading}
                        placeholder="your@email.com"
                        autoComplete="email"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="del-password">Password</Label>
                      <Input
                        id="del-password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        disabled={loading}
                        placeholder="••••••••"
                        autoComplete="current-password"
                      />
                    </div>

                    {error && (
                      <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
                        {error}
                      </div>
                    )}

                    <Button type="submit" disabled={loading} className="w-full rounded-full" size="lg">
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Signing in...
                        </>
                      ) : 'Sign In & Continue'}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ─── STEP: CONFIRM ─── */}
          {step === 'confirm' && (
            <div className="animate-in fade-in duration-500 max-w-sm mx-auto w-full">
              <Card className="border-destructive/20 overflow-hidden">
                <div className="h-1 bg-gradient-to-r from-destructive to-red-400" />
                <CardContent className="p-7">
                  <div className="text-center mb-5">
                    <div className="w-14 h-14 rounded-full bg-destructive/10 border-2 border-destructive/20 flex items-center justify-center mx-auto mb-3">
                      <AlertTriangle className="w-6 h-6 text-destructive" />
                    </div>
                    <h2 className="text-lg font-bold text-destructive">This cannot be undone</h2>
                    <p className="text-xs text-muted-foreground mt-1">
                      Signed in as <span className="text-foreground font-medium">{email}</span>
                    </p>
                  </div>

                  <div className="p-3.5 rounded-lg bg-muted/50 border text-sm text-muted-foreground leading-relaxed mb-5">
                    Your profile, vehicle info, location history, verification documents, and all personal data will be{' '}
                    <span className="text-destructive font-medium">permanently deleted</span>.
                    Earnings and payout records are retained for legal compliance.
                  </div>

                  <div className="mb-5 space-y-1.5">
                    <Label htmlFor="confirm-del">
                      Type <span className="font-mono text-destructive font-bold">DELETE</span> to confirm
                    </Label>
                    <Input
                      id="confirm-del"
                      type="text"
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      placeholder="DELETE"
                      autoComplete="off"
                      className="text-center tracking-widest font-mono"
                    />
                  </div>

                  {error && (
                    <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive mb-4">
                      {error}
                    </div>
                  )}

                  <Button
                    onClick={handleDelete}
                    disabled={confirmText !== 'DELETE'}
                    variant="destructive"
                    size="lg"
                    className="w-full rounded-full"
                  >
                    Permanently Delete My Account
                  </Button>

                  <button
                    onClick={async () => {
                      await supabase.auth.signOut()
                      setStep('info')
                      setConfirmText('')
                      setEmail('')
                      setPassword('')
                      setError(null)
                    }}
                    className="w-full mt-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Cancel — keep my account
                  </button>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ─── STEP: DELETING ─── */}
          {step === 'deleting' && (
            <div className="animate-in fade-in duration-500 text-center py-24">
              <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-5" />
              <h2 className="text-lg font-bold mb-2">Deleting your account...</h2>
              <p className="text-sm text-muted-foreground">Please don&apos;t close this page.</p>
            </div>
          )}

          {/* ─── STEP: DONE ─── */}
          {step === 'done' && (
            <div className="animate-in fade-in duration-500 max-w-sm mx-auto text-center py-20">
              <div className="w-14 h-14 rounded-full bg-green-100 border-2 border-green-200 flex items-center justify-center mx-auto mb-5 dark:bg-green-900/30 dark:border-green-800">
                <CheckCircle2 className="w-7 h-7 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Account Deleted</h2>
              <p className="text-muted-foreground text-sm mb-1">
                Your SwiftDash driver account and personal data have been permanently removed.
              </p>
              <p className="text-xs text-muted-foreground/70 mb-8">
                Earnings and payout records are retained for up to 5 years as required by law.
              </p>
              <Link href="/">
                <Button variant="outline" className="rounded-full px-6">
                  Return to SwiftDash
                </Button>
              </Link>
            </div>
          )}

        </div>
      </main>
    </div>
  )
}
