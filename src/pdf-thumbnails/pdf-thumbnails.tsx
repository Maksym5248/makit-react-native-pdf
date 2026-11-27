import React, { useEffect, useRef, useState } from 'react';

import { Image, Pressable, StyleSheet, Text, VirtualizedList } from 'react-native';
import type { ViewToken } from 'react-native';

import { ThumbnailLoader } from './thumbnail-loader';
import type { IPdfSearchDocument, IPdfThumbnail } from '../search.types';

export interface IPdfThumbnailsProps {
    document: IPdfSearchDocument;
    page: number;
    onPageSelected: (page: number) => void;
    onError?: (error: Error) => void;
}

export function PdfThumbnails({ document, page, onPageSelected, onError }: IPdfThumbnailsProps) {
    const list = useRef<VirtualizedList<number>>(null);
    const loader = useRef<ThumbnailLoader | null>(null);
    const errorCallback = useRef(onError);
    errorCallback.current = onError;
    const [images, setImages] = useState<ReadonlyMap<number, IPdfThumbnail>>(new Map());
    const currentPage = useRef(page);
    currentPage.current = page;
    useEffect(() => {
        const next = new ThumbnailLoader(document, setImages, error => errorCallback.current?.(error));
        loader.current = next;
        next.setPages([currentPage.current, currentPage.current + 1, currentPage.current + 2]);
        return () => {
            loader.current = null;
            next.dispose();
        };
    }, [document]);
    useEffect(() => {
        if (page >= 1 && page <= document.pages) list.current?.scrollToIndex({ index: page - 1, animated: false });
    }, [page, document]);
    const onVisible = useRef(({ viewableItems }: { viewableItems: ViewToken<number>[] }) => {
        loader.current?.setPages(viewableItems.map(item => item.item));
    }).current;
    return (
        <VirtualizedList<number>
            ref={list}
            horizontal
            style={styles.strip}
            data={document}
            getItem={(_, index) => index + 1}
            getItemCount={() => document.pages}
            keyExtractor={item => String(item)}
            getItemLayout={(_, index) => ({ length: 104, offset: index * 104, index })}
            initialScrollIndex={Math.max(0, Math.min(document.pages - 1, page - 1))}
            initialNumToRender={6}
            maxToRenderPerBatch={6}
            windowSize={3}
            onViewableItemsChanged={onVisible}
            viewabilityConfig={{ itemVisiblePercentThreshold: 1 }}
            extraData={{ images, page }}
            renderItem={({ item }) => {
                const thumbnail = images.get(item);
                return (
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Page ${item}`}
                        accessibilityState={{ selected: item === page }}
                        onPress={() => onPageSelected(item)}
                        style={[styles.item, item === page && styles.selected]}
                    >
                        {thumbnail && <Image source={{ uri: thumbnail.uri }} resizeMode="contain" style={styles.image} />}
                        <Text style={styles.number}>{item}</Text>
                    </Pressable>
                );
            }}
        />
    );
}
const styles = StyleSheet.create({
    strip: { flexGrow: 0, height: 130 },
    item: { width: 100, height: 124, marginRight: 4, borderWidth: 2, borderColor: '#ddd', backgroundColor: '#eee' },
    selected: { borderColor: '#1565c0' },
    image: { width: 96, height: 100 },
    number: { position: 'absolute', bottom: 2, alignSelf: 'center', color: '#111' },
});
