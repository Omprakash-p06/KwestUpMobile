# Phase 7 Technical Research: Premium Liquid Glass UI Redesign (Skia)

This document provides extensive technical ecosystem research, performance guidelines, and exact code implementations to build a hardware-accelerated **Liquid Glass (Glassmorphism)** user interface in **KwestUp Mobile** using Shopify's **React Native Skia** on Android.

---

## Standard Stack

* **Graphics Engine**: `@shopify/react-native-skia` (React Native Skia)
  * **Status**: SOTA for high-performance canvas drawings and shader logic on React Native.
  * **Under the Hood**: Compiles down to C++ Skia drawing calls, running directly on Android's hardware-accelerated GPU thread. This completely bypasses the React Native JS-to-Native bridge bottleneck during graphic updates.
  * **Installation**: Installed via Expo CLI:
    ```bash
    npx expo install @shopify/react-native-skia
    ```

* **Aesthetic Palette & Styling**:
  * **Blur Layer**: Skia `<BackdropFilter>` with native `<Blur>` component.
  * **Sheen Mask**: Translucent tint fill (`rgba(255, 255, 255, 0.15)`) coupled with highlighted rims (`borderColor: 'rgba(255, 255, 255, 0.35)', borderWidth: 1.5`).
  * **Fluid Edge Merge**: Native `<ColorMatrix>` filter mapping to blur parameters.

---

## Architecture Patterns

### 1. Liquid Glass Refraction Pipeline
To achieve an organic, refracting liquid glass card layer, graphics are processed through a four-stage pipeline:

```
┌───────────────────────────┐
│     Background Layer      │  (Dynamic Linear/Radial Gradient Background)
└─────────────┬─────────────┘
              │
              ▼
┌───────────────────────────┐
│      BackdropFilter       │  (Grabs pixels directly behind card coordinates)
└─────────────┬─────────────┘
              │
              ▼
┌───────────────────────────┐
│     Blur Filter (Skia)    │  (Applies heavy Gaussian Blur to simulated pixels)
└─────────────┬─────────────┘
              │
              ▼
┌───────────────────────────┐
│    ColorMatrix Masking    │  (Amplifies alpha channel to merge blurred edges)
└─────────────┬─────────────┘
              │
              ▼
┌───────────────────────────┐
│   Sheen Tint & Rim Ring   │  (Applies semi-transparent fill and highlight borders)
└───────────────────────────┘
```

### 2. Alpha Channel Liquid Merge Matrix (Gooey Shader)
When multiple blurred shapes are rendered close to each other, applying a sharp thresholding filter to their cumulative alpha channels creates a fluid, organic merge (often called a "gooey" or "liquid" merger). 
This is achieved by applying a custom 5x4 matrix filter:

$$\begin{pmatrix}
1 & 0 & 0 & 0 & 0 \\
0 & 1 & 0 & 0 & 0 \\
0 & 0 & 1 & 0 & 0 \\
0 & 0 & 0 & A_{scale} & A_{bias}
\end{pmatrix}$$

Where:
- $A_{scale} = 18$ (multiplies the blurred alpha bounds to sharpen borders)
- $A_{bias} = -7$ (shifts the alpha threshold, making the gooey boundary smooth and solid)

```javascript
const liquidMatrix = [
  1, 0, 0, 0, 0,
  0, 1, 0, 0, 0,
  0, 0, 1, 0, 0,
  0, 0, 0, 18, -7, // Sharpens blurred alpha borders into a smooth liquid mask
];
```

---

## Don't Hand-Roll

* **CPU-based Blur Filters**: Do not use standard React Native `View` layers with massive shadow offsets or overlay blurs on Android. Android does not support native `blurRadius` on standard views efficiently, which leads to heavy frame rate drops. Always execute blurs inside Skia `<BackdropFilter>` canvas blocks.
* **Unbounded Backdrop Blurs**: Never render `<BackdropFilter>` layers without explicit bounding constraints (`clip` property). Doing so forces Android's GPU to sample the entire screen canvas on every frame, resulting in significant battery drain and UI stutter.
* **Complex Custom Shaders for Simple Cards**: Avoid writing raw GLSL/AGSL shaders for simple blurs. Skia's built-in `<Blur />` and `<ColorMatrix />` nodes are pre-compiled and highly optimized for Android GPUs.

---

## Common Pitfalls

* **Android Emulator Slowdowns**:
  * *Pitfall*: Android emulators struggle to run Skia canvas blurs smoothly due to CPU-based OpenGL translation.
  * *Fix*: Always test and verify the UI on a physical Android device via Expo Go or an EAS development build.
* **Layout Sizing Drift**:
  * *Pitfall*: Fixed-width blurs clip or overflow when device orientations change or the app enters Android Split-Screen mode.
  * *Fix*: Rely on layout parent callbacks (`onLayout`) or the `useWindowDimensions()` hook to calculate exact `width` and `height` coordinates, and bind these properties reactively to the Skia `<BackdropFilter>` `clip` dimensions.
* **Over-sampling Blur Radii**:
  * *Pitfall*: Setting Skia's `blur` value higher than 30 causes excessive sampling loops, slowing down rendering on lower-end Android chips.
  * *Fix*: Keep the `blur` radius between 15 and 25. For deeper glass depth, combine a moderate blur (e.g. 20) with a semi-opaque background card tint.

---

## Code Examples

### 1. LiquidGlassCard.js Component
The following code establishes a robust, highly optimized liquid glass card component in React Native:

```javascript
import React from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Canvas, BackdropFilter, Blur, Fill, ColorMatrix } from '@shopify/react-native-skia';

export const LiquidGlassCard = ({ title, subtitle, children, currentTheme }) => {
  const { width } = useWindowDimensions();
  const cardWidth = width - 40;
  const cardHeight = 200;

  // Gooey merge matrix
  const liquidMatrix = [
    1, 0, 0, 0, 0,
    0, 1, 0, 0, 0,
    0, 0, 1, 0, 0,
    0, 0, 0, 18, -7,
  ];

  return (
    <View style={[styles.cardFrame, { width: cardWidth, height: cardHeight }]}>
      <Canvas style={StyleSheet.absoluteFill}>
        {/* 1. BackdropFilter constrained strictly to the card's dimensions */}
        <BackdropFilter clip={{ x: 0, y: 0, width: cardWidth, height: cardHeight }}>
          {/* 2. Hardware-accelerated GPU Gaussian Blur */}
          <Blur blur={20} />
          {/* 3. Liquid edge merge matrix */}
          <ColorMatrix matrix={liquidMatrix} />
        </BackdropFilter>
        
        {/* 4. Glass face sheen white overlay */}
        <Fill color="rgba(255, 255, 255, 0.12)" />
      </Canvas>

      {/* Card Content Overlay */}
      <View style={styles.content}>
        <View>
          <Text style={[styles.title, { color: '#FFFFFF' }]}>{title || "Glass Card"}</Text>
          <Text style={[styles.subtitle, { color: 'rgba(255, 255, 255, 0.7)' }]}>{subtitle || "Refractive details"}</Text>
        </View>
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  cardFrame: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.28)', // Highlighted rim border
    marginVertical: 12,
    alignSelf: 'center',
    elevation: 4,
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 4,
    fontWeight: '500',
  },
});
```

### 2. Animated Fluid Background Component
To make the liquid glass effect look exceptionally premium, render colored fluid blobs moving in the background beneath the glass card:

```javascript
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withTiming, 
  withSequence 
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

export const LiquidGlassBackground = ({ children, currentTheme }) => {
  // Share values for liquid blob movements
  const blob1X = useSharedValue(0);
  const blob1Y = useSharedValue(0);
  const blob2X = useSharedValue(0);
  const blob2Y = useSharedValue(0);

  useEffect(() => {
    // Loop blobs in fluid, organic patterns
    blob1X.value = withRepeat(
      withSequence(
        withTiming(120, { duration: 8000 }),
        withTiming(-80, { duration: 10000 }),
        withTiming(0, { duration: 6000 })
      ),
      -1,
      true
    );
    blob1Y.value = withRepeat(
      withSequence(
        withTiming(150, { duration: 9000 }),
        withTiming(-50, { duration: 7000 }),
        withTiming(0, { duration: 8000 })
      ),
      -1,
      true
    );
    blob2X.value = withRepeat(
      withSequence(
        withTiming(-100, { duration: 9000 }),
        withTiming(100, { duration: 8000 }),
        withTiming(0, { duration: 7000 })
      ),
      -1,
      true
    );
    blob2Y.value = withRepeat(
      withSequence(
        withTiming(-80, { duration: 8000 }),
        withTiming(140, { duration: 9000 }),
        withTiming(0, { duration: 9000 })
      ),
      -1,
      true
    );
  }, []);

  const animatedBlob1 = useAnimatedStyle(() => ({
    transform: [{ translateX: blob1X.value }, { translateY: blob1Y.value }],
  }));

  const animatedBlob2 = useAnimatedStyle(() => ({
    transform: [{ translateX: blob2X.value }, { translateY: blob2Y.value }],
  }));

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.background || '#090B11' }]}>
      {/* Dynamic Background Gradients */}
      <View style={StyleSheet.absoluteFill}>
        {/* Blob 1: Vibrant Primary Tone */}
        <Animated.View 
          style={[
            styles.blob, 
            animatedBlob1, 
            { 
              backgroundColor: currentTheme.primary || '#FF007F', 
              top: '20%', 
              left: '10%' 
            }
          ]} 
        />
        {/* Blob 2: Vibrant Indigo/Purple Tone */}
        <Animated.View 
          style={[
            styles.blob, 
            animatedBlob2, 
            { 
              backgroundColor: '#6A0DAD', 
              bottom: '25%', 
              right: '15%' 
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
    overflow: 'hidden',
  },
  blob: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    opacity: 0.35,
    filter: [{ blur: 50 }], // Web/Native GPU blur filtering
  },
});
```
