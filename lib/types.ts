export type ReservationStatus = 'pending_payment' | 'paid' | 'picked_up' | 'cancelled';
export type ReceiptKind = 'deduction' | 'expense';
export type CancelStatus = 'requested' | 'done' | 'rejected';

export type Product = {
  id: string;
  name: string;
  price: number;
  default_daily_limit: number;
  is_active: boolean;
  sort_order: number;
};

/** products_with_remaining() 의 반환 행 */
export type ProductWithRemaining = {
  id: string;
  name: string;
  price: number;
  sort_order: number;
  remaining: number;
};

export type Reservation = {
  id: string;
  code: string;
  customer_name: string;
  phone: string;
  pickup_date: string;
  pickup_time: string;
  total: number;
  status: ReservationStatus;
  created_at: string;
};

export type ReservationItem = {
  id: number;
  reservation_id: string;
  product_id: string;
  qty: number;
  unit_price: number;
};

export type Payment = {
  reservation_id: string;
  depositor_name: string;
  amount: number | null;
  deposited_at: string | null;
  cash_receipt_requested: boolean;
  cash_receipt_number: string | null;
  receipt_kind: ReceiptKind | null;
  submitted_at: string;
  confirmed_at: string | null;
};

export type CancelRequest = {
  id: number;
  reservation_id: string;
  reason: string | null;
  status: CancelStatus;
  requested_at: string;
  handled_at: string | null;
};

export const STATUS_LABEL: Record<ReservationStatus, string> = {
  pending_payment: '입금 전',
  paid: '입금 확인',
  picked_up: '픽업 완료',
  cancelled: '취소',
};

export const RECEIPT_KIND_LABEL: Record<ReceiptKind, string> = {
  deduction: '소득공제',
  expense: '지출증빙',
};
