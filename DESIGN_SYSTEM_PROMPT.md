# LJM Design System - Implementation Guide

## Overview
This design system defines the visual language for LJM micro applications. It uses a **custom vanilla CSS approach** with a professional navy and teal color scheme, ensuring consistency across all applications.

**Design Philosophy:** Minimalist, professional, responsive, and accessible with mobile-first approach.

---

## 1. Color Palette

### Primary Colors
```css
:root {
  /* Brand Colors */
  --primary-navy: #1e3a5f;          /* Main brand color for headers, primary elements */
  --ljm-navy: #18365A;              /* Darker variant for sidebars and emphasis */
  --accent-teal: #00a8e8;           /* Call-to-action buttons, links, accents */
  --accent-teal-hover: #0095d4;     /* Hover state for teal elements */

  /* Neutrals */
  --background-white: #ffffff;      /* Base white background */
  --secondary-gray: #f5f5f7;        /* Light gray for backgrounds, borders */
  --text-dark: #333333;             /* Primary text color */
}
```

### Sidebar Colors (for admin panels)
```css
:root {
  --sidebar-bg: #18365A;
  --sidebar-text: rgba(255, 255, 255, 0.88);
  --sidebar-text-muted: rgba(255, 255, 255, 0.55);
  --sidebar-hover: rgba(255, 255, 255, 0.1);
  --sidebar-active: rgba(255, 255, 255, 0.15);
  --sidebar-accent: #00a8e8;
}
```

### Status Colors
```css
:root {
  /* Success/Confirmed */
  --success-bg: #d4edda;
  --success-text: #155724;

  /* Error/Expired */
  --error-bg: #f8d7da;
  --error-text: #721c24;

  /* Warning */
  --warning-bg: #fff3cd;
  --warning-text: #856404;

  /* Info/Pending */
  --info-bg: #cce5ff;
  --info-text: #004085;

  /* Active (alternative green) */
  --active-bg: #d1fae5;
  --active-text: #065f46;

  /* Returned (orange) */
  --returned-bg: #fed7aa;
  --returned-text: #92400e;
}
```

### Usage Guidelines
- **Navy (#1e3a5f):** Headers, table headers, modal headers, primary navigation
- **Teal (#00a8e8):** Primary buttons, active states, links, accents
- **Gray (#f5f5f7):** Secondary buttons, borders, backgrounds, disabled states
- **White (#ffffff):** Cards, modals, main content areas

---

## 2. Typography

### Font Stack
```css
font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'San Francisco', 'Segoe UI', sans-serif;
```

**Monospace (for code/data):**
```css
font-family: 'SF Mono', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', monospace;
```

### Type Scale
```css
/* Headings */
h1 { font-size: 2rem; font-weight: 600; line-height: 1.2; }      /* 32px */
h2 { font-size: 1.75rem; font-weight: 600; line-height: 1.2; }   /* 28px */
h3 { font-size: 1.5rem; font-weight: 600; line-height: 1.2; }    /* 24px */

/* Body */
body { font-size: 1rem; font-weight: 400; line-height: 1.5; }    /* 16px */

/* Small text */
.small-text { font-size: 0.875rem; }  /* 14px */
.tiny-text { font-size: 0.75rem; }    /* 12px */
```

### Responsive Typography
```css
/* Mobile (max-width: 768px) - reduce by 15-20% */
@media (max-width: 768px) {
  h1 { font-size: 1.75rem; }  /* 28px */
  h2 { font-size: 1.5rem; }   /* 24px */
  h3 { font-size: 1.25rem; }  /* 20px */
}

/* Very small screens (max-width: 480px) */
@media (max-width: 480px) {
  h1 { font-size: 1.5rem; }   /* 24px */
  h2 { font-size: 1.25rem; }  /* 20px */
}
```

---

## 3. Spacing System

### Base Unit: 4px
Use multiples of 4px for consistency.

```css
/* Spacing Scale */
--space-xs: 4px;      /* 0.25rem */
--space-sm: 8px;      /* 0.5rem */
--space-md: 12px;     /* 0.75rem */
--space-base: 16px;   /* 1rem */
--space-lg: 24px;     /* 1.5rem */
--space-xl: 32px;     /* 2rem */
--space-2xl: 40px;    /* 2.5rem */
```

### Common Patterns
```css
/* Buttons */
padding: 14px 24px;           /* Mobile */
padding: 16px 32px;           /* Desktop (min-width: 768px) */

/* Form inputs */
padding: 14px;

/* Cards */
padding: 10px 8px;            /* Mobile */
padding: 24px;                /* Desktop (min-width: 768px) */

/* Form groups */
margin-bottom: 24px;

/* Container padding */
padding: 12px 4px;            /* Mobile */
padding: 40px;                /* Desktop */
```

---

## 4. Layout System

### Container Widths
```css
.container {
  max-width: 600px;           /* Default for mobile-first */
  margin: 0 auto;
  padding: 12px 4px;
}

.admin-container {
  max-width: 1400px;
}

@media (min-width: 768px) {
  .container {
    padding: 40px;
  }
}
```

### Responsive Breakpoints
```css
/* Mobile First Approach */
/* Base styles: 0-599px (mobile) */

@media (min-width: 600px) {  /* Tablets */ }
@media (min-width: 768px) {  /* Larger tablets/small laptops */ }
@media (min-width: 1024px) { /* Desktops */ }
@media (min-width: 1200px) { /* Large desktops */ }
@media (min-width: 1400px) { /* Extra large screens */ }

/* Also use max-width for specific mobile targeting */
@media (max-width: 480px) {  /* Very small phones */ }
@media (max-width: 768px) {  /* Mobile devices */ }
```

### Grid Patterns
```css
/* Stats Grid (Dashboard) */
.stats-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}

@media (min-width: 600px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1024px) {
  .stats-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}
```

---

## 5. Component Styles

### Buttons
```css
.btn-primary {
  background-color: #00a8e8;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 14px 24px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.btn-primary:hover {
  background-color: #0095d4;
  transform: translateY(-2px);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (min-width: 768px) {
  .btn-primary {
    padding: 16px 32px;
    font-size: 1rem;
  }
}

.btn-secondary {
  background-color: #f5f5f7;
  color: #333333;
  /* Same structure as primary */
}

.btn-secondary:hover {
  background-color: #e0e0e0;
}
```

### Form Elements
```css
.form-group {
  margin-bottom: 24px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #333333;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 14px;
  border: 2px solid #f5f5f7;
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.3s ease;
  font-family: inherit;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #00a8e8;
}

.form-group textarea {
  resize: vertical;
  min-height: 100px;
}
```

### Cards
```css
.card {
  background-color: white;
  border-radius: 8px;
  padding: 10px 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
}

.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

@media (min-width: 768px) {
  .card {
    padding: 24px;
  }
}
```

### Tables
```css
.data-table {
  width: 100%;
  border-collapse: collapse;
  background-color: white;
}

.data-table thead {
  background-color: #1e3a5f;
  color: white;
}

.data-table th {
  padding: 12px;
  text-align: left;
  font-weight: 600;
}

.data-table td {
  padding: 12px;
  border-bottom: 1px solid #f5f5f7;
}

.data-table tbody tr:hover {
  background-color: #f8f9fa;
}
```

### Modals
```css
.modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background-color: white;
  width: 90%;
  max-width: 600px;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.modal-header {
  background-color: #1e3a5f;
  color: white;
  padding: 20px;
  border-radius: 8px 8px 0 0;
}

.modal-body {
  padding: 20px;
}

.modal-footer {
  padding: 15px;
  border-top: 1px solid #ddd;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
```

### Status Badges
```css
.badge {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.85rem;
  font-weight: 500;
}

.badge-success {
  background-color: #d4edda;
  color: #155724;
}

.badge-error {
  background-color: #f8d7da;
  color: #721c24;
}

.badge-warning {
  background-color: #fff3cd;
  color: #856404;
}

.badge-info {
  background-color: #cce5ff;
  color: #004085;
}

.badge-active {
  background-color: #d1fae5;
  color: #065f46;
}

/* Rounded variant for products */
.badge-rounded {
  border-radius: 12px;
  padding: 4px 10px;
}
```

---

## 6. Admin Panel Layout

### Sidebar Navigation
```css
.admin-panel {
  display: flex;
  min-height: 100vh;
}

.sidebar {
  width: 280px;
  background-color: #18365A;
  color: rgba(255, 255, 255, 0.88);
  position: fixed;
  height: 100vh;
  overflow-y: auto;
  box-shadow: 2px 0 12px rgba(0, 0, 0, 0.1);
}

.sidebar-nav a {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  color: rgba(255, 255, 255, 0.88);
  text-decoration: none;
  border-radius: 10px;
  transition: all 0.2s ease;
  margin: 4px 0;
  height: 40px;
}

.sidebar-nav a:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.sidebar-nav a.active {
  background-color: rgba(255, 255, 255, 0.15);
  border-left: 3px solid #00a8e8;
  font-weight: 600;
}

.main-content {
  margin-left: 280px;
  flex: 1;
  background-color: #f5f7fa;
}

/* Mobile responsiveness */
@media (max-width: 768px) {
  .sidebar {
    width: 100%;
    position: static;
    height: auto;
  }

  .main-content {
    margin-left: 0;
  }
}
```

### Top Bar
```css
.top-bar {
  height: 64px;
  background-color: white;
  border-bottom: 1px solid #e5e7eb;
  padding: 0 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: sticky;
  top: 0;
  z-index: 100;
}
```

---

## 7. Shadows & Visual Effects

### Shadow Scale
```css
:root {
  --shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  --shadow-hover: 0 4px 20px rgba(0, 0, 0, 0.15);
  --shadow-subtle: 0 1px 0 rgba(0, 0, 0, 0.05);
  --shadow-intense: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}
```

### Common Effects
```css
/* Hover elevation */
.elevation-hover {
  transition: all 0.3s ease;
}

.elevation-hover:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-hover);
}

/* Frosted glass effect (headers) */
.frosted {
  backdrop-filter: blur(10px);
}
```

---

## 8. Animations & Transitions

### Standard Transitions
```css
/* Fast interactions (0.15s) */
transition: color 0.15s ease;

/* Standard interactions (0.2s-0.3s) */
transition: all 0.2s ease;
transition: all 0.3s ease;

/* Smooth transforms */
transition: transform 0.3s ease, box-shadow 0.3s ease;
```

### Loading Spinner
```css
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.spinner {
  border: 3px solid #f3f3f3;
  border-top: 3px solid #00a8e8;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
}
```

### Slide/Collapse (for menus)
```css
.submenu {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.3s ease;
}

.submenu.open {
  max-height: 500px;
}
```

---

## 9. Accessibility

### Focus States
```css
button:focus,
input:focus,
select:focus,
a:focus {
  outline: 2px solid #00a8e8;
  outline-offset: 2px;
}

/* For dark backgrounds */
.dark-bg a:focus {
  outline: 2px solid rgba(255, 255, 255, 0.5);
}
```

### Input Zoom Prevention (iOS)
```css
/* Prevent zoom on focus on mobile */
input,
select,
textarea {
  font-size: 16px;
}
```

---

## 10. Implementation Checklist

When implementing this design system in a new micro app:

### Setup
- [ ] Create CSS file with CSS variables (colors, spacing, shadows)
- [ ] Set base font to system font stack
- [ ] Apply `box-sizing: border-box` globally
- [ ] Set body background to `#f5f7fa` (for admin) or white (for public)

### Typography
- [ ] Import system fonts (already available on most devices)
- [ ] Apply font-size scale (h1-h3, body, small text)
- [ ] Set line-height: 1.5 for body text
- [ ] Implement responsive typography at 768px and 480px breakpoints

### Layout
- [ ] Create container with max-width and responsive padding
- [ ] Implement mobile-first responsive breakpoints
- [ ] For admin apps: create sidebar + main content flex layout
- [ ] Make sidebar sticky/fixed on desktop, collapsible on mobile

### Components
- [ ] Style buttons (primary = teal, secondary = gray)
- [ ] Style form elements with teal focus states
- [ ] Create card component with hover elevation
- [ ] Style tables with navy headers
- [ ] Create modal with overlay and white content box
- [ ] Create status badges with appropriate colors

### Interactions
- [ ] Add 0.3s ease transitions to interactive elements
- [ ] Implement hover states (translateY + shadow)
- [ ] Add focus outlines for accessibility
- [ ] Create loading spinner with teal accent

### Testing
- [ ] Test on mobile (< 768px)
- [ ] Test on tablet (768px - 1024px)
- [ ] Test on desktop (> 1024px)
- [ ] Verify color contrast ratios
- [ ] Test keyboard navigation and focus states

---

## 11. Code Template

### Basic HTML Structure
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>App Name</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div class="container">
    <h1>Page Title</h1>

    <div class="card">
      <form>
        <div class="form-group">
          <label for="example">Label</label>
          <input type="text" id="example" name="example">
        </div>

        <button type="submit" class="btn-primary">Submit</button>
      </form>
    </div>
  </div>
</body>
</html>
```

### Basic CSS Structure
```css
/* CSS Variables */
:root {
  --primary-navy: #1e3a5f;
  --accent-teal: #00a8e8;
  --accent-teal-hover: #0095d4;
  --secondary-gray: #f5f5f7;
  --text-dark: #333333;
  --background-white: #ffffff;

  --shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  --shadow-hover: 0 4px 20px rgba(0, 0, 0, 0.15);
}

/* Reset & Base */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'San Francisco', 'Segoe UI', sans-serif;
  font-size: 1rem;
  line-height: 1.5;
  color: var(--text-dark);
  background-color: #f5f7fa;
}

/* Typography */
h1 { font-size: 2rem; font-weight: 600; line-height: 1.2; margin-bottom: 1rem; }
h2 { font-size: 1.75rem; font-weight: 600; line-height: 1.2; margin-bottom: 0.875rem; }
h3 { font-size: 1.5rem; font-weight: 600; line-height: 1.2; margin-bottom: 0.75rem; }

/* Container */
.container {
  max-width: 600px;
  margin: 0 auto;
  padding: 12px 4px;
}

@media (min-width: 768px) {
  .container {
    padding: 40px;
  }
}

/* Buttons */
.btn-primary {
  background-color: var(--accent-teal);
  color: white;
  border: none;
  border-radius: 8px;
  padding: 14px 24px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: var(--shadow);
}

.btn-primary:hover {
  background-color: var(--accent-teal-hover);
  transform: translateY(-2px);
  box-shadow: var(--shadow-hover);
}

/* Forms */
.form-group {
  margin-bottom: 24px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: var(--text-dark);
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 14px;
  border: 2px solid var(--secondary-gray);
  border-radius: 8px;
  font-size: 1rem;
  font-family: inherit;
  transition: border-color 0.3s ease;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--accent-teal);
}

/* Cards */
.card {
  background-color: white;
  border-radius: 8px;
  padding: 10px 8px;
  box-shadow: var(--shadow);
  transition: all 0.3s ease;
}

.card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-hover);
}

@media (min-width: 768px) {
  .card {
    padding: 24px;
  }
}

/* Tables */
.data-table {
  width: 100%;
  border-collapse: collapse;
  background-color: white;
}

.data-table thead {
  background-color: var(--primary-navy);
  color: white;
}

.data-table th {
  padding: 12px;
  text-align: left;
  font-weight: 600;
}

.data-table td {
  padding: 12px;
  border-bottom: 1px solid var(--secondary-gray);
}

.data-table tbody tr:hover {
  background-color: #f8f9fa;
}

/* Status Badges */
.badge {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.85rem;
  font-weight: 500;
}

.badge-success { background-color: #d4edda; color: #155724; }
.badge-error { background-color: #f8d7da; color: #721c24; }
.badge-warning { background-color: #fff3cd; color: #856404; }
.badge-info { background-color: #cce5ff; color: #004085; }
```

---

## 12. Quick Reference

### Primary Colors
- Navy: `#1e3a5f`
- Teal: `#00a8e8`
- Gray: `#f5f5f7`

### Spacing
- Small: `8px`
- Medium: `16px`
- Large: `24px`

### Border Radius
- Standard: `8px`
- Small (badges): `4px`
- Large (pills): `12px`

### Transitions
- Fast: `0.15s ease`
- Standard: `0.3s ease`

### Breakpoints
- Mobile: `< 768px`
- Tablet: `768px - 1024px`
- Desktop: `> 1024px`

---

## Questions to Ask When Implementing

1. **Is this an admin app or public-facing?**
   - Admin: Use sidebar layout with navy (#18365A)
   - Public: Use simple container layout

2. **Does it need a navigation bar?**
   - Yes: Use sticky top bar (64px height) or sidebar
   - No: Use simple header

3. **What are the primary actions?**
   - Use teal buttons for primary actions
   - Use gray buttons for secondary actions

4. **What status indicators are needed?**
   - Use badge components with appropriate status colors

5. **Does it need data tables?**
   - Use `.data-table` with navy header

6. **Mobile responsiveness level?**
   - Full: Implement all breakpoints (768px, 1024px)
   - Basic: Just mobile (< 768px) and desktop (> 768px)

---

## Final Notes

- Always start mobile-first, then add desktop enhancements
- Use CSS variables for all colors to ensure consistency
- Test hover and focus states for accessibility
- Keep shadows subtle - use the defined shadow variables
- Maintain 8px spacing grid for alignment
- Ensure color contrast meets WCAG AA standards
- Use system fonts - no external font imports needed

**This design system prioritizes simplicity, performance, and consistency across all LJM micro applications.**
