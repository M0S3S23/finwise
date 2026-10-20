import { redirect } from 'next/navigation';
import { requireSession } from '@/lib/session';
import { connectDB } from '@/lib/db';
import { User } from '@/models/User';
import { Business } from '@/models/Business';
import { AppProvider } from '@/components/app-context';
import { AppShell } from '@/components/app-shell';
import { ToastProvider } from '@/components/toast';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  await connectDB();
  const [user, business] = await Promise.all([
    User.findById(session.uid).select('name email role active mustChangePassword').lean(),
    Business.findById(session.bid).select('name currency').lean(),
  ]);
  if (!user || !user.active || !business) redirect('/api/auth/logout');

  return (
    <ToastProvider>
      <AppProvider
        user={{ id: session.uid, name: user.name, email: user.email, role: user.role, mustChangePassword: user.mustChangePassword }}
        business={{ id: session.bid, name: business.name, currency: business.currency }}
      >
        <AppShell>{children}</AppShell>
      </AppProvider>
    </ToastProvider>
  );
}
