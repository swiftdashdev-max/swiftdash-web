'use client';

import { useState, useEffect, useRef } from 'react';
import { useUserContext } from '@/lib/supabase/user-context';
import { createClient } from '@/lib/supabase/client';
import { uploadBusinessLogo } from '@/lib/supabase/storage';
import { LogoCropModal } from '@/components/logo-crop-modal';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Settings as SettingsIcon, 
  Palette, 
  Upload, 
  Image as ImageIcon,
  Link as LinkIcon,
  Loader2,
  CheckCircle2,
  Building2,
  Eye,
  MessageCircle,
  ExternalLink,
  X,
  ImagePlus,
  Map,
  Mail,
  MessageSquare,
  Truck,
  PartyPopper,
  Crop,
  Maximize2,
  Send,
  Phone,
  FlaskConical,
} from 'lucide-react';

export default function SettingsPage() {
  const { user, businessId, loading: userLoading } = useUserContext();
  const { toast } = useToast();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingTestSms, setSendingTestSms] = useState(false);
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testEmail, setTestEmail] = useState('');
  
  // Business Info
  const [businessName, setBusinessName] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');
  
  // Branding Settings
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#3b82f6');
  const [headerBgColor, setHeaderBgColor] = useState('');
  const [tagline, setTagline] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [showDriverInfo, setShowDriverInfo] = useState(true);
  const [showSupportContact, setShowSupportContact] = useState(true);
  const [showDriverPhone, setShowDriverPhone] = useState(true);
  const [showPickupAddress, setShowPickupAddress] = useState(true);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoDragOver, setLogoDragOver] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const logoFileInputRef = useRef<HTMLInputElement>(null);

  // New customization fields
  const [accentColor, setAccentColor] = useState('#3b82f6');
  const [pageBgColor, setPageBgColor] = useState('');
  const [logoSize, setLogoSize] = useState<'sm' | 'md' | 'lg' | 'xl'>('md');
  const [footerMessage, setFooterMessage] = useState('');
  const [inTransitMessage, setInTransitMessage] = useState('');
  const [deliveredMessage, setDeliveredMessage] = useState('');
  const [mapStyle, setMapStyle] = useState('streets');
  const [supportEmail, setSupportEmail] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [smsOnBooking, setSmsOnBooking] = useState(true);
  const [smsNotifyPickup, setSmsNotifyPickup] = useState(false);
  const [smsTemplate, setSmsTemplate] = useState('');
  const [emailOnBooking, setEmailOnBooking] = useState(true);
  const [emailNotifyPickup, setEmailNotifyPickup] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');

  const handleLogoFileChange = async (file: File) => {
    if (!businessId) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Invalid file', description: 'Please upload an image file (PNG, JPG, WebP, SVG)', variant: 'destructive' });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Logo must be under 2MB', variant: 'destructive' });
      return;
    }
    // Open crop modal
    setCropFile(file);
  };

  const handleCropConfirm = async (croppedFile: File) => {
    if (!businessId) return;
    setCropFile(null);
    try {
      setLogoUploading(true);
      const result = await uploadBusinessLogo(croppedFile, businessId);
      if (!result.success || !result.publicUrl) throw new Error(result.error);
      setLogoUrl(result.publicUrl);
      toast({ title: 'Logo uploaded ✓', description: 'Your logo has been uploaded successfully' });
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message || 'Could not upload logo', variant: 'destructive' });
    } finally {
      setLogoUploading(false);
    }
  };

  useEffect(() => {
    if (!businessId) return;

    const fetchSettings = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('business_accounts')
          .select('business_name, business_phone, settings')
          .eq('id', businessId)
          .single();

        if (error) throw error;

        if (data) {
          setBusinessName(data.business_name || '');
          setBusinessPhone(data.business_phone || '');
          
          // Parse settings JSONB
          const settings = data.settings || {};
          setLogoUrl(settings.logo_url || '');
          setPrimaryColor(settings.primary_color || '#3b82f6');
          setHeaderBgColor(settings.header_bg_color || '');
          setTagline(settings.tagline || '');
          setCustomMessage(settings.custom_message || '');
          setShowDriverInfo(settings.tracking_page?.show_driver_info ?? true);
          setShowSupportContact(settings.tracking_page?.show_support_contact ?? true);
          setShowDriverPhone(settings.show_driver_phone ?? true);
          setShowPickupAddress(settings.show_pickup_address ?? true);
          setAccentColor(settings.accent_color || settings.primary_color || '#3b82f6');
          setPageBgColor(settings.page_bg_color || '');
          setLogoSize(settings.logo_size || 'md');
          setFooterMessage(settings.footer_message || '');
          setInTransitMessage(settings.in_transit_message || '');
          setDeliveredMessage(settings.delivered_message || '');
          setMapStyle(settings.map_style || 'streets');
          setSupportEmail(settings.support_email || '');
          setWhatsappNumber(settings.whatsapp_number || '');
          setSmsOnBooking(settings.sms_on_booking !== false);
          setSmsNotifyPickup(settings.sms_notify_pickup === true);
          setSmsTemplate(settings.sms_template || '');
          setEmailOnBooking(settings.email_on_booking !== false);
          setEmailNotifyPickup(settings.email_notify_pickup === true);
          setEmailSubject(settings.email_subject || '');
        }
      } catch (error: any) {
        console.error('Error fetching settings:', error);
        toast({
          title: 'Error',
          description: 'Failed to load settings',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [businessId]);

  const handleTestSms = async () => {
    if (!testPhone.trim()) {
      toast({ title: 'Enter a phone number', description: 'Type a Philippine mobile number to send the test to', variant: 'destructive' });
      return;
    }
    try {
      setSendingTestSms(true);
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      const response = await fetch(`${supabaseUrl}/functions/v1/send-tracking-sms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'apikey': supabaseAnonKey || '',
        },
        body: JSON.stringify({ test: true, phone: testPhone.trim(), businessId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to send test SMS');
      toast({ title: 'Test SMS sent! ✅', description: `SMS dispatched to ${testPhone}` });
    } catch (err: any) {
      toast({ title: 'Test SMS failed', description: err.message, variant: 'destructive' });
    } finally {
      setSendingTestSms(false);
    }
  };

  const handleTestEmail = async () => {
    if (!testEmail.trim()) {
      toast({ title: 'Enter an email address', description: 'Type an email to send the test to', variant: 'destructive' });
      return;
    }
    try {
      setSendingTestEmail(true);
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      const response = await fetch(`${supabaseUrl}/functions/v1/send-tracking-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'apikey': supabaseAnonKey || '',
        },
        body: JSON.stringify({ test: true, email: testEmail.trim(), businessId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to send test email');
      toast({ title: 'Test email sent! ✅', description: `Email dispatched to ${testEmail}` });
    } catch (err: any) {
      toast({ title: 'Test email failed', description: err.message, variant: 'destructive' });
    } finally {
      setSendingTestEmail(false);
    }
  };

  const handleSave = async () => {
    console.log('handleSave called, businessId:', businessId, 'user:', user?.id);
    if (!businessId) {
      toast({ title: 'Error', description: 'No business account found. Please refresh the page.', variant: 'destructive' });
      return;
    }

    try {
      setSaving(true);

      const settings = {
        logo_url: logoUrl || null,
        primary_color: primaryColor,
        accent_color: accentColor,
        logo_size: logoSize,
        header_bg_color: headerBgColor || null,
        page_bg_color: pageBgColor || null,
        tagline: tagline || null,
        custom_message: customMessage || null,
        footer_message: footerMessage || null,
        in_transit_message: inTransitMessage || null,
        delivered_message: deliveredMessage || null,
        map_style: mapStyle,
        support_email: supportEmail || null,
        whatsapp_number: whatsappNumber || null,
        sms_on_booking: smsOnBooking,
        sms_notify_pickup: smsNotifyPickup,
        sms_template: smsTemplate || null,
        email_on_booking: emailOnBooking,
        email_notify_pickup: emailNotifyPickup,
        email_subject: emailSubject || null,
        show_driver_phone: showDriverPhone,
        show_pickup_address: showPickupAddress,
        tracking_page: {
          show_driver_info: showDriverInfo,
          show_support_contact: showSupportContact,
        },
      };

      console.log('Updating business_accounts with id:', businessId);
      console.log('Settings payload:', settings);

      const { data: updateData, error } = await supabase
        .from('business_accounts')
        .update({
          business_name: businessName,
          business_phone: businessPhone,
          settings: settings,
        })
        .eq('id', businessId)
        .select();

      console.log('Update result:', updateData, 'Error:', error);
      if (error) throw error;
      if (!updateData || updateData.length === 0) {
        throw new Error('No rows updated — RLS may be blocking this update. Check that your user owns this business account.');
      }

      toast({
        title: 'Settings Saved! ✓',
        description: 'Your branding settings have been updated',
      });
    } catch (error: any) {
      console.error('Error saving settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to save settings',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const generateTrackingPreviewUrl = () => {
    const base = `${window.location.origin}/track/SD-PREVIEW-DEMO`;
    return businessId ? `${base}?bizId=${businessId}` : base;
  };

  if (loading || userLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <>
      {cropFile && (
        <LogoCropModal
          file={cropFile}
          onConfirm={handleCropConfirm}
          onCancel={() => setCropFile(null)}
        />
      )}
      <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Settings</h1>
        <p className="text-muted-foreground">
          Manage your business profile and white-label branding
        </p>
      </div>

      <div className="space-y-6">
        {/* Business Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Business Information
            </CardTitle>
            <CardDescription>
              Basic information about your business
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="business-name">Business Name</Label>
              <Input
                id="business-name"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Your Business Name"
              />
              <p className="text-xs text-muted-foreground">
                This name will appear on customer tracking pages
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="business-phone">Support Phone Number</Label>
              <Input
                id="business-phone"
                value={businessPhone}
                onChange={(e) => setBusinessPhone(e.target.value)}
                placeholder="+639171234567"
              />
              <p className="text-xs text-muted-foreground">
                Customers can call this number for support from the tracking page
              </p>
            </div>
          </CardContent>
        </Card>

        {/* White-Label Branding */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              White-Label Branding
            </CardTitle>
            <CardDescription>
              Customize how your tracking page looks to customers
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">

            {/* Logo Upload */}
            <div className="space-y-2">
              <Label>Business Logo</Label>

              {/* Drop zone */}
              <div
                className={`relative border-2 border-dashed rounded-xl transition-colors cursor-pointer ${
                  logoDragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30'
                }`}
                onClick={() => logoFileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setLogoDragOver(true); }}
                onDragLeave={() => setLogoDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setLogoDragOver(false);
                  const file = e.dataTransfer.files[0];
                  if (file) handleLogoFileChange(file);
                }}
              >
                <input
                  ref={logoFileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoFileChange(f); }}
                />

                {logoUploading ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-2">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Uploading...</p>
                  </div>
                ) : logoUrl ? (
                  <div className="flex items-center gap-4 p-4">
                    <img
                      src={logoUrl}
                      alt="Business logo"
                      className="h-14 max-w-[180px] object-contain rounded-lg bg-white border p-2"
                      onError={(e) => { e.currentTarget.src = ''; }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">Logo uploaded</p>
                      <p className="text-xs text-muted-foreground truncate">{logoUrl.split('/').pop()}</p>
                      <p className="text-xs text-primary mt-1">Click to replace</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); logoFileInputRef.current?.click(); }}
                        className="flex items-center gap-1 p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors text-xs"
                        title="Crop logo"
                      >
                        <Crop className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setLogoUrl(''); }}
                        className="flex-shrink-0 p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 gap-2">
                    <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                      <ImagePlus className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium">Drop your logo here</p>
                      <p className="text-xs text-muted-foreground">or click to browse</p>
                    </div>
                    <p className="text-xs text-muted-foreground">PNG, JPG, WebP or SVG · Max 2MB · Recommended 200×50px</p>
                  </div>
                )}
              </div>
            </div>

            {/* Logo Size */}
            {logoUrl && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Maximize2 className="h-4 w-4" />
                  Logo Size on Tracking Page
                </Label>
                <div className="grid grid-cols-4 gap-2">
                  {([['sm', 'Small'], ['md', 'Medium'], ['lg', 'Large'], ['xl', 'X-Large']] as const).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setLogoSize(val)}
                      className={`py-2 rounded-lg border text-sm font-medium transition-all ${
                        logoSize === val
                          ? 'border-primary bg-primary text-white'
                          : 'border-border bg-background hover:border-primary/50 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">Controls how large the logo appears in the tracking page header</p>
              </div>
            )}

            <Separator />
            <div className="space-y-2">
              <Label htmlFor="tagline">Tagline</Label>
              <Input
                id="tagline"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="Fast & reliable delivery"
                maxLength={60}
              />
              <p className="text-xs text-muted-foreground">
                Short subtitle shown below your business name in the tracking header
              </p>
            </div>

            <Separator />

            {/* Custom Message */}
            <div className="space-y-2">
              <Label htmlFor="custom-message" className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4" />
                Customer Message
              </Label>
              <Textarea
                id="custom-message"
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder="Thank you for your order! Your package is on its way 🎉"
                rows={2}
                maxLength={160}
              />
              <p className="text-xs text-muted-foreground">
                Optional banner message shown to customers on the tracking page. Leave blank to hide.
              </p>
            </div>

            <Separator />

            {/* Colors */}
            <div className="space-y-4">
              <Label>Brand Colors</Label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Primary Color</p>
                  <div className="flex gap-2 items-center">
                    <Input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-14 h-10 cursor-pointer p-1"
                    />
                    <Input
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      placeholder="#3b82f6"
                      className="flex-1 font-mono text-sm"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Timeline, badges</p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Accent / Button Color <span className="text-muted-foreground font-normal">(optional)</span></p>
                  <div className="flex gap-2 items-center">
                    <Input
                      type="color"
                      value={accentColor || primaryColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      className="w-14 h-10 cursor-pointer p-1"
                    />
                    <Input
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      placeholder="Same as primary"
                      className="flex-1 font-mono text-sm"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Buttons, Call links, icons</p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Header Background <span className="text-muted-foreground font-normal">(optional)</span></p>
                  <div className="flex gap-2 items-center">
                    <Input
                      type="color"
                      value={headerBgColor || primaryColor}
                      onChange={(e) => setHeaderBgColor(e.target.value)}
                      className="w-14 h-10 cursor-pointer p-1"
                    />
                    <Input
                      value={headerBgColor}
                      onChange={(e) => setHeaderBgColor(e.target.value)}
                      placeholder="Same as primary"
                      className="flex-1 font-mono text-sm"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Leave blank to use primary color</p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Page Background <span className="text-muted-foreground font-normal">(optional)</span></p>
                  <div className="flex gap-2 items-center">
                    <Input
                      type="color"
                      value={pageBgColor || '#f9fafb'}
                      onChange={(e) => setPageBgColor(e.target.value)}
                      className="w-14 h-10 cursor-pointer p-1"
                    />
                    <Input
                      value={pageBgColor}
                      onChange={(e) => setPageBgColor(e.target.value)}
                      placeholder="Default gray"
                      className="flex-1 font-mono text-sm"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Background color of the tracking page</p>
                </div>
              </div>

              {/* Live header preview */}
              {(() => {
                const previewBg = headerBgColor || primaryColor;
                const hex = previewBg.replace('#', '');
                const r = parseInt(hex.slice(0, 2), 16);
                const g = parseInt(hex.slice(2, 4), 16);
                const b = parseInt(hex.slice(4, 6), 16);
                const isDark = (r * 299 + g * 587 + b * 114) / 1000 < 128;
                const textColor = isDark ? 'white' : '#1f2937';
                const subColor = isDark ? 'rgba(255,255,255,0.7)' : 'rgba(31,41,55,0.6)';
                return (
                  <div className="rounded-xl overflow-hidden border shadow-sm">
                    <div
                      className="px-4 py-3 flex items-center justify-between"
                      style={{ backgroundColor: previewBg }}
                    >
                      <div className="flex items-center gap-3">
                        {logoUrl ? (
                          <div className="bg-white rounded-lg p-1 shadow-sm flex-shrink-0">
                            <img
                              src={logoUrl}
                              alt="logo"
                              className={`w-auto object-contain block ${
                                logoSize === 'sm' ? 'h-4 max-w-[60px]' :
                                logoSize === 'lg' ? 'h-9 max-w-[130px]' :
                                logoSize === 'xl' ? 'h-12 max-w-[160px]' :
                                'h-6 max-w-[100px]'
                              }`}
                            />
                          </div>
                        ) : (
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: 'rgba(128,128,128,0.2)' }}
                          >
                            <Building2 className="h-4 w-4" style={{ color: textColor }} />
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-bold" style={{ color: textColor }}>
                            {businessName || 'Your Business'}
                          </p>
                          <p className="text-xs" style={{ color: subColor }}>
                            {tagline || 'Track Your Delivery'}
                          </p>
                        </div>
                      </div>
                      <div
                        className="px-2 py-1 rounded-md text-xs font-medium"
                        style={{ backgroundColor: 'rgba(128,128,128,0.2)', color: textColor }}
                      >
                        Share
                      </div>
                    </div>
                    {customMessage && (
                      <div
                        className="px-4 py-2 text-xs flex items-center gap-2"
                        style={{
                          backgroundColor: `${primaryColor}15`,
                          color: primaryColor,
                          borderTop: `1px solid ${primaryColor}25`,
                        }}
                      >
                        <MessageCircle className="h-3 w-3 flex-shrink-0" />
                        {customMessage}
                      </div>
                    )}
                    <div className="px-4 py-2 bg-muted/30">
                      <p className="text-xs text-muted-foreground text-center">↑ Live tracking header preview</p>
                    </div>
                  </div>
                );
              })()}
            </div>

            <Separator />

            {/* Visibility Toggles */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Customer Visibility
              </Label>

              {([
                { label: 'Show driver card', desc: 'Show driver name and avatar on tracking page', value: showDriverInfo, set: setShowDriverInfo },
                { label: 'Show driver phone number', desc: 'Allow customers to call the driver directly', value: showDriverPhone, set: setShowDriverPhone },
                { label: 'Show pickup address', desc: 'Show where the delivery was picked up from', value: showPickupAddress, set: setShowPickupAddress },
                { label: 'Show support contact', desc: 'Show "Need Help?" card with your support number', value: showSupportContact, set: setShowSupportContact },
              ] as const).map((item) => (
                <div key={item.label} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium text-sm">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                  <Switch
                    checked={item.value}
                    onCheckedChange={item.set}
                  />
                </div>
              ))}
            </div>

            <Separator />

            {/* Map Style */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Map className="h-4 w-4" />
                Map Style
              </Label>
              <Select value={mapStyle} onValueChange={setMapStyle}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a map style" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="streets">🗺️ Streets (Default)</SelectItem>
                  <SelectItem value="light">☀️ Light</SelectItem>
                  <SelectItem value="dark">🌙 Dark</SelectItem>
                  <SelectItem value="satellite">🛰️ Satellite</SelectItem>
                  <SelectItem value="outdoors">🏔️ Outdoors</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Map theme shown to customers on the tracking page</p>
            </div>

            <Separator />

            {/* Status Messages */}
            <div className="space-y-4">
              <Label className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Custom Status Messages
              </Label>
              <p className="text-xs text-muted-foreground -mt-2">Override the default messages shown at different delivery stages. Leave blank to use defaults.</p>

              <div className="space-y-2">
                <p className="text-sm font-medium flex items-center gap-1.5"><Truck className="h-3.5 w-3.5 text-blue-500" /> In Transit Message</p>
                <Input
                  value={inTransitMessage}
                  onChange={(e) => setInTransitMessage(e.target.value)}
                  placeholder="Your package is on its way!"
                  maxLength={100}
                />
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium flex items-center gap-1.5"><PartyPopper className="h-3.5 w-3.5 text-green-500" /> Delivered Message</p>
                <Input
                  value={deliveredMessage}
                  onChange={(e) => setDeliveredMessage(e.target.value)}
                  placeholder="Your order has been delivered! Thank you 🎉"
                  maxLength={100}
                />
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Footer Message</p>
                <Input
                  value={footerMessage}
                  onChange={(e) => setFooterMessage(e.target.value)}
                  placeholder="Thank you for choosing us!"
                  maxLength={120}
                />
                <p className="text-xs text-muted-foreground">Shown at the bottom of the tracking page</p>
              </div>
            </div>

            <Separator />

            {/* Contact Options */}
            <div className="space-y-4">
              <Label className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Support Contact Options
              </Label>

              <div className="space-y-2">
                <p className="text-sm font-medium">Support Email</p>
                <Input
                  type="email"
                  value={supportEmail}
                  onChange={(e) => setSupportEmail(e.target.value)}
                  placeholder="support@yourbusiness.com"
                />
                <p className="text-xs text-muted-foreground">Email link shown alongside the call button in the support card</p>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">WhatsApp Number</p>
                <Input
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  placeholder="+639171234567"
                />
                <p className="text-xs text-muted-foreground">Adds a WhatsApp button on the tracking page support card</p>
              </div>
            </div>

          </CardContent>
        </Card>

        {/* SMS Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-4 w-4" />
              SMS Notifications
            </CardTitle>
            <CardDescription>Automatically send a tracking link via SMS when a delivery is booked</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">

            {/* Toggle: send on booking */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Send SMS on Booking</p>
                <p className="text-xs text-muted-foreground mt-0.5">Send a tracking link to the recipient when a delivery is created</p>
              </div>
              <Switch checked={smsOnBooking} onCheckedChange={setSmsOnBooking} />
            </div>

            {/* Toggle: notify pickup contact */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Also Notify Sender / Pickup Contact</p>
                <p className="text-xs text-muted-foreground mt-0.5">Send the tracking link to the pickup contact as well</p>
              </div>
              <Switch checked={smsNotifyPickup} onCheckedChange={setSmsNotifyPickup} disabled={!smsOnBooking} />
            </div>

            {/* Custom template */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Custom SMS Template</p>
              <textarea
                className="w-full min-h-[90px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-y"
                value={smsTemplate}
                onChange={(e) => setSmsTemplate(e.target.value)}
                placeholder="{business_name}: Hi {name}! Your delivery has been booked 📦&#10;Track it here: {tracking_url}"
                disabled={!smsOnBooking}
              />
              <p className="text-xs text-muted-foreground">
                Available placeholders: <code className="bg-muted px-1 rounded">{'{name}'}</code>, <code className="bg-muted px-1 rounded">{'{tracking_url}'}</code>, <code className="bg-muted px-1 rounded">{'{business_name}'}</code>. Leave blank to use the default message.
              </p>
            </div>

            <Separator />

            {/* Test SMS */}
            <div className="space-y-2">
              <p className="text-sm font-medium flex items-center gap-1.5">
                <FlaskConical className="h-4 w-4 text-muted-foreground" />
                Send Test SMS
              </p>
              <div className="flex gap-2">
                <Input
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="09XXXXXXXXX"
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTestSms}
                  disabled={sendingTestSms || !smsOnBooking}
                  className="flex-shrink-0"
                >
                  {sendingTestSms ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-1.5" />
                      Send Test
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Sends a sample tracking SMS to verify your Semaphore integration is working</p>
            </div>

          </CardContent>
        </Card>

        {/* Email Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="h-4 w-4" />
              Email Notifications
            </CardTitle>
            <CardDescription>Send a branded booking confirmation email with the tracking link</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Send Email on Booking</p>
                <p className="text-xs text-muted-foreground mt-0.5">Send a tracking email to the recipient when a delivery is created</p>
              </div>
              <Switch checked={emailOnBooking} onCheckedChange={setEmailOnBooking} />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Also Notify Sender / Pickup Contact</p>
                <p className="text-xs text-muted-foreground mt-0.5">Send the tracking email to the pickup contact as well</p>
              </div>
              <Switch checked={emailNotifyPickup} onCheckedChange={setEmailNotifyPickup} disabled={!emailOnBooking} />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Custom Email Subject</p>
              <Input
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder="{business_name} — Your Delivery is Booked! 📦"
                disabled={!emailOnBooking}
              />
              <p className="text-xs text-muted-foreground">
                Placeholders: <code className="bg-muted px-1 rounded">{'{name}'}</code>, <code className="bg-muted px-1 rounded">{'{tracking_number}'}</code>, <code className="bg-muted px-1 rounded">{'{business_name}'}</code>. Leave blank for default.
              </p>
            </div>

            <Separator />

            {/* Test Email */}
            <div className="space-y-2">
              <p className="text-sm font-medium flex items-center gap-1.5">
                <FlaskConical className="h-4 w-4 text-muted-foreground" />
                Send Test Email
              </p>
              <div className="flex gap-2">
                <Input
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTestEmail}
                  disabled={sendingTestEmail || !emailOnBooking}
                  className="flex-shrink-0"
                >
                  {sendingTestEmail ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-1.5" />
                      Send Test
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Sends a sample booking confirmation email to verify your Resend integration is working</p>
            </div>

          </CardContent>
        </Card>

        {/* Preview Link */}
        <Card className="border-dashed">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium text-sm">Preview your tracking page</p>
                <p className="text-xs text-muted-foreground mt-1">Save your settings first, then open a real tracking link to see your changes live.</p>
              </div>
              <Button variant="outline" size="sm" className="flex-shrink-0" asChild>
                <a href={generateTrackingPreviewUrl()} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open Preview
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => window.location.reload()}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
    </>
  );
}
