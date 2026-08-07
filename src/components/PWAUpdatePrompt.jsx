import { useEffect } from 'react';
import { toast } from 'sonner';
// Virtual module provided by vite-plugin-pwa at build/dev time.
import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * Registers the app's service worker and shows small toasts when:
 *  - the app has been cached and is ready to work offline (first install), and
 *  - a new version has been downloaded and is waiting to take over (update).
 *
 * Mount this once near the root of the app (see App.jsx).
 */
export default function PWAUpdatePrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      // Poll for updates periodically so long-lived open tabs still notice new deploys.
      if (registration) {
        setInterval(() => {
          registration.update().catch(() => {});
        }, 60 * 60 * 1000);
      }
    },
  });

  useEffect(() => {
    if (offlineReady) {
      toast.success('Orbit is ready to work offline', {
        duration: 3000,
        onDismiss: () => setOfflineReady(false),
        onAutoClose: () => setOfflineReady(false),
      });
    }
  }, [offlineReady, setOfflineReady]);

  useEffect(() => {
    if (needRefresh) {
      toast('A new version of Orbit is available', {
        duration: Infinity,
        action: {
          label: 'Refresh',
          onClick: () => updateServiceWorker(true),
        },
        onDismiss: () => setNeedRefresh(false),
      });
    }
  }, [needRefresh, setNeedRefresh, updateServiceWorker]);

  return null;
}
