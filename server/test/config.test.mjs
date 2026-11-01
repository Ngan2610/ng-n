import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadLocalEnvironment, printDatabaseSettings, databaseConfig, connectionErrorMessage } from '../src/config.js';
import { connect } from '../src/db.js';

const keys = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
async function fixture(fn) {
  const prior = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  for (const key of keys) delete process.env[key];
  const dir = await mkdtemp(join(tmpdir(), 'cnpm-config-'));
  try { await fn(dir); }
  finally {
    for (const key of keys) {
      if (prior[key] === undefined) delete process.env[key]; else process.env[key] = prior[key];
    }
    await rm(dir, { recursive: true, force: true });
  }
}

test('diagnostic uses same root file loader and reports inherited override names without password values', async () => fixture(async (dir) => {
  const file = join(dir, '.env');
  await writeFile(file, 'DB_HOST=localhost\nDB_PORT=1433\nDB_USER=sa\nDB_PASSWORD="fixture-only-not-a-real-secret"\nDB_NAME=DubchefDB\n');
  process.env.DB_PORT = '14330';
  const loaded = loadLocalEnvironment(file);
  assert.equal(loaded.found, true);
  assert.deepEqual(loaded.inherited, ['DB_PORT']);
  assert.equal(process.env.DB_HOST, 'localhost');
  assert.equal(process.env.DB_PORT, '14330');
  const lines = [];
  printDatabaseSettings(loaded, (line) => lines.push(line));
  assert.ok(lines.some((line) => line.includes('localhost,14330')));
  assert.ok(lines.some((line) => line.includes('DB_PORT')));
  assert.ok(!lines.join('\n').includes('fixture-only-not-a-real-secret'));
}));

test('diagnostic identifies Windows .env.txt filename mistake', async () => fixture(async (dir) => {
  const file = join(dir, '.env');
  await writeFile(file + '.txt', 'DB_HOST=localhost');
  const loaded = loadLocalEnvironment(file);
  assert.equal(loaded.found, false);
  assert.equal(loaded.textFileExists, true);
  const lines = [];
  printDatabaseSettings(loaded, (line) => lines.push(line));
  assert.ok(lines.some((line) => line.includes('.env.txt')));
}));

test('SQL login failure stops after one attempt and does not retry an invalid account', async () => fixture(async () => {
  process.env.DB_PASSWORD = 'fixture-password';
  let attempts = 0;
  const failure = Object.assign(new Error('login failure'), { code: 'ELOGIN' });
  await assert.rejects(connect('master', 60, (options) => ({ connect: async () => {
    attempts++;
    assert.equal(options.port, 1433);
    throw failure;
  } })), (error) => error === failure);
  assert.equal(attempts, 1);
  assert.match(connectionErrorMessage(failure), /CNPM\/.env/);
}));

test('invalid SQL configuration fails before attempting a connection', async () => fixture(async () => {
  let attempts = 0;
  await assert.rejects(connect('master', 60, () => { attempts++; }), /DB_PASSWORD/);
  assert.equal(attempts, 0);
  process.env.DB_PASSWORD = 'fixture-password';
  process.env.DB_PORT = 'localhost,1433';
  assert.throws(() => databaseConfig('master'), /DB_PORT/);
}));
