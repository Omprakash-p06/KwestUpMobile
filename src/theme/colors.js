export const dribbbleColors = {
  light: {
    primary: "#000000", // Ink-black primary for high contrast
    background: "#E4E2E1", // Warm industrial paper/concrete background
    cardBackground: "#FFFFFF", // Crisp white ledger sheet
    text: "#000000",
    secondaryText: "#474747",
    border: "#8E9192", // Defined metallic border boundaries
    accent: "#666666",
    success: "#333333",
    error: "#FF0000",
    warning: "#FF8800",
    cardBlue: "#E4E2E1",
    cardPink: "#E4E2E1",
    cardOrange: "#E4E2E1",
    cardGreen: "#E4E2E1",
  },
  dark: {
    primary: "#FFFFFF", // Pure white for structural active items
    background: "#131313", // Industrial obsidian base console
    cardBackground: "#20201F", // Machined dark slate console plate
    text: "#FFFFFF",
    secondaryText: "#C4C7C8",
    border: "#8E9192",
    accent: "#888888",
    success: "#FFFFFF",
    error: "#FF5555",
    warning: "#FFAA00",
    cardBlue: "#20201F",
    cardPink: "#20201F",
    cardOrange: "#20201F",
    cardGreen: "#20201F",
  },
  amoled: {
    primary: "#FFFFFF",
    background: "#000000", // True battery-saving black depth
    cardBackground: "#0E0E0E", // Extremely dark gray plates
    text: "#E5E2E1",
    secondaryText: "#8E9192",
    border: "#353535",
    accent: "#AAAAAA",
    success: "#FFFFFF",
    error: "#FF5555",
    warning: "#FFAA00",
    cardBlue: "#0E0E0E",
    cardPink: "#0E0E0E",
    cardOrange: "#0E0E0E",
    cardGreen: "#0E0E0E",
  },
};

export const themes = {
  clean: {
    light: { ...dribbbleColors.light, primary: "#000000" },
    dark: { ...dribbbleColors.dark, primary: "#FFFFFF" },
    amoled: { ...dribbbleColors.amoled, primary: "#FFFFFF" },
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
