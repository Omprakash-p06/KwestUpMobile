import React from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { styles } from "../theme/styles";

export const CustomDrawerContent = (props) => {
  const { state, currentTheme, userName, themeMode, setThemeMode } = props;
  const navigation = useNavigation();
  const currentRouteName = state?.routes?.[state?.index]?.name || "Dashboard";

  const drawerItems = [
    { key: "Dashboard", title: "Dashboard", icon: "view-dashboard", route: "Dashboard" },
    { key: "Daily", title: "Daily Tasks", icon: "bell", route: "Daily" },
    { key: "Birthdays", title: "Birthdays", icon: "cake", route: "Birthdays" },
    { key: "Tasks", title: "Task List", icon: "clipboard-list", route: "Tasks" },
    { key: "Notes", title: "Notes", icon: "notebook", route: "Notes" },
    { key: "Focus", title: "Focus Timer", icon: "timer", route: "Focus" },
    { key: "Settings", title: "Settings", icon: "cog", route: "Settings" },
    { key: "Search", title: "Search", icon: "magnify", route: "Search" },
  ];

  return (
    <SafeAreaView style={[styles.drawerContent, { backgroundColor: currentTheme.cardBackground }]}>
      <View style={styles.drawerHeader}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={[styles.drawerHeaderText, { color: currentTheme.primary }]}>
            KwestUp
          </Text>
          <TouchableOpacity 
            onPress={() => {
              if (navigation && typeof navigation.closeDrawer === 'function') {
                navigation.closeDrawer();
              }
            }}
            style={{ padding: 5 }}
          >
            <MaterialCommunityIcons name="close" size={24} color={currentTheme.text} />
          </TouchableOpacity>
        </View>
        {userName && (
          <Text style={[styles.drawerUserName, { color: currentTheme.secondaryText }]}>Welcome, {userName}!</Text>
        )}
      </View>
      <ScrollView style={styles.drawerItemsContainer}>
        {drawerItems.map((item) => (
          <TouchableOpacity
            key={item.key}
            style={[
              styles.drawerItem,
              currentRouteName === item.route && { backgroundColor: currentTheme.primary + "20" },
            ]}
            onPress={() => {
              if (navigation && typeof navigation.navigate === 'function') {
                navigation.navigate(item.route);
                if (typeof navigation.closeDrawer === 'function') {
                  navigation.closeDrawer();
                }
              }
            }}
          >
            <MaterialCommunityIcons
              name={item.icon}
              size={24}
              color={currentRouteName === item.route ? currentTheme.primary : currentTheme.text}
              style={styles.drawerItemIcon}
            />
            <Text
              style={[
                styles.drawerItemText,
                { color: currentRouteName === item.route ? currentTheme.primary : currentTheme.text },
              ]}
            >
              {item.title}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <View style={styles.drawerFooter}>
        <TouchableOpacity
          onPress={() => {
            const modes = ["light", "dark", "amoled"];
            const currentIndex = modes.indexOf(themeMode);
            const nextIndex = (currentIndex + 1) % modes.length;
            setThemeMode(modes[nextIndex]);
          }}
          style={styles.drawerFooterButton}
        >
          <MaterialCommunityIcons
            name={themeMode === "amoled" ? "monitor" : themeMode === "dark" ? "weather-night" : "weather-sunny"}
            size={24}
            color={currentTheme.text}
          />
          <Text style={[styles.drawerFooterText, { color: currentTheme.text }]}>
            {themeMode === "amoled" ? "AMOLED" : themeMode === "dark" ? "Dark Mode" : "Light Mode"}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};
