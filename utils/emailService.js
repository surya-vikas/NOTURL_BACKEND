const { Resend } = require('resend');
const ApiError = require('./apiError');

let resend;

const getResendClient = () => {
  if (!process.env.RESEND_API_KEY) {
    throw new ApiError('RESEND_API_KEY is not configured', 500);
  }

  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }

  return resend;
};

const getOtpMailTemplate = (otpCode, context) => {
  const isProfileUpdate = context === 'profile_update';

  return `
    <div style="font-family: Arial, sans-serif;">
      <h2>${isProfileUpdate ? 'Confirm your profile update' : 'Verify your email'}</h2>
      <p>Your OTP:</p>
      <h1>${otpCode}</h1>
      <p>This OTP expires in 5 minutes.</p>
    </div>
  `;
};

const sendOtpEmail = async (email, otpCode, context = 'signup') => {
  try {
    console.log('Sending OTP via Resend:', email);

    const response = await getResendClient().emails.send({
      from: 'NotURL <noreply@noturl.in>',
      to: email,
      subject: 'Your NotURL OTP',
      html: getOtpMailTemplate(otpCode, context),
    });

    console.log('Email sent successfully:', response);
    return response;
  } catch (error) {
    console.error('Resend error:', error);
    console.error('Resend error details:', JSON.stringify(error, null, 2));
    throw new ApiError('Failed to send OTP email', 500);
  }
};

module.exports = { sendOtpEmail };
