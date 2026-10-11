const crypto = require('crypto');

const generateOtpCode = () => String(crypto.randomInt(100000, 1000000));

const hashOtp = (otpCode) =>
  crypto.createHash('sha256').update(String(otpCode)).digest('hex');

const verifyOtpHash = (plainOtp, hashedOtp) => {
  const expectedHash = Buffer.from(String(hashedOtp || ''), 'hex');
  const actualHash = Buffer.from(hashOtp(plainOtp), 'hex');
  return expectedHash.length === actualHash.length && crypto.timingSafeEqual(actualHash, expectedHash);
};

module.exports = {
  generateOtpCode,
  hashOtp,
  verifyOtpHash,
};

