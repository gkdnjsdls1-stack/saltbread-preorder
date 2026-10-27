'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { grantReservationAccess, hasReservationAccess } from '@/lib/access';
import { newReservationCode, normalizeCode } from '@/lib/code';
import { isValidPhone, normalizePhone } from '@/lib/format';
import {
  notifyCancelRequested,
  notifyCustomerCancelled,
  notifyNewReservation,
  notifyPaymentSubmitted,
} from '@/lib/notify';
import { getProductsWithRemaining, getReservationByCode, getReservationDetail } from '@/lib/queries';
import { db } from '@/lib/supabase';
import { isOrderWindowOpen, tomorrowSeoul } from '@/lib/time';
import type { ReceiptKind } from '@/lib/types';

export type FormState = { error?: string; done?: boolean };

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

/** DB 함수가 raise 한 메시지를 손님이 읽을 문장으로 바꾼다. */
function translateDbError(message: string): string {
  if (message.includes('CLOSED')) {
    return '내일 픽업 예약이 마감되었습니다. 예약은 전날 밤 9시까지만 받습니다.';
  }
  if (message.includes('EMPTY')) return '예약할 빵을 한 개 이상 골라 주세요.';
  if (message.includes('BAD_QTY')) return '수량이 올바르지 않습니다.';

  const soldOut = message.match(/SOLD_OUT:(.*?):(\d+)/);
  if (soldOut) {
    const name = soldOut[1];
    const left = Number(soldOut[2]);
    return left === 0
      ? `${name}은(는) 내일 분이 다 찼습니다. 수량을 지워 주세요.`
      : `${name}은(는) ${left}개만 남았습니다. 수량을 줄여 주세요.`;
  }

  const inactive = message.match(/INACTIVE:(.*)/);
  if (inactive) return `${inactive[1]}은(는) 지금 예약을 받지 않습니다.`;

  console.error('[db]', message);
  return '예약에 실패했습니다. 잠시 후 다시 시도해 주세요.';
}

export async function createReservationAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const name = text(formData, 'customer_name');
  const phone = normalizePhone(text(formData, 'phone'));
  const pickupTime = text(formData, 'pickup_time');
  const pickupDate = tomorrowSeoul();

  if (name.length === 0 || name.length > 40) return { error: '이름을 입력해 주세요.' };
  if (!isValidPhone(phone)) return { error: '전화번호를 다시 확인해 주세요.' };
  if (pickupTime.length === 0 || pickupTime.length > 40) {
    return { error: '내일 몇 시에 받아가실지 적어 주세요.' };
  }

  const products = await getProductsWithRemaining(pickupDate);
  const items: { product_id: string; qty: number }[] = [];

  for (const product of products) {
    const raw = formData.get(`qty_${product.id}`);
    const qty = raw === null || raw === '' ? 0 : Number(raw);
    if (!Number.isInteger(qty) || qty < 0) return { error: '수량이 올바르지 않습니다.' };
    if (qty > 0) items.push({ product_id: product.id, qty });
  }

  if (items.length === 0) return { error: '예약할 빵을 한 개 이상 골라 주세요.' };

  const code = newReservationCode();
  const { error } = await db().rpc('create_reservation', {
    p_code: code,
    p_customer_name: name,
    p_phone: phone,
    p_pickup_date: pickupDate,
    p_pickup_time: pickupTime,
    p_items: items,
  });

  if (error) return { error: translateDbError(error.message) };

  const detail = await getReservationDetail(code);
  if (detail) {
    await notifyNewReservation({
      code,
      customerName: detail.reservation.customer_name,
      pickupDate: detail.reservation.pickup_date,
      pickupTime: detail.reservation.pickup_time,
      total: detail.reservation.total,
      items: detail.items.map((i) => ({ name: i.product_name, qty: i.qty })),
    });
  }

  await grantReservationAccess(code);
  redirect(`/r/${code}`);
}

/** 예약 코드 + 전화번호가 맞으면 그 예약을 볼 권한을 쿠키에 담아준다. */
export async function verifyReservationAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const code = normalizeCode(text(formData, 'code'));
  const phone = normalizePhone(text(formData, 'phone'));

  if (code.length === 0 || phone.length === 0) {
    return { error: '예약 코드와 전화번호를 입력해 주세요.' };
  }

  const reservation = await getReservationByCode(code);

  // 어느 쪽이 틀렸는지 알려주지 않는다. 코드만 바꿔가며 찔러보는 것을 막는다.
  if (!reservation || reservation.phone !== phone) {
    return { error: '예약 코드나 전화번호가 맞지 않습니다.' };
  }

  await grantReservationAccess(code);
  redirect(`/r/${code}`);
}

export async function submitPaymentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const code = normalizeCode(text(formData, 'code'));
  if (!(await hasReservationAccess(code))) return { error: '예약을 다시 조회해 주세요.' };

  const reservation = await getReservationByCode(code);
  if (!reservation) return { error: '예약을 찾을 수 없습니다.' };
  if (reservation.status === 'cancelled') return { error: '취소된 예약입니다.' };

  const depositorName = text(formData, 'depositor_name');
  if (depositorName.length === 0 || depositorName.length > 40) {
    return { error: '입금자명을 입력해 주세요.' };
  }

  const amountRaw = text(formData, 'amount');
  const amount = amountRaw === '' ? null : Number(amountRaw);
  if (amount !== null && (!Number.isInteger(amount) || amount < 0)) {
    return { error: '입금액이 올바르지 않습니다.' };
  }

  const wantsReceipt = formData.get('cash_receipt_requested') === 'on';
  const receiptNumber = normalizePhone(text(formData, 'cash_receipt_number'));
  const receiptKindRaw = text(formData, 'receipt_kind');
  const receiptKind: ReceiptKind | null =
    receiptKindRaw === 'deduction' || receiptKindRaw === 'expense' ? receiptKindRaw : null;

  if (wantsReceipt) {
    if (receiptNumber.length < 9) {
      return { error: '현금영수증 번호(휴대폰 또는 사업자번호)를 확인해 주세요.' };
    }
    if (receiptKind === null) return { error: '소득공제인지 지출증빙인지 골라 주세요.' };
  }

  const { error } = await db()
    .from('payments')
    .upsert(
      {
        reservation_id: reservation.id,
        depositor_name: depositorName,
        amount,
        deposited_at: text(formData, 'deposited_at') || null,
        cash_receipt_requested: wantsReceipt,
        cash_receipt_number: wantsReceipt ? receiptNumber : null,
        receipt_kind: wantsReceipt ? receiptKind : null,
        submitted_at: new Date().toISOString(),
      },
      { onConflict: 'reservation_id' },
    );

  if (error) {
    console.error('[payments]', error.message);
    return { error: '저장에 실패했습니다. 잠시 후 다시 시도해 주세요.' };
  }

  await notifyPaymentSubmitted(code, depositorName);
  revalidatePath(`/r/${code}`);
  return { done: true };
}

/** 입금 전 예약은 손님이 직접 취소한다. */
export async function cancelReservationAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const code = normalizeCode(text(formData, 'code'));
  if (!(await hasReservationAccess(code))) return { error: '예약을 다시 조회해 주세요.' };

  const reservation = await getReservationByCode(code);
  if (!reservation) return { error: '예약을 찾을 수 없습니다.' };
  if (reservation.status === 'cancelled') return { done: true };

  if (reservation.status !== 'pending_payment') {
    return { error: '입금이 확인된 예약은 사장님께 취소 요청을 보내주세요.' };
  }
  if (!(reservation.pickup_date === tomorrowSeoul() && isOrderWindowOpen())) {
    return { error: '마감 이후에는 취소할 수 없습니다. 가게로 연락해 주세요.' };
  }

  const { error } = await db()
    .from('reservations')
    .update({ status: 'cancelled' })
    .eq('id', reservation.id)
    .eq('status', 'pending_payment'); // 그 사이 입금 확인이 됐다면 건드리지 않는다

  if (error) {
    console.error('[cancel]', error.message);
    return { error: '취소에 실패했습니다. 잠시 후 다시 시도해 주세요.' };
  }

  await notifyCustomerCancelled(code);
  revalidatePath(`/r/${code}`);
  return { done: true };
}

/** 입금 후에는 요청만 남기고, 처리는 사장님이 한다. */
export async function requestCancelAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const code = normalizeCode(text(formData, 'code'));
  if (!(await hasReservationAccess(code))) return { error: '예약을 다시 조회해 주세요.' };

  const reservation = await getReservationByCode(code);
  if (!reservation) return { error: '예약을 찾을 수 없습니다.' };
  if (reservation.status === 'cancelled') return { error: '이미 취소된 예약입니다.' };

  const reason = text(formData, 'reason').slice(0, 200);

  const { error } = await db()
    .from('cancel_requests')
    .insert({ reservation_id: reservation.id, reason: reason || null });

  if (error) {
    console.error('[cancel_request]', error.message);
    return { error: '요청을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.' };
  }

  await notifyCancelRequested(code, reason);
  revalidatePath(`/r/${code}`);
  return { done: true };
}
