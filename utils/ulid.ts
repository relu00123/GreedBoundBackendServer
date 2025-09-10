// utils/ulid.ts
// RFC 4122가 아닌 ULID(https://github.com/ulid/spec) 규격.
// 시간순 정렬 가능, 26자 Crockford Base32, 모노토닉 보장(같은 ms 내 생성시 랜덤부 증가).

const ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford Base32 (no I,L,O,U)
const TIME_LEN = 10;  // 48-bit time → 10 chars
const RAND_LEN = 16;  // 80-bit randomness → 16 chars

let lastTime = -1;
let lastRand: number[] | null = null;

// 난수 80비트(=16 chars) 생성
function random80Bits(): number[] {
  // Node 18+ 에서는 crypto.getRandomValues 사용 가능 (Web Crypto)
  // 없으면 Math.random fallback
  const out: number[] = new Array(RAND_LEN);
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    const buf = new Uint8Array(RAND_LEN);
    crypto.getRandomValues(buf);
    for (let i = 0; i < RAND_LEN; i++) out[i] = buf[i] % 32;
  } else {
    for (let i = 0; i < RAND_LEN; i++) out[i] = (Math.random() * 32) | 0;
  }
  return out;
}

// 같은 ms 안에서 모노토닉 증가(랜덤부를 Base32 숫자처럼 +1)
function incrementBase32Digits(digits: number[]): void {
  for (let i = digits.length - 1; i >= 0; i--) {
    if (digits[i] === 31) {
      digits[i] = 0; // carry
    } else {
      digits[i]++;
      return;
    }
  }
  // 전부 31이었다면 넘어가지 않게 0으로 유지 (실무에선 time tick 기다리거나 rand 재샘플)
}

// 48비트 타임스탬프를 Base32 10자로 인코딩
function encodeTime(t: number): string {
  // 48bit mask 필요 없지만, 안전하게 정수화
  let time = Math.floor(t);
  const chars = Array(TIME_LEN);
  for (let i = TIME_LEN - 1; i >= 0; i--) {
    chars[i] = ENCODING[time % 32];
    time = Math.floor(time / 32);
  }
  return chars.join("");
}

// 랜덤부(80비트) Base32 16자 인코딩
function encodeRand(randDigits: number[]): string {
  const chars = new Array(RAND_LEN);
  for (let i = 0; i < RAND_LEN; i++) {
    chars[i] = ENCODING[randDigits[i] & 31];
  }
  return chars.join("");
}

export function ulid(): string {
  const now = Date.now();

  let randDigits: number[];
  if (now === lastTime) {
    // 같은 ms → 모노토닉 증가
    randDigits = lastRand ? lastRand.slice() : random80Bits();
    incrementBase32Digits(randDigits);
  } else {
    // 새로운 ms → 새로운 난수
    randDigits = random80Bits();
  }

  lastTime = now;
  lastRand = randDigits;

  return encodeTime(now) + encodeRand(randDigits);
}