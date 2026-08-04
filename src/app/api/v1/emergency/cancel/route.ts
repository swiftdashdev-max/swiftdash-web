/**
 * POST /api/v1/emergency/cancel — a citizen calls off their own report.
 *
 * "False alarm." "We put it out ourselves." "They already drove him to the
 * hospital." Until this existed, the only way to stop a response was for a
 * dispatcher to notice, so units kept travelling to emergencies that had ended.
 *
 * Two rules shape it:
 *
 *   Only the reporting device may cancel. A tracking token is meant to be
 *   forwarded — to family, into group chats — so holding the link cannot be
 *   enough to call off someone else's ambulance. The app proves it is the
 *   original reporter by sending the same deviceId it filed with.
 *
 *   Cancelling stops once a unit is on scene. At that point the responder is
 *   standing in front of them; it is a conversation, not a button, and the
 *   dispatcher closes it out afterwards.
 */

import { NextRequest, NextResponse } from 'next/server';
import { hashApiKey } from '@/lib/api-auth';
import { getServiceClient } from '@/lib/supabase-service';

export const preferredRegion = ['sin1'];

/** Refusals the database can return, and what each means over HTTP. */
const FAILURES: Record<string, { status: number; error: string }> = {
  INVALID_API_KEY: {
    status: 401,
    error: 'Unauthorized',
  },
  NOT_FOUND: {
    status: 404,
    error: 'No report found for that tracking token.',
  },
  NOT_REPORTER: {
    status: 403,
    error:
      'Only the device that filed this report can cancel it. If this is your report, cancel it from the phone you reported on.',
  },
  ALREADY_CLOSED: {
    status: 409,
    error: 'This report is already closed.',
  },
  UNIT_ON_SCENE: {
    status: 409,
    error:
      'A responder has already arrived. Please speak to them directly — they will close this out.',
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

  let body: { trackingToken?: string; deviceId?: string; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body', code: 'INVALID_BODY' },
      { status: 400 }
    );
  }

  const trackingToken = body.trackingToken?.trim();
  const deviceId = body.deviceId?.trim();

  if (!trackingToken || !deviceId) {
    return NextResponse.json(
      {
        error: 'trackingToken and deviceId are both required.',
        code: 'VALIDATION_ERROR',
      },
      { status: 400 }
    );
  }

  const supabase = getServiceClient();

  const { data, error } = await supabase.rpc('cancel_emergency_report', {
    p_key_hash:       hashApiKey(apiKey),
    p_tracking_token: trackingToken,
    p_device_id:      deviceId,
    p_reason:         body.reason ?? null,
  });

  if (error) {
    console.error('emergency/cancel: rpc failed', error);
    return NextResponse.json(
      {
        error: 'Could not cancel the report. If no help is needed, please call and say so.',
        code: 'CANCEL_FAILED',
      },
      { status: 500 }
    );
  }

  const result = data as {
    ok: boolean;
    code?: string;
    status?: string;
    data?: { referenceNumber: string; status: string; unitsStoodDown: number };
  };

  if (!result?.ok) {
    const failure = result?.code ? FAILURES[result.code] : undefined;
    if (failure) {
      return NextResponse.json(
        { error: failure.error, code: result.code, status: result.status },
        { status: failure.status }
      );
    }
    console.error('emergency/cancel: unexpected refusal', result);
    return NextResponse.json(
      { error: 'Could not cancel the report.', code: 'CANCEL_FAILED' },
      { status: 500 }
    );
  }

  // The console picks this up over Supabase Realtime, so a dispatcher sees the
  // call disappear from the board without anything having to notify them.
  return NextResponse.json(
    {
      referenceNumber: result.data!.referenceNumber,
      status:          result.data!.status,
      unitsStoodDown:  result.data!.unitsStoodDown,
    },
    { status: 200, headers: { 'x-response-time': `${Date.now() - start}ms` } }
  );
}
