import { describe, expect, it } from 'vitest';

import { composePlotName, hasPlotAddress } from './plotName';

describe('composePlotName', () => {
  it('joins the address parts with a middot in society·block·plotNo order', () => {
    expect(composePlotName({ society: 'Bahria Town', block: 'C', plotNo: '42' })).toBe('Bahria Town · C · 42');
  });

  it('skips blank parts', () => {
    expect(composePlotName({ society: 'DHA', block: '', plotNo: '7' })).toBe('DHA · 7');
    expect(composePlotName({ society: '', block: 'B', plotNo: '' })).toBe('B');
  });

  it('trims whitespace around each part', () => {
    expect(composePlotName({ society: '  DHA  ', block: ' B ', plotNo: ' 9 ' })).toBe('DHA · B · 9');
  });

  it('is empty when every part is blank/whitespace', () => {
    expect(composePlotName({ society: '  ', block: '', plotNo: '\t' })).toBe('');
  });
});

describe('hasPlotAddress', () => {
  it('is true when at least one part is non-blank', () => {
    expect(hasPlotAddress({ society: '', block: '', plotNo: '1' })).toBe(true);
  });
  it('is false when all parts are blank', () => {
    expect(hasPlotAddress({ society: ' ', block: '', plotNo: '' })).toBe(false);
  });
});
