import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': projectRoot,
      },
    },
    build: {
      chunkSizeWarningLimit: 2500,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('firebase')) {
                return 'vendor-firebase';
              }
              if (id.includes('@google/genai')) {
                return 'vendor-genai';
              }
              if (id.includes('lucide-react')) {
                return 'vendor-lucide';
              }
              if (id.includes('motion')) {
                return 'vendor-motion';
              }
              if (id.includes('react') || id.includes('react-dom')) {
                return 'vendor-react';
              }
              return 'vendor-libs';
            }
            if (id.includes('xieji720Raw')) {
              return 'data-xieji';
            }
            if (id.includes('petHomeData')) {
              return 'data-pet-home';
            }
            if (id.includes('emergencyProtocols')) {
              return 'data-emergency';
            }
            if (id.includes('/data/')) {
              return 'data-common';
            }
            if (id.includes('PetRoomModal') || id.includes('PetMemoriesModal')) {
              return 'feature-pet';
            }
            if (id.includes('LiveChatModal')) {
              return 'feature-live-chat';
            }
            if (id.includes('/games/')) {
              return 'feature-games';
            }
            if (id.includes('OfficeMap')) {
              return 'feature-officemap';
            }
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
