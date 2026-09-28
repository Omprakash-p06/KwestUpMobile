---
phase: 19
slug: production-observability-logging-cleanup
status: approved
shadcn_initialized: false
preset: not applicable
created: 2026-09-28
---

# Phase 19 — UI Design Contract: ErrorBoundary Recovery Screen

> Visual and interaction contract for Phase 19 ErrorBoundary fallback screen. Ensures crash handling adheres to KwestUp LiquidGlass theme standards without arbitrary styling.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | None (React Native core + React Native Paper 5) |
| Preset | LiquidGlass Custom Design System |
| Component library | React Native Paper 5 (`react-native-paper`) |
| Icon library | MaterialCommunityIcons (`@expo/vector-icons`) |
| Font | Inter (`@expo-google-fonts/inter`) |

---

## Spacing Scale

Declared values (strictly multiples of 4):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon and badge padding, inline gaps |
| sm | 8px | Button gap, text separation |
| md | 16px | Card internal padding, stack spacing |
| lg | 24px | Section margins, recovery container padding |
| xl | 32px | Header-to-content layout separation |
| 2xl | 48px | Top-level recovery view vertical inset |

Exceptions: none

---

## Typography

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Display | 24px | 700 (Bold) | 32px |
| Heading | 18px | 600 (SemiBold) | 24px |
| Body | 14px | 400 (Regular) | 20px |
| Label | 12px | 500 (Medium) | 16px |
| Code / Monospace | 11px | 400 (Regular) | 15px |

---

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#0F172A` (Dark) / `#F8FAFC` (Light) | Full-screen backdrop and safe area surface |
| Secondary (30%) | `#1E293B` (Dark) / `#FFFFFF` (Light) | Error card surface, collapsible stack trace box |
| Accent (10%) | `#6366F1` (Indigo Primary) | Primary recovery CTA ("Try Again" button) |
| Destructive / Warning | `#EF4444` / `#F59E0B` | Error indicator icon, diagnostic header badge |

Accent reserved for: Primary interactive CTA button ("Try Again") and active focus indicators only.

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Screen Heading | "Something Went Wrong" |
| Reassurance Body | "KwestUp encountered an unexpected error. Your notes, tasks, and data remain safe on your device." |
| Primary CTA | "Try Again" |
| Secondary Action | "Copy Error Report" |
| Tertiary Action | "Restart Application" |
| Collapsible Toggle | "View Diagnostic Details" / "Hide Diagnostic Details" |
| Copy Confirmation Toast | "Error report copied to clipboard" |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| Native Paper & Vector Icons | standard components | not required |

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS

**Approval:** approved 2026-09-28
