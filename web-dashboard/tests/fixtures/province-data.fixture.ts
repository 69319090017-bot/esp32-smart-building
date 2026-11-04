/**
 * Test fixtures for province data
 * Sample of Thai provinces with coordinates
 */

export interface ProvinceInfo {
  lat: number;
  lon: number;
}

export const mockProvincesMap: Record<string, ProvinceInfo> = {
  'กรุงเทพมหานคร': { lat: 13.7563, lon: 100.5018 },
  'เชียงใหม่': { lat: 18.7883, lon: 98.9853 },
  'ภูเก็ต': { lat: 7.8804, lon: 98.3923 },
  'พัทยา': { lat: 12.9236, lon: 100.8825 },
  'ขอนแก่น': { lat: 16.4322, lon: 102.8236 },
  'นครราชสีมา': { lat: 14.9799, lon: 102.0978 },
  'หาดใหญ่': { lat: 7.0086, lon: 100.4747 },
  'อยุธยา': { lat: 14.3692, lon: 100.5874 },
  'เชียงราย': { lat: 19.9105, lon: 99.8406 },
  'สุโขทัย': { lat: 17.0076, lon: 99.8265 },
};

export const mockProvinceList = Object.keys(mockProvincesMap);

export const mockBangkokInfo = mockProvincesMap['กรุงเทพมหานคร'];
export const mockChiangMaiInfo = mockProvincesMap['เชียงใหม่'];
export const mockPhuketInfo = mockProvincesMap['ภูเก็ต'];

// Invalid province fixtures
export const mockInvalidProvince = 'Invalid Province Name';
export const mockEmptyProvince = '';
export const mockNullProvince = null as any;
