import { StyleSheet, Platform } from "react-native";

const rawStyles = {
  container: {
    flex: 1,
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  loadingTitle: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 8,
    marginTop: 16,
  },
  loadingText: {
    fontSize: 14,
    marginBottom: 4,
    textAlign: "center",
  },
  // Custom Button Styles
  customButton: {
    alignItems: "center",
    borderRadius: 8,
    elevation: 2,
    flexDirection: "row",
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  customButtonDisabled: {
    opacity: 0.7,
  },
  customButtonIcon: {
    marginRight: 8,
  },
  customButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  // Custom TextInput Styles
  customTextInputContainer: {
    marginBottom: 15,
  },
  customTextInputLabel: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 5,
  },
  customTextInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1, // This is now controlled inline
    borderRadius: 8,
  },
  customTextInputIcon: {
    left: 12,
    position: "absolute",
  },
  customTextInput: {
    backgroundColor: "transparent",
    flex: 1,
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  // Custom Card Styles
  customCard: {
    borderRadius: 12,
    marginBottom: 16,
    padding: 16,
    // Base shadow is removed from here and applied dynamically in TaskCard
  },
  // Custom Badge Styles
  customBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: "flex-start",
    flexDirection: "row", // To align text and icon if any
    alignItems: "center",
  },
  customBadgeText: {
    fontSize: 10,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  // Custom Switch Styles
  customSwitchContainer: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
  },
  customSwitchLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  customSwitchTrack: {
    borderRadius: 15,
    height: 25,
    justifyContent: "center",
    paddingHorizontal: 2,
    width: 45,
  },
  customSwitchThumb: {
    backgroundColor: "#fff",
    borderRadius: 10.5,
    elevation: 2,
    height: 21,
    position: "absolute",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    width: 21,
  },
  // Custom Segmented Buttons Styles
  segmentedButtonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  segmentedButton: {
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },

  tabContentScroll: {
    flex: 1,
  },
  tabContent: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
  },
  inputRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  textInputFlex: {
    flex: 1,
  },
  textInputTimeButton: {
    width: 100,
  },
  textInputDateButton: {
    width: 120,
  },
  fullWidthButton: {
    marginTop: 8,
  },
  medicalCardWrapper: {
    marginBottom: 16,
  },
  cardHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  cardTitleContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  cardCode: {
    fontSize: 14,
    fontWeight: "500",
    opacity: 0.9,
  },
  cardMenuButton: {
    padding: 5,
  },
  deleteButton: {
    padding: 8,
  },
  cardDetails: {
    marginBottom: 10,
  },
  detailRow: {
    alignItems: "center",
    flexDirection: "row",
    marginBottom: 5,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: "600",
    width: 100,
  },
  detailValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
  },
  cardFooter: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  cardTags: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  taskTag: {
    marginBottom: 5,
    marginRight: 8,
  },
  cardAvatars: {
    alignItems: "center",
    flexDirection: "row",
    marginTop: 10,
  },
  cardActionsOverlay: {
    // This is for the swipe actions, not visible in Dribbble UI
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
  },
  infoTextContainer: {
    alignItems: "flex-start",
    borderRadius: 8,
    flexDirection: "row",
    marginTop: 16,
    padding: 12,
  },
  infoText: {
    flexShrink: 1,
    fontSize: 12,
    fontStyle: "italic",
    fontWeight: "500",
  },
  timerTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 16,
    textAlign: "center",
  },
  timerInputContainer: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 16,
  },
  timerInputLabel: {
    fontSize: 16,
    fontWeight: "600",
    marginRight: 8,
  },
  timerDurationInput: {
    height: 40,
    textAlign: "center",
    width: 80,
  },
  timerDisplayContainer: {
    alignItems: "center",
    alignSelf: "center",
    borderRadius: 16,
    borderWidth: 3,
    elevation: 4,
    marginBottom: 24,
    minWidth: 200,
    padding: 24,
  },
  timerDisplayText: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 48,
    fontWeight: "900",
    textAlign: "center",
  },
  timerStatusText: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    marginTop: 4,
    textAlign: "center",
  },
  timerControls: {
    flexDirection: "row",
    gap: 16,
    justifyContent: "center",
  },
  timerButton: {
    borderRadius: 24,
    elevation: 3,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  settingsTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 16,
  },
  settingRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingVertical: 4,
  },
  settingLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
  },
  settingValue: {
    fontSize: 14,
    fontWeight: "500",
  },
  settingInput: {
    flex: 1,
    marginLeft: 12,
  },
  settingDescription: {
    fontSize: 12,
    fontStyle: "italic",
    marginTop: 4,
  },
  actionButton: {
    marginBottom: 8,
  },
  githubButton: {
    alignSelf: "center",
    marginTop: 10,
  },
  nameInput: {
    alignSelf: 'stretch',
    marginTop: 12, // Ensure it takes width in the dialog
  },
  aboutText: {
    fontSize: 16,
    fontWeight: "500",
    lineHeight: 24,
    marginBottom: 8,
    textAlign: "center",
  },
  lockoutOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  lockoutContent: {
    alignItems: "center",
    borderRadius: 16,
    elevation: 10,
    maxWidth: 350,
    padding: 24,
    width: "85%",
  },
  lockoutTitle: {
    fontSize: 32,
    fontWeight: "800",
    marginBottom: 16,
    textAlign: "center",
  },
  lockoutMessage: {
    fontSize: 18,
    fontWeight: "500",
    marginBottom: 16,
    textAlign: "center",
  },
  lockoutTimer: {
    borderRadius: 100,
    borderWidth: 4,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 80,
    fontWeight: "900",
    marginBottom: 24,
    padding: 24,
  },
  modalOverlay: {
    alignItems: "center",
    justifyContent: "center",
  },
  dialogContent: {
    alignItems: "center",
    borderRadius: 16,
    maxWidth: 400,
    padding: 24,
    width: "85%",
  },
  dialogTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 10,
    textAlign: "center",
  },
  dialogMessage: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 20,
    textAlign: "center",
  },
  dialogActions: {
    flexDirection: "row",
    justifyContent: "center",
    width: "100%",
  },
  dialogButton: {
    flex: 1,
    marginHorizontal: 5,
  },
  searchInput: {
    marginBottom: 20,
  },
  emptyListText: {
    fontSize: 16,
    fontWeight: "500",
    paddingVertical: 20,
    textAlign: "center",
  },
  insightRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  insightLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  insightValue: {
    fontSize: 16,
    fontWeight: "700",
  },
  divider: {
    height: 1,
    marginVertical: 10,
  },
  chartPlaceholder: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    height: 200,
    justifyContent: "center",
    marginTop: 20,
  },
  // Drawer specific styles
  drawerContent: {
    flex: 1,
    paddingTop: Platform.OS === "android" ? 25 : 0, // Adjust for Android status bar
  },
  drawerHeader: {
    borderBottomWidth: 1,
    marginBottom: 10,
    padding: 20,
  },
  drawerHeaderText: {
    fontSize: 24,
    fontWeight: "bold",
  },
  drawerUserName: {
    fontSize: 16,
    marginTop: 5,
  },
  drawerItemsContainer: {
    flex: 1,
  },
  drawerItem: {
    alignItems: "center",
    borderRadius: 8,
    flexDirection: "row",
    marginBottom: 5,
    marginHorizontal: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  drawerItemIcon: {
    marginRight: 15,
  },
  drawerItemText: {
    fontSize: 18,
    fontWeight: "500",
  },
  drawerFooter: {
    borderTopWidth: 1,
    padding: 20,
  },
  drawerFooterButton: {
    alignItems: "center",
    flexDirection: "row",
    paddingVertical: 10,
  },
  drawerFooterText: {
    fontSize: 16,
    marginLeft: 15,
  },
  // Dribbble Dashboard Styles
  dashboardSectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 15,
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  summaryCard: {
    width: "48%", // Roughly half width for two columns
    marginBottom: 15,
    padding: 15,
    borderRadius: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 5,
  },
  summaryCardHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  summaryCardCount: {
    fontSize: 32,
    fontWeight: "800",
  },
  summaryCardLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  chartHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 15,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  chartBarsContainer: {
    alignItems: "flex-end",
    flexDirection: "row",
    height: 150,
    justifyContent: "space-around",
    marginBottom: 10,
  },
  chartColumn: {
    alignItems: "center",
    flexDirection: "column",
    justifyContent: "flex-end",
    width: 20, // Width of each bar group
  },
  chartBar: {
    width: 8, // Width of individual bar
    borderRadius: 2,
    marginBottom: 2,
  },
  chartLabel: {
    fontSize: 12,
    marginTop: 5,
  },
  chartLegend: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 10,
  },
  legendItem: {
    alignItems: "center",
    flexDirection: "row",
    marginHorizontal: 10,
  },
  legendColor: {
    borderRadius: 6,
    height: 12,
    marginRight: 5,
    width: 12,
  },
  legendText: {
    fontSize: 12,
  },
  bottomSummaryGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },
  bottomSummaryCard: {
    borderRadius: 15,
    elevation: 2,
    padding: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    width: "48%",
  },
  bottomSummaryTitle: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 5,
  },
  bottomSummaryValue: {
    fontSize: 20,
    fontWeight: "700",
  },
  // Dribbble Task List Styles
  taskListFilters: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 20,
    backgroundColor: "#F0F0F0", // Light background for filters
    borderRadius: 10,
    padding: 5,
  },
  filterButton: {
    alignItems: "center",
    borderRadius: 8,
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    paddingVertical: 10,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  fab: {
    position: "absolute",
    bottom: 100, // Above the bottom sub-nav
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  bottomSubNav: {
    alignItems: "center",
    borderTopWidth: 1,
    bottom: 0,
    flexDirection: "row",
    height: 70,
    justifyContent: "space-around",
    left: 0,
    paddingBottom: Platform.OS === "ios" ? 15 : 0,
    position: "absolute",
    right: 0, // Adjust for iPhone X notch
  },
  bottomSubNavItem: {
    alignItems: "center",
    padding: 5,
  },
  bottomSubNavItemText: {
    fontSize: 12,
    fontWeight: "500",
    marginTop: 5,
  },
  taskCard: {
    borderRadius: 16,
    padding: 16,
    marginVertical: 8,
    marginHorizontal: 16,
    borderWidth: 1,
    elevation: 3, // Android shadow
    shadowOffset: { width: 0, height: 2 }, // iOS shadow
    shadowOpacity: 0.1,
    shadowRadius: 5,
  },
  taskCardHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  taskTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "600", // Allow title to wrap
  },
  taskDueDate: {
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 16,
  },
  taskCardFooter: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },
  taskStats: {
    alignItems: "center",
    flexDirection: "row",
  },
  taskStatText: {
    fontSize: 14,
    fontWeight: "500",
    marginLeft: 5,
  },
  completeButton: {
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  completeButtonText: {
    fontSize: 14,
    fontWeight: "bold",
  },
  screen: {
    flex: 1,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  emptyStateContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 50,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '500',
  },
  completedDivider: {
    alignItems: 'center',
    flexDirection: 'row',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  completedTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginHorizontal: 12,
    textTransform: 'uppercase',
  },
  tabBar: {
    alignItems: 'center',
    borderTopColor: '#ccc',
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
  },
  tabBarItem: {
    borderBottomWidth: 2,
    flex: 1,
    padding: 10,
  },
  tabBarText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Settings Page Specific Styles
  settingsContainer: {
    flex: 1,
    padding: 16,
  },
  settingsHeader: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 16,
  },
  settingsSection: {
    marginBottom: 24,
  },
  settingsSectionTitle: {
    borderBottomWidth: 1,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    paddingBottom: 4,
  },
  settingsRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  settingsLabel: {
    fontSize: 16,
  },
  settingsAction: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  settingsActionText: {
    fontSize: 16,
  },
};

const injectFontFamily = (obj) => {
  const fontRegular = "HankenGrotesk-Regular";
  const fontMedium = "HankenGrotesk-Medium";
  const fontSemiBold = "HankenGrotesk-Bold";
  const fontBold = "HankenGrotesk-ExtraBold";

  const monoRegular = "JetBrainsMono-Regular";
  const monoMedium = "JetBrainsMono-Medium";
  const monoBold = "JetBrainsMono-Bold";

  for (const key in obj) {
    if (obj[key] && typeof obj[key] === "object") {
      const style = obj[key];
      // Check if this style has any text-related properties
      const hasTextProp =
        style.fontSize !== undefined ||
        style.color !== undefined ||
        style.lineHeight !== undefined ||
        style.textAlign !== undefined ||
        style.fontStyle !== undefined ||
        style.fontWeight !== undefined;

      if (hasTextProp) {
        const isMono = 
          (style.fontFamily && (style.fontFamily === "monospace" || style.fontFamily === "Menlo")) ||
          key.toLowerCase().includes("timer") || 
          key.toLowerCase().includes("mono") || 
          key.toLowerCase().includes("label") || 
          key.toLowerCase().includes("technical") || 
          key.toLowerCase().includes("code") ||
          key.toLowerCase().includes("logs") ||
          key.toLowerCase().includes("tag") ||
          key.toLowerCase().includes("version");

        if (isMono) {
          if (style.fontWeight && (style.fontWeight === "bold" || style.fontWeight === "700" || style.fontWeight === "800" || style.fontWeight === "900")) {
            style.fontFamily = monoBold;
          } else {
            style.fontFamily = monoMedium;
          }
          continue;
        }

        // Determine weight
        if (style.fontWeight) {
          const weight = String(style.fontWeight);
          if (weight === "bold" || weight === "700" || weight === "800" || weight === "900") {
            style.fontFamily = fontBold;
          } else if (weight === "600") {
            style.fontFamily = fontSemiBold;
          } else if (weight === "500") {
            style.fontFamily = fontMedium;
          } else {
            style.fontFamily = fontRegular;
          }
        } else {
          style.fontFamily = fontRegular;
        }
      }
    }
  }
};

injectFontFamily(rawStyles);

export const styles = StyleSheet.create(rawStyles);
