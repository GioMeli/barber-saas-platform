export type InstallChoice = {
  outcome: 'accepted' | 'dismissed';
  platform?: string;
};

export type BeforeInstallPromptEventLike = Event & {
  prompt: () => Promise<InstallChoice | void>;
  userChoice?: Promise<InstallChoice>;
};

export const INSTALL_PROMPT_CHANGED_EVENT = 'velliqo:install-prompt-changed';

let initialized = false;
let deferredPrompt: BeforeInstallPromptEventLike | null = null;

function notifyPromptChanged() {
  window.dispatchEvent(new CustomEvent(INSTALL_PROMPT_CHANGED_EVENT));
}

export function initInstallPromptCapture() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  window.addEventListener('beforeinstallprompt', (event: Event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEventLike;
    notifyPromptChanged();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notifyPromptChanged();
  });
}

export function getDeferredInstallPrompt() {
  return deferredPrompt;
}

export function clearDeferredInstallPrompt(prompt?: BeforeInstallPromptEventLike | null) {
  if (prompt && deferredPrompt !== prompt) return;
  deferredPrompt = null;
  if (typeof window !== 'undefined') notifyPromptChanged();
}
