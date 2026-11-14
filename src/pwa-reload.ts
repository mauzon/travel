const CACHE_PREFIX = "travel-places-";

export async function hardReloadPage(): Promise<void> {
  if (!navigator.onLine) {
    window.location.reload();
    return;
  }

  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    await reg?.update();
    if (reg?.waiting) {
      reg.waiting.postMessage({ type: "SKIP_WAITING" });
    }
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith(CACHE_PREFIX)).map((k) => caches.delete(k)));
    }
  } catch {
    /* ignore */
  }

  const url = new URL(window.location.href);
  url.searchParams.delete("v");
  url.searchParams.set("v", String(Date.now()));
  window.location.replace(url.toString());
}