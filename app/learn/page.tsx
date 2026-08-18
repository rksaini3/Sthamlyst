import { redirect } from 'next/navigation'

// The Learn feed is merged into the Instagram-style home feed (app/page.tsx).
export default function LearnRedirect() {
  redirect('/')
}
