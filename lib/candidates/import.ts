/**
 * Modular flexible import for candidates from application form exports.
 *
 * Accepts any CSV or Excel export. Recognises common column names via
 * fuzzy matching. Anything unrecognised is preserved in
 * candidates.application_source_data (jsonb) so no information is lost.
 *
 * Only two things are mandatory per row: a name and one contact method.
 * Everything else is optional and best-effort.
 *
 * Migration 064 expanded the target column set to cover comprehensive
 * intake (demographics, immigration, housing, referral, health, etc.)
 * so any partner application form should map cleanly with minimal
 * unmapped residual.
 */

export interface ImportRow {
  raw: Record<string, unknown>;   // the original row, all columns preserved
  mapped: {
    // Identity / contact
    given_name?: string;
    family_name?: string;
    preferred_name?: string;
    email?: string;
    phone?: string;
    date_of_birth?: string;       // ISO YYYY-MM-DD
    gender?: string;
    pronouns?: string;
    ethnicity?: string;
    religion?: string;

    // Location / housing
    address_line1?: string;
    address_line2?: string;
    city?: string;
    postcode?: string;
    local_authority?: string;
    housing_type?: string;
    accommodation_provider?: string;

    // Nationality / immigration
    country_of_origin?: string;
    arrival_year?: number;
    immigration_status?: string;
    home_office_reference?: string;
    brp_number?: string;
    right_to_work_status?: string;
    visa_expires_on?: string;

    // Language / literacy
    preferred_locale?: string;
    languages_spoken?: string;    // captured as string; DB column is text[] — split at insert
    english_level?: string;
    esol_level?: string;

    // Family / household
    dependants_count?: number;
    children_ages?: string;
    has_caring_responsibilities?: boolean;

    // Employment history / qualifications
    previous_occupation?: string;
    highest_qualification?: string;
    qualification_country?: string;
    qualifications_recognised_uk?: boolean;
    current_employment_status?: string;

    // Skills
    driving_licence?: string;
    digital_skills_self_reported?: string;

    // Benefits / official refs
    benefit_status?: string;
    ni_number?: string;

    // Health / accessibility
    disability_status?: string;
    accessibility_needs?: string;
    long_term_health_conditions?: string;

    // Referral route
    referral_source?: string;
    referrer_organisation?: string;
    referrer_contact?: string;

    // Communication preferences
    interpreter_needed?: boolean;
    interpreter_language?: string;
    preferred_contact_channel?: string;
    preferred_contact_time?: string;

    // Emergency contact
    emergency_contact_name?: string;
    emergency_contact_relationship?: string;
    emergency_contact_phone?: string;

    // Programme fit
    career_goal_summary?: string;
    programme_hopes?: string;
    availability?: string;
    barriers_to_engagement?: string;
    prior_engagement_with_ach?: boolean;

    // Free-form notes
    notes?: string;
  };
  application_source_data: Record<string, unknown>;  // everything not mapped
  errors: string[];      // validation errors for this row (blocking)
  warnings: string[];    // non-blocking notes
}

/**
 * Fuzzy match column names to HIM candidate fields. Case-insensitive,
 * whitespace-insensitive, punctuation-insensitive. Order matters — more
 * specific patterns come first so they win over generic ones.
 */
const COLUMN_MAP: Array<{ target: keyof ImportRow['mapped']; patterns: RegExp[] }> = [
  // Identity / contact
  { target: 'given_name',            patterns: [/^first ?name/i, /^given ?name/i, /^forename/i, /^christian ?name/i] },
  { target: 'family_name',           patterns: [/^last ?name/i, /^family ?name/i, /^surname/i] },
  { target: 'preferred_name',        patterns: [/preferred ?name/i, /^nickname/i, /known ?as/i, /goes ?by/i] },
  { target: 'email',                 patterns: [/^e[- ]?mail(?! ?verified)/i, /email ?address/i] },
  { target: 'phone',                 patterns: [/^phone/i, /^mobile/i, /telephone/i, /contact ?number/i, /^tel/i] },
  { target: 'date_of_birth',         patterns: [/date ?of ?birth/i, /^dob$/i, /birth ?date/i, /born ?on/i] },
  { target: 'gender',                patterns: [/^gender/i, /^sex$/i] },
  { target: 'pronouns',              patterns: [/^pronouns/i, /preferred ?pronouns/i] },
  { target: 'ethnicity',             patterns: [/ethnic(ity)? ?(group|background)?/i, /^race\b/i] },
  { target: 'religion',              patterns: [/religion/i, /^faith\b/i] },

  // Location / housing
  { target: 'address_line1',         patterns: [/address ?line ?1/i, /^address$/i, /street ?address/i, /home ?address/i, /^street/i] },
  { target: 'address_line2',         patterns: [/address ?line ?2/i, /^address ?2$/i] },
  { target: 'city',                  patterns: [/^city$/i, /^town$/i, /^borough$/i] },
  { target: 'postcode',              patterns: [/post ?code/i, /^postcode/i, /^zip/i] },
  { target: 'local_authority',       patterns: [/local ?authority/i, /council/i, /^la\b/i] },
  { target: 'housing_type',          patterns: [/housing ?(type|status|situation)/i, /accommodation ?type/i, /where ?do ?you ?live/i] },
  { target: 'accommodation_provider',patterns: [/accommodation ?provider/i, /housing ?provider/i, /landlord/i, /home ?office ?accom/i] },

  // Nationality / immigration
  { target: 'country_of_origin',     patterns: [/country ?of ?origin/i, /nationality/i, /home ?country/i, /where ?(are|were) ?you ?born/i, /country ?of ?birth/i] },
  { target: 'arrival_year',          patterns: [/arriv(al|ed) ?(in )?uk/i, /year ?of ?arrival/i, /uk ?arrival/i, /when ?did ?you ?arrive/i] },
  { target: 'immigration_status',    patterns: [/immigration ?status/i, /asylum ?status/i, /refugee ?status/i, /visa ?type/i, /leave ?to ?remain/i, /right ?to ?remain/i] },
  { target: 'home_office_reference', patterns: [/home ?office ?ref/i, /^ho ?ref/i, /home ?office ?number/i, /^hors/i] },
  { target: 'brp_number',            patterns: [/^brp/i, /biometric ?residence/i, /brp ?number/i] },
  { target: 'right_to_work_status',  patterns: [/right ?to ?work/i, /rtw ?status/i, /share ?code/i, /work ?authorisation/i] },
  { target: 'visa_expires_on',       patterns: [/visa ?expir/i, /leave ?expir/i, /brp ?expir/i, /permit ?expir/i] },

  // Language / literacy
  { target: 'preferred_locale',      patterns: [/preferred ?language/i, /^language(?! ?level)/i, /language ?spoken(?! ?other)/i, /^first ?language/i, /mother ?tongue/i, /native ?language/i] },
  { target: 'languages_spoken',      patterns: [/other ?languages/i, /languages ?spoken/i, /which ?languages/i, /languages ?you ?speak/i, /additional ?languages/i] },
  { target: 'english_level',         patterns: [/english ?level/i, /english ?proficiency/i, /english ?ability/i, /how ?well ?.* ?english/i] },
  { target: 'esol_level',            patterns: [/esol/i, /english ?class ?level/i] },

  // Family / household
  { target: 'dependants_count',      patterns: [/^dependants/i, /^dependents/i, /number ?of ?(child|kid|dependant|dependent)/i, /how ?many ?(child|kid|dependant)/i] },
  { target: 'children_ages',         patterns: [/child(ren)? ?ages/i, /ages ?of ?children/i, /ages ?of ?kids/i] },
  { target: 'has_caring_responsibilities', patterns: [/carer|caring ?responsib/i, /^carer\b/i] },

  // Employment history / qualifications
  { target: 'previous_occupation',   patterns: [/previous ?(job|occupation|role|work)/i, /prior ?(job|occupation)/i, /what ?did ?you ?do ?(in|before|back)/i, /home ?country ?job/i, /former ?occupation/i] },
  { target: 'highest_qualification', patterns: [/highest ?qualif/i, /highest ?(education|degree|level)/i, /education ?level/i] },
  { target: 'qualification_country', patterns: [/country ?of ?qualif/i, /qualif.*country/i, /where ?(did ?you )?stud/i] },
  { target: 'qualifications_recognised_uk', patterns: [/uk[-\s]?enic/i, /recognised ?in ?uk/i, /qualifications? ?recognised/i, /naric/i] },
  { target: 'current_employment_status', patterns: [/employment ?status/i, /current ?work ?status/i, /working ?status/i, /are ?you ?(currently )?(employed|working)/i] },

  // Skills
  { target: 'driving_licence',       patterns: [/driving ?licen[cs]e/i, /^driver'?s? ?licen[cs]e/i, /drive.* ?licence/i] },
  { target: 'digital_skills_self_reported', patterns: [/digital ?skills?/i, /it ?skills?/i, /computer ?skills?/i, /tech ?skills?/i] },

  // Benefits / official refs
  { target: 'benefit_status',        patterns: [/universal ?credit/i, /^jsa/i, /job.?seeker/i, /benefit/i] },
  { target: 'ni_number',             patterns: [/^ni ?number/i, /national ?insurance/i, /^nino\b/i] },

  // Health / accessibility
  { target: 'disability_status',     patterns: [/^disability/i, /disabled\??$/i, /long[-\s]?term ?condition/i] },
  { target: 'accessibility_needs',   patterns: [/accessibility ?needs?/i, /access ?requirement/i, /accessibility/i, /reasonable ?adjust/i] },
  { target: 'long_term_health_conditions', patterns: [/health ?condition/i, /medical ?condition/i, /chronic ?illness/i] },

  // Referral route
  { target: 'referral_source',       patterns: [/how ?did ?you ?hear/i, /referral ?source/i, /how ?were ?you ?referred/i, /referred ?by/i, /referral ?route/i] },
  { target: 'referrer_organisation', patterns: [/referring ?(organisation|org|agency|body)/i, /referrer ?org/i] },
  { target: 'referrer_contact',      patterns: [/referrer ?(contact|name)/i, /referrer ?email/i, /referrer ?phone/i] },

  // Communication preferences
  { target: 'interpreter_needed',    patterns: [/interpreter ?needed/i, /need ?(an? )?interpreter/i, /require ?interpreter/i, /^interpreter\??$/i] },
  { target: 'interpreter_language',  patterns: [/interpreter ?language/i, /which ?interpreter/i] },
  { target: 'preferred_contact_channel', patterns: [/preferred ?contact ?(channel|method|way)/i, /best ?way ?to ?contact/i, /how ?do ?we ?contact/i] },
  { target: 'preferred_contact_time', patterns: [/preferred ?contact ?time/i, /best ?time ?to ?call/i, /when ?to ?call/i] },

  // Emergency contact
  { target: 'emergency_contact_name', patterns: [/emergency ?contact ?name/i, /next ?of ?kin ?name/i, /^next ?of ?kin$/i] },
  { target: 'emergency_contact_relationship', patterns: [/emergency ?contact ?relation/i, /kin ?relation/i, /^relationship$/i] },
  { target: 'emergency_contact_phone', patterns: [/emergency ?contact ?phone/i, /emergency ?number/i, /kin ?phone/i] },

  // Programme fit
  { target: 'career_goal_summary',   patterns: [/which ?roles/i, /roles? ?interested/i, /career ?goal/i, /what ?do ?you ?hope/i, /hope ?to ?get/i, /career ?ambition/i, /dream ?job/i] },
  { target: 'programme_hopes',       patterns: [/why ?do ?you ?want ?to ?join/i, /what ?do ?you ?want ?to ?get ?out/i, /programme ?hopes/i, /goals? ?for ?(the )?programme/i] },
  { target: 'availability',          patterns: [/availability/i, /available ?(days|times|hours)/i, /when ?are ?you ?free/i, /when ?can ?you ?attend/i] },
  { target: 'barriers_to_engagement',patterns: [/barriers? ?to/i, /what ?might ?stop ?you/i, /obstacles/i, /challenges ?attend/i] },
  { target: 'prior_engagement_with_ach', patterns: [/prior ?engagement/i, /been ?with ?ach/i, /previous ?ach/i, /worked ?with ?ach ?before/i] },

  // Free-form notes
  { target: 'notes',                 patterns: [/additional ?support/i, /^notes$/i, /^comments/i, /anything ?else/i] },
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
 * Best-effort boolean coercion for Yes/No/1/0/true/false/etc.
 * Returns undefined when the value looks ambiguous so we don't silently
 * flip an unclear answer.
 */
function coerceBoolean(v: string): boolean | undefined {
  const s = v.toLowerCase().trim();
  if (!s) return undefined;
  if (['yes','y','true','t','1','on'].includes(s)) return true;
  if (['no','n','false','f','0','off'].includes(s)) return false;
  return undefined;
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
        } else if (target === 'dependants_count') {
          const n = parseInt(v, 10);
          if (!isNaN(n) && n >= 0 && n < 30) {
            (mapped as Record<string, unknown>)[target] = n;
          } else {
            warnings.push(`Dependants count "${v}" not recognised, skipped.`);
          }
        } else if (target === 'date_of_birth' || target === 'visa_expires_on') {
          const d = new Date(v);
          if (!isNaN(d.getTime())) {
            (mapped as Record<string, unknown>)[target] = d.toISOString().slice(0, 10);
          } else {
            warnings.push(`Date "${v}" for ${target} not recognised, skipped.`);
          }
        } else if (
          target === 'has_caring_responsibilities' ||
          target === 'qualifications_recognised_uk' ||
          target === 'interpreter_needed' ||
          target === 'prior_engagement_with_ach'
        ) {
          const b = coerceBoolean(v);
          if (b !== undefined) {
            (mapped as Record<string, unknown>)[target] = b;
          } else {
            // Keep the raw value in application_source_data so nothing is lost
            source[col] = raw[col];
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
