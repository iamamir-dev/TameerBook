import { describe, expect, it } from 'vitest';

import { renderReportHtml, type ReportAssets, type ReportDoc } from './reportHtml';

const ASSETS: ReportAssets = {
  fontRegular: 'FR',
  fontBold: 'FB',
  naskh: 'NK',
  wordmark: 'WM',
  companyLogo: null,
};

const DOC: ReportDoc = {
  company: { name: 'Al-Madina Builders', ownerName: 'Amir', phone: '0300-1234567' },
  title: 'Settlement Report',
  subject: '432 G',
  sublines: ['DHA Phase 5 · Plot 432-G', null, '12 Jan — 16 Jul 2026 · 186 days'],
  statusChip: 'Project settled',
  dateText: '17 Jul 2026',
  madeWith: 'Made with TameerBook',
  blocks: [
    {
      kind: 'stats',
      items: [
        { label: 'Revenue', value: 'Rs 80,000', tone: 'accent' },
        { label: 'Expenses', value: 'Rs 65,000', tone: 'danger' },
        { label: 'Net Profit', value: 'Rs 15,000', filled: 'accent' },
      ],
    },
    {
      kind: 'table',
      title: 'Distribution',
      columns: [{ label: '' }, { label: 'Profit', align: 'num' }, { label: 'Gets back', align: 'num', highlight: true }],
      rows: [
        [
          { text: 'Ahmed', tone: 'strong', tag: '50%' },
          { text: 'Rs 6,000', tone: 'green' },
          { text: 'Rs 37,900', tone: 'strong' },
        ],
      ],
      totals: [{ text: 'Total' }, { text: 'Rs 6,000' }, { text: 'Rs 37,900' }],
    },
    { kind: 'notes', lines: [{ label: 'Account', value: 'HBL Bank' }] },
    { kind: 'signatures', title: 'Signatures', names: ['Ahmed', 'Owner'] },
  ],
};

describe('renderReportHtml', () => {
  const html = renderReportHtml(DOC, ASSETS);

  it('renders the branded chrome (company, wordmark, chip, footer)', () => {
    expect(html).toContain('Al-Madina Builders');
    expect(html).toContain('Amir · 0300-1234567');
    // Wordmark appears 3x: header + the tfoot footer (space reserver) + the
    // fixed footer (painted at the page bottom on paper).
    expect(html.match(/base64,WM/g)).toHaveLength(3);
    expect(html).toContain('✓ Project settled');
    expect(html).toContain('Made with TameerBook');
  });

  it('falls back to the company-initial tile without a logo', () => {
    expect(html).toContain('cfallback">A<');
    const withLogo = renderReportHtml(DOC, { ...ASSETS, companyLogo: 'CL' });
    expect(withLogo).toContain('base64,CL');
    expect(withLogo).not.toContain('clogo cfallback');
  });

  it('drops empty sublines and keeps the rest in order', () => {
    const plot = html.indexOf('DHA Phase 5');
    const period = html.indexOf('12 Jan — 16 Jul 2026');
    expect(plot).toBeGreaterThan(-1);
    expect(period).toBeGreaterThan(plot);
  });

  it('renders stats with edges and a filled lead card', () => {
    expect(html).toContain('class="stat edge-accent"');
    expect(html).toContain('class="stat edge-danger"');
    expect(html).toContain('class="stat net"');
    expect(html).toContain('class="v v-danger">Rs 65,000');
  });

  it('renders tables with highlight column, tags and double-rule totals', () => {
    expect(html).toContain('<th class="num pay">Gets back</th>');
    expect(html).toContain('class="num pay strong">Rs 37,900');
    expect(html).toContain('<span class="tag">50%</span>');
    expect(html).toContain('class="totalrow"');
    expect(html).toContain('3px double');
  });

  it('renders notes and one signature line per party', () => {
    expect(html).toContain('Account: <b>HBL Bank</b>');
    expect(html.match(/class="sigline"/g)).toHaveLength(2);
  });

  it('omits optional chrome when absent', () => {
    const bare = renderReportHtml({ ...DOC, statusChip: null, sublines: [], blocks: [{ kind: 'notes', lines: [] }] }, ASSETS);
    expect(bare).not.toContain('class="chip"');
    expect(bare).not.toContain('class="subline"');
    expect(bare).not.toContain('class="notes"');
  });
});
