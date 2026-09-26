/// <reference types="vite/client" />
// Préfixe de l'app quand elle est servie sous un sous-chemin (ex. "/odin").
// Vient de `base` dans vite.config.ts (variable BASE_PATH au build). Vide si servie à la racine.
export const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// Préfixe un chemin absolu ("/api/...") avec BASE. Laisse les URLs complètes intactes.
export function withBase(url: string): string {
  return url.startsWith("/") && !url.startsWith("//") ? `${BASE}${url}` : url;
}
