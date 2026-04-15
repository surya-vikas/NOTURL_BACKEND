const nodemailer = require('nodemailer');
const ApiError = require('./apiError');

const EMAIL_PROVIDER = String(process.env.EMAIL_PROVIDER || 'gmail').toLowerCase();
const SMTP_TIMEOUT_MS = 10 * 1000;
const MAX_TIMEOUT_RETRIES = 2;

const gmailTransporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  connectionTimeout: SMTP_TIMEOUT_MS,
  greetingTimeout: SMTP_TIMEOUT_MS,
  socketTimeout: SMTP_TIMEOUT_MS,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const serializeEmailError = (error) => ({
  name: error.name,
  message: error.message,
  code: error.code,
  command: error.command,
  response: error.response,
  responseCode: error.responseCode,
  stack: error.stack,
});

const isTimeoutError = (error) => {
  const code = String(error.code || '').toUpperCase();
  const message = String(error.message || '').toLowerCase();

  return (
    code.includes('TIMEOUT') ||
    code === 'ETIMEDOUT' ||
    message.includes('timeout') ||
    message.includes('timed out')
  );
};

const getOtpMailTemplate = (otpCode, context) => {
  const isProfileUpdate = context === 'profile_update';
  const heading = isProfileUpdate ? 'Confirm your profile update' : 'Verify your email';
  const message = isProfileUpdate
    ? 'Use this OTP to confirm your NotURL profile changes:'
    : 'Use this OTP to complete your NotURL signup:';

  return `
    <div style="font-family: Arial, sans-serif; color: #111827;">
      <h2 style="margin-bottom: 8px;">${heading}</h2>
      <p style="margin-top: 0;">${message}</p>
      <p style="font-size: 28px; font-weight: 700; letter-spacing: 4px; margin: 16px 0;">
        ${otpCode}
      </p>
      <p>This OTP expires in <strong>5 minutes</strong>.</p>
      <p style="color: #6b7280; font-size: 12px;">
        If you did not request this, you can ignore this email.
      </p>
    </div>
  `;
};

const buildMailOptions = (email, otpCode, context) => {
  const isProfileUpdate = context === 'profile_update';
  const from = process.env.EMAIL_FROM || `NotURL Security <${process.env.EMAIL_USER}>`;

  return {
    from,
    to: email,
    subject: isProfileUpdate
      ? 'Your NotURL profile update code'
      : 'Your NotURL verification code',
    html: getOtpMailTemplate(otpCode, context),
  };
};

const sendWithGmail = async (mailOptions) => {
  let lastError;

  for (let attempt = 1; attempt <= MAX_TIMEOUT_RETRIES + 1; attempt += 1) {
    try {
      console.log('Sending OTP email with Gmail SMTP:', {
        to: mailOptions.to,
        attempt,
        maxAttempts: MAX_TIMEOUT_RETRIES + 1,
      });

      const info = await gmailTransporter.sendMail(mailOptions);

      console.log('Gmail OTP email sent successfully:', {
        messageId: info.messageId,
        response: info.response,
        accepted: info.accepted,
        rejected: info.rejected,
      });

      return {
        success: true,
        provider: 'gmail',
        info,
      };
    } catch (error) {
      lastError = error;

      console.error(
        'Gmail OTP email attempt failed:',
        JSON.stringify(error, null, 2)
      );
      console.error(
        'Gmail OTP email attempt failed details:',
        JSON.stringify(serializeEmailError(error), null, 2)
      );

      if (!isTimeoutError(error) || attempt > MAX_TIMEOUT_RETRIES) {
        throw error;
      }

      console.log('Retrying Gmail OTP email after timeout:', {
        to: mailOptions.to,
        nextAttempt: attempt + 1,
      });
    }
  }

  throw lastError;
};

const sendWithResend = async (mailOptions) => {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not configured');
  }

  if (typeof fetch !== 'function') {
    throw new Error('Global fetch is not available for Resend email sending');
  }

  console.log('Sending OTP email with Resend:', { to: mailOptions.to });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SMTP_TIMEOUT_MS);

  let response;
  try {
    response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: mailOptions.from,
        to: [mailOptions.to],
        subject: mailOptions.subject,
        html: mailOptions.html,
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error('Resend email request failed');
    error.responseCode = response.status;
    error.response = data;
    throw error;
  }

  console.log('Resend OTP email sent successfully:', data);

  return {
    success: true,
    provider: 'resend',
    info: data,
  };
};

const sendOtpEmail = async (email, otpCode, context = 'signup') => {
  const mailOptions = buildMailOptions(email, otpCode, context);

  try {
    console.log('OTP email send started:', { email, context });
    console.log('Sending OTP email to:', email);

    if (EMAIL_PROVIDER === 'resend') {
      return await sendWithResend(mailOptions);
    }

    try {
      return await sendWithGmail(mailOptions);
    } catch (gmailError) {
      if (!process.env.RESEND_API_KEY) {
        throw gmailError;
      }

      console.error('Gmail failed. Falling back to Resend for OTP email.');
      return await sendWithResend(mailOptions);
    }
  } catch (error) {
    console.error(
      'OTP email sending failed:',
      JSON.stringify(error, null, 2)
    );
    console.error(
      'OTP email sending failed details:',
      JSON.stringify(serializeEmailError(error), null, 2)
    );

    throw new ApiError('Failed to send OTP email. Please try again later.', 500);
  }
};

module.exports = {
  sendOtpEmail,
};
