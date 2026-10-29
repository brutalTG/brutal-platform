import Link from 'next/link';

export function Masthead() {
  return (
    <header className="masthead">
      <div className="shell inner">
        <Link href="/" aria-label="BRUTAL, inicio"><img src="/brutal-logo.svg" alt="BRUTAL" width={180} height={40} /></Link>
        <nav aria-label="Secciones">
          <Link href="/briefs">Briefs</Link>
          <a href="https://brutal.lat" rel="noreferrer">brutal.lat</a>
        </nav>
      </div>
    </header>
  );
}
