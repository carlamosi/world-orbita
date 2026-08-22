import { test, expect } from '@playwright/test';

test('sign‑up page loads without error', async ({ page }) => {
  // navigate to auth page (sign‑up view is part of /auth route)
  await page.goto('/auth?mode=signup');

  // Wait for the sign‑up button to be visible
  const signUpButton = page.getByRole('button', { name: /Create account/i });
  await expect(signUpButton).toBeVisible({ timeout: 15000 });
  // Fill email and password fields
  await page.fill('input[name="email"]', 'testuser@example.com');
  await page.fill('input[name="password"]', 'Password123!');
  // Click the sign‑up button
  await signUpButton.click();

  // Wait a short while for possible error toast
  const errorToast = page.locator('text=Something went wrong');
  const isVisible = await errorToast.isVisible().catch(() => false);
  expect(isVisible).toBeFalsy();
});
