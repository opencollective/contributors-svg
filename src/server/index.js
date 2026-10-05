import './env';

import http from 'http';
import path from 'path';

import express from 'express';

import * as hyperwatch from './lib/hyperwatch';
import cloudflareIps from './cloudflare-ips.json';
import { logger, loggerMiddleware } from './logger';
import { loadRoutes } from './routes';

const port = process.env.PORT;

const app = express();
const server = http.createServer(app);

// Express 5 defaults to the 'simple' query parser: keep Express 4's (qs), e.g. for ?skip[]=
app.set('query parser', 'extended');

// Trust the X-Forwarded-For set by Cloudflare and the Heroku router, so req.ip and the logs get the client IP
app.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal'].concat(cloudflareIps));

app.use('/static', express.static(path.join(__dirname, '..', 'static')));

hyperwatch.load(app, { server });

loadRoutes(app);

app.use(loggerMiddleware.errorLogger);

server.listen(port, () => {
  logger.info(`Ready on http://localhost:${port}`);
});
