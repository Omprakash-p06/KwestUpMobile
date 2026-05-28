# Phase 3 Technical Research: Birthday Reminder Module

This document provides technical ecosystem research, date math algorithms, and local push notification patterns for implementing **Phase 3: Birthday Reminder Module** in KwestUp Mobile.

---

## Standard Stack

* **State & Persistence**: `AsyncStorage` remains the source of truth, storing the `birthdays` array in a unified JSON cache key.
* **Date Entry Picker**: `@react-native-community/datetimepicker` (pre-installed) to pick the full birthdate (`YYYY-MM-DD`).
* **Haptics**: `expo-haptics` (pre-installed) to trigger success feedback when celebrating or adding birthdays.
* **Confetti Animations**: `react-native-confetti-cannon` (pre-installed) to generate hardware-accelerated confetti blasts on a birthday celebration card press.
* **Native Alerts**: `expo-notifications` (pre-installed) to register system-level local notifications, configure trigger dates, and cancel scheduled alerts.

---

## Architecture Patterns

### 1. Robust Birthday Data Schema
To calculate current/upcoming age and schedule advanced push notifications, we must upgrade from a simple `MM-DD` date string to a fully formed birthdate schema.

```typescript
interface Birthday {
  id: string;
  name: string;
  birthDate: string;           // "YYYY-MM-DD" or "MM-DD" if year is unknown
  remindAtTime: string;        // "HH:MM" format (defaults to "09:00")
  advanceReminder: 'none' | '1_day' | '3_days' | '1_week';
  notificationIds: string[];  // Tracking array to prevent ghost notifications on deletion
  createdAt: string;
}
```

### 2. Time-Safe Countdown & Age Calculator
Date calculations are notorious for rounding failures, timezone offsets, and leap-year bugs. To prevent these, we normalize dates to local midnight `setHours(0,0,0,0)` and compute date differences using UTC timestamps.

* **Remaining Days Algorithm**:
  1. Parse the target date's month and day.
  2. Create a date object for the birthday in the current calendar year.
  3. If that date has already passed this year, set the target year to the next calendar year.
  4. Subtract midnight today from the midnight target birthday, then divide by milliseconds-per-day to get absolute days.
* **Age Calculation**:
  * `Current Age = Target Year - Birth Year - 1`
  * If the birthday has occurred today or already passed this year: `Current Age = Target Year - Birth Year`.

### 3. Native Dual-Reminder Notification Scheduling
Reminders must support both the morning-of alert and custom advance warnings.
* **Alert Trigger Mathematics**:
  * **Morning-Of Trigger**: Trigger scheduled at `09:00 AM` on the contact's upcoming birthday date.
  * **Advance Alert Trigger**: Trigger scheduled at `09:00 AM` exactly `N` days prior to the contact's upcoming birthday date.
* **Clean State Transitions**:
  * When a birthday is deleted or renamed, we must cancel all IDs stored inside the contact's `notificationIds` tracking array to release resources.

---

## Don't Hand-Roll

* **Date-Difference Calculations**: Do not hand-roll complex day-of-year calculations or use heavy moment/date-fns libraries that bloat bundles. Use native `Date.getTime()` differences normalized to midnight.
* **Push Notification Badges**: Avoid building custom bridge handlers to clear system badge counts. Use `Notifications.setBadgeCountAsync(0)` during app startup inside `App.js`.

---

## Common Pitfalls

* **Leap Year Anniversaries**: Contacts born on Feb 29th will trigger invalid dates or crashes in non-leap years.
  * *Fix*: Safely fallback to March 1st in non-leap years for calculations and notifications:
    ```javascript
    const getSafeBdayDate = (year, month, day) => {
      const date = new Date(year, month, day);
      if (date.getMonth() !== month) {
        return new Date(year, month, day + 1); // Wraps safely
      }
      return date;
    };
    ```
* **Notification Scheduling Limit (iOS)**: iOS restricts each application to a maximum of 64 scheduled local notifications.
  * *Fix*: Only schedule alerts for birthdays occurring within the next 30 days, or limit the scheduled notifications to the next 64 upcoming birthdays.
* **Midnight Timezone Shifting**: Initializing `new Date("1995-12-17")` without an explicit time defaults to UTC, which shifts the day backward by one full day in Western timezones.
  * *Fix*: Always parse date strings into local integers `(year, month, day)` and construct dates using `new Date(year, month - 1, day)`.

---

## Code Examples

### Standardized Date Math Algorithm
A robust utility to calculate accurate countdowns and ages:

```javascript
export const getBirthdayStats = (birthDateString) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const parts = birthDateString.split('-');
  let birthYear = null;
  let month = 0;
  let day = 1;

  if (parts.length === 3) {
    birthYear = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10) - 1;
    day = parseInt(parts[2], 10);
  } else {
    month = parseInt(parts[0], 10) - 1;
    day = parseInt(parts[1], 10);
  }

  const currentYear = today.getFullYear();
  
  // Leap-safe date initialization
  let bdayThisYear = new Date(currentYear, month, day);
  if (bdayThisYear.getMonth() !== month) {
    bdayThisYear = new Date(currentYear, month, day + 1);
  }

  let nextBday = new Date(bdayThisYear);
  if (bdayThisYear < today) {
    nextBday.setFullYear(currentYear + 1);
    if (nextBday.getMonth() !== month) {
      nextBday = new Date(currentYear + 1, month, day + 1);
    }
  }

  const diffTime = nextBday.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  let age = null;
  let upcomingAge = null;
  if (birthYear) {
    upcomingAge = nextBday.getFullYear() - birthYear;
    age = upcomingAge - 1;
    if (diffDays === 0) {
      age = upcomingAge;
    }
  }

  return {
    daysRemaining: diffDays,
    age,
    upcomingAge,
    isToday: diffDays === 0
  };
};
```

### Scheduling Local Reminders
Helper function utilizing `expo-notifications` to schedule advanced alarms:

```javascript
import * as Notifications from 'expo-notifications';

export async function scheduleCustomBirthdayReminders(birthday) {
  const { name, birthDate, remindAtTime, advanceReminder } = birthday;
  const parts = birthDate.split('-');
  
  const month = parseInt(parts[parts.length === 3 ? 1 : 0], 10);
  const day = parseInt(parts[parts.length === 3 ? 2 : 1], 10);
  const [hours, minutes] = (remindAtTime || "09:00").split(':').map(Number);

  const notificationIds = [];

  try {
    // 1. Schedule Morning-Of Reminder
    const triggerDate = new Date();
    triggerDate.setHours(hours, minutes, 0, 0);
    
    // Set trigger date to upcoming birthday month/day
    let year = triggerDate.getFullYear();
    const bdayDate = new Date(year, month - 1, day, hours, minutes, 0);
    if (bdayDate < new Date()) {
      year += 1;
    }
    
    const targetBday = new Date(year, month - 1, day, hours, minutes, 0);

    const bdayNotifyId = await Notifications.scheduleNotificationAsync({
      content: {
        title: `🎂 Birthday Alert!`,
        body: `It's ${name}'s birthday today! Wish them the best! 🎉`,
        sound: 'default',
      },
      trigger: targetBday,
    });
    notificationIds.push(bdayNotifyId);

    // 2. Schedule Optional Advance Reminder
    if (advanceReminder && advanceReminder !== 'none') {
      let daysPrior = 1;
      if (advanceReminder === '3_days') daysPrior = 3;
      if (advanceReminder === '1_week') daysPrior = 7;

      const advanceTarget = new Date(targetBday);
      advanceTarget.setDate(targetBday.getDate() - daysPrior);

      if (advanceTarget > new Date()) {
        const advanceNotifyId = await Notifications.scheduleNotificationAsync({
          content: {
            title: `🎁 Birthday Coming Up!`,
            body: `${name}'s birthday is in ${daysPrior} days (${birthDate}). Don't forget to prepare!`,
            sound: 'default',
          },
          trigger: advanceTarget,
        });
        notificationIds.push(advanceNotifyId);
      }
    }
  } catch (error) {
    console.error("Failed to schedule reminders:", error);
  }

  return notificationIds;
}
```
