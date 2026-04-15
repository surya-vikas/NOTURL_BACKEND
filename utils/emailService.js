const nodemailer = require('nodemailer');
const ApiError = require('./apiError');

// 🔥 Create transporter (more reliable config)
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // TLS
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// 🔥 Verify SMTP connection at startup
transporter.verify((error, success) => {
  if (error) {
    console.error("❌ SMTP CONNECTION ERROR:", error);
  } else {
    console.log("✅ SMTP server is ready to send emails");
  }
});

// 🎨 Email template
const getOtpMailTemplate = (otpCode, context) => {
  const isProfileUpdate = context === 'profile_update';

  const heading = isProfileUpdate
    ? 'Confirm your profile update'
    : 'Verify your email';

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

// 🚀 Send OTP Email
const sendOtpEmail = async (email, otpCode, context = 'signup') => {
  const isProfileUpdate = context === 'profile_update';

  const mailOptions = {
    from: `NotURL Security <${process.env.EMAIL_USER}>`,
    to: email,
    subject: isProfileUpdate
      ? 'Your NotURL profile update code'
      : 'Your NotURL verification code',
    html: getOtpMailTemplate(otpCode, context),
  };

  try {
    console.log("📩 Sending OTP to:", email);

    const info = await transporter.sendMail(mailOptions);

    console.log("✅ Email sent successfully:", info.response);

    return info;

  } catch (error) {
    // 🔥 FULL DEBUG LOGS (VERY IMPORTANT)
    console.error("❌ EMAIL SENDING FAILED");
    console.error("➡️ Message:", error.message);
    console.error("➡️ Code:", error.code);
    console.error("➡️ Full Error:", error);

    throw new ApiError('Failed to send OTP email', 500);
  }
};

module.exports = {
  sendOtpEmail,
};