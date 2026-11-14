/** Bundled app is always a production build (see esbuild define in build.mjs). */
const PRODUCTION =
  typeof process === "undefined" || !process.env?.NODE_ENV || process.env.NODE_ENV === "production";

export function registerServiceWorkerHandlers(handlers: {
  onOffline?: () => void;
  onOnline?: () => void;
  onUpdated?: () => void;
}): void {
  if (!PRODUCTION || window.location.protocol === "file:" || !("serviceWorker" in navigator)) return;

  const doRegister = () => {
    void navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        if (reg.waiting && navigator.serviceWorker.controller) {
          handlers.onUpdated?.();
        }
        reg.addEventListener("updatefound", () => {
          const worker = reg.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              handlers.onUpdated?.();
            }
          });
        });
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          handlers.onUpdated?.();
        });
      })
      .catch(() => {
        /* registration blocked or unavailable */
      });
  };

  if (document.readyState === "complete") doRegister();
  else window.addEventListener("load", doRegister, { once: true });

  const syncConnectivity = () => {
    if (navigator.onLine) handlers.onOnline?.();
    else handlers.onOffline?.();
  };
  window.addEventListener("online", syncConnectivity);
  window.addEventListener("offline", syncConnectivity);
  syncConnectivity();
}