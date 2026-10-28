import Link from 'next/link';

/** 글자로 짠 워드마크. 매장 간판과 같은 두 줄 구성이다. */
export function Wordmark() {
  return (
    <span className="mark">
      <span className="mark__line">Bride</span>
      <span className="mark__line">groom</span>
      <span className="mark__tag">CLASSIC COFFEE BAR</span>
    </span>
  );
}

/** 메인 화면 맨 위. 유리창에 붙은 실제 로고 사진을 그대로 쓴다. */
export function Hero() {
  return (
    <div className="hero">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="hero__img"
        src="/hero.jpg"
        alt="Bridegroom 매장 유리창에 붙은 로고"
        width={1600}
        height={900}
      />
    </div>
  );
}

/** 안쪽 화면 머리. 누르면 메인으로 돌아간다. */
export function BrandBar({ link = true }: { link?: boolean }) {
  return (
    <div className="brandbar">
      {link ? (
        <Link href="/" aria-label="처음으로">
          <Wordmark />
        </Link>
      ) : (
        <Wordmark />
      )}
    </div>
  );
}
