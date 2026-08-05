'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { MapPin, Phone, RefreshCw } from 'lucide-react';
import { TrackMap, UnitPosition } from './track-map';
import { useLivePosition } from './use-live-position';
import { contrastRatio, hexOr, onColour, readable } from '@/lib/contrast';

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
 *
 * The command center's branding is applied on top — its logo, its name, its
 * colours, its wording for each stage. But applied as *preference*, never
 * blindly: these colours were chosen against a light delivery page, and one of
 * them (a near-black body text) would be invisible here. Anything that cannot
 * be read on the ground it lands on is dropped in favour of something that can.
 * A frightened person misreading this page is a worse outcome than a city not
 * getting its exact brand red.
 */

const POLL_ACTIVE_MS = 10_000;

const DEFAULT_GROUND = '#0B1017';

type Status =
  | 'submitted' | 'dispatched' | 'en_route' | 'on_scene'
  | 'resolved' | 'cancelled' | 'rejected';

interface Branding {
  logoUrl: string | null;
  logoSize: string | null;
  logoOnPlate: boolean;
  faviconUrl: string | null;
  tagline: string | null;
  headline: string | null;
  headerBg: string | null;
  headerText: string | null;
  bodyText: string | null;
  accent: string | null;
  pageBg: string | null;
  cardBg: string | null;
  hidePoweredBy: boolean;
  mapStyle: string | null;
  showSupport: boolean;
  showUnitDetail: boolean;
  statusLabels: Partial<Record<Status, string>>;
}

interface Report {
  referenceNumber: string;
  /** Null on a branding preview, where there is nothing real to stream. */
  channel: string | null;
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
  branding: Branding;
  timestamps: Record<string, string | null>;
  updatedAt: string;
  /** Set only by the settings-page preview. Nothing here is a real incident. */
  isPreview?: boolean;
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

/** How big the command center asked its logo to be, in header terms. */
const LOGO_SIZE: Record<string, string> = {
  sm: 'h-6 max-w-[80px]',
  md: 'h-8 max-w-[110px]',
  lg: 'h-10 max-w-[140px]',
  xl: 'h-12 max-w-[170px]',
};

/**
 * The headline. This is the sentence the whole page exists to deliver, so it is
 * written in plain words and never in system vocabulary — nobody waiting for an
 * ambulance wants to read the word "dispatched".
 *
 * A command center may override the title per status. The supporting detail is
 * always generated, because it names the units actually responding.
 */
function headline(report: Report): { title: string; detail: string } {
  const units = report.units;
  const names = units.map((u) => u.callsign).filter(Boolean).join(', ');

  const base = ((): { title: string; detail: string } => {
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
  })();

  const custom = report.branding?.statusLabels?.[report.status];
  return custom ? { ...base, title: custom } : base;
}

/**
 * Turn a command center's colour preferences into a palette this page can
 * actually be read in.
 *
 * The ground decides everything else. If a city sets a light page background,
 * the text has to go dark with it — which is why nothing below is a hard-coded
 * Tailwind slate class.
 */
function useTheme(branding: Branding | undefined) {
  return useMemo(() => {
    const b = branding;
    const ground = hexOr(b?.pageBg, DEFAULT_GROUND);
    // "Dark" means white text reads better on it than black does.
    const dark = contrastRatio(ground, '#FFFFFF') >= contrastRatio(ground, '#000000');

    // Every tone below clears 4.5:1 on the ground it is used against — checked,
    // not eyeballed. Secondary text on this page still has to be readable at
    // night, outdoors, by someone whose hands are shaking.
    const strong = dark ? '#FFFFFF' : '#0B1017';
    const bodyDefault = dark ? '#CBD5E1' : '#334155';
    const mutedDefault = dark ? '#94A3B8' : '#475569';

    // The header is its own band and may be branded independently — that is how
    // RCERT's red-on-white identity survives on a dark page without the red
    // having to sit on near-black, where it fails contrast outright.
    const headerBg = hexOr(b?.headerBg, ground);
    const headerDark = contrastRatio(headerBg, '#FFFFFF') >= contrastRatio(headerBg, '#000000');
    const headerStrong = headerDark ? '#FFFFFF' : '#0B1017';

    const accent = hexOr(b?.accent, '#FFFFFF');

    return {
      ground,
      dark,
      /** Headline and other display text. */
      strong,
      /** Running text. Honoured from settings when it can be read here. */
      body: readable(b?.bodyText, ground, bodyDefault),
      muted: mutedDefault,
      faint: dark ? '#7C8BA1' : '#64748B',
      line: dark ? 'rgba(255,255,255,0.10)' : 'rgba(15,23,42,0.12)',
      // Cards now carry real weight on this page, so they need to actually read
      // as surfaces rather than as a hint of one.
      card: hexOr(b?.cardBg, dark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.035)'),
      headerBg,
      // Large-text threshold: this is a short, bold, spaced-out brand line, and
      // holding it to the small-text rule would reject nearly every brand colour.
      headerText: readable(b?.headerText, headerBg, headerStrong, true),
      headerMuted: headerDark ? '#94A3B8' : '#475569',
      accent,
      onAccent: onColour(accent),
    };
  }, [branding]);
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
      // The branding preview needs to say which command center it is previewing.
      // Read straight off the URL rather than through useSearchParams, which
      // would drag a Suspense boundary into a page that has no other use for one.
      const bizId =
        token === 'preview'
          ? new URLSearchParams(window.location.search).get('bizId')
          : null;

      const res = await fetch(
        `/api/track/emergency/${token}${bizId ? `?bizId=${encodeURIComponent(bizId)}` : ''}`,
        { cache: 'no-store' }
      );
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

  // The tab this page opens in belongs to the city, not to SwiftDash.
  const centreName = report?.commandCenter.name;
  useEffect(() => {
    if (!centreName) return;
    const previous = document.title;
    document.title = `Emergency report | ${centreName}`;
    return () => { document.title = previous; };
  }, [centreName]);

  const faviconUrl = report?.branding?.faviconUrl;
  useEffect(() => {
    if (!faviconUrl) return;
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    const original = link?.getAttribute('href') ?? null;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    const created = original === null;
    link.href = faviconUrl;
    return () => {
      if (!link) return;
      if (created) link.remove();
      else link.setAttribute('href', original!);
    };
  }, [faviconUrl]);

  // Live position, but only once a unit is actually assigned and moving. Before
  // that there is nothing to stream, and opening a channel would be noise.
  const live = useLivePosition(
    report?.channel ?? null,
    token,
    Boolean(report?.isActive && report.units.length > 0)
  );

  const theme = useTheme(report?.branding);

  if (loading) {
    return (
      <Shell theme={theme}>
        <p className="text-[15px]" style={{ color: theme.muted }}>Loading your report…</p>
      </Shell>
    );
  }

  if (notFound) {
    return (
      <Shell theme={theme}>
        <h1 className="text-2xl font-semibold" style={{ color: theme.strong }}>
          This link is not valid
        </h1>
        <p className="mt-3 max-w-sm text-[15px] leading-relaxed" style={{ color: theme.muted }}>
          The report may have been removed, or the link may have been copied incompletely.
          If you need help now, call your local emergency hotline.
        </p>
      </Shell>
    );
  }

  if (!report) {
    return (
      <Shell theme={theme}>
        <h1 className="text-2xl font-semibold" style={{ color: theme.strong }}>
          Could not load your report
        </h1>
        <button
          type="button"
          onClick={load}
          className="mt-4 inline-flex items-center gap-2 rounded-md px-4 py-2 text-[15px] font-medium"
          style={{ backgroundColor: theme.accent, color: theme.onAccent }}
        >
          <RefreshCw className="h-4 w-4" />
          Try again
        </button>
      </Shell>
    );
  }

  // Defaulted rather than assumed. If a cached response from an older deploy
  // ever arrives without branding, this page still renders — an unstyled page
  // is recoverable, a blank one is not.
  const b = report.branding ?? ({ statusLabels: {} } as Branding);
  const hue = HUE[report.incidentType];
  const { title, detail } = headline(report);

  // A live fix supersedes the polled one — it is the same unit, more recently.
  // If nothing is streaming, the database position stands, which is what keeps
  // this working before the responder app publishes on the incident channel.
  const shownPositions: UnitPosition[] = live
    ? [{ callsign: live.callsign ?? report.units[0]?.callsign ?? null, lat: live.lat, lng: live.lng }]
    : report.positions;

  return (
    <div className="min-h-dvh" style={{ backgroundColor: theme.ground, color: theme.body }}>
      {/* ── The command center's own band ────────────────────────────────── */}
      {/* A 2px rule in the incident's own colour closes the branded band. It
          keeps the light-header/dark-body seam deliberate rather than abrupt,
          and it is the first thing on screen that says which kind of emergency
          this is — visible before a word has been read. */}
      <header className="px-5 py-3" style={{ backgroundColor: theme.headerBg, borderBottom: `2px solid ${hue}` }}>
        <div className="mx-auto flex max-w-lg items-center gap-3">
          {b.logoUrl && (
            <div className={b.logoOnPlate ? 'shrink-0 rounded-md bg-white p-1' : 'shrink-0'}>
              {/* A remote logo on an arbitrary storage host — plain img, so it
                  needs no per-tenant Next image domain configuration. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={b.logoUrl}
                alt=""
                className={`${LOGO_SIZE[b.logoSize ?? 'md'] ?? LOGO_SIZE.md} w-auto object-contain`}
              />
            </div>
          )}

          <div className="min-w-0">
            <p
              className="truncate text-[13px] font-semibold uppercase tracking-[0.12em]"
              style={{ color: theme.headerText }}
            >
              {report.commandCenter.name}
            </p>
            {b.tagline && (
              <p className="truncate text-[11px] tracking-wide" style={{ color: theme.headerMuted }}>
                {b.tagline}
              </p>
            )}
          </div>

          {b.headline && (
            <p
              className="ml-auto hidden shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] sm:block"
              style={{ color: theme.headerMuted }}
            >
              {b.headline}
            </p>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-lg px-5 pb-10">
        {report.isPreview && (
          // Said plainly and at the top. Somebody landing here from a settings
          // link must not spend a second wondering whether this is real.
          <p
            className="mt-4 rounded-md px-3 py-2 text-center text-[12px] font-medium"
            style={{ backgroundColor: theme.card, color: theme.muted }}
          >
            Preview — sample incident, shown so you can check your branding.
          </p>
        )}

        {/* ── The one thing this page is for ─────────────────────────────── */}
        <section className="pt-7">
          <div className="flex items-center gap-2">
            <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: hue }} />
            <span className="text-[12px] font-semibold uppercase tracking-[0.12em]" style={{ color: hue }}>
              {TYPE_WORD[report.incidentType]}
            </span>

            {report.isActive && (
              // Proof the page is still moving. Without it, a screen that has
              // not changed for two minutes is indistinguishable from a screen
              // that has died — and that distinction matters enormously here.
              <span
                className="ml-auto flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
                style={{ color: theme.muted }}
              >
                <span className="relative flex h-1.5 w-1.5">
                  <span
                    aria-hidden
                    className="etrack-ping absolute inline-flex h-full w-full rounded-full"
                    style={{ backgroundColor: '#3FB950' }}
                  />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ backgroundColor: '#3FB950' }} />
                </span>
                Live
              </span>
            )}
          </div>

          <h1
            className="mt-3 text-[32px] font-semibold leading-[1.1] tracking-[-0.02em]"
            style={{ color: theme.strong, textWrap: 'balance' }}
          >
            {title}
          </h1>
          <p className="mt-2.5 text-[15px] leading-relaxed" style={{ color: theme.body }}>
            {detail}
          </p>
        </section>

        {/* ── The number someone is actually waiting on ──────────────────── */}
        {report.isActive && (
          <section
            className="mt-6 flex items-end justify-between gap-4 rounded-xl px-4 py-4"
            style={{ backgroundColor: theme.card, border: `1px solid ${theme.line}` }}
          >
            <div>
              <p
                className="text-[10px] font-semibold uppercase tracking-[0.14em]"
                style={{ color: theme.muted }}
              >
                {report.etaMinutes != null ? 'Estimated arrival' : 'Since you reported'}
              </p>
              <p className="mt-1.5 flex items-baseline gap-1.5">
                <span
                  className="text-[44px] font-semibold leading-none tabular-nums tracking-[-0.03em]"
                  style={{ color: report.etaMinutes != null ? hue : theme.strong }}
                >
                  {report.etaMinutes ?? minutesSince(report.timestamps.reported)}
                </span>
                <span className="text-[15px] font-medium" style={{ color: theme.muted }}>
                  min
                </span>
              </p>
            </div>

            {/* The time it happened, for anyone relaying this to somebody else. */}
            <p className="pb-1 text-right text-[12px] leading-relaxed" style={{ color: theme.muted }}>
              Reported
              <br />
              <span className="tabular-nums" style={{ color: theme.body }}>
                {new Date(report.timestamps.reported!).toLocaleTimeString('en-PH', {
                  hour: 'numeric', minute: '2-digit',
                })}
              </span>
            </p>
          </section>
        )}

        {/* ── Where this has got to ──────────────────────────────────────── */}
        {STAGED.includes(report.status) && (
          <StageRail report={report} hue={hue} theme={theme} />
        )}

        {/* ── The map, only once there is something to show on it ────────── */}
        {report.isActive && (
          <section
            className="relative mt-7 -mx-5 overflow-hidden"
            style={{ height: 'clamp(210px, 34vh, 320px)' }}
          >
            <TrackMap
              incident={report.location}
              units={shownPositions}
              hue={hue}
              mapStyle={b.mapStyle}
            />
            {/* Fades the map into the page rather than boxing it. A hard edge
                reads as an embedded widget; this reads as one screen. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-16"
              style={{ background: `linear-gradient(to bottom, transparent, ${theme.ground})` }}
            />
          </section>
        )}

        {report.isActive && report.units.length > 0 && shownPositions.length === 0 && (
          <p className="mt-1 text-[13px] leading-relaxed" style={{ color: theme.muted }}>
            The live position of the responding unit is not available right now. They are still on
            their way.
          </p>
        )}

        {/* ── The facts behind it ────────────────────────────────────────── */}
        {/* Address first and unabbreviated: the first thing anyone checks is
            whether the responders were sent to the right place. */}
        <section className="mt-6 space-y-2.5">
          {report.address && (
            <div
              className="flex gap-3 rounded-xl px-4 py-3.5"
              style={{ backgroundColor: theme.card, border: `1px solid ${theme.line}` }}
            >
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" style={{ color: theme.muted }} />
              <div className="min-w-0">
                <p className="text-[15px] leading-snug" style={{ color: theme.strong }}>
                  {report.address}
                </p>
                {report.landmark && (
                  <p className="mt-1 text-[13px] leading-snug" style={{ color: theme.muted }}>
                    {report.landmark}
                  </p>
                )}
              </div>
            </div>
          )}

          {b.showUnitDetail && report.units.length > 0 && (
            <div
              className="rounded-xl px-4 py-3.5"
              style={{ backgroundColor: theme.card, border: `1px solid ${theme.line}` }}
            >
              <p
                className="text-[10px] font-semibold uppercase tracking-[0.14em]"
                style={{ color: theme.muted }}
              >
                {report.units.length > 1 ? 'Units responding' : 'Unit responding'}
              </p>
              <div className="mt-2 space-y-1.5">
                {report.units.map((u, i) => (
                  <div key={`${u.callsign ?? 'unit'}-${i}`} className="flex items-baseline gap-2.5">
                    <span
                      className="font-mono text-[15px] font-semibold"
                      style={{ color: theme.strong }}
                    >
                      {u.callsign ?? 'Unit'}
                    </span>
                    {u.agency && AGENCY_WORD[u.agency] && (
                      <span className="text-[13px]" style={{ color: theme.muted }}>
                        {AGENCY_WORD[u.agency]}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ── A way to reach a person ────────────────────────────────────── */}
        {b.showSupport && report.commandCenter.phone && (
          <a
            href={`tel:${report.commandCenter.phone}`}
            className="mt-6 flex items-center justify-center gap-2.5 rounded-xl px-5 py-4 text-[16px] font-semibold"
            style={{ backgroundColor: theme.accent, color: theme.onAccent }}
          >
            <Phone className="h-4 w-4" />
            Call {report.commandCenter.name}
          </a>
        )}

        {/* The reference number, given the one job it actually has. Sitting in a
            table it was trivia; here it is the thing you read down the phone. */}
        <p className="mt-3 text-center text-[12px] leading-relaxed" style={{ color: theme.muted }}>
          {b.showSupport && report.commandCenter.phone ? 'Quote this reference: ' : 'Reference '}
          <span className="font-mono tracking-tight" style={{ color: theme.body }}>
            {report.referenceNumber}
          </span>
        </p>

        {/* Only says something when there is something to say. While the report
            is live and healthy the pill at the top already carries that, and a
            second line repeating it was just noise under the button. */}
        {(!report.isActive || error) && (
          <p className="mt-4 text-center text-[12px] leading-relaxed" style={{ color: theme.muted }}>
            {report.isActive
              ? 'Reconnecting…'
              : 'This report is closed and will not update again.'}
          </p>
        )}

        {!b.hidePoweredBy && (
          <p className="mt-7 text-center text-[11px]" style={{ color: theme.faint }}>
            Powered by SwiftDash
          </p>
        )}
      </main>
    </div>
  );
}

type Theme = ReturnType<typeof useTheme>;

/**
 * The shape of a response, as four steps.
 *
 * Deliberately short structural words, not the command center's custom
 * headlines — those are full sentences written to be read aloud, and they
 * belong to the one big statement at the top. This rail answers a different
 * question: not "what is happening" but "how far through this are we".
 */
const STAGES: Array<{ label: string; at: keyof Report['timestamps'] }> = [
  { label: 'Reported',   at: 'reported' },
  { label: 'Dispatched', at: 'dispatched' },
  { label: 'On the way', at: 'accepted' },
  { label: 'Arrived',    at: 'onScene' },
];

/** How far along each status sits. `resolved` has been through all of them. */
const STAGE_INDEX: Partial<Record<Status, number>> = {
  submitted: 0, dispatched: 1, en_route: 2, on_scene: 3, resolved: 4,
};

/**
 * Statuses the rail describes. A cancelled or rejected report never travelled
 * this path, so drawing it a progress bar would be a small lie.
 */
const STAGED: Status[] = ['submitted', 'dispatched', 'en_route', 'on_scene', 'resolved'];

function minutesSince(iso: string | null | undefined): number {
  if (!iso) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
}

function clockTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
}

/**
 * Four dots and the line between them.
 *
 * State is carried by form as well as colour — filled versus hollow, ringed
 * versus still — so the rail survives being read in sunlight, on a bad screen,
 * or by someone who cannot separate the incident hue from grey.
 */
function StageRail({ report, hue, theme }: { report: Report; hue: string; theme: Theme }) {
  const current = STAGE_INDEX[report.status] ?? 0;

  return (
    <section className="mt-7 flex" aria-label="Response progress">
      {STAGES.map((stage, i) => {
        const done = i < current;
        const active = i === current;
        const reached = done || active;
        const at = clockTime(report.timestamps[stage.at]);

        return (
          <div key={stage.label} className="relative flex flex-1 flex-col items-center">
            {/* The connecting line, drawn in halves so the ends stay open. */}
            {i > 0 && (
              <span
                aria-hidden
                className="absolute left-0 top-[5px] h-[2px] w-1/2"
                style={{ backgroundColor: reached ? hue : theme.line }}
              />
            )}
            {i < STAGES.length - 1 && (
              <span
                aria-hidden
                className="absolute right-0 top-[5px] h-[2px] w-1/2"
                style={{ backgroundColor: done ? hue : theme.line }}
              />
            )}

            <span className="relative flex h-3 w-3 items-center justify-center">
              {active && report.isActive && (
                <span
                  aria-hidden
                  className="etrack-ping absolute h-3 w-3 rounded-full"
                  style={{ backgroundColor: hue }}
                />
              )}
              <span
                className="relative h-3 w-3 rounded-full"
                style={
                  reached
                    ? { backgroundColor: hue }
                    : { backgroundColor: theme.ground, border: `2px solid ${theme.line}` }
                }
              />
            </span>

            <span
              className="mt-2 px-1 text-center text-[10px] font-semibold uppercase leading-tight tracking-[0.08em]"
              style={{ color: reached ? theme.body : theme.muted }}
            >
              {stage.label}
            </span>
            <span className="mt-0.5 text-[10px] tabular-nums" style={{ color: theme.faint }}>
              {at ?? ''}
            </span>
          </div>
        );
      })}
    </section>
  );
}

function Shell({ children, theme }: { children: React.ReactNode; theme: Theme }) {
  return (
    <div
      className="flex min-h-dvh flex-col items-center justify-center px-6 text-center"
      style={{ backgroundColor: theme.ground }}
    >
      {children}
    </div>
  );
}

