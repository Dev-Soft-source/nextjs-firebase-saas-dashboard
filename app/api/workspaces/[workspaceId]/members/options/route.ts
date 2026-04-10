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

async function getMember(workspaceId: string, uid: string) {
  const snap = await adminDb
    .collection('workspaces')
    .doc(workspaceId)
    .collection('members')
    .doc(uid)
    .get()

  return snap.exists ? snap.data() : null
}

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { workspaceId } = await context.params
    const uid = await getUidFromRequest(req)
    const member = await getMember(workspaceId, uid)

    if (!member) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const snap = await adminDb
      .collection('workspaces')
      .doc(workspaceId)
      .collection('members')
      .get()

    const members = snap.docs.map((doc) => {
      const data = doc.data()

      return {
        id: doc.id,
        userId: data.userId ?? doc.id,
        name: data.name ?? '',
        email: data.email ?? '',
        role: data.role ?? 'member',
      }
    })

    return NextResponse.json({ members })
  } catch (error) {
    console.error('GET member options failed:', error)

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}