/* ============================================================================
   PASTE-EXTRACT — rule-based parser for text cut-and-pasted from an insurer's
   claims portal. No AI/API call: matches "Label: value" style lines against a
   synonym map per field, with a couple of whole-text regex fallbacks (email,
   phone, postcode) for portals that don't label those explicitly.

   Add new insurer wordings by extending the synonym arrays below — the
   parsing logic itself shouldn't need to change.
   ========================================================================== */

const PASTE_EXTRACT_LABELS = {
  name: ['name', 'claimant', 'claimant name', 'insured', 'insured name', 'customer', 'customer name', 'policy holder', 'policyholder', 'primary contact name', 'primary contact'],
  email: ['email', 'email address', 'e mail'],
  phone: ['phone', 'mobile', 'mobile number', 'phone number', 'contact number', 'contact phone', 'telephone', 'primary contact number'],
  address: ['address', 'risk address', 'property address', 'postal address', 'residential address', 'site address', 'property risk address'],
  suburb: ['suburb', 'city', 'town'],
  state: ['state'],
  postcode: ['postcode', 'post code', 'zip'],
  claim_number: ['claim number', 'claim no', 'claim no.', 'claim ref', 'claim reference', 'claim id', 'insurance ref', 'insurance ref #'],
  policy_ref: ['policy number', 'policy no', 'policy ref', 'policy reference', 'contents ref', 'contents ref #'],
  insurer: ['insurer', 'insurance company', 'underwriter', 'brand'],
};

const PASTE_EXTRACT_STATES = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'];

function pasteExtractNormalizeLabel(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
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

let pasteExtractSynonymSetCache = null;
function pasteExtractAllSynonymsNormalized() {
  if (pasteExtractSynonymSetCache) return pasteExtractSynonymSetCache;
  const set = new Set();
  Object.values(PASTE_EXTRACT_LABELS).forEach(arr => arr.forEach(s => set.add(pasteExtractNormalizeLabel(s))));
  pasteExtractSynonymSetCache = set;
  return set;
}

/* OCR'd dashboard screenshots (card layouts) usually put the label on its own
   line with the value directly beneath it, rather than "Label: value" on one
   line — this catches that shape as a fallback, lower-priority source. */
const PASTE_EXTRACT_ADDRESS_KEYS = new Set(
  PASTE_EXTRACT_LABELS.address.map(pasteExtractNormalizeLabel)
);

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
        const val = lines[j];
        if (!val) { if (collected.length) break; continue; }
        if (synonyms.has(pasteExtractNormalizeLabel(val))) break;
        collected.push(val);
      }
      if (collected.length) {
        map[norm] = collected.length > 1
          ? `${collected[0]}, ${collected.slice(1).join(' ')}`
          : collected[0];
      }
      continue;
    }

    for (let j = i + 1; j < lines.length; j++) {
      const val = lines[j];
      if (!val) continue;
      if (synonyms.has(pasteExtractNormalizeLabel(val))) break;
      map[norm] = val;
      break;
    }
  }
  return map;
}

function pasteExtractFindField(map, field) {
  for (const synonym of PASTE_EXTRACT_LABELS[field] || []) {
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
  const m = String(line || '').match(
    /^(.*?),?\s*([A-Za-z .'-]+?)\s+(NSW|VIC|QLD|SA|WA|TAS|NT|ACT)\s+(\d{4})\s*$/i
  );
  if (!m) return null;
  return {
    address: m[1].trim().replace(/,+$/, ''),
    suburb: m[2].trim(),
    state: m[3].toUpperCase(),
    postcode: m[4],
  };
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
  const map = { ...pasteExtractParseLabelNextLine(text), ...pasteExtractParseLabeledLines(text) };
  const fields = {};
  const matched = [];

  const nameRaw = pasteExtractFindField(map, 'name');
  if (nameRaw) {
    Object.assign(fields, pasteExtractSplitName(nameRaw));
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
      Object.assign(fields, split);
    } else {
      fields.address = addressRaw;
    }
    matched.push('address');
  }
  const suburbRaw = pasteExtractFindField(map, 'suburb');
  if (suburbRaw) { fields.suburb = suburbRaw; matched.push('suburb'); }
  const stateRaw = pasteExtractFindField(map, 'state');
  if (stateRaw) {
    const upper = stateRaw.trim().toUpperCase();
    if (PASTE_EXTRACT_STATES.includes(upper)) { fields.state = upper; matched.push('state'); }
  }
  const postcodeRaw = pasteExtractFindField(map, 'postcode');
  const postcodeFallback = !fields.postcode && String(text || '').match(/\b\d{4}\b/);
  if (postcodeRaw || postcodeFallback) {
    fields.postcode = (postcodeRaw || postcodeFallback[0]).trim();
    if (postcodeRaw) matched.push('postcode');
  }

  const claimRaw = pasteExtractFindField(map, 'claim_number');
  if (claimRaw) { fields.claim_number = claimRaw; matched.push('claim_number'); }

  const policyRaw = pasteExtractFindField(map, 'policy_ref');
  if (policyRaw) { fields.your_ref = policyRaw; matched.push('policy_ref'); }

  const insurerRaw = pasteExtractFindField(map, 'insurer');
  const insurerId = pasteExtractMatchInsurer(insurerRaw || text, insurerOptions);
  if (insurerId) { fields.insurer_id = insurerId; matched.push('insurer'); }

  return { fields, matched };
}
