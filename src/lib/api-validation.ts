/**
 * Shared API request validation helpers.
 * Provides structured, per-field error responses for all /api/v1/* routes.
 *
 * Error response shape:
 * {
 *   error: "Validation failed",
 *   code: "VALIDATION_ERROR",
 *   details: [
 *     { field: "pickupLat", message: "Must be a number between -90 and 90", code: "INVALID_RANGE" },
 *     { field: "dropoffContactPhone", message: "Required", code: "REQUIRED" }
 *   ]
 * }
 */

export interface FieldError {
  field: string;
  message: string;
  code: 'REQUIRED' | 'INVALID_TYPE' | 'INVALID_RANGE' | 'INVALID_FORMAT' | 'INVALID_VALUE' | 'TOO_LONG' | 'TOO_SHORT';
}

export interface ValidationResult {
  valid: boolean;
  errors: FieldError[];
}

// ── Primitive validators ──────────────────────────────────────────────────────

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function isNumber(v: unknown): v is number {
  return typeof v === 'number' && !Number.isNaN(v);
}

function isLatitude(v: unknown): boolean {
  return isNumber(v) && v >= -90 && v <= 90;
}

function isLongitude(v: unknown): boolean {
  return isNumber(v) && v >= -180 && v <= 180;
}

function isUUID(v: unknown): boolean {
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

// ── Field rule definitions ────────────────────────────────────────────────────

interface FieldRule {
  field: string;
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'uuid';
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  latitude?: boolean;
  longitude?: boolean;
  oneOf?: string[];
  pattern?: RegExp;
  patternMessage?: string;
}

function validateField(body: Record<string, unknown>, rule: FieldRule): FieldError | null {
  const value = body[rule.field];

  // Required check
  if (rule.required) {
    if (value === undefined || value === null || value === '') {
      return { field: rule.field, message: 'Required', code: 'REQUIRED' };
    }
  }

  // Skip further checks if value is absent and not required
  if (value === undefined || value === null) return null;

  // UUID check
  if (rule.type === 'uuid') {
    if (!isUUID(value)) {
      return { field: rule.field, message: 'Must be a valid UUID', code: 'INVALID_FORMAT' };
    }
    return null;
  }

  // Type check
  if (rule.type === 'string') {
    if (typeof value !== 'string') {
      return { field: rule.field, message: 'Must be a string', code: 'INVALID_TYPE' };
    }
    if (rule.minLength !== undefined && value.length < rule.minLength) {
      return { field: rule.field, message: `Must be at least ${rule.minLength} characters`, code: 'TOO_SHORT' };
    }
    if (rule.maxLength !== undefined && value.length > rule.maxLength) {
      return { field: rule.field, message: `Must be at most ${rule.maxLength} characters`, code: 'TOO_LONG' };
    }
    if (rule.pattern && !rule.pattern.test(value)) {
      return { field: rule.field, message: rule.patternMessage || 'Invalid format', code: 'INVALID_FORMAT' };
    }
  }

  if (rule.type === 'number') {
    if (!isNumber(value)) {
      return { field: rule.field, message: 'Must be a number', code: 'INVALID_TYPE' };
    }
  }

  if (rule.type === 'boolean') {
    if (typeof value !== 'boolean') {
      return { field: rule.field, message: 'Must be true or false', code: 'INVALID_TYPE' };
    }
  }

  // Latitude
  if (rule.latitude) {
    if (!isLatitude(value)) {
      return { field: rule.field, message: 'Must be a number between -90 and 90', code: 'INVALID_RANGE' };
    }
  }

  // Longitude
  if (rule.longitude) {
    if (!isLongitude(value)) {
      return { field: rule.field, message: 'Must be a number between -180 and 180', code: 'INVALID_RANGE' };
    }
  }

  // Range
  if (rule.min !== undefined && isNumber(value) && value < rule.min) {
    return { field: rule.field, message: `Must be at least ${rule.min}`, code: 'INVALID_RANGE' };
  }
  if (rule.max !== undefined && isNumber(value) && value > rule.max) {
    return { field: rule.field, message: `Must be at most ${rule.max}`, code: 'INVALID_RANGE' };
  }

  // oneOf
  if (rule.oneOf) {
    if (!rule.oneOf.includes(value as string)) {
      return { field: rule.field, message: `Must be one of: ${rule.oneOf.join(', ')}`, code: 'INVALID_VALUE' };
    }
  }

  return null;
}

export function validateBody(body: Record<string, unknown>, rules: FieldRule[]): ValidationResult {
  const errors: FieldError[] = [];
  for (const rule of rules) {
    const err = validateField(body, rule);
    if (err) errors.push(err);
  }
  return { valid: errors.length === 0, errors };
}

// ── Pre-built rule sets ───────────────────────────────────────────────────────

export const DELIVERY_CREATE_RULES: FieldRule[] = [
  { field: 'vehicleTypeId',       required: true, type: 'uuid' },
  { field: 'pickupAddress',       required: true, type: 'string', minLength: 3, maxLength: 500 },
  { field: 'pickupLat',           required: true, type: 'number', latitude: true },
  { field: 'pickupLng',           required: true, type: 'number', longitude: true },
  { field: 'pickupContactName',   required: true, type: 'string', minLength: 1, maxLength: 200 },
  { field: 'pickupContactPhone',  required: true, type: 'string', minLength: 7, maxLength: 20 },
  { field: 'dropoffAddress',      required: true, type: 'string', minLength: 3, maxLength: 500 },
  { field: 'dropoffLat',          required: true, type: 'number', latitude: true },
  { field: 'dropoffLng',          required: true, type: 'number', longitude: true },
  { field: 'dropoffContactName',  required: true, type: 'string', minLength: 1, maxLength: 200 },
  { field: 'dropoffContactPhone', required: true, type: 'string', minLength: 7, maxLength: 20 },
  { field: 'pickupInstructions',  required: false, type: 'string', maxLength: 1000 },
  { field: 'dropoffInstructions', required: false, type: 'string', maxLength: 1000 },
  { field: 'packageDescription',  required: false, type: 'string', maxLength: 500 },
  { field: 'packageWeightKg',     required: false, type: 'number', min: 0, max: 10000 },
  { field: 'packageValue',        required: false, type: 'number', min: 0 },
  { field: 'distanceKm',          required: false, type: 'number', min: 0, max: 2000 },
  { field: 'paymentMethod',       required: false, oneOf: ['cash', 'card', 'gcash', 'maya', 'bank_transfer'] },
  { field: 'paymentStatus',       required: false, oneOf: ['pending', 'paid', 'failed'] },
  { field: 'paymentBy',           required: false, oneOf: ['sender', 'recipient'] },
];

export const WEBHOOK_CREATE_RULES: FieldRule[] = [
  { field: 'url',         required: true,  type: 'string', maxLength: 2000 },
  { field: 'description', required: false, type: 'string', maxLength: 500 },
];

export const WEBHOOK_UPDATE_RULES: FieldRule[] = [
  { field: 'url',         required: false, type: 'string', maxLength: 2000 },
  { field: 'is_active',   required: false, type: 'boolean' },
  { field: 'description', required: false, type: 'string', maxLength: 500 },
];

export const API_KEY_CREATE_RULES: FieldRule[] = [
  { field: 'name', required: true, type: 'string', minLength: 1, maxLength: 100 },
];

// ── Helper to build a standard error response ────────────────────────────────

export function validationErrorResponse(errors: FieldError[]) {
  return {
    error: 'Validation failed',
    code: 'VALIDATION_ERROR',
    details: errors,
  };
}
