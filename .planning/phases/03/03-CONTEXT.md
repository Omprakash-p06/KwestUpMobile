# Phase 3 Context: Birthday Reminder Module

This document records the architectural context and design decisions established during the research and development of **Phase 3: Birthday Reminder Module**.

---

## Architectural Decisions

### 1. Complete Birthdate & Alert Schema
* We decided to upgrade the birthday model to support complete birthdates (`YYYY-MM-DD` or `MM-DD` if birth year is unknown).
* This provides full support for displaying turn-milestone descriptions on contact cards while preserving flexibility.
* Added custom alert trigger times and advance remind chips selections to allow users to customize their push schedules.

### 2. Leap-Safe Calculation Math
* Normalized dates to local midnight UTC to bypass time-zone shifting bugs.
* Configured automated wrap checks: if a contact is born on February 29th, the system safely triggers calculations on March 1st in non-leap calendar years.

### 3. Dual-Reminder Alarms Engine
* Built standalone alert schedulers inside `src/utils/notifications.js` leveraging `expo-notifications`.
* Each contact tracks an array of generated scheduled IDs (`notificationIds`) to allow automated cancellations when a contact is renamed, updated, or deleted.
* Added safety background purge routines to clean up scheduled alarms during complete application data resets.
