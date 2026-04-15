const nodemailer = require('nodemailer');
const ApiError = require('./apiError');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const serializeEmailError = (error) => ({
  message: error.message,
  code: error.code,
  command: error.command,
  response: error.response,
  responseCode: error.responseCode,
  stack: error.stack,
});

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
    console.log('OTP email send started:', { email, context });
    console.log('Verifying Gmail SMTP connection...');

    await transporter.verify();

    console.log('Gmail SMTP connection verified');
    console.log('Sending OTP email to:', email);

    const info = await transporter.sendMail(mailOptions);

    console.log('OTP email sent successfully:', {
      messageId: info.messageId,
      response: info.response,
      accepted: info.accepted,
      rejected: info.rejected,
    });

    return {
      success: true,
      info,
    };
  } catch (error) {
    console.error(
      'OTP email sending failed:',
      JSON.stringify(serializeEmailError(error), null, 2)
    );

    throw new ApiError('Failed to send OTP email. Please try again later.', 500);
  }
};

module.exports = {
  sendOtpEmail,
};
