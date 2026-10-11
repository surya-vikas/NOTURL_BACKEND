const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

if (!process.env.PORT) {
  process.env.PORT = '5000';
}

if (!process.env.BASE_URL && process.env.BACKEND_BASE_URL) {
  process.env.BASE_URL = process.env.BACKEND_BASE_URL;
}

if (!process.env.BASE_URL) {
  process.env.BASE_URL = `http://localhost:${process.env.PORT}`;
}

const requiredEnvVars = [
  'MONGO_URI',
  'JWT_SECRET',
  'RESEND_API_KEY',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
];

const missingVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

if (missingVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
}
