// =====================================================
// Cargo Manifest CSV Parser
// =====================================================

export interface ManifestRow {
  id: string;
  // Cargo details
  reference_number: string;
  item_name: string;
  quantity: string;
  weight_kg: string;
  length_cm: string;
  width_cm: string;
  height_cm: string;
  cargo_type: string;
  declared_value: string;
  cod_amount: string;
  // Recipient
  recipient_name: string;
  recipient_phone: string;
  recipient_address: string;
  delivery_notes: string;
  // Geocoding result (populated after geocoding)
  lat?: number;
  lng?: number;
  // Validation state
  errors: string[];
  geocodeStatus: 'pending' | 'geocoding' | 'success' | 'failed';
}

export const CARGO_TYPES = ['standard', 'fragile', 'perishable', 'hazardous', 'documents'] as const;
export type CargoType = typeof CARGO_TYPES[number];

/** Expected CSV column headers (case-insensitive, trimmed) */
const COLUMN_ALIASES: Record<
  keyof Omit<ManifestRow, 'id' | 'lat' | 'lng' | 'errors' | 'geocodeStatus'>,
  string[]
> = {
  reference_number:  ['reference_number', 'ref', 'ref #', 'reference', 'order #', 'order number', 'order_number', 'tracking'],
  item_name:         ['item_name', 'item', 'item name', 'product', 'product name', 'description', 'cargo'],
  quantity:          ['quantity', 'qty', 'count', 'pcs'],
  weight_kg:         ['weight_kg', 'weight (kg)', 'weight', 'kg'],
  length_cm:         ['length_cm', 'length', 'l (cm)'],
  width_cm:          ['width_cm', 'width', 'w (cm)'],
  height_cm:         ['height_cm', 'height', 'h (cm)'],
  cargo_type:        ['cargo_type', 'cargo type', 'type', 'category', 'handling'],
  declared_value:    ['declared_value', 'declared value', 'value', 'item value'],
  cod_amount:        ['cod_amount', 'cod', 'cod amount', 'cash on delivery', 'collect'],
  recipient_name:    ['recipient_name', 'recipient', 'name', 'consignee', 'contact name'],
  recipient_phone:   ['recipient_phone', 'phone', 'mobile', 'contact phone', 'phone number'],
  recipient_address: ['recipient_address', 'address', 'delivery address', 'destination'],
  delivery_notes:    ['delivery_notes', 'notes', 'instructions', 'remarks'],
};

export interface ParseResult {
  rows: ManifestRow[];
  errors: string[];
}

/**
 * Parse a raw CSV string into ManifestRow objects.
 * Handles quoted fields, various line endings, and flexible column names.
 */
export function parseManifestCSV(csvText: string): ParseResult {
  const globalErrors: string[] = [];
  const rows: ManifestRow[] = [];

  const lines = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split('\n');

  if (lines.length < 2) {
    return { rows: [], errors: ['CSV file is empty or has no data rows.'] };
  }

  // Parse header row
  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());

  // Build column index map
  const colIndex: Partial<Record<keyof Omit<ManifestRow, 'id' | 'lat' | 'lng' | 'errors' | 'geocodeStatus'>, number>> = {};
  for (const [field, aliases] of Object.entries(COLUMN_ALIASES) as [keyof typeof COLUMN_ALIASES, string[]][]) {
    const found = aliases.findIndex(alias => headers.includes(alias));
    if (found !== -1) {
      colIndex[field] = headers.indexOf(aliases[found]);
    }
  }

  // Required columns
  if (colIndex.item_name === undefined) {
    globalErrors.push('Missing required column: "item_name" (or "item" / "product" / "description")');
  }
  if (colIndex.recipient_name === undefined) {
    globalErrors.push('Missing required column: "recipient_name" (or "name" / "consignee")');
  }
  if (colIndex.recipient_phone === undefined) {
    globalErrors.push('Missing required column: "recipient_phone" (or "phone" / "mobile")');
  }
  if (colIndex.recipient_address === undefined) {
    globalErrors.push('Missing required column: "recipient_address" (or "address" / "destination")');
  }

  if (globalErrors.length > 0) {
    return { rows: [], errors: globalErrors };
  }

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // skip blank lines

    const cells = parseCSVLine(line);
    const rowErrors: string[] = [];

    const get = (field: keyof typeof colIndex): string => {
      const idx = colIndex[field];
      return idx !== undefined ? (cells[idx] ?? '').trim() : '';
    };

    const refNum = get('reference_number');
    const itemName = get('item_name');
    const qty = get('quantity');
    const weight = get('weight_kg');
    const length = get('length_cm');
    const width = get('width_cm');
    const height = get('height_cm');
    const cargoType = get('cargo_type');
    const declaredValue = get('declared_value');
    const codAmount = get('cod_amount');
    const recipientName = get('recipient_name');
    const recipientPhone = get('recipient_phone');
    const recipientAddress = get('recipient_address');
    const notes = get('delivery_notes');

    // Row-level validation
    if (!itemName) rowErrors.push('Missing item name');
    if (!recipientName) rowErrors.push('Missing recipient name');
    if (!recipientAddress) rowErrors.push('Missing recipient address');
    if (!recipientPhone) {
      rowErrors.push('Missing recipient phone');
    } else if (!/^(09|\+639)\d{9}$/.test(recipientPhone.replace(/\s/g, ''))) {
      rowErrors.push(`Invalid phone format: "${recipientPhone}" (expected 09XXXXXXXXX)`);
    }
    if (qty && (isNaN(parseInt(qty)) || parseInt(qty) < 1)) {
      rowErrors.push(`Invalid quantity: "${qty}" (must be a positive integer)`);
    }
    if (weight && isNaN(parseFloat(weight))) {
      rowErrors.push(`Invalid weight: "${weight}" (must be a number)`);
    }
    if (declaredValue && isNaN(parseFloat(declaredValue))) {
      rowErrors.push(`Invalid declared value: "${declaredValue}" (must be a number)`);
    }
    if (codAmount && isNaN(parseFloat(codAmount))) {
      rowErrors.push(`Invalid COD amount: "${codAmount}" (must be a number)`);
    }
    if (cargoType && !CARGO_TYPES.includes(cargoType.toLowerCase() as CargoType)) {
      rowErrors.push(`Invalid cargo type: "${cargoType}" (must be: ${CARGO_TYPES.join(', ')})`);
    }

    rows.push({
      id: `row-${i}-${Date.now()}`,
      reference_number: refNum,
      item_name: itemName,
      quantity: qty || '1',
      weight_kg: weight,
      length_cm: length,
      width_cm: width,
      height_cm: height,
      cargo_type: cargoType || 'standard',
      declared_value: declaredValue,
      cod_amount: codAmount,
      recipient_name: recipientName,
      recipient_phone: recipientPhone,
      recipient_address: recipientAddress,
      delivery_notes: notes,
      errors: rowErrors,
      geocodeStatus: 'pending',
    });
  }

  if (rows.length === 0) {
    globalErrors.push('No data rows found in the CSV file.');
  }

  if (rows.length > 200) {
    globalErrors.push(`Too many rows (${rows.length}). Maximum allowed is 200 per manifest.`);
    return { rows: [], errors: globalErrors };
  }

  return { rows, errors: globalErrors };
}

/**
 * Parse a single CSV line, respecting double-quoted fields.
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

/**
 * Generate a blank CSV template string for download.
 */
export function generateManifestTemplate(): string {
  const headers = [
    'reference_number',
    'item_name',
    'quantity',
    'weight_kg',
    'length_cm',
    'width_cm',
    'height_cm',
    'cargo_type',
    'declared_value',
    'cod_amount',
    'recipient_name',
    'recipient_phone',
    'recipient_address',
    'delivery_notes',
  ];

  const exampleRows = [
    [
      'ORD-001',
      'Laptop Computer',
      '1',
      '2.5',
      '40',
      '30',
      '10',
      'fragile',
      '45000',
      '0',
      'Maria Santos',
      '09171234567',
      'BGC, Taguig, Metro Manila',
      'Leave at reception',
    ],
    [
      'ORD-002',
      'Frozen Goods Bundle',
      '3',
      '5.0',
      '',
      '',
      '',
      'perishable',
      '1200',
      '1200',
      'Juan Dela Cruz',
      '09181234567',
      'Mall of Asia, Pasay, Metro Manila',
      'Call upon arrival',
    ],
  ];

  const lines = [
    headers.join(','),
    ...exampleRows.map(row => row.map(cell => `"${cell}"`).join(',')),
  ];

  return lines.join('\n');
}

/**
 * Trigger a CSV template file download in the browser.
 */
export function downloadManifestTemplate(): void {
  const csv = generateManifestTemplate();
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'swiftdash_manifest_template.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
