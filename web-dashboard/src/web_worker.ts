/**
 * Web Worker for Heavy Computations
 * Smart Building Command Center - Data Processing Worker
 * 
 * This worker handles CPU-intensive tasks off the main thread:
 * - Weather data processing and analysis
 * - Historical data aggregation
 * - Statistical calculations
 * - CSV export generation
 */

import { assessWeatherHazards, HazardWeatherInput } from './hazard_assessment';
import { calculateRothfuszHeatIndexC } from './weather_narration';

interface WorkerMessage {
  type: 'processWeatherData' | 'aggregateHistory' | 'calculateStats' | 'generateCSV' | 'filterData';
  data: any;
  id?: string;
}

interface WorkerResponse {
  type: string;
  data: any;
  id?: string;
  error?: string;
}

// Weather data processing
function processWeatherData(rawData: any): any {
  const { current } = rawData;
  
  // Process and calculate derived metrics
  const processed = {
    ...current,
    // Calculate heat index if not provided
    heatIndex: calculateRothfuszHeatIndexC(
      current.temperature_2m,
      current.relative_humidity_2m
    ),
    // Calculate dew point
    dewPoint: calculateDewPoint(
      current.temperature_2m,
      current.relative_humidity_2m
    ),
    // Determine weather category
    weatherCategory: categorizeWeather(current),
    // Source-backed findings; no made-up normalized danger score.
    hazardAssessment: assessWeatherHazards(current as HazardWeatherInput)
  };

  return processed;
}

// Dew point calculation
function calculateDewPoint(tempC: number, humidity: number): number {
  const a = 17.27;
  const b = 237.7;
  const alpha = ((a * tempC) / (b + tempC)) + Math.log(humidity / 100.0);
  return (b * alpha) / (a - alpha);
}

// Weather categorization
function categorizeWeather(data: any): string {
  const bands = assessWeatherHazards(data as HazardWeatherInput).findings.map(finding => finding.band);
  if (bands.some(band => band === 'danger' || band === 'very-dangerous')) return 'CRITICAL';
  if (bands.some(band => band === 'warning' || band === 'watch')) return 'WARNING';
  if (bands.every(band => band === 'unknown')) return 'UNKNOWN';
  return 'NORMAL';
}

// Historical data aggregation
function aggregateHistory(historyLogs: any[]): any {
  if (historyLogs.length === 0) {
    return { count: 0, averages: {}, max: {}, min: {} };
  }

  const metrics = ['uv', 'temp', 'rain', 'gust'];
  const sums: any = {};
  const max: any = {};
  const min: any = {};
  const counts: any = {};

  metrics.forEach(m => {
    sums[m] = 0;
    max[m] = -Infinity;
    min[m] = Infinity;
    counts[m] = 0;
  });

  historyLogs.forEach(log => {
    // Parse metrics from description
    const uvMatch = log.desc?.match(/UV:\s*([\d.]+)/);
    const tempMatch = log.desc?.match(/Heat:\s*([\d.]+)/);
    const rainMatch = log.desc?.match(/Rain:\s*([\d.]+)/);
    const gustMatch = log.desc?.match(/Gust:\s*([\d.]+)/);

    if (uvMatch) {
      const val = parseFloat(uvMatch[1]);
      sums.uv += val;
      max.uv = Math.max(max.uv, val);
      min.uv = Math.min(min.uv, val);
      counts.uv++;
    }

    if (tempMatch) {
      const val = parseFloat(tempMatch[1]);
      sums.temp += val;
      max.temp = Math.max(max.temp, val);
      min.temp = Math.min(min.temp, val);
      counts.temp++;
    }

    if (rainMatch) {
      const val = parseFloat(rainMatch[1]);
      sums.rain += val;
      max.rain = Math.max(max.rain, val);
      min.rain = Math.min(min.rain, val);
      counts.rain++;
    }

    if (gustMatch) {
      const val = parseFloat(gustMatch[1]);
      sums.gust += val;
      max.gust = Math.max(max.gust, val);
      min.gust = Math.min(min.gust, val);
      counts.gust++;
    }
  });

  const averages: any = {};
  metrics.forEach(m => {
    averages[m] = counts[m] > 0 ? sums[m] / counts[m] : 0;
    if (max[m] === -Infinity) max[m] = 0;
    if (min[m] === Infinity) min[m] = 0;
  });

  // Count severity distribution
  const severityCounts = {
    CRITICAL: 0,
    WARNING: 0,
    NORMAL: 0
  };

  historyLogs.forEach(log => {
    const sev = log.severity?.toUpperCase();
    if (severityCounts.hasOwnProperty(sev)) {
      severityCounts[sev as keyof typeof severityCounts]++;
    }
  });

  return {
    count: historyLogs.length,
    averages,
    max,
    min,
    severityCounts
  };
}

// Statistical calculations
function calculateStats(data: number[]): any {
  if (data.length === 0) {
    return { mean: 0, median: 0, stdDev: 0, min: 0, max: 0 };
  }

  const sorted = [...data].sort((a, b) => a - b);
  const sum = data.reduce((a, b) => a + b, 0);
  const mean = sum / data.length;
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  
  const median = data.length % 2 === 0
    ? (sorted[data.length / 2 - 1] + sorted[data.length / 2]) / 2
    : sorted[Math.floor(data.length / 2)];

  const variance = data.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / data.length;
  const stdDev = Math.sqrt(variance);

  return { mean, median, stdDev, min, max };
}

// CSV generation
function generateCSV(historyLogs: any[]): string {
  if (historyLogs.length === 0) {
    return '';
  }

  const headers = ['Time', 'Province', 'Severity', 'Description', 'Metrics'];
  const rows = historyLogs.map(log => [
    log.time,
    log.province,
    log.severity,
    `"${log.desc}"`,
    `"${log.metrics}"`
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

// Data filtering
function filterData(data: any[], filters: any): any[] {
  return data.filter(item => {
    if (filters.province && item.province !== filters.province) {
      return false;
    }
    if (filters.severity && item.severity !== filters.severity) {
      return false;
    }
    if (filters.startTime && new Date(item.time) < new Date(filters.startTime)) {
      return false;
    }
    if (filters.endTime && new Date(item.time) > new Date(filters.endTime)) {
      return false;
    }
    return true;
  });
}

// Message handler
self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const { type, data, id } = event.data;

  try {
    let result: any;

    switch (type) {
      case 'processWeatherData':
        result = processWeatherData(data);
        break;

      case 'aggregateHistory':
        result = aggregateHistory(data);
        break;

      case 'calculateStats':
        result = calculateStats(data);
        break;

      case 'generateCSV':
        result = generateCSV(data);
        break;

      case 'filterData':
        result = filterData(data.data, data.filters);
        break;

      default:
        throw new Error(`Unknown message type: ${type}`);
    }

    const response: WorkerResponse = {
      type,
      data: result,
      id
    };

    self.postMessage(response);

  } catch (error) {
    const response: WorkerResponse = {
      type,
      data: null,
      id,
      error: error instanceof Error ? error.message : 'Unknown error'
    };

    self.postMessage(response);
  }
};

// Export for TypeScript
export {};
