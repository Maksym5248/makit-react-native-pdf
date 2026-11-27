import React, { useEffect, useRef, useState } from 'react';

import {
  PdfReader,
  PdfThumbnails,
  type IPdfSearchDocument,
  type IPdfPageInfo,
  openPdfSearch,
  type IPdfReaderRef,
  type IPdfSearchMatch,
} from '@makit-kit/react-native-pdf';
import {
  ActivityIndicator,
  ScrollView,
  Keyboard,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  useWindowDimensions,
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
  const compact = useWindowDimensions().width < 600;
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
  const [toolbarHeight, setToolbarHeight] = useState(64);
  const [pageControlsHeight, setPageControlsHeight] = useState(64);
  const [panelLayout, setPanelLayout] = useState({ top: 0, bottom: 0 });
  const [viewportHeight, setViewportHeight] = useState(0);
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
    'Choose a local PDF or open the sample',
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
    setStatus('Opening…');
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
              error instanceof Error ? error.message : 'Document error',
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
              error instanceof Error ? error.message : 'Metadata error',
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
      setSearchStatus('Searching…');
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
            `Search ${pageNumber}/${document.pages} · ${found.length} matches`,
          );
          if (found.length >= 2000) break;
        }
        setSearchStatus(
          hasText
            ? `${found.length} matches in ${Math.round(
                performance.now() - started,
              )} ms${limited ? ' (limit reached)' : ''}`
            : 'This PDF has no text layer',
        );
      } catch (error) {
        if (!cancelled)
          setSearchStatus(
            error instanceof Error ? error.message : 'Search error',
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
  const selectedMatch = matches[activeMatch];
  const readerHighlights = matches.filter(match => match.page === page);
  // A viewport can contain parts of two pages. Keep the selected result visible
  // even when the page counter follows the other page, within the native cap.
  if (selectedMatch && !readerHighlights.includes(selectedMatch)) {
    if (readerHighlights.length === 256) readerHighlights.pop();
    readerHighlights.push(selectedMatch);
  }
  const activeHighlightIndex = readerHighlights.indexOf(selectedMatch);
  const fixture = async () => {
    try {
      open(await openFixture());
    } catch (error) {
      setPanel('files');
      setStatus(
        error instanceof Error ? error.message : 'Local file error',
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
        <View
          style={styles.screen}
          onLayout={event => setViewportHeight(event.nativeEvent.layout.height)}
        >
          <View
            onLayout={event =>
              setToolbarHeight(event.nativeEvent.layout.height)
            }
            testID="example.toolbar"
            accessibilityElementsHidden={!toolsVisible}
            importantForAccessibility={
              toolsVisible ? 'auto' : 'no-hide-descendants'
            }
            pointerEvents={toolsVisible ? 'auto' : 'none'}
            style={[styles.toolbar, { opacity: toolsVisible ? 1 : 0 }]}
          >
            <Button title="File" onPress={() => togglePanel('files')} />
            <Button
              title="Search"
              disabled={!uri}
              onPress={() => togglePanel('search')}
            />
            <Button
              title="Pages"
              disabled={!document}
              onPress={() => togglePanel('pages')}
            />
            <Button
              title="View"
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
                  <Text>Opening PDF…</Text>
                </View>
              )}
              highlightContentInsets={{
                top: toolsVisible
                  ? panel === 'search' && !compact
                    ? Math.max(toolbarHeight, panelLayout.bottom) + 12
                    : toolbarHeight + 12
                  : 0,
                bottom: toolsVisible
                  ? panel === 'search' && compact
                    ? Math.max(
                        pageControlsHeight,
                        viewportHeight - panelLayout.top,
                      ) + 12
                    : pageControlsHeight
                  : 0,
              }}
              highlights={readerHighlights}
              activeMatch={activeHighlightIndex}
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
                    `Opened ${count} pages in ${Math.round(
                      performance.now() - openedAt.current,
                    )} ms`,
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
            <View style={[styles.reader, styles.emptyState]}>
              <Text style={styles.eyebrow}>MAKIT · PDF READER</Text>
              <Text style={styles.emptyTitle}>Open a PDF</Text>
              <Text style={styles.emptyDescription}>
                Choose your own document or try the sample PDF. Your file stays on
                your device.
              </Text>
            </View>
          )}
          {uri && (
            <View
              onLayout={event =>
                setPageControlsHeight(event.nativeEvent.layout.height)
              }
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
                title="Previous"
                disabled={page <= 1}
                onPress={() => reader.current?.setPage(page - 1)}
              />
              <Text>
                {page} / {total}
              </Text>
              <Button
                title="Next"
                disabled={page >= total}
                onPress={() => reader.current?.setPage(page + 1)}
              />
            </View>
          )}
          {panel && (
            <View
              testID="example.panel"
              style={[
                styles.panel,
                compact && panel === 'search'
                  ? styles.bottomPanel
                  : styles.topPanel,
              ]}
              onLayout={event =>
                setPanelLayout({
                  top: event.nativeEvent.layout.y,
                  bottom:
                    event.nativeEvent.layout.y +
                    event.nativeEvent.layout.height,
                })
              }
            >
              <View style={styles.panelHeader}>
                <Text style={styles.title}>
                  {
                    {
                      files: 'Open PDF',
                      search: 'Find in document',
                      pages: 'Pages',
                      settings: 'View settings',
                    }[panel]
                  }
                </Text>
                <Button
                  title="Hide"
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
                        <Button title="Sample PDF" onPress={fixture} />
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
                          title="Close"
                          onPress={() => {
                            setUri('');
                            setTotal(0);
                            setStatus('Document closed');
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
                          accessibilityLabel="Search PDF"
                          placeholder="Search for a word"
                          value={query}
                          onChangeText={setQuery}
                          style={styles.query}
                        />
                        <Button
                          title="← Match"
                          disabled={activeMatch <= 0}
                          onPress={() => selectMatch(activeMatch - 1)}
                        />
                        <Text>
                          {activeMatch + 1}/{matches.length}
                        </Text>
                        <Button
                          title="Match →"
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
                        <Text>Single page</Text>
                        <Switch
                          accessibilityLabel="Single page"
                          value={singlePage}
                          onValueChange={setSinglePage}
                        />
                      </View>
                      <View style={styles.controls}>
                        <Text>Horizontal</Text>
                        <Switch
                          accessibilityLabel="Horizontal"
                          value={horizontal}
                          onValueChange={setHorizontal}
                        />
                        <Text>Paging</Text>
                        <Switch
                          accessibilityLabel="Paging"
                          value={paging}
                          onValueChange={setPaging}
                        />
                        <Button
                          title={`Rotation ${rotation}°`}
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
                            fitPolicy === 0 ? 'Fit width' : 'Fit page'
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
                          {Math.round(pageInfo.height)} pt · file rotation{' '}
                          {pageInfo.rotation}° · text layer:{' '}
                          {pageInfo.hasText ? 'yes' : 'no'}
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
  screen: { flex: 1, backgroundColor: '#f2f5f3' },
  emptyState: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
    gap: 16,
  },
  eyebrow: {
    color: '#486950',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
  },
  emptyTitle: {
    fontSize: 34,
    fontWeight: '600',
    color: '#203a2a',
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 16,
    lineHeight: 25,
    maxWidth: 420,
    color: '#536359',
    textAlign: 'center',
  },
  toolbar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
    backgroundColor: '#fafcfb',
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#d5dfd8',
    minHeight: 64,
    alignItems: 'center',
  },
  panel: {
    position: 'absolute',
    left: 16,
    right: 16,
    maxWidth: 620,
    alignSelf: 'center',
    maxHeight: '60%',
    backgroundColor: '#fafcfb',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#d5dfd8',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  topPanel: { top: 84 },
  bottomPanel: { bottom: 80, maxHeight: '45%' },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  panelContent: { padding: 20, gap: 16 },
  title: { fontSize: 22, fontWeight: '600', color: '#203a2a' },
  pageControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fafcfb',
    minHeight: 64,
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
    borderColor: '#9bada1',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  reader: { flex: 1, minHeight: 100 },
});
