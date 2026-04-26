---
name: Folium81
description: Portfolio ZIP generation for UTP students under real academic deadlines.
colors:
  primary: "#6A45C6"
  primary-strong: "#5532B5"
  primary-soft: "#EDE7FF"
  neutral-bg: "#F7F6FB"
  neutral-surface: "#FFFFFF"
  neutral-border: "#E7E2F3"
  neutral-text: "#1A1628"
  neutral-muted: "#625C78"
typography:
  display:
    fontFamily: "Lora, Times New Roman, serif"
    fontSize: "clamp(2.2rem, 4.8vw, 3.8rem)"
    fontWeight: 600
    lineHeight: 1.08
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
rounded:
  sm: "10px"
  md: "12px"
  lg: "16px"
spacing:
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.neutral-surface}"
    rounded: "{rounded.md}"
    padding: "12px 20px"
  card-default:
    backgroundColor: "{colors.neutral-surface}"
    textColor: "{colors.neutral-text}"
    rounded: "{rounded.lg}"
    padding: "24px"
---

# Design System: Folium81

## 1. Overview

**Creative North Star: "Midnight Study Studio"**

Folium81 balances two visual jobs: public pages should feel artistic and memorable, while app pages should feel immediate and reliable. The emotional tone is calm confidence for students who are tired, focused, and trying to finish correctly.

This system rejects barebones utility aesthetics and generic AI landing patterns. Design should feel crafted, but never slow.

## 2. Colors

Restrained strategy with white-first surfaces and expressive purple range used with discipline.

### Primary
- **Campus Violet** (#6A45C6): primary actions, active states, progress emphasis.
- **Deep Academic Violet** (#5532B5): hover/pressed states and key accents.
- **Soft Violet Wash** (#EDE7FF): supportive backgrounds and subtle highlights.

### Neutral
- **Paper Mist** (#F7F6FB): page background.
- **Pure Surface** (#FFFFFF): cards and content containers.
- **Quiet Rule** (#E7E2F3): borders and separators.
- **Ink Core** (#1A1628): headings and key text.
- **Reading Gray** (#625C78): supporting copy.

## 3. Typography

**Display Font:** Lora with Times New Roman fallback for editorial-academic tone.
**Body Font:** Inter for clean, fast UI readability.

### Hierarchy
- **Display** (600, clamp(2.2rem, 4.8vw, 3.8rem), 1.08): hero messaging and major headers.
- **Headline** (600, 1.6rem, 1.2): section and card titles.
- **Body** (400, 1rem, 1.6): explanatory content and guidance.
- **Label** (600, 0.875rem, 1.4): forms, metadata, and control labels.

## 4. Elevation

Depth is soft, not dramatic. Surfaces separate through light shadow and borders, preserving clarity for task-heavy screens.

- **Level 1** (`0 10px 28px rgba(29, 18, 63, 0.08)`): baseline card elevation.
- **Level 2** (`0 18px 44px rgba(29, 18, 63, 0.14)`): hover/focus emphasis.

## 5. Components

### Buttons
- Rounded rectangular shape with high-contrast text.
- Primary uses gradient violet; outline remains white-forward.
- Hover and active states are immediate and subtle.

### Cards
- White surfaces with quiet borders and consistent radius.
- Used as content anchors across public and app surfaces.

### Inputs
- Neutral rest state, clear violet focus ring, explicit inline feedback.

### Navigation
- Sticky top navigation with compact trusted account controls.
- Link states prioritize clarity over decorative effects.

## 6. Do's and Don'ts

### Do:
- **Do** keep white surfaces dominant and let purple guide attention.
- **Do** make completion states obvious and reassuring.
- **Do** use expressive motion for hierarchy, never for delay.

### Don't:
- **Don't** use dark mode for this product direction.
- **Don't** ship barebones interfaces with no visual character.
- **Don't** overload screens with decorative effects that slow action.
