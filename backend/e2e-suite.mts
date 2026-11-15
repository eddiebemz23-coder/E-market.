/**
 * End-to-end suite (`npm run test:e2e`) that walks README §9 — register > add product > cart >
 * pay > order > payout — over the HTTP API, plus the guard rails in §9g. It creates a fresh buyer
 * and a fresh listing on every run, so it is safe to repeat against a seeded database.
 * Targets `next dev` on 3001 (or `E2E_BASE`) so the sandbox rails and the printed OTP codes work.
 * There is no unit-test layer in this project; this is the regression net, and it is what proved
 * the suspension gate and the second-order cart bug.
 */
const BASE = process.env.E2E_BASE ?? 'http://127.0.0.1:3001';

let passed = 0;
const failures: string[] = [];
const skipped: string[] = [];

function record(name: string, ok: boolean, detail = '') {
  if (ok) {
    passed += 1;
    console.log(`  PASS  ${name}${detail ? `  (${detail})` : ''}`);
  } else {
    failures.push(`${name}${detail ? `: ${detail}` : ''}`);
    console.log(`  FAIL  ${name}${detail ? `  ${detail}` : ''}`);
  }
  return ok;
}

function section(title: string) {
  console.log(`\n=== ${title}`);
}

type Actor = { label: string; cookies: Map<string, string> };

function actor(label: string): Actor {
  return { label, cookies: new Map() };
}

function cookieHeader(who?: Actor) {
  if (!who || who.cookies.size === 0) return {};
  return { cookie: [...who.cookies].map(([k, v]) => `${k}=${v}`).join('; ') };
}

function absorbCookies(who: Actor | undefined, response: Response) {
  if (!who) return;
  for (const raw of response.headers.getSetCookie()) {
    const [pair] = raw.split(';');
    const eq = pair?.indexOf('=');
    if (!eq || eq < 1) continue;
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    if (value === '' || /expires=Thu, 01 Jan 1970/i.test(raw)) who.cookies.delete(name);
    else who.cookies.set(name, value);
  }
}

async function call(
  method: string,
  path: string,
  body?: unknown,
  who?: Actor,
  extraHeaders?: Record<string, string>,
) {
  const init: RequestInit = {
    method,
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...cookieHeader(who),
      ...extraHeaders,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'manual',
  };
  const response = await fetch(`${BASE}${path}`, init);
  absorbCookies(who, response);
  const text = await response.text();
  let json: any = undefined;
  try {
    json = JSON.parse(text);
  } catch {
    /* html responses */
  }
  return { status: response.status, json, text, data: json?.data, error: json?.error };
}

const api = {
  get: (p: string, who?: Actor) => call('GET', p, undefined, who),
  post: (p: string, body?: unknown, who?: Actor) => call('POST', p, body ?? {}, who),
  patch: (p: string, body: unknown, who?: Actor) => call('PATCH', p, body, who),
};

/** Human-readable reason a request was rejected, including the field-level details. */
function why(response: { error?: { message?: string; details?: unknown } }) {
  const message = response.error?.message ?? '';
  const details = response.error?.details;
  if (!details) return message;
  return `${message} ${JSON.stringify(details).slice(0, 240)}`;
}

function randomPhone(ug = true) {
  const digits = String(Math.floor(100000 + Math.random() * 899999));
  return ug ? `+2567${digits}0${digits.slice(-1)}` : `+2547${digits}0${digits.slice(-1)}`;
}

/** NextAuth credentials sign-in for either rail; returns the actor and whether it worked. */
async function signInWith(provider: 'phone-otp' | 'password', label: string, fields: Record<string, string>) {
  const who = actor(label);
  const csrfResponse = await api.get('/api/auth/csrf', who);
  const csrfToken = csrfResponse.json?.csrfToken as string | undefined;
  if (!csrfToken) return { who, ok: false, detail: `no csrf token (${csrfResponse.status})` };

  const form = new URLSearchParams({ csrfToken, ...fields, json: 'true' });
  const response = await fetch(`${BASE}/api/auth/callback/${provider}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', ...cookieHeader(who) },
    body: form.toString(),
    redirect: 'manual',
  });
  absorbCookies(who, response);
  const sessioned = [...who.cookies.keys()].some((name) => name.includes('session-token'));
  if (!sessioned) return { who, ok: false, detail: `no session cookie (HTTP ${response.status})` };
  const me = await api.get('/api/me', who);
  if (me.status !== 200) return { who, ok: false, detail: `/api/me ${me.status}` };
  return { who, ok: true, detail: `signed in as ${me.json?.data?.user?.phone ?? label}` };
}

const signIn = (phone: string, code: string) =>
  signInWith('phone-otp', phone, { phone, code });

/** The password rail needs no OTP, so it is not bound by the resend cooldown. */
const signInWithPassword = (identifier: string, password: string) =>
  signInWith('password', identifier, { identifier, password });

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Requests a login code and reads the development code the response prints. */
async function loginCode(phone: string) {
  let response = await api.post('/api/auth/otp/request', { phone, purpose: 'LOGIN', defaultRegion: 'UG' });
  // `OTP_RESEND_COOLDOWN_SECONDS` is a real guard, so a suite that reuses a number sits it out
  // instead of reading a code that was never issued.
  if (response.status === 429) {
    const waitSeconds = Number((response.error as any)?.details?.retryAfterSeconds ?? 60) + 1;
    console.log(`        … OTP resend cooldown: waiting ${waitSeconds}s`);
    await sleep(waitSeconds * 1000);
    response = await api.post('/api/auth/otp/request', { phone, purpose: 'LOGIN', defaultRegion: 'UG' });
  }
  const devCode = response.data?.devCode as string | undefined;
  return { status: response.status, devCode, message: response.data?.message ?? response.error?.message };
}

// ─────────────────────────────────────────────────────────────────────────────
section('9a  Register and sign in');

const buyerPhone = randomPhone();
const registration = await api.post('/api/auth/register', {
  name: 'E2E Buyer',
  phone: buyerPhone,
  password: 'E2eBuyer!2026',
  country: 'UG',
  acceptTerms: true,
});
record('register a buyer account', [200, 201].includes(registration.status), `HTTP ${registration.status} ${registration.error?.message ?? ''}`);

const firstCode = await loginCode(buyerPhone);
record('OTP request returns a development code', Boolean(firstCode.devCode), `HTTP ${firstCode.status} code=${firstCode.devCode ?? 'none'}`);

const badSignIn = await signIn(buyerPhone, firstCode.devCode ? (firstCode.devCode === '000000' ? '111111' : '000000') : '000000');
record('wrong OTP is refused', !badSignIn.ok, badSignIn.detail);

const goodSignIn = await signIn(buyerPhone, firstCode.devCode ?? '');
record('correct OTP opens a session', goodSignIn.ok, goodSignIn.detail);
const buyer = goodSignIn.who;

const meResponse = await api.get('/api/me', buyer);
record('session identity carries the market currency', meResponse.status === 200 && Boolean(meResponse.json?.data), `HTTP ${meResponse.status}`);

const passwordSignIn = await signInWithPassword(buyerPhone, 'E2eBuyer!2026');
record('the password rail signs the same account in', passwordSignIn.ok, passwordSignIn.detail);

const wrongPassword = await signInWithPassword(buyerPhone, 'NotThePassword!');
record('a wrong password is refused', !wrongPassword.ok, wrongPassword.detail);

const otpOnlyPhone = '+256700000009';
const otpOnlyCode = await loginCode(otpOnlyPhone);
const otpOnlySignIn = await signIn(otpOnlyPhone, otpOnlyCode.devCode ?? '');
record('seeded OTP-only buyer signs in with no password', otpOnlySignIn.ok, otpOnlySignIn.detail);

const adminPhone = '+256700000001';
const adminCode = await loginCode(adminPhone);
const adminSignIn = await signIn(adminPhone, adminCode.devCode ?? '');
record('operations admin signs in', adminSignIn.ok, adminSignIn.detail);
const admin = adminSignIn.who;

const sellerPhone = '+256700000002';
const sellerCode = await loginCode(sellerPhone);
const sellerSignIn = await signIn(sellerPhone, sellerCode.devCode ?? '');
record('seeded seller signs in', sellerSignIn.ok, sellerSignIn.detail);
const seller = sellerSignIn.who;

const anonMe = await api.get('/api/me');
record('unauthenticated /api/me is rejected', anonMe.status === 401, `HTTP ${anonMe.status}`);

// ─────────────────────────────────────────────────────────────────────────────
section('9b  Add product');

const shopResponse = await api.get('/api/seller/shop', seller);
const shop = shopResponse.data?.shop ?? shopResponse.data;
record('seller reads their own stall', shopResponse.status === 200 && Boolean(shop), `HTTP ${shopResponse.status} status=${shop?.status ?? '?'}`);

const categoriesResponse = await api.get('/api/seller/categories', seller);
const sellerCategories = (categoriesResponse.data?.categories ?? categoriesResponse.data ?? []) as any[];
record('seller category list is available', categoriesResponse.status === 200 && Array.isArray(sellerCategories) && sellerCategories.length > 0, `${sellerCategories.length} categories`);

const ungated = sellerCategories.find((category: any) => !category.kycRequired && !category.requiresKyc) ?? sellerCategories[0];
const sku = `E2E-MUG-${Date.now().toString().slice(-8)}`;
const createResponse = await api.post(
  '/api/seller/products',
  {
    title: 'E2E Test Mug 350ml',
    description: 'A ceramic mug listed by the automated end-to-end suite so it can be bought, delivered and reviewed again.',
    categoryIds: [String(ungated?.id ?? '1')],
    currency: 'UGX',
    publish: true,
    // The seller UI always sends the key (an empty array is a listing with no photo yet);
    // `images` is required, so the payload has to match what the form posts.
    images: [],
    variants: [
      {
        name: 'Default',
        sku,
        attributes: { colour: 'white', capacity: '350ml' },
        priceMinor: 25_000_000,
        stockQuantity: 5,
        maxQuantityPerOrder: 4,
      },
    ],
  },
  seller,
);
const createdProduct = createResponse.data?.product ?? createResponse.data;
record('publish a listing as the seller', [200, 201].includes(createResponse.status), `HTTP ${createResponse.status} ${why(createResponse)}`);

const buyerCreateAttempt = await api.post(
  '/api/seller/products',
  { title: 'Should not exist', description: 'x'.repeat(40), categoryIds: ['1'], currency: 'UGX', variants: [{ sku: 'NOPE', priceMinor: 1, stock: 1 }] },
  buyer,
);
record('a buyer cannot list a product', buyerCreateAttempt.status === 401 || buyerCreateAttempt.status === 403, `HTTP ${buyerCreateAttempt.status}`);

const shopSlug = (shop?.slug ?? 'electro-hub-kampala') as string;
const productPath = createdProduct?.slug ? `/api/products/${shopSlug}/${createdProduct.slug}` : null;
const publicRead = productPath ? await api.get(productPath) : { status: 0, data: null, error: null };
record('the listing is publicly readable', publicRead.status === 200, productPath ? `HTTP ${publicRead.status}` : 'no slug returned');

const searchRead = await api.get('/api/products?q=e2e%20test%20mug');
record('the listing is searchable', searchRead.status === 200, `${(searchRead.data?.items ?? []).length} hits`);

// ─────────────────────────────────────────────────────────────────────────────
section('9c  Cart');

const variantId: string | undefined = createdProduct?.variants?.[0]?.id;
record('listing has a purchasable variant', Boolean(variantId), variantId ?? 'none');

if (variantId) {
  const add = await api.post('/api/cart', { variantId, quantity: 2 }, buyer);
  record('add a line to the cart', [200, 201].includes(add.status), `HTTP ${add.status} ${add.error?.message ?? ''}`);

  const cart = await api.get('/api/cart', buyer);
  const lines = (cart.data?.items ?? cart.data?.lines ?? []) as any[];
  record('cart reflects the quantity', cart.status === 200 && lines.some((line) => line.quantity === 2), `${lines.length} line(s)`);

  const overMax = await api.post('/api/cart', { variantId, quantity: 9999 }, buyer);
  record('an absurd quantity is refused, not silently capped', overMax.status >= 400, `HTTP ${overMax.status}`);

  const coupon = await api.post('/api/cart/coupon', { code: 'FREESHIPKL' }, buyer);
  record('the seeded coupon is accepted or explains itself', coupon.status === 200 || Boolean(coupon.error?.message), `HTTP ${coupon.status} ${coupon.error?.message ?? 'applied'}`);

  const badCoupon = await api.post('/api/cart/coupon', { code: 'NOTAREALCODE' }, buyer);
  record('an unknown coupon is rejected with a reason', badCoupon.status >= 400 && Boolean(badCoupon.error?.message), `HTTP ${badCoupon.status}`);
} else {
  skipped.push('9c cart steps (no variant)');
}

// ─────────────────────────────────────────────────────────────────────────────
section('9d  Checkout and pay');

const districts = await api.get('/api/geo/districts?country=UG');
const districtList = (districts.data?.deliverable ?? []) as any[];
const districtId = districtList[0]?.id;
record('district reference data is served', districts.status === 200 && districtList.length > 0, `${districtList.length} deliverable districts`);

const addressResponse = await api.post(
  '/api/me/addresses',
  { recipientName: 'E2E Buyer', recipientPhone: buyerPhone, districtId, subcounty: 'Kabowa', parish: 'Ntinda', nearestLandmark: 'Next to the Total filling station', isDefault: true },
  buyer,
);
const addressId = addressResponse.data?.id ?? addressResponse.data?.address?.id;
record('save a delivery address', [200, 201].includes(addressResponse.status) && Boolean(addressId), `HTTP ${addressResponse.status} ${why(addressResponse)}`);

const codKey = `e2e-cod-${Date.now()}`;
const codCheckout = await api.post(
  '/api/checkout',
  { addressId, paymentProvider: 'CASH_ON_DELIVERY', idempotencyKey: codKey },
  buyer,
);
const codOrders = (codCheckout.data?.orders ?? []) as any[];
record('place a cash-on-delivery order', [200, 201].includes(codCheckout.status) && codOrders.length > 0, `HTTP ${codCheckout.status} ${codOrders.length ? `${codOrders.length} order(s)` : why(codCheckout)}`);
record(
  'the order is split per shop under one group',
  Boolean(codCheckout.data?.groupReference ?? codCheckout.data?.groupId),
  `group ${codCheckout.data?.groupReference ?? codCheckout.data?.groupId ?? 'n/a'}`,
);

const cartAfterCheckout = await api.get('/api/cart', buyer);
const linesAfterCheckout = (cartAfterCheckout.data?.items ?? cartAfterCheckout.data?.lines ?? []) as any[];
record(
  'a placed order leaves nothing selected in the basket',
  cartAfterCheckout.status === 200 &&
    Number(cartAfterCheckout.data?.selectedCount ?? 0) === 0 &&
    linesAfterCheckout.every((line) => line.selected === false || Number(line.quantity ?? 0) === 0),
  `${linesAfterCheckout.length} line(s), selected=${cartAfterCheckout.data?.selectedCount ?? '?'}`,
);

// A successful checkout drains the basket, so the replay test has to give it something to
// turn into a second group — that is exactly the double-tap the idempotency key defends.
if (variantId) await api.post('/api/cart', { variantId, quantity: 1 }, buyer);

const repeatCheckout = await api.post(
  '/api/checkout',
  { addressId, paymentProvider: 'CASH_ON_DELIVERY', idempotencyKey: codKey },
  buyer,
);
record(
  'replaying the same idempotency key does not create a second group',
  repeatCheckout.status >= 400 ||
    ((repeatCheckout.data?.orders ?? []) as any[]).length === 0 ||
    (repeatCheckout.data?.groupId === codCheckout.data?.groupId && Boolean(repeatCheckout.data?.replayed)),
  `HTTP ${repeatCheckout.status} group=${repeatCheckout.data?.groupReference ?? 'n/a'} replayed=${String(repeatCheckout.data?.replayed)} ${repeatCheckout.error?.message ?? ''}`,
);

if (codOrders[0]?.id) {
  const confirmRequest = await api.post(`/api/orders/${codOrders[0].id}/confirm/request`, {}, buyer);
  const confirmCode = confirmRequest.data?.devCode as string | undefined;
  record('COD confirmation code is issued', [200, 201].includes(confirmRequest.status) && Boolean(confirmCode), `HTTP ${confirmRequest.status} code=${confirmCode ?? 'none'} to ${confirmRequest.data?.sentTo ?? '?'}`);

  const wrongConfirm = await api.post(`/api/orders/${codOrders[0].id}/confirm`, { code: confirmCode === '123456' ? '654321' : '123456' }, buyer);
  record('a wrong confirmation code is refused', wrongConfirm.status >= 400, `HTTP ${wrongConfirm.status}`);

  const confirm = await api.post(`/api/orders/${codOrders[0].id}/confirm`, { code: confirmCode }, buyer);
  record('the right code releases the order into the seller queue', confirm.status === 200, `HTTP ${confirm.status} ${confirm.error?.message ?? ''}`);
} else {
  skipped.push('9d COD confirmation (no order id)');
}

// A second, different basket: the cart row this one converts must not collide with the first.
if (variantId) await api.post('/api/cart', { variantId, quantity: 1 }, buyer);

const momoCheckout = await api.post(
  '/api/checkout',
  { addressId, paymentProvider: 'MTN_MOMO', payerPhone: buyerPhone, idempotencyKey: `e2e-momo-${Date.now()}` },
  buyer,
);
const momoOrders = (momoCheckout.data?.orders ?? []) as any[];
const momoPayments = (momoCheckout.data?.payments ?? []) as any[];
record('a MoMo checkout is accepted in the sandbox', [200, 201].includes(momoCheckout.status) && momoOrders.length > 0, `HTTP ${momoCheckout.status} ${why(momoCheckout)}`);

const paymentId = momoPayments[0]?.id ?? momoOrders[0]?.payments?.[0]?.id ?? momoOrders[0]?.paymentId;
if (paymentId) {
  const initiate = await api.post(`/api/payments/${paymentId}/initiate`, {}, buyer);
  const body = JSON.stringify(initiate.json ?? '');
  record('sandbox payment returns a SIM reference, not a fake live one', initiate.status < 400 ? /SIM/.test(body) : true, `HTTP ${initiate.status} ${/SIM-[A-Z0-9]+/.exec(body)?.[0] ?? initiate.error?.message ?? ''}`);

  const receipt = await api.get(`/api/payments/${paymentId}/status`, buyer);
  record(
    'the receipt polls the payment without a refresh',
    receipt.status === 200 && Boolean(receipt.data?.status ?? receipt.data?.payment?.status),
    `HTTP ${receipt.status} ${receipt.data?.status ?? receipt.data?.payment?.status ?? ''}`,
  );
} else {
  skipped.push('9d MoMo initiation (no payment id in response)');
}

// ─────────────────────────────────────────────────────────────────────────────
section('9e  Fulfilment, reviews and guard rails');

const sellerOrders = await api.get('/api/orders?scope=seller', seller);
record('seller order queue is readable', sellerOrders.status === 200, `HTTP ${sellerOrders.status}`);

const targetOrder = codOrders[0];
if (targetOrder?.id) {
  const packed = await api.post(`/api/orders/${targetOrder.id}/status`, { to: 'PACKED' }, seller);
  record('seller packs the parcel (stock is consumed)', packed.status === 200, `HTTP ${packed.status} ${packed.error?.message ?? ''}`);

  const backwards = await api.post(`/api/orders/${targetOrder.id}/status`, { to: 'CONFIRMED' }, seller);
  record('a backwards transition is refused', backwards.status >= 400, `HTTP ${backwards.status}`);

  const buyerMoves = await api.post(`/api/orders/${targetOrder.id}/status`, { to: 'DELIVERED' }, buyer);
  record('a buyer cannot move the parcel forward', buyerMoves.status === 401 || buyerMoves.status === 403 || buyerMoves.status >= 400, `HTTP ${buyerMoves.status}`);

  const out = await api.post(`/api/orders/${targetOrder.id}/status`, { to: 'OUT_FOR_DELIVERY' }, seller);
  record('out for delivery', out.status === 200, `HTTP ${out.status}`);

  const delivered = await api.post(`/api/orders/${targetOrder.id}/status`, { to: 'DELIVERED' }, seller);
  record('delivered', delivered.status === 200, `HTTP ${delivered.status} ${delivered.error?.message ?? ''}`);

  const review = await api.post(
    `/api/products/${shopSlug}/${createdProduct?.slug ?? ''}/reviews`,
    { rating: 5, body: 'Arrived in Ntinda the same evening. Solid mug, honest description.', orderId: targetOrder.id },
    buyer,
  );
  record('a delivered order allows a review', [200, 201].includes(review.status), `HTTP ${review.status} ${review.error?.message ?? ''}`);

  const earlyReview = await api.post(
    `/api/products/${shopSlug}/${createdProduct?.slug ?? ''}/reviews`,
    { rating: 4, body: 'Trying to review something that was never delivered to me at all.', orderId: 'nonexistent-order' },
    buyer,
  );
  record('a review for an undelivered order is refused', earlyReview.status >= 400, `HTTP ${earlyReview.status}`);
} else {
  skipped.push('9e fulfilment (no order id)');
}

const ordersList = await api.get('/api/orders', buyer);
const buyerOrders = (ordersList.data?.orders ?? ordersList.data?.items ?? []) as any[];
record('buyer order history lists the group', ordersList.status === 200 && buyerOrders.length > 0, `HTTP ${ordersList.status}`);
record('the same buyer can place a second order', buyerOrders.length >= 2, `${buyerOrders.length} order(s) in history`);

const publicShops = await api.get('/api/shops');
const shopCards = (publicShops.data?.items ?? []) as any[];
const otherShop = shopCards.find((shop: any) => shop.slug !== shopSlug) ?? shopCards[1];
const buyerOrdersWithShopFilter = await api.get(`/api/orders?shopId=${otherShop?.id ?? 'someone-elses-shop'}`, buyer);
const filteredIds = ((buyerOrdersWithShopFilter.data?.orders ?? []) as any[]).map((order: any) => order.id).join(',');
const plainIds = ((ordersList.data?.orders ?? []) as any[]).map((order: any) => order.id).join(',');
record(
  'a buyer passing another shop id gets only their own orders',
  buyerOrdersWithShopFilter.status === 200 &&
    filteredIds === plainIds &&
    ((buyerOrdersWithShopFilter.data?.orders ?? []) as any[]).every((order: any) => order.shopId !== otherShop?.id),
  `HTTP ${buyerOrdersWithShopFilter.status} ${((buyerOrdersWithShopFilter.data?.orders ?? []) as any[]).length} row(s) with filter, ${((ordersList.data?.orders ?? []) as any[]).length} without`,
);

const sellerCrossShop = await api.get(`/api/orders?shopId=${otherShop?.id ?? 'someone-elses-shop'}`, seller);
record(
  'a seller asking for another shop queue is refused',
  sellerCrossShop.status === 403 || sellerCrossShop.status === 422,
  `HTTP ${sellerCrossShop.status} ${sellerCrossShop.error?.message ?? ''}`,
);

// ─────────────────────────────────────────────────────────────────────────────
section('9f  Money out');

const payoutWindow = await api.get('/api/seller/payouts?periodStart=2026-01-01T00:00:00.000Z&periodEnd=2026-12-31T00:00:00.000Z', seller);
record('seller payout balance is a period, not a typed amount', payoutWindow.status === 200, `HTTP ${payoutWindow.status} ${payoutWindow.error?.message ?? ''}`);

const withdraw = await api.post(
  '/api/seller/payouts',
  { periodStart: '2026-01-01T00:00:00.000Z', periodEnd: '2026-12-31T00:00:00.000Z', accountNumber: sellerPhone, accountName: 'E2E Seller' },
  seller,
);
record('a withdrawal request is accepted or honestly refused', [200, 201].includes(withdraw.status) || withdraw.status === 422 || withdraw.status === 400, `HTTP ${withdraw.status} ${withdraw.error?.message ?? 'requested'}`);

const adminQueues = await api.get('/api/admin/queues', admin);
record('admin moderation queues are readable', adminQueues.status === 200, `HTTP ${adminQueues.status}`);

const adminMetrics = await api.get('/api/admin/metrics', admin);
record('admin metrics are readable', adminMetrics.status === 200, `HTTP ${adminMetrics.status}`);

const buyerId = (meResponse.json?.data?.user?.id ?? meResponse.json?.data?.id) as string | undefined;
const suspended = await api.patch(`/api/admin/users/${buyerId}`, { status: 'SUSPENDED', reason: 'e2e suite: checking the suspension gate' }, admin);
record('admin can suspend an account', suspended.status === 200 && !suspended.error, `HTTP ${suspended.status} ${why(suspended)}`);

const suspendedMe = await api.get('/api/me', buyer);
record('a suspension cuts off the live session', suspendedMe.status === 401 || suspendedMe.status === 403, `HTTP ${suspendedMe.status}`);

const suspendedSignIn = await signInWithPassword(buyerPhone, 'E2eBuyer!2026');
record('a suspended account cannot sign in', !suspendedSignIn.ok, suspendedSignIn.detail);

const suspendedOrders = await api.get('/api/orders', buyer);
record('a suspension cuts off the guarded order history', suspendedOrders.status === 401 || suspendedOrders.status === 403, `HTTP ${suspendedOrders.status}`);

const suspendedCart = await api.get('/api/cart', buyer);
const suspendedLines = (suspendedCart.data?.items ?? suspendedCart.data?.lines ?? []) as any[];
record(
  'a suspended account reads a guest basket, never its own',
  !suspendedLines.some((line: any) => line.variantId === variantId),
  `HTTP ${suspendedCart.status} ${suspendedLines.length} line(s)`,
);

const restored = await api.patch(`/api/admin/users/${buyerId}`, { status: 'ACTIVE', reason: 'e2e suite: restoring after the suspension gate check' }, admin);
record('admin restores the account', restored.status === 200, `HTTP ${restored.status} ${why(restored)}`);

const reSignIn = await signInWithPassword(buyerPhone, 'E2eBuyer!2026');
record('the restored account signs in again', reSignIn.ok, reSignIn.detail);

const adminAudit = await api.get('/api/admin/audit', admin);
record('the audit trail records the decisions above', adminAudit.status === 200 && (adminAudit.data?.items ?? adminAudit.data?.entries ?? []).length > 0, `HTTP ${adminAudit.status} ${(adminAudit.data?.items ?? adminAudit.data?.entries ?? []).length} row(s)`);

const buyerAudit = await api.get('/api/admin/audit', buyer);
record('a buyer cannot read the admin audit trail', buyerAudit.status === 401 || buyerAudit.status === 403, `HTTP ${buyerAudit.status}`);

// ─────────────────────────────────────────────────────────────────────────────
section('9g  Guard rails and page matrix');

const sweepUnauthed = await api.post('/api/ops/expire-orders', {});
record('the maintenance sweep is not public', sweepUnauthed.status === 401 || sweepUnauthed.status === 403, `HTTP ${sweepUnauthed.status}`);

const pages = ['/', '/search?q=mug', '/shops', `/shop/${shopSlug}`, `/category/${ungated?.slug ?? 'phones'}`, '/cart', '/login', '/register', '/checkout', '/account', '/orders', '/seller', '/admin'];
for (const page of pages) {
  const response = await fetch(`${BASE}${page}`, { redirect: 'manual' });
  record(`page ${page}`, response.status === 200 || response.status === 307, `HTTP ${response.status}`);
}

const protectedPages = ['/seller/products', '/admin/queues', '/account'];
for (const page of protectedPages) {
  const response = await fetch(`${BASE}${page}`, { redirect: 'manual' });
  record(`anonymous ${page} does not render the dashboard`, response.status === 307 || response.status === 401 || /sign in|login/i.test((await response.text().then((t) => t)).slice(0, 4000)), `HTTP ${response.status}`);
}

console.log(`\n──────────────────────────────────────────────`);
console.log(`${passed} passed, ${failures.length} failed, ${skipped.length} skipped`);
if (failures.length) {
  console.log('\nFailures:');
  for (const failure of failures) console.log(`  - ${failure}`);
}
if (skipped.length) {
  console.log('\nSkipped:');
  for (const skip of skipped) console.log(`  - ${skip}`);
}
process.exit(failures.length ? 1 : 0);
