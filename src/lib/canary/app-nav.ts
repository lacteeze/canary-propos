export function viewNeedsHospitable(view: string | null | undefined): boolean {
  const key = (view || '').trim()
  return key === '' || key === 'dashboard' || key === 'home' || key === 'leases' || key === 'tasks'
}

export function viewNeedsOrgTasks(view: string | null | undefined): boolean {
  return viewNeedsHospitable(view)
}

type NavListener = (pending: boolean) => void

const listeners = new Set<NavListener>()

export function subscribeAppNav(listener: NavListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function beginAppNav(): void {
  for (const listener of listeners) listener(true)
}

export function endAppNav(): void {
  for (const listener of listeners) listener(false)
}
