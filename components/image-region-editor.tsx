import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  getContainedImageFrame,
  moveNormalizedImageRegion,
  resizeNormalizedImageRegion,
  type ImageDisplayFrame,
  type ImageRegionCorner,
  type NormalizedImageRegion,
} from '@/utils/image-region';


type ImageRegionEditorProps = {
  visible: boolean;
  image: {
    uri: string;
    width: number;
    height: number;
  };
  initialRegions: NormalizedImageRegion[];
  onCancel: () => void;
  onConfirm: (regions: NormalizedImageRegion[]) => void;
};


type ViewportTransform = {
  scale: number;
  translateX: number;
  translateY: number;
};


type EditableRegionOverlayProps = {
  index: number;
  region: NormalizedImageRegion;
  imageFrame: ImageDisplayFrame;
  scale: number;
  selected: boolean;
  color: string;
  onSelect: (index: number) => void;
  onChange: (
    index: number,
    region: NormalizedImageRegion
  ) => void;
};


const maximumRegionCount = 5;
const regionColors = [
  '#2477d4',
  '#d45b24',
  '#248a57',
  '#8b4bc1',
  '#b48a13',
];


const initialViewportTransform: ViewportTransform = {
  scale: 1,
  translateX: 0,
  translateY: 0,
};


const clamp = (
  value: number,
  minimum: number,
  maximum: number
) => Math.min(Math.max(value, minimum), maximum);


const createDefaultRegion = (
  index: number
): NormalizedImageRegion => {
  const height = 0.24;

  return {
    x: 0.08,
    y: clamp(0.08 + index * 0.13, 0, 1 - height),
    width: 0.84,
    height,
  };
};


const clampViewportTranslation = (
  transform: ViewportTransform,
  imageWidth: number,
  imageHeight: number
): ViewportTransform => {
  const maximumX = imageWidth * (transform.scale - 1) / 2;
  const maximumY = imageHeight * (transform.scale - 1) / 2;

  return {
    ...transform,
    translateX: clamp(
      transform.translateX,
      -maximumX,
      maximumX
    ),
    translateY: clamp(
      transform.translateY,
      -maximumY,
      maximumY
    ),
  };
};


function EditableRegionOverlay({
  index,
  region,
  imageFrame,
  scale,
  selected,
  color,
  onSelect,
  onChange,
}: EditableRegionOverlayProps) {
  const regionRef = useRef(region);
  const regionAtGestureStart = useRef(region);


  useEffect(() => {
    regionRef.current = region;
  }, [region]);


  const moveGesture = useMemo(() => Gesture.Pan()
    .maxPointers(1)
    .runOnJS(true)
    .onBegin(() => {
      onSelect(index);
      regionAtGestureStart.current = regionRef.current;
    })
    .onUpdate((event) => {
      onChange(index, moveNormalizedImageRegion(
        regionAtGestureStart.current,
        event.translationX / (imageFrame.width * scale),
        event.translationY / (imageFrame.height * scale)
      ));
    }),
  [imageFrame.height, imageFrame.width, index, onChange, onSelect, scale]);
  const tapGesture = useMemo(() => Gesture.Tap()
    .runOnJS(true)
    .onEnd(() => onSelect(index)),
  [index, onSelect]);
  const selectionGesture = useMemo(
    () => Gesture.Simultaneous(tapGesture, moveGesture),
    [moveGesture, tapGesture]
  );
  const resizeGestures = useMemo(() => {
    const createGesture = (corner: ImageRegionCorner) =>
      Gesture.Pan()
        .maxPointers(1)
        .runOnJS(true)
        .onBegin(() => {
          onSelect(index);
          regionAtGestureStart.current = regionRef.current;
        })
        .onUpdate((event) => {
          onChange(index, resizeNormalizedImageRegion(
            regionAtGestureStart.current,
            corner,
            event.translationX / (imageFrame.width * scale),
            event.translationY / (imageFrame.height * scale)
          ));
        });

    return {
      topLeft: createGesture('topLeft'),
      topRight: createGesture('topRight'),
      bottomLeft: createGesture('bottomLeft'),
      bottomRight: createGesture('bottomRight'),
    };
  }, [imageFrame.height, imageFrame.width, index, onChange, onSelect, scale]);
  const frame = {
    left: imageFrame.width * region.x,
    top: imageFrame.height * region.y,
    width: imageFrame.width * region.width,
    height: imageFrame.height * region.height,
  };
  const handleSize = 34 / scale;
  const handleOffset = handleSize / 2;


  const renderResizeHandle = (
    corner: ImageRegionCorner,
    left: number,
    top: number
  ) => (
    <GestureDetector gesture={resizeGestures[corner]}>
      <View
        style={[
          styles.resizeHandle,
          {
            left: left - handleOffset,
            top: top - handleOffset,
            width: handleSize,
            height: handleSize,
            borderRadius: handleSize / 2,
            borderWidth: 3 / scale,
            borderColor: color,
          },
        ]}
      />
    </GestureDetector>
  );


  return (
    <>
      <GestureDetector gesture={selectionGesture}>
        <View
          style={[
            styles.selection,
            frame,
            {
              borderWidth: (selected ? 4 : 2) / scale,
              borderColor: color,
              backgroundColor: selected
                ? `${color}33`
                : `${color}1f`,
              zIndex: selected ? 3 : 1,
            },
          ]}
        >
          <View
            pointerEvents="none"
            style={[
              styles.regionNumber,
              {
                backgroundColor: color,
                paddingHorizontal: 6 / scale,
                paddingVertical: 2 / scale,
              },
            ]}
          >
            <Text
              style={[
                styles.regionNumberText,
                { fontSize: 12 / scale },
              ]}
            >
              {index + 1}
            </Text>
          </View>
        </View>
      </GestureDetector>

      {selected ? (
        <>
          {renderResizeHandle('topLeft', frame.left, frame.top)}
          {renderResizeHandle(
            'topRight',
            frame.left + frame.width,
            frame.top
          )}
          {renderResizeHandle(
            'bottomLeft',
            frame.left,
            frame.top + frame.height
          )}
          {renderResizeHandle(
            'bottomRight',
            frame.left + frame.width,
            frame.top + frame.height
          )}
        </>
      ) : null}
    </>
  );
}


export function ImageRegionEditor({
  visible,
  image,
  initialRegions,
  onCancel,
  onConfirm,
}: ImageRegionEditorProps) {
  const [editorSize, setEditorSize] = useState({
    width: 0,
    height: 0,
  });
  const [regions, setRegions] = useState<NormalizedImageRegion[]>(
    initialRegions.length > 0
      ? initialRegions
      : [createDefaultRegion(0)]
  );
  const [selectedRegionIndex, setSelectedRegionIndex] = useState(0);
  const [viewportTransform, setViewportTransform] =
    useState<ViewportTransform>(initialViewportTransform);
  const regionsRef = useRef(regions);
  const viewportTransformRef = useRef(viewportTransform);
  const pinchStart = useRef({
    scale: 1,
    imageX: 0,
    imageY: 0,
  });
  const displayedImageFrame = useMemo(
    () => getContainedImageFrame({
      containerWidth: editorSize.width,
      containerHeight: editorSize.height,
      imageWidth: image.width,
      imageHeight: image.height,
    }),
    [editorSize, image.height, image.width]
  );


  useEffect(() => {
    if (!visible) {
      return;
    }

    const nextRegions = initialRegions.length > 0
      ? initialRegions
      : [createDefaultRegion(0)];

    regionsRef.current = nextRegions;
    setRegions(nextRegions);
    setSelectedRegionIndex(0);
    viewportTransformRef.current = initialViewportTransform;
    setViewportTransform(initialViewportTransform);
  }, [initialRegions, visible]);


  const replaceRegions = useCallback(
    (nextRegions: NormalizedImageRegion[]) => {
      regionsRef.current = nextRegions;
      setRegions(nextRegions);
    },
    []
  );


  const updateRegion = useCallback((
    index: number,
    nextRegion: NormalizedImageRegion
  ) => {
    replaceRegions(regionsRef.current.map(
      (region, regionIndex) =>
        regionIndex === index ? nextRegion : region
    ));
  }, [replaceRegions]);


  const updateViewportTransform = (
    nextTransform: ViewportTransform
  ) => {
    viewportTransformRef.current = nextTransform;
    setViewportTransform(nextTransform);
  };


  const resetViewport = () => {
    updateViewportTransform(initialViewportTransform);
  };


  const addRegion = () => {
    if (regionsRef.current.length >= maximumRegionCount) {
      return;
    }

    const nextIndex = regionsRef.current.length;

    replaceRegions([
      ...regionsRef.current,
      createDefaultRegion(nextIndex),
    ]);
    setSelectedRegionIndex(nextIndex);
  };


  const deleteSelectedRegion = () => {
    if (regionsRef.current.length <= 1) {
      return;
    }

    const nextRegions = regionsRef.current.filter(
      (_, index) => index !== selectedRegionIndex
    );

    replaceRegions(nextRegions);
    setSelectedRegionIndex(Math.min(
      selectedRegionIndex,
      nextRegions.length - 1
    ));
  };


  const pinchGesture = useMemo(() => Gesture.Pinch()
    .enabled(displayedImageFrame !== null)
    .runOnJS(true)
    .onBegin((event) => {
      if (displayedImageFrame === null) {
        return;
      }

      const currentTransform = viewportTransformRef.current;
      const centerX =
        displayedImageFrame.x + displayedImageFrame.width / 2;
      const centerY =
        displayedImageFrame.y + displayedImageFrame.height / 2;

      pinchStart.current = {
        scale: currentTransform.scale,
        imageX:
          (event.focalX - centerX -
            currentTransform.translateX) /
          currentTransform.scale,
        imageY:
          (event.focalY - centerY -
            currentTransform.translateY) /
          currentTransform.scale,
      };
    })
    .onUpdate((event) => {
      if (displayedImageFrame === null) {
        return;
      }

      const nextScale = clamp(
        pinchStart.current.scale * event.scale,
        1,
        8
      );
      const centerX =
        displayedImageFrame.x + displayedImageFrame.width / 2;
      const centerY =
        displayedImageFrame.y + displayedImageFrame.height / 2;
      const nextTransform = clampViewportTranslation(
        {
          scale: nextScale,
          translateX:
            event.focalX - centerX -
            pinchStart.current.imageX * nextScale,
          translateY:
            event.focalY - centerY -
            pinchStart.current.imageY * nextScale,
        },
        displayedImageFrame.width,
        displayedImageFrame.height
      );

      updateViewportTransform(nextTransform);
    }),
  [displayedImageFrame]);


  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onCancel}
    >
      <GestureHandlerRootView style={styles.root}>
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>
              読み取り範囲を調整
            </Text>
          </View>

          <Text style={styles.instructions}>
            曜日・時限の見出しと授業部分を別の枠にできます。枠内をドラッグして移動、四隅で調整してください。
          </Text>

          <GestureDetector gesture={pinchGesture}>
            <View
              style={styles.editor}
              onLayout={({ nativeEvent }) => {
                setEditorSize({
                  width: nativeEvent.layout.width,
                  height: nativeEvent.layout.height,
                });
              }}
            >
              {displayedImageFrame !== null ? (
                <View
                  style={[
                    styles.translatedImageLayer,
                    {
                      left: displayedImageFrame.x,
                      top: displayedImageFrame.y,
                      width: displayedImageFrame.width,
                      height: displayedImageFrame.height,
                      transform: [
                        {
                          translateX:
                            viewportTransform.translateX,
                        },
                        {
                          translateY:
                            viewportTransform.translateY,
                        },
                      ],
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.scaledImageLayer,
                      {
                        transform: [
                          { scale: viewportTransform.scale },
                        ],
                      },
                    ]}
                  >
                    <Image
                      style={StyleSheet.absoluteFill}
                      source={{ uri: image.uri }}
                      contentFit="fill"
                    />

                    {regions.map((region, index) => (
                      <EditableRegionOverlay
                        key={index}
                        index={index}
                        region={region}
                        imageFrame={displayedImageFrame}
                        scale={viewportTransform.scale}
                        selected={index === selectedRegionIndex}
                        color={regionColors[index]}
                        onSelect={setSelectedRegionIndex}
                        onChange={updateRegion}
                      />
                    ))}
                  </View>
                </View>
              ) : null}
            </View>
          </GestureDetector>

          <View style={styles.footer}>
            <View style={styles.regionToolbar}>
              <View style={styles.regionTabs}>
                {regions.map((_, index) => (
                  <Pressable
                    key={index}
                    style={[
                      styles.regionTab,
                      {
                        borderColor: regionColors[index],
                        backgroundColor:
                          index === selectedRegionIndex
                            ? regionColors[index]
                            : 'white',
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`範囲${index + 1}を選択`}
                    onPress={() => setSelectedRegionIndex(index)}
                  >
                    <Text
                      style={[
                        styles.regionTabText,
                        {
                          color: index === selectedRegionIndex
                            ? 'white'
                            : regionColors[index],
                        },
                      ]}
                    >
                      {index + 1}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.regionActions}>
                <Pressable
                  style={styles.smallActionButton}
                  accessibilityRole="button"
                  disabled={regions.length >= maximumRegionCount}
                  onPress={addRegion}
                >
                  <Text
                    style={[
                      styles.addRegionText,
                      regions.length >= maximumRegionCount &&
                        styles.disabledActionText,
                    ]}
                  >
                    ＋追加
                  </Text>
                </Pressable>

                <Pressable
                  style={styles.smallActionButton}
                  accessibilityRole="button"
                  disabled={regions.length <= 1}
                  onPress={deleteSelectedRegion}
                >
                  <Text
                    style={[
                      styles.deleteRegionText,
                      regions.length <= 1 &&
                        styles.disabledActionText,
                    ]}
                  >
                    削除
                  </Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.zoomRow}>
              <Text style={styles.zoomText}>
                表示倍率{' '}
                {Math.round(viewportTransform.scale * 100)}%
              </Text>

              <Pressable
                style={styles.resetButton}
                accessibilityRole="button"
                disabled={viewportTransform.scale === 1}
                onPress={resetViewport}
              >
                <Text
                  style={[
                    styles.resetButtonText,
                    viewportTransform.scale === 1 &&
                      styles.disabledActionText,
                  ]}
                >
                  表示を元に戻す
                </Text>
              </Pressable>
            </View>

            <View style={styles.actionRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.cancelButton,
                  pressed && styles.pressedButton,
                ]}
                accessibilityRole="button"
                onPress={onCancel}
              >
                <Text style={styles.cancelText}>
                  キャンセル
                </Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.confirmButton,
                  pressed && styles.pressedButton,
                ]}
                accessibilityRole="button"
                onPress={() => onConfirm(regionsRef.current)}
              >
                <Text style={styles.confirmText}>
                  この範囲で完了
                </Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </GestureHandlerRootView>
    </Modal>
  );
}


const styles = StyleSheet.create({
  root: {
    flex: 1,
  },

  container: {
    flex: 1,
    backgroundColor: '#111',
  },

  header: {
    minHeight: 52,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#bbb',
    paddingHorizontal: 16,
  },

  title: {
    color: '#111',
    fontSize: 17,
    fontWeight: 'bold',
  },

  instructions: {
    color: 'white',
    fontSize: 13,
    lineHeight: 19,
    backgroundColor: '#222',
    paddingHorizontal: 18,
    paddingVertical: 8,
    textAlign: 'center',
  },

  editor: {
    flex: 1,
    backgroundColor: '#090909',
    overflow: 'hidden',
  },

  translatedImageLayer: {
    position: 'absolute',
  },

  scaledImageLayer: {
    width: '100%',
    height: '100%',
  },

  selection: {
    position: 'absolute',
  },

  regionNumber: {
    alignSelf: 'flex-start',
  },

  regionNumberText: {
    color: 'white',
    fontWeight: 'bold',
  },

  resizeHandle: {
    position: 'absolute',
    backgroundColor: 'white',
    zIndex: 5,
  },

  footer: {
    backgroundColor: 'white',
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 10,
    zIndex: 10,
  },

  regionToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },

  regionTabs: {
    flex: 1,
    flexDirection: 'row',
    gap: 5,
  },

  regionTab: {
    minHeight: 31,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 7,
    paddingHorizontal: 8,
  },

  regionTabText: {
    fontSize: 12,
    fontWeight: 'bold',
  },

  regionActions: {
    flexDirection: 'row',
    gap: 2,
  },

  smallActionButton: {
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: 7,
  },

  addRegionText: {
    color: '#2454a6',
    fontSize: 13,
    fontWeight: 'bold',
  },

  deleteRegionText: {
    color: '#a52b2b',
    fontSize: 13,
    fontWeight: 'bold',
  },

  disabledActionText: {
    color: '#aaa',
  },

  zoomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },

  zoomText: {
    color: '#555',
    fontSize: 13,
  },

  resetButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },

  resetButtonText: {
    color: '#2454a6',
    fontSize: 13,
    fontWeight: 'bold',
  },

  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },

  cancelButton: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f2f2f2',
    borderWidth: 1,
    borderColor: '#bbb',
    borderRadius: 10,
  },

  cancelText: {
    color: '#333',
    fontSize: 16,
    fontWeight: 'bold',
  },

  confirmButton: {
    flex: 1.4,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2454a6',
    borderRadius: 10,
  },

  confirmText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },

  pressedButton: {
    opacity: 0.6,
  },
});
