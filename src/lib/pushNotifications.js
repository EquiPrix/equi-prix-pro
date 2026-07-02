// pushNotifications.js
// Handles browser Push API subscription lifecycle: requesting permission,
// subscribing via the service worker's PushManager, and syncing the
// subscription to Supabase so the send-push function knows who to notify.

import { sbFetch } from './equiprix-data';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window;
}

export function getPushPermissionState() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission; // 'default' | 'granted' | 'denied'
}

// Subscribes the current device to push and stores the subscription in
// Supabase, keyed by user_email. Returns true on success.
export async function subscribeToPush(userEmail) {
  if (!isPushSupported() || !userEmail) return false;
  if (!VAPID_PUBLIC_KEY) {
    console.error('VITE_VAPID_PUBLIC_KEY is not set — cannot subscribe to push.');
    return false;
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const sub = subscription.toJSON();
  await sbFetch('push_subscriptions?on_conflict=user_email,endpoint', {
    method: 'POST',
    body: JSON.stringify({
      user_email: userEmail,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      updated_at: new Date().toISOString(),
    }),
  });

  return true;
}

// Unsubscribes this device and removes the row from Supabase.
export async function unsubscribeFromPush(userEmail) {
  if (!isPushSupported()) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();
    if (userEmail) {
      await sbFetch('push_subscriptions?user_email=eq.' + encodeURIComponent(userEmail) + '&endpoint=eq.' + encodeURIComponent(endpoint), {
        method: 'DELETE',
      });
    }
  }
}

// Checks whether this specific device already has an active subscription
// (used to render the opt-in UI correctly on load).
export async function isSubscribedOnThisDevice() {
  if (!isPushSupported()) return false;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  return !!subscription;
}