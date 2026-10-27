import { createHmac, timingSafeEqual } from 'node:crypto';

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value) {
    throw new Error('SESSION_SECRET 이 필요합니다. .env.local 을 확인하세요.');
  }
  return value;
}

function mac(value: string): string {
  return createHmac('sha256', secret()).update(value).digest('hex');
}

/** 쿠키에 담을 `값.서명` 문자열을 만든다. */
export function pack(value: string): string {
  return `${value}.${mac(value)}`;
}

/** 서명이 맞으면 값을, 아니면 null 을 돌려준다. */
export function unpack(raw: string | undefined): string | null {
  if (!raw) return null;

  const at = raw.lastIndexOf('.');
  if (at <= 0) return null;

  const value = raw.slice(0, at);
  const given = raw.slice(at + 1);

  let expected: string;
  try {
    expected = mac(value);
  } catch {
    return null; // SESSION_SECRET 이 없으면 통과시키지 않는다
  }

  if (given.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(given), Buffer.from(expected))) return null;

  return value;
}
