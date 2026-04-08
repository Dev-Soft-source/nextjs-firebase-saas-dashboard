import Link from 'next/link'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/dashboard" className="font-semibold">
            My SaaS
          </Link>
          <nav className="flex gap-4 text-sm">
            <Link href="/dashboard">Dashboard</Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-6">{children}</div>
    </div>
  )
}