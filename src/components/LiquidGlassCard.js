import React, { useState } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Canvas, BackdropFilter, Blur, Fill, ColorMatrix } from "@shopify/react-native-skia";

export const LiquidGlassCard = ({ title, subtitle, children, style, theme }) => {
  const { width: screenWidth } = useWindowDimensions();
  
  // Extract custom width from style if it exists
  const flatStyle = StyleSheet.flatten(style) || {};
  const customWidth = flatStyle.width;
  
  const cardWidth = typeof customWidth === "number" 
    ? customWidth 
    : (typeof customWidth === "string" && customWidth.endsWith("%"))
      ? (screenWidth - 40) * (parseFloat(customWidth) / 100)
      : screenWidth - 40;

  const [cardHeight, setCardHeight] = useState(150); // Fallback placeholder height

  // Matrix that amplifies alpha channels to create a fluid, organic "liquid" edge merge
  const liquidMatrix = [
    1, 0, 0, 0, 0,
    0, 1, 0, 0, 0,
    0, 0, 1, 0, 0,
    0, 0, 0, 18, -7, // Sharpens blurred alpha borders into a smooth liquid mask
  ];

  const currentTheme = theme || { text: "#ffffff", secondaryText: "rgba(255, 255, 255, 0.7)" };

  return (
    <View 
      style={[styles.cardFrame, { width: cardWidth }, style]}
      onLayout={(e) => {
        const height = e.nativeEvent.layout.height;
        if (height > 0) setCardHeight(height);
      }}
    >
      <Canvas style={StyleSheet.absoluteFill}>
        {/* Dynamic BackdropFilter bounding box based on responsive onLayout bounds */}
        <BackdropFilter clip={{ x: 0, y: 0, width: cardWidth, height: cardHeight }}>
          {/* Apply moderate blur radius (optimal performance under 30 on Android) */}
          <Blur blur={20} />
          {/* Gooey blend filter */}
          <ColorMatrix matrix={liquidMatrix} />
        </BackdropFilter>
        
        {/* Highlight sheen face overlay */}
        <Fill color="rgba(255, 255, 255, 0.12)" />
      </Canvas>

      {/* Card Content Elements */}
      <View style={styles.content}>
        {title && <Text style={[styles.title, { color: currentTheme.text }]}>{title}</Text>}
        {subtitle && <Text style={[styles.subtitle, { color: currentTheme.secondaryText }]}>{subtitle}</Text>}
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  cardFrame: {
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.28)", // Simulated rim border highlights
    marginVertical: 10,
    alignSelf: "center",
    elevation: 3, // Android shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  content: {
    padding: 20,
    justifyContent: "center",
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 10,
  },
});
