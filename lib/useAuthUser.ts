'use client'

import { onAuthStateChanged, User } from 'firebase/auth'
import { useEffect, useState } from 'react'
import { auth } from './firebase'

export function useAuthUser() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
      setLoading(false)
    })

    return unsubscribe
  }, [])

  return { user, loading }
}