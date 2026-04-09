import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export async function getUserWorkspaces(userId: string) {
  const userSnap = await getDoc(doc(db, 'users', userId))
  const workspaceIds =
    (userSnap.data()?.workspaceIds as string[] | undefined) ?? []

  const results = await Promise.all(
    workspaceIds.map(async (workspaceId) => {
      const memberRef = doc(db, 'workspaces', workspaceId, 'members', userId)
      const memberSnap = await getDoc(memberRef)
      if (!memberSnap.exists()) return null
      return {
        workspaceId,
        ...(memberSnap.data() as Record<string, unknown>),
      }
    })
  )

  return results.filter(Boolean) as Array<{
    workspaceId: string
    [key: string]: unknown
  }>
}

export async function getWorkspace(workspaceId: string) {
  const ref = doc(db, 'workspaces', workspaceId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() }
}