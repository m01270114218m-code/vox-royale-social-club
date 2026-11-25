export const canRecharge = (roles: readonly string[]) => roles.includes('recharge_agent');
export const canHost = (roles: readonly string[]) => roles.includes('host');
export const canCreateAgency = (roles: readonly string[]) => roles.includes('bd') || roles.includes('admin');
export const canAdmin = (roles: readonly string[]) => roles.includes('admin');
export const requiresUpdate = (current: number, minimum: number, forced: boolean) => forced && current < minimum;
export const validTransfer = (amount: number, balance: number) => Number.isSafeInteger(amount) && amount > 0 && amount <= balance;