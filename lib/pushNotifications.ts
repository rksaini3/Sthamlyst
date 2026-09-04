// lib/pushNotifications.ts
import { supabase } from '@/lib/supabase';

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

export async function registerPushNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.log('Push notifications not supported');
    return;
  }

  // FIX: tumhara auth client-side (implicit flow, browser session) hai —
  // koi server cookie session nahi. Isliye subscribe se pehle yahin check
  // karo ki user actually logged in hai; agar nahi hai to subscribe hi mat
  // karo (push_subscriptions.user_id NOT NULL hai, guest ke liye row ban
  // hi nahi sakti).
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    console.log('User not logged in — skipping push registration');
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        console.error('NEXT_PUBLIC_VAPID_PUBLIC_KEY missing');
        return;
      }

      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
      });
    }

    // Always (re)send to backend so last_renewed stays fresh, and to
    // cover the case where the user just logged in with an existing
    // browser subscription.
    await fetch('/api/notifications/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(subscription),
    });
  } catch (error) {
    console.error('Push registration failed:', error);
  }
}

export async function unsubscribePush() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();

  if (subscription) {
    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();

    if (session) {
      await fetch('/api/notifications/unsubscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ endpoint }),
      });
    }
  }
}
