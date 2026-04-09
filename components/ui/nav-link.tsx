'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ReactNode } from 'react'

type Props = {
    href: string
    children: ReactNode
    icon?: ReactNode
    exact?: boolean
    disabled?: boolean
  }

export default function NavLink({
  href,
  children,
  icon,
  exact = false,
  disabled = false,
}: Props) {
  const pathname = usePathname()

  const isActive = exact
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`)

  if (disabled) {
    return (
        <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-400">
        {icon}
        {children}
        </div>
    )
  }

  return (
    <Link
      href={href}
      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
        isActive
          ? 'bg-black text-white'
          : 'text-gray-700 hover:bg-gray-100'
      }`}
    >
      {icon && <span className="text-base">{icon}</span>}
      <span>{children}</span>
    </Link>
  )
}