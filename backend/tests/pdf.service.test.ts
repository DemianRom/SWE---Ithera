import { generateBudgetSummaryPdf, generateCollectionReceiptPdf } from '../src/domain/budget/pdf.service';
import type { BudgetSummary } from '../src/domain/budget/budget.service';

const summary = {
  ok: true, generatedAt: '2026-11-28T18:00:00.000Z',
  group: { id: '42', nombre: 'Viaje de prueba', destino: 'Oaxaca', fechaInicio: '2026-12-01', fechaFin: '2026-12-05' },
  totals: { budget: 5000, committed: 3000, available: 2000, percentCommitted: 60, expenseCount: 2, confirmedPaymentsTotal: 100 },
  byCategory: [{ category: 'comida', label: 'Comida', planned: 4000, spent: 3000 }],
  byMember: Array.from({ length: 40 }, (_, i) => ({ usuarioId: String(i), nombre: `Integrante ${i} Nombre Completo`, paid: 3000, share: 2000, balance: 1000, paymentsSent: 0, paymentsReceived: 0 })),
  byDay: [], expenses: [],
} as BudgetSummary;

test('el resumen conserva datos y todos los integrantes en varias paginas', async () => {
  const pdf = (await generateBudgetSummaryPdf(summary)).toString('binary');
  expect(pdf.startsWith('%PDF-1.4')).toBe(true);
  expect(pdf).toMatch(/\/Count ([2-9]|[1-9]\d+)/);
  expect(pdf).toContain('Integrante 0 Nombre Completo');
  expect(pdf).toContain('Integrante 39 Nombre Completo');
  expect(pdf).toContain('Oaxaca');
  expect(pdf).toContain('Comida');
  expect(pdf).toContain('Pagos confirmados');
  expect(pdf).toContain('Saldo +$1,000.00 MXN');
});

test('el comprobante conserva su plantilla y contenido', async () => {
  const pdf = (await generateCollectionReceiptPdf({ folio: 'F-123', tripLabel: 'Oaxaca', issuedAt: '2026-11-28', creditor: 'Ana', debtor: 'Luis', amount: '$100.00' })).toString('binary');
  expect(pdf).toContain('Comprobante de liquidacion');
  expect(pdf).toContain('F-123');
  expect(pdf).toContain('Ana');
  expect(pdf).toContain('Luis');
});
