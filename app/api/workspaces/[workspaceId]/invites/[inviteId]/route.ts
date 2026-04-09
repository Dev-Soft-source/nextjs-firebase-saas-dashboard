import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'

type RouteContext = {
  params: Promise<{
    workspaceId: string
    inviteId: string
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

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { workspaceId, inviteId } = await context.params
    const uid = await getUidFromRequest(req)
    const role = await getUserRole(workspaceId, uid)

    if (!role || !['owner', 'admin'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const inviteRef = adminDb
      .collection('workspaces')
      .doc(workspaceId)
      .collection('invites')
      .doc(inviteId)

    const inviteSnap = await inviteRef.get()

    if (!inviteSnap.exists) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
    }

    const inviteData = inviteSnap.data()
    const token = inviteData?.token as string | undefined

    const batch = adminDb.batch()

    batch.update(inviteRef, {
      status: 'cancelled',
      cancelledBy: uid,
      cancelledAt: FieldValue.serverTimestamp(),
    })

    if (token) {
      batch.delete(adminDb.collection('inviteLookups').doc(token))
    }

    await batch.commit()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE invite failed:', error)

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}