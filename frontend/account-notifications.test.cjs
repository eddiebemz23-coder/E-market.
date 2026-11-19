'use strict';

// Run with: node --test account-notifications.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const zod = require('zod');

const SOURCE_FILES = new Set([
  'src/lib/email.ts',
  'src/lib/otp.ts',
  'src/lib/auth/options.ts',
  'src/lib/services/accounts.ts',
  'src/lib/services/moderation.ts',
  'src/lib/services/shops.ts',
  'src/lib/auth/password.ts',
  'src/lib/validation/auth.ts',
  'src/lib/validation/common.ts',
  'src/lib/validation/enums.ts',
  'src/lib/geo-africa.ts',
]);
const compiled = new Map();
const quietConsole = { warn() {}, error() {}, log() {} };

function loadTs(file, mocks, globals = {}) {
  assert.ok(SOURCE_FILES.has(file), `Source is not allowlisted: ${file}`);
  const filename = path.resolve(__dirname, file);
  if (!compiled.has(file)) {
    compiled.set(file, ts.transpileModule(readFileSync(filename, 'utf8'), {
      fileName: filename,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText);
  }
  const module = { exports: {} };
  const allowed = new Map(Object.entries(mocks));
  const requireMock = (specifier) => {
    if (!allowed.has(specifier)) throw new Error(`Unmocked import in ${file}: ${specifier}`);
    return allowed.get(specifier);
  };
  const execute = new vm.Script(
    `(function (exports, require, module) {\n${compiled.get(file)}\n})`,
    { filename },
  ).runInNewContext({
    console: quietConsole,
    // Never expose the host process or its environment (including secrets).
    process: Object.freeze({ env: Object.freeze({}) }),
    ...globals,
  }, { timeout: 1000 });
  execute(module.exports, requireMock, module);
  return module.exports;
}

function strictMocks(t, object, label) {
  const violations = [];
  t.after(() => assert.deepEqual(violations, [], 'Unexpected mock access must not be swallowed'));
  function wrap(value, name) {
    if (!value || typeof value !== 'object') return value;
    const target = Object.fromEntries(Object.entries(value).map(([key, item]) => [key, wrap(item, `${name}.${key}`)]));
    return new Proxy(target, {
      get(current, key) {
        if (Object.hasOwn(current, key)) return current[key];
        const message = `Unmocked access: ${name}.${String(key)}`;
        violations.push(message);
        throw new Error(message);
      },
    });
  }
  return wrap(object, label);
}

const plain = (value) => JSON.parse(JSON.stringify(value));
const copy = (value) => structuredClone(value);
const nextTurn = () => new Promise((resolve) => setImmediate(resolve));
function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}
function check(name, fn) { test(name, { timeout: 5000 }, fn); }
function project(row, select) {
  if (!row) return null;
  return copy(select ? Object.fromEntries(Object.keys(select).map((key) => [key, row[key]])) : row);
}
function assignDefined(row, data) {
  for (const [key, value] of Object.entries(data)) if (value !== undefined) row[key] = copy(value);
  return row;
}
function ordered(events, ...expected) {
  let previous = -1;
  for (const event of expected) {
    const index = events.indexOf(event, previous + 1);
    assert.ok(index > previous, `Expected ${expected.join(' < ')}; got ${events.join(', ')}`);
    previous = index;
  }
}
function noSensitiveText(messages, values) {
  const text = JSON.stringify(messages);
  for (const value of values) assert.equal(text.includes(value), false, `Notification leaked fixture value: ${value}`);
}

const USER_ID = 'user-amina-001';
const OLD_EMAIL = 'amina.old@example.test';
const NEW_EMAIL = 'amina.new@example.test';
const CURRENT_PASSWORD = 'Current-example-71!';
const NEW_PASSWORD = 'Replacement-example-82!';
const OLD_HASH = '$2b$12$fixture-old-hash-not-a-real-credential';
const NEW_HASH = '$2b$12$fixture-new-hash-not-a-real-credential';
const VERIFIED_AT = new Date('2026-10-01T12:00:00Z');
function userRow(overrides = {}) {
  return {
    id: USER_ID, name: 'Amina N.', phone: '+256772123456', email: OLD_EMAIL,
    role: 'BUYER', avatarUrl: null, preferredCurrency: 'UGX', languageCode: 'sw',
    phoneVerified: VERIFIED_AT, emailVerified: VERIFIED_AT,
    createdAt: new Date('2025-05-06T09:00:00Z'), gender: 'FEMALE',
    marketingOptIn: true, whatsappOptIn: true, passwordHash: OLD_HASH,
    failedLoginCount: 3, lockedUntil: new Date('2026-11-16T15:00:00Z'),
    ...overrides,
  };
}

function emailFixture(t, options = {}) {
  const events = options.events ?? [];
  const rows = [];
  const mails = [];
  const logs = [];
  const lookups = [];
  const transports = [];
  const updates = [];
  const config = {
    NODE_ENV: 'production', SMTP_HOST: 'smtp.example.test', SMTP_PORT: 587,
    SMTP_USER: 'mailer@example.test', SMTP_PASS: 'fixture-only-smtp-password',
    EMAIL_FROM: 'Bemz <notices@example.test>', ...options.config,
  };
  const prisma = strictMocks(t, {
    user: {
      async findUnique(query) {
        lookups.push(plain(query));
        events.push('email.lookup');
        return options.lookup ? options.lookup(query) : { email: OLD_EMAIL };
      },
    },
    notification: {
      async create({ data }) {
        if (options.createError) throw options.createError;
        const row = { id: `notification-${rows.length + 1}`, ...copy(data) };
        rows.push(row);
        events.push('notification.queued');
        return copy(row);
      },
      async update({ where, data }) {
        updates.push({ where: plain(where), data: plain(data) });
        if (options.updateError) throw options.updateError;
        const row = rows.find((item) => item.id === where.id);
        assert.ok(row, 'Notification update must target a queued row');
        assignDefined(row, data);
        events.push(`notification.${data.status.toLowerCase()}`);
        return copy(row);
      },
    },
  }, 'email.prisma');
  const api = loadTs('src/lib/email.ts', {
    'server-only': {},
    './prisma': { prisma },
    './env': { env: () => config },
    nodemailer: {
      createTransport(settings) {
        transports.push(plain(settings));
        return {
          async sendMail(input) {
            mails.push(plain(input));
            events.push(`smtp.start:${input.to}`);
            const result = options.sendMail ? await options.sendMail(input) : { messageId: `test-smtp-${mails.length}` };
            events.push(`smtp.finish:${input.to}`);
            return result;
          },
        };
      },
    },
  }, { console: Object.fromEntries(['warn', 'error', 'log'].map((level) => [level, (...args) => logs.push({ level, args })])) });
  return { ...api, rows, mails, logs, events, lookups, transports, updates };
}

const notice = (overrides = {}) => ({
  userId: USER_ID, template: 'profile_updated', subject: 'Account details changed',
  message: 'Your account name changed.', ...overrides,
});

function serviceFixture(t, database, options = {}) {
  const events = options.events ?? [];
  const email = emailFixture(t, { ...options.email, events, lookup: options.lookup ?? (async () => ({ email: OLD_EMAIL })) });
  const notices = [];
  const credentialCalls = [];
  const password = loadTs('src/lib/auth/password.ts', {
    bcryptjs: {
      async hash(value) { credentialCalls.push(['hash', value]); return NEW_HASH; },
      async compare(value, hash) {
        credentialCalls.push(['verify', value, hash]);
        return value === CURRENT_PASSWORD && hash === OLD_HASH;
      },
    },
  });
  const http = Object.fromEntries([
    ['conflict', 409], ['forbidden', 403], ['notFound', 404], ['unprocessable', 422],
  ].map(([name, status]) => [name, (message) => Object.assign(new Error(message), { status })]));
  function phone(raw) {
    const number = raw.replace(/[ ()-]/g, '');
    return /^\+[1-9]\d{8,14}$/.test(number)
      ? { ok: true, phone: { e164: number, region: 'UG' } }
      : { ok: false, message: 'Invalid fixture phone' };
  }
  const deps = {
    'server-only': {},
    '../prisma': { prisma: strictMocks(t, database, 'accounts.prisma') },
    '../auth/password': password,
    '../phone': {
      tryNormalisePhone: phone,
      normalisePhone(raw) {
        const result = phone(raw);
        if (!result.ok) throw http.unprocessable(result.message);
        return result.phone;
      },
    },
    '../http': http,
    '../slug': { uniqueSlug: async (value) => value.toLowerCase().replace(/\s+/g, '-'), shopSlugTaken: async () => false },
    '../email': {
      async notifyAccountChange(input) {
        notices.push(copy(input));
        events.push('notify.start');
        await email.notifyAccountChange(input);
        events.push('notify.finish');
      },
    },
  };
  return {
    api: loadTs('src/lib/services/accounts.ts', deps), email, notices, events, credentialCalls,
    loadModeration: () => loadTs('src/lib/services/moderation.ts', { ...deps, '../env': {} }),
    loadShops: () => loadTs('src/lib/services/shops.ts', {
      ...deps,
      '../env': { env() { throw new Error('Environment access is not expected in shop change tests'); } },
      '../cloudinary': strictMocks(t, {
        async destroyAsset() { events.push('asset.destroy'); return true; },
      }, 'cloudinary'),
    }),
  };
}

function profileFixture(t, options = {}) {
  let user = options.user === null ? null : userRow(options.user);
  const events = [];
  const writes = [];
  const reads = [];
  const conflicts = [];
  const harness = serviceFixture(t, {
    user: {
      async findUnique(query) { reads.push(plain(query)); return project(user, query.select); },
      async findFirst(query) { conflicts.push(plain(query)); return options.duplicate ? { id: 'another-user' } : null; },
      async update(query) {
        writes.push(plain(query));
        events.push('user.write.start');
        if (options.writeGate) await options.writeGate.promise;
        if (options.writeError) throw options.writeError;
        assignDefined(user, query.data);
        events.push('user.committed');
        return project(user, query.select);
      },
    },
  }, { events, email: options.email, lookup: async (query) => project(user, query.select) });
  return { ...harness, writes, reads, conflicts, get user() { return copy(user); } };
}

check('loader blocks any non-allowlisted source and any import without an explicit mock', () => {
  assert.throws(() => loadTs('src/lib/env.ts', {}), /not allowlisted/);
  assert.throws(() => loadTs('src/lib/email.ts', { 'server-only': {} }), /Unmocked import.*nodemailer/);
});

check('notifyAccountChange looks up the account email, queues and awaits an SMTP delivery', async (t) => {
  const f = emailFixture(t);
  await f.notifyAccountChange(notice());
  assert.deepEqual(f.lookups, [{ where: { id: USER_ID }, select: { email: true } }]);
  assert.equal(f.mails.length, 1);
  assert.equal(f.mails[0].to, OLD_EMAIL);
  assert.equal(f.mails[0].from, 'Bemz <notices@example.test>');
  assert.equal(f.rows[0].userId, USER_ID);
  assert.equal(f.rows[0].channel, 'EMAIL');
  assert.equal(f.rows[0].template, 'profile_updated');
  assert.equal(f.rows[0].status, 'SENT');
  assert.ok(f.rows[0].sentAt);
  assert.match(f.mails[0].text, /Time \(UTC\): \d{4}-\d{2}-\d{2}T/);
  assert.match(f.mails[0].text, /contact Bemz support immediately/);
  assert.match(f.mails[0].text, /Never share your password or verification codes/);
  ordered(f.events, 'notification.queued', `smtp.start:${OLD_EMAIL}`, `smtp.finish:${OLD_EMAIL}`, 'notification.sent');
});

check('notifyAccountChange normalizes and deduplicates recipients without looking up the default', async (t) => {
  const f = emailFixture(t);
  await f.notifyAccountChange(notice({ recipients: [OLD_EMAIL.toUpperCase(), ` ${OLD_EMAIL} `, NEW_EMAIL, null, ''] }));
  assert.deepEqual(f.mails.map((mail) => mail.to), [OLD_EMAIL, NEW_EMAIL]);
  assert.equal(f.lookups.length, 0);
  assert.equal(f.rows.length, 2);
  assert.equal(f.transports.length, 1, 'Reuse the isolated SMTP transport');
});

for (const [label, options, recipients] of [
  ['null email', { lookup: async () => ({ email: null }) }, undefined],
  ['missing user', { lookup: async () => null }, undefined],
  ['empty email', { lookup: async () => ({ email: '' }) }, undefined],
  ['explicit empty list', {}, []],
  ['null and empty recipients', {}, [null, '']],
]) {
  check(`notifyAccountChange skips ${label}`, async (t) => {
    const f = emailFixture(t, options);
    await f.notifyAccountChange(notice({ recipients }));
    assert.equal(f.rows.length, 0);
    assert.equal(f.mails.length, 0);
    assert.equal(f.transports.length, 0);
  });
}

check('notifyAccountChange skips whitespace-only recipients after normalization', async (t) => {
  const f = emailFixture(t);
  await f.notifyAccountChange(notice({ recipients: [null, '', ' \t '] }));
  assert.equal(f.mails.length, 0, 'A blank address must not be passed to SMTP');
  assert.equal(f.rows.length, 0);
});

for (const failingRecipient of [OLD_EMAIL, NEW_EMAIL]) {
  check(`notifyAccountChange attempts both addresses when ${failingRecipient} fails`, async (t) => {
    const f = emailFixture(t, {
      async sendMail({ to }) { if (to === failingRecipient) throw new Error('Fixture SMTP rejection'); return { messageId: 'accepted' }; },
    });
    await assert.doesNotReject(f.notifyAccountChange(notice({ recipients: [OLD_EMAIL, NEW_EMAIL] })));
    assert.deepEqual(f.mails.map((mail) => mail.to), [OLD_EMAIL, NEW_EMAIL]);
    assert.deepEqual(f.rows.map((row) => row.status), [OLD_EMAIL, NEW_EMAIL].map((to) => to === failingRecipient ? 'FAILED' : 'SENT'));
    assert.equal(f.logs.filter((log) => log.level === 'error').length, 1);
  });
}

check('notifyAccountChange waits for every recipient, even after another recipient fails', async (t) => {
  const gate = deferred();
  const started = deferred();
  t.after(() => gate.resolve());
  const f = emailFixture(t, {
    async sendMail({ to }) {
      if (to === OLD_EMAIL) throw new Error('First recipient failed');
      started.resolve();
      await gate.promise;
      return { messageId: 'delayed-delivery' };
    },
  });
  let settled = false;
  const operation = f.notifyAccountChange(notice({ recipients: [OLD_EMAIL, NEW_EMAIL] })).then(() => { settled = true; });
  await started.promise;
  await nextTurn();
  assert.equal(settled, false);
  assert.deepEqual(f.rows.map((row) => row.status), ['FAILED', 'QUEUED']);
  gate.resolve();
  await operation;
  assert.deepEqual(f.rows.map((row) => row.status), ['FAILED', 'SENT']);
});

for (const missing of ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS']) {
  check(`production missing ${missing} records FAILED and does not simulate or contact SMTP`, async (t) => {
    const f = emailFixture(t, { config: { [missing]: '' } });
    await assert.doesNotReject(f.notifyAccountChange(notice()));
    assert.equal(f.rows[0].status, 'FAILED');
    assert.equal(f.rows[0].providerMessageId, undefined);
    assert.equal(f.mails.length, 0);
    assert.equal(f.transports.length, 0);
    assert.equal(f.logs.some((log) => String(log.args[0]).includes('simulated')), false);
  });
}

check('sendEmail rejects when production SMTP is missing, after persisting FAILED', async (t) => {
  const f = emailFixture(t, { config: { SMTP_HOST: '' } });
  await assert.rejects(f.sendEmail({ ...notice(), to: OLD_EMAIL }), /not configured/);
  assert.equal(f.rows[0].status, 'FAILED');
});

check('development missing SMTP explicitly returns a simulated SENT notification', async (t) => {
  const f = emailFixture(t, { config: { NODE_ENV: 'development', SMTP_HOST: '', SMTP_USER: '', SMTP_PASS: '' } });
  const result = await f.sendEmail({ ...notice(), to: OLD_EMAIL });
  assert.deepEqual(plain(result), { providerMessageId: 'simulated:notification-1', simulated: true });
  assert.equal(f.rows[0].status, 'SENT');
  assert.equal(f.rows[0].providerMessageId, result.providerMessageId);
  assert.equal(f.mails.length, 0);
});

check('SMTP errors persist FAILED; the notifier catches errors without logging secrets', async (t) => {
  const secret = 'fixture-provider-credential-never-log';
  const f = emailFixture(t, { sendMail: async () => { throw new Error(secret); } });
  await assert.doesNotReject(f.notifyAccountChange(notice()));
  assert.equal(f.rows[0].status, 'FAILED');
  noSensitiveText(f.logs, [secret, 'fixture-only-smtp-password', OLD_EMAIL]);
});

for (const [name, options] of [
  ['recipient lookup fails', { lookup: async () => { throw new Error('Fixture database unavailable'); } }],
  ['notification creation fails', { createError: new Error('Fixture notification insert failure') }],
  ['failure persistence also fails', { sendMail: async () => { throw new Error('Fixture SMTP failure'); }, updateError: new Error('Fixture notification update failure') }],
]) {
  check(`notifier remains best effort when ${name}`, async (t) => {
    const f = emailFixture(t, options);
    await assert.doesNotReject(f.notifyAccountChange(notice()));
    assert.ok(f.logs.some((log) => log.level === 'error'));
  });
}

check('profile updates only supplied changed fields, preserves locale and verification, then emails', async (t) => {
  const f = profileFixture(t);
  const result = await f.api.updateProfile(USER_ID, { name: 'Amina K.', marketingOptIn: false, email: OLD_EMAIL });
  assert.deepEqual(f.writes[0].data, { name: 'Amina K.', marketingOptIn: false });
  assert.equal(result.name, 'Amina K.');
  assert.equal(result.languageCode, 'sw');
  assert.equal(f.user.emailVerified.toISOString(), VERIFIED_AT.toISOString());
  assert.equal(f.conflicts.length, 0);
  assert.equal(f.notices[0].template, 'profile_updated');
  assert.match(f.notices[0].message, /name, marketing preference/);
  assert.doesNotMatch(f.notices[0].message, /email address.*changed/);
  assert.equal(f.email.mails.length, 1, 'Same old/new address is deduplicated');
  assert.equal(Object.hasOwn(result, 'passwordHash'), false);
  ordered(f.events, 'user.committed', 'notify.start', `smtp.finish:${OLD_EMAIL}`, 'notify.finish');
});

check('unchanged profile returns the public user without writing or notifying', async (t) => {
  const f = profileFixture(t);
  const result = await f.api.updateProfile(USER_ID, { name: 'Amina N.', email: OLD_EMAIL, languageCode: 'sw', marketingOptIn: true });
  assert.equal(result.id, USER_ID);
  assert.equal(result.email, OLD_EMAIL);
  for (const privateField of ['gender', 'marketingOptIn', 'whatsappOptIn', 'passwordHash', 'emailVerified']) {
    assert.equal(Object.hasOwn(result, privateField), false);
  }
  assert.equal(f.writes.length, 0);
  assert.equal(f.notices.length, 0);
  assert.equal(f.conflicts.length, 0);
});

check('email replacement clears verification and notifies both previous and saved addresses', async (t) => {
  const f = profileFixture(t);
  const result = await f.api.updateProfile(USER_ID, { email: NEW_EMAIL });
  assert.deepEqual(f.writes[0].data, { email: NEW_EMAIL, emailVerified: null });
  assert.deepEqual(f.conflicts[0].where, { email: NEW_EMAIL, NOT: { id: USER_ID } });
  assert.equal(result.email, NEW_EMAIL);
  assert.deepEqual(plain(f.notices[0].recipients), [OLD_EMAIL, NEW_EMAIL]);
  assert.deepEqual(f.email.mails.map((mail) => mail.to), [OLD_EMAIL, NEW_EMAIL]);
  assert.match(f.notices[0].message, /does not verify the new address/);
  assert.equal(f.user.emailVerified, null);
});

check('adding the first profile email sends only to the new address', async (t) => {
  const f = profileFixture(t, { user: { email: null, emailVerified: null } });
  await f.api.updateProfile(USER_ID, { email: NEW_EMAIL });
  assert.deepEqual(f.email.mails.map((mail) => mail.to), [NEW_EMAIL]);
});

check('profile changes without an account email save without attempting SMTP', async (t) => {
  const f = profileFixture(t, { user: { email: null } });
  const result = await f.api.updateProfile(USER_ID, { name: 'Amina K.' });
  assert.equal(result.name, 'Amina K.');
  assert.equal(f.email.rows.length, 0);
  assert.equal(f.email.mails.length, 0);
});

for (const [name, options, patch, status] of [
  ['duplicate email', { duplicate: true }, { email: NEW_EMAIL }, 409],
  ['missing account', { user: null }, { name: 'Amina K.' }, 404],
  ['empty patch', {}, {}, 422],
]) {
  check(`profile rejects ${name} without a write or email`, async (t) => {
    const f = profileFixture(t, options);
    await assert.rejects(f.api.updateProfile(USER_ID, patch), { status });
    assert.equal(f.writes.length, 0);
    assert.equal(f.notices.length, 0);
    assert.equal(f.email.rows.length, 0);
  });
}

check('failed profile persistence sends no email and leaves the previous email verified', async (t) => {
  const failure = new Error('Fixture unique-constraint race');
  const f = profileFixture(t, { writeError: failure });
  await assert.rejects(f.api.updateProfile(USER_ID, { email: NEW_EMAIL }), (error) => error === failure);
  assert.equal(f.user.email, OLD_EMAIL);
  assert.equal(f.user.emailVerified.toISOString(), VERIFIED_AT.toISOString());
  assert.equal(f.notices.length, 0);
  assert.equal(f.email.rows.length, 0);
});

check('profile waits for the database save, then waits for notification delivery', async (t) => {
  const saveGate = deferred();
  const sendGate = deferred();
  const sendStarted = deferred();
  t.after(() => { saveGate.resolve(); sendGate.resolve(); });
  const f = profileFixture(t, {
    writeGate: saveGate,
    email: { async sendMail() { sendStarted.resolve(); await sendGate.promise; return { messageId: 'delayed' }; } },
  });
  let settled = false;
  const operation = f.api.updateProfile(USER_ID, { name: 'Amina K.' }).then((result) => { settled = true; return result; });
  await nextTurn();
  assert.equal(f.writes.length, 1);
  assert.equal(f.notices.length, 0, 'No notification may start before persistence succeeds');
  saveGate.resolve();
  await sendStarted.promise;
  await nextTurn();
  assert.equal(f.user.name, 'Amina K.');
  assert.equal(settled, false, 'Saved response must await SMTP, not fire and forget');
  sendGate.resolve();
  assert.equal((await operation).name, 'Amina K.');
});

for (const [name, email] of [
  ['SMTP rejection', { sendMail: async () => { throw new Error('Fixture SMTP failure'); } }],
  ['production SMTP missing', { config: { SMTP_PASS: '' } }],
  ['notification insert failure', { createError: new Error('Fixture notification failure') }],
]) {
  check(`saved profile still succeeds after ${name}`, async (t) => {
    const f = profileFixture(t, { email });
    const result = await f.api.updateProfile(USER_ID, { email: NEW_EMAIL });
    assert.equal(result.email, NEW_EMAIL);
    assert.equal(f.user.email, NEW_EMAIL);
    if (!email.createError) assert.deepEqual(f.email.rows.map((row) => row.status), ['FAILED', 'FAILED']);
  });
}

for (const firstPassword of [false, true]) {
  check(`password ${firstPassword ? 'addition' : 'change'} saves before notifying and never discloses credentials`, async (t) => {
    const f = profileFixture(t, { user: { passwordHash: firstPassword ? null : OLD_HASH } });
    const result = await f.api.changePassword(USER_ID, { currentPassword: firstPassword ? undefined : CURRENT_PASSWORD, newPassword: NEW_PASSWORD });
    assert.deepEqual(plain(result), { hasPassword: true });
    assert.deepEqual(f.writes[0].data, { passwordHash: NEW_HASH, failedLoginCount: 0, lockedUntil: null });
    assert.equal(f.credentialCalls.filter(([action]) => action === 'verify').length, firstPassword ? 0 : 1);
    assert.equal(f.notices[0].template, 'password_changed');
    assert.match(f.notices[0].message, firstPassword ? /added/ : /changed/);
    assert.equal(f.email.mails[0].to, OLD_EMAIL);
    noSensitiveText([f.notices, f.email.mails, f.email.rows], [CURRENT_PASSWORD, NEW_PASSWORD, OLD_HASH, NEW_HASH]);
    ordered(f.events, 'user.committed', 'notify.start', 'notify.finish');
  });
}

for (const currentPassword of ['wrong-current-99', undefined]) {
  check(`existing password rejects ${currentPassword ? 'incorrect' : 'missing'} current password without email`, async (t) => {
    const f = profileFixture(t);
    await assert.rejects(f.api.changePassword(USER_ID, { currentPassword, newPassword: NEW_PASSWORD }), { status: 403 });
    assert.equal(f.writes.length, 0);
    assert.equal(f.notices.length, 0);
    assert.equal(f.credentialCalls.some(([action]) => action === 'hash'), false);
  });
}

for (const newPassword of ['short1', 'lettersOnly', '1234567890']) {
  check(`weak password ${newPassword} is rejected by real strength validation without email`, async (t) => {
    const f = profileFixture(t);
    await assert.rejects(f.api.changePassword(USER_ID, { currentPassword: CURRENT_PASSWORD, newPassword }), { status: 422 });
    assert.equal(f.writes.length, 0);
    assert.equal(f.notices.length, 0);
    assert.equal(f.credentialCalls.some(([action]) => action === 'hash'), false);
  });
}

check('password removal commits before notifying and never includes the password or hash', async (t) => {
  const f = profileFixture(t);
  const result = await f.api.removePassword(USER_ID, { currentPassword: CURRENT_PASSWORD });
  assert.deepEqual(plain(result), { hasPassword: false });
  assert.deepEqual(f.writes[0].data, { passwordHash: null });
  assert.equal(f.user.passwordHash, null);
  assert.equal(f.notices[0].template, 'password_removed');
  assert.match(f.notices[0].message, /verification code/);
  noSensitiveText([f.notices, f.email.mails, f.email.rows], [CURRENT_PASSWORD, OLD_HASH, NEW_HASH]);
  ordered(f.events, 'user.committed', 'notify.start', 'notify.finish');
});

for (const [label, user, currentPassword, status] of [
  ['wrong current password', {}, 'wrong-password', 403],
  ['OTP-only account', { passwordHash: null }, CURRENT_PASSWORD, 422],
  ['missing account', null, CURRENT_PASSWORD, 422],
]) {
  check(`password removal rejects ${label} without writes or notices`, async (t) => {
    const f = profileFixture(t, { user });
    await assert.rejects(f.api.removePassword(USER_ID, { currentPassword }), { status });
    assert.equal(f.writes.length, 0);
    assert.equal(f.notices.length, 0);
  });
}

for (const method of ['changePassword', 'removePassword']) {
  check(`${method} sends nothing if saving fails`, async (t) => {
    const failure = new Error('Fixture user update failure');
    const f = profileFixture(t, { writeError: failure });
    await assert.rejects(f.api[method](USER_ID, { currentPassword: CURRENT_PASSWORD, newPassword: NEW_PASSWORD }), (error) => error === failure);
    assert.equal(f.user.passwordHash, OLD_HASH);
    assert.equal(f.notices.length, 0);
  });
  check(`${method} still succeeds when SMTP fails after saving`, async (t) => {
    const f = profileFixture(t, { email: { sendMail: async () => { throw new Error('Fixture SMTP failure'); } } });
    const result = await f.api[method](USER_ID, { currentPassword: CURRENT_PASSWORD, newPassword: NEW_PASSWORD });
    assert.equal(result.hasPassword, method === 'changePassword');
    assert.equal(f.email.rows[0].status, 'FAILED');
  });
}

const PAYOUT = {
  id: 'payout-account-001', shopId: 'shop-amina-001', provider: 'BANK',
  accountNumber: '998877665544', accountName: 'Amina N. Trading', bankName: 'Fixture Bank',
  isVerified: true, verifiedAt: VERIFIED_AT,
};
function payoutFixture(t, options = {}) {
  let account = options.account === null ? null : { ...PAYOUT, ...options.account };
  const writes = [];
  const ownerReads = [];
  const events = [];
  const harness = serviceFixture(t, {
    payoutAccount: {
      async findUnique({ where, select }) { assert.equal(where.shopId, PAYOUT.shopId); return project(account, select); },
      async upsert(query) {
        writes.push(plain(query));
        if (options.writeError) throw options.writeError;
        account = assignDefined(account ?? { id: PAYOUT.id, isVerified: false, verifiedAt: null }, account ? query.update : query.create);
        events.push('payout.committed');
        return project(account, query.select);
      },
    },
    shop: {
      async findUniqueOrThrow(query) {
        ownerReads.push(plain(query));
        if (options.missingShop) throw new Error('Fixture shop not found');
        return { ownerId: USER_ID };
      },
    },
  }, { events, email: options.email });
  return { ...harness, writes, ownerReads, get account() { return copy(account); } };
}
const payoutInput = (overrides = {}) => ({ provider: PAYOUT.provider, accountNumber: PAYOUT.accountNumber, accountName: PAYOUT.accountName, bankName: PAYOUT.bankName, ...overrides });

for (const omitBank of [false, true]) {
  check(`unchanged payout preserves verification and skips writes/emails with bank name ${omitBank ? 'omitted' : 'supplied'}`, async (t) => {
    const f = payoutFixture(t);
    const result = await f.api.upsertPayoutAccount(PAYOUT.shopId, payoutInput({ accountNumber: '9988 7766 5544', bankName: omitBank ? undefined : PAYOUT.bankName }));
    assert.equal(result.isVerified, true);
    assert.equal(f.account.verifiedAt.toISOString(), VERIFIED_AT.toISOString());
    assert.equal(f.writes.length, 0);
    assert.equal(f.ownerReads.length, 0);
    assert.equal(f.notices.length, 0);
  });
}

for (const changed of [
  { accountNumber: '112233445566' },
  { accountName: 'Amina Updated Trading' },
  { bankName: 'Another Fixture Bank' },
  { provider: 'MTN_MOMO', accountNumber: '+256 772 987654' },
]) {
  check(`payout change to ${Object.keys(changed).join('/')} invalidates verification and notifies the owner without financial details`, async (t) => {
    const f = payoutFixture(t);
    const input = payoutInput(changed);
    const result = await f.api.upsertPayoutAccount(PAYOUT.shopId, input);
    assert.equal(result.isVerified, false);
    assert.equal(f.account.verifiedAt, null);
    assert.equal(f.writes[0].update.isVerified, false);
    assert.equal(f.notices[0].userId, USER_ID);
    assert.equal(f.notices[0].template, 'payout_account_changed');
    assert.equal(f.email.lookups.length, 1, 'Payout notification resolves the owner account email');
    noSensitiveText([f.notices, f.email.mails, f.email.rows], [
      PAYOUT.accountNumber, input.accountNumber, result.accountNumber,
      PAYOUT.accountName, input.accountName, PAYOUT.bankName, input.bankName,
    ]);
    ordered(f.events, 'payout.committed', 'notify.start', 'notify.finish');
  });
}

check('first payout account notifies only after successful creation', async (t) => {
  const f = payoutFixture(t, { account: null });
  const result = await f.api.upsertPayoutAccount(PAYOUT.shopId, payoutInput());
  assert.equal(result.accountNumber, PAYOUT.accountNumber);
  assert.equal(result.isVerified, false);
  assert.equal(f.notices.length, 1);
  ordered(f.events, 'payout.committed', 'notify.start');
});

for (const [label, options, input, expected] of [
  ['failed save', { writeError: new Error('Fixture payout failure') }, payoutInput({ accountNumber: '112233445566' }), /payout failure/],
  ['missing shop', { missingShop: true }, payoutInput({ accountNumber: '112233445566' }), /shop not found/],
  ['invalid mobile money number', {}, payoutInput({ provider: 'MTN_MOMO', accountNumber: 'invalid' }), { status: 422 }],
]) {
  check(`payout ${label} sends no email`, async (t) => {
    const f = payoutFixture(t, options);
    await assert.rejects(f.api.upsertPayoutAccount(PAYOUT.shopId, input), expected);
    assert.equal(f.notices.length, 0);
    assert.equal(f.account.isVerified, true);
  });
}

const DISTRICT = {
  id: 101, name: 'Kampala', code: 'KLA', isMajor: true, countryId: 1,
  country: { code: 'UG', name: 'Uganda', currency: 'UGX', isActive: true },
  zone: { id: 10, name: 'Kampala Metro', code: 'KLA-METRO', cashOnDeliveryAllowed: true, estimatedDaysMin: 1, estimatedDaysMax: 2 },
};
function addressRow(overrides = {}) {
  return {
    id: 'address-home-001', userId: USER_ID, label: 'Home', recipientName: 'Amina N.',
    recipientPhone: '+256772123456', alternativePhone: null, countryId: 1, districtId: 101,
    district: copy(DISTRICT), subcounty: 'Central', parish: 'Nakasero', village: null,
    streetAddress: '17 Fixture Road', nearestLandmark: 'Fixture Library',
    deliveryNote: 'Use the blue gate', lat: 0.3136, lng: 32.5811, pinCode: null,
    isDefault: true, archivedAt: null, createdAt: new Date('2026-10-20T10:00:00Z'),
    ...overrides,
  };
}
const ADDRESS_INPUT = {
  label: 'Office', recipientName: 'Amina N.', recipientPhone: '+256 772 123456',
  districtId: 101, streetAddress: '44 Fixture Avenue', nearestLandmark: 'Fixture Workshop',
  deliveryNote: 'Call on arrival', isDefault: false,
};
function addressFixture(t, options = {}) {
  let rows = copy(options.rows ?? [addressRow(), addressRow({ id: 'address-office-002', label: 'Office', isDefault: false })]);
  const events = [];
  const operations = [];
  function match(row, where = {}) {
    return Object.entries(where).every(([key, value]) => {
      if (key === 'id' && value && typeof value === 'object') return row.id !== value.not;
      return row[key] === value;
    });
  }
  const harness = serviceFixture(t, {
    district: { async findUnique() { return options.invalidDistrict ? null : copy(DISTRICT); } },
    shippingAddress: {
      async count({ where }) { return rows.filter((row) => match(row, where)).length; },
      async findUnique({ where, select }) { return project(rows.find((row) => match(row, where)), select); },
      async findUniqueOrThrow({ where }) {
        const row = rows.find((item) => match(item, where));
        assert.ok(row, 'Fixture address must exist');
        return copy(row);
      },
    },
    async $transaction(callback) {
      events.push('transaction.begin');
      let working = copy(rows);
      function write(name, query) {
        operations.push({ name, ...plain(query) });
        if (options.writeError) throw options.writeError;
      }
      const tx = strictMocks(t, {
        shippingAddress: {
          async updateMany(query) {
            write('updateMany', query);
            const matches = working.filter((row) => match(row, query.where));
            for (const row of matches) assignDefined(row, query.data);
            return { count: matches.length };
          },
          async create(query) {
            write('create', query);
            const row = assignDefined(addressRow({ id: 'address-created-003', isDefault: false }), query.data);
            working.push(row);
            return copy(row);
          },
          async update(query) {
            write('update', query);
            const row = working.find((item) => match(item, query.where));
            assert.ok(row);
            const { district, ...data } = query.data;
            assignDefined(row, data);
            if (district) { row.districtId = district.connect.id; row.district = copy(DISTRICT); }
            return copy(row);
          },
          async findUnique({ where, select }) { return project(working.find((row) => match(row, where)), select); },
          async findFirst({ where, select }) {
            const candidates = working.filter((row) => match(row, where)).sort((a, b) => b.createdAt - a.createdAt);
            return project(candidates[0], select);
          },
          async delete(query) { write('delete', query); working = working.filter((row) => !match(row, query.where)); },
        },
      }, 'address.transaction');
      try {
        const result = await callback(tx);
        events.push('transaction.ready');
        if (options.commitGate) await options.commitGate.promise;
        if (options.commitError) throw options.commitError;
        rows = working;
        events.push('transaction.committed');
        return result;
      } catch (error) {
        events.push('transaction.rolled-back');
        throw error;
      }
    },
  }, { events, email: options.email });
  return { ...harness, operations, get rows() { return copy(rows); } };
}
const addressAction = (f, action, patch = { label: 'Updated home' }) => action === 'create'
  ? f.api.createAddress(USER_ID, ADDRESS_INPUT)
  : action === 'update'
    ? f.api.updateAddress(USER_ID, 'address-home-001', patch)
    : f.api.deleteAddress(USER_ID, 'address-home-001');

for (const [action, template] of [['create', 'address_added'], ['update', 'address_updated'], ['delete', 'address_deleted']]) {
  check(`address ${action} waits for transaction commit, then awaits email`, async (t) => {
    const commitGate = deferred();
    const sendGate = deferred();
    const sendStarted = deferred();
    t.after(() => { commitGate.resolve(); sendGate.resolve(); });
    const f = addressFixture(t, {
      commitGate,
      email: { async sendMail() { sendStarted.resolve(); await sendGate.promise; return { messageId: 'address-mail' }; } },
    });
    let settled = false;
    const operation = addressAction(f, action).then((result) => { settled = true; return result; });
    await nextTurn();
    assert.ok(f.events.includes('transaction.ready'));
    assert.equal(f.notices.length, 0);
    assert.equal(settled, false);
    commitGate.resolve();
    await sendStarted.promise;
    await nextTurn();
    assert.equal(settled, false);
    assert.equal(f.notices[0].template, template);
    assert.equal(f.notices[0].userId, USER_ID);
    sendGate.resolve();
    const result = await operation;
    if (action === 'create') assert.equal(result.label, 'Office');
    if (action === 'update') assert.equal(result.label, 'Updated home');
    if (action === 'delete') {
      assert.equal(result.deletedDefaultReassigned, true);
      assert.equal(f.rows.length, 1);
      assert.equal(f.rows[0].isDefault, true);
    }
    ordered(f.events, 'transaction.committed', 'notify.start', `smtp.finish:${OLD_EMAIL}`, 'notify.finish');
    noSensitiveText([f.notices, f.email.mails], [ADDRESS_INPUT.streetAddress, ADDRESS_INPUT.recipientPhone, '17 Fixture Road', 'Use the blue gate']);
  });
  for (const failureStage of ['writeError', 'commitError']) {
    check(`address ${action} ${failureStage} rolls back without notification`, async (t) => {
      const failure = new Error(`Fixture ${failureStage}`);
      const f = addressFixture(t, { [failureStage]: failure });
      const before = f.rows;
      await assert.rejects(addressAction(f, action), (error) => error === failure);
      assert.deepEqual(f.rows, before);
      assert.equal(f.notices.length, 0);
      assert.equal(f.email.rows.length, 0);
      assert.ok(f.events.includes('transaction.rolled-back'));
    });
  }
  check(`address ${action} remains successful if SMTP fails after commit`, async (t) => {
    const f = addressFixture(t, { email: { sendMail: async () => { throw new Error('Fixture SMTP failure'); } } });
    await assert.doesNotReject(addressAction(f, action));
    assert.equal(f.email.rows[0].status, 'FAILED');
    ordered(f.events, 'transaction.committed', 'notify.start');
  });
}

check('first address becomes default and sends one notification', async (t) => {
  const f = addressFixture(t, { rows: [] });
  const result = await f.api.createAddress(USER_ID, ADDRESS_INPUT);
  assert.equal(result.isDefault, true);
  assert.equal(result.recipientPhone, '+256772123456');
  assert.equal(f.notices.length, 1);
});

for (const patch of [{}, { label: 'Home', recipientPhone: '+256 772 123456', districtId: 101, lat: 0.3136 }, { isDefault: true }, { archived: false }]) {
  check(`unchanged address ${JSON.stringify(patch)} suppresses notification`, async (t) => {
    const f = addressFixture(t);
    const result = await f.api.updateAddress(USER_ID, 'address-home-001', patch);
    assert.equal(result.label, 'Home');
    assert.equal(f.notices.length, 0);
    assert.equal(f.email.rows.length, 0);
  });
}

check('archiving the default address reassigns default and notifies once after both writes', async (t) => {
  const f = addressFixture(t);
  const result = await f.api.updateAddress(USER_ID, 'address-home-001', { archived: true });
  assert.equal(result.isDefault, false);
  assert.ok(f.rows[0].archivedAt);
  assert.equal(f.rows[1].isDefault, true);
  assert.equal(f.notices.length, 1);
  ordered(f.events, 'transaction.committed', 'notify.start');
});

check('changing only the default address sends a notification', async (t) => {
  const f = addressFixture(t);
  await f.api.updateAddress(USER_ID, 'address-office-002', { isDefault: true });
  assert.equal(f.rows[0].isDefault, false);
  assert.equal(f.rows[1].isDefault, true);
  assert.equal(f.notices[0].template, 'address_updated');
});

for (const action of ['update', 'delete']) {
  for (const [label, rows, status] of [
    ['another user', [addressRow({ userId: 'different-user' })], 403],
    ['missing address', [], 404],
  ]) {
    check(`address ${action} rejects ${label} before transaction or email`, async (t) => {
      const f = addressFixture(t, { rows });
      await assert.rejects(addressAction(f, action), { status });
      assert.equal(f.events.includes('transaction.begin'), false);
      assert.equal(f.notices.length, 0);
    });
  }
}

for (const action of ['create', 'update']) {
  check(`address ${action} rejects invalid district without email`, async (t) => {
    const f = addressFixture(t, { invalidDistrict: true });
    await assert.rejects(addressAction(f, action, { districtId: 999 }), { status: 422 });
    assert.equal(f.events.includes('transaction.begin'), false);
    assert.equal(f.notices.length, 0);
  });
}

const geo = loadTs('src/lib/geo-africa.ts', {});
const enums = loadTs('src/lib/validation/enums.ts', { '../geo-africa': geo });
const common = loadTs('src/lib/validation/common.ts', { zod, './enums': enums });
const validation = loadTs('src/lib/validation/auth.ts', { zod, './common': common, './enums': enums });

check('real profile schema leaves omitted locale absent instead of defaulting to English', async (t) => {
  const patch = validation.updateProfileSchema.parse({ name: 'Amina K.' });
  assert.equal(patch.languageCode, undefined);
  assert.equal(Object.hasOwn(patch, 'languageCode'), false);
  const f = profileFixture(t);
  const result = await f.api.updateProfile(USER_ID, patch);
  assert.equal(result.languageCode, 'sw');
  assert.equal(Object.hasOwn(f.writes[0].data, 'languageCode'), false);
  assert.doesNotMatch(f.notices[0].message, /language/);
});

check('real profile schema accepts explicit supported locales and rejects invalid ones', async (t) => {
  for (const languageCode of ['en', 'sw', 'lg']) {
    assert.equal(validation.updateProfileSchema.parse({ languageCode }).languageCode, languageCode);
  }
  assert.equal(validation.updateProfileSchema.safeParse({ languageCode: 'invalid' }).success, false);
  assert.equal(validation.updateProfileSchema.safeParse({ languageCode: null }).success, false);
  const f = profileFixture(t);
  await f.api.updateProfile(USER_ID, validation.updateProfileSchema.parse({ languageCode: 'lg' }));
  assert.deepEqual(f.writes[0].data, { languageCode: 'lg' });
  assert.match(f.notices[0].message, /language/);
});

check('real profile schema normalizes unchanged email and does not reset locale or verification', async (t) => {
  const f = profileFixture(t);
  const patch = validation.updateProfileSchema.parse({ email: ` ${OLD_EMAIL.toUpperCase()} ` });
  await f.api.updateProfile(USER_ID, patch);
  assert.equal(f.writes.length, 0);
  assert.equal(f.notices.length, 0);
  assert.equal(f.user.languageCode, 'sw');
  assert.equal(f.user.emailVerified.toISOString(), VERIFIED_AT.toISOString());
});

const SHOP = {
  id: 'shop-amina-001', ownerId: USER_ID, name: 'Amina Crafts', slug: 'amina-crafts',
  phone: '+256772123456', email: 'shop-contact@example.test', whatsappNumber: null,
  tagline: 'Handmade locally', description: 'Crafts from Kampala', streetAddress: '17 Fixture Road',
  countryId: 1, baseDistrictId: 101, defaultFulfilment: 'SELLER_DELIVERY', dispatchSlaHours: 24,
  status: 'ACTIVE', kycStatus: 'NOT_SUBMITTED', vacationMode: false,
  logoUrl: 'https://images.example.test/old-logo.png', logoPublicId: 'fixture/old-logo',
  bannerUrl: null, bannerPublicId: null,
};

check('shop creation notifies the account owner after shop creation and seller promotion', async (t) => {
  const events = [];
  let saved;
  const f = serviceFixture(t, {
    shop: {
      async findFirst() { return null; },
      async create({ data, select }) { saved = { ...SHOP, ...copy(data) }; events.push('shop.created'); return project(saved, select); },
    },
    district: { async findUnique() { return copy(DISTRICT); } },
    user: { async updateMany(query) { assert.deepEqual(plain(query), { where: { id: USER_ID, role: 'BUYER' }, data: { role: 'SELLER' } }); events.push('seller.promoted'); return { count: 1 }; } },
  }, { events });
  const result = await f.api.createShop(USER_ID, { ...SHOP, country: 'UG' });
  assert.equal(result.name, SHOP.name);
  assert.equal(saved.status, 'PENDING');
  assert.equal(f.notices[0].template, 'seller_account_created');
  assert.equal(f.email.mails[0].to, OLD_EMAIL, 'Notify account email, not public shop contact');
  ordered(events, 'shop.created', 'seller.promoted', 'notify.start', 'notify.finish');
});

function shopFixture(t, options = {}) {
  let shop = { ...SHOP, ...options.shop };
  const events = [];
  const writes = [];
  const f = serviceFixture(t, {
    shop: {
      async update(query) {
        writes.push(plain(query));
        if (options.writeError) throw options.writeError;
        assignDefined(shop, query.data);
        events.push('shop.committed');
        return project(shop, query.select);
      },
    },
  }, { events, email: options.email });
  return { ...f, shops: f.loadShops(), writes, get shop() { return copy(shop); } };
}

for (const [name, action, template] of [
  ['details', (f) => f.shops.updateShop(f.shop, { tagline: 'New handmade collection' }), 'shop_updated'],
  ['vacation', (f) => f.shops.setVacationMode(f.shop, true), 'shop_vacation_changed'],
  ['logo', (f) => f.shops.setShopMedia(f.shop, { kind: 'logo', url: 'https://images.example.test/new-logo.png', publicId: 'fixture/new-logo' }), 'shop_media_updated'],
]) {
  check(`shop ${name} change commits before notifying the owner`, async (t) => {
    const f = shopFixture(t);
    await action(f);
    assert.equal(f.notices.length, 1);
    assert.equal(f.notices[0].userId, USER_ID);
    assert.equal(f.notices[0].template, template);
    ordered(f.events, 'shop.committed', 'notify.start', 'notify.finish');
  });
  check(`shop ${name} failed save sends no notification`, async (t) => {
    const f = shopFixture(t, { writeError: new Error('Fixture shop write failure') });
    await assert.rejects(action(f), /shop write failure/);
    assert.equal(f.notices.length, 0);
    assert.equal(f.events.includes('asset.destroy'), false);
  });
}

for (const [name, action] of [
  ['details', (f) => f.shops.updateShop(f.shop, { tagline: SHOP.tagline })],
  ['vacation', (f) => f.shops.setVacationMode(f.shop, false)],
  ['logo', (f) => f.shops.setShopMedia(f.shop, { kind: 'logo', url: SHOP.logoUrl, publicId: SHOP.logoPublicId })],
]) {
  check(`unchanged shop ${name} sends no notification`, async (t) => {
    const f = shopFixture(t);
    await action(f);
    assert.equal(f.notices.length, 0);
    assert.equal(f.email.rows.length, 0);
  });
}

check('a suspended shop cannot disable vacation mode or send a misleading notice', async (t) => {
  const f = shopFixture(t, { shop: { status: 'SUSPENDED', vacationMode: true } });
  await assert.rejects(f.shops.setVacationMode(f.shop, false), { status: 403 });
  assert.equal(f.writes.length, 0);
  assert.equal(f.notices.length, 0);
});

function otpFixture(t, options = {}) {
  const crypto = require('node:crypto');
  const events = [];
  const email = emailFixture(t, { events });
  const secret = 'isolated-test-hmac-key';
  const code = '123456';
  const phone = '+256772123456';
  let user = userRow({ status: 'PENDING_VERIFICATION', phoneVerified: null, emailVerified: null, ...options.user });
  class ApiError extends Error {
    constructor(status, code, message) { super(message); this.status = status; this.code = code; }
  }
  const prisma = strictMocks(t, {
    phoneOtpCode: {
      async findFirst() {
        return options.expired ? null : {
          id: 'otp-fixture', attempts: 0, maxAttempts: 5,
          codeHash: crypto.createHmac('sha256', secret).update(`${phone}:LOGIN:${code}`).digest('hex'),
        };
      },
      async update() { events.push('otp.updated'); },
    },
    user: {
      async findUnique() { return copy(user); },
      async update({ data }) {
        if (options.writeError) throw options.writeError;
        user = assignDefined(user, data);
        events.push('user.committed');
        return copy(user);
      },
    },
  }, 'otp.prisma');
  const api = loadTs('src/lib/otp.ts', {
    'server-only': {}, 'node:crypto': crypto, './prisma': { prisma },
    './env': { env: () => ({ NEXTAUTH_SECRET: secret }) },
    './phone': { normalisePhone: () => ({ e164: phone }) },
    './ids': {}, './sms': {}, './email': email, './http': { ApiError },
  }, { Buffer });
  return { api, email, events, params: { phone, code, purpose: 'LOGIN' }, get user() { return copy(user); } };
}

check('first OTP verification notifies after activation without exposing the code', async (t) => {
  const f = otpFixture(t);
  await f.api.verifyOtp(f.params);
  assert.equal(f.user.status, 'ACTIVE');
  assert.ok(f.user.phoneVerified);
  assert.ok(f.user.emailVerified);
  assert.equal(f.email.rows[0].template, 'account_verified');
  assert.equal(f.email.mails.length, 1);
  noSensitiveText(f.email.mails, [f.params.code]);
  ordered(f.events, 'user.committed', 'notification.queued', `smtp.finish:${OLD_EMAIL}`);
});

check('OTP login for an already verified account does not send a change alert for login timestamps', async (t) => {
  const f = otpFixture(t, { user: { status: 'ACTIVE', phoneVerified: VERIFIED_AT, emailVerified: VERIFIED_AT } });
  await f.api.verifyOtp(f.params);
  assert.equal(f.email.mails.length, 0);
});

for (const [label, options, override] of [
  ['wrong code', {}, { code: '999999' }],
  ['expired code', { expired: true }, {}],
  ['failed database save', { writeError: new Error('Fixture save failure') }, {}],
]) {
  check(`OTP ${label} never sends an account-change email`, async (t) => {
    const f = otpFixture(t, options);
    await assert.rejects(f.api.verifyOtp({ ...f.params, ...override }));
    assert.equal(f.email.mails.length, 0);
    assert.equal(f.email.rows.length, 0);
  });
}

function authFixture(t, options = {}) {
  const events = [];
  const email = emailFixture(t, { events });
  let user = userRow({ status: 'ACTIVE', failedLoginCount: 7, lockedUntil: null, ...options.user });
  const prisma = strictMocks(t, {
    user: {
      async findUnique() { return copy(user); },
      async update({ data }) {
        if (options.writeError) throw options.writeError;
        user = assignDefined(user, data);
        events.push('user.committed');
        return copy(user);
      },
    },
  }, 'auth.prisma');
  const { authOptions } = loadTs('src/lib/auth/options.ts', {
    'server-only': {}, 'next-auth/providers/credentials': (config) => config,
    '../prisma': { prisma }, './password': { verifyPassword: async () => Boolean(options.validPassword) },
    '../otp': {}, '../env': { env: () => ({ NEXTAUTH_SECRET: 'isolated-auth-fixture-key' }) },
    '../phone': { normalisePhone() { throw new Error('Email is not a phone'); } }, '../email': email,
  });
  return { email, events, login: () => authOptions.providers[1].authorize({ identifier: OLD_EMAIL, password: CURRENT_PASSWORD }) };
}

check('crossing the failed-login threshold emails the owner after the lock is saved', async (t) => {
  const f = authFixture(t);
  assert.equal(await f.login(), null);
  assert.equal(f.email.rows[0].template, 'account_locked');
  noSensitiveText(f.email.mails, [CURRENT_PASSWORD]);
  ordered(f.events, 'user.committed', 'notification.queued');
});

for (const [label, options] of [
  ['ordinary failed login', { user: { failedLoginCount: 0 } }],
  ['already locked account', { user: { lockedUntil: new Date(Date.now() + 60000) } }],
  ['ordinary successful login', { validPassword: true }],
]) {
  check(`${label} does not produce duplicate account-change email`, async (t) => {
    const f = authFixture(t, options);
    await f.login();
    assert.equal(f.email.rows.length, 0);
  });
}

function moderationFixture(t, options = {}) {
  const events = [];
  let user = userRow({ status: 'PENDING_VERIFICATION', phoneVerified: null, emailVerified: null, ...options.user });
  const database = {
    user: { async findUnique({ select }) { return project(user, select); } },
    order: { async count() { return 0; } },
    notification: { async create() { return { id: 'in-app-status' }; } },
    async $transaction(callback) {
      const draft = copy(user);
      const result = await callback(strictMocks(t, {
        user: { async update({ data, select }) { assignDefined(draft, data); return project(draft, select); } },
        auditLog: { async create() { return {}; } },
        notification: { async create() { return {}; } },
      }, 'moderation.transaction'));
      if (options.commitError) throw options.commitError;
      user = draft;
      events.push('transaction.committed');
      return result;
    },
  };
  const f = serviceFixture(t, database, { events, email: options.email });
  return { ...f, moderation: f.loadModeration() };
}

check('admin verification sends a single email only after its audit transaction commits', async (t) => {
  const f = moderationFixture(t);
  const result = await f.moderation.verifyUserByAdmin(USER_ID, { actorId: 'admin-fixture' });
  assert.equal(result.status, 'ACTIVE');
  assert.equal(f.email.rows[0].template, 'account_verified');
  assert.equal(f.email.mails.length, 1);
  ordered(f.events, 'transaction.committed', 'notify.start', 'notify.finish');
});

check('failed admin verification transaction never emails the user', async (t) => {
  const f = moderationFixture(t, { commitError: new Error('Fixture rollback') });
  await assert.rejects(f.moderation.verifyUserByAdmin(USER_ID, { actorId: 'admin-fixture' }), /rollback/);
  assert.equal(f.email.mails.length, 0);
});

check('repeated admin verification rejects without a duplicate email', async (t) => {
  const f = moderationFixture(t, { user: { status: 'ACTIVE', phoneVerified: VERIFIED_AT, emailVerified: VERIFIED_AT } });
  await assert.rejects(f.moderation.verifyUserByAdmin(USER_ID, { actorId: 'admin-fixture' }), { status: 409 });
  assert.equal(f.email.mails.length, 0);
});

for (const status of ['ACTIVE', 'SUSPENDED', 'BANNED']) {
  check(`admin changing status to ${status} sends email after commit and survives SMTP failure`, async (t) => {
    const f = moderationFixture(t, { email: { sendMail: async () => { throw new Error('Fixture SMTP failure'); } } });
    const result = await f.moderation.setUserStatus(USER_ID, { status, actorId: 'admin-fixture' });
    assert.equal(result.status, status);
    assert.equal(f.email.rows[0].template, `user_${status.toLowerCase()}`);
    assert.equal(f.email.rows[0].status, 'FAILED');
    ordered(f.events, 'transaction.committed', 'notify.start');
  });
}

check('unchanged admin account status sends no email', async (t) => {
  const f = moderationFixture(t, { user: { status: 'ACTIVE' } });
  await f.moderation.setUserStatus(USER_ID, { status: 'ACTIVE', actorId: 'admin-fixture' });
  assert.equal(f.email.mails.length, 0);
});

for (const [label, decision, beforeDocument, settled] of [
  ['full approval', 'APPROVE', 'SUBMITTED', { kycStatus: 'APPROVED', status: 'ACTIVE' }],
  ['partial approval', 'APPROVE', 'SUBMITTED', { kycStatus: 'UNDER_REVIEW', status: 'PENDING' }],
  ['rejection', 'REJECT', 'SUBMITTED', { kycStatus: 'REJECTED', status: 'PENDING' }],
  ['unchanged decision', 'APPROVE', 'APPROVED', { kycStatus: 'UNDER_REVIEW', status: 'PENDING' }],
]) {
  check(`KYC ${label} email reflects the settled state after commit`, async (t) => {
    const events = [];
    const f = serviceFixture(t, {
      shop: {
        async findUnique() { return { ...SHOP, status: 'PENDING', kycStatus: 'UNDER_REVIEW' }; },
        async findUniqueOrThrow() { return copy(settled); },
      },
      kycDocument: { async findMany() { return [{ id: 'doc-fixture', status: beforeDocument }]; } },
      async $transaction(callback) {
        const result = await callback(strictMocks(t, {
          kycDocument: {
            async updateMany() { return { count: 1 }; },
            async findMany() {
              return [{ status: decision === 'APPROVE' ? 'APPROVED' : 'REJECTED' },
                ...(settled.kycStatus === 'UNDER_REVIEW' ? [{ status: 'SUBMITTED' }] : [])];
            },
          },
          shop: { async update() { return copy(settled); } },
          auditLog: { async create() { return {}; } },
          notification: { async create() { return {}; } },
        }, 'kyc.transaction'));
        events.push('transaction.committed');
        return result;
      },
    }, { events });
    const result = await f.loadShops().decideKyc({ shopId: SHOP.id, documentIds: ['doc-fixture'], decision, reviewerId: 'admin-fixture', note: 'private-fixture-review-text' });
    assert.equal(result.kycStatus, settled.kycStatus);
    if (label === 'unchanged decision') {
      assert.equal(f.email.mails.length, 0);
    } else {
      assert.match(f.email.mails[0].text, new RegExp(settled.kycStatus.toLowerCase().replace(/_/g, ' ')));
      if (label === 'partial approval') assert.doesNotMatch(f.email.mails[0].text, /approved/);
      noSensitiveText(f.email.mails, ['private-fixture-review-text', 'doc-fixture']);
      ordered(events, 'transaction.committed', 'notify.start', 'notify.finish');
    }
  });
}
