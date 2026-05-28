# Validation: Phase 3 (Birthday Reminder Module)

This document outlines the testing and validation criteria for the **Birthday Reminder Module** phase.

---

## User Acceptance Criteria (UAT)

### UAT-1: Dynamic Countdown Sorting
- **Action**: Open the main side navigation drawer and click "Birthdays".
- **Result**: The Birthdays screen renders. Contacts are displayed sorted dynamically by the closest upcoming countdown (lowest `daysRemaining` first), prioritizing active alarms.

### UAT-2: Creating Birthday with Datetime pickers & Reminder Chips
- **Action**: Input name "Alice". Tap the date button and select a full birthdate `1995-10-15` in the calendar modal. Tap the time button and select `09:30 AM` in the time picker. Tap the `1 Day Before` advance reminder chip option. Click "Add Birthday".
- **Result**: Alice's birthday is created. Alice's card is added to the sorted list. A native success haptic click (`expo-haptics`) triggers immediately, and scheduled notification IDs are saved.

### UAT-3: Upgraded Birthday Card layouts
- **Action**: Inspect Alice's birthday card in the list.
- **Result**: The card body displays:
  - Display Date formatted to `Oct 15` next to a cake icon.
  - Bullet-divided countdown: e.g. `in 140 days` or `TODAY! 🎉🎂` (color-coded).
  - Turns milestone: `Turns 31 (Age: 30)`.

### UAT-4: Celebrations, Haptics, & Confetti Cannon Blasts
- **Action**: Tap the card or celebrate button for a contact whose birthday is today.
- **Result**: A safety celebrate confirmation dialog opens. Confirm the dialog.
- **Result**: A massive native confetti cannon blast (`react-native-confetti-cannon`) explodes across the screen body, and success haptic vibrations trigger.

### UAT-5: Dual push reminders & resets safety
- **Action**: Add a birthday set to tomorrow with a `1 Day Before` advance warning alert.
- **Result**: Two local alerts queue inside `expo-notifications`: one scheduled for tomorrow morning (morning-of birthday alert), and another scheduled for today (advance reminder alert).
- **Action**: Go to Settings and tap "Reset All Data".
- **Result**: All scheduled local alerts are canceled in the background logs, and birthday state arrays are wiped cleanly from AsyncStorage.

---

## Technical Verification

### 1. Code Review & Linting
- Verify that date calculations normalization handles leap years correctly.
- Execute ESLint validation:
  ```bash
  npm run lint
  ```
- **Falsifiable Pass**: Output contains `0 errors`.

### 2. Storage Persistence Integrity
- Inspect the serialized array cached under `kwestup_data_${STORAGE_VERSION}` inside AsyncStorage.
- **Falsifiable Pass**: Saved data string includes `"birthdays": [...]` array with full objects containing `id`, `name`, `birthDate`, `remindAtTime`, `advanceReminder`, and `notificationIds: [...]` array.
