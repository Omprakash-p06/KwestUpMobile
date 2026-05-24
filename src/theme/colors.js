export const dribbbleColors = {
  light: {
    primary: "#8E7BEF", // Main accent blue/purple
    background: "#F0E6F8", // Light lavender background
    cardBackground: "#FFFFFF",
    text: "#333333",
    secondaryText: "#666666",
    border: "#E0E0E0",
    accent: "#FFC107", // Yellow for highlights
    success: "#8BC34A", // Green for success
    error: "#F44336", // Red for error
    warning: "#FFB366", // Orange for warning
    // Specific colors from Dribbble image cards
    cardBlue: "#8E7BEF",
    cardPink: "#F381C1",
    cardOrange: "#FFB366",
    cardGreen: "#8BC34A",
  },
  dark: {
    primary: "#A799FF", // Lighter primary for dark mode
    background: "#282A36", // Dark background
    cardBackground: "#3A3C4E", // Darker card background
    text: "#F8F8F2",
    secondaryText: "#BD93F9",
    border: "#44475A",
    accent: "#FFD54F",
    success: "#A5D6A7",
    error: "#EF9A9A",
    warning: "#FFB74D",
    // Specific colors for dark mode cards (adjusted)
    cardBlue: "#A799FF",
    cardPink: "#FF99CC",
    cardOrange: "#FFC98A",
    cardGreen: "#A5D6A7",
  },
  amoled: {
    primary: "#A799FF", // Lighter primary for AMOLED mode
    background: "#000000", // True black for AMOLED
    cardBackground: "#111111", // Very dark gray for cards
    text: "#FFFFFF",
    secondaryText: "#CCCCCC",
    border: "#333333",
    accent: "#FFD54F",
    success: "#A5D6A7",
    error: "#EF9A9A",
    warning: "#FFB74D",
    // Specific colors for AMOLED mode
    cardBlue: "#A799FF",
    cardPink: "#FF99CC",
    cardOrange: "#FFC98A",
    cardGreen: "#A5D6A7",
  },
};

export const themes = {
  clean: {
    light: { ...dribbbleColors.light, primary: "#4A90E2" },
    dark: { ...dribbbleColors.dark, primary: "#79B8F3" },
    amoled: { ...dribbbleColors.amoled, primary: "#79B8F3" },
  },
  blue: {
    light: { ...dribbbleColors.light, primary: "#2196F3" },
    dark: { ...dribbbleColors.dark, primary: "#64B5F6" },
    amoled: { ...dribbbleColors.amoled, primary: "#64B5F6" },
  },
  green: {
    light: { ...dribbbleColors.light, primary: "#4CAF50" },
    dark: { ...dribbbleColors.dark, primary: "#81C784" },
    amoled: { ...dribbbleColors.amoled, primary: "#81C784" },
  },
  purple: {
    light: { ...dribbbleColors.light, primary: "#9C27B0" },
    dark: { ...dribbbleColors.dark, primary: "#BA68C8" },
    amoled: { ...dribbbleColors.amoled, primary: "#BA68C8" },
  },
  dribbble: {
    light: dribbbleColors.light,
    dark: dribbbleColors.dark,
    amoled: dribbbleColors.amoled,
  },
};
