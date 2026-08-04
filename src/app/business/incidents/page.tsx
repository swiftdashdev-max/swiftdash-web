'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useUserContext } from '@/lib/supabase/user-context';
import {
  Incident,
  IncidentType,
  IncidentStatus,
  TYPE_COLOR,
  TYPE_LABEL,
  STATUS_LABEL,
  LIVE_ASSIGNMENT,
} from '../console/types';

/**
 * The incident record.
 *
 * The console shows what is happening now; this is what happened. It exists to
 * answer after-the-fact questions — how long did that call take, who went, why
 * was it rejected — so it favours completeness and search over live updates.
 */
const PAGE_SIZE = 50;

const TYPE_FILTERS: Array<{ value: IncidentType | 'all'; label: string }> = [
  { value: 'all', label: 'All types' },
  { value: 'fire', label: 'Fire' },
  { value: 'medical', label: 'Medical' },
  { value: 'crime', label: 'Crime' },
];

const STATUS_FILTERS: Array<{ value: IncidentStatus | 'all' | 'open'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'rejected', label: 'Rejected' },
];

export default function IncidentsPage() {
  const { businessId, accountType, loading: userLoading } = useUserContext();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [rows, setRows] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [query, setQuery] = useState('');
  const [type, setType] = useState<IncidentType | 'all'>('all');
  const [status, setStatus] = useState<IncidentStatus | 'all' | 'open'>('all');

  useEffect(() => {
    if (!userLoading && accountType && accountType !== 'emergency') {
      router.replace('/business/dashboard');
    }
  }, [accountType, userLoading, router]);

  useEffect(() => {
    if (!businessId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);

      let q = supabase
        .from('emergency_incidents')
        .select(`
          id, reference_number, incident_type, severity, status, address, landmark,
          created_at, dispatched_at, on_scene_at, resolved_at, closure_reason,
          incident_assignments ( id, unit_callsign, status )
        `)
        .eq('command_center_id', businessId)
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

      if (type !== 'all') q = q.eq('incident_type', type);
      if (status === 'open') q = q.in('status', ['submitted', 'dispatched', 'en_route', 'on_scene']);
      else if (status !== 'all') q = q.eq('status', status);
      if (query.trim()) q = q.ilike('reference_number', `%${query.trim()}%`);

      const { data } = await q;
      if (cancelled) return;

      // One row past the page size tells us whether there is a next page,
      // without a second count query.
      const list = (data ?? []) as unknown as Incident[];
      setHasMore(list.length > PAGE_SIZE);
      setRows(list.slice(0, PAGE_SIZE));
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [businessId, supabase, page, type, status, query]);

  // Any filter change starts the listing again from the top.
  useEffect(() => setPage(0), [type, status, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold">Incidents</h1>
        <Link
          href="/business/console"
          className="text-[12px] text-[#1CB8F7] hover:underline"
        >
          Back to console
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Reference number"
            className="w-56 rounded-sm border border-border bg-background py-1.5 pl-8 pr-2 font-mono text-[12px] focus:border-[#1CB8F7] focus:outline-none"
          />
        </div>

        <FilterGroup
          options={TYPE_FILTERS}
          value={type}
          onChange={(v) => setType(v as IncidentType | 'all')}
        />
        <FilterGroup
          options={STATUS_FILTERS}
          value={status}
          onChange={(v) => setStatus(v as IncidentStatus | 'all' | 'open')}
        />
      </div>

      <div className="overflow-x-auto rounded-sm border border-border">
        <table className="w-full min-w-[720px] border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left">
              <Th>Reference</Th>
              <Th>Type</Th>
              <Th>Location</Th>
              <Th>Units</Th>
              <Th>Status</Th>
              <Th className="text-right">Reported</Th>
              <Th className="text-right">Response</Th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            )}

            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                  No incidents match those filters.
                </td>
              </tr>
            )}

            {!loading &&
              rows.map((i) => {
                const units = i.incident_assignments ?? [];
                const liveUnits = units.filter((a) => LIVE_ASSIGNMENT.includes(a.status));
                // Time from report to the first unit arriving is the number
                // anyone reviewing the service actually asks for.
                const response =
                  i.on_scene_at != null
                    ? Math.round(
                        (new Date(i.on_scene_at).getTime() - new Date(i.created_at).getTime()) /
                          60_000
                      )
                    : null;

                return (
                  <tr key={i.id} className="border-b border-border last:border-0 hover:bg-accent/40">
                    <td className="px-3 py-2 font-mono text-[12px]">{i.reference_number}</td>
                    <td className="px-3 py-2">
                      <span
                        className="text-[10px] font-bold uppercase tracking-[0.1em]"
                        style={{ color: TYPE_COLOR[i.incident_type] }}
                      >
                        {TYPE_LABEL[i.incident_type]}
                      </span>
                    </td>
                    <td className="max-w-[280px] truncate px-3 py-2">
                      {i.address || i.landmark || '—'}
                    </td>
                    <td className="px-3 py-2 font-mono text-[12px] text-muted-foreground">
                      {units.length === 0
                        ? '—'
                        : (liveUnits.length > 0 ? liveUnits : units)
                            .map((a) => a.unit_callsign ?? 'UNIT')
                            .join(', ')}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {STATUS_LABEL[i.status]}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {new Date(i.created_at).toLocaleString('en-PH', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-[12px] tabular-nums text-muted-foreground">
                      {response != null ? `${response}m` : '—'}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page === 0}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          className="rounded-sm border border-border px-2.5 py-1 text-[12px] disabled:opacity-40"
        >
          Previous
        </button>
        <span className="font-mono text-[12px] tabular-nums text-muted-foreground">
          Page {page + 1}
        </span>
        <button
          type="button"
          disabled={!hasMore}
          onClick={() => setPage((p) => p + 1)}
          className="rounded-sm border border-border px-2.5 py-1 text-[12px] disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={`px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground ${className}`}
    >
      {children}
    </th>
  );
}

function FilterGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex overflow-hidden rounded-sm border border-border">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`border-r border-border px-2.5 py-1.5 text-[12px] last:border-r-0 transition-colors ${
            value === o.value ? 'bg-accent font-medium' : 'hover:bg-accent/50'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
