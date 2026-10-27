import { cookies } from 'next/headers';
import { timingSafeEqual } from 'node:crypto';
import { pack, unpack } from '@/lib/signed';

const COOKIE = 'admin_session';
const MAX_AGE = 60 * 60 * 12; // 12시간

export async function isAdmin(): Promise<boolean> {
  const value = unpack((await cookies()).get(COOKIE)?.value);
  return value?.startsWith('owner:') ?? false;
}

export async function startAdminSession(): Promise<void> {
  (await cookies()).set(COOKIE, pack(`owner:${Date.now()}`), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: MAX_AGE,
  });
}

export async function endAdminSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

/** 길이가 달라도 바로 false 를 주지 않도록 해시 없이 상수 시간 비교만 한다. */
export function checkAdminPassword(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;

  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}
