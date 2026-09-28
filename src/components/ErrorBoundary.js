import React, { Component } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  Share,
  SafeAreaView,
  TouchableOpacity,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { logger } from "../utils/logger";
import { APP_VERSION, STORAGE_VERSION } from "../utils/storage";
import { CustomButton } from "./CustomButton";

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
      copiedToast: false,
    };
    this.toastTimeout = null;
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    logger.error("Unhandled React Error:", error?.message, errorInfo?.componentStack);
  }

  componentWillUnmount() {
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
      copiedToast: false,
    });
  };

  handleCopyReport = async () => {
    const { error, errorInfo } = this.state;
    const recentLogs = logger.getRecentLogs();

    const report = [
      "=== KwestUp Diagnostics & Crash Report ===",
      `Timestamp: ${new Date().toISOString()}`,
      `Platform: ${Platform.OS} (Version ${Platform.Version})`,
      `App Version: ${APP_VERSION}`,
      `Storage Version: ${STORAGE_VERSION}`,
      "",
      `Error: ${error?.name || "Error"}: ${error?.message || "Unknown error"}`,
      "",
      "--- Stack Trace ---",
      error?.stack || "No stack trace available",
      "",
      "--- Component Stack ---",
      errorInfo?.componentStack || "No component stack available",
      "",
      "--- Recent Forensic Breadcrumbs ---",
      JSON.stringify(recentLogs, null, 2),
    ].join("\n");

    try {
      if (Clipboard && typeof Clipboard.setStringAsync === "function") {
        await Clipboard.setStringAsync(report);
      } else {
        await Share.share({ title: "KwestUp Error Report", message: report });
      }
    } catch {
      try {
        await Share.share({ title: "KwestUp Error Report", message: report });
      } catch {
        // Fallback ignore
      }
    }

    this.setState({ copiedToast: true });
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      this.setState({ copiedToast: false });
    }, 3000);
  };

  toggleDetails = () => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  render() {
    const { hasError, error, errorInfo, showDetails, copiedToast } = this.state;
    const { children, fallback, currentTheme } = this.props;

    if (!hasError) {
      return children;
    }

    if (fallback) {
      return typeof fallback === "function" ? fallback(this.handleRetry) : fallback;
    }

    const isDark = !currentTheme || currentTheme.background !== "#FFFFFF" && currentTheme.background !== "#E4E2E1" && currentTheme.background !== "#F8FAFC";
    const backdropColor = isDark ? "#0F172A" : "#F8FAFC";
    const cardBgColor = isDark ? "#1E293B" : "#FFFFFF";
    const textColor = isDark ? "#F8FAFC" : "#0F172A";
    const secondaryTextColor = isDark ? "#94A3B8" : "#64748B";
    const borderColor = isDark ? "#334155" : "#E2E8F0";
    const accentColor = "#6366F1"; // Indigo primary per 19-UI-SPEC.md
    const destructiveColor = "#EF4444";

    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: backdropColor }]}>
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.card,
              {
                backgroundColor: cardBgColor,
                borderColor: borderColor,
              },
            ]}
          >
            {/* Warning Icon Badge */}
            <View style={styles.iconContainer}>
              <MaterialCommunityIcons
                name="alert-circle-outline"
                size={56}
                color={destructiveColor}
              />
            </View>

            {/* Display Title */}
            <Text style={[styles.title, { color: textColor }]}>
              Something Went Wrong
            </Text>

            {/* Reassurance Copy Contract */}
            <Text style={[styles.body, { color: secondaryTextColor }]}>
              KwestUp encountered an unexpected error. Your notes, tasks, and data remain safe on your device.
            </Text>

            {/* Actions */}
            <View style={styles.actionsContainer}>
              <CustomButton
                title="Try Again"
                onPress={this.handleRetry}
                color={accentColor}
                icon="refresh"
                style={styles.primaryButton}
              />

              <CustomButton
                title="Copy Error Report"
                onPress={this.handleCopyReport}
                outline
                color={textColor}
                icon="content-copy"
                style={styles.secondaryButton}
              />
            </View>

            {/* Copied Toast Banner */}
            {copiedToast && (
              <View style={[styles.toastBanner, { backgroundColor: "#10B981" }]}>
                <MaterialCommunityIcons name="check" size={16} color="#FFFFFF" style={styles.toastIcon} />
                <Text style={styles.toastText}>
                  Error report copied to clipboard
                </Text>
              </View>
            )}

            {/* Collapsible Diagnostic Details */}
            <TouchableOpacity
              onPress={this.toggleDetails}
              style={styles.detailsToggle}
              activeOpacity={0.7}
            >
              <Text style={[styles.detailsToggleText, { color: accentColor }]}>
                {showDetails ? "Hide Diagnostic Details" : "View Diagnostic Details"}
              </Text>
              <MaterialCommunityIcons
                name={showDetails ? "chevron-up" : "chevron-down"}
                size={18}
                color={accentColor}
              />
            </TouchableOpacity>

            {showDetails && (
              <View
                style={[
                  styles.traceBox,
                  {
                    backgroundColor: isDark ? "#0F172A" : "#F1F5F9",
                    borderColor: borderColor,
                  },
                ]}
              >
                <Text style={[styles.traceTitle, { color: secondaryTextColor }]}>
                  {error?.name || "Error"}: {error?.message}
                </Text>
                <ScrollView style={styles.traceScroll} nestedScrollEnabled>
                  <Text style={[styles.traceText, { color: secondaryTextColor }]}>
                    {error?.stack || "No stack trace available"}
                    {"\n\n"}
                    {errorInfo?.componentStack || ""}
                  </Text>
                </ScrollView>
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24, // lg (24px)
    paddingVertical: 48,   // 2xl (48px)
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 24, // lg (24px)
    alignItems: "center",
  },
  iconContainer: {
    marginBottom: 16, // md (16px)
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    lineHeight: 32,
    textAlign: "center",
    marginBottom: 8, // sm (8px)
    fontFamily: Platform.select({ ios: "System", android: "sans-serif-medium", default: "sans-serif" }),
  },
  body: {
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 24, // lg (24px)
  },
  actionsContainer: {
    width: "100%",
    gap: 12,
    marginBottom: 16, // md (16px)
  },
  primaryButton: {
    width: "100%",
  },
  secondaryButton: {
    width: "100%",
  },
  toastBanner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 16,
  },
  toastIcon: {
    marginRight: 6,
  },
  toastText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  detailsToggle: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    gap: 4,
  },
  detailsToggleText: {
    fontSize: 13,
    fontWeight: "600",
  },
  traceBox: {
    width: "100%",
    marginTop: 12,
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    maxHeight: 180,
  },
  traceTitle: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
    fontFamily: Platform.select({ ios: "Courier", android: "monospace", default: "monospace" }),
  },
  traceScroll: {
    maxHeight: 130,
  },
  traceText: {
    fontSize: 11,
    lineHeight: 15,
    fontFamily: Platform.select({ ios: "Courier", android: "monospace", default: "monospace" }),
  },
});

export default ErrorBoundary;
