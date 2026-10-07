import nodemailer from 'nodemailer';
import { env } from './env.js';

// Nodemailer transporter pointed at MailHog (Section 14).
// Lazy singleton so worker/API processes share one connection pool.
let transporter = null;

function buildTransportOptions() {
  const options = {
    host: env.smtpHost,
    port: env.smtpPort,
    secure: false,
    ignoreTLS: true,
  };

  if (env.smtpUser) {
    options.auth = { user: env.smtpUser, pass: env.smtpPassword };
  }

  return options;
}

export function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport(buildTransportOptions());
  }
  return transporter;
}

export async function sendMail({ to, subject, text, html }) {
  const info = await getTransporter().sendMail({
    from: env.emailFrom,
    to,
    subject,
    text,
    html,
  });
  return info;
}

export async function verifyMailer() {
  await getTransporter().verify();
  return true;
}
