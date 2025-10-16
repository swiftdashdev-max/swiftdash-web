// Simple test to verify Supabase connection
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export const testSupabaseConnection = async () => {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('count')
      .limit(1);

    if (error) {
      console.error('Supabase connection test failed:', error);
      return { success: false, error: error.message };
    }

    console.log('Supabase connection test successful');
    return { success: true };
  } catch (error) {
    console.error('Supabase connection test error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Connection failed' 
    };
  }
};