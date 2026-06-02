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
    text: "#FFFFFF", 
    secondaryText: "#C4C7C8", 
    cardBackground: "#20201F", 
    border: "#8E9192",
    primary: "#FFFFFF"
  };

  const isDark = currentTheme.background === "#131313";
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

  // Industrial Raised Bevel Styles (Sharp Perfect Rectangles, borderRadius: 0)
  const cardStyles = {
    backgroundColor: currentTheme.cardBackground,
    borderRadius: 0, // Enforce strict perfect square edges
    
    // Outward physical bevel shadow outlines
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    
    borderTopColor: isLightNotePaper ? "rgba(255, 255, 255, 0.75)" : "rgba(255, 255, 255, 0.18)",
    borderLeftColor: isLightNotePaper ? "rgba(255, 255, 255, 0.75)" : "rgba(255, 255, 255, 0.18)",
    borderBottomColor: isLightNotePaper ? "rgba(0, 0, 0, 0.22)" : "rgba(0, 0, 0, 0.75)",
    borderRightColor: isLightNotePaper ? "rgba(0, 0, 0, 0.22)" : "rgba(0, 0, 0, 0.75)",

    // Shadow profile
    shadowColor: "#000000",
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: isLightNotePaper ? 0.08 : 0.45,
    shadowRadius: 0, // Sharp shadow drop
    elevation: isLightNotePaper ? 3 : 8,
  };

  if (isAmoled) {
    cardStyles.borderTopWidth = 1;
    cardStyles.borderLeftWidth = 1;
    cardStyles.borderBottomWidth = 1;
    cardStyles.borderRightWidth = 1;
    cardStyles.borderColor = currentTheme.primary + "33"; // subtle glowing border
    cardStyles.shadowColor = currentTheme.primary;
    cardStyles.shadowOpacity = 0.1;
    cardStyles.shadowRadius = 4;
  }

  // Decorative corner screw rivets for tactile Dark Mode plate
  const renderScrewRivets = () => (
    <>
      <View style={[styles.screwOuter, { top: 8, left: 8 }]}>
        <View style={styles.screwInner}><View style={styles.screwThread} /></View>
      </View>
      <View style={[styles.screwOuter, { top: 8, right: 8 }]}>
        <View style={styles.screwInner}><View style={[styles.screwThread, { transform: [{ rotate: "135deg" }] }]} /></View>
      </View>
      <View style={[styles.screwOuter, { bottom: 8, left: 8 }]}>
        <View style={styles.screwInner}><View style={[styles.screwThread, { transform: [{ rotate: "90deg" }] }]} /></View>
      </View>
      <View style={[styles.screwOuter, { bottom: 8, right: 8 }]}>
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
        imageStyle={{ opacity: isLightNotePaper ? 0.35 : 0.08, borderRadius: 0 }}
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
    fontWeight: "900",
    fontFamily: "JetBrainsMono-Bold",
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: "500",
    fontFamily: "JetBrainsMono-Medium",
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
