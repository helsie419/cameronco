/* ============================================================================
   PASTE-EXTRACT — rule-based parser for text cut-and-pasted from an insurer's
   claims portal. No AI/API call: matches "Label: value" style lines against a
   synonym map per field, with a couple of whole-text regex fallbacks (email,
   phone, postcode) for portals that don't label those explicitly. A third
   strategy (further down) handles portals whose panel/grid layout flattens
   several labels onto one line and the matching values onto the next.

   Add new insurer wordings by extending the synonym arrays below — the
   parsing logic itself shouldn't need to change.
   ========================================================================== */

const PASTE_EXTRACT_LABELS = {
  // Bare "customer" (no "name") is deliberately excluded — it shows up as a
  // qualifier in unrelated header phrases too (e.g. "Customer Property Risk
  // Address"), and in the grid-pairs strategy a false-positive match here
  // doesn't just miss a field, it actively grabs the wrong token as the
  // customer's name.
  name: ['name', 'claimant', 'claimant name', 'insured', 'insured name', 'customer name', 'policy holder', 'policyholder', 'primary contact name', 'primary contact'],
  email: ['email', 'email address', 'e mail'],
  phone: ['phone', 'mobile', 'mobile number', 'phone number', 'contact number', 'contact phone', 'telephone', 'primary contact number'],
  address: ['address', 'risk address', 'property address', 'postal address', 'residential address', 'site address', 'property risk address'],
  suburb: ['suburb', 'city', 'town'],
  state: ['state'],
  postcode: ['postcode', 'post code', 'zip'],
  claim_number: ['claim number', 'claim no', 'claim no.', 'claim ref', 'claim reference', 'claim id', 'insurance ref', 'insurance ref #'],
  policy_ref: ['policy number', 'policy no', 'policy ref', 'policy reference', 'contents ref', 'contents ref #',
               'assessment no', 'assessment no.', 'assessment number', 'assessment ref', 'assessment reference'],
  insurer: ['insurer', 'insurance company', 'underwriter', 'brand'],
  respond_by: ['respond by', 'respond by date', 'response due', 'response due date', 'response deadline'],
  description: ['description', 'item description', 'claim description'],
  special_instructions: ['special instructions', 'special instruction'],
  excess: ['excess', 'policy excess', 'excess amount', 'nominated excess'],
};

const PASTE_EXTRACT_STATES = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'];
// "STATE postcode", with an optional comma between them (some portals write
// "…KALKALLO VIC, 3064" as one line rather than "VIC" and "3064" separately).
const PASTE_EXTRACT_STATE_POSTCODE_RE = new RegExp(`\\b(?:${PASTE_EXTRACT_STATES.join('|')})\\s*,?\\s*\\d{4}\\b`, 'i');

// Recognised only by the whole-line label strategies below (a line must
// equal exactly one of these) — never by the grid-pairs word tokenizer
// further down, where bare "customer" as a loose word inside a header
// phrase ("Customer Property Risk Address") would misfire and grab the
// wrong token. Some portals (e.g. QBE PropertyLink) use bare "Customer" on
// its own line as the claimant-name label, so it still needs to work there.
const PASTE_EXTRACT_LINE_ONLY_LABELS = {
  name: ['customer'],
};

function pasteExtractNormalizeLabel(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

/* A handful of portals prefix every field value with a bullet marker in
   their UI; OCR sometimes reads it faithfully, sometimes misreads it as an
   equals sign. Strip it so it doesn't end up glued onto real data (e.g.
   "• 31 Trophis Street", "= VIC"). */
function pasteExtractStripValueNoise(s) {
  return String(s || '').replace(/^[•●▪·=]\s*/, '').trim();
}

function pasteExtractParseLabeledLines(text) {
  const map = {};
  String(text || '').split(/\r?\n/).forEach(line => {
    const m = line.match(/^\s*([A-Za-z][A-Za-z0-9 /()&'-]{1,40}?)\s*[:\-]\s*(.+?)\s*$/);
    if (m && m[2]) {
      const key = pasteExtractNormalizeLabel(m[1]);
      if (key) map[key] = m[2].trim();
    }
  });
  return map;
}

/* Same-line "Label value" with no separator at all ("Insurance Ref #
   700000101535") — matches a known multi-word label against the start of
   the line and takes the rest as the value. Only multi-word synonyms
   qualify (a bare one-word label like "State" or "Name" is too likely to
   just be the first word of an unrelated sentence). Unlike the next-line
   strategy below, there's no ambiguity about which value belongs to which
   label here, so this is the highest-confidence source and wins ties when
   the same field also got a (possibly OCR-corrupted) value from a repeated
   label elsewhere on the page. */
function pasteExtractParseLabelPrefixLine(text) {
  const map = {};
  const candidates = pasteExtractSynonymWordList();
  String(text || '').split(/\r?\n/).forEach(rawLine => {
    const line = rawLine.trim();
    if (!line) return;
    const words = [];
    const wordRe = /\S+/g;
    let wm;
    while ((wm = wordRe.exec(line))) words.push({ text: wm[0], end: wm.index + wm[0].length });
    if (words.length < 2) return;
    const normWords = words.map(w => pasteExtractNormalizeLabel(w.text));
    for (const cand of candidates) {
      const n = cand.words.length;
      if (n < 2 || n > words.length - 1) continue;
      let ok = true;
      for (let k = 0; k < n; k++) { if (normWords[k] !== cand.words[k]) { ok = false; break; } }
      if (!ok) continue;
      const value = pasteExtractStripValueNoise(line.slice(words[n - 1].end).replace(/^[\s:#-]+/, ''));
      if (!value) continue;
      const key = pasteExtractNormalizeLabel(cand.synonym);
      if (!map[key]) map[key] = value;
      break;
    }
  });
  return map;
}

let pasteExtractSynonymSetCache = null;
function pasteExtractAllSynonymsNormalized() {
  if (pasteExtractSynonymSetCache) return pasteExtractSynonymSetCache;
  const set = new Set();
  Object.values(PASTE_EXTRACT_LABELS).forEach(arr => arr.forEach(s => set.add(pasteExtractNormalizeLabel(s))));
  Object.values(PASTE_EXTRACT_LINE_ONLY_LABELS).forEach(arr => arr.forEach(s => set.add(pasteExtractNormalizeLabel(s))));
  pasteExtractSynonymSetCache = set;
  return set;
}

/* OCR'd dashboard screenshots (card layouts) usually put the label on its own
   line with the value directly beneath it, rather than "Label: value" on one
   line — this catches that shape as a fallback, lower-priority source. */
const PASTE_EXTRACT_ADDRESS_KEYS = new Set(
  PASTE_EXTRACT_LABELS.address.map(pasteExtractNormalizeLabel)
);

let pasteExtractSynonymToFieldCache = null;
function pasteExtractFieldForLabel(norm) {
  if (!pasteExtractSynonymToFieldCache) {
    const map = {};
    [PASTE_EXTRACT_LABELS, PASTE_EXTRACT_LINE_ONLY_LABELS].forEach(labels => {
      Object.entries(labels).forEach(([field, arr]) => arr.forEach(s => { map[pasteExtractNormalizeLabel(s)] = field; }));
    });
    pasteExtractSynonymToFieldCache = map;
  }
  return pasteExtractSynonymToFieldCache[norm];
}

/* Some portals leave a field genuinely blank in the source, and the "value"
   directly under its label in the OCR text is actually the start of the
   next (unlabelled) piece of content — e.g. an empty "Contents Ref #" right
   above a job-type badge like "Scope & Repair (Quick Repair)". Reference
   numbers are short codes, never prose, so reject anything with that shape
   rather than filing a sentence into a reference field. */
function pasteExtractLooksLikeReferenceCode(s) {
  const str = String(s || '').trim();
  if (!str) return false;
  if (/[()]/.test(str)) return false;
  const wholeWords = str.split(/\s+/).filter(w => /^[A-Za-z]+$/.test(w));
  return wholeWords.length < 2;
}

function pasteExtractParseLabelNextLine(text) {
  const lines = String(text || '').split(/\r?\n/).map(l => l.trim());
  const synonyms = pasteExtractAllSynonymsNormalized();
  const map = {};
  for (let i = 0; i < lines.length; i++) {
    const norm = pasteExtractNormalizeLabel(lines[i]);
    if (!norm || !synonyms.has(norm)) continue;

    // Street addresses on card layouts often span several lines (street,
    // suburb, state, postcode each on their own line) — gather them and
    // rejoin so the address/suburb/state/postcode splitter can parse it.
    if (PASTE_EXTRACT_ADDRESS_KEYS.has(norm)) {
      const collected = [];
      for (let j = i + 1; j < lines.length && collected.length < 6; j++) {
        const val = pasteExtractStripValueNoise(lines[j]);
        if (!val) { if (collected.length) break; continue; }
        if (synonyms.has(pasteExtractNormalizeLabel(val))) break;
        collected.push(val);
        // Australian addresses end "STATE 1234" (comma before the postcode
        // on some portals) — once that shape shows up, either on this line
        // by itself or split across this line and the next, there's nothing
        // left to gather, so stop before grabbing the next panel's text.
        if (PASTE_EXTRACT_STATE_POSTCODE_RE.test(val)) break;
        if (PASTE_EXTRACT_STATES.includes(val.toUpperCase()) && /^\d{4}$/.test(lines[j + 1] || '')) {
          collected.push(lines[j + 1]);
          break;
        }
      }
      if (collected.length) {
        const joined = collected.length > 1
          ? `${collected[0]}, ${collected.slice(1).join(' ')}`
          : collected[0];
        // Some portals repeat the "Address" label as a bare section/checkbox
        // header with no real value underneath (e.g. AAMI's "Unable to
        // Proceed" reason list), or show the same address twice with the
        // second copy more complete than the first (e.g. QBE's summary line
        // at the bottom of the panel) — prefer whichever candidate actually
        // looks like a full address over one that doesn't.
        const looksLikeAddress = PASTE_EXTRACT_STATE_POSTCODE_RE.test(joined);
        if (looksLikeAddress || !map[norm]) map[norm] = joined;
      }
      continue;
    }

    const field = pasteExtractFieldForLabel(norm);
    for (let j = i + 1; j < lines.length; j++) {
      const val = pasteExtractStripValueNoise(lines[j]);
      if (!val) continue;
      if (synonyms.has(pasteExtractNormalizeLabel(val))) break;
      if ((field === 'claim_number' || field === 'policy_ref') && !pasteExtractLooksLikeReferenceCode(val)) break;
      map[norm] = val;
      break;
    }
  }
  return map;
}

function pasteExtractFindField(map, field) {
  const synonyms = [...(PASTE_EXTRACT_LABELS[field] || []), ...(PASTE_EXTRACT_LINE_ONLY_LABELS[field] || [])];
  for (const synonym of synonyms) {
    const key = pasteExtractNormalizeLabel(synonym);
    if (map[key]) return map[key];
  }
  return null;
}

const PASTE_EXTRACT_TITLES = /^(mr|mrs|ms|miss|mx|dr|prof)\.?\s+/i;

function pasteExtractSplitName(raw) {
  let s = String(raw || '').trim().replace(PASTE_EXTRACT_TITLES, '');
  if (!s) return { first_name: '', last_name: '' };
  if (s.includes(',')) {
    const [last, first] = s.split(',').map(x => x.trim());
    return { first_name: first || '', last_name: last || '' };
  }
  const parts = s.split(/\s+/);
  return { first_name: parts[0] || '', last_name: parts.slice(1).join(' ') };
}

function pasteExtractSplitAddress(line) {
  const s = String(line || '').trim();

  // Some portals glue an ALL-CAPS suburb straight onto a mixed-case street
  // name with no comma between them ("31 Trophis Street KALKALLO VIC,
  // 3064") — the case change is the only delimiter available, so use it:
  // the street must end in a lowercase letter, the suburb is one or more
  // ALL-CAPS words directly before the state.
  let m = s.match(
    /^(.*?[a-z])\s+([A-Z]{2,}(?:\s+[A-Z]{2,})*)\s+(NSW|VIC|QLD|SA|WA|TAS|NT|ACT)(?:\s+|,\s*)(\d{4})\s*$/
  );
  if (m) {
    return { address: m[1].trim(), suburb: m[2].trim(), state: m[3].toUpperCase(), postcode: m[4] };
  }

  // Otherwise: "street, [suburb] STATE postcode" — suburb only recognised
  // when a comma anchors it (as it always does when present); without one,
  // there's no reliable way to tell street from suburb apart, so the whole
  // prefix is kept together as the address rather than guessing wrong.
  m = s.match(
    /^(.*?)(?:,\s*([A-Za-z .'-]+?))?\s+(NSW|VIC|QLD|SA|WA|TAS|NT|ACT)(?:\s+|,\s*)(\d{4})\s*$/i
  );
  if (!m) return null;
  return {
    address: m[1].trim().replace(/,+$/, ''),
    suburb: (m[2] || '').trim(),
    state: m[3].toUpperCase(),
    postcode: m[4],
  };
}

const PASTE_EXTRACT_MONTHS = ['january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december'];

/** Pulls the first dollar figure out of a raw matched value ("$100 .", "100.00") as a plain number. */
function pasteExtractParseCurrency(raw) {
  const m = String(raw || '').match(/\d[\d,]*(?:\.\d+)?/);
  if (!m) return null;
  const n = parseFloat(m[0].replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

/* Pulls just the postcode digits out of a labelled value instead of trusting
   it verbatim — some portals' bullet marker gets OCR'd as a stray leading
   digit ("9 3064"), and a bare \d{4} scan skips right over a lone digit like
   that since it isn't part of a 4-in-a-row run. */
function pasteExtractExtractPostcode(raw) {
  const m = String(raw || '').match(/\d{4}/);
  return m ? m[0] : String(raw || '').trim();
}

/* Same OCR-bullet-as-digit issue as above, but suburb names are letters, not
   digits, so a leading 1-2 digit token followed by a real word is always
   noise here — unlike street addresses, where a leading digit is the
   legitimate street number and must be kept. */
function pasteExtractStripLeadingDigitNoise(raw) {
  return String(raw || '').replace(/^\d{1,2}\s+(?=[A-Za-z])/, '').trim();
}

function pasteExtractParseDateToIso(raw) {
  const s = String(raw || '').trim();
  let m = s.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (m) {
    const monthIdx = PASTE_EXTRACT_MONTHS.indexOf(m[2].toLowerCase());
    if (monthIdx >= 0) return `${m[3]}-${String(monthIdx + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return null;
}

/* --------------------------------------------------------------------------
   GRID-PANEL STRATEGY — some assessor portals (e.g. AAMI's) show a claim as
   a grid of labelled panels. Drag-selecting text across several panels
   flattens it into paired lines: every label from that row concatenated,
   then every value from that row concatenated directly below, e.g.

     Assessment No Status Insured Name Primary Contact Name
     14135563 New Miss KIMBERLEY PETERS KIMBERLEY PETERS

   There's no per-field separator, so this walks the header words, greedily
   matching known label phrases (longest first) with single unrecognised
   words as filler in between, then walks the value line using each field's
   own value shape (email regex, digit runs, "has a letter and a digit" for
   claim numbers, ALL-CAPS/title-case for names…) to know where one column's
   value ends and the next begins. Two consecutive name columns (insured +
   primary contact, almost always the same person) are split evenly once a
   leading title is stripped. This is inherently heuristic — it only kicks in
   when a whole line tiles exactly into known labels, so it won't misfire on
   ordinary sentences or "Label: value" text, which the strategies above
   already handle. */

let pasteExtractSynonymWordsCache = null;
function pasteExtractSynonymWordList() {
  if (pasteExtractSynonymWordsCache) return pasteExtractSynonymWordsCache;
  const list = [];
  Object.entries(PASTE_EXTRACT_LABELS).forEach(([field, synonyms]) => {
    synonyms.forEach(s => {
      const words = pasteExtractNormalizeLabel(s).split(' ').filter(Boolean);
      if (words.length) list.push({ field, synonym: s, words });
    });
  });
  list.sort((a, b) => b.words.length - a.words.length);
  pasteExtractSynonymWordsCache = list;
  return list;
}

function pasteExtractTokenizeHeaderLine(line) {
  const normalized = pasteExtractNormalizeLabel(line);
  if (!normalized) return null;
  const words = normalized.split(' ');
  const candidates = pasteExtractSynonymWordList();
  const raw = [];
  let i = 0;
  let recognizedCount = 0;
  while (i < words.length) {
    let match = null;
    for (const cand of candidates) {
      const n = cand.words.length;
      if (n > words.length - i) continue;
      let ok = true;
      for (let k = 0; k < n; k++) { if (words[i + k] !== cand.words[k]) { ok = false; break; } }
      if (ok) { match = cand; break; } // longest-first list — first hit wins
    }
    if (match) {
      raw.push({ field: match.field, key: pasteExtractNormalizeLabel(match.synonym), words: match.words.length });
      i += match.words.length;
      recognizedCount++;
    } else {
      raw.push({ field: null, key: null, words: 1 });
      i += 1;
    }
  }
  if (recognizedCount < 2) return null;
  // coalesce adjacent filler slots so value-line splitting only has to
  // reason about one "unrecognised" block between two known fields
  const slots = [];
  for (const slot of raw) {
    const prev = slots[slots.length - 1];
    if (!slot.field && prev && !prev.field) prev.words += slot.words;
    else slots.push({ ...slot });
  }
  return slots;
}

function pasteExtractIsNameToken(t) {
  return /^(mr|mrs|ms|miss|mx|dr|prof)\.?$/i.test(t) || /^[A-Z]{2,}$/.test(t);
}

/** How many tokens at `tokens[pos]` belong to `field`; 0 if it doesn't start here. */
function pasteExtractFieldTakeCount(field, tokens, pos) {
  const t = tokens[pos] || '';
  switch (field) {
    case 'policy_ref':
    case 'postcode':
      return /^\d+$/.test(t) ? 1 : 0;
    case 'state':
      return PASTE_EXTRACT_STATES.includes(t.toUpperCase()) ? 1 : 0;
    case 'claim_number':
      return (/[A-Za-z]/.test(t) && /\d/.test(t)) ? 1 : 0;
    case 'email':
      return /^[\w.+-]+@[\w-]+\.[a-z]{2,}$/i.test(t) ? 1 : 0;
    case 'phone':
      return /^[+\d][\d\s()+-]{5,}$/.test(t) ? 1 : 0;
    case 'respond_by': {
      if (!/^\d{1,2}$/.test(t)) return 0;
      if (!/^[A-Za-z]+$/.test(tokens[pos + 1] || '')) return 1;
      return /^\d{4}$/.test(tokens[pos + 2] || '') ? 3 : 2;
    }
    case 'insurer':
      return /^[A-Za-z][A-Za-z&.'-]*$/.test(t) ? 1 : 0;
    default:
      return 1;
  }
}

function pasteExtractSplitGridValueLine(slots, valueLine) {
  const tokens = String(valueLine || '').trim().split(/\s+/).filter(Boolean);
  const map = {};
  let cursor = 0;
  let i = 0;
  while (i < slots.length && cursor < tokens.length) {
    const slot = slots[i];

    if (!slot.field) {
      // filler — consume until the next slot's value visibly starts
      const next = slots[i + 1];
      let take = 0;
      while (cursor + take < tokens.length &&
             !(next && (next.field === 'name'
               ? pasteExtractIsNameToken(tokens[cursor + take])
               : pasteExtractFieldTakeCount(next.field, tokens, cursor + take) > 0))) {
        take++;
        if (!next) break; // last slot is filler — nothing to stop for, take the rest
      }
      cursor += take;
      i++;
      continue;
    }

    if (slot.field === 'name') {
      // group consecutive name slots (insured name + primary contact name…)
      let end = i + 1;
      while (end < slots.length && slots[end].field === 'name') end++;
      const group = slots.slice(i, end);
      let take = 0;
      while (cursor + take < tokens.length && pasteExtractIsNameToken(tokens[cursor + take])) take++;
      const runTokens = tokens.slice(cursor, cursor + take);
      let title = '';
      if (runTokens.length && /^(mr|mrs|ms|miss|mx|dr|prof)\.?$/i.test(runTokens[0])) title = runTokens.shift() + ' ';
      const n = group.length;
      const base = Math.floor(runTokens.length / n);
      const extra = runTokens.length - base * n;
      let p = 0;
      group.forEach((s, idx) => {
        const count = base + (idx === 0 ? extra : 0);
        const val = runTokens.slice(p, p + count).join(' ');
        map[s.key] = idx === 0 ? (title + val).trim() : val;
        p += count;
      });
      cursor += take;
      i = end;
      continue;
    }

    if (slot.field === 'address') {
      // Free-text and has no fixed shape, unlike the columns around it — grab
      // tokens until one looks like a Yes/No answer column (common next to
      // "Address" in card grids, e.g. "Asbestos Present?") or the next slot's
      // value visibly starts, instead of the single-token default below.
      const next = slots[i + 1];
      let take = 0;
      while (cursor + take < tokens.length) {
        const t = tokens[cursor + take];
        if (/^(y|yes|n|no)$/i.test(t)) break; // OCR often truncates "No" to a bare "N"
        if (next && next.field && pasteExtractFieldTakeCount(next.field, tokens, cursor + take) > 0) break;
        take++;
        if (take >= 6) break; // street lines don't run longer than this
      }
      if (take === 0) take = 1;
      map[slot.key] = tokens.slice(cursor, cursor + take).join(' ');
      cursor += take;
      i++;
      continue;
    }

    const take = pasteExtractFieldTakeCount(slot.field, tokens, cursor) || 1;
    map[slot.key] = tokens.slice(cursor, cursor + take).join(' ');
    cursor += take;
    i++;
  }
  return map;
}

function pasteExtractParseGridPairs(text) {
  const lines = String(text || '').split(/\r?\n/);
  const map = {};
  for (let i = 0; i < lines.length - 1; i++) {
    const slots = pasteExtractTokenizeHeaderLine(lines[i]);
    if (!slots) continue;
    const valueLine = lines[i + 1];
    if (!valueLine || !valueLine.trim()) continue;
    Object.assign(map, pasteExtractSplitGridValueLine(slots, valueLine));
  }
  return map;
}

/* Insurer portals and OCR both frequently shout names/addresses in ALL CAPS
   ("KIMBERLEY PETERS", "3 POTTERS RISE"). Only re-case text that's entirely
   upper or entirely lower — mixed case (e.g. "McDonald", "O'Brien") is left
   alone since it's likely already correctly formatted. */
function pasteExtractSentenceCase(s) {
  const str = String(s || '').trim();
  if (!str) return str;
  const letters = str.replace(/[^A-Za-z]/g, '');
  const isAllUpper = letters && letters === letters.toUpperCase() && letters !== letters.toLowerCase();
  const isAllLower = letters && letters === letters.toLowerCase() && letters !== letters.toUpperCase();
  if (!isAllUpper && !isAllLower) return str;
  return str.toLowerCase().replace(/(^|[\s\-'/.])([a-z])/g, (m, sep, ch) => sep + ch.toUpperCase());
}

function pasteExtractMatchInsurer(text, insurerOptions) {
  const normalizedText = pasteExtractNormalizeLabel(text);
  if (!normalizedText) return null;
  let best = null;
  for (const opt of insurerOptions || []) {
    const name = pasteExtractNormalizeLabel(opt.name);
    if (name && normalizedText.includes(name)) {
      if (!best || name.length > pasteExtractNormalizeLabel(best.name).length) best = opt;
    }
  }
  return best ? best.id : null;
}

/**
 * Parse pasted insurer-portal text into customer + claim fields.
 * insurerOptions: [{ id, name }] loaded from the insurer dropdown.
 * Returns { fields, matched } — matched lists which field keys were found.
 */
function parsePastedInsurerText(text, insurerOptions) {
  const map = { ...pasteExtractParseGridPairs(text), ...pasteExtractParseLabelNextLine(text), ...pasteExtractParseLabeledLines(text), ...pasteExtractParseLabelPrefixLine(text) };
  const fields = {};
  const matched = [];

  const nameRaw = pasteExtractFindField(map, 'name');
  if (nameRaw) {
    const split = pasteExtractSplitName(nameRaw);
    fields.first_name = pasteExtractSentenceCase(split.first_name);
    fields.last_name = pasteExtractSentenceCase(split.last_name);
    matched.push('name');
  }

  const emailRaw = pasteExtractFindField(map, 'email');
  const emailFallback = String(text || '').match(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
  if (emailRaw || emailFallback) {
    fields.email = (emailRaw || emailFallback[0]).trim();
    matched.push('email');
  }

  const phoneRaw = pasteExtractFindField(map, 'phone');
  const phoneFallback = String(text || '').match(/(?:\+?61|0)[\s-]?[2-478][\s-]?\d{2,4}[\s-]?\d{3,4}[\s-]?\d{3}/);
  if (phoneRaw || phoneFallback) {
    fields.mobile = (phoneRaw || phoneFallback[0]).trim();
    matched.push('phone');
  }

  const addressRaw = pasteExtractFindField(map, 'address');
  if (addressRaw) {
    const split = pasteExtractSplitAddress(addressRaw);
    if (split) {
      fields.address = pasteExtractSentenceCase(split.address);
      fields.suburb = pasteExtractSentenceCase(split.suburb);
      fields.state = split.state;
      fields.postcode = split.postcode;
    } else {
      fields.address = pasteExtractSentenceCase(addressRaw);
    }
    matched.push('address');
  }
  const suburbRaw = pasteExtractFindField(map, 'suburb');
  if (suburbRaw) { fields.suburb = pasteExtractSentenceCase(pasteExtractStripLeadingDigitNoise(suburbRaw)); matched.push('suburb'); }
  const stateRaw = pasteExtractFindField(map, 'state');
  if (stateRaw) {
    const upper = stateRaw.trim().toUpperCase();
    if (PASTE_EXTRACT_STATES.includes(upper)) { fields.state = upper; matched.push('state'); }
  }
  const postcodeRaw = pasteExtractFindField(map, 'postcode');
  // require a state abbreviation right before the digits — a bare "\d{4}"
  // scan matches any 4-digit number in the text (assessment numbers, years
  // in a date…), not just postcodes
  const postcodeFallback = !fields.postcode &&
    String(text || '').match(new RegExp(`\\b(?:${PASTE_EXTRACT_STATES.join('|')})\\s+(\\d{4})\\b`, 'i'));
  if (postcodeRaw || postcodeFallback) {
    fields.postcode = postcodeRaw ? pasteExtractExtractPostcode(postcodeRaw) : postcodeFallback[1].trim();
    if (postcodeRaw) matched.push('postcode');
  }

  const claimRaw = pasteExtractFindField(map, 'claim_number');
  if (claimRaw) { fields.claim_number = claimRaw; matched.push('claim_number'); }

  const policyRaw = pasteExtractFindField(map, 'policy_ref');
  if (policyRaw) { fields.your_ref = policyRaw; matched.push('policy_ref'); }

  const respondByRaw = pasteExtractFindField(map, 'respond_by');
  if (respondByRaw) {
    fields.respond_by = pasteExtractParseDateToIso(respondByRaw) || respondByRaw;
    matched.push('respond_by');
  }

  const descriptionRaw = pasteExtractFindField(map, 'description');
  const specialInstructionsRaw = pasteExtractFindField(map, 'special_instructions');
  const commentParts = [descriptionRaw, specialInstructionsRaw].filter(Boolean);
  if (commentParts.length) {
    fields.comment = commentParts.join('\n\n');
    if (descriptionRaw) matched.push('description');
    if (specialInstructionsRaw) matched.push('special_instructions');
  }

  const excessRaw = pasteExtractFindField(map, 'excess');
  if (excessRaw) {
    const excessValue = pasteExtractParseCurrency(excessRaw);
    if (excessValue != null) { fields.excess_amount = excessValue; matched.push('excess'); }
  }

  const insurerRaw = pasteExtractFindField(map, 'insurer');
  const insurerId = pasteExtractMatchInsurer(insurerRaw || text, insurerOptions);
  if (insurerId) { fields.insurer_id = insurerId; matched.push('insurer'); }

  return { fields, matched };
}
