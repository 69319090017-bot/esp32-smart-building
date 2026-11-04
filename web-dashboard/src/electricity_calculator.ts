/**
 * ESP32 Dedicated Power & Electricity Cost Calculator
 * Measures and calculates electricity consumed specifically by the ESP32 board
 * and all connected hardware outputs/actuators (LEDs, Servo, Relays, Buzzer, Sensors).
 */

export interface Esp32DeviceChannel {
  id: string;
  name: string;
  pin: string;
  icon: string;
  description: string;
  watts: number;
  isCurrentlyOn: boolean;
  isAlwaysOn?: boolean;
  lastTurnOnTimestamp: number | null;
  accumulatedSecondsToday: number;
  lastSavedDate: string; // YYYY-MM-DD
}

const STORAGE_KEYS = {
  RATE: 'esp32_elec_rate',
  CHANNELS: 'esp32_elec_channels',
};

// Default ESP32 Hardware Channels Configuration
const DEFAULT_CHANNELS: Esp32DeviceChannel[] = [
  {
    id: 'esp32_mcu',
    name: 'บอร์ด ESP32 & เซนเซอร์ (MCU + DHT11 + PIR)',
    pin: 'Vin / 3.3V',
    icon: '🎛️',
    description: 'การกินไฟของชิป ESP32 (Wi-Fi เชื่อมต่อ) และเซนเซอร์วัดอุณหภูมิ/ความชื้น',
    watts: 1.0,
    isCurrentlyOn: true,
    isAlwaysOn: true,
    lastTurnOnTimestamp: null,
    accumulatedSecondsToday: 0,
    lastSavedDate: new Date().toISOString().slice(0, 10),
  },
  {
    id: 'room_led',
    name: 'หลอดไฟห้อง (Room LED)',
    pin: 'GPIO26',
    icon: '💡',
    description: 'ควบคุมผ่าน Dashboard หรือระบบตรวจจับ PIR ปิดอัตโนมัติ 30 วินาที',
    watts: 10.0,
    isCurrentlyOn: false,
    lastTurnOnTimestamp: null,
    accumulatedSecondsToday: 0,
    lastSavedDate: new Date().toISOString().slice(0, 10),
  },
  {
    id: 'motion_led',
    name: 'ไฟแสดงตรวจจับความเคลื่อนไหว',
    pin: 'GPIO18',
    icon: '🚶',
    description: 'ไฟ LED แจ้งเตือนเมื่อ HC-SR501 ตรวจพบคน',
    watts: 0.1,
    isCurrentlyOn: false,
    lastTurnOnTimestamp: null,
    accumulatedSecondsToday: 0,
    lastSavedDate: new Date().toISOString().slice(0, 10),
  },
  {
    id: 'buzzer',
    name: 'สัญญาณเสียงไซเรน (Buzzer)',
    pin: 'I²S (GPIO 19/21/22)',
    icon: '🔔',
    description: 'ส่งเสียงเตือนสั้นเมื่อพบการเคลื่อนไหว หรือเสียงไซเรนฉุกเฉิน',
    watts: 0.5,
    isCurrentlyOn: false,
    lastTurnOnTimestamp: null,
    accumulatedSecondsToday: 0,
    lastSavedDate: new Date().toISOString().slice(0, 10),
  },
  {
    id: 'strobe_relay',
    name: 'รีเลย์ไฟสัญญาณฉุกเฉิน (Strobe)',
    pin: 'GPIO2',
    icon: '🚨',
    description: 'รีเลย์เปิดไฟเตือนภัยสภาพอากาศ/ภัยพิบัติ',
    watts: 5.0,
    isCurrentlyOn: false,
    lastTurnOnTimestamp: null,
    accumulatedSecondsToday: 0,
    lastSavedDate: new Date().toISOString().slice(0, 10),
  },
  {
    id: 'door_relay',
    name: 'รีเลย์ประตูกลอนฉุกเฉิน (Emergency Door)',
    pin: 'GPIO4',
    icon: '🛑',
    description: 'รีเลย์ปลดล็อคประตูอัตโนมัติเมื่อเกิดเหตุฉุกเฉิน',
    watts: 3.0,
    isCurrentlyOn: false,
    lastTurnOnTimestamp: null,
    accumulatedSecondsToday: 0,
    lastSavedDate: new Date().toISOString().slice(0, 10),
  },
];

let electricityRate = 4.40; // Default Thai rate: 4.40 THB/kWh
let channels: Esp32DeviceChannel[] = [];

const getTodayDateString = (): string => new Date().toISOString().slice(0, 10);

const loadFromStorage = (): void => {
  try {
    const savedRate = localStorage.getItem(STORAGE_KEYS.RATE);
    if (savedRate) {
      const parsed = parseFloat(savedRate);
      if (!isNaN(parsed) && parsed > 0) electricityRate = parsed;
    }

    const savedChannels = localStorage.getItem(STORAGE_KEYS.CHANNELS);
    const today = getTodayDateString();

    if (savedChannels) {
      const parsedChannels: Esp32DeviceChannel[] = JSON.parse(savedChannels);
      channels = DEFAULT_CHANNELS.map((defaultCh) => {
        const found = parsedChannels.find((p) => p.id === defaultCh.id);
        if (found) {
          const isSameDay = found.lastSavedDate === today;
          return {
            ...defaultCh,
            watts: found.watts ?? defaultCh.watts,
            accumulatedSecondsToday: isSameDay ? (found.accumulatedSecondsToday || 0) : 0,
            lastSavedDate: today,
            isCurrentlyOn: defaultCh.isAlwaysOn ? true : false,
            lastTurnOnTimestamp: defaultCh.isAlwaysOn ? Date.now() : null,
          };
        }
        return { ...defaultCh, lastSavedDate: today };
      });
    } else {
      channels = DEFAULT_CHANNELS.map((ch) => ({ ...ch, lastSavedDate: today }));
      saveChannelsToStorage();
    }
  } catch (err) {
    console.warn('[Esp32PowerCalc] Failed to load data from localStorage', err);
    channels = DEFAULT_CHANNELS.map((ch) => ({ ...ch, lastSavedDate: getTodayDateString() }));
  }
};

const saveChannelsToStorage = (): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.CHANNELS, JSON.stringify(channels));
  } catch (err) {
    console.warn('[Esp32PowerCalc] Failed to save channels', err);
  }
};

/**
 * Get active seconds for a channel today
 */
export const getChannelActiveSecondsToday = (ch: Esp32DeviceChannel): number => {
  const today = getTodayDateString();
  if (ch.lastSavedDate !== today) {
    ch.lastSavedDate = today;
    ch.accumulatedSecondsToday = 0;
    ch.lastTurnOnTimestamp = ch.isCurrentlyOn ? Date.now() : null;
  }

  let totalSec = ch.accumulatedSecondsToday;
  if (ch.isCurrentlyOn && ch.lastTurnOnTimestamp) {
    totalSec += Math.floor((Date.now() - ch.lastTurnOnTimestamp) / 1000);
  }
  return totalSec;
};

/**
 * Update state for a specific channel
 */
export const updateChannelState = (channelId: string, isOn: boolean): void => {
  const ch = channels.find((c) => c.id === channelId);
  if (!ch) return;

  const today = getTodayDateString();
  if (ch.lastSavedDate !== today) {
    ch.lastSavedDate = today;
    ch.accumulatedSecondsToday = 0;
    ch.lastTurnOnTimestamp = null;
  }

  if (ch.isAlwaysOn) {
    ch.isCurrentlyOn = true;
    return;
  }

  if (isOn && !ch.isCurrentlyOn) {
    // Turned ON
    ch.isCurrentlyOn = true;
    ch.lastTurnOnTimestamp = Date.now();
  } else if (!isOn && ch.isCurrentlyOn) {
    // Turned OFF
    if (ch.lastTurnOnTimestamp) {
      const elapsed = Math.floor((Date.now() - ch.lastTurnOnTimestamp) / 1000);
      ch.accumulatedSecondsToday += Math.max(0, elapsed);
    }
    ch.isCurrentlyOn = false;
    ch.lastTurnOnTimestamp = null;
  }

  saveChannelsToStorage();
  renderAll();
};

// Aliases for specific channels
export const updateTrackedLedState = (isOn: boolean): void => updateChannelState('room_led', isOn);
export const updateTrackedMotionState = (hasMotion: boolean): void => updateChannelState('motion_led', hasMotion);
export const updateTrackedRelayState = (relayId: string, isOn: boolean): void => updateChannelState(relayId, isOn);

/**
 * Format duration into readable Thai
 */
const formatDuration = (totalSec: number): string => {
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  if (hours > 0) return `${hours} ชม. ${minutes} นาที`;
  if (minutes > 0) return `${minutes} นาที ${seconds} วิ`;
  return `${seconds} วินาที`;
};

/**
 * Calculate totals across all ESP32 channels
 */
export const calculateEsp32Totals = () => {
  let liveWatts = 0;
  let totalWhToday = 0;

  channels.forEach((ch) => {
    if (ch.isCurrentlyOn) {
      liveWatts += ch.watts;
    }
    const secToday = getChannelActiveSecondsToday(ch);
    const hoursToday = secToday / 3600;
    const whToday = ch.watts * hoursToday;
    totalWhToday += whToday;
  });

  const totalKwhToday = totalWhToday / 1000;
  const costToday = totalKwhToday * electricityRate;

  // Project monthly cost based on 24hr baseline of current profile
  // ESP32 base (24h) + other devices based on today's active ratio
  const projectedMonthlyKwh = totalKwhToday * 30;
  const projectedMonthlyCost = projectedMonthlyKwh * electricityRate;

  return {
    liveWatts,
    totalWhToday,
    totalKwhToday,
    costToday,
    projectedMonthlyKwh,
    projectedMonthlyCost,
    electricityRate,
  };
};

/**
 * Render all UI elements
 */
export const renderAll = (): void => {
  const totals = calculateEsp32Totals();

  // 1. Top Summary Cards in Electricity View
  const liveWattsEl = document.getElementById('esp32LiveWattsValue');
  const todayCostEl = document.getElementById('esp32TodayCostValue');
  const todayEnergyEl = document.getElementById('esp32TodayEnergyValue');
  const monthlyCostEl = document.getElementById('esp32MonthlyCostValue');
  const rateDisplayEl = document.getElementById('esp32RateDisplayValue');

  if (liveWattsEl) liveWattsEl.textContent = `${totals.liveWatts.toFixed(1)} W`;
  if (todayCostEl) todayCostEl.textContent = `฿${totals.costToday.toFixed(3)}`;
  if (todayEnergyEl) todayEnergyEl.textContent = `${totals.totalWhToday.toFixed(1)} Wh`;
  if (monthlyCostEl) monthlyCostEl.textContent = `฿${totals.projectedMonthlyCost.toFixed(2)}`;
  if (rateDisplayEl) rateDisplayEl.textContent = `${electricityRate.toFixed(2)} บาท/หน่วย`;

  // 2. Home View Electricity Widget
  const homeLiveWattsEl = document.getElementById('homeEsp32LiveWatts');
  const homeTodayCostEl = document.getElementById('homeEsp32TodayCost');
  const homeTodayEnergyEl = document.getElementById('homeEsp32TodayEnergy');
  const homeMonthlyEstimateEl = document.getElementById('homeEsp32MonthlyEstimate');

  if (homeLiveWattsEl) homeLiveWattsEl.textContent = `${totals.liveWatts.toFixed(1)} W`;
  if (homeTodayCostEl) homeTodayCostEl.textContent = `฿${totals.costToday.toFixed(3)}`;
  if (homeTodayEnergyEl) homeTodayEnergyEl.textContent = `${totals.totalWhToday.toFixed(1)} Wh`;
  if (homeMonthlyEstimateEl) homeMonthlyEstimateEl.textContent = `฿${totals.projectedMonthlyCost.toFixed(1)}/เดือน`;

  // 3. Render Channel List Table / Cards
  renderChannelList();
};

const renderChannelList = (): void => {
  const container = document.getElementById('esp32ChannelsContainer');
  if (!container) return;

  container.innerHTML = channels.map((ch) => {
    const activeSec = getChannelActiveSecondsToday(ch);
    const hours = activeSec / 3600;
    const whToday = ch.watts * hours;
    const costToday = (whToday / 1000) * electricityRate;

    return `
      <div class="esp32-channel-card ${ch.isCurrentlyOn ? 'active' : ''}">
        <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 0.75rem;">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <span class="channel-icon">${ch.icon}</span>
            <div>
              <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                <span style="font-weight: 600; color: var(--text-bright); font-size: 0.95rem;">${ch.name}</span>
                <span class="channel-pin-badge">${ch.pin}</span>
              </div>
              <p style="font-size: 0.78rem; color: var(--text-muted); margin-top: 0.2rem;">${ch.description}</p>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span class="channel-status-pill ${ch.isCurrentlyOn ? 'on' : 'off'}">
              ${ch.isCurrentlyOn ? '● กำลังจ่ายไฟ' : '○ ปิด/สแตนด์บาย'}
            </span>
          </div>
        </div>

        <div class="channel-metrics-grid">
          <div class="channel-metric-cell">
            <span class="channel-metric-label">กำลังไฟฟ้า (วัตต์)</span>
            <div style="display: flex; align-items: center; gap: 0.4rem; margin-top: 0.2rem;">
              <span class="channel-metric-val" style="color: var(--cyan-neon);">${ch.watts.toFixed(1)} W</span>
              <button class="btn-edit-watt" data-id="${ch.id}" data-name="${ch.name}" data-watt="${ch.watts}" title="แก้ไขกำลังวัตต์">✏️</button>
            </div>
          </div>
          <div class="channel-metric-cell">
            <span class="channel-metric-label">เปิดใช้งานวันนี้</span>
            <span class="channel-metric-val" style="color: var(--text-main);">${formatDuration(activeSec)}</span>
          </div>
          <div class="channel-metric-cell">
            <span class="channel-metric-label">พลังงานวันนี้</span>
            <span class="channel-metric-val" style="color: var(--text-bright);">${whToday.toFixed(2)} Wh</span>
          </div>
          <div class="channel-metric-cell">
            <span class="channel-metric-label">ค่าไฟวันนี้</span>
            <span class="channel-metric-val" style="color: var(--green-safe);">฿${costToday.toFixed(4)}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
};

/**
 * Initialize listeners and UI
 */
export const initElectricityCalculator = (): void => {
  loadFromStorage();

  // Handle Editing Watts
  const container = document.getElementById('esp32ChannelsContainer');
  container?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('.btn-edit-watt') as HTMLElement | null;
    if (!btn) return;

    const id = btn.dataset.id;
    const name = btn.dataset.name;
    const currentWatt = btn.dataset.watt;
    if (!id) return;

    const newWattStr = prompt(`กำหนดกำลังไฟฟ้า (วัตต์ W) สำหรับ ${name}\nค่าเดิม: ${currentWatt} W`, currentWatt);
    if (newWattStr !== null) {
      const parsed = parseFloat(newWattStr);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 5000) {
        const ch = channels.find((c) => c.id === id);
        if (ch) {
          ch.watts = parsed;
          saveChannelsToStorage();
          renderAll();
        }
      } else {
        alert('กรุณากรอกตัวเลขวัตต์ที่ถูกต้อง (เช่น 10 หรือ 0.5)');
      }
    }
  });

  // Edit Rate Modal / Prompt
  const editRateBtn = document.getElementById('btnEditElecRate');
  editRateBtn?.addEventListener('click', () => {
    const currentRate = electricityRate.toFixed(2);
    const newRateStr = prompt(`กำหนดอัตราค่าไฟฟ้าต่อหน่วย (บาท/kWh)\nค่าปัจจุบัน: ${currentRate} บาท/หน่วย`, currentRate);
    if (newRateStr !== null) {
      const parsed = parseFloat(newRateStr);
      if (!isNaN(parsed) && parsed > 0 && parsed < 100) {
        electricityRate = parsed;
        localStorage.setItem(STORAGE_KEYS.RATE, electricityRate.toString());
        renderAll();
      } else {
        alert('กรุณากรอกตัวเลขอัตราค่าไฟที่ถูกต้อง (เช่น 4.40)');
      }
    }
  });

  // Reset Channels / Watts to defaults
  const resetBtn = document.getElementById('btnResetChannels');
  resetBtn?.addEventListener('click', () => {
    if (confirm('คุณต้องการรีเซ็ทกำลังวัตต์และการตั้งค่าอุปกรณ์ ESP32 กลับเป็นค่าเริ่มต้นหรือไม่?')) {
      channels = DEFAULT_CHANNELS.map((ch) => ({ ...ch, lastSavedDate: getTodayDateString() }));
      saveChannelsToStorage();
      renderAll();
    }
  });

  // Auto-accumulate ESP32 base uptime (since ESP32 runs continuously)
  setInterval(() => {
    const mcu = channels.find((c) => c.id === 'esp32_mcu');
    if (mcu) {
      mcu.accumulatedSecondsToday += 1;
    }
    renderAll();
  }, 1000);

  // Initial render
  renderAll();
};
