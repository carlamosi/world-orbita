import { test, expect } from '@playwright/test';

test.describe('Flags Page', () => {
  test('loads Flags page in Easy mode (Flag -> Country) and renders 4 country options', async ({ page }) => {
    await page.goto('/flags');

    // Verify the prompt pill for Flag -> Country
    await expect(page.getByText('Which country owns this flag?')).toBeVisible({ timeout: 15000 });

    // Verify mystery flag is visible
    const flagImage = page.locator('img[alt="Mystery flag"]');
    await expect(flagImage).toBeVisible();

    // Verify 4 multiple-choice options are rendered
    const buttons = page.locator('button:has(.font-mono)');
    await expect(buttons).toHaveCount(4);
  });

  test('switches to Hard mode (Flag -> Type) and renders typing input', async ({ page }) => {
    await page.goto('/flags');

    // Open mode dropdown and select Hard (Flag -> Type)
    const modeDropdown = page.getByRole('button', { name: /Easy/i });
    await modeDropdown.click();

    const hardOption = page.getByRole('option', { name: /Hard/i });
    await hardOption.click();

    // Verify prompt changes to "Name this flag"
    await expect(page.getByText('Name this flag')).toBeVisible({ timeout: 10000 });

    // Verify typing input is rendered
    const input = page.locator('input[placeholder="Type the country…"]');
    await expect(input).toBeVisible();
  });
});
