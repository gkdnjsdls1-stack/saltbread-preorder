import { randomInt } from 'node:crypto';

// 0/O, 1/I/L, 2/Z, 5/S, 8/B 처럼 전화로 불러주기 어려운 글자는 뺐다.
const ALPHABET = 'ACDEFGHJKMNPQRTUVWXY34679';

/** 손님에게 주는 예약 코드. 전화번호와 짝으로만 조회에 쓰인다. */
export function newReservationCode(length = 6): string {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += ALPHABET[randomInt(ALPHABET.length)];
  }
  return out;
}

export function normalizeCode(input: string): string {
  return input.trim().toUpperCase();
}
