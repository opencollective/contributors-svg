import crypto from 'crypto';

import debug from 'debug';
import dotenv from 'dotenv';

dotenv.config();
debug.enable(process.env.DEBUG);

const defaults = {
  PORT: 3001,
  NODE_ENV: 'development',
  API_KEY: '09u624Pc9F47zoGLlkg1TBSbOl2ydSAq',
  API_URL: 'https://api-staging.opencollective.com',
  IMAGES_URL: 'http://images-staging.opencollective.com',
  WEBSITE_URL: 'https://staging.opencollective.com',
  CONTRIBUTORS_SVG_URL: 'https://contributors-svg.opencollective.com',
  OC_APPLICATION: 'contributors-svg',
  OC_ENV: process.env.NODE_ENV || 'development',
  OC_SECRET: crypto.randomBytes(16).toString('hex'),
};

for (const key in defaults) {
  if (process.env[key] === undefined) {
    process.env[key] = defaults[key];
  }
}
