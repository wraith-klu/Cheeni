# 🎨 Universal Master UI/UX Design System & Prompt Framework
> **A Reusable, Production-Grade Design Specification & LLM Prompt Template for Modern Web Applications**

---

## 📋 Table of Contents
1. [Core Design Philosophy](#1-core-design-philosophy)
2. [Dual-Theme Color Token Architecture](#2-dual-theme-color-token-architecture)
3. [Typography Hierarchy & Font Stacks](#3-typography-hierarchy--font-stacks)
4. [Spatial System, Layout & Radii](#4-spatial-system-layout--radii)
5. [Component Library Patterns](#5-component-library-patterns)
6. [Micro-Interactions & Motion Choreography](#6-micro-interactions--motion-choreography)
7. [Accessibility & Best Practices](#7-accessibility--best-practices)
8. [🚀 Master LLM Prompt (Copy-Paste for Any Project)](#8--master-llm-prompt-copy-paste-for-any-project)

---

## 1. Core Design Philosophy

This design system is built on **Editorial Warmth meets Precision Engineering**:
- **Avoid Generic SaaS Tropes**: Replace cold pure-white backgrounds, harsh neon gradients, and cookie-cutter Bootstrap styles with tactile materials, curated color harmony, and literary typography.
- **Dual Personality**:
  - **Editorial Canvas**: Uses warm, tactile tones (warm linen, soft stone, deep obsidian) with high-contrast, beautiful serif display headers.
  - **Responsive Utility**: Clean sans-serif and monospace layers for data density, fast scanning, and interactive clarity.
- **Intentional Contrast**: Form elements, cards, and interactive surfaces are distinguished by subtle tonal elevation rather than heavy borders or aggressive drop-shadows.

---

## 2. Dual-Theme Color Token Architecture

The token system uses semantic CSS variables so the entire application switches themes instantaneously with zero hardcoded color collisions.

### 2.1 CSS Custom Properties Setup
```css
/* ==========================================================================
   MASTER DESIGN SYSTEM TOKENS (Attach to :root, .dark, .light)
   ========================================================================== */

:root, [data-theme="dark"], .dark {
  /* Canvas & Surfaces */
  --app-bg:            #080c16;  /* Deep Obsidian Midnight */
  --app-surface:       #111726;  /* Elevated Card / Panel Surface */
  --app-surface-hover: #182035;  /* Subtle Hover Elevation */
  
  /* Text & Inks */
  --app-ink:           #f8fafc;  /* Primary Heading / Active Ink */
  --app-ink-muted:     #cbd5e1;  /* Secondary Body Text */
  --app-ink-subtle:    #94a3b8;  /* Muted Labels / Icons / Captions */
  
  /* Brand Accent: Warm Terracotta Amber */
  --app-accent:        #e07a38;  /* Primary Accent & CTAs */
  --app-accent-hover:  #ea8b4e;  /* Accent Hover State */
  --app-accent-soft:   rgba(224, 122, 56, 0.15); /* Accent Badges & Highlights */
  
  /* Borders & Dividers */
  --app-rule:          rgba(255, 255, 255, 0.09); /* Translucent Hairline Divider */
  --app-rule-hover:    rgba(255, 255, 255, 0.18);
  
  /* Shadows & Ambient */
  --app-shadow-sm:     0 2px 8px rgba(0, 0, 0, 0.3);
  --app-shadow-lg:     0 20px 48px rgba(0, 0, 0, 0.5);
}

[data-theme="light"], .light {
  /* Canvas & Surfaces */
  --app-bg:            #F4EFE8;  /* Tactile Warm Japanese Linen / Rice Paper */
  --app-surface:       #EDE7DF;  /* Soft Sandstone Surface */
  --app-surface-hover: #E4DCD2;  /* Gentle Hover Depth */
  
  /* Text & Inks */
  --app-ink:           #1A1916;  /* Deep Charcoal Carbon Ink */
  --app-ink-muted:     #3D3A35;  /* Secondary Warm Charcoal */
  --app-ink-subtle:    #6B6762;  /* Muted Stone / Captions */
  
  /* Brand Accent: Rich Terracotta Brick */
  --app-accent:        #B5642A;  /* Primary CTA Accent */
  --app-accent-hover:  #9E5320;  /* Accent Hover State */
  --app-accent-soft:   rgba(181, 100, 42, 0.12); /* Soft Peach Wash */
  
  /* Borders & Dividers */
  --app-rule:          rgba(26, 25, 22, 0.12);    /* Delicate Stone Rule */
  --app-rule-hover:    rgba(26, 25, 22, 0.22);
  
  /* Shadows & Ambient */
  --app-shadow-sm:     0 2px 8px rgba(26, 25, 22, 0.06);
  --app-shadow-lg:     0 20px 48px rgba(26, 25, 22, 0.12);
}
```

### 2.2 Semantic Feedback Palette (Universal across themes)
| State | Light Mode | Dark Mode | Usage |
| :--- | :--- | :--- | :--- |
| **Success** | `#2A7A3B` (Forest Sage) | `#34D399` (Soft Mint) | Successful actions, online dots, pass states |
| **Warning** | `#A0580C` (Warm Bronze) | `#FBBF24` (Solar Amber) | Caution toasts, pending queues, rate limit notes |
| **Danger** | `#C0392B` (Carmine Brick) | `#F87171` (Coral Red) | Errors, destruct actions, offline indicators |
| **Info / AI** | `#5B4FBE` (Deep Iris) | `#818CF8` (Soft Periwinkle) | AI streaming, intelligence pills, tips |

---

## 3. Typography Hierarchy & Font Stacks

### 3.1 Google Fonts Import
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
```

### 3.2 Font Roles & CSS Token Mappings
- **Display Serif (`--font-serif`)**: `'DM Serif Display', Georgia, serif`  
  *Rule*: Reserved for hero titles, major section headings, brand wordmarks, and feature card titles.
- **Interface Sans (`--font-sans`)**: `'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`  
  *Rule*: Navigation links, body copy, form inputs, button labels, and tables.
- **Technical Mono (`--font-mono`)**: `'JetBrains Mono', 'Fira Code', monospace`  
  *Rule*: Code snippets, API keys, latency telemetry, port numbers, keyboard shortcuts (`<kbd>`).

### 3.3 Type Scale Matrix
| Token | Font Family | Size | Weight | Tracking | Line-Height | Intended Usage |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Display Hero** | `--font-serif` | `clamp(36px, 5.5vw, 68px)` | 400 | `-0.03em` | `1.08` | Primary page value proposition |
| **Heading 1** | `--font-serif` | `clamp(28px, 4vw, 44px)` | 400 | `-0.025em`| `1.15` | Section headers, modal titles |
| **Heading 2** | `--font-serif` | `20px - 26px` | 400 | `-0.02em` | `1.25` | Card titles, dashboard panel headers |
| **Category Pill**| `--font-sans` | `11px` | 700 | `0.1em` | `1.0` | Uppercase category badges, subheaders |
| **Lead Body** | `--font-sans` | `16px` | 400 | `normal` | `1.65` | Subtitles, hero intros, feature summaries |
| **Body Standard**| `--font-sans` | `14px` | 400 / 500| `normal` | `1.55` | Form inputs, data tables, chat messages |
| **Caption / Help**| `--font-sans` | `12px` | 500 | `normal` | `1.4` | Helper hints, timestamps, footer legal |
| **Code / Shortcut**| `--font-mono`| `12px - 13px` | 500 | `-0.01em`| `1.5` | Code blocks, status indicators, badges |

---

## 4. Spatial System, Layout & Radii

### 4.1 Layout Framework
- **Container Max-Width**: `1120px` with responsive padding `0 24px` (prevents unwieldy line lengths on ultra-wide screens).
- **Narrow Flow / Auth Width**: `440px` (optical sweet spot for forms and modals).
- **Fluid Padding Scale**:
  - `4px` / `8px`: Micro gaps, icon pairings, badge insets
  - `12px` / `16px`: Form field vertical rhythms, internal card padding
  - `24px` / `32px`: Component margins, modal padding
  - `64px` / `96px`: Large section vertical padding

### 4.2 Precision Corner Radii (`border-radius`)
- **Buttons, Inputs & Dropdowns**: `7px - 8px` (Clean precision corners; avoid oversized cartoon pills).
- **Cards, Panels & Drawers**: `12px - 14px` (Balanced containment).
- **Status Badges & Chips**: `16px - 20px` (Capsule shape).
- **Circular Elements / Avatars / Orbs**: `50%` (Perfect circles).

---

## 5. Component Library Patterns

### 5.1 Universal Navigation Bar
- **Sticky Header**: `height: 60px; position: sticky; top: 0; z-index: 50;`
- **Surface**: `background: var(--app-bg); border-bottom: 1px solid var(--app-rule);`
- **Standard Controls**:
  1. Brand Wordmark in Serif (`20px - 22px`).
  2. Minimal navigation links (`14px`, weight `500`, muted ink).
  3. **☀️ / 🌙 Sun-Moon Mode Switcher**: Standardized 36×36 square icon button with subtle border.
  4. Primary Call-to-Action button in accent tone.

### 5.2 Form Inputs & Controls
```html
<!-- Example Semantic Input Group -->
<div class="field-group">
  <label style="display:block; font-size:12px; font-weight:600; color:var(--app-ink); margin-bottom:6px;">
    Email Address
  </label>
  <div style="position:relative;">
    <span style="position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--app-ink-subtle);">
      <!-- SVG Icon -->
    </span>
    <input 
      type="email" 
      placeholder="name@company.com" 
      style="
        width: 100%;
        padding: 11px 14px 11px 38px;
        background: var(--app-surface);
        border: 1px solid var(--app-rule);
        border-radius: 7px;
        color: var(--app-ink);
        font-size: 14px;
        font-family: var(--font-sans);
        outline: none;
        transition: border-color 0.15s ease, box-shadow 0.15s ease;
      "
    />
  </div>
</div>
```

### 5.3 Button Varieties
- **Primary CTA**:
  ```css
  background: var(--app-accent);
  color: #ffffff;
  font-weight: 600;
  font-size: 14px;
  border-radius: 7px;
  padding: 12px 20px;
  border: none;
  cursor: pointer;
  transition: opacity 0.15s ease, transform 0.1s ease;
  ```
- **Secondary / Outline**:
  ```css
  background: transparent;
  color: var(--app-ink-muted);
  border: 1px solid var(--app-rule);
  border-radius: 7px;
  padding: 11px 18px;
  font-size: 14px;
  ```
- **Square Icon Button (Sun/Moon / Settings)**:
  ```css
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: 1px solid var(--app-rule);
  background: transparent;
  color: var(--app-ink-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  ```

---

## 6. Micro-Interactions & Motion Choreography

- **Timing Function**: Smooth cubic bezier (`cubic-bezier(0.16, 1, 0.3, 1)`).
- **Durations**:
  - Hover states: `150ms`
  - Theme toggles & transitions: `250ms - 300ms`
  - Modals / Drawers slide-in: `350ms`
- **Interactive Feedback**:
  - Buttons depress slightly on click (`:active { transform: scale(0.98); }`).
  - Inputs gain subtle outline ring on focus (`box-shadow: 0 0 0 2px var(--app-accent-soft); border-color: var(--app-accent);`).
  - Success / Error banners slide in smoothly with opacity transitions.

---

## 7. Accessibility & Best Practices

1. **High Contrast Ratios**: Inks are carefully paired against surfaces to maintain minimum 4.5:1 WCAG AA contrast in both light and dark modes.
2. **Keyboard Navigation**: Interactive elements retain clean `:focus-visible` rings.
3. **No External Icon Dependency Fragility**: All standard controls (Sun, Moon, Arrows, Eye, Lock, Mail, Check) use inline SVG icons to prevent broken third-party icon bundle crashes.
4. **Theme Preference Persistence**: Saves user preference in `localStorage` and falls back gracefully to `window.matchMedia('(prefers-color-scheme: dark)')`.

---

## 8. 🚀 Master LLM Prompt (Copy-Paste for Any Project)

When starting a new feature, page, or brand-new project with any AI coding assistant, copy and paste this complete prompt into your system instructions or chat prompt:

```text
================================================================================
MASTER UI/UX DESIGN SYSTEM INSTRUCTIONS FOR WEB APPLICATIONS
================================================================================
You are the Lead Frontend Architect & Design Systems Engineer.
Every UI component, webpage, or layout you design must strictly adhere to the
following universal design specification:

1. AESTHETIC VIBE & IDENTITY:
- The design must reflect "Editorial Craftsmanship meets Silicon Precision"
  (inspired by Stripe Press, Linear, and luxury print editorial layouts).
- Avoid generic cold-white SaaS layouts, generic Bootstrap forms, or neon-blue hacker themes.
- Support first-class, seamless Light and Dark mode transitions via CSS variables.

2. COLOR TOKEN SYSTEM (Use CSS Variables Exclusively):
- Dark Mode Tokens:
  --app-bg: #080c16 (Obsidian Midnight canvas)
  --app-surface: #111726 (Elevated card/panel surface)
  --app-surface-hover: #182035
  --app-ink: #f8fafc (Primary high-contrast white text)
  --app-ink-muted: #cbd5e1 (Secondary body text)
  --app-ink-subtle: #94a3b8 (Captions, icons, footnotes)
  --app-accent: #e07a38 (Warm amber terracotta clay accent)
  --app-accent-soft: rgba(224, 122, 56, 0.15)
  --app-rule: rgba(255, 255, 255, 0.09) (Hairline divider)

- Light Mode Tokens:
  --app-bg: #F4EFE8 (Tactile warm Japanese linen / rice paper canvas)
  --app-surface: #EDE7DF (Soft sandstone card surface)
  --app-surface-hover: #E4DCD2
  --app-ink: #1A1916 (Charcoal carbon ink text)
  --app-ink-muted: #3D3A35 (Secondary warm charcoal text)
  --app-ink-subtle: #6B6762 (Muted stone captions)
  --app-accent: #B5642A (Rich terracotta brick clay accent)
  --app-accent-soft: rgba(181, 100, 42, 0.12)
  --app-rule: rgba(26, 25, 22, 0.12) (Delicate stone divider)

3. TYPOGRAPHY HIERARCHY:
- Display Serif: Use 'DM Serif Display', Georgia, serif for hero titles, major section headings, brand names, and dialog headers.
- Body Sans: Use 'DM Sans', 'Plus Jakarta Sans', system-ui, sans-serif for UI controls, inputs, body text, and navigation.
- Monospace: Use 'JetBrains Mono', monospace for data, keyboard shortcuts, code snippets, and telemetry counters.
- Category Pills / Labels: 11px, weight 700, all-caps with 0.1em letter-spacing in var(--app-accent).
- Headings must have tight letter-spacing (-0.025em to -0.03em) and comfortable line-height (1.1 to 1.25).

4. LAYOUT & COMPONENT RULES:
- Navigation: Sticky top bar, height 60px, background: var(--app-bg), border-bottom: 1px solid var(--app-rule). Include a dedicated 36x36px square Sun/Moon theme switcher button.
- Cards: Background: var(--app-bg), border: 1px solid var(--app-rule), border-radius: 14px, box-shadow: 0 20px 48px rgba(0,0,0,0.12).
- Inputs: Background: var(--app-surface), border: 1px solid var(--app-rule), border-radius: 7px, color: var(--app-ink), padding: 11px 14px. Focus state must smoothly highlight with var(--app-accent).
- Primary Buttons: Background: var(--app-accent), color: #ffffff, border-radius: 7px, font-weight: 600, padding: 12px 20px, border: none, cursor: pointer.
- Icons: Always use self-contained inline SVGs with width=15-18, height=15-18, strokeWidth=1.8 or 2, strokeLinecap="round". Do not rely on external icon library imports that could break across environments.

5. RESPONSIVENESS & ACCESSIBILITY:
- All layouts must adapt fluidly from mobile (<640px) to ultra-wide displays.
- Maintain high contrast ratios for readability (minimum 4.5:1).
- Include graceful focus rings (:focus-visible) and micro-interactions (hover, active, transition: 0.15s ease).
================================================================================
```
