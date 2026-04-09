import { redirect } from 'next/navigation'

type Props = {
  params: Promise<{ workspaceId: string }>
}

export default async function LegacyInvitePathRedirect({ params }: Props) {
  const { workspaceId } = await params
  redirect(`/dashboard/workspace/${workspaceId}/members/invites#new-invite`)
}
