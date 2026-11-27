import { openPdfSearch } from '@makit/react-native-pdf';

import { openFixture, releaseFile, saveQaReport } from './local-file';

interface Check {
  name: string;
  passed: boolean;
  detail: string;
}

export async function runPdfChecks(onProgress: (value: string) => void) {
  const checks: Check[] = [];
  const check = async (name: string, operation: () => Promise<void>) => {
    onProgress(name);
    try {
      await operation();
      checks.push({ name, passed: true, detail: '' });
    } catch (error) {
      checks.push({
        name,
        passed: false,
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  };
  const equal = (actual: unknown, expected: unknown) => {
    if (actual !== expected)
      throw new Error(
        `Expected ${String(expected)}, received ${String(actual)}`,
      );
  };
  const rejected = async (operation: () => Promise<unknown>) => {
    let failed = false;
    try {
      await operation();
    } catch {
      failed = true;
    }
    equal(failed, true);
  };
  const uri = await openFixture();
  const document = await openPdfSearch(uri);
  try {
    await check('Page count and metadata', async () => {
      equal(document.pages, 3);
      const info = await document.getPageInfo(3);
      equal(info.width, 600);
      equal(info.height, 800);
      equal(info.rotation, 90);
      equal(info.hasText, true);
    });
    for (const query of ['alpha', 'книга', 'ALPHA']) {
      await check(`Search ${query}`, async () => {
        let count = 0;
        for (let page = 1; page <= document.pages; page++) {
          const result = await document.searchPage(page, query);
          equal(result.hasText, true);
          equal(result.truncated, false);
          equal(result.matches.length, 2);
          count += result.matches.length;
        }
        equal(count, 6);
      });
    }
    await check('Case-sensitive search', async () =>
      equal((await document.searchPage(1, 'ALPHA', true)).matches.length, 0),
    );
    await check('Multiline match', async () =>
      equal(
        (await document.searchPage(1, 'across two lines')).matches.length,
        1,
      ),
    );
    await check('Empty query and no matches', async () => {
      equal((await document.searchPage(1, '')).matches.length, 0);
      const result = await document.searchPage(1, 'not-in-this-pdf');
      equal(result.matches.length, 0);
      equal(result.hasText, true);
    });
    await check('Thumbnail bounds', async () => {
      for (const page of [1, 2, 3]) {
        const thumbnail = await document.renderThumbnail(page, 160);
        equal(Math.max(thumbnail.width, thumbnail.height), 160);
        equal(thumbnail.uri.startsWith('data:image/png;base64,'), true);
      }
    });
    await check('Invalid page and oversized query', async () => {
      await rejected(() => document.searchPage(0, 'alpha'));
      await rejected(() => document.searchPage(4, 'alpha'));
      await rejected(() => document.searchPage(1, 'a'.repeat(513)));
    });
    await check('Concurrent queries keep their results', async () => {
      const results = await Promise.all(
        Array.from({ length: 30 }, (_, index) =>
          document.searchPage(
            (index % 3) + 1,
            index % 2 ? 'alpha' : 'no-result',
          ),
        ),
      );
      results.forEach((result, index) =>
        equal(result.matches.length, index % 2 ? 2 : 0),
      );
    });
    await check(
      'Close cancels queued work and isolates replacement',
      async () => {
        const closing = await openPdfSearch(uri);
        const pending = Array.from({ length: 24 }, () =>
          closing.renderThumbnail(1, 512),
        );
        const settled = Promise.allSettled(pending);
        closing.close();
        closing.close();
        const replacement = await openPdfSearch(uri);
        try {
          equal((await replacement.searchPage(1, 'alpha')).matches.length, 2);
          equal(
            (await settled).every(result => result.status === 'rejected'),
            true,
          );
          await rejected(() => closing.getPageInfo(1));
        } finally {
          replacement.close();
        }
      },
    );
  } finally {
    document.close();
    releaseFile(uri);
  }
  const fixtureNames: Array<'scan' | 'password' | 'corrupt'> = [
    'scan',
    'password',
    'corrupt',
  ];
  for (const name of fixtureNames) {
    const file = await openFixture(name);
    try {
      await check(`Document ${name}`, async () => {
        if (name === 'corrupt') {
          await rejected(() => openPdfSearch(file));
        } else if (name === 'password') {
          await rejected(() => openPdfSearch(file, 'wrong'));
          const protectedDocument = await openPdfSearch(file, 'reader-test');
          try {
            equal(
              (await protectedDocument.searchPage(1, 'alpha')).matches.length,
              2,
            );
          } finally {
            protectedDocument.close();
          }
        } else {
          const scan = await openPdfSearch(file);
          try {
            equal((await scan.getPageInfo(1)).hasText, false);
            equal((await scan.searchPage(1, 'alpha')).hasText, false);
          } finally {
            scan.close();
          }
        }
      });
    } finally {
      releaseFile(file);
    }
  }
  await check('Remote URI rejected', async () =>
    rejected(() => openPdfSearch('https://invalid.example/test.pdf')),
  );
  await saveQaReport(JSON.stringify({ checks }, null, 2));
  const failures = checks.filter(result => !result.passed);
  return failures.length
    ? `FAIL ${failures.length}/${checks.length}: ${failures.map(result => `${result.name}: ${result.detail}`).join('; ')}`
    : `PASS ${checks.length}/${checks.length}`;
}
