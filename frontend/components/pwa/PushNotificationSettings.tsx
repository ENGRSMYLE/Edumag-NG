'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, BellOff, BellRing, CheckCircle2, Loader2, ShieldCheck, Smartphone, WifiOff, type LucideIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { notificationsApi } from '@/lib/api';

type BrowserPermission = NotificationPermission | 'unsupported';

function vapidKey(value: string): ArrayBuffer {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const decoded = window.atob((value + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(decoded, character => character.charCodeAt(0)).buffer;
}

function supportsPush() {
  return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
}

function messageFrom(error: unknown) {
  if (error instanceof Error) return error.message;
  return 'Push notifications could not be updated. Please try again.';
}

function isIos() {
  return typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function isStandalone() {
  if (typeof window === 'undefined') return false;
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone;
  return iosStandalone === true || window.matchMedia('(display-mode: standalone)').matches;
}

async function getOrRegisterServiceWorker() {
  const existing = await navigator.serviceWorker.getRegistration('/');
  if (existing) return existing;
  await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  return navigator.serviceWorker.ready;
}

export function PushNotificationSettings() {
  const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY?.trim() ?? '';
  const lock = useRef(false);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [online, setOnline] = useState(true);
  const [permission, setPermission] = useState<BrowserPermission>('unsupported');
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [checking, setChecking] = useState(true);
  const [action, setAction] = useState<'enable' | 'disable' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showIosHelp, setShowIosHelp] = useState(false);

  const statusQuery = useQuery({
    queryKey: ['notifications', 'push', 'status'],
    queryFn: ({ signal }) => notificationsApi.pushStatus({ signal, timeout: 10_000 }).then(response => response.data),
    enabled: supported === true && online,
    staleTime: 30_000,
    retry: 1,
  });
  const refetchStatus = statusQuery.refetch;

  const inspectBrowser = useCallback(async () => {
    const browserSupported = supportsPush();
    setSupported(browserSupported);
    setOnline(navigator.onLine);
    setShowIosHelp(isIos() && !isStandalone());
    if (!browserSupported) {
      setPermission('unsupported');
      setChecking(false);
      return;
    }
    setPermission(Notification.permission);
    try {
      const registration = await navigator.serviceWorker.getRegistration('/');
      setSubscription((await registration?.pushManager.getSubscription()) ?? null);
    } catch (error) {
      setActionError(messageFrom(error));
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void inspectBrowser();
    const handleOnline = () => { setOnline(true); void refetchStatus(); };
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [inspectBrowser, refetchStatus]);

  const enable = async () => {
    if (lock.current || !supported || !online) return;
    if (permission === 'denied') {
      setActionError('Notifications are blocked. Allow them in your browser settings first.');
      return;
    }
    if (!statusQuery.data?.configured || !publicKey) {
      setActionError('Push notifications are not available on the server yet.');
      return;
    }

    lock.current = true;
    setAction('enable');
    setActionError(null);
    let created: PushSubscription | null = null;
    try {
      // Browser permission is deliberately requested only from this click handler.
      const nextPermission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
      setPermission(nextPermission);
      if (nextPermission !== 'granted') {
        if (nextPermission === 'denied') setActionError('Permission was denied. Change it later in your browser settings.');
        return;
      }

      const registration = await getOrRegisterServiceWorker();
      let nextSubscription = await registration.pushManager.getSubscription();
      if (!nextSubscription) {
        nextSubscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidKey(publicKey) });
        created = nextSubscription;
      }
      const value = nextSubscription.toJSON();
      if (!value.endpoint || !value.keys?.p256dh || !value.keys.auth) throw new Error('The browser returned an incomplete push subscription.');
      await notificationsApi.subscribePush({ endpoint: value.endpoint, keys: { p256dh: value.keys.p256dh, auth: value.keys.auth }, device_name: navigator.userAgent.slice(0, 255) });
      setSubscription(nextSubscription);
      await refetchStatus();
      toast.success('Notifications enabled on this device');
    } catch (error) {
      if (created) await created.unsubscribe().catch(() => false);
      setActionError(messageFrom(error));
    } finally {
      setAction(null);
      lock.current = false;
    }
  };

  const disable = async () => {
    if (lock.current || !subscription || !online) return;
    lock.current = true;
    setAction('disable');
    setActionError(null);
    try {
      await notificationsApi.unsubscribePush(subscription.endpoint);
      await subscription.unsubscribe();
      setSubscription(null);
      await refetchStatus();
      toast.success('Notifications disabled on this device');
    } catch (error) {
      setActionError(messageFrom(error));
    } finally {
      setAction(null);
      lock.current = false;
    }
  };

  const configured = statusQuery.data?.configured === true && publicKey.length > 0;
  const subscribed = permission === 'granted' && subscription !== null;
  const loading = supported === null || checking || (supported === true && statusQuery.isLoading);
  const visibleError = actionError ?? (statusQuery.error ? messageFrom(statusQuery.error) : null);

  return <section className="card-shell overflow-hidden" aria-labelledby="push-heading">
    <div className="card-core">
      <div className="flex items-start gap-3 border-b border-slate-100 p-5">
        <div className="rounded-xl bg-blue-50 p-2.5 text-blue-700"><BellRing className="h-5 w-5" aria-hidden /></div>
        <div className="min-w-0"><h2 id="push-heading" className="font-semibold text-slate-900">Push notifications</h2><p className="mt-1 text-sm leading-5 text-slate-500">Get privacy-safe alerts for messages, attendance, results, assignments, and announcements.</p></div>
      </div>
      <div className="space-y-4 p-5">
        {loading ? <div className="flex items-center gap-2 text-sm text-slate-500" role="status"><Loader2 className="h-4 w-4 animate-spin" />Checking notification availability…</div>
          : !supported ? <Status icon={BellOff} title="Not supported on this browser">Try an up-to-date browser that supports service workers and web push.</Status>
          : !online ? <Status icon={WifiOff} title="You are offline">Reconnect to change your notification settings.</Status>
          : !configured ? <Status icon={AlertTriangle} title="Push is unavailable">The school has not enabled push notifications on the server yet.</Status>
          : permission === 'denied' ? <Status icon={BellOff} title="Notifications are blocked">This browser will not prompt again. Allow notifications in the site permissions, then return here.</Status>
          : subscribed ? <Status icon={CheckCircle2} title="Enabled on this device" success>This device is subscribed. Your account has {statusQuery.data?.device_count ?? 1} active notification {(statusQuery.data?.device_count ?? 1) === 1 ? 'device' : 'devices'}.</Status>
          : permission === 'granted' ? <Status icon={Smartphone} title="Permission granted — device not subscribed">Select Enable notifications to register this browser with your account.</Status>
          : <Status icon={ShieldCheck} title="Stay informed">We ask for permission only after you select Enable. Lock-screen alerts will not contain private scores, balances, or message contents.</Status>}

        {showIosHelp && <div className="break-words rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm leading-5 text-slate-600"><strong className="text-slate-900">Using an iPhone or iPad?</strong> In Safari, choose Share, then Add to Home Screen. Open the installed app before enabling notifications.</div>}
        {visibleError && <div className="break-words rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{visibleError}</div>}

        <div className="flex flex-col gap-2 sm:flex-row">
          {subscribed ? <button type="button" onClick={disable} disabled={action !== null || !online} className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50 sm:w-auto">{action === 'disable' ? 'Disabling…' : 'Disable on this device'}</button>
            : <button type="button" onClick={enable} disabled={action !== null || !online || !supported || !configured || permission === 'denied'} className="w-full rounded-lg bg-[var(--color-navy)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 sm:w-auto">{action === 'enable' ? 'Enabling…' : 'Enable notifications'}</button>}
          {statusQuery.isError && online && <button type="button" onClick={() => void refetchStatus()} disabled={statusQuery.isFetching} className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50 sm:w-auto">Try again</button>}
        </div>
      </div>
    </div>
  </section>;
}

function Status({ icon: Icon, title, success = false, children }: { icon: LucideIcon; title: string; success?: boolean; children: ReactNode }) {
  return <div className="flex items-start gap-3"><Icon className={`mt-0.5 h-5 w-5 shrink-0 ${success ? 'text-emerald-600' : 'text-slate-500'}`} aria-hidden /><div className="min-w-0"><p className="text-sm font-semibold text-slate-900">{title}</p><p className="mt-1 break-words text-sm leading-5 text-slate-500">{children}</p></div></div>;
}
