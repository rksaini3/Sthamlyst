import { redirect } from 'next/navigation'

// The Learn feed is now merged into the Instagram-style home feed.
export default function LearnRedirect() {
  redirect('/')
}
