import nodemailer from 'nodemailer';
import prisma from '../config/prisma';

// Replace with your email config in .env
const smtpHost = process.env.SMTP_HOST || '';
const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
const smtpUser = process.env.SMTP_USER || '';
const smtpPass = process.env.SMTP_PASS || '';
const escalationEmail = process.env.ESCALATION_EMAIL || '';

let transporter: nodemailer.Transporter | null = null;

if (smtpHost && smtpUser) {
  transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });
}

export const sendEmailAlert = async (subject: string, text: string, html: string) => {
  try {
    const settings = await prisma.systemSettings.findFirst();
    if (!settings || !settings.email_enabled) {
      return; // Email is disabled
    }

    if (!transporter || !escalationEmail) {
      console.warn('SMTP configuration or escalation email is missing in .env');
      return;
    }

    await transporter.sendMail({
      from: `"FIIX CMMS" <${smtpUser}>`,
      to: escalationEmail,
      subject,
      text,
      html,
    });
  } catch (error) {
    console.error('Error sending Email alert:', error);
  }
};
