import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';
import { InstallBanner } from '@/components/pwa/install-banner';
import { ServiceWorkerRegister } from '@/components/pwa/service-worker-register';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';

/** Read directly: `env()` is server-only and validated lazily, a layout must not throw on it. */
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: 'Bemz Africa | Your marketplace across Africa',
    template: '%s · Bemz Africa',
  },
  description:
    'Discover shops and connect with traders across Africa. Browse prices in your currency, with payment and delivery options available for your location.',
  keywords: ['African marketplace', 'online shopping Africa', 'African shops', 'local businesses', 'buy and sell'],
  icons: {
    apple: '/icons/apple-touch-icon.png',
  },
  openGraph: {
    type: 'website',
    siteName: 'Bemz Africa',
    locale: 'en_UG',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#1f8a4c',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          {/* Keyboard and screen-reader users get one exit from the header before the grid. */}
          <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">
            Skip to content
          </a>
          <SiteHeader />
          <main id="main" className="pb-20 sm:pb-0">
            {children}
          </main>
          <SiteFooter />
          <ServiceWorkerRegister />
          <InstallBanner />
        </Providers>
      </body>
    </html>
  );
}
