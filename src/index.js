#!/usr/bin/env node
const Net = require('net');
const Path = require('path');
const {GoogleSpreadsheet} = require('google-spreadsheet');

const log = console.log;
const die = (msg) => {console.error(msg); process.exit(-1)}

try {
  var credentials = require(Path.join(process.cwd(), 'credentials.json'));
} catch (err) {
  die(
    'The `credentials.json` authentication file is missing or invalid.\n' +
    'See https://github.com/zenoamaro/gophersheet for instructions.'
  );
}

try {
  var configuration = require(Path.join(process.cwd(), 'gopherhole.json'));
} catch (err) {
  die(
    'The `gopherhole.json` configuration file is missing or invalid.\n' +
    'See https://github.com/zenoamaro/gophersheet for instructions.'
  );
}

const {
  SHEET_ID,
  FQDN = "localhost",
  ADDRESS = "::",
  PORT = 70
} = configuration;

async function start() {
  if (!credentials.private_key) die(
    '`private_key` is missing from `credentials.json`.\n' +
    'See https://github.com/zenoamaro/gophersheet for instructions.'
  );

  if (!SHEET_ID) die(
    'The `SHEET_ID` property is missing from `gopherhole.json`.\n' +
    'See https://github.com/zenoamaro/gophersheet for instructions.'
  );

  const doc = new GoogleSpreadsheet(SHEET_ID);
  await doc.useServiceAccountAuth(credentials);
  await doc.loadInfo();

  log('Serving sheet %o', doc.title);
  const server = Net.createServer(socket => serveConnection(doc, socket));
  server.listen(Number(PORT), ADDRESS, () => log('Listening on %s:%s', ADDRESS, PORT));
}

function serveConnection(doc, socket) {
  socket.on('data', async (chunk) => {
    const selector = chunk.toString().split('\n')[0].trim() || '/';
    log('%s - %s - %s', new Date(), socket.address().address, selector);
    const response = await serveRequest(doc, selector);
    socket.write(response.concat('.').join('\n'));
    socket.end();
  });
}

async function serveRequest(doc, selector) {
  const sheet = Object.values(doc.sheetsById).find(s => s.title === selector);
  if (!sheet) return ['3Resource not found'];
  return (await sheet.getRows()).map(renderLineItem);
}

function renderLineItem(row) {
  let [
    type = 'i',
    title = '',
    selector = '',
    host = FQDN,
    port = (host === FQDN ? PORT : 70),
  ] = row._rawData;

  type = type.trim().charAt(0) || 'i';
  if (type === 'h' && !selector.startsWith('URL:')) selector = `URL:${selector}`;
  return `${type}${title}\t${selector}\t${host}\t${port}`;
}

start().catch(err => die(err.message));
