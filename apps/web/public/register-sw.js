Promise.all([
  "serviceWorker" in navigator
    ? navigator.serviceWorker.getRegistrations().then((items) => Promise.all(items.map((item) => item.unregister())))
    : Promise.resolve(),
  "caches" in window ? caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))) : Promise.resolve()
]).catch(() => {});
