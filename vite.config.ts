import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    build: {
      rollupOptions: {
        external: [/^@coinbase\/cdp-sdk/, /^@x402\/evm/],
      },
    },
    optimizeDeps: {
      exclude: ["@coinbase/cdp-sdk", "@x402/evm"],
    },
  },
});
