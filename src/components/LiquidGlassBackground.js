import React from "react";
import { StyleSheet, View, ImageBackground } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

export const LiquidGlassBackground = ({ children, theme }) => {
  const currentTheme = theme || { background: "#131313", text: "#FFFFFF" };

  const isDark = currentTheme.background === "#131313";
  const isAmoled = currentTheme.background === "#000000";
  const isLight = !isDark && !isAmoled;

  // Stardust noise transparent grain overlay (applied globally)
  const grainTextureUrl = "https://www.transparenttextures.com/patterns/stardust.png";

  const renderBackgroundContent = () => (
    <ImageBackground
      source={{ uri: grainTextureUrl }}
      style={StyleSheet.absoluteFill}
      imageStyle={{ opacity: isDark ? 0.05 : isLight ? 0.08 : 0.03, resizeMode: "repeat" }}
    >
      {children}
    </ImageBackground>
  );

  if (isDark) {
    // Brushed Dark Steel plate horizontally grooved gradient reflection
    return (
      <LinearGradient
        colors={["#131313", "#20201f", "#2a2a2a", "#20201f", "#131313"]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.container}
      >
        {renderBackgroundContent()}
      </LinearGradient>
    );
  }

  if (isLight) {
    // Warm industrial concrete / recycled paper desk background
    const lightPaperUrl = "https://images.unsplash.com/photo-1586075010923-2dd4570fb338?q=80&w=1200&auto=format&fit=crop";
    return (
      <ImageBackground
        source={{ uri: lightPaperUrl }}
        style={[styles.container, { backgroundColor: "#E4E2E1" }]}
        resizeMode="cover"
      >
        {/* Subtle warming overlay */}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(228, 226, 225, 0.25)" }]} />
        {renderBackgroundContent()}
      </ImageBackground>
    );
  }

  // Fallback for AMOLED mode: pure black console
  return (
    <View style={[styles.container, { backgroundColor: "#000000" }]}>
      {renderBackgroundContent()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: "hidden",
  },
});
