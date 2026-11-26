import type { BudgetSplitType } from '../../services/budget'

// Reglas de división de un gasto (estudio COCOMO: equitativa, porcentual o exacta).
// El backend repite estas validaciones; aquí sirven para avisar antes de guardar.

export const SPLIT_TYPE_OPTIONS: Array<{ value: BudgetSplitType; label: string }> = [
  { value: 'equitativa', label: 'Equitativa' },
  { value: 'porcentual', label: 'Porcentual' },
  { value: 'personalizada', label: 'Montos exactos' },
]

export const SPLIT_TYPE_LABELS: Record<BudgetSplitType, string> = {
  equitativa: 'Equitativa',
  porcentual: 'Porcentual',
  personalizada: 'Montos exactos',
}

const toNumber = (value: string | undefined): number => {
  const parsed = parseFloat(value ?? '')
  return Number.isFinite(parsed) ? parsed : 0
}

const hasAtMostTwoDecimals = (value: number): boolean =>
  Math.abs(Math.round(value * 100) - value * 100) < 1e-6

export const formatPercent = (value: number): string => `${Number(value.toFixed(2))}%`

/**
 * Igual que `allocateByPercent` del backend: reparte en centavos según centésimas
 * de porcentaje (10000 = 100%) y da los centavos sobrantes a las fracciones mayores.
 */
export function allocateByPercent(amount: number, hundredths: number[]): number[] {
  const totalCents = Math.round(amount * 100)
  const raw = hundredths.map((value) => (totalCents * value) / 10000)
  const cents = raw.map((value) => Math.floor(value))
  let leftover = totalCents - cents.reduce((sum, value) => sum + value, 0)
  const byFraction = raw
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((left, right) => right.fraction - left.fraction || left.index - right.index)
  for (const { index } of byFraction) {
    if (leftover <= 0) break
    cents[index] += 1
    leftover -= 1
  }
  return cents.map((value) => value / 100)
}

export interface PercentSplitCheck {
  totalPercent: number
  error: string | null
  /** Monto que le toca a cada integrante (vista previa). */
  shares: Record<string, number>
  /** Porcentajes mayores que 0, listos para mandar a la API. */
  percentages: Record<string, number>
}

export function checkPercentSplit(
  memberIds: string[],
  values: Record<string, string>,
  amount: number,
): PercentSplitCheck {
  const entries = memberIds.map((id) => ({ id, value: toNumber(values[id]) }))
  const invalid = entries.some(({ value }) => value < 0 || value > 100 || !hasAtMostTwoDecimals(value))
  const withHundredths = entries.map((entry) => ({ ...entry, hundredths: Math.round(entry.value * 100) }))
  const totalHundredths = withHundredths.reduce((sum, entry) => sum + entry.hundredths, 0)
  const positive = withHundredths.filter((entry) => entry.hundredths > 0)

  let error: string | null = null
  if (invalid) error = 'Cada porcentaje debe estar entre 0 y 100, con hasta dos decimales.'
  else if (positive.length === 0) error = 'Asigna un porcentaje a al menos un integrante.'
  else if (totalHundredths !== 10000) {
    error = `Los porcentajes suman ${formatPercent(totalHundredths / 100)}; deben sumar 100%.`
  }

  const exact = !error && amount > 0
  const allocated = exact ? allocateByPercent(amount, positive.map((entry) => entry.hundredths)) : []
  const shares = Object.fromEntries(
    positive.map((entry, index) => [
      entry.id,
      exact ? allocated[index] : Math.round(amount * entry.hundredths) / 10000,
    ]),
  )

  return {
    totalPercent: totalHundredths / 100,
    error,
    shares,
    percentages: Object.fromEntries(positive.map((entry) => [entry.id, entry.hundredths / 100])),
  }
}

/** Porcentajes iguales que suman exactamente 100 (p. ej. 33.33, 33.33, 33.34). */
export function equalPercentages(memberIds: string[]): Record<string, string> {
  if (memberIds.length === 0) return {}
  const base = Math.floor(10000 / memberIds.length)
  const leftover = 10000 - base * memberIds.length
  return Object.fromEntries(
    memberIds.map((id, index) => {
      const extra = index >= memberIds.length - leftover ? 1 : 0
      return [id, String((base + extra) / 100)]
    }),
  )
}

/** Valores del formulario a partir de lo guardado (porcentajes o montos). */
export const toInputValues = (values?: Record<string, number> | null): Record<string, string> =>
  Object.fromEntries(Object.entries(values ?? {}).map(([id, value]) => [id, String(value)]))
