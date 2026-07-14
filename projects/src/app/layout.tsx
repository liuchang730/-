import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '跳一跳',
  description: '微信跳一跳网页版 — AI解说',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="overflow-hidden touch-none select-none">
        {children}
      </body>
    </html>
  );
}
