import path from 'path';

import { InjectManifest } from '@aaroon/workbox-rspack-plugin';
import { rspack } from '@rspack/core';
import { merge } from 'webpack-merge';

import { nodeEnv } from './constant';
import { createBaseConfig } from './rspack.base.config';
import { createDevelopmentConfig } from './rspack.development.config';
import { createProductionConfig } from './rspack.prod.config';

import type { RspackOptions, RspackPluginInstance } from '@rspack/core';

interface IWebConfigOptions {
  basePath: string;
  platform?: string;
}

export function createWebConfig({
  basePath,
  platform = 'web',
}: IWebConfigOptions): RspackOptions {
  const baseConfig = createBaseConfig({ platform, basePath });

  switch (nodeEnv) {
    case 'production':
      return merge(baseConfig, createProductionConfig({ platform, basePath }), {
        output: {
          crossOriginLoading: 'anonymous',
        },
        plugins: (platform === 'web'
          ? [
              // (C1) SRI — native rspack plugin (NOT webpack-subresource-integrity,
              //   which is incompatible with rspack's Rust pipeline).
              //   htmlPlugin:'html-webpack-plugin' is REQUIRED because the base
              //   config uses the JS html-webpack-plugin, not native HtmlRspackPlugin.
              //   MUST come BEFORE InjectManifest so the SW precache manifest
              //   hashes the SRI-final assets.
              new rspack.SubresourceIntegrityPlugin({
                hashFuncNames: ['sha384'],
                htmlPlugin: 'html-webpack-plugin',
                enabled: 'auto',
              }),
              // (C2) PWA precache — rspack-native workbox InjectManifest port.
              //   apps/web/index.js registers /service-worker.js; without this
              //   the file 404s and offline precache silently breaks. Exclude
              //   list mirrors webpack EXCEPT asset-manifest.json (that file is
              //   intentionally dropped under rspack — it has zero consumers).
              new InjectManifest({
                swSrc: path.join(basePath, 'src/service-worker.js'),
                swDest: 'service-worker.js',
                // Precache NOTHING. This is a large SPA (~800+ chunks); the
                // InjectManifest default precaches every emitted asset, which
                // makes the SW `install` an ATOMIC all-or-nothing fetch of every
                // file — one failed/blocked/throttled request leaves the SW stuck
                // "trying to install" forever (observed in prod/test: #2500+
                // installs with ERR_CONNECTION_CLOSED bursts). Every asset is
                // already covered by the runtime caching routes in
                // service-worker.js (NetworkFirst navigations, StaleWhileRevalidate
                // scripts/styles, CacheFirst images/fonts), so a full precache adds
                // fragility with no benefit. `exclude: [/./]` -> empty precache.
                exclude: [/./],
              }),
            ]
          : []) as unknown as RspackPluginInstance[],
      });
    case 'development':
    default:
      return merge(baseConfig, createDevelopmentConfig({ basePath }));
  }
}

export default createWebConfig;
