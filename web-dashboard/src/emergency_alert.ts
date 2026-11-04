/**
 * emergency_alert.ts
 * Cell Broadcast / WEA-style Emergency Alert System
 * Mimics Thailand government phone emergency alerts (ระบบ Cell Broadcast)
 */

const ALERT_DISMISSED_KEY = 'sbc_ea_dismissed_ids_v1';
const OVERLAY_ID = 'emergencyAlertOverlay';

let audioCtx: AudioContext | null = null;
let beepInterval: ReturnType<typeof setInterval> | null = null;
let autoDismissTimer: ReturnType<typeof setTimeout> | null = null;
let currentAlertId: string | null = null;

// -----------------------------------------------------------------------
// Notification Permission
// -----------------------------------------------------------------------
export function initEmergencyAlert(): void {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {/* ignore */});
  }
}

// -----------------------------------------------------------------------
// Audio — WEA-style ascending beep pattern (loud, 880 Hz × 3)
// -----------------------------------------------------------------------
function getAudioContext(): AudioContext {
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

function playBeep(ctx: AudioContext, freq: number, startTime: number, duration: number, gain = 0.9): void {
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();

  osc.type = 'square';
  osc.frequency.setValueAtTime(freq, startTime);
  gainNode.gain.setValueAtTime(gain, startTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  osc.connect(gainNode);
  gainNode.connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + duration);
}

function playWEAPattern(): void {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {/* ignore */});
    }
    const now = ctx.currentTime;
    // 3 loud descending-then-rising bursts like Thai Cell Broadcast
    const pattern = [
      { freq: 830, t: 0, dur: 0.45 },
      { freq: 1050, t: 0.55, dur: 0.45 },
      { freq: 830, t: 1.1, dur: 0.45 },
      { freq: 1200, t: 1.65, dur: 0.9 },
    ];
    pattern.forEach(({ freq, t, dur }) => playBeep(ctx, freq, now + t, dur));

    // Repeat after 3.5 s for 2 more cycles
    let cycle = 0;
    beepInterval = setInterval(() => {
      cycle++;
      if (cycle >= 2) {
        if (beepInterval) clearInterval(beepInterval);
        return;
      }
      const n = getAudioContext().currentTime;
      pattern.forEach(({ freq, t, dur }) => playBeep(getAudioContext(), freq, n + t, dur));
    }, 3500);
  } catch {
    /* AudioContext may be blocked — silent fallback */
  }
}

function stopAudio(): void {
  if (beepInterval) { clearInterval(beepInterval); beepInterval = null; }
  try { audioCtx?.suspend().catch(() => {/* ignore */}); } catch {/* ignore */}
}

// -----------------------------------------------------------------------
// Vibration
// -----------------------------------------------------------------------
function vibrateDevice(): void {
  try {
    navigator.vibrate?.([600, 150, 600, 150, 600, 300, 600, 150, 600]);
  } catch {/* ignore */}
}

// -----------------------------------------------------------------------
// TTS — auto-read alert
// -----------------------------------------------------------------------
function speakAlert(text: string): void {
  try {
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'th-TH';
    utter.rate = 0.85;
    utter.volume = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  } catch {/* ignore */}
}

// -----------------------------------------------------------------------
// Browser Notification (background tab backup)
// -----------------------------------------------------------------------
function showBrowserNotification(title: string, body: string): void {
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(`🚨 ${title}`, {
        body,
        icon: '/favicon.ico',
        requireInteraction: true,
        tag: 'sbc-emergency-alert',
      });
    } catch {/* ignore */}
  }
}

// -----------------------------------------------------------------------
// Dismissed IDs tracking
// -----------------------------------------------------------------------
function getDismissedIds(): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(ALERT_DISMISSED_KEY) || '[]');
    return new Set(Array.isArray(raw) ? raw : []);
  } catch { return new Set(); }
}

function markDismissed(id: string): void {
  try {
    const ids = getDismissedIds();
    ids.add(id);
    // Keep only last 200 ids
    const trimmed = [...ids].slice(-200);
    localStorage.setItem(ALERT_DISMISSED_KEY, JSON.stringify(trimmed));
  } catch {/* ignore */}
}

export function wasAlreadyShown(alertId: string): boolean {
  return getDismissedIds().has(alertId);
}

// -----------------------------------------------------------------------
// Overlay Build & Dismiss
// -----------------------------------------------------------------------
function dismiss(): void {
  const overlay = document.getElementById(OVERLAY_ID);
  if (overlay) {
    overlay.classList.add('ea-fade-out');
    setTimeout(() => {
      overlay.hidden = true;
      overlay.classList.remove('ea-fade-out', 'ea-visible');
      overlay.innerHTML = '';
    }, 400);
  }
  stopAudio();
  if (autoDismissTimer) { clearTimeout(autoDismissTimer); autoDismissTimer = null; }
  if (currentAlertId) { markDismissed(currentAlertId); currentAlertId = null; }
  try { window.speechSynthesis.cancel(); } catch {/* ignore */}
}

/**
 * Show a fullscreen Cell Broadcast-style emergency alert.
 * @param alertId   Unique stable ID (used to prevent re-showing)
 * @param title     Headline of the alert
 * @param message   Body / summary text
 * @param agency    Issuing agency name (e.g. 'ปภ. (DDPM)')
 * @param sourceUrl Link to official source
 */
export function showEmergencyAlert(
  alertId: string,
  title: string,
  message: string,
  agency: string,
  sourceUrl: string
): void {
  if (wasAlreadyShown(alertId)) return;

  const overlay = document.getElementById(OVERLAY_ID);
  if (!overlay) return;

  currentAlertId = alertId;

  // ---- Build inner HTML ----
  const now = new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Bangkok',
  }).format(new Date());

  overlay.innerHTML = `
    <div class="ea-backdrop" id="eaBackdrop" role="presentation"></div>
    <div class="ea-dialog" role="alertdialog" aria-modal="true" aria-labelledby="eaTitle" aria-describedby="eaMsg">
      <div class="ea-header">
        <div class="ea-siren-icon" aria-hidden="true">🚨</div>
        <div class="ea-header-text">
          <div class="ea-agency-label">${agency || 'กรมป้องกันและบรรเทาสาธารณภัย (ปภ.)'}</div>
          <div class="ea-system-label">ประกาศเตือนภัยฉุกเฉิน · Emergency Alert</div>
        </div>
      </div>

      <h2 class="ea-title" id="eaTitle">${title}</h2>
      <p class="ea-message" id="eaMsg">${message}</p>

      <div class="ea-meta">
        <span>📅 ${now}</span>
        <a href="${sourceUrl}" target="_blank" rel="noopener noreferrer" class="ea-source-link">
          🔗 ดูต้นฉบับทางการ
        </a>
      </div>

      <div class="ea-actions">
        <button class="ea-btn ea-btn-speak" id="eaSpeakBtn" type="button">🔊 ฟังประกาศ</button>
        <button class="ea-btn ea-btn-dismiss" id="eaDismissBtn" type="button">✔ รับทราบ / ปิด</button>
      </div>

      <div class="ea-countdown" id="eaCountdown">ปิดอัตโนมัติใน <span id="eaCountdownNum">30</span> วินาที</div>
    </div>
  `;

  overlay.hidden = false;
  overlay.classList.add('ea-visible');

  // ---- Button handlers ----
  document.getElementById('eaDismissBtn')?.addEventListener('click', dismiss);
  document.getElementById('eaBackdrop')?.addEventListener('click', dismiss);
  document.getElementById('eaSpeakBtn')?.addEventListener('click', () => {
    speakAlert(`ประกาศเตือนภัยจาก ${agency}. ${title}. ${message}`);
  });

  // ---- Effects ----
  playWEAPattern();
  vibrateDevice();
  speakAlert(`แจ้งเตือนฉุกเฉิน จาก ${agency}. ${title}. ${message}`);
  showBrowserNotification(title, message);

  // ---- Countdown (30 s) ----
  let remaining = 30;
  const countdownEl = document.getElementById('eaCountdownNum');
  const countdownTick = setInterval(() => {
    remaining--;
    if (countdownEl) countdownEl.textContent = String(remaining);
    if (remaining <= 0) clearInterval(countdownTick);
  }, 1000);

  autoDismissTimer = setTimeout(() => {
    clearInterval(countdownTick);
    dismiss();
  }, 30_000);
}
