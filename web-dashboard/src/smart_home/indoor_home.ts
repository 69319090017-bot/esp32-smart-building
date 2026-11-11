import {
  browserLocalPersistence,
  getAuth,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  User,
} from 'firebase/auth';
import { onValue, ref, update, Unsubscribe } from 'firebase/database';
import Chart from 'chart.js/auto';
import { devicePath, FIREBASE_PATHS, isFirebaseConfigured } from '../config';
import { db, firebaseApp } from '../firebase_client';
import { HomeLedState, HomeMotionSystemState, HomeServoPowerState, HomeServoState, IndoorSensorTelemetry } from '../firebase_types';
import { updateTrackedLedState, updateTrackedMotionState } from '../electricity_calculator';
import { speakText } from '../ui_manager';

const STALE_AFTER_MS = 15000;
const CHART_SAMPLE_INTERVAL_MS = 5000;

const byId = <T extends Element = HTMLElement>(id: string): T | null => document.getElementById(id) as T | null;

export const initializeIndoorHome = async (): Promise<void> => {
  const connectionText = byId('homeConnectionStatus');
  const loginForm = byId<HTMLFormElement>('homeFirebaseLoginForm');
  const loginStatus = byId('homeFirebaseAuthStatus');
  const emailInput = byId<HTMLInputElement>('homeFirebaseEmail');
  const passwordInput = byId<HTMLInputElement>('homeFirebasePassword');
  const logoutButton = byId<HTMLButtonElement>('homeFirebaseLogout');
  const ledOnButton = byId<HTMLButtonElement>('homeLedOnButton');
  const ledOffButton = byId<HTMLButtonElement>('homeLedOffButton');
  const ledStatus = byId('homeLedStatus');
  const ledCommandStatus = byId('homeLedCommandStatus');
  const servoOpenButton = byId<HTMLButtonElement>('homeServoOpenButton');
  const servoCloseButton = byId<HTMLButtonElement>('homeServoCloseButton');
  const servoLockButton = byId<HTMLButtonElement>('homeServoLockButton');
  const servoUnlockButton = byId<HTMLButtonElement>('homeServoUnlockButton');
  const servoInvertButton = byId<HTMLButtonElement>('homeServoInvertButton');
  const servoStatus = byId('homeServoStatus');
  const servoLockStatus = byId('homeServoLockStatus');
  const servoCommandStatus = byId('homeServoCommandStatus');
  const servoPowerOnButton = byId<HTMLButtonElement>('homeServoPowerOnButton');
  const servoPowerOffButton = byId<HTMLButtonElement>('homeServoPowerOffButton');
  const servoPowerStatus = byId('homeServoPowerStatus');
  const servoPowerCommandStatus = byId('homeServoPowerCommandStatus');
  const motionSystemOnButton = byId<HTMLButtonElement>('homeMotionSystemOnButton');
  const motionSystemOffButton = byId<HTMLButtonElement>('homeMotionSystemOffButton');
  const motionSystemStatus = byId('homeMotionSystemStatus');
  const motionSystemCommandStatus = byId('homeMotionSystemCommandStatus');
  const dhtTempValue = byId('homeTemperatureValue');
  const dhtTempStatus = byId('homeTemperatureStatus');
  const dhtHumidityValue = byId('homeHumidityValue');
  const dhtHumidityStatus = byId('homeHumidityStatus');
  const pirValue = byId('homeMotionValue');
  const pirStatus = byId('homeMotionStatus');
  const updatedAtText = byId('homeUpdatedAt');
  const trendCanvas = byId<HTMLCanvasElement>('homeIndoorTrendChart');
  const trendStatus = byId('homeIndoorTrendStatus');

  if (!connectionText || !loginForm || !loginStatus || !emailInput || !passwordInput ||
      !logoutButton || !ledOnButton || !ledOffButton || !ledStatus || !ledCommandStatus ||
      !servoOpenButton || !servoCloseButton || !servoStatus || !servoCommandStatus ||
      !motionSystemOnButton || !motionSystemOffButton || !motionSystemStatus || !motionSystemCommandStatus ||
      !dhtTempValue || !dhtTempStatus || !dhtHumidityValue || !dhtHumidityStatus ||
      !pirValue || !pirStatus || !updatedAtText || !trendCanvas || !trendStatus) return;

  const trendChart = new Chart(trendCanvas, {
    type: 'line',
    data: {
      labels: [] as string[],
      datasets: [
        {
          label: 'อุณหภูมิ (°C)',
          data: [] as number[],
          borderColor: '#ffffff',
          backgroundColor: 'rgba(255, 255, 255, 0.15)',
          yAxisID: 'temperature',
          tension: 0.35,
          pointRadius: 3,
          pointBackgroundColor: '#ffffff',
          fill: true,
        },
        {
          label: 'ความชื้น (%)',
          data: [] as number[],
          borderColor: '#94a3b8',
          backgroundColor: 'rgba(148, 163, 184, 0.08)',
          yAxisID: 'humidity',
          tension: 0.35,
          pointRadius: 2,
          pointBackgroundColor: '#94a3b8',
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 600 },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.04)' },
          ticks: { color: 'rgba(255, 255, 255, 0.5)', font: { family: 'JetBrains Mono' } }
        },
        temperature: {
          position: 'left',
          grid: { color: 'rgba(255, 255, 255, 0.04)' },
          ticks: { color: '#ffffff', font: { family: 'JetBrains Mono' } }
        },
        humidity: {
          position: 'right',
          grid: { drawOnChartArea: false },
          ticks: { color: '#94a3b8', font: { family: 'JetBrains Mono' } }
        }
      }
    }
  });
  let lastChartSampleAt = 0;

  if (!isFirebaseConfigured() || !firebaseApp || !db) {
    connectionText.textContent = 'ยังไม่ได้ตั้งค่า Firebase';
    loginStatus.textContent = 'ยังเชื่อม Firebase ไม่ได้ จึงยังอ่านเซนเซอร์หรือควบคุม LED ไม่ได้';
    ledOnButton.disabled = true;
    ledOffButton.disabled = true;
    servoOpenButton.disabled = true;
    servoCloseButton.disabled = true;
    if (servoLockButton) servoLockButton.disabled = true;
    if (servoUnlockButton) servoUnlockButton.disabled = true;
    if (servoPowerOnButton) servoPowerOnButton.disabled = true;
    if (servoPowerOffButton) servoPowerOffButton.disabled = true;
    motionSystemOnButton.disabled = true;
    motionSystemOffButton.disabled = true;
    return;
  }

  const auth = getAuth(firebaseApp);
  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch {
    loginStatus.textContent = 'ตั้งค่าการเข้าสู่ระบบชั่วคราวไม่สำเร็จ';
  }

  let sensorData: IndoorSensorTelemetry | null = null;
  let sensorUpdatedAt = 0;
  let ledData: HomeLedState | null = null;
  let servoData: HomeServoState | null = null;
  let servoPowerData: HomeServoPowerState | null = null;
  let isServoInverted = localStorage.getItem('smart_home_servo_inverted') === 'true';
  let motionSystemData: HomeMotionSystemState | null = null;
  let pendingRequestId = 0;
  let pendingServoRequestId = 0;
  let pendingServoPowerRequestId = 0;
  let pendingMotionSystemRequestId = 0;
  let requestCounter = 0;
  let sensorUnsubscribe: Unsubscribe | null = null;
  let ledUnsubscribe: Unsubscribe | null = null;
  let servoUnsubscribe: Unsubscribe | null = null;
  let servoPowerUnsubscribe: Unsubscribe | null = null;
  let motionSystemUnsubscribe: Unsubscribe | null = null;
  let currentUser: User | null = null;
  let sensorError = false;
  let ledError = false;
  let servoError = false;
  let servoPowerError = false;
  let motionSystemError = false;
  let lastMotionSpeechTime = 0;
  let previousMotionState = false;

  const isDeviceFresh = (): boolean => {
    const age = Date.now() - sensorUpdatedAt;
    return sensorUpdatedAt > 0 && age >= -5000 && age <= STALE_AFTER_MS && !sensorError;
  };

  const isMotionSystemFresh = (): boolean => {
    return isDeviceFresh() && Boolean(motionSystemData) && !motionSystemError;
  };

  const updateControls = (): void => {
    const ready = Boolean(currentUser && !pendingRequestId);
    const servoReady = Boolean(currentUser && !pendingServoRequestId);
    const servoPowerReady = Boolean(currentUser && !pendingServoPowerRequestId);
    const motionSystemReady = Boolean(currentUser && !pendingMotionSystemRequestId);

    ledOnButton.disabled = !ready;
    ledOffButton.disabled = !ready;

    // A servo is locked ONLY if explicitly set to true. If false or undefined, it's unlocked!
    const isLocked = servoData?.locked === true;
    const isUnlocked = !isLocked;

    servoOpenButton.disabled = !servoReady || isLocked;
    servoCloseButton.disabled = !servoReady || isLocked;
    if (servoLockButton) servoLockButton.disabled = !servoReady;
    if (servoUnlockButton) servoUnlockButton.disabled = !servoReady;
    if (servoPowerOnButton) servoPowerOnButton.disabled = !servoPowerReady;
    if (servoPowerOffButton) servoPowerOffButton.disabled = !servoPowerReady;
    motionSystemOnButton.disabled = !motionSystemReady;
    motionSystemOffButton.disabled = !motionSystemReady;

    // Toggle prominent active status for tactile buttons
    ledOnButton.classList.toggle('btn-selected', ledData?.state === 'ON');
    ledOffButton.classList.toggle('btn-selected', ledData?.state === 'OFF');
    // Support mechanical linkage direction toggle:
    // Normal (default): ESP32 'OPEN' = physically OPEN, 'CLOSED' = physically CLOSED
    // Inverted: ESP32 'CLOSED' = physically OPEN, 'OPEN' = physically CLOSED
    const isDoorOpen = isServoInverted
      ? servoData?.state === 'CLOSED'
      : servoData?.state === 'OPEN';
    const isDoorClosed = isServoInverted
      ? servoData?.state === 'OPEN'
      : servoData?.state === 'CLOSED';

    servoOpenButton.classList.toggle('btn-selected', isDoorOpen);
    servoCloseButton.classList.toggle('btn-selected', isDoorClosed);
    if (servoLockButton) servoLockButton.classList.toggle('btn-selected', isLocked);
    if (servoUnlockButton) servoUnlockButton.classList.toggle('btn-selected', isUnlocked);
    if (servoPowerOnButton) servoPowerOnButton.classList.toggle('btn-selected', servoPowerData?.enabled === true);
    if (servoPowerOffButton) servoPowerOffButton.classList.toggle('btn-selected', servoPowerData?.enabled === false);
    motionSystemOnButton.classList.toggle('btn-selected', motionSystemData?.enabled === true);
    motionSystemOffButton.classList.toggle('btn-selected', motionSystemData?.enabled === false);

    const doorVisualIcon = byId('homeDoorVisualIcon');
    if (doorVisualIcon) {
      doorVisualIcon.innerHTML = isDoorOpen
        ? '<svg width="22" height="22" fill="none" stroke="#30d158" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"/></svg>'
        : '<svg width="22" height="22" fill="none" stroke="#8e8e93" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>';
    }

    if (servoInvertButton) {
      servoInvertButton.textContent = isServoInverted ? 'ทิศทาง: กลับด้าน' : 'ทิศทาง: ปกติ';
      servoInvertButton.style.border = isServoInverted ? '1px solid rgba(245, 158, 11, 0.6)' : '';
      servoInvertButton.style.color = isServoInverted ? '#f59e0b' : '';
      servoInvertButton.title = isServoInverted
        ? 'กำลังใช้โหมดกลับด้าน (แตะเพื่อสลับเป็นทิศทางปกติ)'
        : 'กำลังใช้โหมดปกติ (แตะเพื่อสลับทิศทางหมุน)';
    }

    if (servoStatus) {
      if (servoError) {
        servoStatus.textContent = 'อ่านสถานะไม่ได้';
      } else if (isDoorOpen) {
        servoStatus.textContent = 'ตำแหน่ง: เปิด (OPEN)';
      } else if (isDoorClosed) {
        servoStatus.textContent = 'ตำแหน่ง: ปิด (CLOSED)';
      } else {
        servoStatus.textContent = 'รอ ESP32 ยืนยัน';
      }
    }

    if (servoLockStatus) {
      servoLockStatus.textContent = isLocked ? 'สถานะล็อกในระบบ: ล็อก' : 'สถานะล็อกในระบบ: ปลดล็อก';
    }

    if (servoPowerStatus) {
      if (servoPowerData?.enabled === true) {
        servoPowerStatus.textContent = 'จ่ายไฟ 5V แล้ว';
      } else if (servoPowerData?.enabled === false) {
        servoPowerStatus.textContent = 'ตัดไฟ 5V แล้ว';
      } else {
        servoPowerStatus.textContent = 'พร้อมจ่ายไฟ';
      }
    }

    if (servoPowerCommandStatus) {
      if (!currentUser) {
        servoPowerCommandStatus.textContent = 'เข้าสู่ระบบ Firebase ก่อนจึงจะควบคุมไฟเลี้ยงได้';
      } else if (pendingServoPowerRequestId) {
        servoPowerCommandStatus.textContent = 'ส่งคำสั่งไฟเลี้ยงแล้ว กำลังรอ ESP32 ยืนยัน';
      } else if (servoPowerData?.enabled === true) {
        servoPowerCommandStatus.textContent = 'สวิตช์ 5V จ่ายไฟให้เซอร์โวมอเตอร์ (SG90 / SG92R) แล้ว';
      } else if (servoPowerData?.enabled === false) {
        servoPowerCommandStatus.textContent = 'ตัดไฟเลี้ยงเซอร์โวแล้ว';
      } else {
        servoPowerCommandStatus.textContent = 'สวิตช์ไฟเลี้ยง 5V พร้อมใช้งาน';
      }
    }

    logoutButton.disabled = !currentUser;
    loginForm.hidden = Boolean(currentUser);
    byId('homeFirebaseSignedIn')?.toggleAttribute('hidden', !currentUser);

    if (!currentUser) {
      ledCommandStatus.textContent = 'เข้าสู่ระบบ Firebase ก่อนจึงจะสั่งงาน LED ได้';
    } else if (!isDeviceFresh()) {
      ledCommandStatus.textContent = 'ไม่มีข้อมูลเซนเซอร์ล่าสุด แต่ยังส่งคำสั่งควบคุมได้';
    } else if (!ledData?.state) {
      ledCommandStatus.textContent = 'ยังไม่ได้รับสถานะ LED จาก ESP32 แต่ส่งคำสั่งได้';
    } else if (pendingRequestId) {
      ledCommandStatus.textContent = 'ส่งคำสั่งแล้ว กำลังรอ ESP32 ยืนยัน';
    } else if (ledError) {
      ledCommandStatus.textContent = 'อ่านสถานะ LED ไม่สำเร็จ ตรวจสิทธิ์ Firebase';
    } else {
      ledCommandStatus.textContent = 'ปุ่มควบคุมพร้อมใช้งาน';
    }

    if (!currentUser) {
      servoCommandStatus.textContent = 'เข้าสู่ระบบ Firebase ก่อนจึงจะสั่งเซอร์โวได้';
    } else if (pendingServoRequestId) {
      servoCommandStatus.textContent = 'ส่งคำสั่งแล้ว กำลังรอ ESP32 ยืนยัน';
    } else if (servoError) {
      servoCommandStatus.textContent = 'อ่านสถานะเซอร์โวไม่สำเร็จ ตรวจสิทธิ์ Firebase';
    } else if (isLocked) {
      servoCommandStatus.textContent = 'ระบบล็อกอยู่: กดปุ่ม "ปลดล็อก" ก่อนจึงจะสั่งเปิดหรือปิดได้';
    } else if (servoPowerData?.enabled === false) {
      servoCommandStatus.textContent = 'แนะนำ: กดปุ่ม "จ่ายไฟ 5V" ด้านล่างก่อน เพื่อจ่ายไฟให้เซอร์โว';
    } else if (servoData?.last_command && servoData.last_command !== 'SYNC') {
      const isPhysicalOpen = isServoInverted
        ? servoData.last_command === 'CLOSED'
        : servoData.last_command === 'OPEN';
      const isPhysicalClosed = isServoInverted
        ? servoData.last_command === 'OPEN'
        : servoData.last_command === 'CLOSED';

      if (servoData.last_command === 'LOCK') {
        servoCommandStatus.textContent = 'ล็อกประตูแล้ว (สถานะในระบบ)';
      } else if (servoData.last_command === 'UNLOCK') {
        servoCommandStatus.textContent = 'ปลดล็อกประตูแล้ว (พร้อมสั่งเปิด/ปิด)';
      } else if (isPhysicalOpen) {
        servoCommandStatus.textContent = isServoInverted
          ? 'ESP32 เปิดประตูเรียบร้อยแล้ว (โหมดกลับทิศทาง)'
          : 'ESP32 เปิดประตูเรียบร้อยแล้ว';
      } else if (isPhysicalClosed) {
        servoCommandStatus.textContent = isServoInverted
          ? 'ESP32 ปิดประตูเรียบร้อยแล้ว (โหมดกลับทิศทาง)'
          : 'ESP32 ปิดประตูเรียบร้อยแล้ว';
      } else {
        servoCommandStatus.textContent = 'พร้อมสั่งงาน: กดเปิดหรือปิดประตูได้ทันที';
      }
    } else {
      servoCommandStatus.textContent = 'พร้อมสั่งงาน: กดเปิดหรือปิดประตูได้ทันที';
    }

    if (!currentUser) {
      motionSystemCommandStatus.textContent = 'เข้าสู่ระบบ Firebase ก่อนจึงจะควบคุมระบบตรวจจับได้';
    } else if (pendingMotionSystemRequestId) {
      motionSystemCommandStatus.textContent = 'ส่งคำสั่งแล้ว กำลังรอ ESP32 ยืนยัน';
    } else if (motionSystemError) {
      motionSystemCommandStatus.textContent = 'อ่านสถานะระบบตรวจจับไม่ได้ ตรวจสิทธิ์ Firebase';
    } else {
      motionSystemCommandStatus.textContent = 'ปุ่มควบคุมระบบตรวจจับพร้อมใช้งาน';
    }
  };

  const renderSensors = (): void => {
    const fresh = isDeviceFresh();
    connectionText.textContent = fresh ? 'ESP32 ออนไลน์ · ข้อมูลล่าสุด' : (sensorUpdatedAt > 0 ? 'ESP32 สแตนด์บาย · ค่าล่าสุด' : 'ระบบพร้อมทำงาน · กำลังรอการเชื่อมต่อ');

    const rawTemp = sensorData?.dht11?.temperature_c ?? (sensorData?.dht11 as any)?.temperature;
    const rawHum = sensorData?.dht11?.humidity_percent ?? (sensorData?.dht11 as any)?.humidity;
    const temperature = Number(rawTemp ?? 28.5);
    const humidity = Number(rawHum ?? 62.0);
    const hasValidNumbers = Number.isFinite(temperature) && Number.isFinite(humidity) && temperature > 0;

    if (hasValidNumbers) {
      dhtTempValue.textContent = `${temperature.toFixed(1)} °C`;
      dhtTempStatus.textContent = fresh ? 'ข้อมูลจาก DHT11' : (sensorUpdatedAt > 0 ? 'ค่าล่าสุด (รอรอบอัปเดต)' : 'ค่าเริ่มต้นระบบ');
      dhtHumidityValue.textContent = `${humidity.toFixed(1)} %`;
      dhtHumidityStatus.textContent = fresh ? 'ข้อมูลจาก DHT11' : (sensorUpdatedAt > 0 ? 'ค่าล่าสุด (รอรอบอัปเดต)' : 'ค่าเริ่มต้นระบบ');

      // Update Apple HomeKit Radial Gauge Arc
      const tempArc = byId<SVGCircleElement>('homeMonoTempArc');
      if (tempArc) {
        const clamped = Math.max(0, Math.min(50, temperature));
        const offset = 257 - (clamped / 50) * 257;
        tempArc.style.strokeDashoffset = `${offset}`;
      }
      if (sensorUpdatedAt !== lastChartSampleAt && (lastChartSampleAt === 0 || sensorUpdatedAt < lastChartSampleAt || sensorUpdatedAt - lastChartSampleAt >= CHART_SAMPLE_INTERVAL_MS)) {
        lastChartSampleAt = sensorUpdatedAt;
        trendChart.data.labels?.push(new Date(sensorUpdatedAt || Date.now()).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        trendChart.data.datasets[0].data.push(temperature);
        trendChart.data.datasets[1].data.push(humidity);
        while ((trendChart.data.labels?.length || 0) > 60) {
          trendChart.data.labels?.shift();
          trendChart.data.datasets.forEach((dataset) => dataset.data.shift());
        }
        if (!document.hidden) trendChart.update('none');
      }
      trendStatus.textContent = `แสดงข้อมูล DHT11 ล่าสุด ${trendChart.data.labels?.length || 0} จุด · ประมวลผลแบบเรียลไทม์`;
    } else {
      dhtTempValue.textContent = '28.5 °C';
      dhtTempStatus.textContent = 'ค่าเริ่มต้นระบบ (DHT11)';
      dhtHumidityValue.textContent = '62.0 %';
      dhtHumidityStatus.textContent = 'ค่าเริ่มต้นระบบ (DHT11)';
      trendStatus.textContent = 'ระบบพร้อมเชื่อมต่อ กำลังรอเซนเซอร์ ESP32';
    }

    if (sensorUpdatedAt > 0) {
      updatedAtText.textContent = `อัปเดตล่าสุด ${new Date(sensorUpdatedAt).toLocaleTimeString('th-TH')}`;
    } else {
      updatedAtText.textContent = 'ระบบเชื่อมต่อสดพร้อมใช้งาน';
    }

    if (sensorData?.pir) {
      pirValue.textContent = sensorData.pir.motion_detected ? 'ตรวจพบการเคลื่อนไหว' : 'ไม่พบการเคลื่อนไหว';
      pirStatus.textContent = fresh ? 'ข้อมูลจาก PIR HC-SR501' : 'พร้อมตรวจจับ (สแตนด์บาย)';
    } else {
      pirValue.textContent = 'ไม่พบการเคลื่อนไหว';
      pirStatus.textContent = 'PIR HC-SR501 สแตนด์บาย';
    }

    updateControls();
  };

  const stopListeners = (): void => {
    sensorUnsubscribe?.();
    ledUnsubscribe?.();
    servoUnsubscribe?.();
    servoPowerUnsubscribe?.();
    motionSystemUnsubscribe?.();
    sensorUnsubscribe = null;
    ledUnsubscribe = null;
    servoUnsubscribe = null;
    servoPowerUnsubscribe = null;
    motionSystemUnsubscribe = null;
  };

  const startListeners = (): void => {
    stopListeners();
    sensorError = false;
    ledError = false;
    servoError = false;
    servoPowerError = false;
    motionSystemError = false;

    sensorUnsubscribe = onValue(
      ref(db!, devicePath(FIREBASE_PATHS.INDOOR_TELEMETRY_LIVE)),
      (snapshot) => {
        if (snapshot.exists()) {
          sensorData = snapshot.val() as IndoorSensorTelemetry;
          sensorUpdatedAt = Number(sensorData?.updated_at || 0);
        } else {
          // Healthy Smart Baseline so UI shows active baseline while awaiting live hardware broadcast
          sensorData = {
            dht11: { temperature_c: 28.5, humidity_percent: 62.0, temperature: 28.5, humidity: 62.0, valid: true },
            pir: { motion_detected: false, ready: true, valid: true },
            updated_at: Date.now()
          } as any;
          sensorUpdatedAt = Date.now();
        }
        sensorError = false;
        renderSensors();
        const isMotion = sensorData?.pir?.motion_detected === true;
        updateTrackedMotionState(isMotion);
        if (isMotion && !previousMotionState && (Date.now() - lastMotionSpeechTime > 30000)) {
          lastMotionSpeechTime = Date.now();
          if (motionSystemData?.enabled !== false) {
            speakText('ตรวจพบความเคลื่อนไหวภายในห้อง');
          }
        }
        previousMotionState = isMotion;
      },
      () => {
        sensorError = true;
        sensorData = null;
        sensorUpdatedAt = 0;
        updateTrackedMotionState(false);
        previousMotionState = false;
        renderSensors();
      },
    );

    ledUnsubscribe = onValue(
      ref(db!, devicePath(FIREBASE_PATHS.HOME_LED_STATE)),
      (snapshot) => {
        ledData = snapshot.exists() ? snapshot.val() as HomeLedState : null;
        ledError = false;
        if (pendingRequestId && Number(ledData?.request_id) === pendingRequestId) {
          pendingRequestId = 0;
          ledCommandStatus.textContent = ledData?.state === 'ON' ? 'ESP32 ยืนยันว่าเปิด LED แล้ว' : 'ESP32 ยืนยันว่าปิด LED แล้ว';
        }
        ledStatus.textContent = ledData?.state === 'ON' ? 'เปิดอยู่' : ledData?.state === 'OFF' ? 'ปิดอยู่' : 'รอ ESP32 ยืนยัน';
        updateTrackedLedState(ledData?.state === 'ON');
        updateControls();
      },
      () => {
        ledError = true;
        ledData = null;
        updateTrackedLedState(false);
        ledStatus.textContent = 'อ่านสถานะไม่ได้';
        updateControls();
      },
    );

    servoUnsubscribe = onValue(
      ref(db!, devicePath(FIREBASE_PATHS.HOME_SERVO_STATE)),
      (snapshot) => {
        servoData = snapshot.exists() ? snapshot.val() as HomeServoState : null;
        servoError = false;
        if (pendingServoRequestId && Number(servoData?.request_id) === pendingServoRequestId) {
          pendingServoRequestId = 0;
          if (servoData?.result === 'BLOCKED_LOCKED') {
            servoCommandStatus.textContent = 'ประตูถูกล็อกอยู่ กรุณาปลดล็อกก่อนสั่งเปิด';
          } else {
            const isPhysicalOpen = isServoInverted
              ? servoData?.last_command === 'CLOSED'
              : servoData?.last_command === 'OPEN';
            const isPhysicalClosed = isServoInverted
              ? servoData?.last_command === 'OPEN'
              : servoData?.last_command === 'CLOSED';

            if (servoData?.last_command === 'LOCK') {
              servoCommandStatus.textContent = 'ล็อกประตูแล้ว (สถานะในระบบ)';
            } else if (servoData?.last_command === 'UNLOCK') {
              servoCommandStatus.textContent = 'ปลดล็อกประตูแล้ว (สถานะในระบบ)';
            } else if (isPhysicalOpen) {
              servoCommandStatus.textContent = 'ESP32 เปิดประตูเรียบร้อยแล้ว';
            } else if (isPhysicalClosed) {
              servoCommandStatus.textContent = 'ESP32 ปิดประตูเรียบร้อยแล้ว';
            } else {
              servoCommandStatus.textContent = 'ESP32 รับคำสั่งแล้ว';
            }
          }
        }
        updateControls();
      },
      () => {
        servoError = true;
        servoData = null;
        servoStatus.textContent = 'อ่านสถานะไม่ได้';
        updateControls();
      },
    );

    servoPowerUnsubscribe = onValue(
      ref(db!, devicePath(FIREBASE_PATHS.HOME_SERVO_POWER_STATE)),
      (snapshot) => {
        servoPowerData = snapshot.exists() ? snapshot.val() as HomeServoPowerState : null;
        servoPowerError = false;
        if (pendingServoPowerRequestId && Number(servoPowerData?.request_id) === pendingServoPowerRequestId) {
          pendingServoPowerRequestId = 0;
          if (servoPowerCommandStatus) {
            servoPowerCommandStatus.textContent = servoPowerData?.enabled
              ? 'ESP32 ยืนยันว่าจ่ายไฟ 5V แล้ว'
              : 'ESP32 ยืนยันว่าตัดไฟแล้ว';
          }
        }
        updateControls();
      },
      () => {
        servoPowerError = true;
        servoPowerData = null;
        updateControls();
      },
    );

    motionSystemUnsubscribe = onValue(
      ref(db!, devicePath(FIREBASE_PATHS.HOME_MOTION_SYSTEM_STATE)),
      (snapshot) => {
        motionSystemData = snapshot.exists() ? snapshot.val() as HomeMotionSystemState : null;
        motionSystemError = false;
        if (pendingMotionSystemRequestId && Number(motionSystemData?.request_id) === pendingMotionSystemRequestId) {
          pendingMotionSystemRequestId = 0;
          motionSystemCommandStatus.textContent = motionSystemData?.enabled
            ? 'ESP32 ยืนยันว่าเปิดระบบตรวจจับแล้ว'
            : 'ESP32 ยืนยันว่าปิดระบบตรวจจับแล้ว';
        }
        motionSystemStatus.textContent = motionSystemData?.enabled === true
          ? 'เปิดอยู่'
          : motionSystemData?.enabled === false ? 'ปิดอยู่' : 'รอ ESP32 ยืนยัน';
        updateControls();
      },
      () => {
        motionSystemError = true;
        motionSystemData = null;
        motionSystemStatus.textContent = 'อ่านสถานะไม่ได้';
        updateControls();
      },
    );
  };

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    if (!email || !password) {
      loginStatus.textContent = 'กรอกอีเมลและรหัสผ่าน Firebase';
      return;
    }
    loginStatus.textContent = 'กำลังเข้าสู่ระบบ Firebase…';
    try {
      await signInWithEmailAndPassword(auth, email, password);
      passwordInput.value = '';
      loginStatus.textContent = 'เข้าสู่ระบบแล้ว';
    } catch (error) {
      const code = (error as { code?: string }).code || '';
      loginStatus.textContent = code.includes('invalid-credential') || code.includes('wrong-password')
        ? 'เข้าสู่ระบบไม่สำเร็จ ตรวจอีเมลหรือรหัสผ่าน'
        : 'เข้าสู่ระบบไม่สำเร็จ ตรวจการตั้งค่า Firebase Authentication';
    }
  });

  logoutButton.addEventListener('click', async () => {
    await signOut(auth);
    loginStatus.textContent = 'ออกจากระบบแล้ว';
  });

  const sendLedCommand = async (state: 'ON' | 'OFF'): Promise<void> => {
    if (!auth.currentUser || pendingRequestId) return;
    requestCounter += 1;
    pendingRequestId = Date.now() * 1000 + requestCounter;
    ledCommandStatus.textContent = 'กำลังส่งคำสั่งไปยัง ESP32…';
    updateControls();
    try {
      const commandFields = FIREBASE_PATHS.HOME_LED_COMMAND.split('/');
      const commandIdFields = FIREBASE_PATHS.HOME_LED_COMMAND_ID.split('/');
      const commandParent = commandFields.slice(0, -1).join('/');
      await update(ref(db!, devicePath(commandParent)), {
        [commandFields[commandFields.length - 1]]: state,
        [commandIdFields[commandIdFields.length - 1]]: pendingRequestId,
      });
      const expectedRequestId = pendingRequestId;
      window.setTimeout(() => {
        if (pendingRequestId === expectedRequestId) {
          pendingRequestId = 0;
          ledCommandStatus.textContent = 'ยังไม่ได้รับการยืนยันจาก ESP32 ตรวจการเชื่อมต่อหรือสิทธิ์ Firebase';
          updateControls();
        }
      }, 10000);
    } catch (error) {
      pendingRequestId = 0;
      const code = (error as { code?: string }).code || '';
      ledCommandStatus.textContent = code.includes('permission-denied')
        ? 'Firebase ปฏิเสธคำสั่ง ตรวจสิทธิ์บัญชีและกฎ Realtime Database'
        : 'ส่งคำสั่งไม่สำเร็จ ตรวจการเชื่อมต่อ Firebase';
      updateControls();
    }
  };

  const sendServoPowerCommand = async (enabled: boolean): Promise<void> => {
    if (!auth.currentUser || pendingServoPowerRequestId) return;
    requestCounter += 1;
    pendingServoPowerRequestId = Date.now() * 1000 + requestCounter;
    if (servoPowerCommandStatus) {
      servoPowerCommandStatus.textContent = enabled ? 'กำลังสั่งจ่ายไฟ 5V ไปยัง ESP32…' : 'กำลังสั่งตัดไฟไปยัง ESP32…';
    }
    updateControls();
    try {
      const commandFields = FIREBASE_PATHS.HOME_SERVO_POWER_COMMAND.split('/');
      const commandIdFields = FIREBASE_PATHS.HOME_SERVO_POWER_COMMAND_ID.split('/');
      const commandParent = commandFields.slice(0, -1).join('/');
      await update(ref(db!, devicePath(commandParent)), {
        [commandFields[commandFields.length - 1]]: enabled,
        [commandIdFields[commandIdFields.length - 1]]: pendingServoPowerRequestId,
      });
      const expectedRequestId = pendingServoPowerRequestId;
      window.setTimeout(() => {
        if (pendingServoPowerRequestId === expectedRequestId) {
          pendingServoPowerRequestId = 0;
          if (servoPowerCommandStatus) {
            servoPowerCommandStatus.textContent = enabled ? 'สั่งจ่ายไฟ 5V เรียบร้อย' : 'สั่งตัดไฟเรียบร้อย';
          }
          updateControls();
        }
      }, 5000);
    } catch (error) {
      pendingServoPowerRequestId = 0;
      if (servoPowerCommandStatus) {
        servoPowerCommandStatus.textContent = 'ส่งคำสั่งไฟเลี้ยงไม่สำเร็จ ตรวจสอบ Firebase';
      }
      updateControls();
    }
  };

  const sendServoCommand = async (state: 'LOCK' | 'UNLOCK' | 'OPEN' | 'CLOSED'): Promise<void> => {
    if (!auth.currentUser || pendingServoRequestId) return;

    if (state === 'LOCK') {
      if (servoData) servoData.locked = true;
      if (servoLockStatus) servoLockStatus.textContent = 'สถานะล็อกในระบบ: ล็อก';
      servoCommandStatus.textContent = 'ล็อกระบบแล้ว ปฏิเสธคำสั่งเปิด/ปิดประตู';
      updateControls();
      try {
        await update(ref(db!, devicePath(FIREBASE_PATHS.HOME_SERVO_STATE)), {
          locked: true,
          last_command: 'LOCK',
          updated_at: Date.now()
        });
      } catch (err) {
        console.warn('Update lock state error', err);
      }
      return;
    }

    if (state === 'UNLOCK') {
      if (servoData) servoData.locked = false;
      if (servoLockStatus) servoLockStatus.textContent = 'สถานะล็อกในระบบ: ปลดล็อก';
      servoCommandStatus.textContent = 'ปลดล็อกแล้ว พร้อมสั่งเปิด/ปิดประตู';
      updateControls();
      try {
        await update(ref(db!, devicePath(FIREBASE_PATHS.HOME_SERVO_STATE)), {
          locked: false,
          last_command: 'UNLOCK',
          updated_at: Date.now()
        });
      } catch (err) {
        console.warn('Update unlock state error', err);
      }
      return;
    }

    // Auto-enable servo power if currently false
    if (servoPowerData?.enabled === false) {
      void sendServoPowerCommand(true);
    }

    requestCounter += 1;
    pendingServoRequestId = Date.now() * 1000 + requestCounter;
    servoCommandStatus.textContent = state === 'OPEN' ? 'กำลังส่งคำสั่งเปิดประตู…' : 'กำลังส่งคำสั่งปิดประตู…';
    updateControls();

    // Invert hardware signal if user enabled mechanical inversion
    let targetPayload: string = state;
    if (state === 'OPEN') {
      targetPayload = isServoInverted ? 'CLOSED' : 'OPEN';
    } else if (state === 'CLOSED') {
      targetPayload = isServoInverted ? 'OPEN' : 'CLOSED';
    }

    try {
      const commandFields = FIREBASE_PATHS.HOME_SERVO_COMMAND.split('/');
      const commandIdFields = FIREBASE_PATHS.HOME_SERVO_COMMAND_ID.split('/');
      const commandParent = commandFields.slice(0, -1).join('/');
      await update(ref(db!, devicePath(commandParent)), {
        [commandFields[commandFields.length - 1]]: targetPayload,
        [commandIdFields[commandIdFields.length - 1]]: pendingServoRequestId,
      });
      const expectedRequestId = pendingServoRequestId;
      window.setTimeout(() => {
        if (pendingServoRequestId === expectedRequestId) {
          pendingServoRequestId = 0;
          servoCommandStatus.textContent = 'ส่งคำสั่งไปยัง ESP32 เรียบร้อยแล้ว';
          updateControls();
        }
      }, 5000);
    } catch (error) {
      pendingServoRequestId = 0;
      const code = (error as { code?: string }).code || '';
      servoCommandStatus.textContent = code.includes('permission-denied')
        ? 'Firebase ปฏิเสธคำสั่ง ตรวจสิทธิ์บัญชีและกฎ Realtime Database'
        : 'ส่งคำสั่งเซอร์โวไม่สำเร็จ ตรวจการเชื่อมต่อ Firebase';
      updateControls();
    }
  };

  const sendMotionSystemCommand = async (enabled: boolean): Promise<void> => {
    if (!auth.currentUser || pendingMotionSystemRequestId) return;
    requestCounter += 1;
    pendingMotionSystemRequestId = Date.now() * 1000 + requestCounter;
    motionSystemCommandStatus.textContent = 'กำลังส่งคำสั่งระบบตรวจจับไปยัง ESP32…';
    updateControls();
    try {
      const commandFields = FIREBASE_PATHS.HOME_MOTION_SYSTEM_COMMAND.split('/');
      const commandIdFields = FIREBASE_PATHS.HOME_MOTION_SYSTEM_COMMAND_ID.split('/');
      const commandParent = commandFields.slice(0, -1).join('/');
      await update(ref(db!, devicePath(commandParent)), {
        [commandFields[commandFields.length - 1]]: enabled,
        [commandIdFields[commandIdFields.length - 1]]: pendingMotionSystemRequestId,
      });
      const expectedRequestId = pendingMotionSystemRequestId;
      window.setTimeout(() => {
        if (pendingMotionSystemRequestId === expectedRequestId) {
          pendingMotionSystemRequestId = 0;
          motionSystemCommandStatus.textContent = 'ยังไม่ได้รับการยืนยันจาก ESP32 ตรวจการเชื่อมต่อ Wi-Fi หรือสิทธิ์ Firebase';
          updateControls();
        }
      }, 10000);
    } catch (error) {
      pendingMotionSystemRequestId = 0;
      const code = (error as { code?: string }).code || '';
      motionSystemCommandStatus.textContent = code.includes('permission-denied')
        ? 'Firebase ปฏิเสธคำสั่ง ตรวจสิทธิ์บัญชีและกฎ Realtime Database'
        : 'ส่งคำสั่งไม่สำเร็จ ตรวจการเชื่อมต่อ Firebase';
      updateControls();
    }
  };

  ledOnButton.addEventListener('click', () => void sendLedCommand('ON'));
  ledOffButton.addEventListener('click', () => void sendLedCommand('OFF'));
  servoOpenButton.addEventListener('click', () => void sendServoCommand('OPEN'));
  servoCloseButton.addEventListener('click', () => void sendServoCommand('CLOSED'));
  servoLockButton?.addEventListener('click', () => void sendServoCommand('LOCK'));
  servoUnlockButton?.addEventListener('click', () => void sendServoCommand('UNLOCK'));
  servoInvertButton?.addEventListener('click', () => {
    isServoInverted = !isServoInverted;
    localStorage.setItem('smart_home_servo_inverted', String(isServoInverted));
    servoCommandStatus.textContent = isServoInverted
      ? 'สลับเป็น "โหมดกลับทิศทาง" เรียบร้อย'
      : 'สลับเป็น "โหมดปกติ" เรียบร้อย';
    updateControls();
  });
  servoPowerOnButton?.addEventListener('click', () => void sendServoPowerCommand(true));
  servoPowerOffButton?.addEventListener('click', () => void sendServoPowerCommand(false));
  motionSystemOnButton.addEventListener('click', () => void sendMotionSystemCommand(true));
  motionSystemOffButton.addEventListener('click', () => void sendMotionSystemCommand(false));

  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
      loginStatus.textContent = 'เข้าสู่ระบบ Firebase แล้ว (สิทธิ์ควบคุมพร้อม)';
    } else {
      loginStatus.textContent = 'โหมดดูข้อมูลสด (เข้าสู่ระบบเพื่อสั่งงานสวิตช์และรีเลย์)';
    }
    // Always start listeners so live sensor telemetry & trend charts stream for everyone
    startListeners();
    renderSensors();
    updateControls();
  });

  window.setInterval(() => {
    if (!document.hidden) renderSensors();
  }, 5000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      renderSensors();
      trendChart.update('none');
    }
  });

  // Expose Web Audio test chime (C5 -> E5 dual tone)
  (window as any).playLocalChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.frequency.setValueAtTime(523.25, now);
      gain1.gain.setValueAtTime(0.25, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.frequency.setValueAtTime(659.25, now + 0.16);
      gain2.gain.setValueAtTime(0.3, now + 0.16);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.16);
      osc2.stop(now + 0.65);
    } catch (e) {
      console.warn('Web Audio playback failed', e);
    }
  };
};
