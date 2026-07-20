import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vi kör lokalt mot http://127.0.0.1:3007 (egen cookie-burk – slipper de
  // ackumulerade localhost-cookiesarna som ger HTTP 431). Next dev startas dock
  // på "localhost" och blockerar då 127.0.0.1 som cross-origin, vilket tystar
  // både HMR och server actions. Gäller endast utvecklingsläge.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
