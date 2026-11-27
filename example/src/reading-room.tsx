import React, { useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {
  PdfReader,
  PdfThumbnails,
  openPdfSearch,
  type IPdfReaderRef,
  type IPdfSearchDocument,
  type IPdfSearchMatch,
} from '@makit-kit/react-native-pdf';

export interface ReaderFile {
  uri: string;
  name: string;
}

interface Props {
  loadGuide: () => Promise<ReaderFile>;
  chooseFile: () => Promise<ReaderFile | undefined>;
  releaseFile?: (uri: string) => void;
}

function Control({
  label,
  onPress,
  disabled,
  selected,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  selected?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.control,
        selected && styles.selected,
        (pressed || disabled) && styles.dim,
      ]}
    >
      <Text style={styles.controlText}>{label}</Text>
    </Pressable>
  );
}

export function ReadingRoom({ loadGuide, chooseFile, releaseFile }: Props) {
  const reader = useRef<IPdfReaderRef>(null);
  const [file, setFile] = useState<ReaderFile>();
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [panel, setPanel] = useState<'search' | 'pages'>();
  const [session, setSession] = useState<IPdfSearchDocument>();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<IPdfSearchMatch[]>([]);
  const [active, setActive] = useState(0);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [focused, setFocused] = useState(false);
  const showError = (reason: unknown) =>
    setError(reason instanceof Error ? reason.message : String(reason));

  useEffect(() => {
    let live = true;
    loadGuide()
      .then(guide => {
        if (live) setFile(guide);
        else releaseFile?.(guide.uri);
      })
      .catch(reason => {
        if (live) showError(reason);
      });
    return () => {
      live = false;
    };
  }, [loadGuide, releaseFile]);
  useEffect(() => {
    if (!file) return;
    let live = true;
    let opened: IPdfSearchDocument | undefined;
    openPdfSearch(file.uri)
      .then(doc => {
        if (!live) {
          doc.close();
          return;
        }
        opened = doc;
        setSession(doc);
      })
      .catch(reason => {
        if (live) showError(reason);
      });
    return () => {
      live = false;
      opened?.close();
      releaseFile?.(file.uri);
    };
  }, [file, releaseFile]);
  useEffect(() => {
    setResults([]);
    setActive(0);
    const term = query.trim();
    if (!term || !session) {
      setSearching(false);
      return;
    }
    let live = true;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const found: IPdfSearchMatch[] = [];
        for (let n = 1; n <= session.pages && live; n++) {
          const result = await session.searchPage(n, term);
          found.push(...result.matches);
          if (found.length >= 256) break;
        }
        if (live) {
          setResults(found.slice(0, 256));
          if (found.length) reader.current?.setPage(found[0].page);
        }
      } catch (reason) {
        if (live) showError(reason);
      } finally {
        if (live) setSearching(false);
      }
    }, 180);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [session, query]);

  const replaceFile = async () => {
    try {
      const next = await chooseFile();
      if (!next) return;
      setPanel(undefined);
      setQuery('');
      setResults([]);
      setSession(undefined);
      setError('');
      setCount(0);
      setPage(1);
      setFile(next);
    } catch (reason) {
      showError(reason);
    }
  };
  const select = (index: number) => {
    Keyboard.dismiss();
    setActive(index);
    reader.current?.setPage(results[index].page);
  };
  const toggle = (next: 'search' | 'pages') => {
    Keyboard.dismiss();
    setPanel(panel === next ? undefined : next);
  };
  const visible = results.filter(
    match => match.page === page || match === results[active],
  );
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.screen}>
        {!focused && (
          <View style={styles.header}>
            <View style={styles.bookTitle}>
              <Text style={styles.imprint}>MAKIT READER</Text>
              <Text style={styles.title} numberOfLines={1}>
                {file?.name || 'Opening document…'}
              </Text>
            </View>
            <Control
              label="Open PDF"
              onPress={replaceFile}
              disabled={!file && !error}
            />
          </View>
        )}
        {!focused && panel === 'search' && (
          <View style={styles.drawer}>
            <TextInput
              accessibilityLabel="Find in document"
              placeholder="Find in document"
              returnKeyType="search"
              value={query}
              onChangeText={setQuery}
              style={styles.input}
            />
            {query.trim() !== '' && (
              <View style={styles.row}>
                <Text accessibilityLiveRegion="polite" style={styles.note}>
                  {searching
                    ? 'Searching…'
                    : results.length
                    ? active +
                      1 +
                      ' of ' +
                      results.length +
                      (results.length === 256 ? '+' : '')
                    : 'No matches'}
                </Text>
                <Control
                  label="Previous match"
                  disabled={!results.length || active === 0}
                  onPress={() => select(active - 1)}
                />
                <Control
                  label="Next match"
                  disabled={active + 1 >= results.length}
                  onPress={() => select(active + 1)}
                />
              </View>
            )}
          </View>
        )}
        {!focused && panel === 'pages' && session && (
          <View style={styles.thumbs}>
            <PdfThumbnails
              document={session}
              page={page}
              onError={showError}
              onPageSelected={n => {
                reader.current?.setPage(n);
                setPanel(undefined);
              }}
            />
          </View>
        )}
        <View style={styles.desk}>
          {file && (
            <PdfReader
              key={file.uri}
              ref={reader}
              sourceUri={file.uri}
              style={styles.paper}
              fitPolicy={2}
              spacing={16}
              highlights={visible}
              activeMatch={visible.indexOf(results[active])}
              onPageSingleTap={() => {
                Keyboard.dismiss();
                setPanel(undefined);
                setFocused(value => !value);
              }}
              onLoadComplete={setCount}
              onPageChanged={(n, total) => {
                setPage(n);
                setCount(total);
              }}
              onError={showError}
            />
          )}
        </View>
        {error !== '' && (
          <Text accessibilityLiveRegion="polite" style={styles.note}>
            {error}
          </Text>
        )}
        {!focused && (
          <View style={styles.footer}>
            <View style={styles.progress}>
              <View
                style={[
                  styles.track,
                  { width: count ? `${(100 * page) / count}%` : '0%' },
                ]}
              />
            </View>
            <View style={styles.row}>
              <Control
                label="Pages"
                disabled={!session}
                selected={panel === 'pages'}
                onPress={() => toggle('pages')}
              />
              <Control
                label="Previous"
                disabled={page <= 1}
                onPress={() => reader.current?.setPage(page - 1)}
              />
              <Text style={styles.note}>
                {page} / {count || '…'}
              </Text>
              <Control
                label="Next"
                disabled={page >= count}
                onPress={() => reader.current?.setPage(page + 1)}
              />
              <Control
                label="Find"
                selected={panel === 'search'}
                disabled={!session}
                onPress={() => toggle('search')}
              />
            </View>
          </View>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fbfaf5' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#d6ded5',
  },
  bookTitle: { flex: 1, minWidth: 0 },
  imprint: {
    fontSize: 10,
    letterSpacing: 1.8,
    fontWeight: '700',
    color: '#527066',
  },
  title: { fontSize: 20, fontWeight: '600', color: '#173b35' },
  control: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 9,
    borderRadius: 8,
  },
  selected: { backgroundColor: '#dceae2' },
  dim: { opacity: 0.45 },
  controlText: { color: '#245345', fontSize: 14, fontWeight: '600' },
  desk: {
    flex: 1,
    backgroundColor: '#e2e8e2',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  paper: { flex: 1, width: '100%', maxWidth: 820, backgroundColor: '#e2e8e2' },
  footer: { backgroundColor: '#fbfaf5' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    flexWrap: 'wrap',
  },
  progress: { height: 3, backgroundColor: '#d9e1da' },
  track: { height: 3, backgroundColor: '#47735e' },
  drawer: { paddingHorizontal: 12, paddingTop: 6, backgroundColor: '#fbfaf5' },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#9daf9f',
    borderRadius: 8,
    paddingHorizontal: 12,
    minHeight: 40,
    color: '#18382f',
  },
  note: { fontSize: 13, color: '#405c51', textAlign: 'center' },
  thumbs: { height: 136, backgroundColor: '#edf1ec' },
});
