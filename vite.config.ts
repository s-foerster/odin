import { defineConfig, type Plugin } from "vite";
import { createHash } from "crypto";
import react from "@vitejs/plugin-react";
import themePlugin from "@replit/vite-plugin-shadcn-theme-json";
import path from "path";

// Génère dist/public/sw.js : met en cache tous les fichiers du jeu pour jouer hors ligne
// (mode avion). Les appels /api et /ws ne sont jamais mis en cache.
function offlineServiceWorker(): Plugin {
  const publicFiles = ["manifest.webmanifest", "icon-192.png", "icon-512.png", "apple-touch-icon.png"];
  return {
    name: "odin-offline-sw",
    apply: "build",
    generateBundle(_options, bundle) {
      const files = Object.keys(bundle).filter((f) => !f.endsWith(".map") && f !== "sw.js");
      const urls = ["./", ...publicFiles, ...files].map((f) => (f === "./" ? f : `./${f}`));
      const version = createHash("sha1").update(urls.join("|")).digest("hex").slice(0, 10);
      const source = `// Généré au build (vite.config.ts)
const CACHE = "odin-${version}";
const PRECACHE = ${JSON.stringify(urls)};

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("odin-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes("/api/") || url.pathname.endsWith("/ws")) return;

  // Pages : le réseau d'abord (nouvelle version), sinon la copie en cache
  if (request.mode === "navigate") {
    const indexUrl = new URL("./", self.registration.scope).href;
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(indexUrl, copy));
          }
          return response;
        })
        .catch(() => caches.match(indexUrl))
    );
    return;
  }

  // Fichiers (noms avec empreinte) : le cache d'abord
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok && response.type === "basic") {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
    )
  );
});
`;
      this.emitFile({ type: "asset", fileName: "sw.js", source });
    },
  };
}

export default defineConfig({
  plugins: [
    offlineServiceWorker(),
    react({
      babel: {
        plugins: [
          ["@babel/plugin-transform-react-jsx", { runtime: "automatic" }]
        ]
      }
    }),
    themePlugin(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
        ]
      : []),
  ],
  // BASE_PATH permet de servir l'app sous un sous-chemin (ex. /odin/). Par défaut : racine.
  base: process.env.BASE_PATH || '/',
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    chunkSizeWarningLimit: 800,
    assetsInlineLimit: 4096,
    sourcemap: process.env.NODE_ENV !== "production",
    minify: "terser",
    assetsDir: 'assets',
    terserOptions: {
      compress: {
        drop_console: process.env.NODE_ENV === "production",
        drop_debugger: process.env.NODE_ENV === "production"
      }
    },
    rollupOptions: {
      output: {
        manualChunks: {},
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    }
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path
      },
      "/ws": {
        target: "ws://localhost:5000",
        ws: true,
        changeOrigin: true,
        secure: false
      }
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react/jsx-runtime'],
    esbuildOptions: {
      define: {
        global: 'globalThis'
      }
    }
  }
});
