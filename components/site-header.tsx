import Link from "next/link";

export function SiteHeader({ right }: { right?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-20 border-b border-line/70 bg-cream/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-pitch text-chalk">
            <span aria-hidden className="text-base">⚽</span>
          </span>
          <span className="font-display text-lg font-bold tracking-tight text-pitch">Tipskvällen</span>
        </Link>
        <div className="flex items-center gap-1 text-sm">{right}</div>
      </div>
    </header>
  );
}
