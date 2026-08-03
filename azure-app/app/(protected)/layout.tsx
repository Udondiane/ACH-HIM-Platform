import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { Sidebar } from '@/components/layout/sidebar';

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/api/auth/signin');

  return (
    <div className="flex min-h-screen">
      <Sidebar userName={user.name} />
      <main className="flex-1 px-8 py-8 overflow-x-auto">{children}</main>
    </div>
  );
}
