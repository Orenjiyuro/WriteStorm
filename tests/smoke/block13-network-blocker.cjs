'use strict';

const { writeFileSync } = require('node:fs');

const observationPath = process.env.WRITESTORM_BLOCK13_NETWORK_OBSERVATION;
const attemptedKinds = new Set();
let attemptCount = 0;

if (!observationPath) {
  throw new Error('Block 13 network observation path is missing.');
}
installNetworkBlockers();
writeObservation();
process.on('exit', writeObservation);

function installNetworkBlockers() {
  const block = (kind) => function blockedNetworkOperation() {
    attemptCount += 1;
    attemptedKinds.add(kind);
    writeObservation();
    throw new Error(`Block 13 offline smoke blocked ${kind}.`);
  };

  globalThis.fetch = block('fetch');

  const net = require('node:net');
  net.Socket.prototype.connect = block('net.socket.connect');
  net.connect = block('net.connect');
  net.createConnection = block('net.createConnection');

  const tls = require('node:tls');
  tls.connect = block('tls.connect');

  for (const moduleName of ['node:http', 'node:https']) {
    const transport = require(moduleName);
    const prefix = moduleName.slice('node:'.length);
    transport.request = block(`${prefix}.request`);
    transport.get = block(`${prefix}.get`);
  }

  const dns = require('node:dns');
  for (const methodName of [
    'lookup',
    'resolve',
    'resolve4',
    'resolve6',
    'resolveAny',
    'resolveCaa',
    'resolveCname',
    'resolveMx',
    'resolveNaptr',
    'resolveNs',
    'resolvePtr',
    'resolveSoa',
    'resolveSrv',
    'resolveTxt',
    'reverse',
  ]) {
    dns[methodName] = block(`dns.${methodName}`);
  }
}

function writeObservation() {
  writeFileSync(observationPath, `${JSON.stringify({
    schemaVersion: 1,
    installed: true,
    attemptCount,
    attemptedKinds: [...attemptedKinds].sort(),
  })}\n`, 'utf8');
}
