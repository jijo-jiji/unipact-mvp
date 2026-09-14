# UniPact Frontend Style Guide

This document serves as the official frontend style guide and design system reference for the UniPact landing page and web application. Consult this guide when making updates or adding new features to ensure visual consistency across the platform.

## 🎨 Color Palette

The UniPact brand relies on a clean, professional, and trusting aesthetic using Navy and Cyan on a light background.

### Brand Colors
- **Primary Navy (`--navy`)**: `#0B1E63`
- **Deep Navy (`--navy-deep`)**: `#0A1748` — *Used for high-contrast headings and primary text.*
- **Action Cyan (`--cyan`)**: `#00AEEF` — *Used for primary buttons, highlights, and interactive elements.*
- **Deep Cyan (`--cyan-deep`)**: `#0090C6` — *Used for hover states on cyan elements.*

### Base Colors
- **Background (`--bg`)**: `#F5F7FC` — *The default application background.*
- **Surface White (`--white`)**: `#FFFFFF` — *Used for cards and elevated components.*

### Text Colors
- **Main Text (`--text-main`)**: `#0A1748`
- **Muted Text (`--text-muted`)**: `#5B6478` — *Used for sub-headlines, descriptions, and secondary info.*

### UI Elements
- **Soft Border (`--border-color`)**: `rgba(10, 23, 72, 0.12)` — *Used for subtle dividers and standard card borders.*
- **Strong Border (`--border-strong`)**: `rgba(10, 23, 72, 0.22)` — *Used for active states or prominent borders.*

---

## ✍️ Typography

We use two Google Fonts to balance impact and readability.

### 1. Headings: `Outfit`
- **Usage**: `h1`, `h2`, `h3`, `h4`, `h5`, `h6`
- **Weight**: Bold (`700`)
- **Color**: `--navy-deep`
- **Line-height**: `1.15`

### 2. Body Text: `Inter`
- **Usage**: Paragraphs, buttons, forms, standard text.
- **Weights**: Regular (`400`), Medium (`500`), Semi-bold (`600`)
- **Color**: `--text-main` (default) or `--text-muted` (supporting text).
- **Line-height**: `1.6`

---

## 📏 Layout & Spacing

### Container
- **Class**: `.container`
- **Max-width**: `1160px`
- **Padding**: `2rem` on left and right for mobile breathing room.
- Always use `.container` to wrap content within sections to maintain consistent horizontal alignment.

### Eyebrow Tags
- **Class**: `.eyebrow`
- **Usage**: Placed above section titles to provide context.
- **Styling**: Uppercase, heavily spaced tracking (`0.12em`), `0.75rem` font size, bold, paired with a cyan diamond (`.eyebrow-dot`).

### Section Titles
- **Class**: `.section-title`
- **Styling**: Responsive sizing (`clamp(2rem, 3.4vw, 2.75rem)`), tight letter spacing (`-0.5px`), constrained to `700px` max-width for readable line lengths.

---

## 🧱 Components & Utilities

### 1. The Navbar
- **Height**: `76px`
- **Behavior**: Sticky at the top (`position: sticky`).
- **Effect**: Uses a glassmorphic blur `backdrop-filter: blur(12px)` over a slightly transparent background (`rgba(245, 247, 252, 0.94)`).

### 2. Animations & Transitions
- **Fast (`--transition-fast`)**: `0.2s ease` — *Use for color changes on hover (e.g., links).*
- **Normal (`--transition-normal`)**: `0.3s cubic-bezier(0.4, 0, 0.2, 1)` — *Use for transform changes, scaling, or slide-ins.*

### 3. Rule Lines & Dividers
Instead of standard borders between full-width sections, use cyan rule lines to separate major structural blocks. Ensure adequate vertical padding (breathing room) around these seams, especially on mobile, to prevent cramped layouts.

---

## 📝 Best Practices for Future Updates

1. **Avoid Hardcoding Colors**: ALWAYS use CSS variables (e.g., `color: var(--navy);` instead of `#0B1E63`).
2. **Responsive First**: Utilize `clamp()` for fluid typography sizing and use CSS Grid/Flexbox to ensure elements stack cleanly on mobile.
3. **Keep HTML Semantic**: Use appropriate tags (`<section>`, `<article>`, `<nav>`, `<main>`) rather than generic `<div>` soup. 
4. **Maintain the Brand Voice**: Design elements should lean into the "enterprise B2B" feel—clean lines, high contrast, and minimal clutter.
