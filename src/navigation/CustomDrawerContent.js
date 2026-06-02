import React from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

export const CustomDrawerContent = (props) => {
  const { state, currentTheme, userName, themeMode, setThemeMode } = props;
  const navigation = useNavigation();
  const currentRouteName = state?.routes?.[state?.index]?.name || "Dashboard";

  const drawerItems = [
    { key: "Dashboard", title: "Dashboard",    icon: "view-dashboard-outline", activeIcon: "view-dashboard",    route: "Dashboard" },
    { key: "Daily",     title: "Daily Tasks",   icon: "bell-outline",            activeIcon: "bell",              route: "Daily" },
    { key: "Birthdays", title: "Birthdays",     icon: "cake-variant-outline",    activeIcon: "cake-variant",      route: "Birthdays" },
    { key: "Tasks",     title: "Task List",     icon: "clipboard-list-outline",  activeIcon: "clipboard-list",    route: "Tasks" },
    { key: "Notes",     title: "Notes",         icon: "notebook-outline",        activeIcon: "notebook",          route: "Notes" },
    { key: "Focus",     title: "Focus Timer",   icon: "timer-outline",           activeIcon: "timer",             route: "Focus" },
    { key: "Search",    title: "Search",        icon: "magnify",                 activeIcon: "magnify",           route: "Search" },
    { key: "Settings",  title: "Settings",      icon: "cog-outline",             activeIcon: "cog",               route: "Settings" },
  ];

  const themeConfig = {
    light:  { icon: "weather-sunny",  label: "Light Mode" },
    dark:   { icon: "weather-night",  label: "Dark Mode" },
    amoled: { icon: "monitor",        label: "AMOLED" },
  };

  const cycleTheme = () => {
    const modes = ["light", "dark", "amoled"];
    setThemeMode(modes[(modes.indexOf(themeMode) + 1) % modes.length]);
  };

  const getInitials = (name) => {
    if (!name) return "K";
    const parts = name.trim().split(" ");
    return parts.length >= 2
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  };

  return (
    <SafeAreaView style={[localStyles.root, { backgroundColor: currentTheme.cardBackground }]}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View style={[localStyles.header, { borderBottomColor: currentTheme.border }]}>
        {/* Logo row */}
        <View style={localStyles.logoRow}>
          <View style={[localStyles.logoIconBox, { backgroundColor: currentTheme.primary }]}>
            <View style={localStyles.logoK}>
              <View style={[localStyles.logoKStem, { backgroundColor: currentTheme.onPrimary }]} />
              <View style={[localStyles.logoKDiag1, { backgroundColor: currentTheme.onPrimary }]} />
              <View style={[localStyles.logoKDiag2, { backgroundColor: currentTheme.onPrimary }]} />
            </View>
            <View style={localStyles.logoU}>
              <View style={[localStyles.logoULine, { backgroundColor: currentTheme.onPrimary }]} />
            </View>
          </View>
          <Text style={[localStyles.logoText, { color: currentTheme.text }]}>KwestUp</Text>
          <TouchableOpacity
            onPress={() => navigation?.closeDrawer?.()}
            style={localStyles.closeBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialCommunityIcons name="close" size={22} color={currentTheme.secondaryText} />
          </TouchableOpacity>
        </View>

        {/* User identity block */}
        <View style={localStyles.userRow}>
          <View style={[localStyles.avatar, { backgroundColor: currentTheme.primary + "22", borderColor: currentTheme.primary + "55" }]}>
            <Text style={[localStyles.avatarText, { color: currentTheme.primary }]}>
              {getInitials(userName)}
            </Text>
          </View>
          <View style={localStyles.userInfo}>
            <Text style={[localStyles.userName, { color: currentTheme.text }]}>
              {userName || "Guest"}
            </Text>
            <Text style={[localStyles.userSubtitle, { color: currentTheme.secondaryText }]}>
              KwestUp User
            </Text>
          </View>
        </View>
      </View>

      {/* ── Navigation Items ────────────────────────────────────────────────── */}
      <ScrollView
        style={localStyles.navList}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 12 }}
      >
        {drawerItems.map((item) => {
          const isActive = currentRouteName === item.route;
          return (
            <TouchableOpacity
              key={item.key}
              style={[
                localStyles.navItem,
                isActive && { backgroundColor: currentTheme.primary + "18" },
              ]}
              onPress={() => {
                navigation?.navigate?.(item.route);
                navigation?.closeDrawer?.();
              }}
              activeOpacity={0.75}
            >
              {/* Active indicator bar */}
              {isActive && (
                <View style={[localStyles.activeBar, { backgroundColor: currentTheme.primary }]} />
              )}
              <MaterialCommunityIcons
                name={isActive ? item.activeIcon : item.icon}
                size={22}
                color={isActive ? currentTheme.primary : currentTheme.secondaryText}
                style={localStyles.navIcon}
              />
              <Text
                style={[
                  localStyles.navLabel,
                  {
                    color: isActive ? currentTheme.primary : currentTheme.text,
                    fontWeight: isActive ? "700" : "500",
                    fontFamily: isActive ? "JetBrainsMono-Bold" : "JetBrainsMono-Medium",
                  },
                ]}
              >
                {item.title}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Footer: Theme Toggle ─────────────────────────────────────────────── */}
      <View style={[localStyles.footer, { borderTopColor: currentTheme.border }]}>
        <TouchableOpacity
          onPress={cycleTheme}
          style={[localStyles.themeBtn, { backgroundColor: currentTheme.primary + "12" }]}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons
            name={themeConfig[themeMode]?.icon || "weather-sunny"}
            size={20}
            color={currentTheme.primary}
          />
          <Text style={[localStyles.themeLabel, { color: currentTheme.text }]}>
            {themeConfig[themeMode]?.label || "Light Mode"}
          </Text>
          <MaterialCommunityIcons name="chevron-right" size={18} color={currentTheme.secondaryText} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const localStyles = StyleSheet.create({
  root: {
    flex: 1,
  },

  /* ── Header ────────────────────────────────────────────────── */
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  logoIconBox: {
    width: 36,
    height: 36,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    flexDirection: "row",
    gap: 2,
  },
  logoK: {
    width: 14,
    height: 24,
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
  },
  logoKStem: {
    width: 3,
    height: 24,
    borderRadius: 0,
  },
  logoKDiag1: {
    width: 3,
    height: 3,
    position: "absolute",
    top: 9,
    left: 3,
    transform: [{ rotate: "45deg" }],
  },
  logoKDiag2: {
    width: 3,
    height: 3,
    position: "absolute",
    top: 13,
    left: 5,
    transform: [{ rotate: "-45deg" }],
  },
  logoU: {
    width: 14,
    height: 24,
    alignItems: "center",
  },
  logoULine: {
    width: 3,
    height: 18,
    borderRadius: 0,
    position: "absolute",
    top: 3,
  },
  logoText: {
    flex: 1,
    fontSize: 22,
    fontWeight: "800",
    fontFamily: "JetBrainsMono-Bold",
    letterSpacing: -0.5,
  },
  closeBtn: {
    padding: 4,
  },

  /* ── User row ──────────────────────────────────────────────── */
  userRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: "800",
    fontFamily: "JetBrainsMono-Bold",
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "JetBrainsMono-Bold",
    marginBottom: 2,
  },
  userSubtitle: {
    fontSize: 12,
    fontWeight: "500",
    fontFamily: "JetBrainsMono-Medium",
  },

  /* ── Nav list ──────────────────────────────────────────────── */
  navList: {
    flex: 1,
    paddingTop: 8,
    paddingHorizontal: 12,
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 2,
    position: "relative",
    overflow: "hidden",
  },
  activeBar: {
    position: "absolute",
    left: 0,
    top: "20%",
    bottom: "20%",
    width: 3,
    borderRadius: 2,
  },
  navIcon: {
    marginRight: 14,
    marginLeft: 6,
  },
  navLabel: {
    fontSize: 15,
  },

  /* ── Footer ────────────────────────────────────────────────── */
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  themeBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  themeLabel: {
    flex: 1,
    marginLeft: 12,
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "JetBrainsMono-Bold",
  },
});
