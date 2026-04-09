export function formatRole(role: string) {
    if (role === 'owner') return 'Owner'
    if (role === 'admin') return 'Admin'
    return 'Member'
  }