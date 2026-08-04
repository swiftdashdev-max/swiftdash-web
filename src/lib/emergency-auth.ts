/**
 * Session authentication for command-center console actions.
 *
 * Console routes are used by a signed-in dispatcher, not by the citizen app, so
 * they authenticate from the Supabase session cookie rather than an API key.
 * Every one of them needs the same three facts, so they are resolved once here.
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getServiceClient } from '@/lib/supabase-service';

export interface Dispatcher {
  userId: string;
  commandCenterId: string;
}

export type DispatcherResult =
  | { ok: true; dispatcher: Dispatcher }
  | { ok: false; status: 401 | 403; error: string };

export async function authenticateDispatcher(): Promise<DispatcherResult> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }

  // Read the profile with the service client: the dispatcher's own RLS view of
  // user_profiles is not guaranteed to expose business_id, and this check must
  // not silently pass because a row was invisible.
  const service = getServiceClient();
  const { data: profile } = await service
    .from('user_profiles')
    .select('business_id, status')
    .eq('id', user.id)
    .single();

  if (!profile?.business_id || profile.status !== 'active') {
    return { ok: false, status: 403, error: 'Your account is not active for dispatch.' };
  }

  return { ok: true, dispatcher: { userId: user.id, commandCenterId: profile.business_id } };
}
