import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { LEAGUE_ID, mockApis, signIn } from './fixtures';

test.beforeEach(async ({ page }) => {
  await mockApis(page);
});

test('player database lists and filters players', async ({ page }) => {
  await page.goto('/players');
  await expect(page.getByText('Josh Allen')).toBeVisible();
  await page.getByRole('searchbox').fill('bowers');
  await expect(page.getByText('Brock Bowers')).toBeVisible();
  await expect(page.getByText('Josh Allen')).toHaveCount(0);
});

test('player page shows injury details, chart and matchups', async ({ page }) => {
  await page.goto('/players/1007');
  await expect(page.getByRole('heading', { name: 'Justin Jefferson' })).toBeVisible();
  await expect(page.getByText('Hamstring').first()).toBeVisible();
  await expect(page.getByRole('img', { name: /Fantasy points by week/ })).toBeVisible();
  await expect(page.getByText(/On bye in Week 5/)).toBeVisible();
});

test('compare ranks players from a shared URL', async ({ page }) => {
  await page.goto('/compare?players=1001,1002,1003');
  await expect(page.getByText(/ranks first/)).toBeVisible();
  await expect(page.getByText('#1', { exact: false }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Remove' }).last().click();
  await expect(page).toHaveURL(/players=1001%2C1002|players=1001,1002/);
});

test.describe('signed in', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('league lineup tab suggests benching an inactive starter', async ({ page }) => {
    await page.goto(`/my-leagues/${LEAGUE_ID}?tab=lineup`);
    await expect(page.getByText(/Your lineup can gain/)).toBeVisible();
    const start = page.locator('h4', { hasText: 'START' }).locator('..');
    await expect(start.getByText("Ja'Marr Chase")).toBeVisible();
    const bench = page.locator('h4', { hasText: 'BENCH' }).locator('..');
    await expect(bench.getByText('Justin Jefferson')).toBeVisible();
  });

  test('league tabs are keyboard navigable', async ({ page }) => {
    await page.goto(`/my-leagues/${LEAGUE_ID}`);
    const thisWeek = page.getByRole('tab', { name: /This Week/ });
    await expect(thisWeek).toHaveAttribute('aria-selected', 'true');
    await thisWeek.focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: /Lineup/ })).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('End');
    await expect(page.getByRole('tab', { name: /Transactions/ })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('Spare Tight End')).toBeVisible();
  });

  test('playoff odds and power rankings render', async ({ page }) => {
    await page.goto(`/my-leagues/${LEAGUE_ID}?tab=playoffs`);
    await expect(page.getByText(/simulations of weeks 5–14/)).toBeVisible();
    await expect(page.getByRole('cell', { name: /Forge FC/ })).toBeVisible();
    await page.getByRole('tab', { name: /Power Rankings/ }).click();
    await expect(page.getByText(/Power score/)).toBeVisible();
  });

  test('waivers show trending pickups and suggestions', async ({ page }) => {
    await page.goto('/waivers');
    await expect(page.getByText('Trending Pickups Available')).toBeVisible();
    await expect(page.getByText('+51,234').first()).toBeVisible();
    await expect(page.getByText('Suggested Pickups')).toBeVisible();
  });

  test('my teams flags lineup problems', async ({ page }) => {
    await page.goto('/my-teams');
    await expect(page.getByText(/Justin Jefferson is starting but won't play/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Fix lineup →' })).toHaveAttribute('href', `/my-leagues/${LEAGUE_ID}?tab=lineup`);
  });

  test('trade finder searches the league', async ({ page }) => {
    await page.goto(`/trade?league=${LEAGUE_ID}`);
    await expect(page.getByText(/2-team replacement levels/)).toBeVisible();
    await page.getByRole('button', { name: 'Find trades' }).click();
    await expect(page.getByRole('button', { name: /Search again/ })).toBeVisible();
  });
});

test.describe('accessibility', () => {
  const pages = ['/', '/players', '/compare?players=1001,1002', '/players/1001'];
  for (const path of pages) {
    test(`no serious axe violations on ${path}`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      const serious = results.violations.filter(v => v.impact === 'serious' || v.impact === 'critical');
      expect(serious.map(v => `${v.id}: ${v.nodes.length} node(s) – ${v.help}`)).toEqual([]);
    });
  }

  test('no serious axe violations on the league dashboard', async ({ page }) => {
    await signIn(page);
    await page.goto(`/my-leagues/${LEAGUE_ID}?tab=lineup`);
    await expect(page.getByText(/Your lineup can gain/)).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const serious = results.violations.filter(v => v.impact === 'serious' || v.impact === 'critical');
    expect(serious.map(v => `${v.id}: ${v.nodes.length} node(s) – ${v.help}`)).toEqual([]);
  });
});
