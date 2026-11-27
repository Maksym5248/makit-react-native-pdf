import { openPdfSearch } from '@maksym5248/react-native-pdf-reader';

import { saveQaReport } from './local-file';

// Records timings only. Private document content and file paths never enter reports.
export async function benchmarkDocument(
  uri: string,
  onProgress: (status: string) => void,
) {
  const samples: Array<{
    pages: number;
    openMs: number;
    metadataMs: number;
    thumbnailsMs: number;
    searchMs: number;
    textPages: number;
    firstMatchMs: number | null;
    firstMatchPage: number | null;
  }> = [];
  for (let run = 1; run <= 3; run++) {
    onProgress(`Benchmark ${run}/3: open`);
    const start = performance.now();
    const document = await openPdfSearch(uri);
    const openMs = performance.now() - start;
    try {
      const selected = [
        ...new Set([1, Math.ceil(document.pages / 2), document.pages]),
      ];
      const metadataStart = performance.now();
      for (const page of selected) await document.getPageInfo(page);
      const metadataMs = performance.now() - metadataStart;
      const thumbnailsStart = performance.now();
      for (const page of selected) await document.renderThumbnail(page, 160);
      const thumbnailsMs = performance.now() - thumbnailsStart;
      const firstMatchStart = performance.now();
      let firstMatchMs: number | null = null;
      let firstMatchPage: number | null = null;
      for (let page = 1; page <= document.pages; page++) {
        const result = await document.searchPage(page, 'а');
        if (result.matches.length) {
          firstMatchMs = performance.now() - firstMatchStart;
          firstMatchPage = page;
          break;
        }
      }
      const searchStart = performance.now();
      let textPages = 0;
      for (let page = 1; page <= document.pages; page++) {
        const result = await document.searchPage(
          page,
          'pdf-benchmark-no-match-4297',
        );
        if (result.hasText) textPages++;
        if (page % 100 === 0)
          onProgress(`Benchmark ${run}/3: search ${page}/${document.pages}`);
      }
      samples.push({
        pages: document.pages,
        openMs,
        metadataMs,
        thumbnailsMs,
        searchMs: performance.now() - searchStart,
        textPages,
        firstMatchMs,
        firstMatchPage,
      });
    } finally {
      document.close();
    }
  }
  await saveQaReport(
    JSON.stringify({ mode: 'native-api-debug', samples }, null, 2),
    'pdf-benchmark-report.json',
  );
  return `Benchmark complete: ${samples[0].pages} pages; search ms: ${samples.map(sample => Math.round(sample.searchMs)).join(', ')}`;
}
