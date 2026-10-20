import { Logo } from '@/components/logo';
import { BarChart3, Boxes, WifiOff, Wallet } from 'lucide-react';

const features = [
  { icon: Wallet, title: 'Income & expenses', text: 'Record money in and out in seconds, by category and payment method.' },
  { icon: Boxes, title: 'Inventory that updates itself', text: 'Every sale deducts stock. Get alerts before you run out.' },
  { icon: BarChart3, title: 'Know your profit', text: 'Live dashboards and profit & loss reports — no accountant needed.' },
  { icon: WifiOff, title: 'Works offline', text: 'Install on your phone. Keep recording when the network drops.' },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-brand-900 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-brand-700/40 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <Logo className="h-10 w-10" />
          <span className="text-xl font-bold tracking-tight">FinWise</span>
        </div>
        <div className="relative">
          <h2 className="max-w-md text-3xl font-semibold leading-tight">Smart money management for small businesses.</h2>
          <ul className="mt-8 space-y-5">
            {features.map((f) => (
              <li key={f.title} className="flex gap-4">
                <span className="mt-0.5 rounded-lg bg-white/10 p-2"><f.icon className="h-5 w-5 text-brand-300" /></span>
                <div>
                  <p className="font-medium">{f.title}</p>
                  <p className="text-sm text-brand-100/80">{f.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-brand-200/70">© {new Date().getFullYear()} FinWise</p>
      </div>
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <Logo className="h-9 w-9" />
            <span className="text-lg font-bold tracking-tight">FinWise</span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
