import * as BudgetService from '../src/domain/budget/budget.service';
import { supabaseAdmin } from '../src/infrastructure/db/supabase.client';
import { getLocalUserId } from '../src/domain/groups/groups.service';

jest.mock('../src/infrastructure/db/supabase.client', () => ({
  supabaseAdmin: {
    from: jest.fn((table: string) => mockFrom(table)),
  },
}));

jest.mock('../src/domain/groups/groups.service', () => ({
  getLocalUserId: jest.fn(),
}));

type Row = Record<string, any>;
type MockDatabase = Record<string, Row[]>;

const initialDb = (): MockDatabase => ({
  grupos_viaje: [
    { id: '7', presupuesto_total: 10000 },
  ],
  grupo_miembros: [
    { id: '1', grupo_id: '7', usuario_id: '1', rol: 'admin' },
    { id: '2', grupo_id: '7', usuario_id: '2', rol: 'viajero' },
    { id: '3', grupo_id: '7', usuario_id: '3', rol: 'viajero' },
  ],
  usuarios: [
    { id_usuario: '1', nombre: 'Admin', email: 'admin@test.com' },
    { id_usuario: '2', nombre: 'Ana', email: 'ana@test.com' },
    { id_usuario: '3', nombre: 'Beto', email: 'beto@test.com' },
  ],
  expenses: [],
  expense_splits: [],
  settlement_payments: [],
});

let mockDb: MockDatabase = initialDb();

const clone = (row: Row): Row => {
  if (row.usuarios) return { ...row, usuarios: { ...row.usuarios } };
  return { ...row };
};

const hydrateRelations = (tableName: string, row: Row): Row => {
  if (tableName === 'grupo_miembros') {
    return {
      ...row,
      usuarios: mockDb.usuarios.find((user) => String(user.id_usuario) === String(row.usuario_id)) ?? null,
    };
  }

  if (tableName === 'expenses') {
    return {
      ...row,
      expense_splits: mockDb.expense_splits
        .filter((split) => String(split.expense_id) === String(row.id))
        .map(clone),
    };
  }

  return row;
};

const matches = (row: Row, filters: Array<{ column: string; value: any }>) =>
  filters.every((filter) => String(row[filter.column]) === String(filter.value));

const mockCreateQuery = (tableName: string) => {
  const filters: Array<{ column: string; value: any }> = [];
  let mutationRows: Row[] | null = null;
  let deleteRequested = false;

  const table = () => {
    if (!mockDb[tableName]) mockDb[tableName] = [];
    return mockDb[tableName];
  };

  const filtered = () => table().filter((row) => matches(row, filters));
  const resultRows = () => (mutationRows ?? filtered()).map((row) => hydrateRelations(tableName, clone(row)));

  const builder: any = {
    select: jest.fn(() => builder),
    order: jest.fn(() => builder),
    eq: jest.fn((column: string, value: any) => {
      filters.push({ column, value });
      return builder;
    }),
    maybeSingle: jest.fn(async () => ({ data: resultRows()[0] ?? null, error: null })),
    single: jest.fn(async () => ({ data: resultRows()[0] ?? null, error: null })),
    insert: jest.fn((payload: Row | Row[]) => {
      const rows = (Array.isArray(payload) ? payload : [payload]).map((row, index) => ({
        id: row.id ?? String(table().length + index + 1),
        created_at: row.created_at ?? '2026-05-05T00:00:00.000Z',
        ...row,
      }));
      table().push(...rows);
      mutationRows = rows;
      return builder;
    }),
    update: jest.fn((payload: Row) => {
      const rows = filtered();
      for (const row of rows) Object.assign(row, payload);
      mutationRows = rows;
      return builder;
    }),
    delete: jest.fn(() => {
      deleteRequested = true;
      return builder;
    }),
    then: (resolve: (value: { data: Row[] | null; error: null }) => any) => {
      if (deleteRequested) {
        mockDb[tableName] = table().filter((row) => !matches(row, filters));
        return Promise.resolve({ data: null, error: null }).then(resolve);
      }
      return Promise.resolve({ data: resultRows(), error: null }).then(resolve);
    },
  };

  return builder;
};

function mockFrom(table: string) {
  return mockCreateQuery(table);
}

describe('BudgetService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = initialDb();
    (getLocalUserId as jest.Mock).mockResolvedValue('1');
    (supabaseAdmin.from as jest.Mock).mockImplementation((table: string) => mockFrom(table));
  });

  it('createExpense: registra gasto equitativo y recalcula resumen', async () => {
    const dashboard = await BudgetService.createExpense('auth-user', '7', {
      paid_by_user_id: '1',
      amount: 900,
      description: 'Taxi aeropuerto',
      category: 'transporte',
      split_type: 'equitativa',
      member_ids: ['1', '2', '3'],
    });

    expect(dashboard.summary.committed).toBe(900);
    expect(dashboard.summary.categoryTotals.transporte).toBe(900);
    expect(mockDb.expense_splits).toHaveLength(3);
    expect(mockDb.expense_splits[0]).toMatchObject({ user_id: '1', share: 300 });
  });

  it('createExpense: registra gasto personalizado', async () => {
    await BudgetService.createExpense('auth-user', '7', {
      paid_by_user_id: '2',
      amount: 600,
      description: 'Cena',
      category: 'comida',
      split_type: 'personalizada',
      split_amounts: { '1': 100, '2': 200, '3': 300 },
    });

    expect(mockDb.expense_splits.map((split) => split.share)).toEqual([100, 200, 300]);
  });

  it('getBalances y getMinimumSettlements: calculan deuda minima', async () => {
    await BudgetService.createExpense('auth-user', '7', {
      paid_by_user_id: '1',
      amount: 900,
      description: 'Hotel',
      category: 'hospedaje',
      split_type: 'equitativa',
      member_ids: ['1', '2', '3'],
    });

    const balances = await BudgetService.getBalances('7');
    expect(balances).toMatchObject({ '1': 600, '2': -300, '3': -300 });

    const settlements = await BudgetService.getMinimumSettlements('7');
    expect(settlements).toEqual([
      { from: '2', to: '1', amount: 300 },
      { from: '3', to: '1', amount: 300 },
    ]);
  });

  it('ensureGroupMember: bloquea usuario fuera del grupo', async () => {
    (getLocalUserId as jest.Mock).mockResolvedValue('99');

    await expect(BudgetService.getBudgetDashboard('auth-user', '7'))
      .rejects
      .toMatchObject({ statusCode: 403 });
  });

  it('updateBudget: bloquea ajuste si no es admin', async () => {
    (getLocalUserId as jest.Mock).mockResolvedValue('2');

    await expect(BudgetService.updateBudget('auth-user', '7', 15000))
      .rejects
      .toMatchObject({ statusCode: 403 });
  });

  it('markSettlementPaid: deudor puede registrar pago pendiente de validacion', async () => {
    await BudgetService.createExpense('auth-user', '7', {
      paid_by_user_id: '1',
      amount: 900,
      description: 'Hotel',
      category: 'hospedaje',
      split_type: 'equitativa',
      member_ids: ['1', '2', '3'],
    });

    (getLocalUserId as jest.Mock).mockResolvedValue('2');

    const dashboard = await BudgetService.markSettlementPaid('auth-user', '7', {
      from_user_id: '2',
      to_user_id: '1',
      amount: 300,
      payment_method: 'efectivo_presencial',
    });

    expect(dashboard.settlements).toEqual([
      { from: '2', to: '1', amount: 300 },
    ]);
    expect(dashboard.paymentHistory).toHaveLength(1);
    expect(dashboard.paymentHistory[0].status).toBe('pendiente_validacion');
  });

  it('markSettlementPaid: bloquea si no es admin ni deudor', async () => {
    await BudgetService.createExpense('auth-user', '7', {
      paid_by_user_id: '1',
      amount: 900,
      description: 'Hotel',
      category: 'hospedaje',
      split_type: 'equitativa',
      member_ids: ['1', '2', '3'],
    });

    (getLocalUserId as jest.Mock).mockResolvedValue('3');

    await expect(BudgetService.markSettlementPaid('auth-user', '7', {
      from_user_id: '2',
      to_user_id: '1',
      amount: 100,
      payment_method: 'transferencia',
    }))
      .rejects
      .toMatchObject({ statusCode: 403 });
  });

  it('updateExpense y deleteExpense: admin reflejan cambios en resumen', async () => {
    const created = await BudgetService.createExpense('auth-user', '7', {
      paid_by_user_id: '1',
      amount: 500,
      description: 'Traslado',
      category: 'transporte',
      split_type: 'equitativa',
      member_ids: ['1', '2'],
    });

    const expenseId = created.expenses[0].id;

    await BudgetService.updateExpense('auth-user', '7', expenseId, {
      paid_by_user_id: '1',
      amount: 700,
      description: 'Traslado actualizado',
      category: 'transporte',
      split_type: 'equitativa',
      member_ids: ['1', '2'],
    });

    let dashboard = await BudgetService.getBudgetDashboard('auth-user', '7');
    expect(dashboard.summary.committed).toBe(700);
    expect(dashboard.expenses[0].description).toBe('Traslado actualizado');

    dashboard = await BudgetService.deleteExpense('auth-user', '7', expenseId);
    expect(dashboard.summary.committed).toBe(0);
    expect(dashboard.expenses).toHaveLength(0);
  });

  it('updateExpense: permite al creador del gasto editar aunque no sea pagador', async () => {
    const created = await BudgetService.createExpense('auth-user', '7', {
      paid_by_user_id: '1',
      amount: 400,
      description: 'Taxi',
      category: 'transporte',
      split_type: 'equitativa',
      member_ids: ['1', '2'],
    });

    const expenseId = created.expenses[0].id;
    (getLocalUserId as jest.Mock).mockResolvedValue('1');

    const dashboard = await BudgetService.updateExpense('auth-user', '7', expenseId, {
      paid_by_user_id: '2',
      amount: 450,
      description: 'Taxi edit',
      category: 'transporte',
      split_type: 'equitativa',
      member_ids: ['1', '2'],
    });
    expect(dashboard.expenses[0].description).toBe('Taxi edit');
  });

  it('updateExpense: bloquea a miembro que no es admin ni creador', async () => {
    const created = await BudgetService.createExpense('auth-user', '7', {
      paid_by_user_id: '1',
      amount: 400,
      description: 'Taxi',
      category: 'transporte',
      split_type: 'equitativa',
      member_ids: ['1', '2'],
    });
    const expenseId = created.expenses[0].id;
    (getLocalUserId as jest.Mock).mockResolvedValue('2');
    await expect(BudgetService.updateExpense('auth-user', '7', expenseId, {
      paid_by_user_id: '1',
      amount: 450,
      description: 'Taxi edit',
      category: 'transporte',
      split_type: 'equitativa',
      member_ids: ['1', '2'],
    })).rejects.toMatchObject({ statusCode: 403 });
  });

  it('markSettlementPaid: bloquea sobrepago de liquidacion', async () => {
    await BudgetService.createExpense('auth-user', '7', {
      paid_by_user_id: '1',
      amount: 900,
      description: 'Hotel',
      category: 'hospedaje',
      split_type: 'equitativa',
      member_ids: ['1', '2', '3'],
    });

    (getLocalUserId as jest.Mock).mockResolvedValue('2');

    await expect(BudgetService.markSettlementPaid('auth-user', '7', {
      from_user_id: '2',
      to_user_id: '1',
      amount: 500,
      payment_method: 'efectivo_presencial',
    }))
      .rejects
      .toMatchObject({ statusCode: 400 });
  });

  it('markSettlementPaid: transferencia requiere comprobante', async () => {
    await BudgetService.createExpense('auth-user', '7', {
      paid_by_user_id: '1',
      amount: 900,
      description: 'Hotel',
      category: 'hospedaje',
      split_type: 'equitativa',
      member_ids: ['1', '2', '3'],
    });

    (getLocalUserId as jest.Mock).mockResolvedValue('2');

    await expect(BudgetService.markSettlementPaid('auth-user', '7', {
      from_user_id: '2',
      to_user_id: '1',
      amount: 100,
      payment_method: 'transferencia',
    }))
      .rejects
      .toMatchObject({ statusCode: 400 });
  });

  it('markSettlementPaid: bloquea duplicado pendiente por mismo par', async () => {
    await BudgetService.createExpense('auth-user', '7', {
      paid_by_user_id: '1',
      amount: 900,
      description: 'Hotel',
      category: 'hospedaje',
      split_type: 'equitativa',
      member_ids: ['1', '2', '3'],
    });
    (getLocalUserId as jest.Mock).mockResolvedValue('2');
    await BudgetService.markSettlementPaid('auth-user', '7', {
      from_user_id: '2',
      to_user_id: '1',
      amount: 100,
      payment_method: 'efectivo_presencial',
    });
    await expect(BudgetService.markSettlementPaid('auth-user', '7', {
      from_user_id: '2',
      to_user_id: '1',
      amount: 100,
      payment_method: 'efectivo_presencial',
    })).rejects.toMatchObject({ statusCode: 409 });
  });

  it('updatePendingSettlementPayment: bloquea si no es autor del pago', async () => {
    await BudgetService.createExpense('auth-user', '7', {
      paid_by_user_id: '1',
      amount: 900,
      description: 'Hotel',
      category: 'hospedaje',
      split_type: 'equitativa',
      member_ids: ['1', '2', '3'],
    });
    (getLocalUserId as jest.Mock).mockResolvedValue('2');
    await BudgetService.markSettlementPaid('auth-user', '7', {
      from_user_id: '2',
      to_user_id: '1',
      amount: 100,
      payment_method: 'efectivo_presencial',
    });
    const paymentId = String(mockDb.settlement_payments[0].id);
    (getLocalUserId as jest.Mock).mockResolvedValue('3');
    await expect(BudgetService.updatePendingSettlementPayment('auth-user', '7', paymentId, {
      amount: 80,
      payment_method: 'efectivo_presencial',
      note: 'x',
    })).rejects.toMatchObject({ statusCode: 403 });
  });

  it('deletePendingSettlementPayment: bloquea si no es autor del pago', async () => {
    await BudgetService.createExpense('auth-user', '7', {
      paid_by_user_id: '1',
      amount: 900,
      description: 'Hotel',
      category: 'hospedaje',
      split_type: 'equitativa',
      member_ids: ['1', '2', '3'],
    });
    (getLocalUserId as jest.Mock).mockResolvedValue('2');
    await BudgetService.markSettlementPaid('auth-user', '7', {
      from_user_id: '2',
      to_user_id: '1',
      amount: 100,
      payment_method: 'efectivo_presencial',
    });
    const paymentId = String(mockDb.settlement_payments[0].id);
    (getLocalUserId as jest.Mock).mockResolvedValue('3');
    await expect(BudgetService.deletePendingSettlementPayment('auth-user', '7', paymentId))
      .rejects.toMatchObject({ statusCode: 403 });
  });

  it('deleteExpense: permite al creador aunque no sea pagador', async () => {
    const created = await BudgetService.createExpense('auth-user', '7', {
      paid_by_user_id: '2',
      amount: 500,
      description: 'Ticket',
      category: 'transporte',
      split_type: 'equitativa',
      member_ids: ['1', '2'],
    });
    const expenseId = created.expenses[0].id;
    (getLocalUserId as jest.Mock).mockResolvedValue('1');
    const dashboard = await BudgetService.deleteExpense('auth-user', '7', expenseId);
    expect(dashboard.expenses).toHaveLength(0);
  });

  it('reviewSettlementPayment: bloquea si no es acreedor', async () => {
    await BudgetService.createExpense('auth-user', '7', {
      paid_by_user_id: '1',
      amount: 900,
      description: 'Hotel',
      category: 'hospedaje',
      split_type: 'equitativa',
      member_ids: ['1', '2', '3'],
    });
    (getLocalUserId as jest.Mock).mockResolvedValue('2');
    await BudgetService.markSettlementPaid('auth-user', '7', {
      from_user_id: '2',
      to_user_id: '1',
      amount: 100,
      payment_method: 'efectivo_presencial',
    });
    const paymentId = String(mockDb.settlement_payments[0].id);
    (getLocalUserId as jest.Mock).mockResolvedValue('3');
    await expect(BudgetService.reviewSettlementPayment('auth-user', '7', paymentId, { status: 'confirmado' }))
      .rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('BudgetService · fase 5 (Traveling)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = initialDb();
    (getLocalUserId as jest.Mock).mockResolvedValue('1');
    (supabaseAdmin.from as jest.Mock).mockImplementation((table: string) => mockFrom(table));
  });

  const hotel = {
    paid_by_user_id: '1',
    amount: 900,
    description: 'Hotel',
    category: 'hospedaje' as const,
    split_type: 'equitativa' as const,
    member_ids: ['1', '2', '3'],
  };

  it('createExpense: un viaje cerrado no acepta gastos (409)', async () => {
    mockDb.grupos_viaje[0].estado = 'cerrado';
    await expect(BudgetService.createExpense('auth-user', '7', hotel)).rejects.toMatchObject({ statusCode: 409 });
  });

  it('createExpense: con finanzas bloqueadas por el organizador responde 423', async () => {
    mockDb.grupos_viaje[0].modulo_presupuesto_bloqueado = true;
    await expect(BudgetService.createExpense('auth-user', '7', hotel)).rejects.toMatchObject({ statusCode: 423 });
  });

  it('markSettlementPaid: con el viaje cerrado todavía se puede liquidar', async () => {
    await BudgetService.createExpense('auth-user', '7', hotel);
    mockDb.grupos_viaje[0].estado = 'cerrado';
    (getLocalUserId as jest.Mock).mockResolvedValue('2');

    const dashboard = await BudgetService.markSettlementPaid('auth-user', '7', {
      from_user_id: '2',
      to_user_id: '1',
      amount: 300,
      payment_method: 'efectivo_presencial',
    });
    expect(dashboard.paymentHistory[0].status).toBe('pendiente_validacion');
  });

  it('updateBudget: vacío quita el presupuesto y los gastos siguen permitidos', async () => {
    const dashboard = await BudgetService.updateBudget('auth-user', '7', null);
    expect(dashboard.summary.totalBudget).toBeNull();
    expect(dashboard.summary.available).toBeNull();

    const withExpense = await BudgetService.createExpense('auth-user', '7', hotel);
    expect(withExpense.summary.committed).toBe(900);
  });

  it('getBudgetSummary: saldos por integrante suman cero', async () => {
    await BudgetService.createExpense('auth-user', '7', hotel);
    await BudgetService.createExpense('auth-user', '7', {
      ...hotel,
      paid_by_user_id: '2',
      amount: 100,
      description: 'Taxi',
      category: 'transporte',
      split_type: 'personalizada',
      member_ids: undefined,
      split_amounts: { '1': 20, '2': 30, '3': 50 },
    });

    const summary = await BudgetService.getBudgetSummary('auth-user', '7');
    expect(summary.totals.committed).toBe(1000);
    const total = summary.byMember.reduce((sum, member) => sum + member.balance, 0);
    expect(Math.abs(total)).toBeLessThan(0.01);
    const admin = summary.byMember.find((member) => member.usuarioId === '1');
    expect(admin).toMatchObject({ paid: 900, share: 320, balance: 580 });
  });

  it('buildExpensesCsv: BOM, comillas escapadas y sin fórmulas', () => {
    const csv = BudgetService.buildExpensesCsv({
      expenses: [
        {
          id: '1',
          date: '2026-12-01',
          description: '=HYPERLINK("http://x")',
          category: 'comida',
          amount: 120.5,
          paidBy: 'Ana "La Jefa"',
          createdBy: null,
          splitType: 'equitativa',
          participants: [{ nombre: 'Ana', share: 60.25 }, { nombre: 'Beto', share: 60.25 }],
        },
      ],
    } as unknown as BudgetService.BudgetSummary);

    expect(csv.startsWith('﻿')).toBe(true);
    const [, row] = csv.slice(1).trim().split('\r\n');
    expect(row).toContain(`"'=HYPERLINK(""http://x"")"`);
    expect(row).toContain('"Ana ""La Jefa"""');
    expect(row).toContain('"120.50"');
    expect(row).toContain('"Ana: 60.25; Beto: 60.25"');
  });
});

describe('BudgetService · reparto porcentual y filtros (COCOMO)', () => {
  beforeEach(() => {
    mockDb = initialDb();
    (getLocalUserId as jest.Mock).mockResolvedValue('1');
    (supabaseAdmin.from as jest.Mock).mockImplementation((table: string) => mockFrom(table));
  });

  it('createExpense: reparto porcentual guarda monto y porcentaje por integrante', async () => {
    const dashboard = await BudgetService.createExpense('auth-user', '7', {
      paid_by_user_id: '1',
      amount: 1000,
      description: 'Hotel',
      category: 'hospedaje',
      split_type: 'porcentual',
      split_percentages: { '1': 50, '2': 30, '3': 20 },
    });

    expect(mockDb.expense_splits.map((split) => [split.share, split.percentage])).toEqual([
      [500, 50],
      [300, 30],
      [200, 20],
    ]);
    const expense = dashboard.expenses[0];
    expect(expense.splitType).toBe('porcentual');
    expect(expense.splitPercentages).toEqual({ '1': 50, '2': 30, '3': 20 });
  });

  it('allocateByPercent: los centavos sobrantes van a las fracciones mayores y la suma es exacta', () => {
    expect(BudgetService.allocateByPercent(10, [3333, 3333, 3334])).toEqual([3.33, 3.33, 3.34]);
    expect(BudgetService.allocateByPercent(100, [3333, 3333, 3334])).toEqual([33.33, 33.33, 33.34]);
    const shares = BudgetService.allocateByPercent(99.99, [2500, 2500, 5000]);
    expect(Math.round(shares.reduce((sum, share) => sum + share, 0) * 100)).toBe(9999);
  });

  it('createExpense: rechaza porcentajes que no suman 100 o con más de dos decimales', async () => {
    const base = {
      paid_by_user_id: '1',
      amount: 300,
      description: 'Cena',
      category: 'comida' as const,
      split_type: 'porcentual' as const,
    };
    await expect(BudgetService.createExpense('auth-user', '7', { ...base, split_percentages: { '1': 50, '2': 40 } }))
      .rejects.toMatchObject({ statusCode: 400, message: 'Los porcentajes deben sumar 100%' });
    await expect(BudgetService.createExpense('auth-user', '7', { ...base, split_percentages: { '1': 33.333, '2': 66.667 } }))
      .rejects.toMatchObject({ statusCode: 400 });
    await expect(BudgetService.createExpense('auth-user', '7', { ...base, split_percentages: { '1': 120, '2': -20 } }))
      .rejects.toMatchObject({ statusCode: 400 });
    await expect(BudgetService.createExpense('auth-user', '7', { ...base, split_percentages: { '1': 50, '99': 50 } }))
      .rejects.toMatchObject({ statusCode: 400 });
    expect(mockDb.expenses).toHaveLength(0);
  });

  it('updateExpense: un reparto inválido no modifica el gasto ni sus partes', async () => {
    const dashboard = await BudgetService.createExpense('auth-user', '7', {
      paid_by_user_id: '1',
      amount: 900,
      description: 'Tour',
      category: 'actividad',
      split_type: 'equitativa',
      member_ids: ['1', '2', '3'],
    });
    const expenseId = dashboard.expenses[0].id;

    await expect(BudgetService.updateExpense('auth-user', '7', expenseId, {
      paid_by_user_id: '1',
      amount: 1200,
      description: 'Tour editado',
      category: 'actividad',
      split_type: 'porcentual',
      split_percentages: { '1': 60, '2': 30 },
    })).rejects.toMatchObject({ statusCode: 400 });

    expect(mockDb.expenses[0]).toMatchObject({ amount: 900, description: 'Tour', split_type: 'equitativa' });
    expect(mockDb.expense_splits).toHaveLength(3);
  });

  it('buildExpensesCsv: etiqueta el reparto y muestra el porcentaje de cada integrante', () => {
    const csv = BudgetService.buildExpensesCsv({
      expenses: [
        {
          id: '1',
          date: '2026-12-01',
          description: 'Hotel',
          category: 'hospedaje',
          amount: 1000,
          paidBy: 'Ana',
          createdBy: 'Ana',
          splitType: 'porcentual',
          participants: [
            { nombre: 'Ana', share: 600, percentage: 60 },
            { nombre: 'Beto', share: 400, percentage: 40 },
          ],
        },
      ],
    } as unknown as BudgetService.BudgetSummary);

    expect(csv).toContain('"Porcentual"');
    expect(csv).toContain('"Ana: 600.00 (60%); Beto: 400.00 (40%)"');
  });
});
