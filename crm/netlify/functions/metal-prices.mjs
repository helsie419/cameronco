// ============================================================================
// CAMERON & CO — DAILY METAL SPOT PRICE FETCH (scheduled Netlify Function)
//
// Runs every weekday morning (see schedule below) and stores AUD spot prices
// for gold, silver and platinum in metal_prices. Quotes snapshot the price
// at generation time, so this table is both the live feed and the history.
//
// Provider: metalpriceapi.com (free tier available). Set METAL_API_KEY in
// Netlify environment variables. Swap the URL for goldapi.io or metals-api
// if preferred — only fetchSpot() changes.
//
// Note: xe.com does not offer a public metals API; its commercial currency
// API doesn't cover XAU/XAG spot in a usable way, hence a dedicated
// metals provider here.
// ============================================================================

import { pool } from './lib/db.mjs';

const TROY_OZ_GRAMS = 31.1034768;


async function fetchSpot() {
  const key = process.env.METAL_API_KEY;
  if (!key) throw new Error('METAL_API_KEY not set');
  // Rates come back as AUD per unit of metal when base=AUD is inverted;
  // metalpriceapi returns e.g. { rates: { XAU: 0.00031 } } meaning 1 AUD = X oz,
  // so AUD per oz = 1 / rate.
  const res = await fetch(
    `https://api.metalpriceapi.com/v1/latest?api_key=${key}&base=AUD&currencies=XAU,XAG,XPT`
  );
  if (!res.ok) throw new Error(`Metal API HTTP ${res.status}`);
  const data = await res.json();
  if (!data.success) throw new Error(`Metal API error: ${JSON.stringify(data.error || data)}`);
  const map = { XAU: 'gold', XAG: 'silver', XPT: 'platinum' };
  const out = [];
  for (const [sym, metal] of Object.entries(map)) {
    const r = data.rates?.[sym];
    if (!r) continue;
    const perOz = 1 / r;
    out.push({ metal, perOz, perGm: perOz / TROY_OZ_GRAMS });
  }
  return out;
}

export default async () => {
  try {
    const prices = await fetchSpot();
    for (const p of prices) {
      await pool.query(
        `INSERT INTO metal_prices (metal, currency, price_per_oz, price_per_gm, source)
         VALUES ($1,'AUD',$2,$3,'metalpriceapi.com')`,
        [p.metal, p.perOz.toFixed(4), p.perGm.toFixed(4)]
      );
    }
    console.log('Stored spot prices:', prices);
    return new Response('ok');
  } catch (err) {
    console.error('Metal price fetch failed:', err.message);
    return new Response(err.message, { status: 500 });
  }
};

// 07:30 AEST weekdays ≈ 21:30 UTC previous day
export const config = { schedule: '30 21 * * 0-4' };
