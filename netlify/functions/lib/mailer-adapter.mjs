// ============================================================================
// MAILER ADAPTER — one interface, two implementations. Same pattern as
// lib/xero-adapter.mjs, for the same reason: there's no live mail-sending
// account to test against yet, so the "send quote to customer" flow needs to
// be fully exercisable without one.
//
//   sendQuoteEmail({ to, customerName, claimNumber, version, pdfBuffer, pdfFilename })
//
// EMAIL_SEND_MODE=stub (default) — no SMTP account needed. Logs the message
//   that would have been sent (recipient, subject, attachment size) and
//   returns a deterministic fake message id, prefixed `[mailer:stub]` so it's
//   never mistaken for a real send.
//
// EMAIL_SEND_MODE=live — real SMTP send via nodemailer. Needs SMTP_HOST /
//   SMTP_PORT / SMTP_USER / SMTP_PASSWORD (see .env.example). The same
//   SiteGround mailbox already used for read-only IMAP in email.mjs will
//   usually also do outgoing SMTP — check your host's mail settings.
//
// Switching modes is one environment variable — nothing else changes.
// ============================================================================

import nodemailer from 'nodemailer';

const MODE = (process.env.EMAIL_SEND_MODE || 'stub').toLowerCase();

function log(...args) {
  console.log(`[mailer:${MODE}]`, ...args);
}

const stubId = () =>
  `STUB-EMAIL-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

let liveTransport;
function getLiveTransport() {
  if (liveTransport) return liveTransport;
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  if (!host || !user || !pass) {
    throw new Error('SMTP is not configured — set SMTP_HOST, SMTP_USER, SMTP_PASSWORD (see .env.example).');
  }
  liveTransport = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT) || 465,
    secure: process.env.SMTP_SECURE !== 'false',
    auth: { user, pass },
  });
  return liveTransport;
}

export function mailerMode() {
  return MODE;
}

function buildMessage({ customerName, claimNumber, version }) {
  const subject = `Your quote from Cameron & Co — Claim ${claimNumber}`;
  const greeting = customerName ? `Hi ${customerName},` : 'Hello,';
  const text = `${greeting}\n\n` +
    `Please find attached your quote (version ${version}) for claim ${claimNumber}.\n\n` +
    `If you have any questions or would like to proceed, just reply to this email or give us a call.\n\n` +
    `Kind regards,\nCameron & Co`;
  return { subject, text };
}

export async function sendQuoteEmail({ to, customerName, claimNumber, version, pdfBuffer, pdfFilename }) {
  const { subject, text } = buildMessage({ customerName, claimNumber, version });

  if (MODE !== 'live') {
    const id = stubId();
    log('would send', { to, subject, attachmentBytes: pdfBuffer.length, id });
    return { mode: 'stub', messageId: id, to };
  }

  const transport = getLiveTransport();
  const info = await transport.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
    attachments: [{ filename: pdfFilename, content: pdfBuffer, contentType: 'application/pdf' }],
  });
  log('sent', { to, subject, messageId: info.messageId });
  return { mode: 'live', messageId: info.messageId, to };
}
