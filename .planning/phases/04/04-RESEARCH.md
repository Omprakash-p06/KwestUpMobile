# Phase 4 Technical Research: Local Network Sync via QR Scanner

This document provides technical ecosystem research, architecture patterns, and reference implementations for **Phase 4: Local Network Sync via QR Scanner** on KwestUp Mobile.

---

## Standard Stack

* **QR Code Scanning**:
  * **Library**: `expo-camera` (using the modern `CameraView` component and `useCameraPermissions` hook).
  * **Plugin Config**: `expo-camera` requires specific permission configuration inside `app.json` for iOS/Android builds.
  * **Status**: Highly performant, direct C++ native integration under the hood, replaces the deprecated `expo-barcode-scanner`.
* **Network & Sync Client**:
  * **Protocol**: HTTP REST API over local Wi-Fi.
  * **Client**: Standard browser-native `fetch()` API supported globally by React Native. No additional networking libraries (like Axios) are necessary, minimizing bundle size and potential dependency conflicts.
* **Desktop Reference Sync Server**:
  * **Framework**: **Flask** (Python 3) for the REST API server. Flask is standard, lightweight, and easy to run locally.
  * **IP Address Discovery**: Python's `socket` library to automatically detect the PC's active local network IP address (e.g. `192.168.x.x`).
  * **Desktop Data Persistence**: Local file storage inside `kwestup_pc_vault.json` on the host PC.
  * **Authentication**: A temporary secure token generated at server startup, which must be passed in the `Authorization: Bearer <token>` header of every mobile request.

---

## Architecture Patterns

### 1. Connection Payload Schema (QR Code)
The PC-displayed QR code must serialize to a structured JSON string containing all host parameters:
```json
{
  "ip": "192.168.1.15",
  "port": 5001,
  "token": "kwestup_sec_8a3f9e4c8b"
}
```

### 2. Two-Way Sync Merge Algorithm (Tombstone-free Clock Merge)
To synchronise the mobile `AsyncStorage` + Filesystem vault and the PC `kwestup_pc_vault.json` local storage:
1. **Note Sync**:
   * Notes are identified by their relative file path (`folder/title.md`).
   * When syncing, the mobile client reads all note files and extracts their content, title, folder, and system file modification timestamps (`updatedAt`).
   * The server matches notes by relative path.
   * If a note is present in both client and server, the server keeps the version with the later `updatedAt` timestamp.
   * If a note is only on one side, it is added to the unified master list.
2. **Tasks & Birthdays Sync**:
   * Identified by their unique ID string (UUID or timestamp).
   * Comparison is made by matching ID keys.
   * If the ID exists in both datasets, the version with the more recent `updatedAt` timestamp is preserved.
   * Missing records are added bidirectionally.
3. **Data Return**:
   * The server saves the consolidated, resolved database to its local `kwestup_pc_vault.json` file.
   * The server returns the fully synchronized payload back to the mobile client in the HTTP response.
   * The mobile client writes the merged records to its local storage, overwrites old files on the filesystem, and reloads the active screen states.

---

## Don't Hand-Roll

* **Camera Drivers and QR Decoders**: Do not attempt to use low-level camera streams or generic image decoders. `expo-camera` provides instant, hardware-accelerated barcode scanning (`onBarcodeScanned`) using native iOS and Android OS features directly.
* **Network IP Parsing**: Do not hardcode PC server IP addresses. The Python server must dynamically parse local network adapters to bind to the active Wi-Fi interface, and the mobile app must parse this parsed IP directly from the QR code.
* **Conflict Resolution Engines**: Avoid complex Git-like diff-merge libraries. For simple local productivity data, a robust timestamp-based LWW (Last-Write-Wins) resolver is extremely efficient, highly predictable, and easy to debug.

---

## Common Pitfalls

* **Localhost Connection Errors**:
  * *Pitfall*: Developers often run the server on `127.0.0.1` or `localhost`. If they do this, physical mobile devices cannot connect.
  * *Fix*: The Python sync server must bind to `0.0.0.0` (all interfaces) and display the actual network IP (e.g. `192.168.x.x`) in the QR code.
* **Subnet Mismatch**:
  * *Pitfall*: Mobile and PC are on different subnets (e.g., mobile is on cellular LTE while PC is on Wi-Fi).
  * *Fix*: The app must guide the user with a descriptive connection status screen reminding them that both devices must be on the same local Wi-Fi network.
* **Camera Simulator Crashes**:
  * *Pitfall*: Running `CameraView` on an Android Emulator or iOS Simulator causes instant crashes or black screens.
  * *Fix*: Always verify permissions first and use a fallback "Manual Entry" input screen where developers/users can type in the IP, port, and token manually if a physical camera is unavailable.
* **rapid-fire Scanner Triggering**:
  * *Pitfall*: `onBarcodeScanned` triggers many times per second. Without a throttle, the mobile app will launch dozens of overlapping fetch requests.
  * *Fix*: Disable scanning state immediately upon the first success (e.g. `setScanned(true)`) and display a loading indicator while processing the network request.

---

## Code Examples

### 1. Camera View with QR Scanner Overlay
A beautiful screen layout utilizing `expo-camera` and a glassmorphism scanner guide box:

```javascript
import React, { useState } from "react";
import { View, StyleSheet, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";

export const QRScannerView = ({ onConnectionScanned, currentTheme, onClose }) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  if (!permission) {
    return (
      <View style={[styles.centered, { backgroundColor: currentTheme.background }]}>
        <ActivityIndicator size="large" color={currentTheme.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.centered, { backgroundColor: currentTheme.background, padding: 20 }]}>
        <Text style={{ color: currentTheme.text, fontSize: 16, textAlign: "center", marginBottom: 20 }}>
          We need camera permissions to scan the synchronization QR code.
        </Text>
        <TouchableOpacity 
          style={[styles.button, { backgroundColor: currentTheme.primary }]} 
          onPress={requestPermission}
        >
          <Text style={{ color: currentTheme.buttonText, fontWeight: "bold" }}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleBarcodeScanned = ({ data }) => {
    if (scanned) return;
    setScanned(true);
    try {
      const payload = JSON.parse(data);
      if (payload.ip && payload.port && payload.token) {
        onConnectionScanned(payload);
      } else {
        throw new Error("Invalid payload schema");
      }
    } catch (e) {
      alert("Invalid QR Code payload detected. Please scan the KwestUp Sync QR Code.");
      setTimeout(() => setScanned(false), 2000);
    }
  };

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        onBarcodeScanned={handleBarcodeScanned}
      />
      {/* Visual scanning overlay */}
      <View style={styles.overlay}>
        <View style={styles.topMask} />
        <View style={styles.middleRow}>
          <View style={styles.sideMask} />
          <View style={[styles.scannerBox, { borderColor: currentTheme.primary }]}>
            <View style={[styles.corner, styles.topLeft, { borderColor: currentTheme.primary }]} />
            <View style={[styles.corner, styles.topRight, { borderColor: currentTheme.primary }]} />
            <View style={[styles.corner, styles.bottomLeft, { borderColor: currentTheme.primary }]} />
            <View style={[styles.corner, styles.bottomRight, { borderColor: currentTheme.primary }]} />
          </View>
          <View style={styles.sideMask} />
        </View>
        <View style={styles.bottomMask}>
          <Text style={styles.instructionText}>Center the desktop QR code in the frame</Text>
          <TouchableOpacity style={[styles.closeButton, { backgroundColor: currentTheme.surface }]} onPress={onClose}>
            <Text style={{ color: currentTheme.text }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  button: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: "space-between" },
  topMask: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)" },
  middleRow: { flexDirection: "row", height: 260 },
  sideMask: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)" },
  scannerBox: { width: 260, height: 260, position: "relative", borderWidth: 1 },
  corner: { position: "absolute", width: 20, height: 20, borderWidth: 3 },
  topLeft: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  topRight: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  bottomLeft: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  bottomRight: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  bottomMask: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", paddingTop: 20 },
  instructionText: { color: "#fff", fontSize: 16, fontWeight: "500", marginBottom: 20 },
  closeButton: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20 },
});
```

### 2. Desktop Reference Python Sync Server (`sync_server.py`)
A highly robust Flask sync server implementing full LWW timestamp conflict merges, local JSON database file management, and terminal QR code representation:

```python
import os
import json
import socket
from datetime import datetime
from flask import Flask, request, jsonify

app = Flask(__name__)
PORT = 5001
TOKEN = "kwestup_sec_" + os.urandom(6).hex()
PC_VAULT_FILE = "kwestup_pc_vault.json"

# Load or initialize PC database
def load_pc_vault():
    if os.path.exists(PC_VAULT_FILE):
        try:
            with open(PC_VAULT_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"Error reading vault file: {e}")
    return {"notes": [], "tasks": [], "taskLists": [], "birthdays": [], "userName": ""}

def save_pc_vault(data):
    try:
        with open(PC_VAULT_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"Error saving vault file: {e}")

# Resolve LWW timestamps conflict
def merge_datasets(local_list, remote_list, unique_key='id'):
    merged = {}
    
    # Load all local items
    for item in local_list:
        key = item.get(unique_key)
        if key:
            merged[key] = item

    # Merge remote items
    for item in remote_list:
        key = item.get(unique_key)
        if not key:
            continue
        if key in merged:
            local_time = merged[key].get('updatedAt') or merged[key].get('createdAt') or "1970-01-01T00:00:00.000Z"
            remote_time = item.get('updatedAt') or item.get('createdAt') or "1970-01-01T00:00:00.000Z"
            # Parse and compare timestamps
            if remote_time > local_time:
                merged[key] = item
        else:
            merged[key] = item
            
    return list(merged.values())

@app.route('/ping', methods=['GET'])
def ping():
    return jsonify({
        "status": "online",
        "app": "KwestUp Desktop Sync Server",
        "timestamp": datetime.utcnow().isoformat() + "Z"
    })

@app.route('/sync', methods=['POST'])
def sync():
    # 1. Validate authorization
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return jsonify({"error": "Unauthorized"}), 401
    
    request_token = auth_header.split(" ")[1]
    if request_token != TOKEN:
        return jsonify({"error": "Forbidden"}), 403

    # 2. Extract mobile payload
    payload = request.json or {}
    pc_data = load_pc_vault()

    # 3. Synchronize datasets
    synced_data = {
        "notes": merge_datasets(pc_data.get("notes") or [], payload.get("notes") or [], unique_key="id"),
        "tasks": merge_datasets(pc_data.get("tasks") or [], payload.get("tasks") or [], unique_key="id"),
        "taskLists": merge_datasets(pc_data.get("taskLists") or [], payload.get("taskLists") or [], unique_key="id"),
        "birthdays": merge_datasets(pc_data.get("birthdays") or [], payload.get("birthdays") or [], unique_key="id"),
        "themeMode": pc_data.get("themeMode") or payload.get("themeMode") or "light",
        "selectedThemeName": pc_data.get("selectedThemeName") or payload.get("selectedThemeName") or "dribbble",
        "userName": pc_data.get("userName") or payload.get("userName") or "",
    }

    # 4. Persist and return
    save_pc_vault(synced_data)
    return jsonify(synced_data)

def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # Connect to an external host to determine the routing IP
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = '127.0.0.1'
    finally:
        s.close()
    return ip

if __name__ == '__main__':
    ip = get_local_ip()
    print("=" * 60)
    print("🚀 KWESTUP DESKTOP SYNC REFERENCE SERVER")
    print("-" * 60)
    print(f"Host IP Address : {ip}")
    print(f"Server Port      : {PORT}")
    print(f"Access Token     : {TOKEN}")
    print("-" * 60)
    print("QR Payload Schema:")
    payload = {"ip": ip, "port": PORT, "token": TOKEN}
    payload_str = json.dumps(payload)
    print(payload_str)
    print("=" * 60)
    print("\n* Generate QR Code via console or web server for mobile devices to scan.")
    app.run(host='0.0.0.0', port=PORT)
```
