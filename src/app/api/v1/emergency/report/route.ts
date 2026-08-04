/**
 * POST /api/v1/emergency/report — a citizen app files an emergency report.
 *
 * Called by the MY Roxas citizen app. The API key identifies which command
 * center receives the report; the citizen themselves is not authenticated.
 *
 * Guiding rule throughout: **a real emergency must never be rejected by a
 * machine.** Anything suspicious is flagged for a dispatcher to judge, not
 * blocked. The only hard rejections are "outside the service area entirely"
 * and "the request is malformed".
 *
 * Everything after validation happens in a single `file_emergency_report()`
 * call. It used to be six sequential trips to the database — authenticate,
 * check the account, check the geofence, count recent reports, insert,
 * annotate — which measured 3.1-6.6s end to end even though the SQL itself
 * totalled under a millisecond. The work was never the cost; the distance was.
 * Doing it in one call also makes it atomic: a report can no longer half-exist.
 */

import { NextRequest, NextResponse } from 'next/server';
import { hashApiKey } from '@/lib/api-auth';
import { getServiceClient } from '@/lib/supabase-service';
import {
  validateBody,
  EMERGENCY_REPORT_RULES,
  validationErrorResponse,
} from '@/lib/api-validation';

/** Run close to Roxas City rather than in Vercel's US East default. */
export const preferredRegion = ['sin1'];

/** Refusals the database can return, and what each means over HTTP. */
const FAILURES: Record<string, { status: number; error: string }> = {
  INVALID_API_KEY: {
    status: 401,
    error: 'Unauthorized',
  },
  NOT_AUTHORIZED: {
    status: 403,
    error: 'This API key is not authorized for emergency reporting.',
  },
  OUTSIDE_SERVICE_AREA: {
    status: 422,
    error:
      'This location is outside the area this command center covers. Please call your local emergency hotline directly.',
  },
};

export async function POST(req: NextRequest) {
  const start = Date.now();

  const apiKey = req.headers.get('x-api-key');
  if (!apiKey || !apiKey.startsWith('sd_')) {
    return NextResponse.json(
      { error: 'Unauthorized', code: 'INVALID_API_KEY' },
      { status: 401 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body', code: 'INVALID_BODY' },
      { status: 400 }
    );
  }

  // Validation stays here: it needs no database, and per-field errors are far
  // more useful to the app team than a single opaque failure.
  const validation = validateBody(body, EMERGENCY_REPORT_RULES);
  if (!validation.valid) {
    return NextResponse.json(validationErrorResponse(validation.errors), { status: 400 });
  }

  const supabase = getServiceClient();

  const { data, error } = await supabase.rpc('file_emergency_report', {
    p_key_hash: hashApiKey(apiKey),
    p_payload: {
      incidentType:  body.incidentType,
      incidentLat:   body.incidentLat,
      incidentLng:   body.incidentLng,
      deviceLat:     typeof body.deviceLat === 'number' ? body.deviceLat : null,
      deviceLng:     typeof body.deviceLng === 'number' ? body.deviceLng : null,
      deviceId:      body.deviceId,
      description:   body.description ?? null,
      address:       body.address ?? null,
      landmark:      body.landmark ?? null,
      reporterName:  body.reporterName ?? null,
      reporterPhone: body.reporterPhone ?? null,
      isAnonymous:   body.isAnonymous === true,
    },
  });

  if (error) {
    console.error('emergency/report: rpc failed', error);
    return NextResponse.json(
      {
        error: 'Could not file the report. Please call your emergency hotline directly.',
        code: 'REPORT_FAILED',
      },
      { status: 500 }
    );
  }

  const result = data as {
    ok: boolean;
    code?: string;
    data?: {
      id: string;
      referenceNumber: string;
      trackingToken: string;
      agency: string | null;
      flagged: boolean;
    };
  };

  if (!result?.ok) {
    const failure = result?.code ? FAILURES[result.code] : undefined;
    if (failure) {
      return NextResponse.json(
        { error: failure.error, code: result.code },
        { status: failure.status }
      );
    }
    console.error('emergency/report: unexpected refusal', result);
    return NextResponse.json(
      {
        error: 'Could not file the report. Please call your emergency hotline directly.',
        code: 'REPORT_FAILED',
      },
      { status: 500 }
    );
  }

  const incident = result.data!;
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://swiftdashdms.com';

  // No Ably publish here by design: the console subscribes to this table over
  // Supabase Realtime, so there is no step between saving the report and a
  // dispatcher seeing it that can fail silently.
  return NextResponse.json(
    {
      reportId:        incident.id,
      referenceNumber: incident.referenceNumber,
      status:          'submitted',
      agency:          incident.agency,
      trackingUrl:     `${origin}/track/emergency/${incident.trackingToken}`,
    },
    { status: 201, headers: { 'x-response-time': `${Date.now() - start}ms` } }
  );
}
