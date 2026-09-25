import {describe, expect, it} from 'vitest';
import {groupItemsIntoLines} from '../src/adapters/pdfAdapter.js';

const item = (str, x, y, width) => ({str, transform:[10,0,0,10,x,y], width});
const columnRows = (startY = 700) => Array.from({length:6}, (_, i) => [
  item(`Left ${i}: spacecraft autonomy supports mission operations.`,50,startY-i*12,235),
  item(`Right ${i}: machine learning analyses satellite observations.`,320,startY-i*12,235),
]).flat();

describe('PDF reading order', () => {
  it('reads down the left column before the right', () => {
    const lines = groupItemsIntoLines(columnRows().reverse());
    expect(lines.slice(0,6).every(line => line.startsWith('Left'))).toBe(true);
    expect(lines.slice(6).every(line => line.startsWith('Right'))).toBe(true);
  });
  it('keeps a full-width heading before the columns and caption after them', () => {
    const lines = groupItemsIntoLines([item('A full-width research title',50,730,505),...columnRows(),item('Figure caption spanning both columns',50,600,505)]);
    expect(lines[0]).toBe('A full-width research title');
    expect(lines.at(-1)).toBe('Figure caption spanning both columns');
    expect(lines[6]).toMatch(/^Left 5/);
  });
  it('starts a new column band below a spanning heading', () => {
    const lines = groupItemsIntoLines([...columnRows(),item('Second section across the page',50,610,505),...columnRows(580)]);
    expect(lines[12]).toBe('Second section across the page');
    expect(lines[13]).toMatch(/^Left 0/);
    expect(lines[19]).toMatch(/^Right 0/);
  });
  it('does not split single-column prose', () => {
    const input = Array.from({length:8}, (_,i) => item(`Line ${i} of a continuous paragraph spanning the page.`,50,700-i*12,505));
    expect(groupItemsIntoLines(input)).toEqual(input.map(part => part.str));
  });
  it('does not mistake short table cells for prose columns', () => {
    const input = Array.from({length:8}, (_,i) => [item(`Sensor ${i}`,50,700-i*12,80),item(`${i} degrees`,320,700-i*12,80)]).flat();
    expect(groupItemsIntoLines(input)[0]).toBe('Sensor 0 0 degrees');
  });
  it('retains row ordering when item widths are missing', () => {
    expect(groupItemsIntoLines([item('A',50,700,0),item('B',320,700,0)])).toEqual(['A B']);
  });
  it('handles an empty page', () => expect(groupItemsIntoLines([])).toEqual([]));
});
