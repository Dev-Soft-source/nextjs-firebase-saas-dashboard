import { notFound } from 'next/navigation'

type Props = {
  params: Promise<{ workspaceId: string }>
}

export default async function WorkspacePage({ params }: Props) {
  const { workspaceId } = await params

  if (!workspaceId) {
    notFound()
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">Workspace Dashboard</h1>
      <p className="mt-2 text-sm text-gray-600">Workspace ID: {workspaceId}</p>
    </div>
  )
}