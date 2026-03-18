const { test, expect } = require('@playwright/test');

test('SRU tutorial starts and air hotspot updates the control', async ({ page }) => {
  await page.goto('http://127.0.0.1:4173/game.html');
  await page.waitForLoadState('domcontentloaded');

  await page.evaluate(() => {
    localStorage.removeItem('refineryRunProgress');
  });
  await page.reload();
  await page.waitForLoadState('domcontentloaded');

  await page.evaluate(() => {
    window.Game.showPhase('sru', { skipSave: true });
  });

  await page.waitForTimeout(500);
  await expect(page.locator('#sru-stage')).toBeVisible();
  await page.getByRole('button', { name: 'Start Tutorial' }).click();
  await expect(page.getByRole('heading', { name: 'Air Balance' })).toBeVisible();

  const airInput = page.locator('#sru-air-input');
  await expect(airInput).toHaveValue('28');

  const slider = page.locator('#sru-air-input');
  const box = await slider.boundingBox();
  if (!box) {
    throw new Error('Air slider bounding box was not available.');
  }

  await page.mouse.move(box.x + 10, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 10, box.y + box.height / 2);
  await page.mouse.up();

  await expect(airInput).not.toHaveValue('28');
});
