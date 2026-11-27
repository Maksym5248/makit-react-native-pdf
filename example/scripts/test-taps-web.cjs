const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 1024, height: 900 },
    });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://127.0.0.1:8093/?checks');
    await page
      .getByRole('button', { name: 'Sample PDF', exact: true })
      .click();
    await page.getByText('1 / 3', { exact: true }).waitFor();
    const pdf = page.locator('.react-pdf__Page').first();
    await pdf.locator('canvas').waitFor();
    const before = await pdf.boundingBox();
    await pdf.click({ position: { x: 180, y: 300 } });
    await page.waitForFunction(
      () =>
        getComputedStyle(
          document.querySelector('[data-testid="example.toolbar"]'),
        ).opacity === '0',
    );
    assert.deepEqual(await pdf.boundingBox(), before);
    await pdf.click({ position: { x: 180, y: 300 } });
    await page.waitForFunction(
      () =>
        getComputedStyle(
          document.querySelector('[data-testid="example.toolbar"]'),
        ).opacity === '1',
    );
    await pdf.dblclick({ position: { x: 180, y: 300 } });
    await page.waitForTimeout(700);
    assert.equal(
      await page
        .getByTestId('example.toolbar')
        .evaluate(e => getComputedStyle(e).opacity),
      '1',
    );
    await page.mouse.move(300, 400);
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(500);
    assert.equal(
      await page
        .getByTestId('example.toolbar')
        .evaluate(e => getComputedStyle(e).opacity),
      '1',
    );
    assert.deepEqual(errors, []);
    console.log(
      'PASS example: tap/restore, stable PDF bounds, double click, scroll, no JS errors',
    );
  } finally {
    await browser.close();
  }
})().catch(e => {
  console.error(e);
  process.exitCode = 1;
});
