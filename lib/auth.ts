import { onAuthStateChanged, User } from 'firebase/auth'
import { auth } from './firebase'

export function waitForAuth(): Promise<User | null> {
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub()
      resolve(user)
    })
  })
}