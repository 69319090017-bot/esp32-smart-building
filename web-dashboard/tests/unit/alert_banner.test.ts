import { afterEach, describe, expect, it, vi } from 'vitest';

describe('Alert banner workflow', () => {
  afterEach(() => {
    vi.resetModules();
    document.body.innerHTML = '';
  });

  it('should keep the province dropdown bound to the selected value', async () => {
    document.body.innerHTML = `
      <select id="provinceSelect">
        <option value="กรุงเทพมหานคร">Bangkok</option>
        <option value="สิงห์บุรี">Sing Buri</option>
      </select>
    `;

    const { populateProvinces } = await import('../../src/ui_manager');
    populateProvinces('สิงห์บุรี');

    const select = document.getElementById('provinceSelect') as HTMLSelectElement;
    expect(select.value).toBe('สิงห์บุรี');
  });

  it('should speak the weather summary automatically when severe conditions are detected', async () => {
    (window as any).audioMuted = false;
    document.body.innerHTML = `
      <div id="alertBanner" style="display: none;"></div>
      <div id="alertBannerTitle"></div>
      <div id="alertBannerMsg"></div>
      <button id="speakAlertBtn"></button>
      <div id="highestThreatText"></div>
      <div id="uvValue"></div>
      <div id="uvRiskBadge"></div>
      <div id="uvForecastText"></div>
      <div id="heatValue"></div>
      <div id="airTempValue"></div>
      <div id="heatDewPointValue"></div>
      <div id="heatForecastText"></div>
      <div id="heatRiskBadge"></div>
      <div id="heatGaugeArc"></div>
      <div id="uvGaugeArc"></div>
      <div id="humidityValue"></div>
      <div id="humidityRiskBadge"></div>
      <div id="humidityStatusText"></div>
      <div id="humidityDewPointValue"></div>
      <div id="humidityDetailPage"></div>
      <div id="humidityDetailValue"></div>
      <div id="humidityDetailDew"></div>
      <div id="humidityDetailComfort"></div>
      <div id="humidityDetailStatus"></div>
      <div id="humidityDetailAdvice"></div>
      <div id="humidityDetailBtn"></div>
      <div id="departureStatusPill"></div>
      <div id="departureAirValue"></div>
      <div id="departureAirText"></div>
      <div id="departureRainValue"></div>
      <div id="departureRainText"></div>
      <div id="departureWindValue"></div>
      <div id="departureWindText"></div>
      <div id="departureActionValue"></div>
      <div id="departureActionText"></div>
      <div id="wmoCodeBadge"></div>
      <div id="wmoDescText"></div>
      <div id="gustValue"></div>
      <div id="gustBar"></div>
      <div id="windSpeedValue"></div>
      <div id="gustRiskBadge"></div>
      <div id="rainValue"></div>
      <div id="rainBar"></div>
      <div id="rainRiskBadge"></div>
      <div id="riverValue"></div>
      <div id="riverRiskBadge"></div>
      <div id="strobeStatusPill"></div>
      <div id="doorStatusPill"></div>
      <div id="sirenStatusPill"></div>
      <div id="historyTableBody"></div>
      <div id="toastContainer"></div>
      <button id="langToggleBtn"></button>
      <div id="uptimeDisplay"></div>
      <div id="lastUpdateDisplay"></div>
      <div id="firmwareDisplay"></div>
      <div id="coordsDisplay"></div>
      <div id="alertBannerTitle"></div>
      <div id="alertBannerMsg"></div>
      <div id="ttsStatus"></div>
      <div id="ttsText"></div>
      <div id="ttsSpeakBtn"></div>
      <div id="ttsStopBtn"></div>
      <div id="actionDelaySelect"></div>
      <div id="actionEffectSelect"></div>
      <div id="navStatusDot"></div>
      <div id="navStatusText"></div>
      <div id="provinceSelect"></div>
      <div id="threatStatusDot"></div>
      <div id="alertBanner"></div>
      <div id="highestThreatText"></div>
    `;

    const { updateDashboardUI } = await import('../../src/ui_manager');
    const { domBatcher } = await import('../../src/performance');

    updateDashboardUI({
      temperature_2m: 39.5,
      apparent_temperature: 41.3,
      relative_humidity_2m: 88,
      precipitation: 20,
      weather_code: 95,
      wind_gusts_10m: 55,
      uv_index: 9,
      river_discharge: 300,
    }, 'CRITICAL', 'กรุงเทพมหานคร');

    domBatcher.flushNow();

    const banner = document.getElementById('alertBanner');
    const title = document.getElementById('alertBannerTitle');
    const msg = document.getElementById('alertBannerMsg');

    expect(banner?.style.display).toBe('block');
    expect(title?.textContent).toContain('อันตราย');
    expect(msg?.textContent).toContain('กรุงเทพมหานคร');

    vi.useFakeTimers();
    vi.clearAllMocks();

    updateDashboardUI({
      temperature_2m: 39.5,
      relative_humidity_2m: 88,
      precipitation: 25,
      weather_code: 95,
      wind_gusts_10m: 55,
      uv_index: 9,
    }, 'CRITICAL', 'กรุงเทพมหานคร');

    vi.runAllTimers();

    expect(window.speechSynthesis.speak).toHaveBeenCalled();
    const utterance = window.speechSynthesis.speak.mock.calls[0][0];
    expect(utterance.lang).toBe('th-TH');
    expect(utterance.rate).toBe(0.85);
    expect(utterance.pitch).toBe(1);
    vi.useRealTimers();
  });
});
