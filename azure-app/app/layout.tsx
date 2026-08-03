import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'HIM · Azure',
  description: 'Holistic Impact Metric platform — Azure-native rebuild for ACH',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
