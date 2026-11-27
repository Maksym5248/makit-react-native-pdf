import React, { useEffect, useRef, useState } from 'react';

import {
  PdfReader,
  openPdfSearch,
  type IPdfReaderProps,
  type IPdfReaderRef,
} from '@makit-kit/react-native-pdf';
import { Text, View } from 'react-native';

import { Button } from './button';
import { openFixture, saveQaReport } from './local-file';

interface Frame extends IPdfReaderProps {
  revision: number;
}

// Run against the real native view. Callback assertions cannot be replaced by JS mocks.
export function RendererChecks({ onClose }: { onClose: () => void }) {
  const reader = useRef<IPdfReaderRef>(null);
  const [frame, setFrame] = useState<Frame>();
  const [status, setStatus] = useState('Starting renderer checks');
  useEffect(() => {
    let cancelled = false;
    let revision = 0;
    const checks: Array<{ name: string; passed: boolean; detail: string }> = [];
    let lastPage = 0;
    let total = 0;
    let loads = 0;
    let errors = 0;
    const waitFor = async (condition: () => boolean, step = '') => {
      const deadline = Date.now() + 10000;
      while (!condition()) {
        if (cancelled) throw new Error('Cancelled');
        if (Date.now() > deadline)
          throw new Error(
            `Timeout ${step}: page=${lastPage}, total=${total}, loads=${loads}, errors=${errors}`,
          );
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    };
    const check = async (name: string, run: () => Promise<void>) => {
      setStatus(name);
      try {
        await run();
        checks.push({ name, passed: true, detail: '' });
      } catch (error) {
        checks.push({ name, passed: false, detail: String(error) });
      }
    };
    const mount = (sourceUri: string, props: Partial<IPdfReaderProps> = {}) => {
      lastPage = 0;
      total = 0;
      loads = 0;
      errors = 0;
      setFrame({
        sourceUri,
        revision: ++revision,
        ...props,
        onLoadComplete: count => {
          total = count;
          loads++;
        },
        onPageChanged: page => {
          lastPage = page;
        },
        onError: () => {
          errors++;
        },
      });
    };
    const run = async () => {
      const uri = await openFixture();
      await check('Initial page and imperative navigation', async () => {
        mount(uri, { page: 2 });
        await waitFor(() => loads > 0 && lastPage === 2 && total === 3);
        reader.current?.setPage(3);
        await waitFor(() => lastPage === 3);
        reader.current?.setPage(1);
        await waitFor(() => lastPage === 1);
      });
      await check(
        'Search highlight survives zoom, rotation and viewport resize',
        async () => {
          const document = await openPdfSearch(uri);
          try {
            const result = await document.searchPage(1, 'alpha');
            if (!result.matches.length)
              throw new Error('Fixture has no alpha match');
            mount(uri, {
              highlights: result.matches,
              activeMatch: 0,
              scale: 1.2,
            });
            await waitFor(() => loads > 0 && lastPage === 1);
            const rotations: Array<0 | 90 | 180 | 270> = [90, 180, 270, 0];
            for (const rotation of rotations) {
              setFrame(
                current =>
                  current && {
                    ...current,
                    rotation,
                    style: { width: rotation % 180 ? 390 : 320, height: 400 },
                    highlightContentInsets: {
                      top: 80,
                      bottom: 40,
                      left: 16,
                      right: 16,
                    },
                  },
              );
              // Rotation/viewport changes keep the same document open. They do not
              // promise another onLoadComplete callback; verify navigation instead.
              await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
              reader.current?.setPage(2);
              await waitFor(() => lastPage === 2, `rotation ${rotation}, page 2`);
              reader.current?.setPage(1);
              await waitFor(() => lastPage === 1, `rotation ${rotation}, page 1`);
            }
            reader.current?.setPage(2);
            await waitFor(() => lastPage === 2);
          } finally {
            document.close();
          }
        },
      );
      await check(
        'Empty highlight range does not corrupt scroll geometry',
        async () => {
          mount(uri, {
            highlights: [{ page: 1, start: 0, length: 0, text: '', rects: [] }],
            activeMatch: 0,
          });
          await waitFor(() => loads > 0 && lastPage === 1);
          reader.current?.setPage(3);
          await waitFor(() => lastPage === 3);
          if (errors) throw new Error('Renderer reported an error');
        },
      );
      await check('Single page preserves document numbering', async () => {
        mount(uri, { page: 2, singlePage: true });
        await waitFor(() => loads > 0 && lastPage === 2 && total === 3);
        reader.current?.setPage(3);
        await waitFor(() => lastPage === 3);
      });
      await check('RTL uses document page numbers', async () => {
        mount(uri, { page: 2, horizontal: true, enableRTL: true });
        await waitFor(() => loads > 0 && lastPage === 2 && total === 3);
        reader.current?.setPage(1);
        await waitFor(() => lastPage === 1);
        reader.current?.setPage(3);
        await waitFor(() => lastPage === 3);
      });
      await check('RTL protected document', async () => {
        mount(await openFixture('password'), {
          page: 3,
          horizontal: true,
          enableRTL: true,
          password: 'reader-test',
        });
        await waitFor(() => loads > 0 && lastPage === 3 && total === 3);
        reader.current?.setPage(1);
        await waitFor(() => lastPage === 1);
      });
      await check('Password retry without remount', async () => {
        mount(await openFixture('password'), { password: 'wrong' });
        await waitFor(() => errors > 0);
        setFrame(current => current && { ...current, password: 'reader-test' });
        await waitFor(() => loads > 0 && total === 3);
      });
      await check('Corrupt document reports an error', async () => {
        mount(await openFixture('corrupt'));
        await waitFor(() => errors > 0);
      });
      await check('Replacement after error renders normally', async () => {
        mount(uri);
        await waitFor(() => loads > 0 && lastPage === 1 && total === 3);
      });
      await check('Rapid replacement during bitmap rendering', async () => {
        for (let index = 0; index < 12; index++) {
          const page = (index % 3) + 1;
          mount(uri, { page, rotation: index % 2 ? 90 : 0 });
          try {
            await waitFor(() => loads > 0 && lastPage === page && total === 3);
          } catch (error) {
            throw new Error(
              `Replacement ${index + 1}, expected page ${page}: ${String(
                error,
              )}`,
            );
          }
        }
      });
      if (cancelled) return;
      await saveQaReport(
        JSON.stringify({ checks }, null, 2),
        'pdf-renderer-report.json',
      );
      setStatus(
        `${checks.every(check => check.passed) ? 'PASS' : 'FAIL'} ${
          checks.filter(check => check.passed).length
        }/${checks.length}: ${checks
          .filter(check => !check.passed)
          .map(check => `${check.name}: ${check.detail}`)
          .join('; ')}`,
      );
    };
    void run().catch(error => {
      if (!cancelled) setStatus(String(error));
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return (
    <View style={{ flex: 1 }}>
      <Text accessibilityLiveRegion="polite">{status}</Text>
      <Button title="Close renderer checks" onPress={onClose} />
      {frame && (
        <PdfReader
          {...frame}
          key={frame.revision}
          ref={reader}
          style={frame.style ?? { flex: 1 }}
        />
      )}
    </View>
  );
}
