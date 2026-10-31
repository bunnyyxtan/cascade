import { AlertTriangle } from 'lucide-react'
import { TARGET_CHAIN } from '@/lib/contracts'

export function NotDeployed() {
  return (
    <div className="glass-card p-8 text-center max-w-md mx-auto mt-8 space-y-4">
      <div className="size-12 mx-auto rounded-2xl flex items-center justify-center" style={{ background: 'rgba(180,83,9,0.08)' }}>
        <AlertTriangle className="size-6" style={{ color: 'var(--warn)' }} />
      </div>
      <div>
        <p className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>Contract not deployed</p>
        <p className="text-xs mt-1.5 text-pretty leading-relaxed max-w-xs mx-auto" style={{ color: 'var(--muted)' }}>
          The Cascade contract has not been deployed to {TARGET_CHAIN.name} yet.
          Set <code className="mono text-xs px-1 py-0.5 rounded" style={{ background: 'var(--surface-muted)' }}>VITE_CASCADE_ADDRESS</code> in{' '}
          <code className="mono text-xs px-1 py-0.5 rounded" style={{ background: 'var(--surface-muted)' }}>.env</code> after deployment.
        </p>
      </div>
    </div>
  )
}
