const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const requiredEnvVars = [
  'PORT',
  'MONGO_URI',
  'JWT_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
];

const emailProvider = String(process.env.EMAIL_PROVIDER || 'gmail').toLowerCase();

if (emailProvider === 'resend') {
  requiredEnvVars.push('RESEND_API_KEY', 'EMAIL_FROM');
} else {
  requiredEnvVars.push('EMAIL_USER', 'EMAIL_PASS');
}

const missingVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

if (missingVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
}
