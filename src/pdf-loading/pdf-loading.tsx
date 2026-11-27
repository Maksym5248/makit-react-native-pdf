import React from 'react';

import { ActivityIndicator, StyleSheet, View } from 'react-native';

import type { IPdfReaderProps } from '../pdf-reader.types';

export function PdfLoading({ renderLoading }: Pick<IPdfReaderProps, 'renderLoading'>) {
    return (
        <View style={styles.overlay} testID="pdf.loading" pointerEvents="none">
            {renderLoading ? renderLoading() : <ActivityIndicator size="large" />}
        </View>
    );
}

const styles = StyleSheet.create({
    overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
});
