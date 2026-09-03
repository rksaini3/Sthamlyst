// components/PushInit.tsx
// FIX: original code rewrote app/page.tsx as a fake RootLayout with
// <html><body> — that's app/layout.tsx's job in the App Router, and
// overwriting page.tsx like that would break your actual home page.
// This is a tiny, self-contained component instead — just drop
// `<PushInit />` anywhere inside your EXISTING app/layout.tsx body,
// one line, nothing else about your layout needs to change.
'use client';

import { useEffect } from 'react';
import { registerPushNotifications } from '@/lib/pushNotifications';

export function PushInit() {
  useEffect(() => {
    registerPushNotifications();
  }, []);

  return null;
}
