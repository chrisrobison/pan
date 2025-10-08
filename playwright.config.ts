import { defineConfig } from '@playwright/test';
import path from 'path';

export default defineConfig({
  testDir: path.join(__dirname, 'tests'),
  timeout: 30_000,
  retries: 0,
  use: {
    headless: true,
    trace: 'on-first-retry'
  },
  reporter: [['list']]
});

