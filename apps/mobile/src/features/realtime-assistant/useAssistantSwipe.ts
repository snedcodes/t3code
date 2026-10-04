// oxlint-disable react/refs, react/capitalized-calls -- Gesture.Pan is an SDK factory; these ref reads run only in deferred native touch callbacks.
import { useMemo, useRef } from "react";
import { TextInput, type LayoutChangeEvent } from "react-native";
import { Gesture } from "react-native-gesture-handler";

/** Intentional horizontal swipe; leave back edges, editors and vertical scrolling alone. */
export function useAssistantSwipe(options: {
  enabled: boolean;
  direction: "left" | "right";
  onSwipe: () => void;
  excludeComposer?: boolean;
}) {
  const bounds = useRef({ width: 0, height: 0 });
  const { enabled, direction, onSwipe, excludeComposer } = options;
  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(enabled)
        .runOnJS(true)
        .activeOffsetX(direction === "right" ? 60 : -60)
        .failOffsetY([-18, 18])
        .maxPointers(1)
        .onTouchesDown((event, manager) => {
          const touch = event.allTouches[0];
          const area = bounds.current;
          if (
            !touch ||
            touch.x < 32 ||
            touch.x > area.width - 32 ||
            (excludeComposer && touch.y > area.height * 0.55) ||
            TextInput.State.currentlyFocusedInput()
          )
            manager.fail();
        })
        .onEnd((event, success) => {
          if (
            success &&
            (direction === "right" ? event.translationX > 100 : event.translationX < -100) &&
            Math.abs(event.translationY) < 30
          )
            onSwipe();
        }),
    [direction, enabled, excludeComposer, onSwipe],
  );
  return {
    gesture,
    onLayout: (event: LayoutChangeEvent) => {
      bounds.current = event.nativeEvent.layout;
    },
  };
}
