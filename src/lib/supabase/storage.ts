import { createClient } from './client'
import { createDriverClient } from './driver-client'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Create authenticated client that uses user session
const getSupabaseClient = () => createClient()

// Create non-persistent client for driver verification (temporary sessions)
const getDriverSupabaseClient = () => createDriverClient()

// Create admin client for file uploads (using service role key)
const getStorageAdminClient = () => {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
  
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for storage operations');
  }
  
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey
  );
}

// Create admin client for admin operations
const getSupabaseAdmin = () => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for admin operations')
  }
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}

// Storage bucket mappings for driver verification documents
export const STORAGE_BUCKETS = {
  DRIVER_LICENSE: 'license_pictures',
  VEHICLE_OR_CR: 'OR_CR_pictures', 
  VEHICLE_PHOTOS: 'vehicle_photos',
  LTFRB_DOCUMENTS: 'LTFRB_pictures',
  DRIVER_PROFILE: 'driver_profile_pictures',
  BUSINESS_LOGOS: 'business-logos',
} as const;

// Create storage buckets if they don't exist
export const ensureStorageBuckets = async () => {
  try {
    const supabase = getSupabaseAdmin();
    
    // List of buckets to create
    const buckets = [
      { id: 'license_pictures', name: 'license_pictures', public: true },
      { id: 'OR_CR_pictures', name: 'OR_CR_pictures', public: true },
      { id: 'vehicle_photos', name: 'vehicle_photos', public: true },
      { id: 'LTFRB_pictures', name: 'LTFRB_pictures', public: true },
      { id: 'driver_profile_pictures', name: 'driver_profile_pictures', public: true }
    ];

    for (const bucket of buckets) {
      const { data, error } = await supabase.storage.createBucket(bucket.id, {
        public: bucket.public,
        fileSizeLimit: 10 * 1024 * 1024, // 10MB
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf']
      });

      if (error && !error.message.includes('already exists')) {
        console.error(`Error creating bucket ${bucket.id}:`, error);
      } else {
        console.log(`Bucket ${bucket.id} is ready`);
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Error ensuring storage buckets:', error);
    return { success: false, error };
  }
};

// Upload file to specific bucket (using driver client for authenticated uploads)
export const uploadDriverDocument = async (
  file: File,
  bucket: string,
  userId: string,
  documentType: string
) => {
  try {
    // Use driver client for authenticated uploads (no service role needed)
    const supabase = getDriverSupabaseClient()
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/${documentType}_${Date.now()}.${fileExt}`;
    
    console.log(`Uploading file to bucket: ${bucket}, fileName: ${fileName}`);
    
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error(`Upload error for bucket ${bucket}:`, error);
      throw error;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(fileName);

    return {
      success: true,
      data: {
        path: data.path,
        fullPath: data.fullPath,
        publicUrl: urlData.publicUrl
      }
    };
  } catch (error) {
    console.error('Upload error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed'
    };
  }
};

// Upload business logo (uses regular authenticated client, no service role needed)
export const uploadBusinessLogo = async (file: File, businessId: string) => {
  try {
    const supabase = getSupabaseClient();
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'png';
    const fileName = `${businessId}/logo_${Date.now()}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from('business-logos')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type,
      });

    if (error) throw error;

    const { data: urlData } = supabase.storage
      .from('business-logos')
      .getPublicUrl(fileName);

    return { success: true, publicUrl: urlData.publicUrl };
  } catch (error) {
    console.error('Logo upload error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed',
    };
  }
};

// Delete file from bucket
export const deleteDriverDocument = async (bucket: string, filePath: string) => {
  try {
    const supabase = getStorageAdminClient()
    const { error } = await supabase.storage
      .from(bucket)
      .remove([filePath]);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Delete error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Delete failed'
    };
  }
};

// Get signed URL for private files (if needed)
export const getSignedUrl = async (bucket: string, filePath: string, expiresIn = 3600) => {
  try {
    const supabase = getStorageAdminClient()
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(filePath, expiresIn);

    if (error) throw error;
    return { success: true, signedUrl: data.signedUrl };
  } catch (error) {
    console.error('Signed URL error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get signed URL'
    };
  }
};