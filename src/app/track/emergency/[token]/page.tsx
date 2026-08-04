'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Phone, RefreshCw } from 'lucide-react';
import { TrackMap, UnitPosition } from './track-map';
import { useLivePosition } from './use-live-position';

/**
 * What a citizen sees after reporting an emergency.
 *
 * Written for someone frightened, on a phone, possibly at night, possibly
 * holding it in one hand. So: one very large sentence saying what is happening,
 * then the few facts that back it up, then a way to reach a human. Nothing to
 * explore, nothing to configure, no jargon.
 *
 * Everything here comes from a public endpoint keyed on the tracking token, so
 * the page works for whoever holds the link and never needs an account.
 */

const POLL_ACTIVE_MS = 10_000;

type Status =
  | 'submitted' | 'dispatched' | 'en_route' | 'on_scene'
  | 'resolved' | 'cancelled' | 'rejected';

interface Report {
  referenceNumber: string;
  channel: string;
  status: Status;
  isActive: boolean;
  incidentType: 'fire' | 'medical' | 'crime';
  agency: string | null;
  address: string | null;
  landmark: string | null;
  location: { lat: number; lng: number };
  units: Array<{ callsign: string | null; agency: string | null; status: string; etaMinutes: number | null }>;
  etaMinutes: number | null;
  positions: UnitPosition[];
  commandCenter: { name: string; phone: string | null };
  timestamps: Record<string, string | null>;
  updatedAt: string;
}

const HUE: Record<Report['incidentType'], string> = {
  fire: '#F26430',
  medical: '#E5484D',
  crime: '#7C6BF0',
};

const TYPE_WORD: Record<Report['incidentType'], string> = {
  fire: 'Fire',
  medical: 'Medical emergency',
  crime: 'Police',
};

const AGENCY_WORD: Record<string, string> = {
  BFP: 'Fire service',
  PNP: 'Police',
  CDRRMO_AMBULANCE: 'Ambulance',
  CHO: 'Health office',
};

/**
 * The headline. This is the sentence the whole page exists to deliver, so it is
 * written in plain words and never in system vocabulary — nobody waiting for an
 * ambulance wants to read the word "dispatched".
 */
function headline(report: Report): { title: string; detail: string } {
  const units = report.units;
  const names = units.map((u) => u.callsign).filter(Boolean).join(', ');

  switch (report.status) {
    case 'submitted':
      return {
        title: 'Your report has been received',
        detail: 'A dispatcher is reviewing it now and will send the nearest available unit.',
      };
    case 'dispatched':
      return {
        title: 'Help is being sent',
        detail: names
          ? `${names} has been assigned and is preparing to leave.`
          : 'A unit has been assigned and is preparing to leave.',
      };
    case 'en_route':
      return {
        title: 'Help is on the way',
        detail: names ? `${names} is travelling to you now.` : 'A unit is travelling to you now.',
      };
    case 'on_scene':
      return {
        title: 'Help has arrived',
        detail: names ? `${names} is at the location.` : 'A unit is at the location.',
      };
    case 'resolved':
      return {
        title: 'This emergency has been closed',
        detail: 'Responders have finished at the scene. If anything changes, report it again.',
      };
    case 'cancelled':
      return {
        title: 'This report was cancelled',
        detail: 'No unit is being sent. If you still need help, please report it again or call directly.',
      };
    case 'rejected':
      // Someone may have genuinely believed there was an emergency. The wording
      // states the outcome without passing judgement on the person.
      return {
        title: 'No response was sent for this report',
        detail: 'A dispatcher reviewed it and did not send a unit. If you need help now, please call directly.',
      };
  }
}

export default function EmergencyTrackPage() {
  const params = useParams();
  const token = params?.token as string;

  const [report, setReport] = useState<Report | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/track/emergency/${token}`, { cache: 'no-store' });
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (!res.ok) {
        setError(true);
        return;
      }
      setReport(await res.json());
      setError(false);
    } catch {
      // A dropped request is not worth showing someone in this state — the next
      // poll will almost certainly succeed.
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    // Stop polling once nothing more can change; a closed incident is closed.
    if (!report?.isActive) return;
    const timer = setInterval(load, POLL_ACTIVE_MS);
    return () => clearInterval(timer);
  }, [report?.isActive, load]);

  // Live position, but only once a unit is actually assigned and moving. Before
  // that there is nothing to stream, and opening a channel would be noise.
  const live = useLivePosition(
    report?.channel ?? null,
    token,
    Boolean(report?.isActive && report.units.length > 0)
  );

  if (loading) {
    return (
      <Shell>
        <p className="text-[15px] text-slate-400">Loading your report…</p>
      </Shell>
    );
  }

  if (notFound) {
    return (
      <Shell>
        <h1 className="text-2xl font-semibold text-white">This link is not valid</h1>
        <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-slate-400">
          The report may have been removed, or the link may have been copied incompletely.
          If you need help now, call your local emergency hotline.
        </p>
      </Shell>
    );
  }

  if (!report) {
    return (
      <Shell>
        <h1 className="text-2xl font-semibold text-white">Could not load your report</h1>
        <button
          type="button"
          onClick={load}
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-white/10 px-4 py-2 text-[15px] text-white"
        >
          <RefreshCw className="h-4 w-4" />
          Try again
        </button>
      </Shell>
    );
  }

  const hue = HUE[report.incidentType];
  const { title, detail } = headline(report);

  // A live fix supersedes the polled one — it is the same unit, more recently.
  // If nothing is streaming, the database position stands, which is what keeps
  // this working before the responder app publishes on the incident channel.
  const shownPositions: UnitPosition[] = live
    ? [{ callsign: live.callsign ?? report.units[0]?.callsign ?? null, lat: live.lat, lng: live.lng }]
    : report.positions;

  return (
    <div className="min-h-dvh bg-[#0B1017] text-white">
      <header className="border-b border-white/10 px-5 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          {report.commandCenter.name}
        </p>
      </header>

      <main className="mx-auto max-w-lg px-5 pb-10">
        {/* ── The one thing this page is for ─────────────────────────────── */}
        <section className="pt-7">
          <div className="flex items-center gap-2">
            <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: hue }} />
            <span className="text-[12px] font-semibold uppercase tracking-[0.12em]" style={{ color: hue }}>
              {TYPE_WORD[report.incidentType]}
            </span>
          </div>

          <h1 className="mt-2.5 text-[30px] font-semibold leading-[1.15] tracking-tight text-white">
            {title}
          </h1>
          <p className="mt-2.5 text-[15px] leading-relaxed text-slate-300">{detail}</p>

          {report.isActive && report.etaMinutes != null && (
            <p className="mt-4 text-[15px] text-white">
              Estimated arrival in{' '}
              <span className="text-[22px] font-semibold tabular-nums">{report.etaMinutes}</span>{' '}
              minutes
            </p>
          )}
        </section>

        {/* ── The map, only once there is something to show on it ────────── */}
        {report.isActive && (
          <section className="mt-6 h-56 overflow-hidden rounded-lg border border-white/10">
            <TrackMap incident={report.location} units={shownPositions} hue={hue} />
          </section>
        )}

        {report.isActive && report.units.length > 0 && shownPositions.length === 0 && (
          <p className="mt-2.5 text-[13px] leading-relaxed text-slate-400">
            The live position of the responding unit is not available right now. They are still on
            their way.
          </p>
        )}

        {/* ── The facts behind it ────────────────────────────────────────── */}
        <section className="mt-7 divide-y divide-white/10 border-y border-white/10">
          <Row label="Reference">
            <span className="font-mono">{report.referenceNumber}</span>
          </Row>

          {report.address && <Row label="Location">{report.address}</Row>}
          {report.landmark && <Row label="Landmark">{report.landmark}</Row>}

          {report.units.length > 0 && (
            <Row label={report.units.length > 1 ? 'Units responding' : 'Unit responding'}>
              {report.units.map((u) => (
                <div key={u.callsign ?? Math.random()}>
                  <span className="font-mono">{u.callsign ?? 'Unit'}</span>
                  {u.agency && AGENCY_WORD[u.agency] ? ` · ${AGENCY_WORD[u.agency]}` : ''}
                </div>
              ))}
            </Row>
          )}

          <Row label="Reported">
            {new Date(report.timestamps.reported!).toLocaleString('en-PH', {
              day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
            })}
          </Row>
        </section>

        {/* ── A way to reach a person ────────────────────────────────────── */}
        {report.commandCenter.phone && (
          <a
            href={`tel:${report.commandCenter.phone}`}
            className="mt-7 flex items-center justify-center gap-2.5 rounded-lg bg-white px-5 py-3.5 text-[16px] font-semibold text-[#0B1017]"
          >
            <Phone className="h-4.5 w-4.5" />
            Call {report.commandCenter.name}
          </a>
        )}

        <p className="mt-5 text-center text-[12px] leading-relaxed text-slate-500">
          {report.isActive
            ? 'This page updates on its own. Keep it open.'
            : 'This report is closed and will not update again.'}
          {error && ' Reconnecting…'}
        </p>

        <p className="mt-7 text-center text-[11px] text-slate-600">Powered by SwiftDash</p>
      </main>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[#0B1017] px-6 text-center">
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 py-3">
      <span className="w-28 shrink-0 text-[13px] text-slate-500">{label}</span>
      <div className="text-[14px] leading-relaxed text-slate-200">{children}</div>
    </div>
  );
}
