'use client';

import { useState, useEffect, useRef } from 'react';
import { useUserContext } from '@/lib/supabase/user-context';
import { createClient } from '@/lib/supabase/client';
import { uploadBusinessLogo, uploadBusinessFavicon } from '@/lib/supabase/storage';
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
import Image from 'next/image';
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
  Map as MapIcon,
  Mail,
  MessageSquare,
  Truck,
  PartyPopper,
  Crop,
  Maximize2,
  Send,
  Phone,
  FlaskConical,
  Globe,
  Type,
  CreditCard,
  Plus,
  Trash2,
  GripVertical,
  DollarSign,
} from 'lucide-react';

interface VehicleTypeRow {
  id: string;
  name: string;
  base_price: number;
  price_per_km: number;
  additional_stop_charge: number;
  max_weight_kg: number | null;
  is_active: boolean;
}

interface FleetVehicle {
  id?: string; // uuid from business_vehicle_pricing
  vehicle_type_id: string;
  vehicle_name: string; // from vehicle_types.name
  is_enabled: boolean;
  display_name: string;
  image_url: string;
  base_price: number;
  price_per_km: number;
  additional_stop_charge: number;
  max_weight_kg: number | null;
  description: string;
  sort_order: number;
}

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

  // Enhanced customization fields
  const [faviconUrl, setFaviconUrl] = useState('');
  const [faviconUploading, setFaviconUploading] = useState(false);
  const faviconFileInputRef = useRef<HTMLInputElement>(null);
  const [logoBgTransparent, setLogoBgTransparent] = useState(false);
  const [headerTextColor, setHeaderTextColor] = useState('');
  const [bodyTextColor, setBodyTextColor] = useState('');
  const [cardBgColor, setCardBgColor] = useState('');

  // Storefront settings
  const [storefrontEnabled, setStorefrontEnabled] = useState(false);
  const [storefrontSlug, setStorefrontSlug] = useState('');
  const [storefrontHeroText, setStorefrontHeroText] = useState('');
  const [storefrontDescription, setStorefrontDescription] = useState('');
  const [storefrontMaxStops, setStorefrontMaxStops] = useState(5);
  const [storefrontShowPrice, setStorefrontShowPrice] = useState(true);
  const [storefrontSaving, setStorefrontSaving] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [checkingSlug, setCheckingSlug] = useState(false);
  // Extended storefront settings
  const [storefrontAccentColor, setStorefrontAccentColor] = useState('');
  const [storefrontTaglineBadges, setStorefrontTaglineBadges] = useState('Fast Delivery, Real-time Tracking, Insured');
  const [storefrontOperatingHours, setStorefrontOperatingHours] = useState('');
  const [storefrontBookingNote, setStorefrontBookingNote] = useState('');
  const [storefrontBannerImageUrl, setStorefrontBannerImageUrl] = useState('');
  const [storefrontPaymentMethods, setStorefrontPaymentMethods] = useState<string[]>(['cash', 'maya']);

  // Fleet vehicles & pricing
  const [allVehicleTypes, setAllVehicleTypes] = useState<VehicleTypeRow[]>([]);
  const [fleetVehicles, setFleetVehicles] = useState<FleetVehicle[]>([]);
  const [fleetSaving, setFleetSaving] = useState(false);
  const [fleetImageUploading, setFleetImageUploading] = useState<string | null>(null);

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

  const handleFaviconUpload = async (file: File) => {
    if (!businessId) return;
    const validTypes = ['image/png', 'image/x-icon', 'image/vnd.microsoft.icon', 'image/svg+xml', 'image/jpeg'];
    if (!validTypes.includes(file.type)) {
      toast({ title: 'Invalid file', description: 'Please upload a PNG, ICO, SVG or JPG file', variant: 'destructive' });
      return;
    }
    if (file.size > 1024 * 1024) {
      toast({ title: 'File too large', description: 'Favicon must be under 1MB', variant: 'destructive' });
      return;
    }
    try {
      setFaviconUploading(true);
      const result = await uploadBusinessFavicon(file, businessId);
      if (!result.success || !result.publicUrl) throw new Error(result.error);
      setFaviconUrl(result.publicUrl);
      toast({ title: 'Favicon uploaded ✓', description: 'Your favicon has been uploaded' });
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message || 'Could not upload favicon', variant: 'destructive' });
    } finally {
      setFaviconUploading(false);
    }
  };

  useEffect(() => {
    if (!businessId) return;

    const fetchSettings = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('business_accounts')
          .select('business_name, business_phone, settings, slug, storefront_enabled, storefront_settings')
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
          setFaviconUrl(settings.favicon_url || '');
          setLogoBgTransparent(settings.logo_bg_transparent === true);
          setHeaderTextColor(settings.header_text_color || '');
          setBodyTextColor(settings.body_text_color || '');
          setCardBgColor(settings.card_bg_color || '');

          // Storefront settings
          setStorefrontEnabled(data.storefront_enabled === true);
          setStorefrontSlug(data.slug || '');
          const sf = data.storefront_settings || {};
          setStorefrontHeroText(sf.hero_text || '');
          setStorefrontDescription(sf.description || '');
          setStorefrontMaxStops(sf.max_stops || 5);
          setStorefrontShowPrice(sf.show_price_estimate !== false);
          setStorefrontAccentColor(sf.accent_color || '');
          setStorefrontTaglineBadges(Array.isArray(sf.tagline_badges) ? sf.tagline_badges.join(', ') : 'Fast Delivery, Real-time Tracking, Insured');
          setStorefrontOperatingHours(sf.operating_hours_text || '');
          setStorefrontBookingNote(sf.booking_note || '');
          setStorefrontBannerImageUrl(sf.banner_image_url || '');
          setStorefrontPaymentMethods(Array.isArray(sf.payment_methods) ? sf.payment_methods : ['cash', 'maya']);

          // Fetch fleet vehicles & pricing
          const [vtRes, bvpRes] = await Promise.all([
            supabase.from('vehicle_types').select('id, name, base_price, price_per_km, additional_stop_charge, max_weight_kg, is_active').eq('is_active', true).order('name'),
            supabase.from('business_vehicle_pricing').select('*').eq('business_id', businessId),
          ]);

          const vts: VehicleTypeRow[] = vtRes.data || [];
          const bvps = bvpRes.data || [];
          setAllVehicleTypes(vts);

          // Build fleet vehicles list: merge business pricing with vehicle types
          const bvpMap = new Map(bvps.map((b: any) => [b.vehicle_type_id, b]));
          const fleet: FleetVehicle[] = vts.map((vt) => {
            const existing = bvpMap.get(vt.id);
            if (existing) {
              return {
                id: existing.id,
                vehicle_type_id: vt.id,
                vehicle_name: vt.name,
                is_enabled: existing.is_enabled ?? true,
                display_name: existing.display_name || '',
                image_url: existing.image_url || '',
                base_price: Number(existing.base_price) || 0,
                price_per_km: Number(existing.price_per_km) || 0,
                additional_stop_charge: Number(existing.additional_stop_charge) || 0,
                max_weight_kg: existing.max_weight_kg ?? vt.max_weight_kg,
                description: existing.description || '',
                sort_order: existing.sort_order ?? 0,
              };
            }
            return {
              vehicle_type_id: vt.id,
              vehicle_name: vt.name,
              is_enabled: false,
              display_name: '',
              image_url: '',
              base_price: Number(vt.base_price) || 0,
              price_per_km: Number(vt.price_per_km) || 0,
              additional_stop_charge: Number(vt.additional_stop_charge) || 0,
              max_weight_kg: vt.max_weight_kg,
              description: '',
              sort_order: 999,
            };
          });
          // Sort: enabled first by sort_order, then disabled
          fleet.sort((a, b) => {
            if (a.is_enabled && !b.is_enabled) return -1;
            if (!a.is_enabled && b.is_enabled) return 1;
            return a.sort_order - b.sort_order;
          });
          setFleetVehicles(fleet);
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
      if (!response.ok) throw new Error(data.message || data.error || 'Failed to send test SMS');
      const preview = data.messageSent ? `\nMessage: "${data.messageSent}"` : '';
      toast({ title: 'Test SMS sent! ✅', description: `SMS dispatched to ${testPhone} (${data.templateUsed || 'default'} template)${preview}` });
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

  // Fleet vehicle image upload
  const handleFleetImageUpload = async (vehicleTypeId: string, file: File) => {
    if (!businessId) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Invalid file', description: 'Please upload an image file', variant: 'destructive' });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Image must be under 2MB', variant: 'destructive' });
      return;
    }
    try {
      setFleetImageUploading(vehicleTypeId);
      const ext = file.name.split('.').pop() || 'png';
      const path = `${businessId}/fleet/${vehicleTypeId}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('business-logos')
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('business-logos').getPublicUrl(path);
      const publicUrl = urlData.publicUrl + '?t=' + Date.now();
      setFleetVehicles(prev => prev.map(fv =>
        fv.vehicle_type_id === vehicleTypeId ? { ...fv, image_url: publicUrl } : fv
      ));
      toast({ title: 'Image uploaded ✓' });
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setFleetImageUploading(null);
    }
  };

  // Update fleet vehicle field
  const updateFleetVehicle = (vehicleTypeId: string, field: keyof FleetVehicle, value: any) => {
    setFleetVehicles(prev => prev.map(fv =>
      fv.vehicle_type_id === vehicleTypeId ? { ...fv, [field]: value } : fv
    ));
  };

  // Save fleet vehicles
  const handleFleetSave = async () => {
    if (!businessId) return;
    try {
      setFleetSaving(true);
      const enabledVehicles = fleetVehicles.filter(fv => fv.is_enabled);
      
      // Upsert all enabled vehicles
      for (let i = 0; i < enabledVehicles.length; i++) {
        const fv = enabledVehicles[i];
        const payload = {
          business_id: businessId,
          vehicle_type_id: fv.vehicle_type_id,
          is_enabled: true,
          display_name: fv.display_name || null,
          image_url: fv.image_url || null,
          base_price: fv.base_price,
          price_per_km: fv.price_per_km,
          additional_stop_charge: fv.additional_stop_charge,
          max_weight_kg: fv.max_weight_kg,
          description: fv.description || null,
          sort_order: i,
          updated_at: new Date().toISOString(),
        };

        if (fv.id) {
          const { error } = await supabase
            .from('business_vehicle_pricing')
            .update(payload)
            .eq('id', fv.id);
          if (error) throw error;
        } else {
          const { data, error } = await supabase
            .from('business_vehicle_pricing')
            .insert(payload)
            .select('id')
            .single();
          if (error) throw error;
          if (data) {
            setFleetVehicles(prev => prev.map(v =>
              v.vehicle_type_id === fv.vehicle_type_id ? { ...v, id: data.id, sort_order: i } : v
            ));
          }
        }
      }

      // Disable any previously enabled vehicles that are now disabled
      const disabledVehicles = fleetVehicles.filter(fv => !fv.is_enabled && fv.id);
      for (const fv of disabledVehicles) {
        await supabase
          .from('business_vehicle_pricing')
          .update({ is_enabled: false, updated_at: new Date().toISOString() })
          .eq('id', fv.id);
      }

      toast({ title: 'Fleet saved! ✓', description: `${enabledVehicles.length} vehicle(s) configured for your storefront` });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to save fleet vehicles', variant: 'destructive' });
    } finally {
      setFleetSaving(false);
    }
  };

  // Slug availability check
  const checkSlugAvailability = async (slug: string) => {
    if (!slug || slug.length < 3) {
      setSlugAvailable(null);
      return;
    }
    setCheckingSlug(true);
    try {
      const { data, error } = await supabase
        .from('business_accounts')
        .select('id')
        .eq('slug', slug)
        .neq('id', businessId || '')
        .maybeSingle();

      setSlugAvailable(!data);
    } catch {
      setSlugAvailable(null);
    }
    setCheckingSlug(false);
  };

  const handleStorefrontSave = async () => {
    if (!businessId) return;
    
    // Validate slug
    const cleanSlug = storefrontSlug.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/--+/g, '-');
    if (storefrontEnabled && cleanSlug.length < 3) {
      toast({ title: 'Invalid slug', description: 'URL slug must be at least 3 characters', variant: 'destructive' });
      return;
    }

    try {
      setStorefrontSaving(true);
      const { error } = await supabase
        .from('business_accounts')
        .update({
          slug: cleanSlug || null,
          storefront_enabled: storefrontEnabled,
          storefront_settings: {
            hero_text: storefrontHeroText || null,
            description: storefrontDescription || null,
            max_stops: storefrontMaxStops,
            show_price_estimate: storefrontShowPrice,
            accent_color: storefrontAccentColor || null,
            tagline_badges: storefrontTaglineBadges.split(',').map((s: string) => s.trim()).filter(Boolean),
            operating_hours_text: storefrontOperatingHours || null,
            booking_note: storefrontBookingNote || null,
            banner_image_url: storefrontBannerImageUrl || null,
            payment_methods: storefrontPaymentMethods,
          },
        })
        .eq('id', businessId);

      if (error) throw error;
      setStorefrontSlug(cleanSlug);
      toast({ title: 'Storefront saved! ✓', description: storefrontEnabled ? `Your storefront is live at ${cleanSlug}.swiftdashdms.com` : 'Storefront settings saved (disabled)' });
    } catch (err: any) {
      const msg = err.message?.includes('duplicate') || err.message?.includes('unique')
        ? 'This URL slug is already taken. Please choose another.'
        : err.message || 'Failed to save storefront settings';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setStorefrontSaving(false);
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
        favicon_url: faviconUrl || null,
        logo_bg_transparent: logoBgTransparent,
        header_text_color: headerTextColor || null,
        body_text_color: bodyTextColor || null,
        card_bg_color: cardBgColor || null,
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

            {/* Transparent Logo Background */}
            {logoUrl && (
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Transparent Logo Background</Label>
                  <p className="text-xs text-muted-foreground">Remove the white background behind your logo (use with transparent PNGs)</p>
                </div>
                <Switch checked={logoBgTransparent} onCheckedChange={setLogoBgTransparent} />
              </div>
            )}

            <Separator />

            {/* Favicon Upload */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Favicon (Browser Tab Icon)
              </Label>
              <div className="flex items-center gap-4">
                {faviconUrl ? (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg border bg-muted flex items-center justify-center overflow-hidden">
                      <img src={faviconUrl} alt="favicon" className="w-6 h-6 object-contain" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">Favicon uploaded</p>
                      <p className="text-xs text-muted-foreground">Shown in browser tabs for your tracking links</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFaviconUrl('')}
                      className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div
                    className="flex-1 flex items-center gap-3 p-3 rounded-lg border-2 border-dashed hover:border-primary/50 cursor-pointer transition-colors"
                    onClick={() => faviconFileInputRef.current?.click()}
                  >
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                      {faviconUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4 text-muted-foreground" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium">Upload favicon</p>
                      <p className="text-xs text-muted-foreground">PNG, ICO or SVG · Max 1MB · Recommended 32×32 or 64×64px</p>
                    </div>
                  </div>
                )}
                <input
                  ref={faviconFileInputRef}
                  type="file"
                  accept=".png,.ico,.svg,.jpg"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFaviconUpload(f);
                    e.target.value = '';
                  }}
                />
              </div>
            </div>

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

              <Label className="flex items-center gap-2 pt-2">
                <Type className="h-4 w-4" />
                Text &amp; Card Colors
              </Label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Header Text <span className="text-muted-foreground font-normal">(optional)</span></p>
                  <div className="flex gap-2 items-center">
                    <Input
                      type="color"
                      value={headerTextColor || '#ffffff'}
                      onChange={(e) => setHeaderTextColor(e.target.value)}
                      className="w-14 h-10 cursor-pointer p-1"
                    />
                    <Input
                      value={headerTextColor}
                      onChange={(e) => setHeaderTextColor(e.target.value)}
                      placeholder="Auto-detect"
                      className="flex-1 font-mono text-sm"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Leave blank to auto-detect from header background</p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Body Text <span className="text-muted-foreground font-normal">(optional)</span></p>
                  <div className="flex gap-2 items-center">
                    <Input
                      type="color"
                      value={bodyTextColor || '#1f2937'}
                      onChange={(e) => setBodyTextColor(e.target.value)}
                      className="w-14 h-10 cursor-pointer p-1"
                    />
                    <Input
                      value={bodyTextColor}
                      onChange={(e) => setBodyTextColor(e.target.value)}
                      placeholder="Default dark"
                      className="flex-1 font-mono text-sm"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Main text color for headings and body content</p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Card Background <span className="text-muted-foreground font-normal">(optional)</span></p>
                  <div className="flex gap-2 items-center">
                    <Input
                      type="color"
                      value={cardBgColor || '#ffffff'}
                      onChange={(e) => setCardBgColor(e.target.value)}
                      className="w-14 h-10 cursor-pointer p-1"
                    />
                    <Input
                      value={cardBgColor}
                      onChange={(e) => setCardBgColor(e.target.value)}
                      placeholder="White"
                      className="flex-1 font-mono text-sm"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Background color of content cards on the tracking page</p>
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
                const textColor = headerTextColor || (isDark ? 'white' : '#1f2937');
                const subColor = headerTextColor
                  ? `${headerTextColor}b3`
                  : isDark ? 'rgba(255,255,255,0.7)' : 'rgba(31,41,55,0.6)';
                return (
                  <div className="rounded-xl overflow-hidden border shadow-sm">
                    <div
                      className="px-4 py-3 flex items-center justify-between"
                      style={{ backgroundColor: previewBg }}
                    >
                      <div className="flex items-center gap-3">
                        {logoUrl ? (
                          <div className={`flex-shrink-0 ${logoBgTransparent ? '' : 'bg-white rounded-lg p-1 shadow-sm'}`}>
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
                <MapIcon className="h-4 w-4" />
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
                placeholder="{business_name}: Hi {name}! Your delivery has been booked. Track it here: {tracking_url}"
                disabled={!smsOnBooking}
              />
              <p className="text-xs text-muted-foreground">
                Available placeholders: <code className="bg-muted px-1 rounded">{'{name}'}</code>, <code className="bg-muted px-1 rounded">{'{tracking_url}'}</code>, <code className="bg-muted px-1 rounded">{'{business_name}'}</code>. Leave blank to use the default message. Emojis are automatically removed to prevent SMS truncation.
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

        {/* Storefront Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-blue-500" />
              Customer Storefront
            </CardTitle>
            <CardDescription>
              Let your customers book deliveries directly from your fully branded booking page
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">

            {/* Enable + URL */}
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border">
              <div>
                <p className="font-medium text-sm">Enable Storefront</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Make your booking page publicly accessible
                </p>
              </div>
              <Switch checked={storefrontEnabled} onCheckedChange={setStorefrontEnabled} />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Storefront URL</Label>
              <div className="flex items-center gap-0">
                <span className="inline-flex items-center px-3 h-9 rounded-l-md border border-r-0 bg-muted text-sm text-muted-foreground">
                  https://
                </span>
                <Input
                  value={storefrontSlug}
                  onChange={(e) => {
                    const v = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
                    setStorefrontSlug(v);
                    setSlugAvailable(null);
                  }}
                  onBlur={() => checkSlugAvailability(storefrontSlug)}
                  placeholder="your-business"
                  className="rounded-none border-r-0 flex-1"
                />
                <span className="inline-flex items-center px-3 h-9 rounded-r-md border bg-muted text-sm text-muted-foreground whitespace-nowrap">
                  .swiftdashdms.com
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                {checkingSlug && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                {slugAvailable === true && (
                  <span className="text-green-600 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />Available!</span>
                )}
                {slugAvailable === false && <span className="text-red-500">This slug is already taken</span>}
                {!checkingSlug && slugAvailable === null && storefrontSlug.length > 0 && storefrontSlug.length < 3 && (
                  <span className="text-muted-foreground">Minimum 3 characters</span>
                )}
              </div>
            </div>

            <Separator />

            {/* ── Content & Branding ── */}
            <div>
              <p className="text-sm font-semibold mb-4 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-md bg-purple-100 text-purple-600 flex items-center justify-center text-xs">✦</span>
                Content & Branding
              </p>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Hero Title</Label>
                  <Input value={storefrontHeroText} onChange={(e) => setStorefrontHeroText(e.target.value)} placeholder="Book a Delivery" />
                  <p className="text-xs text-muted-foreground">The headline shown in the hero section</p>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Description</Label>
                  <Textarea value={storefrontDescription} onChange={(e) => setStorefrontDescription(e.target.value)} placeholder="Fast, reliable delivery powered by SwiftDash." rows={2} />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Trust Badges</Label>
                  <Input
                    value={storefrontTaglineBadges}
                    onChange={(e) => setStorefrontTaglineBadges(e.target.value)}
                    placeholder="Fast Delivery, Real-time Tracking, Insured"
                  />
                  <p className="text-xs text-muted-foreground">Comma-separated. Shown as pills in the hero. Up to 5 recommended.</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Accent Color</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="color"
                        value={storefrontAccentColor || '#3b82f6'}
                        onChange={(e) => setStorefrontAccentColor(e.target.value)}
                        className="h-9 w-14 p-1 cursor-pointer"
                      />
                      <Input
                        value={storefrontAccentColor}
                        onChange={(e) => setStorefrontAccentColor(e.target.value)}
                        placeholder="#3b82f6"
                        className="flex-1 font-mono text-sm"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Hero gradient secondary color (defaults to brand color)</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Operating Hours</Label>
                    <Input value={storefrontOperatingHours} onChange={(e) => setStorefrontOperatingHours(e.target.value)} placeholder="Mon–Sat 8AM–6PM" />
                    <p className="text-xs text-muted-foreground">Displayed in the header (optional)</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Booking Note</Label>
                  <Textarea value={storefrontBookingNote} onChange={(e) => setStorefrontBookingNote(e.target.value)} placeholder="e.g., Please ensure someone is present to receive the package." rows={2} />
                  <p className="text-xs text-muted-foreground">Shown as an amber notice on the Review step before submission</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* ── Booking Options ── */}
            <div>
              <p className="text-sm font-semibold mb-4 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-md bg-blue-100 text-blue-600 flex items-center justify-center text-xs">⚙</span>
                Booking Options
              </p>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Max Stops per Order</Label>
                    <Input type="number" min={1} max={20} value={storefrontMaxStops} onChange={(e) => setStorefrontMaxStops(parseInt(e.target.value) || 5)} />
                  </div>
                  <div className="flex items-center justify-between pt-6">
                    <Label className="text-sm">Show Price Estimate</Label>
                    <Switch checked={storefrontShowPrice} onCheckedChange={setStorefrontShowPrice} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Accepted Payment Methods</Label>
                  <div className="flex gap-3 flex-wrap">
                    {[
                      { value: 'cash', label: '💵 Cash' },
                      { value: 'maya', label: '📱 Maya' },
                      { value: 'card', label: '💳 Card' },
                      { value: 'gcash', label: '🟦 GCash' },
                    ].map(({ value, label }) => {
                      const isChecked = storefrontPaymentMethods.includes(value);
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => {
                            setStorefrontPaymentMethods(
                              isChecked
                                ? storefrontPaymentMethods.filter(m => m !== value)
                                : [...storefrontPaymentMethods, value]
                            );
                          }}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border-2 font-medium transition-all ${isChecked ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-border text-muted-foreground hover:border-gray-400'}`}
                        >
                          {isChecked && <CheckCircle2 className="h-3.5 w-3.5" />}
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">Payment methods shown to customers on the booking form</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Save storefront */}
            <div className="flex items-center justify-between">
              {storefrontEnabled && storefrontSlug.length >= 3 && (
                <a
                  href={`https://${storefrontSlug}.swiftdashdms.com`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open Storefront
                </a>
              )}
              <div className="flex-1" />
              <Button onClick={handleStorefrontSave} disabled={storefrontSaving} size="sm">
                {storefrontSaving ? (
                  <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Saving...</>
                ) : (
                  <><CheckCircle2 className="h-4 w-4 mr-1.5" />Save Storefront</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Fleet Vehicles & Pricing */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-orange-500" />
              Fleet Vehicles & Pricing
            </CardTitle>
            <CardDescription>
              Configure which vehicles appear on your storefront and set custom pricing for each
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {fleetVehicles.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Truck className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No vehicle types available</p>
              </div>
            ) : (
              <div className="space-y-3">
                {fleetVehicles.map((fv) => (
                  <div
                    key={fv.vehicle_type_id}
                    className={`rounded-lg border-2 transition-all ${
                      fv.is_enabled
                        ? 'border-blue-200 bg-blue-50/30 dark:border-blue-900 dark:bg-blue-950/20'
                        : 'border-border bg-muted/20 opacity-60'
                    }`}
                  >
                    {/* Vehicle header row */}
                    <div className="flex items-center gap-3 p-4">
                      {/* Image / upload */}
                      <div className="relative w-14 h-14 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden flex-shrink-0 bg-white dark:bg-gray-800">
                        {fv.image_url ? (
                          <Image
                            src={fv.image_url}
                            alt={fv.display_name || fv.vehicle_name}
                            width={56}
                            height={56}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Truck className="h-6 w-6 text-gray-300" />
                        )}
                        <label className="absolute inset-0 cursor-pointer flex items-center justify-center bg-black/0 hover:bg-black/40 transition-all group">
                          <Upload className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFleetImageUpload(fv.vehicle_type_id, file);
                            }}
                          />
                        </label>
                        {fleetImageUploading === fv.vehicle_type_id && (
                          <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                            <Loader2 className="h-4 w-4 animate-spin" />
                          </div>
                        )}
                      </div>

                      {/* Name + enable toggle */}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{fv.vehicle_name}</p>
                        <p className="text-xs text-muted-foreground">
                          Default: ₱{Number(allVehicleTypes.find(vt => vt.id === fv.vehicle_type_id)?.base_price || 0).toFixed(0)} base
                          {' · '}₱{Number(allVehicleTypes.find(vt => vt.id === fv.vehicle_type_id)?.price_per_km || 0).toFixed(0)}/km
                          {fv.max_weight_kg ? ` · ${fv.max_weight_kg}kg` : ''}
                        </p>
                      </div>

                      <Switch
                        checked={fv.is_enabled}
                        onCheckedChange={(checked) => updateFleetVehicle(fv.vehicle_type_id, 'is_enabled', checked)}
                      />
                    </div>

                    {/* Expanded config when enabled */}
                    {fv.is_enabled && (
                      <div className="px-4 pb-4 space-y-3 border-t border-blue-100 dark:border-blue-900 pt-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Display Name</Label>
                            <Input
                              value={fv.display_name}
                              onChange={(e) => updateFleetVehicle(fv.vehicle_type_id, 'display_name', e.target.value)}
                              placeholder={fv.vehicle_name}
                              className="h-8 text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Description</Label>
                            <Input
                              value={fv.description}
                              onChange={(e) => updateFleetVehicle(fv.vehicle_type_id, 'description', e.target.value)}
                              placeholder="e.g. Best for small parcels"
                              className="h-8 text-sm"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs flex items-center gap-1">
                              <DollarSign className="h-3 w-3" /> Base Price (₱)
                            </Label>
                            <Input
                              type="number"
                              min={0}
                              step={1}
                              value={fv.base_price}
                              onChange={(e) => updateFleetVehicle(fv.vehicle_type_id, 'base_price', parseFloat(e.target.value) || 0)}
                              className="h-8 text-sm font-mono"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs flex items-center gap-1">
                              <DollarSign className="h-3 w-3" /> Per km (₱)
                            </Label>
                            <Input
                              type="number"
                              min={0}
                              step={0.5}
                              value={fv.price_per_km}
                              onChange={(e) => updateFleetVehicle(fv.vehicle_type_id, 'price_per_km', parseFloat(e.target.value) || 0)}
                              className="h-8 text-sm font-mono"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs flex items-center gap-1">
                              <DollarSign className="h-3 w-3" /> Extra Stop (₱)
                            </Label>
                            <Input
                              type="number"
                              min={0}
                              step={1}
                              value={fv.additional_stop_charge}
                              onChange={(e) => updateFleetVehicle(fv.vehicle_type_id, 'additional_stop_charge', parseFloat(e.target.value) || 0)}
                              className="h-8 text-sm font-mono"
                            />
                          </div>
                        </div>
                        {fv.image_url && (
                          <button
                            type="button"
                            onClick={() => updateFleetVehicle(fv.vehicle_type_id, 'image_url', '')}
                            className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                          >
                            <Trash2 className="h-3 w-3" /> Remove image
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <Separator />

            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {fleetVehicles.filter(fv => fv.is_enabled).length} of {fleetVehicles.length} vehicles enabled
              </p>
              <Button onClick={handleFleetSave} disabled={fleetSaving} size="sm">
                {fleetSaving ? (
                  <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Saving...</>
                ) : (
                  <><CheckCircle2 className="h-4 w-4 mr-1.5" />Save Fleet</>
                )}
              </Button>
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
