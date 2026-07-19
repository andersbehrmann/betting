import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// TILLFÄLLIGT (ikväll VM-finalen): skicka alla direkt till tipsningen så man kan
// spela med bara ett namn – ingen landning, inget konto. Återställ landningssidan
// genom att reverta denna commit.
export default function HomePage() {
  redirect("/events/final-2026/play");
}
