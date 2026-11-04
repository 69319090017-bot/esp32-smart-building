import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Humidity page state', () => {
  it('should render the humidity detail section as a visible dedicated view by default', () => {
    const html = readFileSync(join(__dirname, '../../src/index.html'), 'utf8');

    expect(html).toContain('id="humidityDetailPage"');
    expect(html).not.toContain('id="humidityDetailPage" class="detail-page hidden');
  });
});
