import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase-admin'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'

async function getUidFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing authorization token')
  }

  const idToken = authHeader.replace('Bearer ', '')
  const decoded = await adminAuth.verifyIdToken(idToken)
  return { uid: decoded.uid, email: decoded.email }
}

export async function POST(req: NextRequest) {
  try {
    const { uid, email: decodedEmail } = await getUidFromRequest(req)
    const body = await req.json()
    const token = String(body.token || '').trim()

    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 })
    }

    const lookupRef = adminDb.collection('inviteLookups').doc(token)
    const lookupSnap = await lookupRef.get()

    if (!lookupSnap.exists) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
    }

    const lookup = lookupSnap.data()!
    const workspaceId = lookup.workspaceId as string
    const inviteId = lookup.inviteId as string

    const inviteRef = adminDb
      .collection('workspaces')
      .doc(workspaceId)
      .collection('invites')
      .doc(inviteId)

    const inviteSnap = await inviteRef.get()

    if (!inviteSnap.exists) {
      await lookupRef.delete().catch(() => {})
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
    }

    const inviteData = inviteSnap.data()!

    if (inviteData.status !== 'pending') {
      return NextResponse.json(
        { error: 'This invite is no longer valid' },
        { status: 400 }
      )
    }

    const expiresAt = inviteData.expiresAt as Timestamp | undefined
    if (expiresAt && expiresAt.toMillis() < Date.now()) {
      return NextResponse.json({ error: 'This invite has expired' }, { status: 400 })
    }

    const userRecord = await adminAuth.getUser(uid)
    const userEmail = String(
      decodedEmail || userRecord.email || ''
    )
      .trim()
      .toLowerCase()

    const invitedEmail = String(inviteData.email || '')
      .trim()
      .toLowerCase()

    if (!userEmail || invitedEmail !== userEmail) {
      return NextResponse.json(
        {
          error:
            'Sign in with the email address this invitation was sent to.',
        },
        { status: 403 }
      )
    }

    const displayName =
      userRecord.displayName || userEmail.split('@')[0] || 'Member'

    const workspaceRef = adminDb.collection('workspaces').doc(workspaceId)
    const existingMemberRef = workspaceRef.collection('members').doc(uid)
    const existingMemberSnap = await existingMemberRef.get()

    const batch = adminDb.batch()

    if (!existingMemberSnap.exists) {
      batch.set(existingMemberRef, {
        userId: uid,
        email: userEmail,
        name: displayName,
        role: inviteData.role,
        rolePriority: inviteData.role === 'admin' ? 2 : 3,
        joinedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      })
    }

    batch.update(inviteRef, {
      status: 'accepted',
      acceptedBy: uid,
      acceptedAt: FieldValue.serverTimestamp(),
    })

    batch.delete(lookupRef)

    const userRef = adminDb.collection('users').doc(uid)
    batch.set(
      userRef,
      {
        workspaceIds: FieldValue.arrayUnion(workspaceId),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    )

    await batch.commit()

    return NextResponse.json({
      success: true,
      workspaceId,
    })
  } catch (error) {
    console.error('Accept invite failed:', error)

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}
