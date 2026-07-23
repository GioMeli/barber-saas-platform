export type PWAUpdateDetail = {
  registration: ServiceWorkerRegistration;
};

export const PWA_UPDATE_EVENT = 'velliqo:pwa-update';
export const PWA_READY_EVENT = 'velliqo:pwa-ready';

export function registerVelliqoServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    void navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then((registration) => {
        window.dispatchEvent(new CustomEvent(PWA_READY_EVENT, { detail: { registration } }));

        if (registration.waiting) notifyUpdate(registration);

        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          if (!installing) return;

          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              notifyUpdate(registration);
            }
          });
        });

        window.setInterval(() => void registration.update(), 60 * 60 * 1000);
      })
      .catch((error: unknown) => {
        console.error('Velliqo service worker registration failed', error);
      });
  });
}

function notifyUpdate(registration: ServiceWorkerRegistration) {
  window.dispatchEvent(
    new CustomEvent<PWAUpdateDetail>(PWA_UPDATE_EVENT, {
      detail: { registration },
    })
  );
}
