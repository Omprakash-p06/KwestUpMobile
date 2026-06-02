import React from "react";
import { StyleSheet, View, ImageBackground } from "react-native";

export const LiquidGlassBackground = ({ children, theme, themeMode }) => {
  const currentTheme = theme || { background: "#131313", text: "#FFFFFF" };

  const isAmoled = themeMode === "amoled" || currentTheme.background === "#000000";
  const isDark = themeMode === "dark" || currentTheme.background === "#131313";
  const isLight = themeMode === "light" || (!isDark && !isAmoled);

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
    return (
      <View style={[styles.container, { backgroundColor: "#131313" }]}>
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.darkReflection]} />
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.darkSheen]} />
        {renderBackgroundContent()}
      </View>
    );
  }

  if (isLight) {
    const lightPaperUrl = "https://images.unsplash.com/photo-1586075010923-2dd4570fb338?q=80&w=1200&auto=format&fit=crop";
    return (
      <ImageBackground
        source={{ uri: lightPaperUrl }}
        style={[styles.container, { backgroundColor: "#E4E2E1" }]}
        resizeMode="cover"
      >
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.lightWash]} />
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
  darkReflection: {
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    transform: [{ scaleX: 1.05 }],
  },
  darkSheen: {
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    top: "15%",
    bottom: "15%",
  },
  lightWash: {
    backgroundColor: "rgba(228, 226, 225, 0.22)",
  },
});
