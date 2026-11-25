import { apiClient } from './apiClient'

const API_URL = String(import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '')

export type BudgetCategory = 'transporte' | 'hospedaje' | 'actividad' | 'comida' | 'otro'
export type BudgetSplitType = 'equitativa' | 'personalizada'

export const BUDGET_CATEGORIES: BudgetCategory[] = ['transporte', 'hospedaje', 'actividad', 'comida', 'otro']

export interface BudgetMember {
  id: string
  usuario_id: string
  nombre: string
  email: string
  avatar_url?: string | null
  rol: string
}

export interface BudgetExpense {
  id: string
  groupId: string
  paidByUserId: string
  paidByName: string
  amount: number
  description: string
  category: BudgetCategory
  splitType: BudgetSplitType
  splitAmounts: Record<string, number>
  expenseDate: string | null
  createdAt: string | null
  createdByUserId: string | null
}

export interface BudgetSummary {
  /** null = el viaje no tiene presupuesto definido. */
  totalBudget: number | null
  committed: number
  available: number | null
  percentCommitted: number
  categoryTotals: Record<BudgetCategory, number>
  /** Presupuesto planeado por categoría; null = sin límite. */
  categoryBudgets: Record<BudgetCategory, number | null>
}

export interface BudgetSettlement {
  from: string
  to: string
  amount: number
}

export interface BudgetPaymentHistoryItem {
  id: string
  from: string
  to: string
  amount: number
  status: 'pendiente_validacion' | 'confirmado' | 'rechazado'
  payment_method: 'efectivo_presencial' | 'transferencia' | null
  paid_at: string
  created_by_user_id: string
  reviewed_by_user_id?: string | null
  reviewed_at?: string | null
  rejection_reason?: string | null
  proof_document_id?: string | null
  note?: string | null
}

export interface BudgetDashboardResponse {
  ok: boolean
  groupId: string
  myRole: string
  summary: BudgetSummary
  members: BudgetMember[]
  expenses: BudgetExpense[]
  balances: Record<string, number>
  settlements: BudgetSettlement[]
  groupSettlementSummary?: {
    totalTransfers: number
    totalAmount: number
  }
  paymentHistory: BudgetPaymentHistoryItem[]
}

export interface BudgetSummaryReport {
  ok: boolean
  generatedAt: string
  group: { id: string; nombre: string; destino: string | null; fechaInicio: string | null; fechaFin: string | null }
  totals: {
    budget: number | null
    committed: number
    available: number | null
    percentCommitted: number | null
    expenseCount: number
    confirmedPaymentsTotal: number
  }
  byCategory: Array<{ category: BudgetCategory; label: string; planned: number | null; spent: number }>
  byMember: Array<{
    usuarioId: string
    nombre: string
    paid: number
    share: number
    paymentsSent: number
    paymentsReceived: number
    /** Positivo = le deben; negativo = debe. */
    balance: number
  }>
  byDay: Array<{ date: string; total: number }>
}

export interface SaveBudgetExpensePayload {
  paid_by_user_id: string
  amount: number
  description: string
  category: BudgetCategory
  split_type: BudgetSplitType
  member_ids?: string[]
  split_amounts?: Record<string, number>
  expense_date?: string | null
}

export interface MarkSettlementPaymentPayload {
  from_user_id: string
  to_user_id: string
  amount: number
  payment_method: 'efectivo_presencial' | 'transferencia'
  proof_document_id?: string | null
  note?: string | null
}

export interface ReviewSettlementPaymentPayload {
  status: 'confirmado' | 'rechazado'
  rejection_reason?: string | null
}

export interface UpdatePendingSettlementPaymentPayload {
  amount: number
  payment_method: 'efectivo_presencial' | 'transferencia'
  proof_document_id?: string | null
  note?: string | null
}

/** Descarga un archivo autenticado (CSV o PDF) y lo guarda con el nombre que indique el servidor. */
async function downloadFile(path: string, token: string, fallbackName: string): Promise<void> {
  const response = await fetch(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!response.ok) {
    let message = `No se pudo descargar el archivo (HTTP ${response.status})`
    try {
      const body = await response.json()
      if (body?.error) message = String(body.error)
    } catch {
      // respuesta sin JSON
    }
    throw new Error(message)
  }
  const disposition = response.headers.get('content-disposition') ?? ''
  const fileName = disposition.match(/filename="([^"]+)"/)?.[1] ?? fallbackName
  const url = URL.createObjectURL(await response.blob())
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const budgetService = {
  getDashboard: (groupId: string, token: string) =>
    apiClient.get<BudgetDashboardResponse>(`/budget/${groupId}`, token),

  /** null o 0 quita el presupuesto total. */
  updateBudget: (groupId: string, totalBudget: number | null, token: string) =>
    apiClient.patch<BudgetDashboardResponse>(`/budget/${groupId}`, { totalBudget }, token),

  /** Monto por categoría; null o 0 quita el límite de esa categoría (solo admin). */
  updateCategoryBudgets: (
    groupId: string,
    categories: Partial<Record<BudgetCategory, number | null>>,
    token: string,
  ) => apiClient.put<BudgetDashboardResponse>(`/budget/${groupId}/categories`, { categories }, token),

  createExpense: (groupId: string, payload: SaveBudgetExpensePayload, token: string) =>
    apiClient.post<BudgetDashboardResponse>(`/budget/${groupId}/expenses`, payload, token),

  updateExpense: (groupId: string, expenseId: string, payload: SaveBudgetExpensePayload, token: string) =>
    apiClient.put<BudgetDashboardResponse>(`/budget/${groupId}/expenses/${expenseId}`, payload, token),

  deleteExpense: (groupId: string, expenseId: string, token: string) =>
    apiClient.delete<BudgetDashboardResponse>(`/budget/${groupId}/expenses/${expenseId}`, token),

  markSettlementPaid: (groupId: string, payload: MarkSettlementPaymentPayload, token: string) =>
    apiClient.post<BudgetDashboardResponse>(`/budget/${groupId}/settlements/payments`, payload, token),

  reviewSettlementPayment: (
    groupId: string,
    paymentId: string,
    payload: ReviewSettlementPaymentPayload,
    token: string,
  ) =>
    apiClient.patch<BudgetDashboardResponse>(
      `/budget/${groupId}/settlements/payments/${paymentId}/review`,
      payload,
      token,
    ),

  updatePendingSettlementPayment: (
    groupId: string,
    paymentId: string,
    payload: UpdatePendingSettlementPaymentPayload,
    token: string,
  ) =>
    apiClient.patch<BudgetDashboardResponse>(
      `/budget/${groupId}/settlements/payments/${paymentId}`,
      payload,
      token,
    ),

  deletePendingSettlementPayment: (groupId: string, paymentId: string, token: string) =>
    apiClient.delete<BudgetDashboardResponse>(`/budget/${groupId}/settlements/payments/${paymentId}`, token),

  getSummary: (groupId: string, token: string) =>
    apiClient.get<BudgetSummaryReport>(`/budget/${groupId}/summary`, token),

  downloadExpensesCsv: (groupId: string, token: string) =>
    downloadFile(`/budget/${groupId}/export.csv`, token, 'gastos.csv'),

  downloadSummaryPdf: (groupId: string, token: string) =>
    downloadFile(`/budget/${groupId}/summary.pdf`, token, 'resumen-gastos.pdf'),
}
