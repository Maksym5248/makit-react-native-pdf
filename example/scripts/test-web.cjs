const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const output = path.resolve(
  process.env.E2E_OUTPUT_DIR || path.join(__dirname, '../e2e/artifacts'),
);
fs.mkdirSync(output, { recursive: true });
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
  });
  const page = await browser.newPage({
    viewport: { width: 1024, height: 900 },
  });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    for (const name of ['pdf-qa-report.json', 'pdf-renderer-report.json'])
      if (message.text().startsWith(name + ' '))
        fs.writeFileSync(
          path.join(output, 'web-' + name),
          message.text().slice(name.length + 1),
        );
  });
  try {
    await page.goto('http://127.0.0.1:8093');
    await page
      .getByRole('button', { name: 'Run API checks', exact: true })
      .click();
    await page
      .getByText('PASS 15/15', { exact: true })
      .waitFor({ timeout: 60000 });
    await page
      .getByRole('button', { name: 'Run renderer checks', exact: true })
      .click();
    await page.getByText(/^PASS 10\/10/).waitFor({ timeout: 120000 });
    await page
      .getByRole('button', { name: 'Close renderer checks', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'Тестовий PDF', exact: true })
      .click();
    await page.getByText('1 / 3', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Пошук', exact: true }).click();
    await page.getByLabel('Пошук у PDF', { exact: true }).fill('alpha');
    await page.getByText(/^6 збігів за/).waitFor();
    await page.getByRole('button', { name: 'Збіг →', exact: true }).click();
    await page.getByText('1/6', { exact: true }).waitFor();
    await page.waitForFunction(() => {
      const active = document.querySelector('mark[data-active-match]');
      const panel = document.querySelector('[data-testid="example.panel"]');
      return (
        active &&
        panel &&
        active.getBoundingClientRect().top >=
          panel.getBoundingClientRect().bottom
      );
    });
    await page.getByRole('button', { name: 'Сховати', exact: true }).click();
    await page.locator('mark').first().waitFor();
    await page.screenshot({ path: path.join(output, 'web-search.png') });
    await page.getByRole('button', { name: 'Сторінки', exact: true }).click();
    await page.getByRole('button', { name: 'Page 3', exact: true }).click();
    await page.getByText('3 / 3', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Вигляд', exact: true }).click();
    await page.getByRole('switch', { name: 'Horizontal' }).click();
    await page.getByRole('switch', { name: 'Paging' }).click();
    await page.getByRole('button', { name: 'Поворот 0°', exact: true }).click();
    await page
      .getByRole('button', { name: 'Уся сторінка', exact: true })
      .count()
      .then(async count => {
        if (!count)
          await page
            .getByRole('button', { name: 'За шириною', exact: true })
            .click();
      });
    await page.getByText('3 / 3', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Сховати', exact: true }).click();
    await page.screenshot({ path: path.join(output, 'web-rotated.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await page
      .getByRole('button', { name: 'Тестовий PDF', exact: true })
      .click();
    await page.getByRole('button', { name: 'Пошук', exact: true }).click();
    await page.getByLabel('Пошук у PDF', { exact: true }).fill('alpha');
    await page.getByText(/^6 збігів за/).waitFor();
    await page.getByRole('button', { name: 'Збіг →', exact: true }).click();
    await page.waitForFunction(() => {
      const active = document.querySelector('mark[data-active-match]');
      const panel = document.querySelector('[data-testid="example.panel"]');
      const toolbar = document.querySelector('[data-testid="example.toolbar"]');
      if (!active || !panel || !toolbar) return false;
      const match = active.getBoundingClientRect();
      const overlay = panel.getBoundingClientRect();
      return (
        match.top >= toolbar.getBoundingClientRect().bottom &&
        (match.bottom <= overlay.top || match.top >= overlay.bottom)
      );
    });
    await page.screenshot({ path: path.join(output, 'web-mobile-search.png') });
    if (errors.length) throw new Error(errors.join('\n'));
    console.log(
      'PASS web API, search/highlights, thumbnails, rotation and modes',
    );
  } catch (error) {
    console.log((await page.locator('body').innerText()).slice(0, 2500));
    throw error;
  } finally {
    await browser.close();
  }
})();
