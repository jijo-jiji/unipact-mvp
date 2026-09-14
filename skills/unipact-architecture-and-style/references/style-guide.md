# Reference: UI Style Guide & Design Tokens (STYLE_GUIDE.md)

This reference documents the official design system specified in `STYLE_GUIDE.md`.

## 1. Color Palette

| Token Name | CSS Variable | Hex / RGBA Value | Role / Usage |
| :--- | :--- | :--- | :--- |
| **Primary Navy** | `--navy` | `#0B1E63` | Primary brand identity and accents |
| **Deep Navy** | `--navy-deep` | `#0A1748` | High-contrast headings and primary text |
| **Action Cyan** | `--cyan` | `#00AEEF` | Primary buttons, active tabs, highlights |
| **Deep Cyan** | `--cyan-deep` | `#0090C6` | Hover state for cyan buttons & links |
| **Canvas Background** | `--bg` | `#F5F7FC` | Default application background |
| **Surface White** | `--white` | `#FFFFFF` | Cards, modals, elevated surfaces |
| **Main Text** | `--text-main` | `#0A1748` | Default body copy, table text |
| **Muted Text** | `--text-muted` | `#5B6478` | Supporting text, captions, timestamps |
| **Soft Border** | `--border-color`| `rgba(10, 23, 72, 0.12)` | Card borders, subtle dividers |
| **Strong Border** | `--border-strong`| `rgba(10, 23, 72, 0.22)`| Input borders, active states |

## 2. Typography

### Headings
- **Font Family**: `Outfit`, sans-serif
- **Weight**: Bold (`700`)
- **Color**: `--navy-deep` (`#0A1748`)
- **Line Height**: `1.15`

### Body & UI
- **Font Family**: `Inter`, sans-serif
- **Weights**: Regular (`400`), Medium (`500`), Semi-bold (`600`)
- **Color**: `--text-main` (`#0A1748`) or `--text-muted` (`#5B6478`)
- **Line Height**: `1.6`

## 3. Layout & Components

### Container
- **Class**: `.container` / `max-w-[1160px] mx-auto px-8`
- Constrains layout width for optimal reading and scanning.

### Navbar
- **Height**: `76px`
- **Behavior**: `sticky top-0 z-50`
- **Style**: `backdrop-filter: blur(12px)` with `rgba(245, 247, 252, 0.94)` background.

### Eyebrow Tag
```html
<div class="flex items-center gap-2 text-xs font-bold text-[#00AEEF] uppercase tracking-[0.12em] mb-2">
  <span class="w-1.5 h-1.5 bg-[#00AEEF] rotate-45"></span>
  FEATURE SPOTLIGHT
</div>
```

### Primary Action Button
```html
<button class="bg-[#00AEEF] hover:bg-[#0090C6] text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 shadow-sm">
  Get Started
</button>
```

### Secondary Outline Button
```html
<button class="border border-[rgba(10,23,72,0.22)] bg-white hover:bg-gray-50 text-[#0A1748] font-semibold py-3 px-6 rounded-lg transition-colors duration-200">
  Learn More
</button>
```

### Elevated Card
```html
<div class="bg-white border border-[rgba(10,23,72,0.12)] rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
  <!-- Card content -->
</div>
```\n