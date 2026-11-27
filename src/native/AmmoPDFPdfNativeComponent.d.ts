import type React from "react";
import type {
  HostComponent,
  NativeSyntheticEvent,
  ViewProps,
} from "react-native";

interface NativeProps extends ViewProps {
  path: string;
  highlights: string;
  page: number;
  scale: number;
  minScale: number;
  maxScale: number;
  rotation: number;
  horizontal: boolean;
  enablePaging: boolean;
  enableRTL: boolean;
  enableAnnotationRendering: boolean;
  showsHorizontalScrollIndicator: boolean;
  showsVerticalScrollIndicator: boolean;
  scrollEnabled: boolean;
  enableAntialiasing: boolean;
  enableDoubleTapZoom: boolean;
  fitPolicy: number;
  spacing: number;
  password: string;
  singlePage: boolean;
  onChange: (event: NativeSyntheticEvent<{ message: string }>) => void;
}
declare const NativePdf: HostComponent<NativeProps>;
export declare const Commands: {
  setNativePage(view: React.ElementRef<typeof NativePdf>, page: number): void;
};
export default NativePdf;
