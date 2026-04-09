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

    if (!role || !['owner', 'admin'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const invitesSnap = await adminDb
      .collection('workspaces')
      .doc(workspaceId)
      .collection('invites')
      .where('status', '==', 'pending')
      .get()

    const invites = invitesSnap.docs.map((doc) => {
      const data = doc.data()

      return {
        id: doc.id,
        email: data.email ?? '',
        role: data.role ?? 'member',
        status: data.status ?? 'pending',
        token: data.token ?? '',
        invitedBy: data.invitedBy ?? '',
        createdAt: data.createdAt ?? null,
        expiresAt: data.expiresAt ?? null,
      }
    })

    return NextResponse.json({ invites })
  } catch (error) {
    console.error('GET pending invites failed:', error)

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}