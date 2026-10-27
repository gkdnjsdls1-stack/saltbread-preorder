export const TZ = 'Asia/Seoul';

/** 픽업 전날 이 시각까지만 예약을 받는다. */
export const CUTOFF_HOUR = 21;

type Parts = { y: number; m: number; d: number; hour: number; minute: number };

function seoulParts(now: Date): Parts {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });

  const got: Record<string, string> = {};
  for (const part of fmt.formatToParts(now)) {
    if (part.type !== 'literal') got[part.type] = part.value;
  }

  return {
    y: Number(got.year),
    m: Number(got.month),
    d: Number(got.day),
    hour: Number(got.hour),
    minute: Number(got.minute),
  };
}

function isoDate(y: number, m: number, d: number): string {
  // UTC 로 만들어 자리올림(월말, 연말)을 맡긴다.
  return new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);
}

/** 서울 기준 오늘 (YYYY-MM-DD) */
export function todaySeoul(now: Date = new Date()): string {
  const { y, m, d } = seoulParts(now);
  return isoDate(y, m, d);
}

/** 서울 기준 내일 (YYYY-MM-DD). 이 앱의 픽업 날짜는 늘 내일이다. */
export function tomorrowSeoul(now: Date = new Date()): string {
  const { y, m, d } = seoulParts(now);
  return isoDate(y, m, d + 1);
}

/**
 * 내일 픽업 예약을 아직 받는지.
 *
 * 화면 표시용이다. 실제 판정은 DB 의 order_window_open() 이 하고,
 * 예약 생성도 그 함수를 통과해야만 된다. 여기서 막는 건 거들기일 뿐이다.
 */
export function isOrderWindowOpen(now: Date = new Date()): boolean {
  return seoulParts(now).hour < CUTOFF_HOUR;
}

/** '10월 28일 (화)' 같은 표시용 문자열 */
export function formatDateKo(isoDay: string): string {
  const [y, m, d] = isoDay.split('-').map(Number);
  const weekday = ['일', '월', '화', '수', '목', '금', '토'][
    new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  ];
  return `${m}월 ${d}일 (${weekday})`;
}
