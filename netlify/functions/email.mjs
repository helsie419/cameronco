import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { pool } from './lib/db.mjs';

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

export default async (req) => {
  const url = new URL(req.url);
  const path = url.pathname
    .replace(/^\/\.netlify\/functions\/email/, '')
    .replace(/^\/api\/email/, '')
    .replace(/\/$/, '') || '/';

  if (req.method !== 'GET') return json(405, { error: 'Method not allowed' });

  const match = path.match(/^\/customer\/(\d+)$/);
  if (!match) return json(404, { error: `No route: GET ${path}` });

  const config = readImapConfig();
  if (!config.configured) {
    return json(503, {
      configured: false,
      error: 'SiteGround IMAP is not configured yet.',
      required: ['IMAP_HOST', 'IMAP_USER', 'IMAP_PASSWORD'],
    });
  }

  try {
    const limit = boundedInt(url.searchParams.get('limit'), 20, 1, 50);
    const scanLimit = boundedInt(process.env.IMAP_SCAN_LIMIT, 100, 10, 500);
    const { rows } = await pool.query(
      `SELECT id, first_name, last_name, email FROM customers WHERE id = $1`,
      [match[1]]
    );

    if (!rows.length) return json(404, { error: 'Customer not found' });
    const customer = rows[0];
    if (!customer.email) return json(400, { error: 'Customer does not have an email address.' });

    const messages = await fetchCustomerMessages(config, customer.email, { limit, scanLimit });
    return json(200, {
      configured: true,
      customer: {
        id: customer.id,
        name: [customer.first_name, customer.last_name].filter(Boolean).join(' '),
        email: customer.email,
      },
      messages,
    });
  } catch (err) {
    console.error(err);
    return json(500, { error: err.message });
  }
};

function readImapConfig() {
  const host = process.env.IMAP_HOST;
  const user = process.env.IMAP_USER;
  const pass = process.env.IMAP_PASSWORD;
  return {
    configured: Boolean(host && user && pass),
    host,
    port: boundedInt(process.env.IMAP_PORT, 993, 1, 65535),
    secure: process.env.IMAP_SECURE !== 'false',
    user,
    pass,
    rejectUnauthorized: process.env.IMAP_TLS_REJECT_UNAUTHORIZED !== 'false',
    mailboxes: (process.env.IMAP_MAILBOXES || 'INBOX,Sent,Sent Items,INBOX.Sent')
      .split(',')
      .map((mailbox) => mailbox.trim())
      .filter(Boolean),
  };
}

async function fetchCustomerMessages(config, customerEmail, options) {
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
    logger: false,
    tls: {
      rejectUnauthorized: config.rejectUnauthorized,
    },
  });

  const messages = [];
  await client.connect();

  try {
    for (const mailbox of config.mailboxes) {
      if (messages.length >= options.limit * 3) break;
      try {
        const mailboxMessages = await fetchMailboxMessages(client, mailbox, customerEmail, options);
        messages.push(...mailboxMessages);
      } catch (err) {
        // SiteGround mailbox names can vary by email client. Skip missing folders
        // so a wrong Sent-folder name does not break INBOX results.
        console.warn(`Skipping mailbox ${mailbox}: ${err.message}`);
      }
    }
  } finally {
    await client.logout().catch(() => {});
  }

  return messages
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
    .slice(0, options.limit);
}

async function fetchMailboxMessages(client, mailbox, customerEmail, options) {
  const lock = await client.getMailboxLock(mailbox);
  try {
    const exists = Number(client.mailbox.exists || 0);
    if (!exists) return [];

    const start = Math.max(1, exists - options.scanLimit + 1);
    const range = `${start}:*`;
    const matches = [];

    for await (const message of client.fetch(range, {
      envelope: true,
      flags: true,
      internalDate: true,
      source: true,
      uid: true,
    })) {
      const parsed = await simpleParser(message.source);
      if (!messageMatchesCustomer(parsed, customerEmail)) continue;

      matches.push(formatMessage(mailbox, message, parsed, customerEmail));
    }

    return matches;
  } finally {
    lock.release();
  }
}

function messageMatchesCustomer(parsed, customerEmail) {
  const email = customerEmail.toLowerCase();
  return emailList(parsed.from).includes(email) ||
    emailList(parsed.to).includes(email) ||
    emailList(parsed.cc).includes(email) ||
    emailList(parsed.bcc).includes(email);
}

function formatMessage(mailbox, message, parsed, customerEmail) {
  const customer = customerEmail.toLowerCase();
  const from = emailList(parsed.from);
  const outbound = !from.includes(customer);
  const text = parsed.text || stripHtml(parsed.html || '');

  return {
    id: Buffer.from(`${mailbox}:${message.uid || parsed.messageId || parsed.date || parsed.subject}`).toString('base64url'),
    mailbox,
    uid: message.uid,
    direction: outbound ? 'Outbound' : 'Inbound',
    subject: parsed.subject || '(No subject)',
    from: addressText(parsed.from),
    to: addressText(parsed.to),
    cc: addressText(parsed.cc),
    date: (parsed.date || message.internalDate || new Date()).toISOString(),
    snippet: collapse(text).slice(0, 500),
    hasAttachments: Boolean(parsed.attachments?.length),
  };
}

function emailList(addressObject) {
  return (addressObject?.value || [])
    .map((item) => (item.address || '').toLowerCase())
    .filter(Boolean);
}

function addressText(addressObject) {
  return (addressObject?.value || [])
    .map((item) => item.name ? `${item.name} <${item.address}>` : item.address)
    .filter(Boolean)
    .join(', ');
}

function stripHtml(html) {
  return String(html)
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
}

function collapse(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function boundedInt(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export const config = {
  path: ['/api/email/*'],
};
