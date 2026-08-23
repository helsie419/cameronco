/* ============================================================================
   CAMERON & CO — QUOTE ENTRY
   Talks to /api/* (Netlify Function → Postgres). If the API is unreachable
   (local file preview), it falls back to bundled lookup/rate defaults so the
   screen is fully explorable offline.
   ========================================================================== */

const API = '/api';

/* ------------------------- offline fallbacks ----------------------------- */
/* Mirrors seed.sql so the screen works before the DB is provisioned. */
const FALLBACK_LOOKUPS = {
  item_category: ['Earrings','Bangle','Brooch','Copy E/ring','Pendants','Repairs / replace stone','Rings','Watches','Necklace','Belt']
    .map(l => ({ code: slug(l), label: l })),
  item_type: ['Engagement ring','Wedding ring','Eternity ring','Dress ring','Signet ring','Watch','Bangle','Golf bangle','Bracelet','Padlock bracelet','Necklace','Necklace & pendant','Pendant','Locket','E/rings','Drop e/rings','Hoop e/rings','Stud e/rings','Pearl strand','Anklet','Tie pin / bar','Cufflinks','Brooch','Costume jewellery','Replace lost diamond','Replace (copy) lost e/ring','Extra item/s as advised','Unable to quote']
    .map(l => ({ code: slug(l), label: l })),
  metal_type: ['9ct','10ct','14ct','18ct','21ct','22ct','24ct','Platinum','18ct y/g with platinum setting','18ct w/g with platinum setting','Sterling silver','Stainless steel','Base metal','Gold plated base metal','Gold plated sterling silver','Not sure']
    .map(l => ({ code: slug(l), label: l })),
  metal_colour: ['Yellow gold','White gold','Rose gold','2 tone','3 tone'].map(l => ({ code: slug(l), label: l })),
  manufacture_origin: [['local','Local manufacture'],['imported','Imported'],['indian','Indian manufacture']]
    .map(([code,label]) => ({ code, label })),
  proof_type: ['Photo','Valuation','Description','Receipt','Statutory declaration','Warranty','Box','Existing ring','Existing earring','Nil']
    .map(l => ({ code: slug(l), label: l })),
  validation_type: ['Phone 1–5 items','Phone 6–10 items','Phone 11–20 items','Phone 21+ items','Face to face 1–5 items','Face to face 6–10 items','Face to face 11–20 items','Face to face 21+ items','Home 1–5 items','Home 6–10 items','Home 11–20 items','Home 21+ items']
    .map(l => ({ code: slug(l), label: l })),
  assessment_type: ['Assessment request','Quote request','Report','QBE quote request','Allianz quote request','Elders quote request','Crawford quote request','Cunningham & Lindsay quote request','IVAA quote request']
    .map(l => ({ code: slug(l), label: l })),
  stone_type: ['Diamond','Sapphire','Ruby','Emerald','Opal','Pearl','Amethyst','Topaz','Cubic zirconia','Other']
    .map(l => ({ code: slug(l), label: l })),
  stone_shape: ['RBC (round brilliant)','Princess','Oval','Emerald cut','Pear','Marquise','Cushion','Baguette','Heart','Cabochon']
    .map(l => ({ code: slug(l), label: l })),
  stone_quality: ['D/IF','F/VS','G/VS','G/SI','H/SI','I/SI','J/P1','Commercial']
    .map(l => ({ code: slug(l), label: l })),
};

const FALLBACK_RATES = [
  { code:'CHAIN_9CT_LOCAL', label:'Chain 9ct local', category:'chain_per_gm', rate:115 },
  { code:'CHAIN_9CT_IMPORTED', label:'Chain 9ct imported', category:'chain_per_gm', rate:145 },
  { code:'CHAIN_14CT_LOCAL', label:'Chain 14ct local', category:'chain_per_gm', rate:220 },
  { code:'CHAIN_14CT_IMPORTED', label:'Chain 14ct imported', category:'chain_per_gm', rate:235 },
  { code:'CHAIN_18CT_LOCAL', label:'Chain 18ct local', category:'chain_per_gm', rate:260 },
  { code:'CHAIN_18CT_IMPORTED', label:'Chain 18ct imported', category:'chain_per_gm', rate:300 },
  { code:'EARR_9CT_IMPORTED', label:'Earring/charm 9ct imported', category:'earring_charm_per_gm', rate:145 },
  { code:'EARR_18CT_IMPORTED', label:'Earring/charm 18ct imported', category:'earring_charm_per_gm', rate:300 },
  { code:'EARR_22CT_IMPORTED', label:'Earring/charm 21–22ct imported', category:'earring_charm_per_gm', rate:260 },
  { code:'MFG_GOLD_9CT', label:'Manufacturing gold 9ct', category:'mfg_gold_per_gm', rate:45 },
  { code:'MFG_GOLD_18CT', label:'Manufacturing gold 18ct', category:'mfg_gold_per_gm', rate:100 },
  { code:'SETTING_GRAIN', label:'Setting — grain', category:'setting_per_stone', rate:4 },
  { code:'SETTING_PAVE', label:'Setting — pavé', category:'setting_per_stone', rate:6 },
  { code:'SETTING_CLAW', label:'Setting — claw', category:'setting_per_stone', rate:8 },
  { code:'SETTING_SMALL', label:'Setting — small stone point', category:'setting_per_stone', rate:13 },
  { code:'SETTING_MID', label:'Setting — mid-size stone', category:'setting_per_stone', rate:20 },
  { code:'SETTING_LARGE', label:'Setting — large stone (up to 1ct)', category:'setting_per_stone', rate:40 },
  { code:'CASTING', label:'Casting', category:'casting', rate:5 },
  { code:'LABOUR', label:'Labour per hour', category:'labour_per_hr', rate:65 },
  { code:'BOX_VALUATION', label:'Box & valuation', category:'box_valuation', rate:26 },
  { code:'RETAIL_MARKUP', label:'Retail markup', category:'markup', rate:2.75 },
];

/* Mirrors seed.sql's watch_brand_rates — insurer_id null = "Shop Sales"
   (retail/non-insurance) default. Ids 4/6 match the offline insurer
   fallback below (Suncorp Metway / Allianz), for offline preview only. */
const FALLBACK_WATCH_RATES = [
  { brand:'Rolex', insurer_id:4, rate_type:'discount_pct', rate_value:0.05, insurer_name:'Suncorp Metway' },
  { brand:'Rolex', insurer_id:6, rate_type:'poa', rate_value:null, insurer_name:'Allianz' },
  { brand:'Rolex', insurer_id:null, rate_type:'poa', rate_value:null, insurer_name:null },
  { brand:'Omega', insurer_id:4, rate_type:'discount_pct', rate_value:0.22, insurer_name:'Suncorp Metway' },
  { brand:'Omega', insurer_id:6, rate_type:'discount_pct', rate_value:0.15, insurer_name:'Allianz' },
  { brand:'Omega', insurer_id:null, rate_type:'discount_pct', rate_value:0.10, insurer_name:null },
  { brand:'Tag Heuer', insurer_id:4, rate_type:'discount_pct', rate_value:0.26, insurer_name:'Suncorp Metway' },
  { brand:'Tag Heuer', insurer_id:6, rate_type:'discount_pct', rate_value:0.26, insurer_name:'Allianz' },
  { brand:'Tag Heuer', insurer_id:null, rate_type:'discount_pct', rate_value:0.25, insurer_name:null },
  { brand:'Citizen', insurer_id:4, rate_type:'discount_pct', rate_value:0.40, insurer_name:'Suncorp Metway' },
  { brand:'Citizen', insurer_id:6, rate_type:'discount_pct', rate_value:0.35, insurer_name:'Allianz' },
  { brand:'Citizen', insurer_id:null, rate_type:'discount_pct', rate_value:0.30, insurer_name:null },
  { brand:'Seiko', insurer_id:4, rate_type:'discount_pct', rate_value:0.40, insurer_name:'Suncorp Metway' },
  { brand:'Seiko', insurer_id:6, rate_type:'discount_pct', rate_value:0.35, insurer_name:'Allianz' },
  { brand:'Seiko', insurer_id:null, rate_type:'discount_pct', rate_value:0.30, insurer_name:null },
  { brand:'Casio', insurer_id:4, rate_type:'discount_pct', rate_value:0.36, insurer_name:'Suncorp Metway' },
  { brand:'Casio', insurer_id:6, rate_type:'discount_pct', rate_value:0.33, insurer_name:'Allianz' },
  { brand:'Casio', insurer_id:null, rate_type:'discount_pct', rate_value:0.30, insurer_name:null },
];

/* Mirrors seed.sql's staff table — used only if /api/staff is unreachable. */
const FALLBACK_STAFF = [
  { id:1, full_name:'Tracey' }, { id:2, full_name:'April' },
  { id:3, full_name:'Workshop' }, { id:4, full_name:'Admin' },
];

/* ------------------------------- state ----------------------------------- */
let LOOKUPS = FALLBACK_LOOKUPS;
let RATES = indexRates(FALLBACK_RATES);
let SPOT = [];
let WATCH_RATES = [];
let STAFF = FALLBACK_STAFF;
let selectedCustomerId = null;
let apiAvailable = true;
let claimId = new URLSearchParams(location.search).get('claim');
let prefillCustomerId = new URLSearchParams(location.search).get('customer');
let customerMode = 'none'; // 'none' | 'existing' | 'new-pending' | 'new-confirmed'

function slug(s){ return s.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,''); }
function indexRates(list){ const m = {}; for (const r of list) m[r.code] = r; m._all = list; return m; }
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];
const fmt = n => '$' + (Number(n)||0).toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const num = v => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };

const CATEGORY_ITEM_TYPE_RULES = {
  earrings: ['e rings', 'erings', 'earring', 'drop e rings', 'hoop e rings', 'stud e rings', 'copy lost e ring'],
  bangle: ['bangle', 'golf bangle'],
  brooch: ['brooch'],
  copy_e_ring: ['e rings', 'erings', 'earring', 'drop e rings', 'hoop e rings', 'stud e rings', 'copy lost e ring'],
  pendants: ['pendant', 'necklace and pendant', 'locket'],
  repairs_replace_stone: ['replace lost diamond', 'repair', 'replace stone'],
  rings: ['engagement ring', 'wedding ring', 'eternity ring', 'dress ring', 'signet ring'],
  watches: ['watch'],
  necklace: ['necklace', 'necklace and pendant', 'pearl strand'],
  belt: ['belt'],
  blet: ['belt'],
  bracelet: ['bracelet', 'padlock bracelet'],
};
const UNIVERSAL_ITEM_TYPE_TERMS = ['extra item', 'unable to quote'];

/* ------------------------------- init ------------------------------------ */
init();
async function init(){
  await loadReferenceData();
  fillStaticSelects();
  wireCustomerSearch();
  wireDuplicateCheck();
  wirePasteExtract();
  wireAddressTidy();
  wireSettlement();
  setGateLocked(true);
  $('#dateReceived').value = new Date().toISOString().slice(0,10);
  $('#addItem').addEventListener('click', () => addItem());
  $('#saveDraft').addEventListener('click', () => save('draft'));
  $('#generateQuote').addEventListener('click', () => save('generate'));
  if (claimId) await loadClaim(claimId);
  else if (prefillCustomerId) await loadPrefillCustomer(prefillCustomerId);
  else addItem();
  recalcTotals();
}

async function loadPrefillCustomer(id){
  addItem();
  if (!apiAvailable) return;
  try {
    const c = await fetch(`${API}/customers/${id}`).then(r => r.json());
    if (c.error) throw new Error(c.error);
    pickCustomer(c);
  } catch (err) {
    toast('Could not load customer: ' + err.message, true);
  }
}

/* ------------------------------ customer gate ----------------------------- */
function setGateLocked(locked){
  $$('.panel.gated').forEach(p => {
    p.classList.toggle('locked', locked);
    $$('input,select,textarea,button', p).forEach(el => { el.disabled = locked; });
  });
  $('#saveDraft').disabled = locked;
  $('#generateQuote').disabled = locked;
  if (!locked) updateClaimNumberField();
}

// Claim number only means anything for insurer work — private jobs don't
// have one, so the field is greyed out and mirrors the internal reference
// instead of asking staff to invent a placeholder value.
function updateClaimNumberField(){
  const field = $('#claimNumber');
  const hasInsurer = !!$('#insurerId').value;
  field.disabled = !hasInsurer;
  field.placeholder = hasInsurer ? "Insurer's claim no." : 'Private job — not applicable';
  if (!hasInsurer && !field.value.trim()) field.value = $('#ourRef').value || '';
}

async function loadReferenceData(){
  try {
    const [lk, rt, ins, wr, st] = await Promise.all([
      fetch(`${API}/lookups`).then(r => r.ok ? r.json() : Promise.reject()),
      fetch(`${API}/rates`).then(r => r.ok ? r.json() : Promise.reject()),
      fetch(`${API}/insurers`).then(r => r.ok ? r.json() : Promise.reject()),
      fetch(`${API}/rate-admin/watch-rates`).then(r => r.ok ? r.json() : Promise.reject()),
      fetch(`${API}/staff`).then(r => r.ok ? r.json() : Promise.reject()),
    ]);
    LOOKUPS = { ...FALLBACK_LOOKUPS, ...lk };
    RATES = indexRates(rt.rates?.length ? rt.rates : FALLBACK_RATES);
    SPOT = rt.spot || [];
    WATCH_RATES = wr?.length ? wr : FALLBACK_WATCH_RATES;
    STAFF = st?.length ? st : FALLBACK_STAFF;
    fillInsurers(ins);
    renderSpot();
  } catch {
    apiAvailable = false;
    WATCH_RATES = FALLBACK_WATCH_RATES;
    STAFF = FALLBACK_STAFF;
    fillInsurers([
      { id:'', name:'AAMI Home Claims' }, { id:'', name:'QBE' }, { id:'', name:'Vero' },
      { id:'', name:'Suncorp Metway' }, { id:'', name:'GIO Insurance' }, { id:'', name:'Allianz' },
    ].map((x,i)=>({ ...x, id:i+1, contacts:[] })));
    toast('Working offline — API not reachable. Data will not be saved.', true);
  }
}

function renderSpot(){
  const find = m => SPOT.find(s => s.metal === m);
  const g = find('gold'), s = find('silver'), p = find('platinum');
  if (g) $('#spotGold').textContent = fmt(g.price_per_gm) + '/g';
  if (s) $('#spotSilver').textContent = fmt(s.price_per_gm) + '/g';
  if (p) $('#spotPlat').textContent = fmt(p.price_per_gm) + '/g';
}

function fillInsurers(list){
  const sel = $('#insurerId');
  for (const i of list) {
    const o = document.createElement('option');
    o.value = i.id; o.textContent = smartTitleCase(i.name); o.dataset.contacts = JSON.stringify(i.contacts || []);
    sel.appendChild(o);
  }
  sel.addEventListener('change', () => {
    const contacts = JSON.parse(sel.selectedOptions[0]?.dataset.contacts || '[]');
    const c = $('#insurerContactId');
    c.innerHTML = '<option value="">—</option>';
    c.disabled = !contacts.length;
    if (sel.value && !contacts.length) {
      const o = document.createElement('option');
      o.value = '';
      o.textContent = 'No contacts on file';
      c.appendChild(o);
      c.value = '';
      return;
    }
    for (const ct of contacts) {
      const o = document.createElement('option');
      o.value = ct.id; o.textContent = smartTitleCase(ct.name);
      c.appendChild(o);
    }
  });
  // insurer drives which watch_brand_rates row applies — refresh every item
  sel.addEventListener('change', () => $$('[data-item]').forEach(updateWatchDiscount));
  sel.addEventListener('change', updateClaimNumberField);
}

function fillLookup(select){
  const domain = select.dataset.lookup;
  const values = valuesForLookup(domain);
  const current = select.value;
  select.innerHTML = '<option value="">—</option>';
  for (const v of values) {
    const o = document.createElement('option');
    o.value = v.code; o.textContent = v.label;
    select.appendChild(o);
  }
  if (current) select.value = current;
}

function valuesForLookup(domain){
  const seen = new Set();
  const rows = LOOKUPS[domain] || [];
  return rows
    .map(row => ({ ...row, label: cleanLookupLabel(domain, row.label) }))
    .filter(row => !shouldHideLookupValue(domain, row))
    .filter(row => {
      const key = canonicalLookupKey(domain, row);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function cleanLookupLabel(domain, label){
  let clean = String(label || '').trim().replace(/^\((.*)\)$/, '$1').replace(/\s+/g, ' ');
  if (domain === 'item_category') {
    const normal = normaliseLookupText(clean);
    if (normal === 'blet') return 'Belt';
    if (normal === 'copy e ring') return 'Copy E/ring';
    if (normal === 'repairs replace stone') return 'Repairs / replace stone';
  }
  if (domain === 'manufacture_origin') {
    if (/local/i.test(clean)) return 'Local manufacture';
    if (/import/i.test(clean)) return 'Imported';
    if (/indian/i.test(clean)) return 'Indian manufacture';
  }
  return smartTitleCase(clean);
}

function smartTitleCase(value){
  const keepUpper = new Set(['AAMI', 'AMP', 'APIA', 'CAD', 'CL', 'CM', 'DCLA', 'EOO', 'EOL', 'GIA', 'GIO', 'GSL', 'HRD', 'IGI', 'IVAA', 'MYI', 'NSW', 'POA', 'QBE', 'RBC', 'RRP', 'SMS', 'VIC']);
  const keepLower = new Set(['and', 'as', 'at', 'by', 'for', 'from', 'in', 'of', 'off', 'on', 'or', 'per', 'the', 'to', 'with']);
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((word, index) => {
      const parts = word.split(/([/&-])/);
      return parts.map(part => {
        if (!part || /[\/&-]/.test(part)) return part;
        const plain = part.replace(/[^a-z0-9]/gi, '');
        const upper = plain.toUpperCase();
        if (keepUpper.has(upper)) return part.replace(plain, upper);
        const lower = plain.toLowerCase();
        if (index > 0 && keepLower.has(lower)) return part.replace(plain, lower);
        if (/^\d+(ct|gm|gms|mm|cm)$/i.test(plain)) return part.replace(plain, lower);
        if (/^e$/i.test(plain)) return part.replace(plain, 'e');
        return part.replace(plain, lower.charAt(0).toUpperCase() + lower.slice(1));
      }).join('');
    })
    .join(' ')
    .replace(/\bW\/g\b/gi, 'w/g')
    .replace(/\bY\/g\b/gi, 'y/g')
    .replace(/\bR\/?Ring\b/gi, 'Ring')
    .replace(/\bE\/Ring\b/gi, 'E/ring')
    .replace(/\bE\/Rings\b/gi, 'E/rings');
}

function shouldHideLookupValue(domain, row){
  if (domain === 'stone_type' && String(row.label || '').includes('&')) return true;
  return false;
}

function canonicalLookupKey(domain, row){
  const text = normaliseLookupText(row.label || row.code);
  if (domain === 'item_category') {
    if (text === 'blet') return 'belt';
    if (text === 'copy e ring') return 'copy_e_ring';
    if (text === 'repairs replace stone') return 'repairs_replace_stone';
  }
  if (domain === 'manufacture_origin') {
    if (text.includes('local')) return 'local';
    if (text.includes('import')) return 'imported';
    if (text.includes('indian')) return 'indian';
  }
  return text;
}

function normaliseLookupText(value){
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function lookupText(row){
  return normaliseLookupText(`${row?.label || ''} ${row?.code || ''}`);
}

function selectedLookupText(select){
  return normaliseLookupText(`${select.value || ''} ${select.selectedOptions[0]?.textContent || ''}`);
}

function categoryRuleKey(categoryText){
  if (!categoryText) return '';
  if (categoryText.includes('copy') && categoryText.includes('e ring')) return 'copy_e_ring';
  if (categoryText.includes('copy') && categoryText.includes('ering')) return 'copy_e_ring';
  if (categoryText.includes('earring') || categoryText.includes('e ring') || categoryText.includes('ering')) return 'earrings';
  if (categoryText.includes('repair') || categoryText.includes('replace stone')) return 'repairs_replace_stone';
  if (categoryText.includes('bangle')) return 'bangle';
  if (categoryText.includes('bracelet')) return 'bracelet';
  if (categoryText.includes('brooch')) return 'brooch';
  if (categoryText.includes('pendant')) return 'pendants';
  if (categoryText.includes('watch')) return 'watches';
  if (categoryText.includes('necklace')) return 'necklace';
  if (categoryText.includes('belt') || categoryText.includes('blet')) return 'belt';
  if (categoryText.includes('ring')) return 'rings';
  return '';
}

function itemTypeMatches(row, terms){
  const text = lookupText(row);
  return terms.some(term => text.includes(normaliseLookupText(term)));
}

function itemTypeOptionsForCategory(card){
  const values = valuesForLookup('item_type');
  const categorySelect = card.querySelector('[data-f="category"]');
  const ruleKey = categoryRuleKey(selectedLookupText(categorySelect));
  if (!ruleKey) return values;
  const terms = CATEGORY_ITEM_TYPE_RULES[ruleKey] || [];
  const filtered = values.filter(row =>
    itemTypeLinkedToCategory(row, ruleKey) ||
    itemTypeMatches(row, terms) || itemTypeMatches(row, UNIVERSAL_ITEM_TYPE_TERMS));
  return filtered.length ? filtered : values;
}

function itemTypeLinkedToCategory(row, ruleKey){
  const linked = row?.extra?.category || row?.extra?.item_category;
  if (!linked) return false;
  return categoryRuleKey(normaliseLookupText(linked)) === ruleKey || normaliseLookupText(linked) === ruleKey;
}

function fillItemTypeSelect(card, { keepCurrent = true } = {}){
  const select = card.querySelector('[data-f="item_type"]');
  const current = select.value;
  const values = itemTypeOptionsForCategory(card);
  select.innerHTML = '<option value="">—</option>';
  for (const v of values) {
    const o = document.createElement('option');
    o.value = v.code;
    o.textContent = v.label;
    select.appendChild(o);
  }

  if (!current) return;
  const hasCurrent = values.some(v => String(v.code) === String(current));
  if (hasCurrent) {
    select.value = current;
    return;
  }
  if (!keepCurrent) {
    select.value = '';
    return;
  }

  const saved = (LOOKUPS.item_type || []).find(v => String(v.code) === String(current));
  const option = document.createElement('option');
  option.value = current;
  option.textContent = saved?.label || current;
  select.appendChild(option);
  select.value = current;
}

function fillStaticSelects(){
  $$('select[data-lookup]').forEach(fillLookup);
  const sel = $('#assignedTo');
  for (const s of STAFF) {
    const o = document.createElement('option');
    o.value = s.id; o.textContent = s.full_name;
    sel.appendChild(o);
  }
}

/* --------------------------- customer search ----------------------------- */
function wireCustomerSearch(){
  const input = $('#customerSearch');
  const results = $('#customerResults');
  let t;
  input.addEventListener('input', () => {
    clearTimeout(t);
    const q = input.value.trim();
    if (q.length < 2) { results.hidden = true; return; }
    t = setTimeout(async () => {
      let rows = [];
      if (apiAvailable) {
        try { rows = await fetch(`${API}/customers?q=${encodeURIComponent(q)}`).then(r => r.json()); }
        catch { rows = []; }
      }
      results.innerHTML = '';
      for (const c of rows) {
        const d = document.createElement('div');
        const phone = c.mobile || c.phone;
        d.innerHTML = `<strong>${c.first_name} ${c.last_name}</strong>
          <small>${[c.email, phone ? phoneLinkHtml(phone) : '', c.suburb].filter(Boolean).join(' · ')}</small>`;
        d.addEventListener('click', (e) => { if (!e.target.closest('.phone-link')) pickCustomer(c); });
        results.appendChild(d);
      }
      const add = document.createElement('div');
      add.className = 'new-entry';
      add.textContent = `＋ New customer “${q}”`;
      add.addEventListener('click', () => { newCustomerFromSearch(q); });
      results.appendChild(add);
      results.hidden = false;
    }, 250);
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('.lookup-wrap')) results.hidden = true;
  });
  $('#clearCustomer').addEventListener('click', () => {
    selectedCustomerId = null;
    customerMode = 'none';
    ['custFirst','custLast','custEmail','custMobile','custAddress','custSuburb','custPostcode']
      .forEach(id => $('#'+id).value = '');
    $('#customerSearch').value = '';
    $('#customerConfirmRow').hidden = true;
    hideDuplicateWarning();
    setCustomerBadge();
    setGateLocked(true);
  });
  $('#confirmCustomer').addEventListener('click', () => {
    if (!$('#custFirst').value.trim()) { toast('Enter at least a first name', true); return; }
    if (!validateAddress()) { toast('Check the address — street, suburb and postcode go together', true); return; }
    customerMode = 'new-confirmed';
    $('#customerConfirmRow').hidden = true;
    setCustomerBadge('New customer — will be created on save');
    setGateLocked(false);
  });
}

function pickCustomer(c){
  selectedCustomerId = c.id;
  customerMode = 'existing';
  $('#custFirst').value = c.first_name || '';
  $('#custLast').value = c.last_name || '';
  $('#custEmail').value = c.email || '';
  $('#custMobile').value = c.mobile || c.phone || '';
  $('#custAddress').value = c.address_line1 || '';
  $('#custSuburb').value = c.suburb || '';
  $('#custState').value = c.state || 'VIC';
  $('#custPostcode').value = c.postcode || '';
  $('#customerResults').hidden = true;
  $('#customerSearch').value = `${c.first_name} ${c.last_name}`;
  $('#customerConfirmRow').hidden = true;
  hideDuplicateWarning();
  setCustomerBadge('Existing customer');
  setGateLocked(false);
}

function newCustomerFromSearch(q){
  selectedCustomerId = null;
  customerMode = 'new-pending';
  const parts = q.split(/\s+/);
  $('#custFirst').value = parts[0] || '';
  $('#custLast').value = parts.slice(1).join(' ');
  $('#customerResults').hidden = true;
  $('#customerConfirmRow').hidden = false;
  setCustomerBadge('New customer — fill in details, then continue');
  setGateLocked(true);
  $('#custEmail').focus();
  checkDuplicateCustomer();
}

function setCustomerBadge(text){
  const b = $('#customerBadge');
  if (text) { b.textContent = text; b.className = 'badge gold'; }
  else { b.textContent = 'No customer selected'; b.className = 'badge'; }
}

/* --------------------------- duplicate warning ---------------------------- */
let duplicateMatch = null;

function normalizeMatchText(s){
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

async function checkDuplicateCustomer(){
  if (customerMode === 'existing' || !apiAvailable) { hideDuplicateWarning(); return; }
  const first = $('#custFirst').value.trim();
  const last = $('#custLast').value.trim();
  const q = [first, last].filter(Boolean).join(' ');
  if (q.length < 3) { hideDuplicateWarning(); return; }
  let rows = [];
  try { rows = await fetch(`${API}/customers?q=${encodeURIComponent(q)}`).then(r => r.json()); }
  catch { rows = []; }
  const wantName = normalizeMatchText(`${first} ${last}`);
  const wantAddr = normalizeMatchText($('#custAddress').value);
  const match = (rows || []).find(c => {
    if (normalizeMatchText(`${c.first_name} ${c.last_name}`) !== wantName) return false;
    if (!wantAddr) return true;
    return normalizeMatchText(c.address_line1 || '') === wantAddr;
  });
  if (match) showDuplicateWarning(match); else hideDuplicateWarning();
}

function showDuplicateWarning(c){
  duplicateMatch = c;
  $('#duplicateWarningName').textContent = `${c.first_name} ${c.last_name}`;
  $('#duplicateWarningAddress').textContent =
    [c.address_line1, c.suburb, c.state, c.postcode].filter(Boolean).join(', ') || 'No address on file';
  $('#duplicateWarning').hidden = false;
}

function hideDuplicateWarning(){
  duplicateMatch = null;
  $('#duplicateWarning').hidden = true;
}

function wireDuplicateCheck(){
  ['custLast', 'custAddress'].forEach(id => {
    $('#' + id).addEventListener('blur', () => {
      if (customerMode === 'new-pending' || customerMode === 'new-confirmed') checkDuplicateCustomer();
    });
  });
  $('#duplicateWarningUse').addEventListener('click', () => {
    if (duplicateMatch) pickCustomer(duplicateMatch);
    else hideDuplicateWarning();
  });
  $('#duplicateWarningDismiss').addEventListener('click', hideDuplicateWarning);
}

/* --------------------------- paste extraction ------------------------------ */
function setExtractBusy(isBusy){
  $('#pasteExtractButton').disabled = isBusy;
  $('#pasteExtractSpinner').hidden = !isBusy;
}

function runPasteExtraction(){
  const text = $('#pasteExtractInput').value;
  if (!text.trim()) { toast('Paste some text first', true); return; }
  const insurerOptions = $$('#insurerId option')
    .filter(o => o.value)
    .map(o => ({ id: o.value, name: o.textContent }));
  const { fields, matched } = parsePastedInsurerText(text, insurerOptions);
  applyExtractedFields(fields);
  $('#pasteExtractSummary').textContent = matched.length
    ? `Matched: ${matched.join(', ')} — check the rest before saving`
    : 'No fields recognised — check the format and fill in manually';
  checkDuplicateCustomer();
}

// Parsing itself is instant (no API call), but the spinner is the whole
// point here — give it a beat on screen instead of flashing invisibly.
function runPasteExtractionWithSpinner(){
  if (!$('#pasteExtractInput').value.trim()) { toast('Paste some text first', true); return; }
  setExtractBusy(true);
  setTimeout(() => {
    try { runPasteExtraction(); } finally { setExtractBusy(false); }
  }, 150);
}

async function runOcrOnImage(imageFile){
  if (!imageFile) return;
  const summary = $('#pasteExtractSummary');
  const input = $('#pasteExtractInput');
  setExtractBusy(true);
  summary.textContent = 'Reading screenshot… 0%';
  try {
    const text = await ocrExtractImageToText(imageFile, (fraction) => {
      summary.textContent = `Reading screenshot… ${Math.round(fraction * 100)}%`;
    });
    if (!text.trim()) {
      summary.textContent = 'Could not read any text from that screenshot — try a clearer crop or paste the text instead';
      return;
    }
    input.value = input.value.trim() ? `${input.value.trim()}\n${text.trim()}` : text.trim();
    runPasteExtraction();
  } catch (err) {
    summary.textContent = err.message || 'Could not read that screenshot';
    toast(err.message || 'OCR failed', true);
  } finally {
    setExtractBusy(false);
  }
}

function wirePasteExtract(){
  $('#pasteExtractButton').addEventListener('click', runPasteExtractionWithSpinner);

  $('#pasteExtractInput').addEventListener('paste', (e) => {
    const imageFile = ocrExtractFindImageItem(e.clipboardData);
    if (!imageFile) return; // let normal text paste happen
    e.preventDefault();
    runOcrOnImage(imageFile);
  });

  $('#ocrUploadButton').addEventListener('click', () => $('#ocrUploadInput').click());
  $('#ocrUploadInput').addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (file) runOcrOnImage(file);
  });
}

function applyExtractedFields(fields){
  // Any one of these is enough to treat this as "a customer was found" —
  // requiring a name specifically meant a paste that only OCR'd cleanly
  // enough to catch an email/phone/address left the claim panel locked
  // with no way forward and no visible reason why.
  const hasCustomerSignal = fields.first_name || fields.last_name || fields.email || fields.mobile || fields.address;
  if (hasCustomerSignal) {
    selectedCustomerId = null;
    customerMode = 'new-pending';
    $('#customerConfirmRow').hidden = false;
    setCustomerBadge('New customer — fill in details, then continue');
    setGateLocked(true);
  }
  if (fields.first_name) $('#custFirst').value = fields.first_name;
  if (fields.last_name) $('#custLast').value = fields.last_name;
  if (fields.email) $('#custEmail').value = fields.email;
  if (fields.mobile) $('#custMobile').value = fields.mobile;
  if (fields.address) $('#custAddress').value = fields.address;
  if (fields.suburb) $('#custSuburb').value = fields.suburb;
  if (fields.state) $('#custState').value = fields.state;
  if (fields.postcode) $('#custPostcode').value = fields.postcode;
  if (fields.claim_number) $('#claimNumber').value = fields.claim_number;
  if (fields.your_ref) $('#yourRef').value = fields.your_ref;
  if (fields.respond_by) $('#respondBy').value = fields.respond_by;
  if (fields.excess_amount != null) $('#excessAmount').value = fields.excess_amount;
  if (fields.description) {
    const firstItemDescription = $('[data-item] [data-f="description"]');
    if (firstItemDescription) firstItemDescription.value = fields.description;
  }
  if (fields.insurer_id) {
    $('#insurerId').value = fields.insurer_id;
    $('#insurerId').dispatchEvent(new Event('change'));
  }
}

/* ------------------------------ address tidy ------------------------------ */
/* No autocomplete API — just keeps the fields consistent: postcode digits
   only, trimmed text, and street/suburb/postcode entered as a set. */
function wireAddressTidy(){
  const postcode = $('#custPostcode');
  postcode.addEventListener('input', () => {
    postcode.value = postcode.value.replace(/\D/g, '').slice(0, 4);
  });
  ['custAddress', 'custSuburb'].forEach(id => {
    const el = $('#'+id);
    el.addEventListener('blur', () => { el.value = el.value.trim().replace(/\s+/g, ' '); });
  });
}

function validateAddress(){
  const addr = $('#custAddress').value.trim();
  const suburb = $('#custSuburb').value.trim();
  const postcode = $('#custPostcode').value.trim();
  const anyFilled = addr || suburb || postcode;
  const allFilled = addr && suburb && postcode;
  const postcodeOk = !postcode || /^\d{4}$/.test(postcode);
  const ok = !anyFilled || (allFilled && postcodeOk);
  $('#addressHint').hidden = ok;
  return ok;
}

/* -------------------------------- items ---------------------------------- */
function addItem(data){
  const tpl = $('#itemTemplate').content.cloneNode(true);
  const card = tpl.querySelector('[data-item]');
  $('#itemsContainer').appendChild(tpl);
  $$('select[data-lookup]', card).forEach(select => {
    if (select.dataset.f !== 'item_type') fillLookup(select);
  });
  fillItemTypeSelect(card);
  fillChainRateSelect(card);
  fillSettingTierSelect(card);
  wireFileInputs(card);

  card.querySelector('[data-toggle]').addEventListener('click', e => {
    if (e.target.closest('button, input, select')) return;
    card.classList.toggle('collapsed');
  });
  card.querySelector('[data-remove]').addEventListener('click', () => {
    if ($$('[data-item]').length === 1) { toast('A claim needs at least one item', true); return; }
    card.remove(); renumber(); recalcTotals();
  });
  card.querySelector('[data-add-stone]').addEventListener('click', () => addStone(card));
  wireItemStockCheck(card);

  // recalc on any input
  card.addEventListener('input', e => {
    if (e.target.matches('[data-s], [data-calc], [data-f]')) itemChanged(card, e.target);
  });
  card.addEventListener('change', e => {
    if (e.target.matches('[data-f="category"]')) fillItemTypeSelect(card, { keepCurrent: false });
    if (e.target.matches('select')) itemChanged(card, e.target);
  });

  addStone(card);
  if (data) hydrateItem(card, data);
  renumber();
  itemChanged(card);
  return card;
}

function fillChainRateSelect(card){
  const sel = card.querySelector('[data-calc="chainRate"]');
  const list = (RATES._all || []).filter(r =>
    r.category === 'chain_per_gm' || r.category === 'earring_charm_per_gm');
  for (const r of list) {
    const o = document.createElement('option');
    o.value = r.code; o.textContent = `${r.label} — $${r.rate}/gm`;
    sel.appendChild(o);
  }
}

function fillSettingTierSelect(card){
  const sel = card.querySelector('[data-calc="settingTier"]');
  const list = (RATES._all || []).filter(r => r.category === 'setting_per_stone');
  for (const r of list) {
    const o = document.createElement('option');
    o.value = r.code; o.textContent = `${r.label} — $${r.rate}/pc`;
    sel.appendChild(o);
  }
}

function addStone(card, data){
  const tpl = $('#stoneRowTemplate').content.cloneNode(true);
  const row = tpl.querySelector('[data-stone]');
  card.querySelector('[data-stones]').appendChild(tpl);
  $$('select[data-lookup]', row).forEach(fillLookup);
  row.querySelector('[data-remove-stone]').addEventListener('click', () => {
    row.remove(); itemChanged(card);
  });
  wireStoneStockCheck(row);
  if (data) for (const [k,v] of Object.entries(data)) {
    const el = row.querySelector(`[data-s="${k}"]`);
    if (el && v != null) el.value = v;
  }
  if (data) refreshStoneStock(row);
  return row;
}

function renumber(){
  $$('[data-item]').forEach((card, i) => {
    card.querySelector('[data-item-no]').textContent = i + 1;
    card.dataset.itemNo = i + 1;
  });
}

function wireFileInputs(card){
  $$('input[type="file"][data-file]', card).forEach(input => {
    input.addEventListener('change', () => renderFilePreview(card, input));
  });
}

function renderFilePreview(card, input){
  const list = card.querySelector(`[data-file-preview="${input.dataset.file}"]`);
  if (!list) return;
  list.innerHTML = '';
  for (const file of input.files || []) {
    const item = document.createElement('div');
    item.className = 'upload-chip';
    if (file.type.startsWith('image/')) {
      const img = document.createElement('img');
      img.src = URL.createObjectURL(file);
      img.alt = file.name;
      item.appendChild(img);
    } else {
      const icon = document.createElement('span');
      icon.className = 'file-icon';
      icon.textContent = 'PDF';
      item.appendChild(icon);
    }
    const name = document.createElement('span');
    name.textContent = file.name;
    item.appendChild(name);
    list.appendChild(item);
  }
}

function collectFileMetadata(card){
  return $$('input[type="file"][data-file]', card).flatMap(input =>
    [...(input.files || [])].map(file => ({
      type: input.dataset.file,
      name: file.name,
      mime_type: file.type,
      size: file.size,
    })));
}

/* -------------------------------- stock hints ------------------------------ */
/* Purely informational — checks /api/stock/match for a loose stone, metal, or
   ring mount matching what's being typed into this item, so an assessor can
   see whether it's already on hand or needs ordering. Never changes stock
   quantities and never affects pricing/calculations. */
async function stockMatch(params){
  if (!apiAvailable) return [];
  try {
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(`${API}/stock/match?${qs}`);
    return res.ok ? await res.json() : [];
  } catch { return []; }
}

function scheduleStockCheck(el, fn){
  clearTimeout(el._stockTimer);
  el._stockTimer = setTimeout(fn, 350);
}

async function refreshStoneStock(row){
  const hint = row.querySelector('[data-stock-hint]');
  if (!hint) return;
  const stoneType = row.querySelector('[data-s="stone_type"]').value;
  if (!stoneType) { hint.innerHTML = ''; return; }
  const params = { category: 'stone', stone_type: stoneType };
  const shape = row.querySelector('[data-s="shape"]').value;
  const quality = row.querySelector('[data-s="quality"]').value;
  const carat = row.querySelector('[data-s="carat_each"]').value;
  if (shape) params.shape = shape;
  if (quality) params.quality = quality;
  if (carat) params.carat = carat;

  const matches = await stockMatch(params);
  const total = matches.reduce((sum, m) => sum + Number(m.quantity), 0);
  hint.innerHTML = total > 0
    ? `<span class="badge ok">${total} in stock</span>`
    : `<span class="badge warn">Order needed</span>`;
}

function wireStoneStockCheck(row){
  $$('[data-s="stone_type"], [data-s="shape"], [data-s="quality"], [data-s="carat_each"]', row).forEach(el => {
    el.addEventListener('change', () => scheduleStockCheck(row, () => refreshStoneStock(row)));
  });
}

async function refreshItemStock(card){
  const hint = card.querySelector('[data-stock-hint]');
  if (!hint) return;
  const metalType = card.querySelector('[data-f="metal_type"]').value;
  const metalColour = card.querySelector('[data-f="metal_colour"]').value;
  const itemCategory = card.querySelector('[data-f="category"]').value;
  if (!metalType && !itemCategory) { hint.hidden = true; hint.innerHTML = ''; return; }

  const parts = [];
  if (metalType) {
    const metalParams = { category: 'metal', metal_type: metalType };
    if (metalColour) metalParams.metal_colour = metalColour;
    const metalMatches = await stockMatch(metalParams);
    const totalWeight = metalMatches.reduce((sum, m) => sum + Number(m.quantity), 0);
    parts.push(totalWeight > 0
      ? `<span class="badge ok">Metal: ${totalWeight}g in stock</span>`
      : `<span class="badge warn">Metal: order needed</span>`);
  }
  if (itemCategory) {
    const mountParams = { category: 'mount', item_category: itemCategory };
    if (metalType) mountParams.metal_type = metalType;
    if (metalColour) mountParams.metal_colour = metalColour;
    const mountMatches = await stockMatch(mountParams);
    const totalMounts = mountMatches.reduce((sum, m) => sum + Number(m.quantity), 0);
    parts.push(totalMounts > 0
      ? `<span class="badge ok">Mount: ${totalMounts} in stock</span>`
      : `<span class="badge warn">Mount: none in stock</span>`);
  }
  hint.hidden = false;
  hint.innerHTML = parts.join(' ');
}

function wireItemStockCheck(card){
  $$('[data-f="metal_type"], [data-f="metal_colour"], [data-f="category"]', card).forEach(el => {
    el.addEventListener('change', () => scheduleStockCheck(card, () => refreshItemStock(card)));
  });
}

function selectedCategoryKey(card){
  return categoryRuleKey(selectedLookupText(card.querySelector('[data-f="category"]')));
}

function selectedItemTypeText(card){
  const select = card.querySelector('[data-f="item_type"]');
  return selectedLookupText(select);
}

function itemHasText(card, terms){
  const text = `${selectedLookupText(card.querySelector('[data-f="category"]'))} ${selectedItemTypeText(card)}`;
  return terms.some(term => text.includes(normaliseLookupText(term)));
}

function updateItemVisibility(card){
  const key = selectedCategoryKey(card);
  const isRing = key === 'rings' || itemHasText(card, ['engagement ring', 'wedding ring', 'eternity ring', 'dress ring', 'signet ring']);
  const isRepair = key === 'repairs_replace_stone' || itemHasText(card, ['repair', 'replace stone']);
  const isChain = ['necklace', 'pendants', 'bracelet', 'bangle'].includes(key) ||
    itemHasText(card, ['necklace', 'pendant', 'bracelet', 'bangle', 'chain']);
  const isEarring = key === 'earrings' || itemHasText(card, ['e ring', 'earring']);
  const isWatch = key === 'watches' || itemHasText(card, ['watch']);
  const showManufactureCosting = isRing || isRepair;
  const showChainCosting = isChain || isEarring;
  const showCategoryCosting = !showManufactureCosting && !showChainCosting;

  $$('[data-detail="ring"]', card).forEach(el => { el.hidden = !isRing; });
  $$('[data-detail="chain"]', card).forEach(el => { el.hidden = !isChain; });
  $$('[data-detail="repair"]', card).forEach(el => { el.hidden = !isRepair; });
  card.querySelector('[data-watch-section]').hidden = !isWatch;
  card.querySelector('[data-costing="manufacture"]').hidden = !showManufactureCosting;
  card.querySelector('[data-costing="chain"]').hidden = !showChainCosting;
  card.querySelector('[data-costing="category"]').hidden = !showCategoryCosting;

  const categoryLabel = card.querySelector('[data-f="category"]').selectedOptions[0]?.textContent || 'Item category';
  const title = card.querySelector('[data-calc="categoryCostTitle"]');
  if (title) title.textContent = `${categoryLabel} costing`;
}

/* --------------------------- item calculations --------------------------- */
function itemChanged(card, target){
  updateItemVisibility(card);

  // stone rows: auto total ct + auto cost
  $$('[data-stone]', card).forEach(row => {
    const count = num(row.querySelector('[data-s="stone_count"]').value);
    const each = num(row.querySelector('[data-s="carat_each"]').value);
    const totalEl = row.querySelector('[data-s="total_carat"]');
    if (target && row.contains(target) &&
        (target.dataset.s === 'stone_count' || target.dataset.s === 'carat_each') && each) {
      totalEl.value = (count * each).toFixed(3);
    }
    const ppc = num(row.querySelector('[data-s="cost_per_carat"]').value);
    const tct = num(totalEl.value);
    const costEl = row.querySelector('[data-s="cost"]');
    if (target && row.contains(target) && target.dataset.s !== 'cost' && ppc && tct) {
      costEl.value = (ppc * tct).toFixed(2);
    }
  });

  // watch section visibility is handled by updateItemVisibility().
  updateWatchDiscount(card);

  // ring / manufacture calculator
  const stonesCost = $$('[data-stone]', card)
    .reduce((s, r) => s + num(r.querySelector('[data-s="cost"]').value), 0);
  const mfgRate = RATES[card.querySelector('[data-calc="mfgMetal"]').value]?.rate || 0;
  const goldCost = mfgRate * num(card.querySelector('[data-calc="mfgGms"]').value);
  const settingTierCode = card.querySelector('[data-calc="settingTier"]').value;
  const settingCost = (RATES[settingTierCode]?.rate || 0) * num(card.querySelector('[data-calc="settingQty"]').value);
  const castingCost = card.querySelector('[data-calc="castingOn"]').checked ? (RATES.CASTING?.rate || 0) : 0;
  const labourCost = (RATES.LABOUR?.rate || 0) * num(card.querySelector('[data-calc="labourHrs"]').value);
  const boxCost = card.querySelector('[data-calc="boxOn"]').checked ? (RATES.BOX_VALUATION?.rate || 0) : 0;
  const mfgTotal = stonesCost + goldCost + settingCost + castingCost + labourCost + boxCost;
  const markup = RATES.RETAIL_MARKUP?.rate || 2.75;
  const mfgRetail = mfgTotal * markup;

  setCalc(card, 'stonesCost', fmt(stonesCost));
  setCalc(card, 'goldCost', fmt(goldCost));
  setCalc(card, 'settingCost', fmt(settingCost));
  setCalc(card, 'castingCost', fmt(castingCost));
  setCalc(card, 'labourCost', fmt(labourCost));
  setCalc(card, 'boxCost', fmt(boxCost));
  setCalc(card, 'mfgTotal', fmt(mfgTotal));
  setCalc(card, 'mfgRetail', fmt(mfgRetail));

  // chain calculator
  const chainRate = RATES[card.querySelector('[data-calc="chainRate"]').value]?.rate || 0;
  const chainGms = num(card.querySelector('[data-calc="chainGms"]').value);
  const chainRetail = chainRate * chainGms;
  setCalc(card, 'chainRateShow', chainRate ? `$${chainRate}/gm` : '—');
  setCalc(card, 'chainCost', fmt(chainRetail));
  setCalc(card, 'chainRetail', fmt(chainRetail));

  // category-specific calculator, used for brooches, watches and other items
  const categoryMaterial = num(card.querySelector('[data-calc="categoryMaterial"]').value);
  const categoryLabour = num(card.querySelector('[data-calc="categoryLabourHrs"]').value) * (RATES.LABOUR?.rate || 0);
  const categoryOther = num(card.querySelector('[data-calc="categoryOther"]').value);
  const categoryCost = categoryMaterial + categoryLabour + categoryOther;
  const categoryRetail = categoryCost * markup;
  setCalc(card, 'categoryMaterialCost', fmt(categoryMaterial));
  setCalc(card, 'categoryLabourCost', fmt(categoryLabour));
  setCalc(card, 'categoryOtherCost', fmt(categoryOther));
  setCalc(card, 'categoryRetail', fmt(categoryRetail));

  // suggest retail if empty and a calculator produced something
  const retailInput = card.querySelector('[data-f="retail_price"]');
  const mfgVisible = !card.querySelector('[data-costing="manufacture"]').hidden;
  const chainVisible = !card.querySelector('[data-costing="chain"]').hidden;
  const categoryVisible = !card.querySelector('[data-costing="category"]').hidden;
  const suggested = Math.max(
    mfgVisible ? mfgRetail : 0,
    chainVisible ? chainRetail : 0,
    categoryVisible ? categoryRetail : 0);
  if (target && target.dataset.calc && suggested > 0 && !num(retailInput.value)) {
    retailInput.placeholder = suggested.toFixed(2) + ' suggested';
  }

  // liability = min(nett or retail, policy limit)
  const retail = num(retailInput.value);
  const nett = num(card.querySelector('[data-f="insurance_nett"]').value);
  const limit = num(card.querySelector('[data-f="policy_limit"]').value);
  const base = nett || retail;
  const liability = limit > 0 ? Math.min(base, limit) : base;
  card.querySelector('[data-f="liability"]').value = liability ? liability.toFixed(2) : '';

  // head summary
  const label = card.querySelector('[data-f="item_type"]').selectedOptions[0]?.textContent;
  const desc = card.querySelector('[data-f="description"]').value;
  card.querySelector('[data-item-summary]').textContent =
    desc || (label && label !== '—' ? label : 'New item');
  card.querySelector('[data-fig-retail]').textContent = fmt(retail);
  card.querySelector('[data-fig-nett]').textContent = fmt(nett);
  card.querySelector('[data-fig-liability]').textContent = fmt(liability);

  recalcTotals();
}

/* ------------------------- watch brand discount --------------------------- */
function normBrand(s){ return String(s || '').trim().toLowerCase(); }

/* insurer_id null = "Shop Sales" (retail/non-insurance) default rate.
   Exact match on the claim's insurer first; if the claim has an insurer but
   there's no negotiated rate for it, fall back to Shop Sales for reference
   only — never silently used as the billed figure (see SOUNDNESS_REVIEW.md
   bug #2 on the Xero nett/retail fallback for why that distinction matters). */
function findWatchRate(brand, insurerId){
  const b = normBrand(brand);
  if (!b) return null;
  const rows = WATCH_RATES.filter(w => normBrand(w.brand) === b);
  if (!rows.length) return null;
  const wanted = insurerId ? String(insurerId) : null;
  const exact = rows.find(w => (w.insurer_id == null ? null : String(w.insurer_id)) === wanted);
  if (exact) return { ...exact, isFallback: false };
  if (wanted) {
    const shopSale = rows.find(w => w.insurer_id == null);
    if (shopSale) return { ...shopSale, isFallback: true };
  }
  return null;
}

function updateWatchDiscount(card){
  const note = card.querySelector('[data-watch-rate]');
  if (!note) return;
  const brand = card.querySelector('[data-f="watch_make"]')?.value;
  if (!brand) { note.textContent = ''; return; }

  const insurerId = $('#insurerId').value;
  const insurerName = $('#insurerId').selectedOptions[0]?.textContent;
  const match = findWatchRate(brand, insurerId);
  if (!match) {
    note.textContent = `No brand rate on file for "${brand}" — price manually.`;
    return;
  }

  if (match.rate_type === 'poa') {
    note.textContent = match.isFallback
      ? `${brand} — no ${insurerName} rate on file; Shop Sales rate is POA (price on application).`
      : `${brand} — ${insurerId ? insurerName : 'Shop Sales'} rate: POA (price on application).`;
    return;
  }

  const pct = (match.rate_value * 100).toFixed(0);
  if (match.isFallback) {
    note.textContent = `${brand} — no ${insurerName} rate on file; Shop Sales default is ${pct}% off RRP.`;
    return;
  }
  note.textContent = `${brand} — ${insurerId ? insurerName : 'Shop Sales'} rate: ${pct}% off RRP.`;

  // only suggest — never overwrite a figure the assessor already entered —
  // and only when there's an actual insurer to bill nett to (nett is an
  // insurer concept; see SOUNDNESS_REVIEW.md bug #2)
  if (insurerId) {
    const retail = num(card.querySelector('[data-f="retail_price"]').value);
    const nettInput = card.querySelector('[data-f="insurance_nett"]');
    if (retail > 0 && !num(nettInput.value)) {
      nettInput.placeholder = (retail * (1 - match.rate_value)).toFixed(2) + ' suggested';
    }
  }
}

function setCalc(card, key, val){
  const el = card.querySelector(`[data-calc="${key}"]`);
  if (el && el.tagName !== 'INPUT' && el.tagName !== 'SELECT') el.textContent = val;
}

/* -------------------------------- totals --------------------------------- */
function wireSettlement(){
  ['postageHandling','salvageAllocation','overallLimit'].forEach(id =>
    $('#'+id).addEventListener('input', recalcTotals));
}

function recalcTotals(){
  const cards = $$('[data-item]');
  let retail = 0, nett = 0, liability = 0;
  for (const c of cards) {
    retail += num(c.querySelector('[data-f="retail_price"]').value);
    nett += num(c.querySelector('[data-f="insurance_nett"]').value);
    liability += num(c.querySelector('[data-f="liability"]').value);
  }
  liability += num($('#postageHandling').value) - num($('#salvageAllocation').value);
  const overall = num($('#overallLimit').value);
  const capped = overall > 0 && liability > overall;
  if (capped) liability = overall;
  $('#limitFlag').hidden = !capped;

  $('#totItems').textContent = cards.length;
  $('#totRetail').textContent = fmt(retail);
  $('#totNett').textContent = fmt(nett);
  $('#totLiability').textContent = fmt(Math.max(liability, 0));
}

/* ------------------------------ save / load ------------------------------ */
function collectItem(card){
  const out = {};
  $$('[data-f]', card).forEach(el => out[el.dataset.f] = el.value || null);
  out.item_no = Number(card.dataset.itemNo);
  out.stones = $$('[data-stone]', card).map(row => {
    const s = {};
    $$('[data-s]', row).forEach(el => s[el.dataset.s] = el.value || null);
    return s;
  }).filter(s => s.stone_type || s.total_carat || s.cost);
  out.costings = buildCostings(card);
  out.attachments = collectFileMetadata(card);
  return out;
}

function buildCostings(card){
  const lines = [];
  const push = (cost_type, description, qty, unit, rate) => {
    const amount = qty * rate;
    if (amount) lines.push({ cost_type, description, qty, unit, rate, amount: amount.toFixed(2) });
  };
  if (!card.querySelector('[data-costing="manufacture"]').hidden) {
    const mfgCode = card.querySelector('[data-calc="mfgMetal"]').value;
    push('gold', RATES[mfgCode]?.label, num(card.querySelector('[data-calc="mfgGms"]').value), 'gm', RATES[mfgCode]?.rate || 0);
    const settingCode = card.querySelector('[data-calc="settingTier"]').value;
    if (settingCode) push('setting', RATES[settingCode]?.label, num(card.querySelector('[data-calc="settingQty"]').value), 'pc', RATES[settingCode]?.rate || 0);
    if (card.querySelector('[data-calc="castingOn"]').checked) push('casting','Casting',1,'pc',RATES.CASTING?.rate || 0);
    push('labour', 'Labour', num(card.querySelector('[data-calc="labourHrs"]').value), 'hr', RATES.LABOUR?.rate || 0);
    if (card.querySelector('[data-calc="boxOn"]').checked) push('box_valuation','Box & valuation',1,'pc',RATES.BOX_VALUATION?.rate || 0);
  }
  if (!card.querySelector('[data-costing="chain"]').hidden) {
    const chainCode = card.querySelector('[data-calc="chainRate"]').value;
    if (chainCode) push('chain_per_gm', RATES[chainCode]?.label, num(card.querySelector('[data-calc="chainGms"]').value), 'gm', RATES[chainCode]?.rate || 0);
  }
  if (!card.querySelector('[data-costing="category"]').hidden) {
    const categoryLabel = card.querySelector('[data-f="category"]').selectedOptions[0]?.textContent || 'Item category';
    push('component', `${categoryLabel} material / replacement allowance`, 1, 'pc', num(card.querySelector('[data-calc="categoryMaterial"]').value));
    push('labour', `${categoryLabel} labour`, num(card.querySelector('[data-calc="categoryLabourHrs"]').value), 'hr', RATES.LABOUR?.rate || 0);
    push('other', `${categoryLabel} other cost`, 1, 'pc', num(card.querySelector('[data-calc="categoryOther"]').value));
  }
  return lines;
}

async function save(mode){
  let claimNumber = $('#claimNumber').value.trim();
  const hasInsurer = !!$('#insurerId').value;
  const first = $('#custFirst').value.trim();
  if (!claimNumber && hasInsurer) return toast('Enter the claim number first', true);
  if (!first) return toast('Select or enter a customer', true);
  if (!validateAddress()) return toast('Check the address — street, suburb and postcode go together', true);
  if (!apiAvailable) return toast('API not reachable — connect the database to save.', true);

  try {
    // 1. ensure customer
    let customerId = selectedCustomerId;
    if (!customerId) {
      const c = await fetch(`${API}/customers`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          first_name: first,
          last_name: $('#custLast').value.trim(),
          email: $('#custEmail').value.trim() || null,
          mobile: $('#custMobile').value.trim() || null,
          address_line1: $('#custAddress').value.trim() || null,
          suburb: $('#custSuburb').value.trim() || null,
          state: $('#custState').value,
          postcode: $('#custPostcode').value.trim() || null,
          customer_type: 'insurance',
        }),
      }).then(r => r.json());
      customerId = c.id;
      selectedCustomerId = c.id;
      setCustomerBadge('Existing customer');
    }

    // 1b. new claims get an auto-generated internal reference unless staff
    // already typed one in — format is configurable in Settings.
    if (!claimId && !$('#ourRef').value.trim()) {
      try {
        const next = await fetch(`${API}/settings/reference-format/next`, { method: 'POST' }).then(r => r.json());
        if (next.reference) $('#ourRef').value = next.reference;
      } catch { /* leave blank — staff can fill it in manually */ }
    }

    // Private jobs have no insurer claim number — the greyed-out field
    // mirrors the internal reference instead, so the DB's NOT NULL
    // claim_number is still satisfied without staff typing a placeholder.
    if (!hasInsurer && !claimNumber) {
      claimNumber = $('#ourRef').value.trim();
      $('#claimNumber').value = claimNumber;
    }

    // 2. save claim + items
    const payload = {
      claim_number: claimNumber,
      our_ref: $('#ourRef').value || null,
      your_ref: $('#yourRef').value || null,
      customer_id: customerId,
      insurer_id: $('#insurerId').value || null,
      insurer_contact_id: $('#insurerContactId').value || null,
      branch: $('#branch').value,
      assessment_type: $('#assessmentType').value || null,
      validation_type: $('#validationType').value || null,
      date_received: $('#dateReceived').value || null,
      respond_by: $('#respondBy').value || null,
      assigned_to: $('#assignedTo').value || null,
      excess_amount: $('#excessAmount').value || null,
      settlement_notes: $('#settlementNotes').value || null,
      items: $$('[data-item]').map(collectItem),
    };
    const method = claimId ? 'PUT' : 'POST';
    const urlPath = claimId ? `${API}/claims/${claimId}` : `${API}/claims`;
    const res = await fetch(urlPath, {
      method, headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(r => r.json());
    if (res.error) throw new Error(res.error);
    claimId = res.id;
    history.replaceState(null, '', `?claim=${claimId}`);

    if (mode === 'draft') return toast('Draft saved');

    // 3. generate quote version (snapshots rates + spot)
    const q = await fetch(`${API}/claims/${claimId}/quotes`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        total_retail: parseMoney($('#totRetail').textContent),
        total_nett: parseMoney($('#totNett').textContent),
        total_liability: parseMoney($('#totLiability').textContent),
        postage_handling: num($('#postageHandling').value),
        salvage_allocation: num($('#salvageAllocation').value),
        created_by: $('#assignedTo').value || null,
      }),
    }).then(r => r.json());
    if (q.error) throw new Error(q.error);
    toast(`Quote v${q.version} generated for claim ${claimNumber}`);
  } catch (err) {
    toast('Save failed: ' + err.message, true);
  }
}

function parseMoney(t){ return num(String(t).replace(/[^0-9.\-]/g,'')); }

async function loadClaim(id){
  if (!apiAvailable) return;
  try {
    const c = await fetch(`${API}/claims/${id}`).then(r => r.json());
    if (c.error) throw new Error(c.error);
    $('#pageTitle').textContent = `Claim ${c.claim_number}`;
    $('#claimNumber').value = c.claim_number || '';
    $('#ourRef').value = c.our_ref || '';
    $('#yourRef').value = c.your_ref || '';
    $('#insurerId').value = c.insurer_id || '';
    $('#insurerId').dispatchEvent(new Event('change'));
    $('#insurerContactId').value = c.insurer_contact_id || '';
    $('#branch').value = c.branch || 'melbourne';
    $('#assessmentType').value = c.assessment_type || '';
    $('#validationType').value = c.validation_type || '';
    $('#dateReceived').value = c.date_received?.slice(0,10) || '';
    $('#respondBy').value = c.respond_by?.slice(0,10) || '';
    $('#assignedTo').value = c.assigned_to || '';
    $('#excessAmount').value = c.excess_amount || '';
    $('#settlementNotes').value = c.settlement_notes || '';
    if (c.customer) pickCustomer(c.customer);
    $('#itemsContainer').innerHTML = '';
    (c.items?.length ? c.items : [null]).forEach(it => addItem(it || undefined));
  } catch (err) {
    toast('Could not load claim: ' + err.message, true);
  }
}

function hydrateItem(card, it){
  for (const [k,v] of Object.entries(it)) {
    const el = card.querySelector(`[data-f="${k}"]`);
    if (el && v != null) el.value = v;
  }
  fillItemTypeSelect(card, { keepCurrent: true });
  const stonesBody = card.querySelector('[data-stones]');
  stonesBody.innerHTML = '';
  (it.stones?.length ? it.stones : [null]).forEach(s => addStone(card, s || undefined));
  refreshItemStock(card);
}

/* -------------------------------- toast ---------------------------------- */
let toastTimer;
function toast(msg, isErr){
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast show' + (isErr ? ' error' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.className = 'toast', 3800);
}
