/**
 * Amount — formatting and sign variants
 * StatusBadge — renders label (not colour only)
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Amount } from '@/components/ui/Amount'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { STATUS_MAP } from '@/lib/status'

describe('Amount', () => {
  it('renders the value string', () => {
    const { container } = render(<Amount value="12.50" />)
    expect(container.textContent).toContain('12.50')
  })

  it('renders USDC unit', () => {
    const { container } = render(<Amount value="1.00" size="md" />)
    expect(container.textContent).toContain('USDC')
  })

  it('sign=released adds + prefix', () => {
    const { container } = render(<Amount value="0.30" sign="released" />)
    expect(container.textContent).toContain('+')
  })

  it('sign=returned adds ↩ prefix', () => {
    const { container } = render(<Amount value="0.50" sign="returned" />)
    expect(container.textContent).toContain('↩')
  })

  it('sign=refunded adds ↩ prefix', () => {
    const { container } = render(<Amount value="0.70" sign="refunded" />)
    expect(container.textContent).toContain('↩')
  })

  it('sign=held adds no sign prefix', () => {
    const { container } = render(<Amount value="1.00" sign="held" />)
    expect(container.textContent).not.toContain('+')
    expect(container.textContent).not.toContain('↩')
  })

  it('size=sm renders', () => {
    render(<Amount value="5.00" size="sm" />)
    // No crash; value appears
    screen.getByText(/5\.00/)
  })

  it('size=xl renders', () => {
    render(<Amount value="100.00" size="xl" />)
    screen.getByText(/100\.00/)
  })

  it('renders — for missing value gracefully', () => {
    // caller is responsible for "—" but we test with an explicit dash
    render(<Amount value="—" />)
    screen.getByText(/—/)
  })
})

describe('StatusBadge', () => {
  const statuses = Object.values(STATUS_MAP)

  it('renders a visible label for every status', () => {
    for (const s of statuses) {
      const { unmount } = render(<StatusBadge status={s} />)
      expect(screen.getByRole('status', { name: s.label })).toBeTruthy()
      unmount()
    }
  })

  it('has aria-label equal to the status label (colour is NOT the only signal)', () => {
    const s = STATUS_MAP.active
    const { getByRole } = render(<StatusBadge status={s} />)
    const badge = getByRole('status')
    expect(badge.getAttribute('aria-label')).toBe(s.label)
    expect(badge.textContent).toContain(s.label)
  })

  it('size=sm renders without crash', () => {
    render(<StatusBadge status={STATUS_MAP.submitted} size="sm" />)
    screen.getByText('Submitted')
  })
})
