/**
 * Reusable Chart Components
 * Smart Building Command Center - Data Visualization System
 * 
 * This module provides reusable components for integrating charts
 * into the dashboard UI with consistent styling and behavior.
 */

import {
    ChartInstance,
    HazardData,
    HistoricalDataPoint,
    createRadarChart,
    createTimeSeriesChart,
    createGaugeChart,
    createSparklineChart,
    createHeatmapChart,
    getChartInstance,
    destroyChart,
    destroyAllCharts,
    exportChartAsImage,
    aggregateHistoricalData
} from './charts';

// ============================================================================
// COMPONENT CONFIGURATION
// ============================================================================

export interface ChartComponentConfig {
    containerId: string;
    canvasId: string;
    title?: string;
    showExport?: boolean;
    showTimeRange?: boolean;
    width?: string;
    height?: string;
}

export interface TimeRangeSelector {
    containerId: string;
    onRangeChange: (range: '1h' | '6h' | '24h' | '7d') => void;
    currentRange: '1h' | '6h' | '24h' | '7d';
}

// ============================================================================
// RADAR CHART COMPONENT
// ============================================================================

export class RadarChartComponent {
    private config: ChartComponentConfig;
    private chartInstance: ChartInstance | null = null;

    constructor(config: ChartComponentConfig) {
        this.config = config;
        this.initialize();
    }

    private initialize(): void {
        const container = document.getElementById(this.config.containerId);
        if (!container) {
            console.error(`Container ${this.config.containerId} not found`);
            return;
        }

        // Create component structure
        container.innerHTML = `
            <div class="chart-component" style="
                background: rgba(13, 20, 36, 0.75);
                border: 1px solid rgba(0, 243, 255, 0.2);
                border-radius: 14px;
                padding: 20px;
                backdrop-filter: blur(12px);
            ">
                ${this.config.title ? `
                    <div class="chart-header" style="
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 16px;
                    ">
                        <h3 style="
                            font-family: 'Orbitron', sans-serif;
                            font-size: 1rem;
                            color: #00f3ff;
                            margin: 0;
                            display: flex;
                            align-items: center;
                            gap: 8px;
                        ">🛰️ ${this.config.title}</h3>
                        ${this.config.showExport ? `
                            <button class="chart-export-btn" data-chart="${this.config.canvasId}" style="
                                background: rgba(0, 243, 255, 0.1);
                                border: 1px solid rgba(0, 243, 255, 0.3);
                                color: #00f3ff;
                                padding: 6px 12px;
                                border-radius: 6px;
                                cursor: pointer;
                                font-size: 0.8rem;
                                transition: all 0.2s;
                            ">📥 Export</button>
                        ` : ''}
                    </div>
                ` : ''}
                <div class="chart-canvas-container" style="
                    position: relative;
                    width: ${this.config.width || '100%'};
                    height: ${this.config.height || '300px'};
                ">
                    <canvas id="${this.config.canvasId}"></canvas>
                </div>
            </div>
        `;

        // Add export button listener
        const exportBtn = container.querySelector('.chart-export-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                exportChartAsImage(this.config.canvasId, 'radar_chart');
            });
        }
    }

    public render(data: HazardData): void {
        try {
            if (!this.chartInstance) {
                this.chartInstance = createRadarChart(this.config.canvasId, data);
            } else {
                this.chartInstance.update(data);
            }
        } catch (error) {
            console.error('Error rendering radar chart:', error);
        }
    }

    public destroy(): void {
        if (this.chartInstance) {
            this.chartInstance.destroy();
            this.chartInstance = null;
        }
    }
}

// ============================================================================
// TIME-SERIES CHART COMPONENT
// ============================================================================

export class TimeSeriesChartComponent {
    private config: ChartComponentConfig;
    private chartInstance: ChartInstance | null = null;
    private metric: keyof HazardData;
    private label: string;
    private color: string;
    private unit: string;
    private currentTimeRange: '1h' | '6h' | '24h' | '7d' = '24h';

    constructor(
        config: ChartComponentConfig,
        metric: keyof HazardData,
        label: string,
        color: string,
        unit: string
    ) {
        this.config = config;
        this.metric = metric;
        this.label = label;
        this.color = color;
        this.unit = unit;
        this.initialize();
    }

    private initialize(): void {
        const container = document.getElementById(this.config.containerId);
        if (!container) {
            console.error(`Container ${this.config.containerId} not found`);
            return;
        }

        container.innerHTML = `
            <div class="chart-component" style="
                background: rgba(13, 20, 36, 0.75);
                border: 1px solid rgba(0, 243, 255, 0.2);
                border-radius: 14px;
                padding: 20px;
                backdrop-filter: blur(12px);
            ">
                <div class="chart-header" style="
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 16px;
                    flex-wrap: wrap;
                    gap: 12px;
                ">
                    <h3 style="
                        font-family: 'Orbitron', sans-serif;
                        font-size: 1rem;
                        color: #00f3ff;
                        margin: 0;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                    ">📈 ${this.config.title || this.label}</h3>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        ${this.config.showTimeRange ? `
                            <div class="time-range-selector" style="display: flex; gap: 4px;">
                                <button class="range-btn ${this.currentTimeRange === '1h' ? 'active' : ''}" data-range="1h" style="
                                    background: ${this.currentTimeRange === '1h' ? 'rgba(0, 243, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)'};
                                    border: 1px solid ${this.currentTimeRange === '1h' ? '#00f3ff' : 'rgba(0, 243, 255, 0.2)'};
                                    color: ${this.currentTimeRange === '1h' ? '#00f3ff' : '#e0f2fe'};
                                    padding: 4px 10px;
                                    border-radius: 4px;
                                    cursor: pointer;
                                    font-size: 0.75rem;
                                    transition: all 0.2s;
                                ">1h</button>
                                <button class="range-btn ${this.currentTimeRange === '6h' ? 'active' : ''}" data-range="6h" style="
                                    background: ${this.currentTimeRange === '6h' ? 'rgba(0, 243, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)'};
                                    border: 1px solid ${this.currentTimeRange === '6h' ? '#00f3ff' : 'rgba(0, 243, 255, 0.2)'};
                                    color: ${this.currentTimeRange === '6h' ? '#00f3ff' : '#e0f2fe'};
                                    padding: 4px 10px;
                                    border-radius: 4px;
                                    cursor: pointer;
                                    font-size: 0.75rem;
                                    transition: all 0.2s;
                                ">6h</button>
                                <button class="range-btn ${this.currentTimeRange === '24h' ? 'active' : ''}" data-range="24h" style="
                                    background: ${this.currentTimeRange === '24h' ? 'rgba(0, 243, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)'};
                                    border: 1px solid ${this.currentTimeRange === '24h' ? '#00f3ff' : 'rgba(0, 243, 255, 0.2)'};
                                    color: ${this.currentTimeRange === '24h' ? '#00f3ff' : '#e0f2fe'};
                                    padding: 4px 10px;
                                    border-radius: 4px;
                                    cursor: pointer;
                                    font-size: 0.75rem;
                                    transition: all 0.2s;
                                ">24h</button>
                                <button class="range-btn ${this.currentTimeRange === '7d' ? 'active' : ''}" data-range="7d" style="
                                    background: ${this.currentTimeRange === '7d' ? 'rgba(0, 243, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)'};
                                    border: 1px solid ${this.currentTimeRange === '7d' ? '#00f3ff' : 'rgba(0, 243, 255, 0.2)'};
                                    color: ${this.currentTimeRange === '7d' ? '#00f3ff' : '#e0f2fe'};
                                    padding: 4px 10px;
                                    border-radius: 4px;
                                    cursor: pointer;
                                    font-size: 0.75rem;
                                    transition: all 0.2s;
                                ">7d</button>
                            </div>
                        ` : ''}
                        ${this.config.showExport ? `
                            <button class="chart-export-btn" data-chart="${this.config.canvasId}" style="
                                background: rgba(0, 243, 255, 0.1);
                                border: 1px solid rgba(0, 243, 255, 0.3);
                                color: #00f3ff;
                                padding: 6px 12px;
                                border-radius: 6px;
                                cursor: pointer;
                                font-size: 0.8rem;
                                transition: all 0.2s;
                            ">📥 Export</button>
                        ` : ''}
                    </div>
                </div>
                <div class="chart-canvas-container" style="
                    position: relative;
                    width: ${this.config.width || '100%'};
                    height: ${this.config.height || '250px'};
                ">
                    <canvas id="${this.config.canvasId}"></canvas>
                </div>
            </div>
        `;

        // Add time range button listeners
        const rangeBtns = container.querySelectorAll('.range-btn');
        rangeBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const range = (e.target as HTMLElement).dataset.range as '1h' | '6h' | '24h' | '7d';
                this.setTimeRange(range);
            });
        });

        // Add export button listener
        const exportBtn = container.querySelector('.chart-export-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                exportChartAsImage(this.config.canvasId, `${this.label.toLowerCase()}_chart`);
            });
        }
    }

    private setTimeRange(range: '1h' | '6h' | '24h' | '7d'): void {
        this.currentTimeRange = range;
        
        // Update button styles
        const container = document.getElementById(this.config.containerId);
        if (container) {
            const btns = container.querySelectorAll('.range-btn');
            btns.forEach(btn => {
                const btnRange = btn.getAttribute('data-range');
                const isActive = btnRange === range;
                (btn as HTMLElement).style.background = isActive ? 'rgba(0, 243, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)';
                (btn as HTMLElement).style.borderColor = isActive ? '#00f3ff' : 'rgba(0, 243, 255, 0.2)';
                (btn as HTMLElement).style.color = isActive ? '#00f3ff' : '#e0f2fe';
            });
        }

        // Trigger custom event for parent to handle
        const event = new CustomEvent('timeRangeChanged', { 
            detail: { range, canvasId: this.config.canvasId } 
        });
        container?.dispatchEvent(event);
    }

    public render(historicalData: HistoricalDataPoint[]): void {
        try {
            const aggregatedData = aggregateHistoricalData(historicalData, this.currentTimeRange);
            
            if (!this.chartInstance) {
                this.chartInstance = createTimeSeriesChart(
                    this.config.canvasId,
                    this.metric,
                    this.label,
                    this.color,
                    this.unit
                );
            }
            
            this.chartInstance.update(aggregatedData);
        } catch (error) {
            console.error('Error rendering time series chart:', error);
        }
    }

    public destroy(): void {
        if (this.chartInstance) {
            this.chartInstance.destroy();
            this.chartInstance = null;
        }
    }

    public getCurrentTimeRange(): '1h' | '6h' | '24h' | '7d' {
        return this.currentTimeRange;
    }
}

// ============================================================================
// GAUGE CHART COMPONENT
// ============================================================================

export class GaugeChartComponent {
    private config: ChartComponentConfig;
    private chartInstance: ChartInstance | null = null;
    private maxValue: number;
    private color: string;
    private unit: string;

    constructor(
        config: ChartComponentConfig,
        maxValue: number,
        color: string,
        unit: string
    ) {
        this.config = config;
        this.maxValue = maxValue;
        this.color = color;
        this.unit = unit;
        this.initialize();
    }

    private initialize(): void {
        const container = document.getElementById(this.config.containerId);
        if (!container) {
            console.error(`Container ${this.config.containerId} not found`);
            return;
        }

        container.innerHTML = `
            <div class="chart-component" style="
                background: rgba(13, 20, 36, 0.75);
                border: 1px solid rgba(0, 243, 255, 0.2);
                border-radius: 14px;
                padding: 20px;
                backdrop-filter: blur(12px);
                text-align: center;
            ">
                ${this.config.title ? `
                    <h3 style="
                        font-family: 'Orbitron', sans-serif;
                        font-size: 0.9rem;
                        color: #00f3ff;
                        margin: 0 0 12px 0;
                    ">${this.config.title}</h3>
                ` : ''}
                <div class="chart-canvas-container" style="
                    position: relative;
                    width: ${this.config.width || '200px'};
                    height: ${this.config.height || '200px'};
                    margin: 0 auto;
                ">
                    <canvas id="${this.config.canvasId}"></canvas>
                </div>
            </div>
        `;
    }

    public render(value: number): void {
        try {
            if (!this.chartInstance) {
                this.chartInstance = createGaugeChart(
                    this.config.canvasId,
                    this.config.title || 'Gauge',
                    this.maxValue,
                    this.color,
                    this.unit
                );
            }
            this.chartInstance.update(value);
        } catch (error) {
            console.error('Error rendering gauge chart:', error);
        }
    }

    public destroy(): void {
        if (this.chartInstance) {
            this.chartInstance.destroy();
            this.chartInstance = null;
        }
    }
}

// ============================================================================
// SPARKLINE COMPONENT
// ============================================================================

export class SparklineComponent {
    private config: ChartComponentConfig;
    private chartInstance: ChartInstance | null = null;
    private color: string;

    constructor(config: ChartComponentConfig, color: string) {
        this.config = config;
        this.color = color;
        this.initialize();
    }

    private initialize(): void {
        const container = document.getElementById(this.config.containerId);
        if (!container) {
            console.error(`Container ${this.config.containerId} not found`);
            return;
        }

        container.innerHTML = `
            <div class="sparkline-container" style="
                position: relative;
                width: ${this.config.width || '100%'};
                height: ${this.config.height || '40px'};
            ">
                <canvas id="${this.config.canvasId}"></canvas>
            </div>
        `;
    }

    public render(values: number[]): void {
        try {
            if (!this.chartInstance) {
                this.chartInstance = createSparklineChart(this.config.canvasId, this.color);
            }
            this.chartInstance.update(values);
        } catch (error) {
            console.error('Error rendering sparkline:', error);
        }
    }

    public destroy(): void {
        if (this.chartInstance) {
            this.chartInstance.destroy();
            this.chartInstance = null;
        }
    }
}

// ============================================================================
// HEATMAP COMPONENT
// ============================================================================

export class HeatmapComponent {
    private config: ChartComponentConfig;
    private chartInstance: ChartInstance | null = null;
    private provinces: string[];
    private hazardLevels: number[];

    constructor(
        config: ChartComponentConfig,
        provinces: string[],
        initialHazardLevels: number[]
    ) {
        this.config = config;
        this.provinces = provinces;
        this.hazardLevels = initialHazardLevels;
        this.initialize();
    }

    private initialize(): void {
        const container = document.getElementById(this.config.containerId);
        if (!container) {
            console.error(`Container ${this.config.containerId} not found`);
            return;
        }

        container.innerHTML = `
            <div class="chart-component" style="
                background: rgba(13, 20, 36, 0.75);
                border: 1px solid rgba(0, 243, 255, 0.2);
                border-radius: 14px;
                padding: 20px;
                backdrop-filter: blur(12px);
            ">
                <div class="chart-header" style="
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 16px;
                ">
                    <h3 style="
                        font-family: 'Orbitron', sans-serif;
                        font-size: 1rem;
                        color: #00f3ff;
                        margin: 0;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                    ">🗺️ ${this.config.title || 'Province Hazard Levels'}</h3>
                    ${this.config.showExport ? `
                        <button class="chart-export-btn" data-chart="${this.config.canvasId}" style="
                            background: rgba(0, 243, 255, 0.1);
                            border: 1px solid rgba(0, 243, 255, 0.3);
                            color: #00f3ff;
                            padding: 6px 12px;
                            border-radius: 6px;
                            cursor: pointer;
                            font-size: 0.8rem;
                            transition: all 0.2s;
                        ">📥 Export</button>
                    ` : ''}
                </div>
                <div class="chart-canvas-container" style="
                    position: relative;
                    width: ${this.config.width || '100%'};
                    height: ${this.config.height || '400px'};
                ">
                    <canvas id="${this.config.canvasId}"></canvas>
                </div>
                <div class="heatmap-legend" style="
                    display: flex;
                    justify-content: center;
                    gap: 20px;
                    margin-top: 16px;
                    font-size: 0.8rem;
                ">
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <div style="width: 12px; height: 12px; border-radius: 50%; background: #00ff88;"></div>
                        <span style="color: rgba(224, 242, 254, 0.8);">Safe (0-25%)</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <div style="width: 12px; height: 12px; border-radius: 50%; background: #f97316;"></div>
                        <span style="color: rgba(224, 242, 254, 0.8);">Moderate (25-50%)</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <div style="width: 12px; height: 12px; border-radius: 50%; background: #ffcc00;"></div>
                        <span style="color: rgba(224, 242, 254, 0.8);">High (50-80%)</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <div style="width: 12px; height: 12px; border-radius: 50%; background: #ff0055;"></div>
                        <span style="color: rgba(224, 242, 254, 0.8);">Critical (80%+)</span>
                    </div>
                </div>
            </div>
        `;

        // Add export button listener
        const exportBtn = container.querySelector('.chart-export-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                exportChartAsImage(this.config.canvasId, 'heatmap_chart');
            });
        }
    }

    public render(hazardLevels: number[]): void {
        try {
            this.hazardLevels = hazardLevels;
            
            if (!this.chartInstance) {
                this.chartInstance = createHeatmapChart(
                    this.config.canvasId,
                    this.provinces,
                    hazardLevels
                );
            } else {
                this.chartInstance.update(hazardLevels);
            }
        } catch (error) {
            console.error('Error rendering heatmap:', error);
        }
    }

    public destroy(): void {
        if (this.chartInstance) {
            this.chartInstance.destroy();
            this.chartInstance = null;
        }
    }
}

// ============================================================================
// CHART MANAGER
// ============================================================================

export class ChartManager {
    private components: Map<string, any> = new Map();

    public registerComponent(id: string, component: any): void {
        this.components.set(id, component);
    }

    public getComponent(id: string): any {
        return this.components.get(id);
    }

    public destroyComponent(id: string): void {
        const component = this.components.get(id);
        if (component && typeof component.destroy === 'function') {
            component.destroy();
        }
        this.components.delete(id);
    }

    public destroyAll(): void {
        this.components.forEach((component, id) => {
            if (typeof component.destroy === 'function') {
                component.destroy();
            }
        });
        this.components.clear();
        destroyAllCharts();
    }
}

// Global chart manager instance
export const chartManager = new ChartManager();
