import * as Sentry from "@sentry/react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { AppWrapper } from "./components/common/PageMeta.tsx";
import "./index.css";
import "./i18n";
import { useTranslation } from "react-i18next";
import { LocalizationRoot } from "./i18n/components/LocalizationRoot";
import { registerVelliqoServiceWorker } from "./pwa/registerServiceWorker";

Sentry.init({
  dsn: import.meta.env['VITE_SENTRY_DSN'] as string | undefined,
  environment: import.meta.env.MODE,
});

function LocalizedErrorFallback() {
  const { t } = useTranslation();
  return <p className="p-6 text-center text-sm text-muted-foreground">{t('system.unexpected_error')}</p>;
}

createRoot(document.getElementById("root")!).render(
  <Sentry.ErrorBoundary fallback={<LocalizedErrorFallback />}>
    <LocalizationRoot>
      <AppWrapper>
        <App />
      </AppWrapper>
    </LocalizationRoot>
  </Sentry.ErrorBoundary>
);

registerVelliqoServiceWorker();
