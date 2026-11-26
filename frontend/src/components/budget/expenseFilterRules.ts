import type { Expense } from './BudgetDashboard'

// Consulta y filtrado del historial de gastos (estudio COCOMO): por texto, fecha,
// quién pagó o actividad del itinerario.

export interface ExpenseFilterState {
  query: string
  payerId: string
  /** Id de actividad, NO_ACTIVITY_FILTER o vacío (todas). */
  activity: string
  /** YYYY-MM-DD inclusivo; vacío = sin límite. */
  from: string
  to: string
}

export const EMPTY_EXPENSE_FILTERS: ExpenseFilterState = {
  query: '',
  payerId: '',
  activity: '',
  from: '',
  to: '',
}

export const NO_ACTIVITY_FILTER = '__sin_actividad__'

export const hasActiveExpenseFilters = (filters: ExpenseFilterState): boolean =>
  Object.values(filters).some((value) => value !== '')

const normalizeText = (value: string): string =>
  value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()

export function filterExpenses(
  expenses: Expense[],
  filters: ExpenseFilterState,
  activityIdsFor: (expenseId: string) => string[],
): Expense[] {
  const query = normalizeText(filters.query)
  return expenses.filter((expense) => {
    if (query && !normalizeText(expense.titulo).includes(query)) return false
    if (filters.payerId && expense.pagadoPorId !== filters.payerId) return false
    if (filters.from && expense.fecha < filters.from) return false
    if (filters.to && expense.fecha > filters.to) return false
    if (filters.activity) {
      const activityIds = activityIdsFor(expense.id)
      if (filters.activity === NO_ACTIVITY_FILTER) return activityIds.length === 0
      return activityIds.includes(filters.activity)
    }
    return true
  })
}
