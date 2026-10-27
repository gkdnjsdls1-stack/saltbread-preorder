export function won(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`;
}

/** 전화번호를 숫자만 남긴다. 저장은 이 형태로 한다. */
export function normalizePhone(input: string): string {
  return input.replace(/\D/g, '');
}

/** 010-1234-5678 형태로 보여준다. */
export function formatPhone(digits: string): string {
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return digits;
}

export function isValidPhone(digits: string): boolean {
  return /^0\d{8,10}$/.test(digits);
}
