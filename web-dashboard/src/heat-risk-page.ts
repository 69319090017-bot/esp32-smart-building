import { store } from './store';
import { assessWeatherHazards, HazardBand, HazardFinding } from './hazard_assessment';

const bandLabels: Record<HazardBand, string> = {
  unknown: 'ข้อมูลไม่พอ', normal: 'ต่ำกว่าเกณฑ์', watch: 'เฝ้าระวัง', warning: 'เตือน',
  danger: 'อันตราย', 'very-dangerous': 'อันตรายมาก', information: 'ข้อมูลประกอบ',
};

function makeElement<K extends keyof HTMLElementTagNameMap>(tag: K, text: string, className?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.textContent = text;
  if (className) node.className = className;
  return node;
}

function observationTime(data: Record<string, unknown> | null, now: Date): string {
  const raw = data?.time ?? data?.observation_time ?? data?.timestamp ?? data?.observed_at;
  if (typeof raw !== 'string' || !raw.trim()) return 'ไม่พบเวลาเก็บข้อมูล จึงยืนยันอายุข้อมูลไม่ได้';
  const hasZone = /([zZ]|[+-][0-9]{2}:?[0-9]{2})$/.test(raw);
  const parsed = new Date(hasZone ? raw : `${raw}+07:00`);
  if (!Number.isFinite(parsed.getTime())) return 'เวลาเก็บข้อมูลไม่ถูกต้อง จึงยืนยันอายุข้อมูลไม่ได้';
  const ageMinutes = Math.max(0, Math.floor((now.getTime() - parsed.getTime()) / 60_000));
  const displayed = new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' }).format(parsed);
  return `เวลาในข้อมูล ${displayed} · อายุข้อมูลประมาณ ${ageMinutes} นาที · ยังไม่ได้กำหนดเกณฑ์หมดอายุ`;
}

function renderFinding(finding: HazardFinding): HTMLElement {
  const card = makeElement('article', '', `card card-spotlight col-span-3 risk-finding risk-${finding.band}`);
  card.setAttribute('aria-label', `${finding.title}: ${bandLabels[finding.band]}`);
  card.append(
    makeElement('h3', finding.title, 'h3'),
    makeElement('p', bandLabels[finding.band], 'risk-band-label'),
    makeElement('p', finding.value, 'risk-value'),
    makeElement('p', finding.meaning, 'body'),
    makeElement('p', `วิธีป้องกัน: ${finding.prevention}`, 'body risk-prevention'),
  );
  if (finding.source) {
    const link = document.createElement('a');
    link.href = finding.source.url;
    link.textContent = `แหล่งอ้างอิง: ${finding.source.label}`;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.className = 'risk-source';
    card.append(link);
  }
  return card;
}

export function initializeHeatRiskPage(): void {
  const root = document.getElementById('heatRiskContent');
  if (!root) return;
  let observationStatus: HTMLElement | null = null;

  const render = () => {
    const state = store.getState().weather;
    const data = state.data as (typeof state.data & Record<string, unknown>) | null;
    root.replaceChildren();
    observationStatus = makeElement('p', observationTime(data, new Date()), 'risk-observation');
    root.append(
      observationStatus,
      makeElement('p', 'แหล่งข้อมูล: Open-Meteo · เป็นข้อมูลแบบจำลอง ไม่ใช่ประกาศเตือนภัยทางการ', 'risk-source-note'),
    );

    const assessment = assessWeatherHazards(data);
    const grid = makeElement('div', '', 'bento-grid risk-grid');
    assessment.findings.forEach(finding => grid.append(renderFinding(finding)));
    root.append(grid);

    const combinations = makeElement('section', '', 'card risk-combinations');
    combinations.append(makeElement('h3', 'เมื่อหลายความเสี่ยงเกิดพร้อมกัน', 'h3'));
    assessment.combinations.forEach(item => combinations.append(makeElement('p', `• ${item}`, 'body')));
    root.append(combinations);

    const limitations = makeElement('details', '', 'card risk-notes');
    limitations.append(makeElement('summary', 'ข้อจำกัดและสิ่งที่ยังไม่มีข้อมูล'));
    assessment.notes.forEach(note => limitations.append(makeElement('p', note, 'body')));
    root.append(limitations);
  };

  store.subscribe(render);
  render();
  window.setInterval(() => {
    const state = store.getState().weather;
    observationStatus?.replaceChildren(document.createTextNode(observationTime(state.data as (typeof state.data & Record<string, unknown>) | null, new Date())));
  }, 60_000);
}
