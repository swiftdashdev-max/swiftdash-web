'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

export function GoogleMapsDebugger() {
  const [status, setStatus] = useState<{
    googleLoaded: boolean;
    mapsLoaded: boolean;
    placesLoaded: boolean;
    errors: string[];
  }>({
    googleLoaded: false,
    mapsLoaded: false,
    placesLoaded: false,
    errors: [],
  });

  useEffect(() => {
    const checkInterval = setInterval(() => {
      const errors: string[] = [];
      
      // Check if google is loaded
      const googleLoaded = typeof window.google !== 'undefined';
      
      // Check if maps is loaded
      const mapsLoaded = googleLoaded && typeof window.google.maps !== 'undefined';
      
      // Check if places is loaded
      const placesLoaded = mapsLoaded && typeof window.google.maps.places !== 'undefined';

      // Capture console errors
      const originalError = console.error;
      console.error = (...args: any[]) => {
        const errorStr = args.join(' ');
        if (errorStr.includes('Google Maps') || errorStr.includes('API')) {
          errors.push(errorStr);
        }
        originalError.apply(console, args);
      };

      setStatus({
        googleLoaded,
        mapsLoaded,
        placesLoaded,
        errors,
      });
    }, 1000);

    return () => clearInterval(checkInterval);
  }, []);

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle>Google Maps API Status</CardTitle>
        <CardDescription>Diagnostic information</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm">Google Object</span>
          {status.googleLoaded ? (
            <Badge variant="default" className="gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Loaded
            </Badge>
          ) : (
            <Badge variant="destructive" className="gap-1">
              <XCircle className="h-3 w-3" />
              Not Loaded
            </Badge>
          )}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm">Maps API</span>
          {status.mapsLoaded ? (
            <Badge variant="default" className="gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Loaded
            </Badge>
          ) : (
            <Badge variant="destructive" className="gap-1">
              <XCircle className="h-3 w-3" />
              Not Loaded
            </Badge>
          )}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm">Places API</span>
          {status.placesLoaded ? (
            <Badge variant="default" className="gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Loaded
            </Badge>
          ) : (
            <Badge variant="destructive" className="gap-1">
              <XCircle className="h-3 w-3" />
              Not Loaded
            </Badge>
          )}
        </div>

        {status.errors.length > 0 && (
          <div className="mt-4 p-3 bg-destructive/10 rounded-md">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-destructive">Errors Detected</p>
                {status.errors.map((error, i) => (
                  <p key={i} className="text-xs text-muted-foreground">
                    {error}
                  </p>
                ))}
              </div>
            </div>
          </div>
        )}

        {!status.placesLoaded && (
          <div className="mt-4 p-3 bg-yellow-500/10 rounded-md text-xs">
            <p className="font-medium mb-1">Configuration Required:</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Go to Google Cloud Console</li>
              <li>Enable Maps JavaScript API</li>
              <li>Enable Places API</li>
              <li>Configure API key restrictions</li>
              <li>See: docs/GOOGLE_MAPS_API_KEY_FIX.md</li>
            </ol>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
