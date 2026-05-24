import { StyleSheet, Platform } from "react-native";

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  loadingTitle: {
    fontSize: 24,
    fontWeight: "700",
    marginTop: 16,
    marginBottom: 8,
  },
  loadingText: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 4,
  },
  // Custom Button Styles
  customButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
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
    position: "absolute",
    left: 12,
  },
  customTextInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: "transparent",
  },
  // Custom Card Styles
  customCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 5,
  },
  customSwitchLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  customSwitchTrack: {
    width: 45,
    height: 25,
    borderRadius: 15,
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  customSwitchThumb: {
    width: 21,
    height: 21,
    borderRadius: 10.5,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
    position: "absolute",
  },
  // Custom Segmented Buttons Styles
  segmentedButtonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  segmentedButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
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
    flexDirection: "row",
    alignItems: "flex-start",
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
    opacity: 0.9,
    fontWeight: "500",
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
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 5,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: "600",
    width: 100,
  },
  detailValue: {
    fontSize: 14,
    flex: 1,
    fontWeight: "500",
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
  },
  cardTags: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  taskTag: {
    marginRight: 8,
    marginBottom: 5,
  },
  cardAvatars: {
    flexDirection: "row",
    alignItems: "center",
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
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
  },
  infoText: {
    fontSize: 12,
    fontStyle: "italic",
    flexShrink: 1,
    fontWeight: "500",
  },
  timerTitle: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 16,
  },
  timerInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  timerInputLabel: {
    fontSize: 16,
    marginRight: 8,
    fontWeight: "600",
  },
  timerDurationInput: {
    width: 80,
    height: 40,
    textAlign: "center",
  },
  timerDisplayContainer: {
    marginBottom: 24,
    padding: 24,
    borderRadius: 16,
    borderWidth: 3,
    alignSelf: "center",
    elevation: 4,
    minWidth: 200,
    alignItems: "center",
  },
  timerDisplayText: {
    fontSize: 48,
    fontWeight: "900",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    textAlign: "center",
  },
  timerStatusText: {
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 4,
    letterSpacing: 1,
  },
  timerControls: {
    flexDirection: "row",
    gap: 16,
    justifyContent: "center",
  },
  timerButton: {
    borderRadius: 24,
    paddingVertical: 8,
    paddingHorizontal: 16,
    elevation: 3,
  },
  settingsTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 16,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingVertical: 4,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
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
    marginTop: 4,
    fontStyle: "italic",
  },
  actionButton: {
    marginBottom: 8,
  },
  githubButton: {
    marginTop: 10,
    alignSelf: "center",
  },
  nameInput: {
    marginTop: 12,
    alignSelf: 'stretch', // Ensure it takes width in the dialog
  },
  aboutText: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 8,
    lineHeight: 24,
    fontWeight: "500",
  },
  lockoutOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  lockoutContent: {
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    width: "85%",
    maxWidth: 350,
    elevation: 10,
  },
  lockoutTitle: {
    fontSize: 32,
    fontWeight: "800",
    marginBottom: 16,
    textAlign: "center",
  },
  lockoutMessage: {
    fontSize: 18,
    marginBottom: 16,
    textAlign: "center",
    fontWeight: "500",
  },
  lockoutTimer: {
    fontSize: 80,
    fontWeight: "900",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    marginBottom: 24,
    padding: 24,
    borderRadius: 100,
    borderWidth: 4,
  },
  modalOverlay: {
    justifyContent: "center",
    alignItems: "center",
  },
  dialogContent: {
    borderRadius: 16,
    padding: 24,
    width: "85%",
    maxWidth: 400,
    alignItems: "center",
  },
  dialogTitle: {
    textAlign: "center",
    fontWeight: "700",
    fontSize: 20,
    marginBottom: 10,
  },
  dialogMessage: {
    textAlign: "center",
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 20,
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
    textAlign: "center",
    paddingVertical: 20,
    fontSize: 16,
    fontWeight: "500",
  },
  insightRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
    height: 200,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
    marginTop: 20,
    borderWidth: 1,
  },
  // Drawer specific styles
  drawerContent: {
    flex: 1,
    paddingTop: Platform.OS === "android" ? 25 : 0, // Adjust for Android status bar
  },
  drawerHeader: {
    padding: 20,
    borderBottomWidth: 1,
    marginBottom: 10,
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
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginHorizontal: 10,
    borderRadius: 8,
    marginBottom: 5,
  },
  drawerItemIcon: {
    marginRight: 15,
  },
  drawerItemText: {
    fontSize: 18,
    fontWeight: "500",
  },
  drawerFooter: {
    padding: 20,
    borderTopWidth: 1,
  },
  drawerFooterButton: {
    flexDirection: "row",
    alignItems: "center",
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  chartBarsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-end",
    height: 150,
    marginBottom: 10,
  },
  chartColumn: {
    flexDirection: "column",
    justifyContent: "flex-end",
    alignItems: "center",
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
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 10,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 5,
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
    width: "48%",
    padding: 15,
    borderRadius: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
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
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
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
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    height: 70,
    borderTopWidth: 1,
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: Platform.OS === "ios" ? 15 : 0, // Adjust for iPhone X notch
  },
  bottomSubNavItem: {
    alignItems: "center",
    padding: 5,
  },
  bottomSubNavItemText: {
    fontSize: 12,
    marginTop: 5,
    fontWeight: "500",
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  taskTitle: {
    fontSize: 18,
    fontWeight: "600",
    flex: 1, // Allow title to wrap
  },
  taskDueDate: {
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 16,
  },
  taskCardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
  },
  taskStats: {
    flexDirection: "row",
    alignItems: "center",
  },
  taskStatText: {
    marginLeft: 5,
    fontSize: 14,
    fontWeight: "500",
  },
  completeButton: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  completeButtonText: {
    fontWeight: "bold",
    fontSize: 14,
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
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '500',
  },
  completedDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  completedTitle: {
    marginHorizontal: 12,
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#ccc',
  },
  tabBarItem: {
    flex: 1,
    padding: 10,
    borderBottomWidth: 2,
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
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    paddingBottom: 4,
    borderBottomWidth: 1,
  },
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  settingsLabel: {
    fontSize: 16,
  },
  settingsAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  settingsActionText: {
    fontSize: 16,
  },
});
