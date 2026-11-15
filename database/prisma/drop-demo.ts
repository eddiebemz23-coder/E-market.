/**
 * Removes the demo trading content that `prisma/seed.ts` writes: the two specimen stalls, their
 * catalog, the seeded reviews and questions, the specimen KYC uploads, the demo coupon and the
 * demo accounts. Geography, categories and the operations admin are reference data and stay.
 *
 * Run it before going live once real photography replaces `public/images/products` and
 * `public/images/kyc`, or straight after a fresh seed to start from an empty marketplace.
 *
 *   npm run db:drop-demo          # prints what would go and exits
 *   npm run db:drop-demo -- --yes # actually deletes
 *
 * Anything a real order, payout, stock movement or customer review touches is a blocker: the
 * script refuses to delete rather than silently erasing trading history or a customer's words.
 */
import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEMO_SHOP_SLUGS = ['electro-hub-kampala', 'mitumba-fashion-nbo'];
const DEMO_PRODUCT_SLUGS = [
  'tecno-spark-30c-android-smartphone',
  'hisense-43a4g-43-inch-smart-tv',
  'sunmini-solar-home-kit-20w',
  'kitenge-office-dress-made-to-order',
  'premium-mitumba-oxford-shirt-men',
];
/** The seller logins that own the demo stalls, and every buyer the seed signs in for testing. */
const DEMO_USER_PHONES = [
  '+256700000002',
  '+254700000003',
  '+256700000009',
  '+256700000011',
  '+256700000012',
  '+256700000013',
  '+256700000014',
  '+254700000011',
  '+254700000012',
  '+254700000013',
  '+254700000014',
];
const DEMO_COUPON_CODE = 'FREESHIPKL';

async function resolve() {
  const shops = await prisma.shop.findMany({
    where: { slug: { in: DEMO_SHOP_SLUGS } },
    select: { id: true, slug: true },
  });
  const products = await prisma.product.findMany({
    where: { slug: { in: DEMO_PRODUCT_SLUGS } },
    select: { id: true, slug: true },
  });
  const users = await prisma.user.findMany({
    where: { phone: { in: DEMO_USER_PHONES } },
    select: { id: true, phone: true, name: true },
  });
  const coupon = await prisma.coupon.findUnique({
    where: { code: DEMO_COUPON_CODE },
    select: { id: true, code: true },
  });
  return { shops, products, users, coupon };
}

/**
 * Each entry is a reason to stop: rows outside the demo set that would lose their meaning, or
 * trading records that reference the content being removed.
 */
async function findBlockers(demo: Awaited<ReturnType<typeof resolve>>): Promise<string[]> {
  const shopIds = demo.shops.map((shop) => shop.id);
  const productIds = demo.products.map((product) => product.id);
  const demoUserIds = demo.users.map((user) => user.id);

  const demoContentFilter: Prisma.InventoryMovementWhereInput = {
    OR: [{ shopId: { in: shopIds } }, { variant: { productId: { in: productIds } } }],
  };
  // The seed's opening-stock rows carry a `seed:` idempotency key; they are demo data too, so
  // they must not be mistaken for the real stock history that would make this run unsafe.
  const notSeeded: Prisma.InventoryMovementWhereInput = {
    OR: [{ idempotencyKey: null }, { idempotencyKey: { not: { startsWith: 'seed:' } } }],
  };

  const [orders, orderItems, stockMoves, payouts, redemptions, foreignReviews] = await Promise.all([
    shopIds.length ? prisma.order.count({ where: { shopId: { in: shopIds } } }) : 0,
    productIds.length
      ? prisma.orderItem.count({ where: { variant: { productId: { in: productIds } } } })
      : 0,
    productIds.length || shopIds.length
      ? prisma.inventoryMovement.count({ where: { AND: [demoContentFilter, notSeeded] } })
      : 0,
    shopIds.length ? prisma.payout.count({ where: { shopId: { in: shopIds } } }) : 0,
    demo.coupon ? prisma.couponRedemption.count({ where: { couponId: demo.coupon.id } }) : 0,
    productIds.length
      ? prisma.review.count({
          where: { productId: { in: productIds }, userId: { notIn: demoUserIds } },
        })
      : 0,
  ]);

  const blockers: string[] = [];
  if (orders > 0) blockers.push(`${orders} order(s) were placed against the demo stalls`);
  if (orderItems > 0) blockers.push(`${orderItems} order line(s) contain demo products`);
  if (stockMoves > 0) blockers.push(`${stockMoves} stock movement(s) reference demo products or stalls`);
  if (payouts > 0) blockers.push(`${payouts} payout(s) were raised for the demo stalls`);
  if (redemptions > 0) blockers.push(`${redemptions} order(s) redeemed the demo coupon`);
  if (foreignReviews > 0) {
    blockers.push(`${foreignReviews} review(s) on demo products were written by accounts outside the demo set`);
  }
  return blockers;
}

async function main() {
  const demo = await resolve();
  const blockers = await findBlockers(demo);

  console.log('Demo content found:');
  console.log(`  stalls            ${demo.shops.map((shop) => shop.slug).join(', ') || 'none'}`);
  console.log(`  products          ${demo.products.length}`);
  console.log(`  accounts          ${demo.users.length}`);
  console.log(`  coupon            ${demo.coupon?.code ?? 'none'}`);

  if (blockers.length > 0) {
    console.error('\nRefusing to delete, because real activity depends on this content:');
    for (const blocker of blockers) console.error(`  - ${blocker}`);
    console.error('\nExport or archive that history first, then re-run.');
    process.exitCode = 1;
    return;
  }

  if (!process.argv.includes('--yes')) {
    console.log('\nNothing deleted. Re-run with `npm run db:drop-demo -- --yes` to remove all of it.');
    return;
  }

  const counts = await prisma.$transaction(async (tx) => {
    // Stock movements RESTRICT their variant, so the seed's opening-stock rows go first.
    const movements = await tx.inventoryMovement.deleteMany({
      where: {
        AND: [
          {
            OR: [
              { shopId: { in: demo.shops.map((shop) => shop.id) } },
              { variant: { productId: { in: demo.products.map((product) => product.id) } } },
            ],
          },
          { idempotencyKey: { startsWith: 'seed:' } },
        ],
      },
    });
    // Products next: variants, images, carts, wishlist entries, reviews and Q&A cascade with them.
    const products = await tx.product.deleteMany({ where: { id: { in: demo.products.map((p) => p.id) } } });
    const shops = await tx.shop.deleteMany({ where: { id: { in: demo.shops.map((s) => s.id) } } });
    const coupon = demo.coupon
      ? await tx.coupon.deleteMany({ where: { id: demo.coupon.id } })
      : { count: 0 };
    // Sellers only become deletable once the stalls they own are gone (`Shop.owner` is RESTRICT).
    const users = await tx.user.deleteMany({ where: { id: { in: demo.users.map((u) => u.id) } } });
    return {
      stockMovements: movements.count,
      products: products.count,
      shops: shops.count,
      coupons: coupon.count,
      users: users.count,
    };
  });

  console.log('\nDeleted:', counts);
  console.log('The specimen image files under public/images are untouched; replace or delete them separately.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
