import { describe, it, expect } from 'vitest';
import { hexToRgba, aggregateHistoricalData, HistoricalDataPoint } from '../../src/charts';

describe('Charts Utility - hexToRgba', () => {
    it('should convert 6-digit hex color to rgba with alpha', () => {
        expect(hexToRgba('#00f3ff', 0.15)).toBe('rgba(0, 243, 255, 0.15)');
        expect(hexToRgba('#ff0055', 0.5)).toBe('rgba(255, 0, 85, 0.5)');
    });

    it('should convert 3-digit hex color to rgba with alpha', () => {
        expect(hexToRgba('#fff', 0.2)).toBe('rgba(255, 255, 255, 0.2)');
        expect(hexToRgba('#000', 1)).toBe('rgba(0, 0, 0, 1)');
    });

    it('should convert rgb to rgba', () => {
        expect(hexToRgba('rgb(10, 20, 30)', 0.4)).toBe('rgba(10, 20, 30, 0.4)');
    });

    it('should preserve rgba format if already provided', () => {
        expect(hexToRgba('rgba(1, 2, 3, 0.8)', 0.15)).toBe('rgba(1, 2, 3, 0.8)');
    });
});

describe('Charts Utility - aggregateHistoricalData', () => {
    const createMockPoints = (count: number): HistoricalDataPoint[] => {
        const points: HistoricalDataPoint[] = [];
        const now = Date.now();
        for (let i = count - 1; i >= 0; i--) {
            points.push({
                timestamp: new Date(now - i * 3600000), // 1 hour steps
                province: 'กรุงเทพมหานคร',
                data: {
                    uv_index: 5 + (i % 3),
                    apparent_temperature: 32 + (i % 4),
                    temperature_2m: 30 + (i % 2),
                    weather_code: 1,
                    wind_gusts_10m: 20 + i,
                    wind_speed_10m: 10,
                    precipitation: i % 2 === 0 ? 0 : 2.5,
                    river_discharge: 1.5,
                    relative_humidity_2m: 65
                }
            });
        }
        return points;
    };

    it('should return empty array when input data is empty', () => {
        expect(aggregateHistoricalData([], '24h')).toEqual([]);
    });

    it('should aggregate 24h data and never return empty when data exists', () => {
        const mockData = createMockPoints(24);
        const aggregated = aggregateHistoricalData(mockData, '24h');
        expect(aggregated.length).toBeGreaterThanOrEqual(1);
        expect(aggregated[0].data.uv_index).toBeDefined();
    });

    it('should provide fallback data for 1h range instead of collapsing to 0 points', () => {
        const mockData = createMockPoints(12);
        const aggregated = aggregateHistoricalData(mockData, '1h');
        expect(aggregated.length).toBeGreaterThanOrEqual(1);
    });
});
