/**
 * pushService.ts - Web Push subscription & permission helper for EmotiCare AI / MANAS
 */

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    return null;
  }
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    return reg;
  } catch (err) {
    console.warn('Service worker registration failed:', err);
    return null;
  }
}

export async function getPushSubscriptionStatus(): Promise<{
  isSupported: boolean;
  permission: NotificationPermission;
  isSubscribed: boolean;
}> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { isSupported: false, permission: 'denied', isSubscribed: false };
  }

  const permission = Notification.permission;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return {
      isSupported: true,
      permission,
      isSubscribed: sub !== null,
    };
  } catch (_) {
    return {
      isSupported: true,
      permission,
      isSubscribed: false,
    };
  }
}

export async function subscribeToPushNotifications(token?: string): Promise<{ success: boolean; message?: string }> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { success: false, message: 'Web Push is not supported in this browser.' };
  }

  // Request browser permission explicitly
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { success: false, message: 'Notification permission was not granted.' };
  }

  try {
    const reg = await navigator.serviceWorker.ready;

    // Fetch VAPID key from backend
    const vapidRes = await fetch('/api/notifications/vapid-public-key');
    if (!vapidRes.ok) {
      return { success: false, message: 'Failed to retrieve notification public key.' };
    }
    const { public_key } = await vapidRes.json();
    const applicationServerKey = urlBase64ToUint8Array(public_key);

    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey as unknown as BufferSource,
    });

    const subJson = subscription.toJSON();
    const authToken = token || localStorage.getItem('manas_access_token');

    const saveRes = await fetch('/api/notifications/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: JSON.stringify({
        endpoint: subJson.endpoint,
        keys: {
          p256dh: subJson.keys?.p256dh || '',
          auth: subJson.keys?.auth || '',
        },
      }),
    });

    if (saveRes.ok) {
      return { success: true };
    } else {
      return { success: false, message: 'Failed to register subscription with server.' };
    }
  } catch (err: any) {
    return { success: false, message: err?.message || 'Error subscribing to notifications.' };
  }
}

export async function unsubscribeFromPushNotifications(token?: string): Promise<{ success: boolean }> {
  if (!('serviceWorker' in navigator)) return { success: false };
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      const endpoint = sub.endpoint;
      await sub.unsubscribe();

      const authToken = token || localStorage.getItem('manas_access_token');
      await fetch('/api/notifications/unsubscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({ endpoint }),
      });
    }
    return { success: true };
  } catch (_) {
    return { success: false };
  }
}
