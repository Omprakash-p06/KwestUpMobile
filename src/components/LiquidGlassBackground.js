import React, { useEffect } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { 
  useSharedValue, 
  withRepeat, 
  withTiming, 
  withSequence,
  useDerivedValue
} from "react-native-reanimated";
import { Canvas, Circle, Blur } from "@shopify/react-native-skia";

export const LiquidGlassBackground = ({ children, theme }) => {
  const currentTheme = theme || { background: "#090B11", primary: "#FF007F" };
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  // Share values for liquid blob movements
  const blob1X = useSharedValue(0);
  const blob1Y = useSharedValue(0);
  const blob2X = useSharedValue(0);
  const blob2Y = useSharedValue(0);

  useEffect(() => {
    // Loop blobs in fluid, organic patterns
    blob1X.value = withRepeat(
      withSequence(
        withTiming(100, { duration: 9000 }),
        withTiming(-60, { duration: 11000 }),
        withTiming(0, { duration: 7000 })
      ),
      -1,
      true
    );
    blob1Y.value = withRepeat(
      withSequence(
        withTiming(120, { duration: 10000 }),
        withTiming(-40, { duration: 8000 }),
        withTiming(0, { duration: 9000 })
      ),
      -1,
      true
    );
    blob2X.value = withRepeat(
      withSequence(
        withTiming(-80, { duration: 10000 }),
        withTiming(80, { duration: 9000 }),
        withTiming(0, { duration: 8000 })
      ),
      -1,
      true
    );
    blob2Y.value = withRepeat(
      withSequence(
        withTiming(-60, { duration: 9000 }),
        withTiming(120, { duration: 10000 }),
        withTiming(0, { duration: 10000 })
      ),
      -1,
      true
    );
  }, [blob1X, blob1Y, blob2X, blob2Y]);

  // Derived positions for Skia Circles based on screen size and shared animations
  const cx1 = useDerivedValue(() => screenWidth * 0.25 + blob1X.value);
  const cy1 = useDerivedValue(() => screenHeight * 0.25 + blob1Y.value);
  const cx2 = useDerivedValue(() => screenWidth * 0.75 + blob2X.value);
  const cy2 = useDerivedValue(() => screenHeight * 0.75 + blob2Y.value);

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.background || "#090B11" }]}>
      {/* Skia Canvas to render and blur the background blobs */}
      <Canvas style={StyleSheet.absoluteFill}>
        {/* Animated Blob 1: Primary Aesthetic Glow */}
        <Circle cx={cx1} cy={cy1} r={200} color={currentTheme.primary || "#FF007F"} opacity={0.28}>
          <Blur blur={80} />
        </Circle>
        
        {/* Animated Blob 2: Complementary Dark Purple Glow */}
        <Circle cx={cx2} cy={cy2} r={200} color="#4F1F90" opacity={0.28}>
          <Blur blur={80} />
        </Circle>
      </Canvas>
      
      {/* Foreground Content */}
      <View style={StyleSheet.absoluteFill}>
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: "hidden",
  },
});
