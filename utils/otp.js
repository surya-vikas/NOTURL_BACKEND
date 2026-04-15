const crypto = require('crypto');

const generateOtpCode = () => String(Math.floor(100000 + Math.random() * 900000));

const hashOtp = (otpCode) =>
  crypto.createHash('sha256').update(String(otpCode)).digest('hex');

const verifyOtpHash = (plainOtp, hashedOtp) => hashOtp(plainOtp) === hashedOtp;

module.exports = {
  generateOtpCode,
  hashOtp,
  verifyOtpHash,
};

