import { vi } from 'vitest';
import { TextEncoder, TextDecoder } from 'util';

// Polyfill for TextEncoder/TextDecoder in jsdom environment
global.TextEncoder = TextEncoder as any;
global.TextDecoder = TextDecoder as any;

// Mock window.location
Object.defineProperty(window, 'location', {
  value: {
    search: '',
    hostname: 'localhost',
    port: '5173',
    protocol: 'http:',
    href: 'http://localhost:5173/',
  },
  writable: true,
});

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => {
      const keys = Object.keys(store);
      return keys[index] || null;
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock URLSearchParams
global.URLSearchParams = class URLSearchParams {
  private params: Record<string, string> = {};

  constructor(search?: string) {
    if (search) {
      const pairs = search.substring(1).split('&');
      pairs.forEach(pair => {
        const [key, value] = pair.split('=');
        if (key) {
          this.params[decodeURIComponent(key)] = decodeURIComponent(value || '');
        }
      });
    }
  }

  get(name: string): string | null {
    return this.params[name] || null;
  }

  set(name: string, value: string): void {
    this.params[name] = value;
  }

  has(name: string): boolean {
    return name in this.params;
  }

  delete(name: string): void {
    delete this.params[name];
  }

  toString(): string {
    return Object.entries(this.params)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
  }
} as any;

// Mock fetch globally
global.fetch = vi.fn();

// Mock Web Speech API
global.speechSynthesis = {
  speak: vi.fn(),
  cancel: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  getVoices: vi.fn(() => [
    { name: 'Microsoft Noppakao - Thai', lang: 'th-TH', default: true },
    { name: 'Google UK English Female', lang: 'en-GB', default: false },
  ]),
} as any;

// Mock SpeechSynthesisUtterance
global.SpeechSynthesisUtterance = class SpeechSynthesisUtterance {
  text: string;
  lang: string = 'th-TH';
  voice: any = null;
  volume: number = 1;
  rate: number = 1;
  pitch: number = 1;
  onend: (() => void) | null = null;
  onerror: ((error: any) => void) | null = null;

  constructor(text: string) {
    this.text = text;
  }
} as any;

// Mock Firebase (we'll mock it in tests, but provide basic structure here)
vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({
    name: 'mock-app',
  })),
}));

vi.mock('firebase/database', () => ({
  getDatabase: vi.fn(() => ({})),
  ref: vi.fn(() => ({})),
  onValue: vi.fn(),
  set: vi.fn(),
  update: vi.fn(),
  get: vi.fn(),
}));

// Clean up after each test
afterEach(() => {
  vi.clearAllMocks();
  localStorageMock.clear();
});
