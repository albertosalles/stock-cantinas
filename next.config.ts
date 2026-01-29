import type { NextConfig } from "next";

const withPWA = require("@ducanh2912/next-pwa").default({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  swcMinify: true,
  disable: false, // IMPORTANTE: Déjalo en false para probar en local, cámbialo a process.env.NODE_ENV === "development" para producción
  workboxOptions: {
    disableDevLogs: true,
  },
});

const nextConfig: NextConfig = {
  // Tus configuraciones futuras irían aquí
};

export default withPWA(nextConfig);