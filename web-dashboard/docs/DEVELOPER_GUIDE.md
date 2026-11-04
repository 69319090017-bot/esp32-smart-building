# Developer Guide

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [Development Workflow](#development-workflow)
5. [Code Structure](#code-structure)
6. [Adding New Features](#adding-new-features)
7. [Debugging](#debugging)
8. [Testing](#testing)
9. [Code Style](#code-style)
10. [Common Tasks](#common-tasks)

## Prerequisites

### Required Software

- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher (comes with Node.js)
- **Git**: For version control
- **Modern web browser**: Chrome, Firefox, Edge, or Safari

### Optional Tools

- **VS Code**: Recommended IDE with extensions:
  - ESLint
  - Prettier
  - TypeScript and JavaScript Language Features
  - Tailwind CSS IntelliSense
  - Vite (Official)

### Knowledge Requirements

- **TypeScript**: Basic to intermediate knowledge
- **HTML/CSS**: Understanding of DOM manipulation
- **Async/Await**: For API calls and promises
- **WebSocket**: Basic understanding of real-time communication
- **Firebase**: Basic knowledge of Realtime Database (optional)

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd ESP32-Firebase-007-main/web-dashboard
```

### 2. Install Dependencies

```bash
npm install
```

This will install:
- `vite` - Build tool and dev server
- `typescript` - TypeScript compiler
- `tailwindcss` - CSS framework
- `@tailwindcss/cli` - Tailwind CLI
- `vite-plugin-pwa` - PWA support
- `firebase` - Firebase SDK
- `@types/node` - Node.js type definitions

### 3. Verify Installation

```bash
npm run dev
```

The dev server should start at `http://localhost:5173`

## Configuration

### Environment Variables

Create a `.env.local` file in the project root:

```bash
# Firebase Configuration
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_DATABASE_URL=https://your-project-default-rtdb.asia-southeast1.firebasedatabase.app/
VITE_FIREBASE_APP_ID=your_firebase_app_id

# Device Configuration
VITE_DEVICE_ID=smart_building_001
```

### Firebase Setup (Optional)

If you want to use Firebase Realtime Database:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project
3. Enable Realtime Database
4. Get your configuration from Project Settings
5. Add credentials to `.env.local`

**Note**: The dashboard works in standalone mode without Firebase by using Open-Meteo API directly.

### Telegram Bot Setup (Optional)

To enable Telegram alerts:

1. Create a bot via [@BotFather](https://t.me/botfather) on Telegram
2. Get your bot token
3. Create a group/channel and add your bot
4. Get the chat ID (use [@userinfobot](https://t.me/userinfobot))
5. Update `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` in `src/device_controller.ts`

```typescript
const TELEGRAM_BOT_TOKEN = "your_bot_token";
const TELEGRAM_CHAT_ID = "your_chat_id";
```

## Development Workflow

### Starting the Development Server

```bash
npm run dev
```

Features:
- Hot Module Replacement (HMR) - instant updates without page reload
- TypeScript compilation on-the-fly
- Tailwind CSS JIT compilation
- File watching for auto-rebuild

The server runs at `http://localhost:5173` by default.

### Building for Production

```bash
npm run build
```

This creates an optimized production build in the `dist/` directory:
- Minified JavaScript
- Optimized CSS
- Tree-shaking to remove unused code
- PWA service worker generation

### Previewing Production Build

```bash
npm run preview
```

This serves the production build locally for testing before deployment.

### Windows Batch Scripts

The project includes convenient batch scripts:

- `dev.bat` - Start development server
- `build.bat` - Build for production
- `clean.bat` - Clean build artifacts

## Code Structure

### Directory Layout

```
web-dashboard/
├── src/                    # Source code
│   ├── main.ts            # Application entry point
│   ├── config.ts          # Configuration constants
│   ├── ui_manager.ts      # UI state & rendering
│   ├── device_controller.ts # Device control logic
│   ├── firebase_client.ts # Firebase integration
│   ├── websocket_client.ts # WebSocket client
│   ├── websocket_types.ts # WebSocket type definitions
│   ├── firebase_types.ts  # Firebase type definitions
│   ├── store_types.ts     # State management types
│   ├── translations.ts    # Language translations
│   ├── style.css          # Global styles
│   ├── ui.css             # UI component styles
│   ├── input.css          # Tailwind input
│   └── index.html         # Main HTML template
├── dist/                  # Production build output
├── docs/                  # Documentation
├── node_modules/          # Dependencies
├── package.json           # Project configuration
├── vite.config.ts         # Vite configuration
├── tsconfig.json          # TypeScript configuration
├── tailwind.config.js     # Tailwind configuration
└── .env.local            # Environment variables (gitignored)
```

### File Responsibilities

#### main.ts
- Application initialization
- DOM event listeners
- Global function exposure
- Polling intervals
- Navigation logic

#### config.ts
- Firebase configuration
- Connection parameters
- Retry/backoff settings
- Validation rules
- Performance monitoring

#### ui_manager.ts
- Province database (77 Thai provinces)
- UI element references
- Dashboard update logic
- Toast notifications
- Text-to-speech
- History logging
- WMO code interpretation

#### device_controller.ts
- Open-Meteo API integration
- Hazard assessment
- Relay control
- Telegram alerts
- CSV export

#### firebase_client.ts
- Firebase initialization
- Realtime database listeners
- Connection state management
- Offline mode handling

#### websocket_client.ts
- WebSocket connection
- Auto-reconnection
- Heartbeat mechanism
- Message queuing
- Rate limiting
- Connection pooling

### Module Dependencies

```
main.ts
├── config.ts
├── ui_manager.ts
│   └── translations.ts
├── device_controller.ts
│   └── ui_manager.ts
└── firebase_client.ts
    ├── config.ts
    └── ui_manager.ts
```

## Adding New Features

### Adding a New Hazard Type

**1. Update Weather Data Type**

Add the new field to the weather data interface in `ui_manager.ts`:

```typescript
interface WeatherData {
  // existing fields...
  new_hazard_metric?: number;
}
```

**2. Add Assessment Logic**

Update the hazard assessment in `device_controller.ts`:

```typescript
export const fetchOpenMeteoWeather = async (provinceName: string) => {
  // ... existing code ...
  
  const newMetric = cur.new_hazard_metric || 0;
  
  let severity = "NORMAL";
  if (uv >= 11.0 || apparent >= 41.0 || gust >= 89.0 || 
      rain >= 35.0 || wmo === 96 || wmo === 99 || newMetric >= threshold) {
    severity = "CRITICAL";
  }
  // ...
}
```

**3. Add UI Elements**

Add HTML elements in `index.html`:

```html
<div class="card card-spotlight col-span-2">
  <div class="card-header">
    <span class="label">New Hazard</span>
    <span id="newHazardRiskBadge" class="label">Normal</span>
  </div>
  <div class="card-content">
    <span id="newHazardValue" class="h2">--</span>
  </div>
</div>
```

**4. Update UI Manager**

Add element references and update logic in `ui_manager.ts`:

```typescript
export const UI = {
  // existing elements...
  newHazardValue: document.getElementById('newHazardValue') as HTMLElement,
  newHazardRiskBadge: document.getElementById('newHazardRiskBadge') as HTMLElement,
};

export const updateDashboardUI = (w: any, severity = "NORMAL", province = "กรุงเทพมหานคร") => {
  // ... existing code ...
  
  const newMetric = Number(w.new_hazard_metric || 0);
  UI.newHazardValue.textContent = newMetric.toFixed(1);
  
  if (newMetric >= threshold) {
    UI.newHazardRiskBadge.textContent = "Critical";
    UI.newHazardRiskBadge.style.cssText = "background: rgba(239,68,68,0.2); color: #ef4444;";
  }
  // ...
}
```

### Adding a New Control Button

**1. Add HTML Button**

```html
<button id="newControlBtn" class="btn btn-primary">New Control</button>
```

**2. Add Reference in UI Manager**

```typescript
export const UI = {
  // existing...
  newControlBtn: document.getElementById('newControlBtn') as HTMLButtonElement,
};
```

**3. Add Control Function**

```typescript
export const newControlFunction = () => {
  // Your control logic here
  createToast("New control activated", "success");
};
```

**4. Bind Event Listener**

```typescript
document.addEventListener('DOMContentLoaded', async () => {
  // existing code...
  UI.newControlBtn?.addEventListener('click', newControlFunction);
});
```

### Adding a New Province

**1. Add to PROVINCES_MAP**

```typescript
export const PROVINCES_MAP: Record<string, { lat: number; lon: number; en: string }> = {
  // existing provinces...
  "ชื่อจังหวัดใหม่": { lat: 0.0000, lon: 0.0000, en: "New Province Name" },
};
```

**2. The selector will automatically include it**

The `populateProvinces()` function will automatically include the new province in the dropdown.

### Adding a New Language

**1. Add Translations**

```typescript
export const translations = {
  th: {
    // existing Thai translations...
  },
  en: {
    // existing English translations...
    new_key: "New English Text",
  },
  new_lang: {
    new_key: "New Language Text",
  },
};
```

**2. Update Language Toggle**

```typescript
export const toggleLanguage = () => {
  const langs = ['en', 'th', 'new_lang'];
  const currentIndex = langs.indexOf(currentLang);
  currentLang = langs[(currentIndex + 1) % langs.length];
  localStorage.setItem('sbc_lang', currentLang);
  applyLanguage();
};
```

## Debugging

### Browser DevTools

**Console Logging**

The project uses structured logging:

```typescript
console.log("[FIREBASE] Connection established");
console.warn("[WEATHER] API rate limit reached");
console.error("[TELEGRAM] Failed to send alert");
```

**Network Tab**

Monitor:
- Open-Meteo API requests
- Firebase Realtime Database connections
- WebSocket messages
- Telegram API calls

**Application Tab**

- Check localStorage for language preference
- Inspect session state
- Monitor service worker status (PWA)

### TypeScript Debugging

**Type Errors**

```bash
npm run build
```

Check for TypeScript compilation errors before committing.

**Type Checking in VS Code**

Install the TypeScript and JavaScript Language Features extension for real-time type checking.

### Common Issues

**Issue: Firebase connection fails**

```
Solution: 
1. Check .env.local credentials
2. Verify Firebase project is active
3. Check network connectivity
4. The app will run in standalone mode without Firebase
```

**Issue: Weather data not updating**

```
Solution:
1. Check Open-Meteo API status
2. Verify province coordinates
3. Check browser console for errors
4. Try manual refresh using "Fetch Live Data" button
```

**Issue: Telegram alerts not sending**

```
Solution:
1. Verify bot token and chat ID
2. Check bot has permission to send messages
3. Test bot via Telegram web interface
4. Check console for API errors
```

**Issue: Hot reload not working**

```
Solution:
1. Restart dev server
2. Clear browser cache
3. Check file watchers are working
4. Try hard refresh (Ctrl+Shift+R)
```

## Testing

### Manual Testing Checklist

**Weather Data**
- [ ] Select different provinces
- [ ] Verify weather data updates
- [ ] Check hazard assessment accuracy
- [ ] Test with simulation scenarios

**Controls**
- [ ] Toggle strobe relay
- [ ] Toggle emergency doors
- [ ] Test audio siren
- [ ] Silence alarm
- [ ] Send Telegram test

**UI**
- [ ] Check all cards display correctly
- [ ] Verify gauge animations
- [ ] Test responsive design (mobile)
- [ ] Check color themes

**Language**
- [ ] Toggle Thai/English
- [ ] Verify all text translates
- [ ] Check language persistence

**History**
- [ ] Verify history logging
- [ ] Test CSV export
- [ ] Check history limit (20 entries)

### Unit Testing (Future)

Planned testing framework:

```bash
npm install --save-dev vitest @vitest/ui
```

Example test structure:

```typescript
import { describe, it, expect } from 'vitest';
import { assessHazards } from './device_controller';

describe('Hazard Assessment', () => {
  it('should return CRITICAL for extreme UV', () => {
    const data = { uv_index: 12.0 };
    const result = assessHazards(data);
    expect(result).toBe('CRITICAL');
  });
});
```

## Code Style

### TypeScript Guidelines

**Use Type Annotations**

```typescript
// Good
const updateUI = (data: WeatherData): void => {
  // ...
};

// Avoid
const updateUI = (data) => {
  // ...
};
```

**Use Interfaces for Objects**

```typescript
interface WeatherData {
  temperature: number;
  humidity: number;
  uv_index: number;
}
```

**Use Const for Immutable Values**

```typescript
const THRESHOLD_CRITICAL = 11.0;
const API_URL = "https://api.example.com";
```

### CSS Guidelines

**Use Tailwind Utility Classes**

```html
<!-- Good -->
<div class="card card-spotlight col-span-3">
  <span class="label">Temperature</span>
</div>

<!-- Avoid custom CSS when possible -->
<div class="custom-card">
  <span class="custom-label">Temperature</span>
</div>
```

**Use CSS Variables for Theming**

```css
:root {
  --color-fg: #e5e7eb;
  --color-bg: #050506;
  --color-accent: #3b82f6;
}
```

### Naming Conventions

**Files**
- kebab-case: `device_controller.ts`, `ui_manager.ts`

**Variables/Functions**
- camelCase: `updateDashboardUI`, `fetchOpenMeteoWeather`

**Constants**
- UPPER_SNAKE_CASE: `FIREBASE_CONFIG`, `MAX_ALERTS`

**Types/Interfaces**
- PascalCase: `WeatherData`, `WebSocketMessage`

**Enums**
- PascalCase: `MessageType`, `ConnectionState`

## Common Tasks

### Update API Endpoint

```typescript
// In device_controller.ts
const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,uv_index`;
```

### Change Polling Interval

```typescript
// In main.ts
setInterval(() => {
  const prov = UI.provinceSelect.value || "กรุงเทพมหานคร";
  fetchOpenMeteoWeather(prov);
}, 60000); // Change 60000 to desired milliseconds
```

### Add Custom Toast Notification

```typescript
createToast("Your custom message", "info"); // "info", "success", "alert"
```

### Add Voice Announcement

```typescript
speakText("Your Thai text here");
```

### Export Historical Data

```typescript
exportHistoryCsv(); // Downloads CSV file
```

### Force Reconnect Firebase

```typescript
// In firebase_client.ts
// Restart the app or refresh the page
// Firebase auto-reconnects on connection loss
```

## Performance Optimization

### Lazy Loading

For large applications, consider lazy loading:

```typescript
const HeavyComponent = lazy(() => import('./HeavyComponent'));
```

### Debouncing

The project uses debouncing for high-frequency updates:

```typescript
const DEBOUNCE_CONFIG = {
  telemetryDebounceMs: 500,
  statusDebounceMs: 1000,
};
```

### Code Splitting

Vite automatically code-splits by default. For manual splitting:

```typescript
import(/* webpackChunkName: "firebase" */ './firebase_client');
```

## Deployment

### Build for Production

```bash
npm run build
```

### Deploy to Firebase Hosting

```bash
npm install -g firebase-tools
firebase login
firebase init
firebase deploy
```

### Deploy to GitHub Pages

```bash
npm install -g gh-pages
npm run build
gh-pages -d dist
```

### Deploy to Netlify

1. Connect repository to Netlify
2. Set build command: `npm run build`
3. Set publish directory: `dist`
4. Deploy automatically on push

## Resources

### Documentation

- [Vite Documentation](https://vitejs.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Firebase Documentation](https://firebase.google.com/docs)
- [Open-Meteo API](https://open-meteo.com/en/docs)

### Community

- [Vite Discord](https://chat.vitejs.dev/)
- [TypeScript Community](https://www.typescriptlang.org/community)
- [Firebase Community](https://firebase.google.com/support/community)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

### Pull Request Checklist

- [ ] Code follows style guidelines
- [ ] TypeScript compiles without errors
- [ ] Feature tested manually
- [ ] Documentation updated
- [ ] No console warnings/errors
