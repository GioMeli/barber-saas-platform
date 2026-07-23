import React from 'react';
import { PWA_READY_EVENT, PWA_UPDATE_EVENT, type PWAUpdateDetail } from '@/pwa/registerServiceWorker';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

function isStandalone() {
  const iosStandalone = 'standalone' in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return window.matchMedia('(display-mode: standalone)').matches || iosStandalone;
}

export function usePWAStatus() {
  const [isOnline, setIsOnline] = React.useState(() => navigator.onLine);
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const [isInstalled, setIsInstalled] = React.useState(isStandalone);
  const [installPrompt, setInstallPrompt] = React.useState<BeforeInstallPromptEvent | null>(null);
  const [registration, setRegistration] = React.useState<ServiceWorkerRegistration | null>(null);
  const [updateAvailable, setUpdateAvailable] = React.useState(false);

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    const handleInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    };
    const handleBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const handleReady = (event: Event) => {
      const detail = (event as CustomEvent<PWAUpdateDetail>).detail;
      setRegistration(detail.registration);
    };
    const handleUpdate = (event: Event) => {
      const detail = (event as CustomEvent<PWAUpdateDetail>).detail;
      setRegistration(detail.registration);
      setUpdateAvailable(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('appinstalled', handleInstalled);
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener(PWA_READY_EVENT, handleReady);
    window.addEventListener(PWA_UPDATE_EVENT, handleUpdate);

    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.getRegistration('/').then((value) => {
        if (value) {
          setRegistration(value);
          setUpdateAvailable(Boolean(value.waiting));
        }
      });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('appinstalled', handleInstalled);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener(PWA_READY_EVENT, handleReady);
      window.removeEventListener(PWA_UPDATE_EVENT, handleUpdate);
    };
  }, []);

  const install = React.useCallback(async () => {
    if (!installPrompt) return false;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') setInstallPrompt(null);
    return choice.outcome === 'accepted';
  }, [installPrompt]);

  const applyUpdate = React.useCallback(() => {
    const waiting = registration?.waiting;
    if (!waiting) return;

    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });

    waiting.postMessage({ type: 'SKIP_WAITING' });
  }, [registration]);

  return {
    isOnline,
    isInstalled,
    canInstall: Boolean(installPrompt) && !isInstalled,
    needsManualIOSInstall: isIOS && !isInstalled,
    updateAvailable,
    install,
    applyUpdate,
  };
}
