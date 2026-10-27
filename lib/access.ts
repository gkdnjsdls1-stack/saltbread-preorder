import { cookies } from 'next/headers';
import { pack, unpack } from '@/lib/signed';

const COOKIE = 'res_access';
const MAX_CODES = 10;
const MAX_AGE = 60 * 60 * 24 * 7; // 7일

/**
 * 손님이 볼 수 있는 예약을 쿠키로 들고 다닌다.
 *
 * 로그인이 없으므로, 예약을 막 만든 사람이거나 코드+전화번호를 맞춘 사람에게만
 * 접근 권한을 준다. 전화번호를 URL 에 싣지 않기 위한 장치이기도 하다.
 */
async function readCodes(): Promise<string[]> {
  const raw = (await cookies()).get(COOKIE)?.value;
  const value = unpack(raw);
  if (!value) return [];
  return value.split(',').filter(Boolean);
}

export async function hasReservationAccess(code: string): Promise<boolean> {
  return (await readCodes()).includes(code);
}

export async function grantReservationAccess(code: string): Promise<void> {
  const codes = await readCodes();
  const next = [code, ...codes.filter((c) => c !== code)].slice(0, MAX_CODES);

  (await cookies()).set(COOKIE, pack(next.join(',')), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: MAX_AGE,
  });
}
