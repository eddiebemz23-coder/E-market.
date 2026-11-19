'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const COLUMNS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: 'Shop',
    links: [
      { href: '/search', label: 'All products' },
      { href: '/shops', label: 'Browse shops' },
      { href: '/cart', label: 'Your basket' },
      { href: '/orders', label: 'Track an order' },
    ],
  },
  {
    title: 'Sell',
    links: [
      { href: '/register?role=seller', label: 'Open a shop' },
      { href: '/seller', label: 'Seller dashboard' },
      { href: '/seller/payouts', label: 'Withdraw your money' },
    ],
  },
];

export function SiteFooter() {
  const pathname = usePathname();
  if (pathname === '/login' || pathname === '/register') return null;

  return (
    <footer className="mt-12 border-t border-white/80 bg-white/70">
      <div className="container-page grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-lg font-bold text-ink-900">
            Bemz <span className="text-pink-800">Africa</span>
          </p>
          <p className="mt-2 max-w-xs text-sm text-ink-500">
            Connecting buyers and sellers across Africa. Discover local shops, compare prices in your currency,
            and explore delivery options for your location.
          </p>
        </div>

        {COLUMNS.map((column) => (
          <div key={column.title}>
            <h3 className="text-sm font-semibold text-ink-900">{column.title}</h3>
            <ul className="mt-3 space-y-2">
              {column.links.map((link) => (
                <li key={`${column.title}-${link.label}`}>
                  <Link href={link.href} className="text-sm text-ink-600 hover:text-bemz-700">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div>
          <h3 className="text-sm font-semibold text-ink-900">Pay your way</h3>
          <ul className="mt-3 space-y-1.5 text-sm text-ink-600">
            <li>MTN Mobile Money — Uganda</li>
            <li>Airtel Money — Uganda &amp; Kenya</li>
            <li>Debit / credit card</li>
            <li>Cash on delivery where your zone allows it</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-ink-100 py-4">
        <p className="container-page text-xs text-ink-400">
          Prices shown include VAT where it applies. © {new Date().getFullYear()} Bemz Africa Marketplace.
        </p>
      </div>
    </footer>
  );
}
