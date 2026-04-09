import WorkspaceShell from '@/components/ui/workspace-shell'

export default async function WorkspaceIdLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ workspaceId: string }>
}) {
  const { workspaceId } = await params

  return (
    <WorkspaceShell workspaceId={workspaceId}>{children}</WorkspaceShell>
  )
}
