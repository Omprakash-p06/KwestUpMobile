import React from "react";
import { StyleSheet, Text, View, useWindowDimensions, ImageBackground } from "react-native";

export const LiquidGlassCard = ({ title, subtitle, children, style, theme }) => {
  const { width: screenWidth } = useWindowDimensions();
  
  const flatStyle = StyleSheet.flatten(style) || {};
  const customWidth = flatStyle.width;
  
  const cardWidth = typeof customWidth === "number" 
    ? customWidth 
    : (typeof customWidth === "string" && customWidth.endsWith("%"))
      ? (screenWidth - 40) * (parseFloat(customWidth) / 100)
      : screenWidth - 40;

  const currentTheme = theme || { 
    text: "#333333", 
    secondaryText: "#666666", 
    cardBackground: "#FFFFFF", 
    border: "#E0E0E0",
    primary: "#8E7BEF"
  };

  const isDark = currentTheme.background === "#282A36";
  const isAmoled = currentTheme.background === "#000000";
  const isLightNotePaper = !isDark && !isAmoled;

  // Select the repeating skeuomorphic texture based on the theme
  let cardTextureUrl = null;
  if (isLightNotePaper) {
    // Ruled lined paper ledger pattern overlay
    cardTextureUrl = "https://www.transparenttextures.com/patterns/lined-paper.png";
  } else if (isDark) {
    // Brushed Dark Aluminum plate pattern overlay
    cardTextureUrl = "https://www.transparenttextures.com/patterns/brushed-alum-dark.png";
  }

  // Card Skeuomorphic Shadows and Borders
  const cardStyles = {
    backgroundColor: currentTheme.cardBackground,
    borderColor: currentTheme.border,
    borderWidth: 2,
    borderRadius: 18,
    // Realistic 3D deep drop shadow
    shadowColor: isDark || isAmoled ? "#000000" : "rgba(0, 0, 0, 0.4)",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: isDark ? 0.35 : 0.14,
    shadowRadius: 10,
    elevation: isDark ? 8 : 5,
  };

  if (isAmoled) {
    cardStyles.borderColor = currentTheme.primary + "50"; // Glowing neon borders
    cardStyles.borderWidth = 1.5;
    cardStyles.shadowColor = currentTheme.primary;
    cardStyles.shadowOpacity = 0.15;
    cardStyles.shadowRadius = 8;
  }

  // Decorative corner screw rivets for tactile Dark Mode plate
  const renderScrewRivets = () => (
    <>
      <View style={[styles.screwOuter, { top: 10, left: 10 }]}>
        <View style={styles.screwInner}><View style={styles.screwThread} /></View>
      </View>
      <View style={[styles.screwOuter, { top: 10, right: 10 }]}>
        <View style={styles.screwInner}><View style={[styles.screwThread, { transform: [{ rotate: "135deg" }] }]} /></View>
      </View>
      <View style={[styles.screwOuter, { bottom: 10, left: 10 }]}>
        <View style={styles.screwInner}><View style={[styles.screwThread, { transform: [{ rotate: "90deg" }] }]} /></View>
      </View>
      <View style={[styles.screwOuter, { bottom: 10, right: 10 }]}>
        <View style={styles.screwInner}><View style={[styles.screwThread, { transform: [{ rotate: "45deg" }] }]} /></View>
      </View>
    </>
  );

  const renderCardInner = () => (
    <View style={[styles.content, isLightNotePaper && { paddingLeft: 46 }]}>
      {/* Red vertical ledger paper margin line */}
      {isLightNotePaper && <View style={styles.redMarginLine} />}

      {/* Tactile corner bolts for mechanical dark slate card */}
      {isDark && renderScrewRivets()}

      {/* Skeuomorphic Ring Binder Top border for light paper */}
      {isLightNotePaper && (
        <View style={styles.binderSpirals}>
          <View style={styles.spiralRing} />
          <View style={styles.spiralRing} />
          <View style={styles.spiralRing} />
          <View style={styles.spiralRing} />
          <View style={styles.spiralRing} />
          <View style={styles.spiralRing} />
        </View>
      )}

      {title && <Text style={[styles.title, { color: currentTheme.text }]}>{title}</Text>}
      {subtitle && <Text style={[styles.subtitle, { color: currentTheme.secondaryText }]}>{subtitle}</Text>}
      {children}
    </View>
  );

  if (cardTextureUrl) {
    return (
      <ImageBackground
        source={{ uri: cardTextureUrl }}
        style={[styles.cardFrame, cardStyles, { width: cardWidth }, style]}
        imageStyle={{ opacity: isLightNotePaper ? 0.35 : 0.15 }}
      >
        {renderCardInner()}
      </ImageBackground>
    );
  }

  return (
    <View style={[styles.cardFrame, cardStyles, { width: cardWidth }, style]}>
      {renderCardInner()}
    </View>
  );
};

const styles = StyleSheet.create({
  cardFrame: {
    marginVertical: 10,
    alignSelf: "center",
    overflow: "hidden",
  },
  content: {
    padding: 18,
    justifyContent: "center",
  },
  title: {
    fontSize: 17,
    fontWeight: "800",
    fontFamily: "Inter-Bold",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: "500",
    fontFamily: "Inter-Medium",
    marginBottom: 10,
  },
  redMarginLine: {
    position: "absolute",
    left: 36,
    top: 0,
    bottom: 0,
    width: 1.5,
    backgroundColor: "rgba(255, 99, 71, 0.45)", // vertical red note margin
  },
  binderSpirals: {
    flexDirection: "row",
    justifyContent: "space-around",
    position: "absolute",
    top: -6,
    left: 20,
    right: 20,
    zIndex: 10,
  },
  spiralRing: {
    width: 6,
    height: 14,
    borderRadius: 3,
    backgroundColor: "#CCCCCC",
    borderWidth: 1,
    borderColor: "#999999",
  },
  // Decorative metallic rivets/screws for Dark metal plate
  screwOuter: {
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#4E5067",
    borderWidth: 1,
    borderColor: "#2E303D",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 15,
  },
  screwInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#777A99",
    alignItems: "center",
    justifyContent: "center",
  },
  screwThread: {
    width: 6,
    height: 1,
    backgroundColor: "#2E303D",
  },
});
