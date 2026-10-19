// SPDX-License-Identifier: MPL-2.0

import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { schedulePlugin } from './server/schedulePlugin.ts';
import {newsResultsPlugin} from './server/newsResults.ts';
import { sqliteStartupGuard } from './build/sqliteStartupGuard.ts';
import { betaDataBoundary } from './build/betaDataBoundary.ts';

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, ".", "");
  const previewHost = environment.IB_FIELD_NOTES_PREVIEW_HOST?.trim();
  const rehearsal = mode === 'beta-rehearsal';
  const publicBlank = mode === 'public-blank';
  const dataFree = rehearsal || publicBlank;
  const phoneTest = rehearsal && process.env.IB_WORKSPACE_PHONE_TEST === '1';
  // Identify the actual artifact, including uncommitted builds, without depending
  // on a Git checkout or exposing a local branch/remote in user reports.
  const buildId = `${publicBlank ? 'public-blank' : rehearsal ? 'rehearsal' : 'local'}-${new Date().toISOString().replace(/[-:.]/g, '')}`;

  return {
    define: { __IB_BUILD_ID__: JSON.stringify(buildId), __IB_BETA_REHEARSAL__: JSON.stringify(rehearsal), __IB_PUBLIC_BLANK__: JSON.stringify(publicBlank), __IB_PHONE_TEST__: JSON.stringify(phoneTest) },
    plugins: [
      {
        name: 'ib-build-identity',
        generateBundle() {
          this.emitFile({ type: 'asset', fileName: 'build-info.json', source: JSON.stringify({ buildId, distribution: publicBlank ? 'public-blank' : rehearsal ? 'beta-rehearsal' : 'private' }) });
        }
      },
      betaDataBoundary(dataFree, publicBlank),
      sqliteStartupGuard(),
      ...(!dataFree ? [schedulePlugin(), newsResultsPlugin()] : []),
      react(),
      VitePWA({
        registerType: "prompt",
        injectRegister: false,
        includeAssets: ["icons/*.png"],
        manifest: {
          name: "IB Field Notes",
          short_name: "IB Notes",
          description: "A local-first Initial Balance field journal.",
          theme_color: "#14171c",
          background_color: "#14171c",
          display: "standalone",
          start_url: "./",
          scope: "./",
          icons: [
            { src: "icons/ib-notes-pink-v3-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
            { src: "icons/ib-notes-pink-v3-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
            { src: "icons/ib-notes-pink-v3-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
          ]
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,svg,png,wasm}"],
          // Audited minute closes plus extremes must remain available offline.
          maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
          // Optional one-time replay delivery; imported journal records persist offline.
          globIgnores: ['**/es-recent-journal-*.js'],
          navigateFallback: "index.html",
          navigateFallbackDenylist: [/\/api\//]
        }
      })
    ],
    optimizeDeps: {
      exclude: ["@sqlite.org/sqlite-wasm"]
    },
    preview: {
      allowedHosts: previewHost ? [previewHost] : [],
      strictPort: true
    },
    worker: {
      format: "es" as const,
      plugins: () => [sqliteStartupGuard(), betaDataBoundary(dataFree, publicBlank)],
    }
  };
});
