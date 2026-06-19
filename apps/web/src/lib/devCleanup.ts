export async function cleanupOldLocalServiceWorkers() {
  if (!isLocalhost() || !("serviceWorker" in navigator)) {
    return;
  }

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    if (registrations.length === 0) {
      return;
    }

    await Promise.all(registrations.map((registration) => registration.unregister()));

    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }

    const reloadKey = "telegram-mini-chat-sw-cleaned";
    if (!sessionStorage.getItem(reloadKey)) {
      sessionStorage.setItem(reloadKey, "true");
      window.location.reload();
    }
  } catch (error) {
    console.warn("Failed to clean old local service workers", error);
  }
}

function isLocalhost() {
  return location.hostname === "localhost" || location.hostname === "127.0.0.1";
}
