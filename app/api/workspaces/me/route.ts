
import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase-admin'

async function getUidFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing authorization token')
  }

  const idToken = authHeader.replace('Bearer ', '')
  const decoded = await adminAuth.verifyIdToken(idToken)
  return decoded.uid
}

export async function GET(req: NextRequest) {
  try {
    const uid = await getUidFromRequest(req)

    const userSnap = await adminDb.collection('users').doc(uid).get()
    const workspaceIds = (userSnap.data()?.workspaceIds as string[] | undefined) ?? []

    const workspaces = await Promise.all(
      workspaceIds.map(async (workspaceId) => {
        const workspaceRef = adminDb.collection('workspaces').doc(workspaceId)
        const memberRef = workspaceRef.collection('members').doc(uid)

        const [workspaceSnap, memberSnap] = await Promise.all([
          workspaceRef.get(),
          memberRef.get(),
        ])

        if (!workspaceSnap.exists || !memberSnap.exists) return null

        const workspaceData = workspaceSnap.data()
        const memberData = memberSnap.data()!

        return {
          workspaceId,
          role: memberData.role,
          name: workspaceData?.name ?? '',
          slug: workspaceData?.slug ?? '',
          ownerId: workspaceData?.ownerId ?? '',
          plan: workspaceData?.plan ?? '',
        }
      })
    )

    return NextResponse.json({
      workspaces: workspaces.filter(Boolean),
    })
  } catch (error) {
    console.error('GET /api/workspaces/me failed:', error)

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}