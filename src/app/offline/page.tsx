export const metadata = { title: 'Offline' };
export default function Offline() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="rounded-full bg-amber-50 p-4 text-3xl">📡</div>
      <h1 className="text-lg font-semibold">You&apos;re offline</h1>
      <p className="max-w-sm text-sm text-slate-500">This page hasn&apos;t been saved for offline use yet. Pages you&apos;ve opened before still work, and income/expense entries you record offline will sync automatically when you reconnect.</p>
      <a href="/" className="mt-2 rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white">Try again</a>
    </div>
  );
}
