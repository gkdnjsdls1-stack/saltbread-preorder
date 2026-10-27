import { db } from '@/lib/supabase';
import type {
  CancelRequest,
  Payment,
  Product,
  ProductWithRemaining,
  Reservation,
  ReservationItem,
} from '@/lib/types';

export type ItemWithName = ReservationItem & { product_name: string };

export type ReservationDetail = {
  reservation: Reservation;
  items: ItemWithName[];
  payment: Payment | null;
  cancelRequest: CancelRequest | null;
};

/** 손님 화면용 상품 목록. 남은 수량까지 DB 에서 계산해 온다. */
export async function getProductsWithRemaining(date: string): Promise<ProductWithRemaining[]> {
  const { data, error } = await db().rpc('products_with_remaining', { p_date: date });
  if (error) throw new Error(error.message);
  return (data ?? []) as ProductWithRemaining[];
}

export async function getAllProducts(): Promise<Product[]> {
  const { data, error } = await db()
    .from('products')
    .select('*')
    .order('sort_order')
    .order('name');
  if (error) throw new Error(error.message);
  return (data ?? []) as Product[];
}

/** 그 날짜에만 따로 정해둔 한도. 없는 상품은 기본 한도를 쓴다. */
export async function getDailyLimits(date: string): Promise<Map<string, number>> {
  const { data, error } = await db()
    .from('daily_limits')
    .select('product_id, limit_qty')
    .eq('pickup_date', date);
  if (error) throw new Error(error.message);

  return new Map((data ?? []).map((row) => [row.product_id as string, row.limit_qty as number]));
}

export async function getReservationByCode(code: string): Promise<Reservation | null> {
  const { data, error } = await db().from('reservations').select('*').eq('code', code).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Reservation | null) ?? null;
}

async function namesByProductId(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();

  const { data, error } = await db().from('products').select('id, name').in('id', ids);
  if (error) throw new Error(error.message);

  return new Map((data ?? []).map((p) => [p.id as string, p.name as string]));
}

export async function getReservationDetail(code: string): Promise<ReservationDetail | null> {
  const reservation = await getReservationByCode(code);
  if (!reservation) return null;

  const [itemsRes, paymentRes, cancelRes] = await Promise.all([
    db().from('reservation_items').select('*').eq('reservation_id', reservation.id).order('id'),
    db().from('payments').select('*').eq('reservation_id', reservation.id).maybeSingle(),
    db()
      .from('cancel_requests')
      .select('*')
      .eq('reservation_id', reservation.id)
      .order('requested_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (itemsRes.error) throw new Error(itemsRes.error.message);
  if (paymentRes.error) throw new Error(paymentRes.error.message);
  if (cancelRes.error) throw new Error(cancelRes.error.message);

  const rawItems = (itemsRes.data ?? []) as ReservationItem[];
  const names = await namesByProductId(rawItems.map((i) => i.product_id));

  return {
    reservation,
    items: rawItems.map((i) => ({ ...i, product_name: names.get(i.product_id) ?? '(삭제된 상품)' })),
    payment: (paymentRes.data as Payment | null) ?? null,
    cancelRequest: (cancelRes.data as CancelRequest | null) ?? null,
  };
}

export type AdminRow = {
  reservation: Reservation;
  items: ItemWithName[];
  payment: Payment | null;
  openCancelRequest: CancelRequest | null;
};

/** 사장님 화면: 한 날짜의 예약 전부를 항목·입금·취소요청까지 붙여서 */
export async function getReservationsForDate(date: string): Promise<AdminRow[]> {
  const { data: reservationRows, error } = await db()
    .from('reservations')
    .select('*')
    .eq('pickup_date', date)
    .order('created_at');
  if (error) throw new Error(error.message);

  const reservations = (reservationRows ?? []) as Reservation[];
  if (reservations.length === 0) return [];

  const ids = reservations.map((r) => r.id);

  const [itemsRes, paymentsRes, cancelsRes] = await Promise.all([
    db().from('reservation_items').select('*').in('reservation_id', ids).order('id'),
    db().from('payments').select('*').in('reservation_id', ids),
    db().from('cancel_requests').select('*').in('reservation_id', ids).eq('status', 'requested'),
  ]);

  if (itemsRes.error) throw new Error(itemsRes.error.message);
  if (paymentsRes.error) throw new Error(paymentsRes.error.message);
  if (cancelsRes.error) throw new Error(cancelsRes.error.message);

  const rawItems = (itemsRes.data ?? []) as ReservationItem[];
  const names = await namesByProductId(rawItems.map((i) => i.product_id));

  const itemsByReservation = new Map<string, ItemWithName[]>();
  for (const item of rawItems) {
    const list = itemsByReservation.get(item.reservation_id) ?? [];
    list.push({ ...item, product_name: names.get(item.product_id) ?? '(삭제된 상품)' });
    itemsByReservation.set(item.reservation_id, list);
  }

  const paymentByReservation = new Map(
    ((paymentsRes.data ?? []) as Payment[]).map((p) => [p.reservation_id, p]),
  );
  const cancelByReservation = new Map(
    ((cancelsRes.data ?? []) as CancelRequest[]).map((c) => [c.reservation_id, c]),
  );

  return reservations.map((reservation) => ({
    reservation,
    items: itemsByReservation.get(reservation.id) ?? [],
    payment: paymentByReservation.get(reservation.id) ?? null,
    openCancelRequest: cancelByReservation.get(reservation.id) ?? null,
  }));
}

export type DayTotal = { name: string; qty: number; paidQty: number };

/** 내일 몇 개 구울지. 취소된 예약은 빼고 센다. */
export function summarize(rows: AdminRow[]): DayTotal[] {
  const totals = new Map<string, DayTotal>();

  for (const row of rows) {
    if (row.reservation.status === 'cancelled') continue;
    const isPaid = row.reservation.status !== 'pending_payment';

    for (const item of row.items) {
      const entry = totals.get(item.product_name) ?? { name: item.product_name, qty: 0, paidQty: 0 };
      entry.qty += item.qty;
      if (isPaid) entry.paidQty += item.qty;
      totals.set(item.product_name, entry);
    }
  }

  return [...totals.values()].sort((a, b) => b.qty - a.qty);
}
