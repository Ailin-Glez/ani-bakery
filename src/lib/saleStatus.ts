import type { SaleStatus } from '../types'

export const SALE_STATUSES: SaleStatus[] = ['pending_confirmation', 'pending_payment', 'in_progress', 'delivered', 'cancelled']

// Maps legacy status values (from earlier versions of this feature) onto the current pipeline
// so old records still render and export correctly.
const LEGACY_STATUS_MAP: Record<string, SaleStatus> = {
  pending: 'pending_confirmation',
  confirmed: 'pending_payment',
  completed: 'delivered',
}

export function normalizeSaleStatus(status: SaleStatus): SaleStatus {
  return (SALE_STATUSES as string[]).includes(status) ? status : (LEGACY_STATUS_MAP[status] ?? 'pending_confirmation')
}
