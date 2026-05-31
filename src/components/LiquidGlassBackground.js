import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withTiming, 
  withSequence 
} from "react-native-reanimated";

export const LiquidGlassBackground = ({ children, theme }) => {
  const currentTheme = theme || { background: "#090B11", primary: "#FF007F" };

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

  const animatedBlob1 = useAnimatedStyle(() => ({
    transform: [{ translateX: blob1X.value }, { translateY: blob1Y.value }],
  }));

  const animatedBlob2 = useAnimatedStyle(() => ({
    transform: [{ translateX: blob2X.value }, { translateY: blob2Y.value }],
  }));

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.background || "#090B11" }]}>
      {/* Dynamic Background Gradients */}
      <View style={StyleSheet.absoluteFill}>
        {/* Blob 1: Primary Aesthetic Glow */}
        <Animated.View 
          style={[
            styles.blob, 
            animatedBlob1, 
            { 
              backgroundColor: currentTheme.primary || "#FF007F", 
              top: "15%", 
              left: "5%" 
            }
          ]} 
        />
        {/* Blob 2: Complementary Dark Purple Glow */}
        <Animated.View 
          style={[
            styles.blob, 
            animatedBlob2, 
            { 
              backgroundColor: "#4F1F90", 
              bottom: "20%", 
              right: "10%" 
            }
          ]} 
        />
      </View>
      
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
  blob: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    opacity: 0.28,
    // Note: Since standard view filters are fast on Android 12+, we can use a heavy blur.
    // Skia Backdrop blurs handle the main card refraction, so background blurs stay moderate.
    borderRadius: 140,
    transform: [{ scale: 1.2 }],
  },
});
