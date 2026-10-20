'use client';
import { useEffect, useState } from 'react';
import { syncOutbox, outbox, OUTBOX_EVENT } from '@/lib/client';
import { useToast } from './toast';

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
let deferredPrompt: BIPEvent | null = null;
const INSTALL_EVENT = 'finwise:installable';

/** Registers the service worker and keeps the offline outbox syncing. */
export function PWARegister() {
  const toast = useToast();
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((e) => console.warn('SW registration failed', e));
    }
    const onBIP = (e: Event) => { e.preventDefault(); deferredPrompt = e as BIPEvent; window.dispatchEvent(new Event(INSTALL_EVENT)); };
    window.addEventListener('beforeinstallprompt', onBIP);

    const sync = async () => {
      const n = await syncOutbox();
      if (n > 0) toast(`${n} offline ${n === 1 ? 'entry' : 'entries'} synced`);
    };
    sync();
    window.addEventListener('online', sync);
    const t = setInterval(sync, 60_000);
    return () => { window.removeEventListener('beforeinstallprompt', onBIP); window.removeEventListener('online', sync); clearInterval(t); };
  }, [toast]);
  return null;
}

export function useInstallPrompt() {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    setAvailable(!!deferredPrompt);
    const on = () => setAvailable(!!deferredPrompt);
    window.addEventListener(INSTALL_EVENT, on);
    return () => window.removeEventListener(INSTALL_EVENT, on);
  }, []);
  const install = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    setAvailable(false);
  };
  return { available, install };
}

export function useConnectivity() {
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  useEffect(() => {
    setOnline(navigator.onLine);
    const refresh = async () => setPending((await outbox.all()).length);
    refresh();
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    window.addEventListener(OUTBOX_EVENT, refresh);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); window.removeEventListener(OUTBOX_EVENT, refresh); };
  }, []);
  return { online, pending };
}
