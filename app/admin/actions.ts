'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { checkAdminPassword, endAdminSession, isAdmin, startAdminSession } from '@/lib/admin-auth';
import { db } from '@/lib/supabase';

async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect('/admin/login');
}

function str(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function int(formData: FormData, key: string, fallback = 0): number {
  const value = Number(str(formData, key));
  return Number.isFinite(value) ? Math.trunc(value) : fallback;
}

export async function loginAction(formData: FormData): Promise<void> {
  if (!checkAdminPassword(str(formData, 'password'))) {
    redirect('/admin/login?e=1');
  }
  await startAdminSession();
  redirect('/admin');
}

export async function logoutAction(): Promise<void> {
  await endAdminSession();
  redirect('/admin/login');
}

/** 입금 확인. 손님이 입금 정보를 안 남겼어도 사장님이 확인하면 확정으로 넘긴다. */
export async function confirmPaymentAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = str(formData, 'reservation_id');

  await db()
    .from('payments')
    .update({ confirmed_at: new Date().toISOString() })
    .eq('reservation_id', id);

  const { error } = await db().from('reservations').update({ status: 'paid' }).eq('id', id);
  if (error) console.error('[admin confirm]', error.message);

  revalidatePath('/admin');
}

export async function markPickedUpAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const { error } = await db()
    .from('reservations')
    .update({ status: 'picked_up' })
    .eq('id', str(formData, 'reservation_id'));
  if (error) console.error('[admin pickup]', error.message);

  revalidatePath('/admin');
}

export async function cancelByAdminAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const { error } = await db()
    .from('reservations')
    .update({ status: 'cancelled' })
    .eq('id', str(formData, 'reservation_id'));
  if (error) console.error('[admin cancel]', error.message);

  revalidatePath('/admin');
}

/** 취소 요청 처리. 승인하면 예약까지 취소한다. 환불 자체는 사장님이 따로 한다. */
export async function handleCancelRequestAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const requestId = int(formData, 'request_id');
  const reservationId = str(formData, 'reservation_id');
  const approve = str(formData, 'decision') === 'approve';

  const { error } = await db()
    .from('cancel_requests')
    .update({ status: approve ? 'done' : 'rejected', handled_at: new Date().toISOString() })
    .eq('id', requestId);
  if (error) console.error('[admin cancel_request]', error.message);

  if (approve) {
    const res = await db().from('reservations').update({ status: 'cancelled' }).eq('id', reservationId);
    if (res.error) console.error('[admin cancel_request cancel]', res.error.message);
  }

  revalidatePath('/admin');
}

export async function updateProductAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = str(formData, 'product_id');
  const price = int(formData, 'price');
  const limit = int(formData, 'default_daily_limit');

  if (price < 0 || limit < 0) return;

  const { error } = await db()
    .from('products')
    .update({
      price,
      default_daily_limit: limit,
      is_active: formData.get('is_active') === 'on',
      sort_order: int(formData, 'sort_order'),
    })
    .eq('id', id);
  if (error) console.error('[admin product]', error.message);

  revalidatePath('/admin/products');
  revalidatePath('/');
}

export async function addProductAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const name = str(formData, 'name');
  if (name.length === 0) return;

  const { error } = await db().from('products').insert({
    name,
    price: Math.max(0, int(formData, 'price')),
    default_daily_limit: Math.max(0, int(formData, 'default_daily_limit')),
    sort_order: int(formData, 'sort_order', 99),
  });
  if (error) console.error('[admin add product]', error.message);

  revalidatePath('/admin/products');
  revalidatePath('/');
}

/** 특정 날짜만 한도를 달리 둘 때. 비워서 보내면 그 날짜 설정을 지운다. */
export async function setDailyLimitAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const date = str(formData, 'pickup_date');
  const productId = str(formData, 'product_id');
  const raw = str(formData, 'limit_qty');

  if (date.length === 0 || productId.length === 0) return;

  if (raw === '') {
    const { error } = await db()
      .from('daily_limits')
      .delete()
      .eq('pickup_date', date)
      .eq('product_id', productId);
    if (error) console.error('[admin daily_limit delete]', error.message);
  } else {
    const limitQty = Math.max(0, Number(raw));
    const { error } = await db()
      .from('daily_limits')
      .upsert(
        { pickup_date: date, product_id: productId, limit_qty: limitQty },
        { onConflict: 'pickup_date,product_id' },
      );
    if (error) console.error('[admin daily_limit upsert]', error.message);
  }

  revalidatePath('/admin/products');
  revalidatePath('/');
}
