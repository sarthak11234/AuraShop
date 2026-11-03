import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './src/app/__tests__',
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
  // Run tests in parallel
  fullyParallel: true,
  // Use Chrome by default
  reporter: [['list'], ['html']],
  // Configure web server
  webServer: {
    command: 'npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120000,
  },
  // Look in the tests/ directory, relative to this config
  // projects: [
  //   {
  //     name: 'Chromium',
  //     use: { ...devices['Desktop Chrome'] },
  //   },
  // ],
});