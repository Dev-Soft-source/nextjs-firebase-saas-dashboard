import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'

export async function getUserWorkspaces(userId: string) {
  const snap = await getDocs(
    query(collectionGroupSafe('members'), where('userId', '==', userId))
  )

  return snap.docs.map((d) => {
    const workspaceId = d.ref.parent.parent?.id
    return {
      workspaceId,
      ...(d.data() as Record<string, unknown>),
    }
  })
}

export async function getWorkspace(workspaceId: string) {
  const ref = doc(db, 'workspaces', workspaceId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() }
}

function collectionGroupSafe(name: string) {
  const { collectionGroup } = require('firebase/firestore')
  return collectionGroup(db, name)
}