import React from "react";
import { StyleSheet, View, ImageBackground } from "react-native";

export const LiquidGlassBackground = ({ children, theme }) => {
  const currentTheme = theme || { background: "#F0E6F8", text: "#333333" };

  // Select texture based on theme properties
  let textureUrl = null;
  const isDark = currentTheme.background === "#282A36"; // Dark
  const isAmoled = currentTheme.background === "#000000"; // AMOLED

  if (!isAmoled) {
    if (isDark) {
      // Brushed Dark Metal Slate texture
      textureUrl = "https://images.unsplash.com/photo-1501166617867-c55b45097a60?q=80&w=1200&auto=format&fit=crop";
    } else {
      // Fine Parchment / Clean White Lined Paper texture
      textureUrl = "https://images.unsplash.com/photo-1586075010923-2dd4570fb338?q=80&w=1200&auto=format&fit=crop";
    }
  }

  if (textureUrl) {
    return (
      <ImageBackground 
        source={{ uri: textureUrl }} 
        style={[styles.container, { backgroundColor: currentTheme.background }]}
        resizeMode="cover"
      >
        {/* Translucent overlay to optimize contrast and readability */}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? "rgba(40, 42, 54, 0.45)" : "rgba(240, 230, 248, 0.15)" }]} />
        {children}
      </ImageBackground>
    );
  }

  // Fallback for AMOLED mode: pure black
  return (
    <View style={[styles.container, { backgroundColor: "#000000" }]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: "hidden",
  },
});
