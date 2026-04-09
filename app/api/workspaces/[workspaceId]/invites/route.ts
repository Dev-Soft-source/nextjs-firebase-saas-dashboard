import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase-admin'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import crypto from 'crypto'

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

  if (!memberSnap.exists) {
    return null
  }

  return memberSnap.data()?.role ?? null
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { workspaceId } = await context.params
    const uid = await getUidFromRequest(req)
    const role = await getUserRole(workspaceId, uid)

    if (!role || !['owner', 'admin'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()

    const email = String(body.email || '').trim().toLowerCase()
    const inviteRole = String(body.role || '').trim()

    if (!email || !['admin', 'member'].includes(inviteRole)) {
      return NextResponse.json(
        { error: 'Invalid email or role' },
        { status: 400 }
      )
    }

    const token = crypto.randomBytes(24).toString('hex')

    const inviteRef = adminDb
      .collection('workspaces')
      .doc(workspaceId)
      .collection('invites')
      .doc()

    const expiresAt = Timestamp.fromDate(
      new Date(Date.now() + 1000 * 60 * 60 * 24 * 7)
    )

    const batch = adminDb.batch()

    batch.set(inviteRef, {
      email,
      role: inviteRole,
      token,
      invitedBy: uid,
      status: 'pending',
      createdAt: FieldValue.serverTimestamp(),
      expiresAt,
    })

    batch.set(adminDb.collection('inviteLookups').doc(token), {
      workspaceId,
      inviteId: inviteRef.id,
      createdAt: FieldValue.serverTimestamp(),
    })

    await batch.commit()

    return NextResponse.json({
      success: true,
      inviteId: inviteRef.id,
      token,
    })
  } catch (error) {
    console.error('POST invite failed:', error)

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}