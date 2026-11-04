# Smart Building Command Center - Premium Design System Documentation

## Overview

This design system transforms the Smart Building Command Center into a premium, enterprise-grade interface with a cyberpunk/futuristic aesthetic suitable for disaster early warning systems. The design emphasizes visual hierarchy, accessibility, and smooth animations while maintaining professional appearance.

## Design Philosophy

### Core Principles
1. **Visual Hierarchy**: Clear information architecture with distinct levels of importance
2. **Accessibility**: WCAG AA compliant contrast ratios and reduced motion support
3. **Performance**: 60fps animations with GPU-accelerated transforms
4. **Responsiveness**: Mobile-first approach scaling to large desktop displays
5. **Consistency**: Unified design language across all components

### Aesthetic Direction
- **Theme**: Cyberpunk/Futuristic Command Center
- **Palette**: Deep space backgrounds with neon accent colors
- **Typography**: Orbitron (tech/headers) + Kanit (Thai body text)
- **Effects**: Glassmorphism, neon glows, subtle gradients
- **Motion**: Smooth, purposeful animations with physics-based easing

---

## Color Palette

### Background Colors
```css
--bg-deep: #020408;        /* Deepest background */
--bg-base: #050811;        /* Primary background */
--bg-elevated: #0a0f1a;    /* Elevated surfaces */
--bg-card: rgba(13, 20, 36, 0.75);  /* Card backgrounds with transparency */
```

### Neon Accent Colors
```css
--cyan-neon: #00f3ff;              /* Primary accent */
--cyan-neon-dim: rgba(0, 243, 255, 0.15);
--cyan-neon-glow: rgba(0, 243, 255, 0.4);

--magenta-neon: #ff0055;          /* Critical/danger states */
--magenta-neon-dim: rgba(255, 0, 85, 0.15);
--magenta-neon-glow: rgba(255, 0, 85, 0.4);

--yellow-warn: #ffcc00;           /* Warning states */
--yellow-warn-dim: rgba(255, 204, 0, 0.15);
--yellow-warn-glow: rgba(255, 204, 0, 0.4);

--green-safe: #00ff88;            /* Success/safe states */
--green-safe-dim: rgba(0, 255, 136, 0.15);
--green-safe-glow: rgba(0, 255, 136, 0.4);

--purple-accent: #8b5cf6;         /* Secondary accent */
--purple-accent-dim: rgba(139, 92, 246, 0.15);
--purple-accent-glow: rgba(139, 92, 246, 0.4);
```

### Text Colors
```css
--text-main: #e0f2fe;      /* Primary text */
--text-muted: #64748b;     /* Secondary text */
--text-dim: #475569;       /* Tertiary text */
--text-bright: #ffffff;    /* Bright highlights */
```

### Surface Colors
```css
--surface-base: rgba(255, 255, 255, 0.03);   /* Base surface */
--surface-hover: rgba(255, 255, 255, 0.06);  /* Hover state */
--surface-active: rgba(255, 255, 255, 0.1);  /* Active state */
```

### Border Colors
```css
--border-base: rgba(255, 255, 255, 0.08);   /* Base border */
--border-hover: rgba(255, 255, 255, 0.12);  /* Hover border */
--border-glow: rgba(0, 243, 255, 0.2);      /* Glow effect */
--border-focus: rgba(0, 243, 255, 0.5);     /* Focus state */
```

---

## Typography

### Font Families
```css
--font-tech: 'Orbitron', system-ui, -apple-system, sans-serif;
--font-body: 'Kanit', 'Prompt', system-ui, -apple-system, sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', ui-monospace, monospace;
```

### Usage Guidelines
- **Orbitron**: Headers, numbers, technical labels, status indicators
- **Kanit**: Body text, descriptions, interface elements (Thai-optimized)
- **JetBrains Mono**: Code, timestamps, numerical data, logs

### Type Scale
```css
h1: clamp(1.75rem, 4vw, 2.5rem)   /* Main titles */
h2: clamp(1.25rem, 3vw, 1.75rem)  /* Section headers */
h3: clamp(1rem, 2vw, 1.25rem)     /* Subsection headers */
h4: 1rem                          /* Card titles */
p: 1rem                           /* Body text */
label: 0.75rem                    /* Small labels */
```

### Typography Utilities
```css
.text-tech          /* Apply tech font */
.text-mono          /* Apply monospace font */
.text-gradient      /* Gradient text effect */
.text-neon          /* Neon glow text */
.text-muted         /* Muted text color */
.text-dim           /* Dim text color */
```

---

## Spacing System

### Scale (4px base)
```css
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-5: 1.25rem;   /* 20px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-10: 2.5rem;   /* 40px */
--space-12: 3rem;     /* 48px */
```

### Usage Guidelines
- **space-2**: Tight spacing between related elements
- **space-3**: Default spacing for compact layouts
- **space-4**: Standard spacing for most components
- **space-6**: Section spacing
- **space-8**: Large section breaks

---

## Border Radius

```css
--radius-sm: 8px;      /* Small elements, buttons */
--radius-md: 12px;     /* Cards, inputs */
--radius-lg: 16px;     /* Large cards */
--radius-xl: 20px;     /* Hero cards, modals */
--radius-full: 9999px; /* Pills, badges, circles */
```

---

## Shadows

```css
--shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.3);
--shadow-md: 0 4px 16px rgba(0, 0, 0, 0.4);
--shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.5);
--shadow-xl: 0 16px 48px rgba(0, 0, 0, 0.6);
--shadow-glow-cyan: 0 0 20px var(--cyan-neon-glow);
--shadow-glow-magenta: 0 0 20px var(--magenta-neon-glow);
--shadow-glow-green: 0 0 20px var(--green-safe-glow);
```

---

## Animation System

### Easing Curves
```css
--ease-out: cubic-bezier(0.16, 1, 0.3, 1);     /* Smooth exit */
--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1); /* Symmetric */
--ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1); /* Bouncy */
```

### Durations
```css
--duration-fast: 150ms;    /* Micro-interactions */
--duration-normal: 300ms;  /* Standard transitions */
--duration-slow: 500ms;    /* Complex animations */
--duration-slower: 700ms;  /* Major state changes */
```

### Key Animations

#### Float
```css
@keyframes float {
  0%, 100% { transform: translate(0, 0) scale(1); }
  25% { transform: translate(20px, -30px) scale(1.05); }
  50% { transform: translate(-20px, 20px) scale(0.95); }
  75% { transform: translate(30px, 10px) scale(1.02); }
}
```
**Usage**: Background blobs, floating elements

#### Pulse Dot
```css
@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.7; transform: scale(1.2); }
}
```
**Usage**: Status indicators, online dots

#### Pulse Border
```css
@keyframes pulse-border {
  0%, 100% { border-color: var(--magenta-neon); }
  50% { border-color: rgba(255, 0, 85, 0.3); }
}
```
**Usage**: Critical alerts, emergency states

#### Shimmer
```css
@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
```
**Usage**: Loading states, progress bars, button hover effects

#### Slide In
```css
@keyframes slideIn {
  from { opacity: 0; transform: translateX(-10px); }
  to { opacity: 1; transform: translateX(0); }
}
```
**Usage**: List items, log entries, toast notifications

#### Toast Slide In
```css
@keyframes toastSlideIn {
  from { opacity: 0; transform: translateX(100px); }
  to { opacity: 1; transform: translateX(0); }
}
```
**Usage**: Toast notifications

#### Modal Slide Up
```css
@keyframes modalSlideUp {
  from { opacity: 0; transform: translateY(20px) scale(0.95); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
```
**Usage**: Modal dialogs

---

## Components

### Cards

#### Base Card
```html
<div class="card">
  <div class="card-header">
    <span class="card-title">Title</span>
    <span class="badge">Badge</span>
  </div>
  <div class="card-body">
    <!-- Content -->
  </div>
</div>
```

#### Hazard Card (Warning State)
```html
<div class="hazard-card warning">
  <div class="card-header">
    <span class="card-title">UV Index</span>
    <span class="level-badge warn">WARNING</span>
  </div>
  <div class="value-display">8.5</div>
</div>
```

#### Hazard Card (Critical State)
```html
<div class="hazard-card critical">
  <div class="card-header">
    <span class="card-title">Flood Level</span>
    <span class="level-badge crit">CRITICAL</span>
  </div>
  <div class="value-display">45.2</div>
</div>
```

### Buttons

#### Primary Button
```html
<button class="btn btn-primary">
  <span>Save Changes</span>
</button>
```

#### Secondary Button
```html
<button class="btn btn-secondary">
  <span>Cancel</span>
</button>
```

#### Danger Button
```html
<button class="btn btn-danger">
  <span>Delete</span>
</button>
```

#### Ghost Button
```html
<button class="btn btn-ghost">
  <span>Dismiss</span>
</button>
```

### Status Indicators

#### Status Badge
```html
<div class="status-badge">
  <div class="dot"></div>
  <span>ONLINE</span>
</div>
```

#### Level Badge
```html
<span class="level-badge">NORMAL</span>
<span class="level-badge warn">WARNING</span>
<span class="level-badge crit">CRITICAL</span>
```

### Progress Bars

#### Basic Progress Bar
```html
<div class="progress-bar">
  <div class="progress-bar-fill" style="width: 65%"></div>
</div>
```

#### Warning Progress Bar
```html
<div class="progress-bar warning">
  <div class="progress-bar-fill" style="width: 75%"></div>
</div>
```

#### Danger Progress Bar
```html
<div class="progress-bar danger">
  <div class="progress-bar-fill" style="width: 90%"></div>
</div>
```

### Gauges

#### SVG Gauge
```html
<div class="gauge-container">
  <svg class="gauge-svg" viewBox="0 0 200 200">
    <circle class="gauge-bg" cx="100" cy="100" r="90"></circle>
    <circle class="gauge-arc" cx="100" cy="100" r="90"></circle>
  </svg>
  <div class="gauge-text-container">
    <div class="gauge-value">75</div>
    <div class="gauge-unit">%</div>
  </div>
</div>
```

### Toast Notifications

#### Success Toast
```html
<div class="toast toast-success">
  <div class="toast-icon">✓</div>
  <div class="toast-message">Operation completed successfully</div>
</div>
```

#### Error Toast
```html
<div class="toast toast-error">
  <div class="toast-icon">✕</div>
  <div class="toast-message">An error occurred</div>
</div>
```

#### Warning Toast
```html
<div class="toast toast-warning">
  <div class="toast-icon">⚠</div>
  <div class="toast-message">Warning message</div>
</div>
```

### Toggle Switch

```html
<label class="toggle-switch">
  <input type="checkbox">
  <span class="toggle-slider"></span>
</label>
```

### Range Slider

```html
<input type="range" class="range-slider" min="0" max="100" value="50">
```

### LED Indicator

```html
<div class="led-indicator on">
  <svg>...</svg>
</div>
```

### Input Fields

```html
<input type="text" class="input-field" placeholder="Enter value...">
<input type="text" class="input-field error" placeholder="Error state...">
```

### Select Dropdown

```html
<div class="select-wrap">
  <select>
    <option>Option 1</option>
    <option>Option 2</option>
  </select>
</div>
```

---

## Glassmorphism

### Glass Effect
```css
.glass {
  background: rgba(13, 20, 36, 0.6);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}
```

### Strong Glass Effect
```css
.glass-strong {
  background: rgba(13, 20, 36, 0.8);
  backdrop-filter: blur(30px);
  -webkit-backdrop-filter: blur(30px);
  border: 1px solid rgba(255, 255, 255, 0.15);
}
```

---

## Glow Effects

### Cyan Glow
```css
.glow-cyan {
  box-shadow: 0 0 20px var(--cyan-neon-glow);
}
```

### Magenta Glow
```css
.glow-magenta {
  box-shadow: 0 0 20px var(--magenta-neon-glow);
}
```

### Green Glow
```css
.glow-green {
  box-shadow: 0 0 20px var(--green-safe-glow);
}
```

### Yellow Glow
```css
.glow-yellow {
  box-shadow: 0 0 20px var(--yellow-warn-glow);
}
```

---

## Responsive Design

### Breakpoints
- **Mobile**: < 640px
- **Tablet**: 640px - 1024px
- **Desktop**: 1024px - 1280px
- **Large Desktop**: > 1280px

### Mobile-First Approach
All base styles are written for mobile, with media queries adding complexity for larger screens.

### Responsive Grid
```css
.hazard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--space-5);
}
```

### Responsive Typography
```css
h1 {
  font-size: clamp(1.75rem, 4vw, 2.5rem);
}
```

---

## Accessibility

### Color Contrast
All color combinations meet WCAG AA standards (4.5:1 for normal text, 3:1 for large text).

### Focus States
All interactive elements have visible focus states:
```css
:focus-visible {
  outline: 2px solid var(--cyan-neon);
  outline-offset: 2px;
}
```

### Reduced Motion
Respects user's motion preferences:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### High Contrast Mode
Supports high contrast mode:
```css
@media (prefers-contrast: high) {
  :root {
    --border-base: rgba(255, 255, 255, 0.3);
    --text-muted: #94a3b8;
  }
}
```

### Semantic HTML
Use proper semantic elements:
- `<header>` for page headers
- `<nav>` for navigation
- `<main>` for main content
- `<section>` for sections
- `<article>` for articles
- `<aside>` for sidebars
- `<footer>` for footers

### ARIA Labels
Add ARIA labels for screen readers:
```html
<button aria-label="Close notification">✕</button>
```

---

## Performance Optimization

### GPU Acceleration
Use transforms for animations to leverage GPU:
```css
transform: translateY(-4px);  /* Good */
top: -4px;                    /* Bad - causes reflow */
```

### will-change Property
Use sparingly for frequently animated elements:
```css
.animated-element {
  will-change: transform;
}
```

### Contain Property
Use to isolate repaints:
```css
.card {
  contain: layout style paint;
}
```

### Image Optimization
- Use WebP format when possible
- Implement lazy loading
- Use appropriate sizes

### Font Loading
- Use `font-display: swap` for web fonts
- Preload critical fonts
- Subset fonts to reduce size

---

## Browser Support

### Target Browsers
- Chrome/Edge: Last 2 versions
- Firefox: Last 2 versions
- Safari: Last 2 versions
- Mobile Safari (iOS): Last 2 versions
- Chrome Mobile (Android): Last 2 versions

### CSS Features Used
- CSS Custom Properties (Variables)
- CSS Grid
- Flexbox
- Backdrop Filter (with fallback)
- CSS Transforms
- CSS Transitions
- CSS Animations
- CSS Custom Properties

### Fallbacks
- Backdrop filter: No fallback, gracefully degrades
- Custom properties: No fallback, modern browsers only
- Grid: Flexbox fallback for older browsers

---

## Thai Font Rendering

### Kanit Font
- Optimized for Thai script
- Supports all Thai characters
- Excellent legibility at small sizes
- Good weight variety (300-700)

### Thai Text Guidelines
- Use Kanit for all Thai text
- Ensure adequate line height (1.6-1.8)
- Use appropriate font sizes (minimum 16px for body)
- Test on various devices for rendering

### Font Loading Strategy
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
```

---

## Best Practices

### Component Composition
1. Keep components focused and single-purpose
2. Use consistent naming conventions
3. Document component props and usage
4. Test components in isolation

### State Management
1. Use clear state indicators (normal, warning, critical)
2. Provide visual feedback for all state changes
3. Use animations to smooth state transitions
4. Consider loading and error states

### Spacing and Layout
1. Use the spacing scale consistently
2. Maintain consistent padding and margins
3. Use whitespace effectively
4. Align elements to a grid

### Color Usage
1. Use colors purposefully for meaning
2. Don't rely on color alone for meaning
3. Maintain adequate contrast
4. Use the neon palette for accents only

### Typography
1. Establish clear visual hierarchy
2. Use appropriate font sizes for context
3. Maintain consistent line heights
4. Limit the number of font families

---

## Customization

### Adding New Colors
```css
:root {
  --color-custom: #hex-value;
  --color-custom-dim: rgba(r, g, b, 0.15);
  --color-custom-glow: rgba(r, g, b, 0.4);
}
```

### Adding New Animations
```css
@keyframes customAnimation {
  from { /* start state */ }
  to { /* end state */ }
}

.custom-animated {
  animation: customAnimation var(--duration-normal) var(--ease-out);
}
```

### Extending Components
Copy existing component styles and modify as needed. Maintain consistency with the design system.

---

## Testing

### Visual Regression Testing
Use tools like:
- Percy
- Chromatic
- BackstopJS

### Accessibility Testing
Use tools like:
- axe DevTools
- WAVE
- Lighthouse

### Performance Testing
Use tools like:
- Lighthouse
- WebPageTest
- Chrome DevTools Performance tab

### Cross-Browser Testing
Test on:
- BrowserStack
- CrossBrowserTesting
- Local device lab

---

## File Structure

```
src/
├── style.css          # Global styles and design tokens
├── ui.css             # Component-specific styles
├── input.css          # Tailwind CSS configuration
├── index.html         # Main HTML structure
├── DESIGN_SYSTEM.md   # This documentation
├── main.ts            # TypeScript entry point
├── config.ts          # Configuration
├── firebase_client.ts # Firebase integration
├── device_controller.ts # Device control logic
├── translations.ts    # i18n translations
└── ui_manager.ts      # UI management logic
```

---

## Changelog

### Version 2.0.0 (Current)
- Complete design system overhaul
- Premium cyberpunk/futuristic theme
- Enhanced accessibility features
- Comprehensive component library
- Mobile-first responsive design
- Thai font optimization
- Performance optimizations

### Version 1.0.0
- Initial design system
- Basic component library
- Tailwind CSS integration

---

## Contributing

When contributing to the design system:

1. Follow existing patterns and conventions
2. Document new components and changes
3. Test across browsers and devices
4. Ensure accessibility compliance
5. Check performance impact
6. Update this documentation

---

## Support

For questions or issues with the design system:
- Review this documentation
- Check component examples
- Test in browser DevTools
- Consult with the design team

---

## License

This design system is part of the Smart Building Command Center project.

---

**Last Updated**: January 2025
**Version**: 2.0.0
**Maintained By**: UI/UX Team
