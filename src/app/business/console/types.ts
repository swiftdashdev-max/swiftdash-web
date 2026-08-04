/**
 * Shared vocabulary for the emergency console.
 *
 * Every union here mirrors a CHECK constraint in the database. If one of these
 * gains a value, the constraint is the source of truth — change it there first.
 */

export type IncidentStatus =
  | 'submitted'
  | 'dispatched'
  | 'en_route'
  | 'on_scene'
  | 'resolved'
  | 'cancelled'
  | 'rejected';

export type IncidentType = 'medical' | 'fire' | 'crime';

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export type AgencyCode = 'BFP' | 'PNP' | 'CDRRMO_AMBULANCE' | 'CHO';

export type AssignmentStatus =
  | 'dispatched'
  | 'en_route'
  | 'on_scene'
  | 'resolved'
  | 'declined'
  | 'stood_down';

export interface Assignment {
  id: string;
  responder_id: string;
  unit_callsign: string | null;
  agency_code: AgencyCode | null;
  status: AssignmentStatus;
  eta_minutes: number | null;
  dispatched_at: string;
  accepted_at: string | null;
  on_scene_at: string | null;
  closed_at: string | null;
  close_reason: string | null;
}

export interface Incident {
  id: string;
  reference_number: string;
  tracking_token: string;
  incident_type: IncidentType;
  severity: Severity | null;
  status: IncidentStatus;
  description: string | null;
  address: string | null;
  landmark: string | null;
  incident_lat: number;
  incident_lng: number;
  device_lat: number | null;
  device_lng: number | null;
  reporter_name: string | null;
  reporter_phone: string | null;
  is_anonymous: boolean;
  agency_code: AgencyCode | null;
  flagged_for_review: boolean;
  reports_from_device_24h: number | null;
  decline_count: number;
  created_at: string;
  dispatched_at: string | null;
  accepted_at: string | null;
  on_scene_at: string | null;
  resolved_at: string | null;
  closure_reason: string | null;
  incident_assignments: Assignment[];
}

/** A vehicle in the command center's fleet, with its responder's live state. */
export interface Unit {
  id: string;
  callsign: string;
  agency: AgencyCode | null;
  plate: string | null;
  responderId: string | null;
  isOnline: boolean;
  lat: number | null;
  lng: number | null;
  locationUpdatedAt: string | null;
  /** Straight-line km to the selected incident — null when either side lacks a fix. */
  distanceKm: number | null;
  /** Set when this unit already has a live assignment somewhere. */
  committedTo: { reference: string; incidentId: string } | null;
}

/**
 * Incidents needing a decision come first, then everything running, then what
 * has closed. Within a group the oldest is most urgent — nobody should wait
 * longer just because a newer call looked worse.
 */
export const WAITING: IncidentStatus[] = ['submitted'];
export const ACTIVE: IncidentStatus[] = ['dispatched', 'en_route', 'on_scene'];
export const CLOSED: IncidentStatus[] = ['resolved', 'cancelled', 'rejected'];

/** Assignment states that still occupy a unit. */
export const LIVE_ASSIGNMENT: AssignmentStatus[] = ['dispatched', 'en_route', 'on_scene'];

export const TYPE_LABEL: Record<IncidentType, string> = {
  fire: 'FIRE',
  medical: 'MEDICAL',
  crime: 'CRIME',
};

/**
 * One hue per incident type, deliberately outside the SwiftDash blues so the
 * brand in the chrome never reads as an incident signal.
 */
export const TYPE_COLOR: Record<IncidentType, string> = {
  fire: '#F26430',
  medical: '#E5484D',
  crime: '#7C6BF0',
};

export const AGENCY_LABEL: Record<AgencyCode, string> = {
  BFP: 'Fire',
  PNP: 'Police',
  CDRRMO_AMBULANCE: 'Ambulance',
  CHO: 'Health Office',
};

export const STATUS_LABEL: Record<IncidentStatus, string> = {
  submitted: 'Waiting',
  dispatched: 'Dispatched',
  en_route: 'En route',
  on_scene: 'On scene',
  resolved: 'Resolved',
  cancelled: 'Cancelled',
  rejected: 'Rejected',
};

export const ASSIGNMENT_LABEL: Record<AssignmentStatus, string> = {
  dispatched: 'Dispatched',
  en_route: 'En route',
  on_scene: 'On scene',
  resolved: 'Cleared',
  declined: 'Declined',
  stood_down: 'Stood down',
};

/** Great-circle distance in km. Good enough to rank units by proximity. */
export function haversineKm(
  aLat: number, aLng: number, bLat: number, bLng: number
): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Elapsed time as m:ss under an hour, then h:mm. Dispatchers read minutes. */
export function elapsed(fromIso: string, nowMs: number): string {
  const seconds = Math.max(0, Math.floor((nowMs - new Date(fromIso).getTime()) / 1000));
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}:${String(seconds % 60).padStart(2, '0')}`;
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`;
}
