import { describe, expect, it } from 'vitest';
import { computeAiDepartureAdvice } from '../../src/ai_departure_advisor';

describe('AI Departure & Safety Advisor', () => {
  it('should recommend sunglasses and sunscreen when UV index is high during sunny daylight', () => {
    const result = computeAiDepartureAdvice({
      tempC: 28.5,
      relativeHumidity: 60,
      apparentTempC: 30.0,
      rainMm: 0,
      windGustKmh: 12,
      uvIndex: 7.5,
      weatherCode: 0,
      province: 'สิงห์บุรี',
      officialAlertTitle: null,
      isDoorLocked: true
    });

    expect(result.status).toBe('PREPARE');
    expect(result.checklist.some(item => item.id === 'item-sunglasses')).toBe(true);
    expect(result.checklist.some(item => item.id === 'item-sunscreen')).toBe(true);
    expect(result.spokenText).toContain('สิงห์บุรี');
    expect(result.spokenText).toContain('แดด');
    expect(result.spokenText).toContain('ครีมกันแดด');
    expect(result.spokenText).toContain('แว่นตา');
  });

  it('should recommend an umbrella if official TMD alert has afternoon thunderstorm warning even when currently sunny', () => {
    const result = computeAiDepartureAdvice({
      tempC: 28.0,
      relativeHumidity: 65,
      apparentTempC: 29.5,
      rainMm: 0,
      windGustKmh: 15,
      uvIndex: 7.0,
      weatherCode: 1, // Mainly clear
      province: 'สิงห์บุรี',
      officialAlertTitle: 'ประกาศเตือนภัยทางการ: เฝ้าระวังพายุฝนฟ้าคะนองและลมกระโชกแรง',
      officialAlertSummary: 'เฝ้าระวังฝนฟ้าคะนองบ่ายถึงค่ำ',
      isDoorLocked: true
    });

    expect(result.checklist.some(item => item.id === 'item-umbrella')).toBe(true);
    const umbrellaItem = result.checklist.find(item => item.id === 'item-umbrella');
    expect(umbrellaItem?.reason).toContain('บ่าย');
    expect(result.summaryText).toContain('แดด');
    expect(result.spokenText).toContain('ร่มพับ');
  });

  it('should recommend water and breathable clothing when heat index is high', () => {
    const result = computeAiDepartureAdvice({
      tempC: 34.0,
      relativeHumidity: 70,
      apparentTempC: 39.0,
      rainMm: 0,
      windGustKmh: 10,
      uvIndex: 4.0,
      weatherCode: 0,
      province: 'สิงห์บุรี',
      isDoorLocked: true
    });

    expect(result.checklist.some(item => item.id === 'item-water')).toBe(true);
    expect(result.checklist.some(item => item.id === 'item-clothing')).toBe(true);
  });

  it('should report smart home security status accurately', () => {
    const lockedResult = computeAiDepartureAdvice({
      tempC: 25.0,
      isDoorLocked: true
    });
    const homeItem = lockedResult.checklist.find(item => item.id === 'item-home');
    expect(homeItem?.title).toContain('ปลอดภัย');

    const unlockedResult = computeAiDepartureAdvice({
      tempC: 25.0,
      isDoorLocked: false
    });
    const unlockedHomeItem = unlockedResult.checklist.find(item => item.id === 'item-home');
    expect(unlockedHomeItem?.title).toContain('ยังไม่ล็อค');
    expect(unlockedResult.spokenText).toContain('ล็อคประตู');
  });
});
