import { describe, expect, it } from 'vitest';
import { canRecharge, canHost, canCreateAgency, canAdmin, requiresUpdate, validTransfer } from './control-rules';
describe('activation rules', () => {
  it('recharge center needs activation', () => { expect(canRecharge([])).toBe(false); expect(canRecharge(['recharge_agent'])).toBe(true); });
  it('host center needs host activation', () => { expect(canHost(['host_agent'])).toBe(false); expect(canHost(['host'])).toBe(true); });
  it('BD can create host agencies', () => { expect(canCreateAgency(['bd'])).toBe(true); expect(canCreateAgency(['host'])).toBe(false); });
  it('public dashboard viewing grants no sensitive permissions', () => { expect(canAdmin([])).toBe(false); expect(canAdmin(['admin'])).toBe(true); });
  it('forced update only blocks older versions', () => { expect(requiresUpdate(1,2,true)).toBe(true); expect(requiresUpdate(2,2,true)).toBe(false); expect(requiresUpdate(1,2,false)).toBe(false); });
  it('cannot transfer more than wallet balance', () => { expect(validTransfer(50000,10000)).toBe(false); expect(validTransfer(10000,10000)).toBe(true); expect(validTransfer(-1,10000)).toBe(false); });
});