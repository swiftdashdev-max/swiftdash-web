'use client';

import { useState, useEffect } from 'react';
import { useUserContext } from '@/lib/supabase/user-context';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { 
  Settings as SettingsIcon, 
  Palette, 
  Upload, 
  Image as ImageIcon,
  Link as LinkIcon,
  Loader2,
  CheckCircle2,
  Building2,
} from 'lucide-react';

export default function SettingsPage() {
  const { user, businessId, isLoading: userLoading } = useUserContext();
  const { toast } = useToast();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Business Info
  const [businessName, setBusinessName] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');
  
  // Branding Settings
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#3b82f6');
  const [showDriverInfo, setShowDriverInfo] = useState(true);
  const [showSupportContact, setShowSupportContact] = useState(true);

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
          setShowDriverInfo(settings.tracking_page?.show_driver_info ?? true);
          setShowSupportContact(settings.tracking_page?.show_support_contact ?? true);
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

  const handleSave = async () => {
    if (!businessId) return;

    try {
      setSaving(true);

      const settings = {
        logo_url: logoUrl,
        primary_color: primaryColor,
        tracking_page: {
          show_driver_info: showDriverInfo,
          show_support_contact: showSupportContact,
        },
      };

      const { error } = await supabase
        .from('business_accounts')
        .update({
          business_name: businessName,
          business_phone: businessPhone,
          settings: settings,
        })
        .eq('id', businessId);

      if (error) throw error;

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
    return `${window.location.origin}/track/SD-PREVIEW-DEMO`;
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
              Customize how your tracking pages look to customers
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Logo URL */}
            <div className="space-y-2">
              <Label htmlFor="logo-url">Logo URL</Label>
              <div className="flex gap-2">
                <Input
                  id="logo-url"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://yourdomain.com/logo.png"
                  className="flex-1"
                />
                {logoUrl && (
                  <Button variant="outline" size="icon" asChild>
                    <a href={logoUrl} target="_blank" rel="noopener noreferrer">
                      <ImageIcon className="h-4 w-4" />
                    </a>
                  </Button>
                )}
              </div>
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <Upload className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <div>
                  <p>Upload your logo to a public URL (Supabase Storage, CDN, etc.)</p>
                  <p className="mt-1">Recommended: 200x50px, PNG with transparent background</p>
                </div>
              </div>
              
              {/* Logo Preview */}
              {logoUrl && (
                <div className="mt-3 p-4 border rounded-lg bg-muted/50">
                  <p className="text-sm font-medium mb-2">Preview:</p>
                  <img 
                    src={logoUrl} 
                    alt="Logo preview" 
                    className="h-12 max-w-full object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      toast({
                        title: 'Invalid Logo URL',
                        description: 'Could not load image from this URL',
                        variant: 'destructive',
                      });
                    }}
                  />
                </div>
              )}
            </div>

            <Separator />

            {/* Primary Color */}
            <div className="space-y-2">
              <Label htmlFor="primary-color">Primary Brand Color</Label>
              <div className="flex gap-3 items-center">
                <Input
                  id="primary-color"
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-20 h-10 cursor-pointer"
                />
                <Input
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  placeholder="#3b82f6"
                  className="flex-1 font-mono"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                This color is used for buttons, timeline, and active elements on tracking pages
              </p>
              
              {/* Color Preview */}
              <div className="mt-3 p-4 border rounded-lg bg-muted/50">
                <p className="text-sm font-medium mb-3">Preview:</p>
                <div className="flex gap-2">
                  <Button style={{ backgroundColor: primaryColor }}>
                    Sample Button
                  </Button>
                  <div 
                    className="h-10 w-10 rounded-full border-2" 
                    style={{ borderColor: primaryColor, backgroundColor: primaryColor }}
                  >
                    <CheckCircle2 className="h-full w-full text-white p-2" />
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Tracking Page Options */}
            <div className="space-y-3">
              <Label>Tracking Page Options</Label>
              
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium text-sm">Show Driver Information</p>
                  <p className="text-xs text-muted-foreground">
                    Display driver name, phone, and vehicle on tracking page
                  </p>
                </div>
                <Button
                  variant={showDriverInfo ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowDriverInfo(!showDriverInfo)}
                >
                  {showDriverInfo ? 'Enabled' : 'Disabled'}
                </Button>
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium text-sm">Show Support Contact</p>
                  <p className="text-xs text-muted-foreground">
                    Display "Need Help?" section with call support button
                  </p>
                </div>
                <Button
                  variant={showSupportContact ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowSupportContact(!showSupportContact)}
                >
                  {showSupportContact ? 'Enabled' : 'Disabled'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Preview Link */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LinkIcon className="h-5 w-5" />
              Tracking Page Preview
            </CardTitle>
            <CardDescription>
              See how your tracking page will look to customers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Input 
                value={generateTrackingPreviewUrl()} 
                readOnly 
                className="flex-1 font-mono text-sm"
              />
              <Button variant="outline" asChild>
                <a href={generateTrackingPreviewUrl()} target="_blank" rel="noopener noreferrer">
                  Open Preview
                </a>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Note: Preview uses a demo tracking number. Create a real delivery to test with actual data.
            </p>
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
  );
}
