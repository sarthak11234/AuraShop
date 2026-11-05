import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './src/app/__tests__',
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
  // Run tests in parallel
  fullyParallel: true,
  // Use list reporter
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
  },
  // Configure web server
  webServer: {
    command: 'npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: false,
    timeout: 60000,
  },
  // Look in the tests/ directory, relative to this config
  // projects: [
  //   {
  //     name: 'Chromium',
  //     use: { ...devices['Desktop Chrome'] },
  //   },
  // ],
});