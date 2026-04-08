import { cert, getApp, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY
const privateKey = rawPrivateKey
  ? rawPrivateKey.replace(/\\n/g, '\n').replace(/^"|"$/g, '')
  : undefined

const adminApp =
  getApps().length > 0
    ? getApp()
    : initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey,
        }),
      })

export const adminAuth = getAuth(adminApp)
export const adminDb = getFirestore(adminApp)