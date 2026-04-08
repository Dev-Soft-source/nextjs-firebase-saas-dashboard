import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'

async function getUid(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing token')
  }
  const idToken = authHeader.slice(7)
  const decoded = await adminAuth.verifyIdToken(idToken)
  return decoded.uid
}

export async function POST(req: NextRequest) {
  try {
    const uid = await getUid(req)
    const { workspaceId, inviteId } = await req.json()

    const inviteRef = adminDb
      .collection('workspaces')
      .doc(workspaceId)
      .collection('invites')
      .doc(inviteId)

    const inviteSnap = await inviteRef.get()

    if (!inviteSnap.exists) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
    }

    const invite = inviteSnap.data()!

    await adminDb
      .collection('workspaces')
      .doc(workspaceId)
      .collection('members')
      .doc(uid)
      .set({
        userId: uid,
        email: invite.email,
        role: invite.role,
        joinedAt: FieldValue.serverTimestamp(),
      })

    await inviteRef.delete()

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    )
  }
}