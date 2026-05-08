# Aura: Daily Flow - Specification Document

## 1. Project Overview

**Project Name:** Aura: Daily Flow
**Type:** Single-page productivity web application
**Core Functionality:** A minimal, all-in-one daily management tool featuring a focus timer, auto-clearing task list, hydration/eye-rest tracker, and persistent notes panel.
**Target Users:** Professionals, students, and productivity-focused individuals seeking a clutter-free daily workflow.

---

## 2. UI/UX Specification

### 2.1 Layout Structure

**Page Sections:**
- Header: App title + current date display
- Main Content: Bento-grid with 4 primary cards
  - Focus Timer (largest, 2-column span on desktop)
  - Quick Tasks
  - Hydration & Wellness
  - Instant Notes

**Responsive Breakpoints:**
- Mobile (< 768px): Single column, stacked cards
- Tablet (768px - 1024px): 2-column grid
- Desktop (> 1024px): 3-column grid with Focus Timer spanning 2 columns

**Grid Specifications:**
- Gap: 24px
- Card padding: 32px
- Border radius: 24px
- Max content width: 1400px, centered

### 2.2 Visual Design

**Color Palette:**
- Background Primary: `#121212` (Deep Charcoal)
- Background Secondary: `#1E1E1E` (Slightly lighter charcoal for cards)
- Accent Primary: `#6366f1` (Electric Indigo)
- Accent Hover: `#818CF8` (Lighter indigo for interactions)
- Text Primary: `#F8FAFC` (Near white)
- Text Secondary: `#94a3b8` (Soft Slate)
- Border/Divider: `#2E2E2E` (Subtle dark border)
- Glassmorphism: `rgba(30, 30, 30, 0.7)` with `backdrop-filter: blur(12px)`

**Typography:**
- Font Family: `'Inter', system-ui, -apple-system, sans-serif`
- Heading Large (App Title): 28px, font-weight: 600
- Heading Card: 18px, font-weight: 600
- Body Text: 14px, font-weight: 400
- Small/Labels: 12px, font-weight: 500

**Spacing System:**
- Base unit: 8px
- Card padding: 32px (4 units)
- Grid gap: 24px (3 units)
- Element spacing within cards: 16px (2 units)

**Visual Effects:**
- Card background: `#1E1E1E` with subtle glassmorphism overlay
- Border: 1px solid `#2E2E2E`
- Hover states: slight scale (1.02) + border color change to accent
- Transitions: 300ms ease for all interactive elements
- Timer ring: SVG circle with animated stroke-dashoffset

### 2.3 Components

**1. Focus Timer Card:**
- Large circular timer display (200px diameter)
- SVG ring progress indicator in Electric Indigo
- Time display: MM:SS format, 48px font
- Session label: "Focus" / "Break"
- Controls: Start/Pause button, Reset button
- Ambient sound toggles: Rain, Forest, White Noise (toggle buttons with icons)
- States: Idle, Running, Paused, Break

**2. Quick Tasks Card:**
- Input field with "+" add button
- Task list with checkboxes
- Each task: checkbox + text + delete button
- Auto-clear: completed items removed after 24 hours
- Empty state: "Add a task to stay focused"
- Max visible: scrollable list, max-height 300px

**3. Hydration & Wellness Card:**
- Two sections: Water intake + Eye rest
- Water: Droplet icon + counter + increment/decrement buttons
- Display: "X glasses" or "X ml" (toggleable)
- Eye Rest: Eye icon + "Take a break" button + cooldown indicator
- Goal indicators: 8 glasses/day default

**4. Instant Notes Card:**
- Textarea with placeholder "Jot down your thoughts..."
- Auto-save: saves on every keystroke (debounced 500ms)
- Character count display
- Persists across sessions

**5. Header:**
- Left: "Aura: Daily Flow" title
- Right: Current date, formatted as "Friday, May 8"
- Subtle bottom border

---

## 3. Functionality Specification

### 3.1 Core Features

**Focus Timer:**
- Default: 25 minutes (Focus), 5 minutes (Break)
- Circular progress animation
- Controls:
  - Start: begins countdown
  - Pause: freezes countdown
  - Reset: returns to initial time
- Session cycling: Focus → Break → Focus...
- Audio notification on completion (subtle beep)
- Ambient sounds (toggleable, play independently):
  - Rain sounds
  - Forest ambiance
  - White noise

**Quick Tasks:**
- Add task: Enter key or "+" button
- Complete task: click checkbox
- Delete task: click trash icon
- Auto-clear logic: On page load, remove any completed tasks older than 24 hours
- Storage: Array of {id, text, completed, createdAt, completedAt}

**Hydration Tracker:**
- Increment: "+" button (adds 1 glass)
- Decrement: "-" button (removes 1 glass, minimum 0)
- Daily reset: Check last recorded date, reset if new day
- Eye rest:
  - Button: "Rest Eyes" - starts 20-minute cooldown
  - Cooldown visual: progress ring or timer
  - After cooldown: button re-enables

**Instant Notes:**
- Textarea input
- Auto-save: 500ms debounce
- Storage: Single string in localStorage
- No character limit (reasonable limit ~10000 chars)

### 3.2 Data Handling

**localStorage Keys:**
- `aura_timer_settings`: {focusDuration, breakDuration, isRunning, pausedTime, currentMode}
- `aura_tasks`: Array of task objects
- `aura_hydration`: {glasses, lastDate, eyeRestLastDate}
- `aura_notes`: String content

### 3.3 Edge Cases

- Timer: Handle page refresh during active timer (save state)
- Tasks: Handle empty input, handle very long task text (truncate display)
- Hydration: Handle date change (reset daily counts)
- Notes: Handle paste of very large text

---

## 4. Acceptance Criteria

1. ✅ Page loads with bento-grid layout on desktop, stacked on mobile
2. ✅ All 4 cards visible with proper glassmorphism styling
3. ✅ Focus Timer counts down with visual ring progress
4. ✅ Ambient sound toggles work independently
5. ✅ Tasks can be added, completed, and deleted
6. ✅ Completed tasks clear after 24 hours automatically
7. ✅ Water counter increments/decrements properly
8. ✅ Eye rest button activates cooldown state
9. ✅ Notes auto-save and persist on page refresh
10. ✅ Dark theme with Electric Indigo accents applied consistently
11. ✅ Smooth hover transitions on all interactive elements
12. ✅ No emojis used - all icons are SVG
13. ✅ Responsive across all breakpoints