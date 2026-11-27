import React, { useEffect, useRef, useState } from 'react';

import {
  PdfReader,
  PdfThumbnails,
  type IPdfSearchDocument,
  type IPdfPageInfo,
  openPdfSearch,
  type IPdfReaderRef,
  type IPdfSearchMatch,
} from '@maksym5248/react-native-pdf-reader';
import {
  ActivityIndicator,
  ScrollView,
  Keyboard,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { benchmarkDocument } from './benchmark';
import { Button } from './button';
import { FilePicker } from './file-picker';
import { openFixture, releaseFile } from './local-file';
import { runPdfChecks } from './qa';
import { RenderBenchmark } from './render-benchmark';
import { RendererChecks } from './renderer-checks';

export function App() {
  const [renderBenchmark, setRenderBenchmark] = useState(false);
  const [rendererChecks, setRendererChecks] = useState(false);
  const [qaRunning, setQaRunning] = useState(false);
  const runChecks = async () => {
    setQaRunning(true);
    try {
      setStatus(await runPdfChecks(setStatus));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setQaRunning(false);
    }
  };
  const [panel, setPanel] = useState<
    'files' | 'search' | 'pages' | 'settings' | null
  >('files');
  const togglePanel = (next: 'files' | 'search' | 'pages' | 'settings') => {
    Keyboard.dismiss();
    setPanel(current => (current === next ? null : next));
  };
  const [toolsVisible, setToolsVisible] = useState(true);
  const reader = useRef<IPdfReaderRef>(null);
  const [document, setDocument] = useState<IPdfSearchDocument>();
  const [pageInfo, setPageInfo] = useState<IPdfPageInfo>();
  const [horizontal, setHorizontal] = useState(false);
  const [paging, setPaging] = useState(false);
  const [rotation, setRotation] = useState<0 | 90 | 180 | 270>(0);
  const [fitPolicy, setFitPolicy] = useState<0 | 2>(0);
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<IPdfSearchMatch[]>([]);
  const [activeMatch, setActiveMatch] = useState(-1);
  const [searchStatus, setSearchStatus] = useState('');
  const [revision, setRevision] = useState(0);
  const [uri, setUri] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [scale, setScale] = useState(1);
  const [reportedScale, setReportedScale] = useState(1);
  const [singlePage, setSinglePage] = useState(false);
  const [status, setStatus] = useState(
    'Виберіть локальний PDF або тестовий файл',
  );
  const openedAt = useRef<number | undefined>(undefined);
  useEffect(
    () => () => {
      if (uri) releaseFile(uri);
    },
    [uri],
  );
  const open = (next: string) => {
    setRevision(value => value + 1);
    setPage(1);
    setTotal(0);
    setStatus('Відкриття…');
    openedAt.current = performance.now();
    setUri(next);
    setPanel(null);
    Keyboard.dismiss();
  };
  useEffect(() => {
    let cancelled = false;
    let opened: IPdfSearchDocument | undefined;
    setDocument(undefined);
    if (uri) {
      void openPdfSearch(uri)
        .then(result => {
          if (cancelled) result.close();
          else {
            opened = result;
            setDocument(result);
          }
        })
        .catch(error => {
          if (!cancelled)
            setStatus(
              error instanceof Error ? error.message : 'Помилка документа',
            );
        });
    }
    return () => {
      cancelled = true;
      opened?.close();
    };
  }, [uri, revision]);
  useEffect(() => {
    let cancelled = false;
    setPageInfo(undefined);
    if (document)
      void document
        .getPageInfo(page)
        .then(info => {
          if (!cancelled) setPageInfo(info);
        })
        .catch(error => {
          if (!cancelled)
            setStatus(
              error instanceof Error ? error.message : 'Помилка метаданих',
            );
        });
    return () => {
      cancelled = true;
    };
  }, [document, page]);
  useEffect(() => {
    let cancelled = false;
    setMatches([]);
    setActiveMatch(-1);
    setSearchStatus('');
    if (!document || !query.trim()) return;
    const timer = setTimeout(async () => {
      const started = performance.now();
      setSearchStatus('Пошук…');
      try {
        let found: IPdfSearchMatch[] = [];
        let hasText = false;
        let limited = false;
        for (let pageNumber = 1; pageNumber <= document.pages; pageNumber++) {
          if (cancelled) return;
          const result = await document.searchPage(pageNumber, query);
          if (cancelled) return;
          found = [...found, ...result.matches].slice(0, 2000);
          hasText = hasText || result.hasText;
          limited = limited || result.truncated || found.length >= 2000;
          setMatches(found);
          setSearchStatus(
            `Пошук ${pageNumber}/${document.pages} · ${found.length} збігів`,
          );
          if (found.length >= 2000) break;
        }
        setSearchStatus(
          hasText
            ? `${found.length} збігів за ${Math.round(
                performance.now() - started,
              )} мс${limited ? ' (досягнуто ліміт)' : ''}`
            : 'Документ не має текстового шару',
        );
      } catch (error) {
        if (!cancelled)
          setSearchStatus(
            error instanceof Error ? error.message : 'Помилка пошуку',
          );
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [document, query]);
  const selectMatch = (index: number) => {
    const match = matches[index];
    if (!match) return;
    setActiveMatch(index);
    reader.current?.setPage(match.page);
  };
  const pageMatches = matches.filter(match => match.page === page);
  const activePageMatch = pageMatches.indexOf(matches[activeMatch]);
  const fixture = async () => {
    try {
      open(await openFixture());
    } catch (error) {
      setPanel('files');
      setStatus(
        error instanceof Error ? error.message : 'Помилка локального файла',
      );
    }
  };
  if (renderBenchmark)
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.screen}>
          <RenderBenchmark
            uri={uri}
            onClose={() => setRenderBenchmark(false)}
          />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  if (rendererChecks)
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.screen}>
          <RendererChecks onClose={() => setRendererChecks(false)} />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.screen}>
        <View style={styles.screen}>
          <View
            testID="example.toolbar"
            accessibilityElementsHidden={!toolsVisible}
            importantForAccessibility={
              toolsVisible ? 'auto' : 'no-hide-descendants'
            }
            pointerEvents={toolsVisible ? 'auto' : 'none'}
            style={[styles.toolbar, { opacity: toolsVisible ? 1 : 0 }]}
          >
            <Button title="Файл" onPress={() => togglePanel('files')} />
            <Button
              title="Пошук"
              disabled={!uri}
              onPress={() => togglePanel('search')}
            />
            <Button
              title="Сторінки"
              disabled={!document}
              onPress={() => togglePanel('pages')}
            />
            <Button
              title="Вигляд"
              disabled={!uri}
              onPress={() => togglePanel('settings')}
            />
          </View>
          {uri ? (
            <PdfReader
              key={`${uri}:${revision}`}
              ref={reader}
              sourceUri={uri}
              renderLoading={() => (
                <View>
                  <ActivityIndicator size="large" />
                  <Text>Відкриваємо PDF…</Text>
                </View>
              )}
              highlights={pageMatches}
              activeMatch={activePageMatch}
              scale={scale}
              onScaleChanged={setReportedScale}
              onPageSingleTap={current => {
                setStatus(`Tap page ${current}`);
                if (!panel) setToolsVisible(value => !value);
              }}
              onPressLink={url => setStatus(`Link: ${url}`)}
              singlePage={singlePage}
              horizontal={horizontal}
              enablePaging={paging}
              rotation={rotation}
              fitPolicy={fitPolicy}
              onPageChanged={(current, count) => {
                setPage(current);
                setTotal(count);
              }}
              onLoadComplete={count => {
                setTotal(count);
                if (openedAt.current !== undefined) {
                  setStatus(
                    `Відкрито ${count} стор. за ${Math.round(
                      performance.now() - openedAt.current,
                    )} мс`,
                  );
                  openedAt.current = undefined;
                }
              }}
              onError={error => {
                setStatus(error.message);
                setPanel('settings');
              }}
              style={styles.reader}
            />
          ) : (
            <View style={styles.reader} />
          )}
          {uri && (
            <View
              testID="example.page-controls"
              accessibilityElementsHidden={!toolsVisible}
              importantForAccessibility={
                toolsVisible ? 'auto' : 'no-hide-descendants'
              }
              pointerEvents={toolsVisible ? 'auto' : 'none'}
              style={[
                styles.controls,
                styles.pageControls,
                { opacity: toolsVisible ? 1 : 0 },
              ]}
            >
              <Button
                title="Попередня"
                disabled={page <= 1}
                onPress={() => reader.current?.setPage(page - 1)}
              />
              <Text>
                {page} / {total}
              </Text>
              <Button
                title="Наступна"
                disabled={page >= total}
                onPress={() => reader.current?.setPage(page + 1)}
              />
            </View>
          )}
          {panel && (
            <View style={styles.panel}>
              <View style={styles.panelHeader}>
                <Text style={styles.title}>
                  {
                    {
                      files: 'Відкрити PDF',
                      search: 'Пошук у книзі',
                      pages: 'Сторінки',
                      settings: 'Вигляд і дані',
                    }[panel]
                  }
                </Text>
                <Button
                  title="Сховати"
                  onPress={() => {
                    Keyboard.dismiss();
                    setPanel(null);
                  }}
                />
              </View>
              {panel === 'pages' ? (
                <>
                  {document && (
                    <PdfThumbnails
                      key={revision}
                      document={document}
                      page={page}
                      onPageSelected={selected => {
                        reader.current?.setPage(selected);
                        setPanel(null);
                      }}
                      onError={error => {
                        setStatus(error.message);
                        setPanel('settings');
                      }}
                    />
                  )}
                </>
              ) : (
                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={styles.panelContent}
                >
                  {panel === 'files' && (
                    <>
                      <View style={styles.controls}>
                        <Button
                          title="Run renderer checks"
                          onPress={() => setRendererChecks(true)}
                        />
                        <Button title="Тестовий PDF" onPress={fixture} />
                        <Button
                          title="Compare renderers"
                          disabled={!uri || qaRunning}
                          onPress={() => setRenderBenchmark(true)}
                        />
                        <Button
                          title="Benchmark current PDF"
                          disabled={!uri || qaRunning}
                          onPress={async () => {
                            setQaRunning(true);
                            try {
                              setStatus(
                                await benchmarkDocument(uri, setStatus),
                              );
                            } catch (error) {
                              setStatus(String(error));
                            } finally {
                              setQaRunning(false);
                            }
                          }}
                        />
                        <Button
                          title="Run API checks"
                          disabled={qaRunning}
                          onPress={runChecks}
                        />
                        <Button
                          title="Закрити"
                          onPress={() => {
                            setUri('');
                            setTotal(0);
                            setStatus('Документ закрито');
                          }}
                        />
                        <FilePicker onOpen={open} />
                      </View>
                      <Text accessibilityLiveRegion="polite">{status}</Text>
                    </>
                  )}
                  {panel === 'search' && (
                    <>
                      <View style={styles.controls}>
                        <TextInput
                          accessibilityLabel="Пошук у PDF"
                          placeholder="Пошук: alpha або книга"
                          value={query}
                          onChangeText={setQuery}
                          style={styles.query}
                        />
                        <Button
                          title="← Збіг"
                          disabled={activeMatch <= 0}
                          onPress={() => selectMatch(activeMatch - 1)}
                        />
                        <Text>
                          {activeMatch + 1}/{matches.length}
                        </Text>
                        <Button
                          title="Збіг →"
                          disabled={activeMatch + 1 >= matches.length}
                          onPress={() => selectMatch(activeMatch + 1)}
                        />
                      </View>
                      <Text accessibilityLiveRegion="polite">
                        {searchStatus}
                      </Text>
                    </>
                  )}
                  {panel === 'settings' && (
                    <>
                      <View style={styles.controls}>
                        <Button
                          title="−"
                          onPress={() =>
                            setScale(value => Math.max(0.6, value - 0.2))
                          }
                        />
                        <Text>{Math.round(reportedScale * 100)}%</Text>
                        <Button
                          title="+"
                          onPress={() =>
                            setScale(value => Math.min(3, value + 0.2))
                          }
                        />
                        <Text>Одна сторінка</Text>
                        <Switch
                          accessibilityLabel="Single page"
                          value={singlePage}
                          onValueChange={setSinglePage}
                        />
                      </View>
                      <View style={styles.controls}>
                        <Text>Горизонтально</Text>
                        <Switch
                          accessibilityLabel="Horizontal"
                          value={horizontal}
                          onValueChange={setHorizontal}
                        />
                        <Text>Посторінково</Text>
                        <Switch
                          accessibilityLabel="Paging"
                          value={paging}
                          onValueChange={setPaging}
                        />
                        <Button
                          title={`Поворот ${rotation}°`}
                          onPress={() =>
                            setRotation(value => {
                              if (value === 0) return 90;
                              if (value === 90) return 180;
                              if (value === 180) return 270;
                              return 0;
                            })
                          }
                        />
                        <Button
                          title={
                            fitPolicy === 0 ? 'За шириною' : 'Уся сторінка'
                          }
                          onPress={() => {
                            setFitPolicy(value => (value === 0 ? 2 : 0));
                            setScale(1);
                          }}
                        />
                      </View>
                      <Text accessibilityLiveRegion="polite">{status}</Text>
                      {pageInfo && (
                        <Text>
                          {Math.round(pageInfo.width)} ×{' '}
                          {Math.round(pageInfo.height)} pt · поворот файла{' '}
                          {pageInfo.rotation}° · текстовий шар:{' '}
                          {pageInfo.hasText ? 'так' : 'ні'}
                        </Text>
                      )}
                    </>
                  )}
                </ScrollView>
              )}
            </View>
          )}
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  toolbar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#ddd',
    minHeight: 48,
    alignItems: 'center',
  },
  panel: {
    position: 'absolute',
    top: 100,
    left: 12,
    right: 12,
    maxHeight: '60%',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 8,
  },
  panelContent: { padding: 12, gap: 12 },
  title: { fontSize: 22, fontWeight: '600' },
  pageControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    minHeight: 48,
  },
  controls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
  },
  query: {
    minWidth: 200,
    borderWidth: 1,
    borderColor: '#777',
    borderRadius: 6,
    padding: 8,
  },
  reader: { flex: 1, minHeight: 100 },
});
