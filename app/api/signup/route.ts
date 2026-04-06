import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
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

export async function POST(req: NextRequest) {
  try {
    const uid = await getUidFromRequest(req)
    const body = await req.json()

    const name = String(body.name || '').trim()
    const email = String(body.email || '').trim().toLowerCase()
    const workspaceName = String(body.workspaceName || '').trim()

    if (!name || !email || !workspaceName) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const workspaceRef = adminDb.collection('workspaces').doc()
    const workspaceId = workspaceRef.id

    const batch = adminDb.batch()

    batch.set(adminDb.collection('users').doc(uid), {
      uid,
      name,
      email,
      createdAt: FieldValue.serverTimestamp(),
    })

    batch.set(workspaceRef, {
      name: workspaceName,
      slug: slugify(workspaceName),
      ownerId: uid,
      plan: 'free',
      seats: 1,
      createdAt: FieldValue.serverTimestamp(),
    })

    batch.set(workspaceRef.collection('members').doc(uid), {
      userId: uid,
      email,
      name,
      role: 'owner',
      joinedAt: FieldValue.serverTimestamp(),
    })

    await batch.commit()

    return NextResponse.json({
      success: true,
      workspaceId,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}