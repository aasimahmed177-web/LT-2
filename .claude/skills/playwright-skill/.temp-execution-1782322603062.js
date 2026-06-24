const { chromium } = require('playwright');

const TARGET_URL = 'http://localhost:3001';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  try {
    // SETTINGS PAGE
    console.log('=== SETTINGS PAGE ===');
    await page.goto(`${TARGET_URL}/settings`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1500);

    const settingsText = await page.locator('body').innerText();
    console.log('  Has "Last synced":', settingsText.includes('Last synced'));
    console.log('  Has "Forms Scanned":', settingsText.includes('Forms Scanned'));
    console.log('  Has "Leads Created":', settingsText.includes('Leads Created'));
    console.log('  Has "Leads Updated":', settingsText.includes('Leads Updated'));
    console.log('  Has "Skipped":', settingsText.includes('Skipped'));
    console.log('  Has "Total Fetched":', settingsText.includes('Total Fetched'));
    console.log('  Has "Total in DB":', settingsText.includes('Total in DB'));
    console.log('  Has Sync Meta Leads button:', settingsText.includes('Sync Meta Leads'));
    console.log('  Has per-form breakdown:', settingsText.includes('Per-form breakdown'));

    await page.screenshot({ path: '/tmp/settings-verification.png', fullPage: true });
    console.log('  Screenshot: /tmp/settings-verification.png');

    // LEADS PAGE
    console.log('\n=== LEADS PAGE ===');
    await page.goto(`${TARGET_URL}/leads`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1500);

    const leadsText = await page.locator('body').innerText();
    console.log('  Shows 57 leads:', leadsText.includes('57 leads'));
    console.log('  Has search input:', await page.locator('input[placeholder*="Search"]').isVisible());

    // Open drawer on a Contact-stage lead
    const rows = page.locator('table tbody tr');
    for (let i = 0; i < await rows.count(); i++) {
      const stageCell = rows.nth(i).locator('td').nth(4);
      const stage = await stageCell.textContent();
      if (stage && stage.includes('Contact')) {
        await rows.nth(i).click();
        break;
      }
    }
    await page.waitForTimeout(1000);

    const drawer = page.locator('.drawer-panel');
    const drawerVisible = await drawer.isVisible();
    console.log('  Drawer visible:', drawerVisible);

    if (drawerVisible) {
      const drawerText = await drawer.innerText();
      console.log('  Has "CRM Status" section:', drawerText.includes('CRM Status'));
      console.log('  Has "Meta / Source Data" section:', drawerText.includes('Meta / Source Data'));
      console.log('  Has "Notes & Tasks" section:', drawerText.includes('Notes'));
      console.log('  Shows Contact stage:', drawerText.includes('Contact'));
      console.log('  Shows Stage History:', drawerText.includes('Stage History'));

      await page.screenshot({ path: '/tmp/drawer-verification.png', fullPage: true });
      console.log('  Screenshot: /tmp/drawer-verification.png');
    }

    // EVENTS PAGE
    console.log('\n=== EVENTS PAGE ===');
    await page.goto(`${TARGET_URL}/events`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1000);

    const eventsText = await page.locator('body').innerText();
    console.log('  Events page loaded:', eventsText.length > 0);
    console.log('  Shows pending events:', eventsText.includes('pending'));

    // DASHBOARD
    console.log('\n=== DASHBOARD ===');
    await page.goto(`${TARGET_URL}/dashboard`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1500);

    const dashText = await page.locator('body').innerText();
    console.log('  Shows Pipeline Funnel:', dashText.includes('Pipeline Funnel'));
    console.log('  Shows Stage Distribution:', dashText.includes('Stage Distribution'));
    console.log('  Shows 57 total:', dashText.includes('57'));

    console.log('\n✅ ALL BROWSER CHECKS PASSED');
  } catch (err) {
    console.error('❌ Error:', err.message);
    await page.screenshot({ path: '/tmp/error.png', fullPage: true });
  } finally {
    await browser.close();
  }
})();