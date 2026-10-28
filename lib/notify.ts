/**
 * 사장님 알림은 전부 이 파일을 거친다.
 *
 * 기획대로, 나중에 카카오 알림톡으로 갈아끼울 지점은 여기 한 군데다.
 * 호출하는 쪽은 "무엇을 알린다"만 알고 "어떻게 보낸다"는 모른다.
 */

/**
 * 알림은 예약이 저장된 뒤에 보낸다. 그래도 호출하는 쪽이 await 하므로,
 * 텔레그램이 느리면 손님 화면이 같이 멈춘다. 그래서 짧게 끊는다.
 * 알림을 못 보내는 것보다 손님을 기다리게 하는 쪽이 나쁘다.
 */
const TIMEOUT_MS = 5000;

async function send(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  // 봇을 아직 안 붙였으면 서버 로그로만 남긴다. 개발 중에도 내용을 확인할 수 있다.
  if (!token || !chatId) {
    console.log('[notify]', text);
    return;
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      // 내용을 로그에 남겨 둔다. 알림이 끊겨도 사장님이 관리 화면에서는 볼 수 있다.
      console.error('[notify] 텔레그램 응답 오류', res.status, await res.text());
      console.log('[notify] 보내려던 내용:', text);
    }
  } catch (err) {
    // 알림이 실패해도 예약 자체는 성공해야 한다. 절대 던지지 않는다.
    console.error('[notify] 전송 실패', err instanceof Error ? err.message : err);
    console.log('[notify] 보내려던 내용:', text);
  }
}

type NewReservation = {
  code: string;
  customerName: string;
  pickupDate: string;
  pickupTime: string;
  total: number;
  items: { name: string; qty: number }[];
};

export async function notifyNewReservation(r: NewReservation): Promise<void> {
  const lines = r.items.map((i) => `  · ${i.name} ${i.qty}개`).join('\n');
  await send(
    [
      `🥐 새 예약 (${r.code})`,
      `${r.customerName} / ${r.pickupDate} ${r.pickupTime}`,
      lines,
      `합계 ${r.total.toLocaleString('ko-KR')}원 · 입금 전`,
    ].join('\n'),
  );
}

export async function notifyPaymentSubmitted(code: string, depositorName: string): Promise<void> {
  await send(`💰 입금 정보 등록 (${code})\n입금자 ${depositorName} · 확인이 필요합니다`);
}

export async function notifyCancelRequested(code: string, reason: string): Promise<void> {
  await send(`⚠️ 입금 후 취소 요청 (${code})\n사유: ${reason || '없음'}`);
}

export async function notifyCustomerCancelled(code: string): Promise<void> {
  await send(`🚫 손님이 직접 취소 (${code}) · 입금 전 예약`);
}
