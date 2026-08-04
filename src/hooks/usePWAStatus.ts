import React from 'react';
import { PWA_READY_EVENT, PWA_UPDATE_EVENT, type PWAUpdateDetail } from '@/pwa/registerServiceWorker';
import {
  clearDeferredInstallPrompt,
  getDeferredInstallPrompt,
  INSTALL_PROMPT_CHANGED_EVENT,
  type BeforeInstallPromptEventLike,
  type InstallChoice,
} from '@/pwa/installPromptStore';

function isStandalone() {
  const iosStandalone = 'standalone' in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return window.matchMedia('(display-mode: standalone)').matches || iosStandalone;
}

async function waitForInstallChoice(prompt: BeforeInstallPromptEventLike) {
  const promptResult = await prompt.prompt();
  if (promptResult && typeof promptResult === 'object' && 'outcome' in promptResult) {
    return promptResult as InstallChoice;
  }
  if (!prompt.userChoice) return null;

  let timeoutId = 0;
  const timeout = new Promise<null>((resolve) => {
    timeoutId = window.setTimeout(() => resolve(null), 15_000);
  });
  const result = await Promise.race([prompt.userChoice, timeout]);
  window.clearTimeout(timeoutId);
  return result;
}

export function usePWAStatus() {
  const [isOnline, setIsOnline] = React.useState(() => navigator.onLine);
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const [isInstalled, setIsInstalled] = React.useState(isStandalone);
  const [installPrompt, setInstallPrompt] = React.useState<BeforeInstallPromptEventLike | null>(() => getDeferredInstallPrompt());
  const [registration, setRegistration] = React.useState<ServiceWorkerRegistration | null>(null);
  const [updateAvailable, setUpdateAvailable] = React.useState(false);

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    const handleInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    };
    const handlePromptChanged = () => setInstallPrompt(getDeferredInstallPrompt());
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
    window.addEventListener(INSTALL_PROMPT_CHANGED_EVENT, handlePromptChanged);
    window.addEventListener(PWA_READY_EVENT, handleReady);
    window.addEventListener(PWA_UPDATE_EVENT, handleUpdate);

    handlePromptChanged();

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
      window.removeEventListener(INSTALL_PROMPT_CHANGED_EVENT, handlePromptChanged);
      window.removeEventListener(PWA_READY_EVENT, handleReady);
      window.removeEventListener(PWA_UPDATE_EVENT, handleUpdate);
    };
  }, []);

  const install = React.useCallback(async () => {
    const prompt = installPrompt || getDeferredInstallPrompt();
    if (!prompt) return false;

    try {
      const choice = await waitForInstallChoice(prompt);
      clearDeferredInstallPrompt(prompt);
      setInstallPrompt(null);
      return choice?.outcome === 'accepted';
    } catch (error) {
      console.warn('Velliqo install prompt failed', error);
      clearDeferredInstallPrompt(prompt);
      setInstallPrompt(null);
      return false;
    }
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
