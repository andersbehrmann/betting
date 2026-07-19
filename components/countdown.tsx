"use client";

import { useEffect, useState } from "react";

function diff(target: number) {
  const ms = Math.max(0, target - Date.now());
  const totalMin = Math.floor(ms / 60000);
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin % (60 * 24)) / 60);
  const minutes = totalMin % 60;
  const seconds = Math.floor((ms % 60000) / 1000);
  return { ms, days, hours, minutes, seconds };
}

/** Live nedräkning till deadline. isoDeadline i UTC. */
export function Countdown({ isoDeadline }: { isoDeadline: string }) {
  const target = new Date(isoDeadline).getTime();
  const [t, setT] = useState(() => diff(target));

  useEffect(() => {
    const id = setInterval(() => setT(diff(target)), 1000);
    return () => clearInterval(id);
  }, [target]);

  if (t.ms <= 0) {
    return <span className="font-display text-gold">Tipsningen är stängd</span>;
  }

  const parts: string[] = [];
  if (t.days > 0) parts.push(`${t.days}d`);
  parts.push(`${String(t.hours).padStart(2, "0")}h`);
  parts.push(`${String(t.minutes).padStart(2, "0")}m`);
  if (t.days === 0) parts.push(`${String(t.seconds).padStart(2, "0")}s`);

  return <span className="font-display tabular-nums">{parts.join(" ")}</span>;
}
