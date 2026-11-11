/**
 * Chart Configuration and Rendering Logic
 * Smart Building Command Center - Data Visualization System
 * 
 * This module handles all chart configurations, data processing,
 * and rendering for the 6-hazard monitoring system.
 */

import Chart from 'chart.js/auto';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface HazardData {
    uv_index: number;
    apparent_temperature: number;
    temperature_2m: number;
    weather_code: number;
    wind_gusts_10m: number;
    wind_speed_10m: number;
    precipitation: number;
    river_discharge: number;
    relative_humidity_2m?: number;
}

export interface HistoricalDataPoint {
    timestamp: Date;
    province: string;
    data: HazardData;
}

export interface ChartInstance {
    chart: Chart;
    canvas: HTMLCanvasElement;
    destroy: () => void;
    update: (data: any) => void;
}

// ============================================================================
// COLOR THEME CONFIGURATION
// ============================================================================

export const hexToRgba = (color: string, alpha = 0.15): string => {
    if (!color) return `rgba(0, 243, 255, ${alpha})`;
    if (color.startsWith('#')) {
        let hex = color.slice(1);
        if (hex.length === 3) {
            hex = hex.split('').map(c => c + c).join('');
        }
        const num = parseInt(hex, 16);
        if (Number.isFinite(num)) {
            const r = (num >> 16) & 255;
            const g = (num >> 8) & 255;
            const b = num & 255;
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }
    }
    if (color.startsWith('rgb(')) {
        return color.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`);
    }
    if (color.startsWith('rgba(')) {
        return color;
    }
    return color;
};

export const CHART_COLORS = {
    cyan: '#00f3ff',
    magenta: '#ff0055',
    yellow: '#ffcc00',
    green: '#00ff88',
    blue: '#3b82f6',
    purple: '#a855f7',
    orange: '#f97316',
    red: '#ef4444',
    background: {
        primary: 'rgba(0, 243, 255, 0.1)',
        secondary: 'rgba(255, 0, 85, 0.1)',
        tertiary: 'rgba(255, 204, 0, 0.1)',
        quaternary: 'rgba(0, 255, 136, 0.1)',
    },
    borders: {
        primary: 'rgba(0, 243, 255, 0.8)',
        secondary: 'rgba(255, 0, 85, 0.8)',
        tertiary: 'rgba(255, 204, 0, 0.8)',
        quaternary: 'rgba(0, 255, 136, 0.8)',
    }
};

// ============================================================================
// GLOBAL CHART DEFAULTS
// ============================================================================

Chart.defaults.color = '#e0f2fe';
Chart.defaults.borderColor = 'rgba(0, 243, 255, 0.2)';
Chart.defaults.font.family = "'Kanit', sans-serif";
Chart.defaults.responsive = true;
Chart.defaults.maintainAspectRatio = true;

// ============================================================================
// HAZARD LEVEL CALCULATIONS
// ============================================================================

export const calculateHazardLevel = (value: number, type: 'uv' | 'heat' | 'wind' | 'rain' | 'river'): number => {
    // Returns normalized value 0-100 for radar and hazard charts based on global benchmarks
    switch (type) {
        case 'uv':
            // WHO: 11+ is Extreme Danger (max scale 12)
            return Math.min(Math.max((value / 12) * 100, 0), 100);
        case 'heat':
            // NOAA/DOH: 20°C baseline up to 52°C Extreme Danger
            return Math.min(Math.max(((value - 20) / 32) * 100, 0), 100);
        case 'wind':
            // WMO Beaufort 10+: 89 km/h is Severe Storm
            return Math.min(Math.max((value / 90) * 100, 0), 100);
        case 'rain':
            // TMD: 50 mm/h is Torrential Very Heavy Rain
            return Math.min(Math.max((value / 50) * 100, 0), 100);
        case 'river':
            // GloFAS: 800 m³/s is Critical High Discharge
            return Math.min(Math.max((value / 800) * 100, 0), 100);
        default:
            return 0;
    }
};

export const getSeverityColor = (severity: 'NORMAL' | 'WARNING' | 'CRITICAL'): string => {
    switch (severity) {
        case 'CRITICAL': return CHART_COLORS.magenta;
        case 'WARNING': return CHART_COLORS.yellow;
        default: return CHART_COLORS.green;
    }
};

// ============================================================================
// CHART INSTANCES STORAGE
// ============================================================================

const chartInstances: Map<string, ChartInstance> = new Map();

// ============================================================================
// RADAR CHART - 6-HAZARD OVERVIEW
// ============================================================================

export const createRadarChart = (canvasId: string, data: HazardData): ChartInstance => {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!canvas) throw new Error(`Canvas element ${canvasId} not found`);

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D context');

    const normalizedData = [
        calculateHazardLevel(data.uv_index, 'uv'),
        calculateHazardLevel(data.apparent_temperature, 'heat'),
        calculateHazardLevel(data.wind_gusts_10m, 'wind'),
        calculateHazardLevel(data.precipitation, 'rain'),
        calculateHazardLevel(data.river_discharge, 'river'),
        // Weather state as percentage based on WMO code
        data.weather_code >= 95 ? 100 : (data.weather_code >= 65 ? 60 : 20)
    ];

    const chart = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['UV Index', 'Heat Index', 'Wind Gusts', 'Rainfall', 'River Flow', 'Storm Risk'],
            datasets: [{
                label: 'Hazard Levels',
                data: normalizedData,
                backgroundColor: 'rgba(0, 243, 255, 0.2)',
                borderColor: CHART_COLORS.cyan,
                borderWidth: 2,
                pointBackgroundColor: CHART_COLORS.cyan,
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: CHART_COLORS.cyan,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                r: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        stepSize: 20,
                        color: 'rgba(224, 242, 254, 0.6)',
                        backdropColor: 'transparent'
                    },
                    grid: {
                        color: 'rgba(0, 243, 255, 0.1)'
                    },
                    angleLines: {
                        color: 'rgba(0, 243, 255, 0.2)'
                    },
                    pointLabels: {
                        color: '#e0f2fe',
                        font: {
                            size: 11,
                            weight: 500
                        }
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(5, 8, 17, 0.9)',
                    titleColor: CHART_COLORS.cyan,
                    bodyColor: '#e0f2fe',
                    borderColor: CHART_COLORS.cyan,
                    borderWidth: 1,
                    padding: 12,
                    callbacks: {
                        label: function(context) {
                            return `${context.label}: ${Number(context.raw || 0).toFixed(0)}%`;
                        }
                    }
                }
            },
            animation: {
                duration: 1000,
                easing: 'easeOutQuart'
            }
        }
    });

    const instance: ChartInstance = {
        chart,
        canvas,
        destroy: () => chart.destroy(),
        update: (newData: HazardData) => {
            const newNormalized = [
                calculateHazardLevel(newData.uv_index, 'uv'),
                calculateHazardLevel(newData.apparent_temperature, 'heat'),
                calculateHazardLevel(newData.wind_gusts_10m, 'wind'),
                calculateHazardLevel(newData.precipitation, 'rain'),
                calculateHazardLevel(newData.river_discharge, 'river'),
                newData.weather_code >= 95 ? 100 : (newData.weather_code >= 65 ? 60 : 20)
            ];
            chart.data.datasets[0].data = newNormalized;
            chart.update('active');
        }
    };

    chartInstances.set(canvasId, instance);
    return instance;
};

// ============================================================================
// TIME-SERIES CHART - HISTORICAL DATA
// ============================================================================

export const createTimeSeriesChart = (
    canvasId: string,
    metric: keyof HazardData,
    label: string,
    color: string,
    unit: string
): ChartInstance => {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!canvas) throw new Error(`Canvas element ${canvasId} not found`);

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D context');

    const chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: label,
                data: [],
                borderColor: color,
                backgroundColor: hexToRgba(color, 0.15),
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 3,
                pointHoverRadius: 6,
                pointBackgroundColor: color,
                pointBorderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                x: {
                    grid: {
                        color: 'rgba(0, 243, 255, 0.05)'
                    },
                    ticks: {
                        color: 'rgba(224, 242, 254, 0.6)',
                        maxTicksLimit: 8
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 243, 255, 0.1)'
                    },
                    ticks: {
                        color: 'rgba(224, 242, 254, 0.6)',
                        callback: function(value) {
                            return value + unit;
                        }
                    }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        color: '#e0f2fe',
                        usePointStyle: true,
                        padding: 20
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(5, 8, 17, 0.9)',
                    titleColor: CHART_COLORS.cyan,
                    bodyColor: '#e0f2fe',
                    borderColor: CHART_COLORS.cyan,
                    borderWidth: 1,
                    padding: 12,
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${context.raw}${unit}`;
                        }
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            },
            animation: {
                duration: 750,
                easing: 'easeOutQuart'
            }
        }
    });

    const instance: ChartInstance = {
        chart,
        canvas,
        destroy: () => chart.destroy(),
        update: (historicalData: HistoricalDataPoint[]) => {
            const labels = historicalData.map(d => 
                d.timestamp.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
            );
            const values = historicalData.map(d => d.data[metric] as number);
            
            chart.data.labels = labels as any;
            chart.data.datasets[0].data = values as any;
            chart.update('active');
        }
    };

    chartInstances.set(canvasId, instance);
    return instance;
};

// ============================================================================
// GAUGE CHART - CIRCULAR METRIC DISPLAY
// ============================================================================

export const createGaugeChart = (
    canvasId: string,
    label: string,
    maxValue: number,
    color: string,
    unit: string
): ChartInstance => {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!canvas) throw new Error(`Canvas element ${canvasId} not found`);

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D context');

    const chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Current', 'Remaining'],
            datasets: [{
                data: [0, maxValue],
                backgroundColor: [
                    color,
                    'rgba(224, 242, 254, 0.1)'
                ],
                borderColor: [
                    color,
                    'rgba(0, 243, 255, 0.2)'
                ],
                borderWidth: 2
            }]
        },
        options: {
            cutout: '75%',
            responsive: true,
            maintainAspectRatio: true,
            rotation: -90,
            circumference: 270,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    enabled: false
                }
            },
            animation: {
                animateRotate: true,
                duration: 1000,
                easing: 'easeOutQuart'
            }
        },
        plugins: [{
            id: 'gaugeText',
            beforeDraw: function(chart) {
                const width = chart.width;
                const height = chart.height;
                const ctx = chart.ctx;
                
                ctx.restore();
                const fontSizeNum = height / 100;
                ctx.font = `bold ${fontSizeNum.toFixed(2)}em Kanit`;
                ctx.textBaseline = 'middle';
                ctx.fillStyle = '#e0f2fe';
                
                const val = Number(chart.data.datasets[0]?.data?.[0] || 0);
                const text = val.toFixed(1);
                const textX = Math.round((width - ctx.measureText(text).width) / 2);
                const textY = height / 2;
                
                ctx.fillText(text, textX, textY);
                
                ctx.font = `${(fontSizeNum * 0.4).toFixed(2)}em Kanit`;
                ctx.fillStyle = 'rgba(224, 242, 254, 0.6)';
                const unitText = unit;
                const unitX = Math.round((width - ctx.measureText(unitText).width) / 2);
                ctx.fillText(unitText, unitX, textY + height * 0.12);
                
                ctx.save();
            }
        }]
    });

    const instance: ChartInstance = {
        chart,
        canvas,
        destroy: () => chart.destroy(),
        update: (value: number) => {
            const clampedValue = Math.min(Math.max(value, 0), maxValue);
            chart.data.datasets[0].data = [clampedValue, maxValue - clampedValue];
            chart.update('active');
        }
    };

    chartInstances.set(canvasId, instance);
    return instance;
};

// ============================================================================
// SPARKLINE CHART - MINI TREND LINE
// ============================================================================

export const createSparklineChart = (
    canvasId: string,
    color: string
): ChartInstance => {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!canvas) throw new Error(`Canvas element ${canvasId} not found`);

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D context');

    const chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: Array(20).fill(''),
            datasets: [{
                data: Array(20).fill(0),
                borderColor: color,
                backgroundColor: 'transparent',
                borderWidth: 2,
                fill: false,
                tension: 0.4,
                pointRadius: 0,
                pointHoverRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                x: {
                    display: false
                },
                y: {
                    display: false
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    enabled: false
                }
            },
            animation: {
                duration: 300
            }
        }
    });

    const instance: ChartInstance = {
        chart,
        canvas,
        destroy: () => chart.destroy(),
        update: (values: number[]) => {
            chart.data.datasets[0].data = values.slice(-20);
            chart.update('none');
        }
    };

    chartInstances.set(canvasId, instance);
    return instance;
};

// ============================================================================
// HEAT MAP - PROVINCE HAZARD LEVELS
// ============================================================================

export const createHeatmapChart = (
    canvasId: string,
    provinces: string[],
    hazardLevels: number[]
): ChartInstance => {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!canvas) throw new Error(`Canvas element ${canvasId} not found`);

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D context');

    // Create a bubble chart to simulate heatmap
    const colors = hazardLevels.map(level => {
        if (level >= 80) return CHART_COLORS.magenta;
        if (level >= 50) return CHART_COLORS.yellow;
        if (level >= 25) return CHART_COLORS.orange;
        return CHART_COLORS.green;
    });

    const chart = new Chart(ctx, {
        type: 'bubble',
        data: {
            datasets: [{
                label: 'Province Hazard Levels',
                data: provinces.map((_, i) => ({
                    x: (i % 7) * 100 + Math.random() * 50,
                    y: Math.floor(i / 7) * 100 + Math.random() * 50,
                    r: hazardLevels[i] / 5 + 10
                })),
                backgroundColor: colors.map(c => hexToRgba(c, 0.6)),
                borderColor: colors,
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                x: {
                    display: false,
                    min: 0,
                    max: 700
                },
                y: {
                    display: false,
                    min: 0,
                    max: 500
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(5, 8, 17, 0.9)',
                    titleColor: CHART_COLORS.cyan,
                    bodyColor: '#e0f2fe',
                    borderColor: CHART_COLORS.cyan,
                    borderWidth: 1,
                    padding: 12,
                    callbacks: {
                        label: function(context) {
                            const index = context.dataIndex;
                            return `${provinces[index]}: ${hazardLevels[index].toFixed(0)}%`;
                        }
                    }
                }
            },
            animation: {
                duration: 1000,
                easing: 'easeOutQuart'
            }
        }
    });

    const instance: ChartInstance = {
        chart,
        canvas,
        destroy: () => chart.destroy(),
        update: (newHazardLevels: number[]) => {
            const newColors = newHazardLevels.map(level => {
                if (level >= 80) return CHART_COLORS.magenta;
                if (level >= 50) return CHART_COLORS.yellow;
                if (level >= 25) return CHART_COLORS.orange;
                return CHART_COLORS.green;
            });
            
            chart.data.datasets[0].data = provinces.map((_, i) => ({
                x: (i % 7) * 100 + Math.random() * 50,
                y: Math.floor(i / 7) * 100 + Math.random() * 50,
                r: newHazardLevels[i] / 5 + 10
            }));
            chart.data.datasets[0].backgroundColor = newColors.map(c => hexToRgba(c, 0.6));
            chart.data.datasets[0].borderColor = newColors;
            chart.update('active');
        }
    };

    chartInstances.set(canvasId, instance);
    return instance;
};

// ============================================================================
// CHART MANAGEMENT
// ============================================================================

export const getChartInstance = (canvasId: string): ChartInstance | undefined => {
    return chartInstances.get(canvasId);
};

export const destroyChart = (canvasId: string): void => {
    const instance = chartInstances.get(canvasId);
    if (instance) {
        instance.destroy();
        chartInstances.delete(canvasId);
    }
};

export const destroyAllCharts = (): void => {
    chartInstances.forEach(instance => instance.destroy());
    chartInstances.clear();
};

// ============================================================================
// CHART EXPORT FUNCTIONALITY
// ============================================================================

export const exportChartAsImage = (canvasId: string, filename: string): void => {
    const instance = chartInstances.get(canvasId);
    if (!instance) {
        console.error(`Chart ${canvasId} not found`);
        return;
    }

    const link = document.createElement('a');
    link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.png`;
    link.href = instance.canvas.toDataURL('image/png', 1.0);
    link.click();
};

export const exportAllCharts = (): void => {
    chartInstances.forEach((instance, canvasId) => {
        exportChartAsImage(canvasId, `chart_${canvasId}`);
    });
};

// ============================================================================
// DATA AGGREGATION FOR PERFORMANCE
// ============================================================================

export const aggregateHistoricalData = (
    data: HistoricalDataPoint[],
    interval: '1h' | '6h' | '24h' | '7d'
): HistoricalDataPoint[] => {
    if (data.length === 0) return [];

    const now = new Date();
    let cutoffTime: Date;
    let bucketSize: number; // in milliseconds

    switch (interval) {
        case '1h':
            cutoffTime = new Date(now.getTime() - 60 * 60 * 1000);
            bucketSize = 5 * 60 * 1000; // 5 minutes
            break;
        case '6h':
            cutoffTime = new Date(now.getTime() - 6 * 60 * 60 * 1000);
            bucketSize = 30 * 60 * 1000; // 30 minutes
            break;
        case '24h':
            cutoffTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            bucketSize = 60 * 60 * 1000; // 1 hour
            break;
        case '7d':
            cutoffTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            bucketSize = 6 * 60 * 60 * 1000; // 6 hours
            break;
        default:
            return data;
    }

    let filtered = data.filter(d => d.timestamp >= cutoffTime);

    // If filtering left too few points to render a meaningful curve, fallback to the latest points
    if (filtered.length < 2 && data.length >= 2) {
        filtered = data.slice(-Math.min(data.length, interval === '1h' ? 6 : (interval === '6h' ? 12 : 24)));
    } else if (filtered.length === 0 && data.length > 0) {
        filtered = data.slice(-Math.min(data.length, 24));
    }
    
    if (filtered.length <= 50) return filtered;

    // Aggregate into buckets
    const buckets = new Map<number, HistoricalDataPoint[]>();
    filtered.forEach(d => {
        const bucketKey = Math.floor(d.timestamp.getTime() / bucketSize) * bucketSize;
        if (!buckets.has(bucketKey)) {
            buckets.set(bucketKey, []);
        }
        buckets.get(bucketKey)!.push(d);
    });

    const aggregated: HistoricalDataPoint[] = [];
    buckets.forEach((points, bucketKey) => {
        const avgData: HazardData = {
            uv_index: points.reduce((sum, p) => sum + p.data.uv_index, 0) / points.length,
            apparent_temperature: points.reduce((sum, p) => sum + p.data.apparent_temperature, 0) / points.length,
            temperature_2m: points.reduce((sum, p) => sum + p.data.temperature_2m, 0) / points.length,
            weather_code: points[points.length - 1].data.weather_code, // Use latest
            wind_gusts_10m: points.reduce((sum, p) => sum + p.data.wind_gusts_10m, 0) / points.length,
            wind_speed_10m: points.reduce((sum, p) => sum + p.data.wind_speed_10m, 0) / points.length,
            precipitation: points.reduce((sum, p) => sum + p.data.precipitation, 0) / points.length,
            river_discharge: points.reduce((sum, p) => sum + p.data.river_discharge, 0) / points.length
        };
        aggregated.push({
            timestamp: new Date(bucketKey),
            province: points[0].province,
            data: avgData
        });
    });

    return aggregated.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
};
