/**
 * Test fixtures for weather data
 * These fixtures provide realistic test data for various weather scenarios
 */

import { WeatherData, SeverityLevel } from '../../src/store_types';

export const mockWeatherData: WeatherData = {
  uv_index: 5.5,
  apparent_temperature: 32.0,
  temperature_2m: 30.0,
  weather_code: 1,
  wind_gusts_10m: 25.0,
  wind_speed_10m: 15.0,
  precipitation: 0.0,
  river_discharge: 100.0,
  relative_humidity_2m: 65,
};

export const mockCriticalUVWeather: WeatherData = {
  uv_index: 12.5,
  apparent_temperature: 39.0,
  temperature_2m: 35.0,
  weather_code: 0,
  wind_gusts_10m: 18.0,
  wind_speed_10m: 10.0,
  precipitation: 0.0,
  river_discharge: 50.0,
  relative_humidity_2m: 60,
};

export const mockCriticalHeatWeather: WeatherData = {
  uv_index: 9.0,
  apparent_temperature: 43.5,
  temperature_2m: 39.5,
  weather_code: 1,
  wind_gusts_10m: 15.0,
  wind_speed_10m: 8.0,
  precipitation: 0.0,
  river_discharge: 45.0,
  relative_humidity_2m: 55,
};

export const mockCriticalStormWeather: WeatherData = {
  uv_index: 1.0,
  apparent_temperature: 28.0,
  temperature_2m: 26.0,
  weather_code: 96,
  wind_gusts_10m: 85.0,
  wind_speed_10m: 45.0,
  precipitation: 32.0,
  river_discharge: 220.0,
  relative_humidity_2m: 85,
};

export const mockCriticalWindWeather: WeatherData = {
  uv_index: 3.0,
  apparent_temperature: 30.0,
  temperature_2m: 28.0,
  weather_code: 82,
  wind_gusts_10m: 95.0,
  wind_speed_10m: 60.0,
  precipitation: 5.0,
  river_discharge: 110.0,
  relative_humidity_2m: 70,
};

export const mockCriticalFloodWeather: WeatherData = {
  uv_index: 0.5,
  apparent_temperature: 26.0,
  temperature_2m: 25.0,
  weather_code: 65,
  wind_gusts_10m: 55.0,
  wind_speed_10m: 30.0,
  precipitation: 48.0,
  river_discharge: 680.0,
  relative_humidity_2m: 90,
};

export const mockWarningWeather: WeatherData = {
  uv_index: 8.5,
  apparent_temperature: 37.5,
  temperature_2m: 35.0,
  weather_code: 95,
  wind_gusts_10m: 52.0,
  wind_speed_10m: 35.0,
  precipitation: 12.0,
  river_discharge: 510.0,
  relative_humidity_2m: 75,
};

export const mockNormalWeather: WeatherData = {
  uv_index: 4.5,
  apparent_temperature: 31.0,
  temperature_2m: 29.0,
  weather_code: 1,
  wind_gusts_10m: 18.0,
  wind_speed_10m: 12.0,
  precipitation: 0.0,
  river_discharge: 85.0,
  relative_humidity_2m: 65,
};

// Edge case fixtures
export const mockExtremeUVWeather: WeatherData = {
  uv_index: 20.0,
  apparent_temperature: 45.0,
  temperature_2m: 40.0,
  weather_code: 0,
  wind_gusts_10m: 10.0,
  wind_speed_10m: 5.0,
  precipitation: 0.0,
  river_discharge: 30.0,
  relative_humidity_2m: 40,
};

export const mockExtremeHeatWeather: WeatherData = {
  uv_index: 15.0,
  apparent_temperature: 55.0,
  temperature_2m: 50.0,
  weather_code: 0,
  wind_gusts_10m: 20.0,
  wind_speed_10m: 10.0,
  precipitation: 0.0,
  river_discharge: 20.0,
  relative_humidity_2m: 30,
};

export const mockExtremeWindWeather: WeatherData = {
  uv_index: 2.0,
  apparent_temperature: 25.0,
  temperature_2m: 23.0,
  weather_code: 99,
  wind_gusts_10m: 150.0,
  wind_speed_10m: 100.0,
  precipitation: 50.0,
  river_discharge: 800.0,
  relative_humidity_2m: 80,
};

export const mockNegativeValuesWeather: WeatherData = {
  uv_index: -1.0,
  apparent_temperature: -10.0,
  temperature_2m: -15.0,
  weather_code: 0,
  wind_gusts_10m: -5.0,
  wind_speed_10m: -3.0,
  precipitation: -2.0,
  river_discharge: -10.0,
  relative_humidity_2m: -5,
};

export const mockZeroValuesWeather: WeatherData = {
  uv_index: 0,
  apparent_temperature: 0,
  temperature_2m: 0,
  weather_code: 0,
  wind_gusts_10m: 0,
  wind_speed_10m: 0,
  precipitation: 0,
  river_discharge: 0,
  relative_humidity_2m: 0,
};

// Open-Meteo API response fixtures
export const mockOpenMeteoResponse = {
  current: {
    uv_index: 5.5,
    temperature_2m: 30.0,
    apparent_temperature: 32.0,
    relative_humidity_2m: 65,
    precipitation: 0.0,
    weather_code: 1,
    wind_speed_10m: 15.0,
    wind_gusts_10m: 25.0,
  },
};

export const mockOpenMeteoCriticalResponse = {
  current: {
    uv_index: 12.5,
    temperature_2m: 35.0,
    apparent_temperature: 39.0,
    relative_humidity_2m: 60,
    precipitation: 0.0,
    weather_code: 0,
    wind_speed_10m: 10.0,
    wind_gusts_10m: 18.0,
  },
};

export const mockFloodApiResponse = {
  daily: {
    river_discharge: [220.0],
  },
};

export const mockFloodApiResponseCritical = {
  daily: {
    river_discharge: [680.0],
  },
};
