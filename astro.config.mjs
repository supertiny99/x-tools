// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';
import AstroPWA from '@vite-pwa/astro';

// https://astro.build/config
export default defineConfig({
  vite: {
    plugins: [tailwindcss()]
  },

  integrations: [
    react(),
    AstroPWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'X-Tools - 在线实用工具集合',
        short_name: 'X-Tools',
        description: '在线实用工具集合，包含图片处理、二维码、签名、网络工具等',
        theme_color: '#6366f1',
        background_color: '#f8fafc',
        display: 'standalone',
        start_url: '/',
        lang: 'zh-CN',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
        shortcuts: [
          {
            name: '图片工具',
            url: '/tools/image',
            description: '图片格式转换与处理',
          },
          {
            name: '二维码工具',
            url: '/tools/qrcode',
            description: '生成与识别二维码',
          },
          {
            name: 'WebRTC 传连',
            url: '/tools/webrtc',
            description: '点对点文件传输',
          },
        ],
        categories: ['utilities', 'productivity'],
      },
      workbox: {
        navigateFallback: '/',
        globPatterns: ['**/*.{css,js,html,svg,png,ico,txt}'],
      },
      devOptions: {
        enabled: true,
      },
    }),
  ]
});
