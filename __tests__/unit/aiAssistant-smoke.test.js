/**
 * AIAssistant smoke test (Phase 18 review fix C-2).
 * The component module must import without throwing — a bare `RNStyleSheet`
 * reference in `rawStyles` previously crashed every screen mounting it, and no
 * test imported the component so the suite was blind to it.
 */
describe('AIAssistant smoke (C-2)', () => {
  it('imports without throwing and exports the component', () => {
    let mod;
    expect(() => {
      mod = require('../../src/components/AIAssistant');
    }).not.toThrow();
    expect(typeof mod.AIAssistant).toBe('function');
  });
});
