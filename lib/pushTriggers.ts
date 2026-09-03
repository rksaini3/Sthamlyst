// lib/pushTriggers.ts
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;

export async function sendStreakNotification(userId: string, sathiName: string) {
  return fetch('/api/notifications/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${INTERNAL_API_KEY}` },
    body: JSON.stringify({
      userId,
      title: '🔥 Streak Active!',
      body: `${sathiName} ke saath stream chalti hai. Aaj seekh lo!`,
      url: '/sathi',
      type: 'streak',
    }),
  });
}

export async function sendCommentNotification(userId: string, commenterName: string, reelId: string) {
  return fetch('/api/notifications/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${INTERNAL_API_KEY}` },
    body: JSON.stringify({
      userId,
      title: '💬 Comment Mila',
      body: `${commenterName} ne reply kiya`,
      url: `/reel/${reelId}`,
      type: 'comment',
    }),
  });
}

export async function sendSaleNotification(userId: string, productName: string, amount: number) {
  return fetch('/api/notifications/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${INTERNAL_API_KEY}` },
    body: JSON.stringify({
      userId,
      title: '💰 Sale!',
      body: `${productName} bika! ₹${amount} kamaya`,
      url: '/earnings',
      type: 'sale',
    }),
  });
}
