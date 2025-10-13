import { handler } from './build/handler.js';
import express from 'express';
import https from 'https';
import bp from 'body-parser';
import fs from 'fs-extra';

const app = express();
app.use(bp.json({ limit: '50mb', extended: true }));
// app.use(express.limit('50mb'));

// // add a route that lives separately from the SvelteKit app
// app.get('/healthcheck', (req, res) => {
// 	res.end('ok');
// });

// let SvelteKit handle everything else, including serving prerendered pages and static assets
app.use(handler);

const key = fs.readFileSync('cert/key.pem', 'utf8');
const cert = fs.readFileSync('cert/crt.pem', 'utf8');

const httpsServer = https.createServer({ key, cert }, app);

const port = 3001;
httpsServer.listen(port, '0.0.0.0');
// app.listen(3001, () => {
// 	console.log(`listening on port ${port}`);
// });
