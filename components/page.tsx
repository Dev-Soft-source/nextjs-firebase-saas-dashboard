'use client'

import { signOut } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useRouter } from 'next/navigation'

export default function LogoutButton() {
  const router = useRouter()

  async function handleLogout() {
    await signOut(auth)
    router.push('/login')
  }

  return (
    <button
      onClick={handleLogout}
      className="rounded-lg border px-4 py-2"
    >
      Logout
    </button>
  )
}