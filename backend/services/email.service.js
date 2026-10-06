import nodemailer from "nodemailer";

/**
 * Mail service supporting Nodemailer (SMTP / Gmail / Brevo / Mailgun)
 * or local dev logging if SMTP credentials are not yet configured in .env.
 */

const createTransporter = () => {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && user && pass) {
    return nodemailer.createTransport({
      host,
      port: parseInt(process.env.SMTP_PORT || "587", 10),
      secure: process.env.SMTP_SECURE === "true",
      auth: { user, pass },
    });
  }

  // Fallback to test/console transport for local development without live SMTP setup
  return null;
};

export const sendVerificationOtpEmail = async ({ toEmail, userName, otp }) => {
  const transporter = createTransporter();

  const subject = `Your Cheeni AI Verification Code: ${otp}`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; background: #050713; color: #f1f5f9; border-radius: 20px; border: 1px solid rgba(255, 255, 255, 0.1);">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #38bdf8; margin: 0; font-size: 26px; letter-spacing: -0.5px;">Cheeni AI</h1>
        <p style="color: #94a3b8; font-size: 13px; margin-top: 6px;">Your Voice-First Autonomous Assistant</p>
      </div>
      <div style="background: rgba(255, 255, 255, 0.04); border-radius: 16px; padding: 24px; border: 1px solid rgba(255, 255, 255, 0.06); text-align: center;">
        <p style="font-size: 15px; margin: 0 0 16px 0; color: #e2e8f0;">Hello <strong>${userName || "there"}</strong>,</p>
        <p style="font-size: 13px; color: #94a3b8; margin: 0 0 24px 0;">Use the 6-digit one-time password below to verify your email address and activate your account:</p>
        <div style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, rgba(56, 189, 248, 0.15), rgba(99, 102, 241, 0.2)); border: 1px solid rgba(56, 189, 248, 0.4); border-radius: 12px; font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #38bdf8; font-family: monospace;">
          ${otp}
        </div>
        <p style="font-size: 11px; color: #64748b; margin-top: 20px; margin-bottom: 0;">This OTP code expires in 10 minutes. If you did not sign up for Cheeni AI, you can safely ignore this email.</p>
      </div>
    </div>
  `;

  if (transporter) {
    try {
      await transporter.sendMail({
        from: process.env.EMAIL_FROM || '"Cheeni AI" <no-reply@cheeni.ai>',
        to: toEmail,
        subject,
        html,
      });
      console.log(`[EmailService] Verification OTP sent successfully to ${toEmail}`);
      return { success: true };
    } catch (err) {
      console.error(`[EmailService] Failed to send email via SMTP to ${toEmail}:`, err.message);
      // Fall through to dev console log
    }
  }

  // Development fallback: Log OTP directly to console
  console.log(`\n======================================================`);
  console.log(`[DEV OTP NOTIFICATION]`);
  console.log(`To: ${toEmail} (${userName})`);
  console.log(`OTP Code: >>> ${otp} <<< (valid for 10 minutes)`);
  console.log(`======================================================\n`);

  return { success: true, isDevLogged: true };
};
