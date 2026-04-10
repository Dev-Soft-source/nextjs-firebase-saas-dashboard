import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase-admin'

type RouteContext = {
  params: Promise<{
    workspaceId: string
  }>
}

async function getUidFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing authorization token')
  }

  const idToken = authHeader.replace('Bearer ', '')
  const decoded = await adminAuth.verifyIdToken(idToken)
  return decoded.uid
}

async function getUserRole(workspaceId: string, uid: string) {
  const memberRef = adminDb
    .collection('workspaces')
    .doc(workspaceId)
    .collection('members')
    .doc(uid)

  const memberSnap = await memberRef.get()
  if (!memberSnap.exists) return null
  return memberSnap.data()?.role ?? null
}

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { workspaceId } = await context.params
    const uid = await getUidFromRequest(req)
    const role = await getUserRole(workspaceId, uid)

    if (!role) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const projectsSnap = await adminDb
      .collection('workspaces')
      .doc(workspaceId)
      .collection('projects')
      .orderBy('createdAt', 'desc')
      .get()

    const projects = projectsSnap.docs.map((doc) => {
      const data = doc.data()
      return {
        id: doc.id,
        name: String(data.name || ''),
        description: String(data.description || ''),
        status: String(data.status || 'active'),
      }
    })

    return NextResponse.json({ projects })
  } catch (error) {
    console.error('GET projects failed:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}
