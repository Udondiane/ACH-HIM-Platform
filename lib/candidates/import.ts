/**
 * Modular flexible import for candidates from application form exports.
 *
 * Accepts any CSV or Excel export. Recognises common column names via
 * fuzzy matching. Anything unrecognised is preserved in
 * candidates.application_source_data (jsonb) so no information is lost.
 *
 * Only two things are mandatory per row: a name and one contact method.
 * Everything else is optional and best-effort.
 */

export interface ImportRow {
  raw: Record<string, unknown>;   // the original row, all columns preserved
  mapped: {
    given_name?: string;
    family_name?: string;
    preferred_name?: string;
    email?: string;
    phone?: string;
    address_line1?: string;
    postcode?: string;
    date_of_birth?: string;       // ISO YYYY-MM-DD
    country_of_origin?: string;
    arrival_year?: number;
    preferred_locale?: string;
    english_level?: string;
    esol_level?: string;
    benefit_status?: string;
    ni_number?: string;
    career_goal_summary?: string;
    notes?: string;
  };
  application_source_data: Record<string, unknown>;  // everything not mapped
  errors: string[];      // validation errors for this row (blocking)
  warnings: string[];    // non-blocking notes
}

/**
 * Fuzzy match column names to HIM candidate fields. Case-insensitive,
 * whitespace-insensitive, punctuation-insensitive.
 */
const COLUMN_MAP: Array<{ target: keyof ImportRow['mapped']; patterns: RegExp[] }> = [
  { target: 'given_name',        patterns: [/^first ?name/i, /^given ?name/i, /^forename/i] },
  { target: 'family_name',       patterns: [/^last ?name/i, /^family ?name/i, /^surname/i] },
  { target: 'preferred_name',    patterns: [/preferred ?name/i, /^nickname/i] },
  { target: 'email',             patterns: [/^e[- ]?mail(?! ?verified)/i, /email ?address/i] },
  { target: 'phone',             patterns: [/^phone/i, /^mobile/i, /telephone/i, /contact ?number/i] },
  { target: 'address_line1',     patterns: [/^address/i, /street ?address/i, /home ?address/i] },
  { target: 'postcode',          patterns: [/post ?code/i, /^postcode/i, /^zip/i] },
  { target: 'date_of_birth',     patterns: [/date ?of ?birth/i, /^dob/i, /birth ?date/i] },
  { target: 'country_of_origin', patterns: [/country ?of ?origin/i, /nationality/i, /home ?country/i] },
  { target: 'arrival_year',      patterns: [/arriv(al|ed) ?(in )?uk/i, /year ?of ?arrival/i, /uk ?arrival/i] },
  { target: 'preferred_locale',  patterns: [/preferred ?language/i, /^language(?! ?level)/i, /language ?spoken/i, /^first ?language/i] },
  { target: 'english_level',     patterns: [/english ?level/i, /english ?proficiency/i] },
  { target: 'esol_level',        patterns: [/esol/i] },
  { target: 'benefit_status',    patterns: [/universal ?credit/i, /^jsa/i, /job.?seeker/i, /benefit/i] },
  { target: 'ni_number',         patterns: [/^ni ?number/i, /national ?insurance/i] },
  { target: 'career_goal_summary', patterns: [/which ?roles/i, /roles? ?interested/i, /career ?goal/i, /what ?do ?you ?hope/i, /hope ?to ?get/i] },
  { target: 'notes',             patterns: [/additional ?support/i, /^notes$/i, /^comments/i] },
];

const FULL_NAME_PATTERNS = [/^full ?name/i, /^name$/i, /candidate ?name/i, /applicant ?name/i];

/**
 * Split a full-name string into given / family. Best-effort: last token
 * is family, everything before is given.
 */
function splitFullName(full: string): { given_name: string; family_name?: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { given_name: parts[0] };
  return { given_name: parts.slice(0, -1).join(' '), family_name: parts[parts.length - 1] };
}

function normaliseValue(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

/**
 * Map one raw row into an ImportRow. Runs column-name matching, extracts
 * the HIM-relevant fields into `mapped`, and preserves everything else
 * (including the mapped fields themselves for audit) in
 * `application_source_data`.
 */
export function mapRow(raw: Record<string, unknown>): ImportRow {
  const mapped: ImportRow['mapped'] = {};
  const source: Record<string, unknown> = {};
  const consumed = new Set<string>();
  const errors: string[] = [];
  const warnings: string[] = [];

  const columns = Object.keys(raw);

  // Full-name column first (takes priority over given/family if both present).
  const fullNameCol = columns.find(c => FULL_NAME_PATTERNS.some(p => p.test(c.trim())));
  if (fullNameCol) {
    const v = normaliseValue(raw[fullNameCol]);
    if (v) {
      const split = splitFullName(v);
      mapped.given_name = split.given_name;
      if (split.family_name) mapped.family_name = split.family_name;
      consumed.add(fullNameCol);
    }
  }

  // Per-column fuzzy match
  for (const col of columns) {
    if (consumed.has(col)) continue;
    for (const { target, patterns } of COLUMN_MAP) {
      if (patterns.some(p => p.test(col.trim()))) {
        const v = normaliseValue(raw[col]);
        if (!v) { consumed.add(col); break; }
        // Coerce types where relevant
        if (target === 'arrival_year') {
          const year = parseInt(v, 10);
          if (!isNaN(year) && year > 1900 && year < 2100) {
            (mapped as Record<string, unknown>)[target] = year;
          } else {
            warnings.push(`Arrival year "${v}" not recognised, skipped.`);
          }
        } else if (target === 'date_of_birth') {
          // Best-effort ISO date coercion
          const d = new Date(v);
          if (!isNaN(d.getTime())) {
            (mapped as Record<string, unknown>)[target] = d.toISOString().slice(0, 10);
          } else {
            warnings.push(`Date of birth "${v}" not recognised, skipped.`);
          }
        } else {
          (mapped as Record<string, unknown>)[target] = v;
        }
        consumed.add(col);
        break;
      }
    }
  }

  // Anything unconsumed goes into application_source_data verbatim.
  for (const col of columns) {
    if (!consumed.has(col)) {
      source[col] = raw[col];
    }
  }

  // Validation
  if (!mapped.given_name) {
    errors.push('Missing name — every candidate needs at least a name.');
  }
  if (!mapped.email && !mapped.phone) {
    errors.push('Missing contact — every candidate needs at least an email or a phone.');
  }

  return { raw, mapped, application_source_data: source, errors, warnings };
}

/**
 * Parse CSV text into rows. Simple parser that handles quoted values and
 * newlines within quotes. Assumes first row is headers.
 */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = '';
  let inQuote = false;

  const pushField = () => { cur.push(field); field = ''; };
  const pushRow = () => { rows.push(cur); cur = []; };

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuote) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') { inQuote = false; }
      else { field += c; }
    } else {
      if (c === '"') { inQuote = true; }
      else if (c === ',') { pushField(); }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        pushField(); pushRow();
      }
      else { field += c; }
    }
  }
  if (field.length > 0 || cur.length > 0) { pushField(); pushRow(); }

  const nonEmpty = rows.filter(r => r.length > 1 || (r.length === 1 && r[0].trim().length > 0));
  if (nonEmpty.length === 0) return [];
  const headers = nonEmpty[0].map(h => h.trim());
  return nonEmpty.slice(1).map(r => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = r[i] ?? ''; });
    return obj;
  });
}
