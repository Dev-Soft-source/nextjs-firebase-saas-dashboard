import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase-admin'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'

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

export async function POST(req: NextRequest, context: RouteContext) {
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

    if (!inviteData) {
      return NextResponse.json({ error: 'Invite data missing' }, { status: 400 })
    }

    if (inviteData.status !== 'pending') {
      return NextResponse.json(
        { error: 'Only pending invites can be resent' },
        { status: 400 }
      )
    }

    await inviteRef.update({
        resentBy: uid,
        resentAt: FieldValue.serverTimestamp(),
        resendCount: FieldValue.increment(1),
        expiresAt: Timestamp.fromDate(
          new Date(Date.now() + 1000 * 60 * 60 * 24 * 7)
        ),
    })

    return NextResponse.json({
      success: true,
      invite: {
        id: inviteSnap.id,
        email: inviteData.email ?? '',
        role: inviteData.role ?? 'member',
        token: inviteData.token ?? '',
      },
    })
  } catch (error) {
    console.error('POST resend invite failed:', error)

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}