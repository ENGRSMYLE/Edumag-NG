import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { financeApi } from '@/lib/api';
import type { PaymentListParams, DebtorListParams } from '@/types/dashboard';

export function useFinancialSummary(params?: { academic_session?: string; term?: string }) {
  return useQuery({
    queryKey: ['finance-summary', params],
    queryFn: () => financeApi.getSummary(params).then((r) => r.data),
  });
}

export function usePayments(params?: PaymentListParams) {
  return useQuery({
    queryKey: ['payments', params],
    queryFn: () => financeApi.payments(params).then((r) => r.data),
  });
}

export function useDebtors(params?: DebtorListParams) {
  return useQuery({
    queryKey: ['debtors', params],
    queryFn: () => financeApi.debtors(params).then((r) => r.data),
  });
}

export function useRecordPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      student_id: string;
      amount_kobo: number;
      payment_type: string;
      payment_method: string;
      session?: string;
      term?: string;
      notes?: string;
    }) => financeApi.recordPayment(data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments'] });
      qc.invalidateQueries({ queryKey: ['finance-summary'] });
      qc.invalidateQueries({ queryKey: ['debtors'] });
    },
  });
}

export function useConfirmPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      financeApi.confirmPayment(id, { note }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments'] });
      qc.invalidateQueries({ queryKey: ['finance-summary'] });
      qc.invalidateQueries({ queryKey: ['debtors'] });
    },
  });
}
