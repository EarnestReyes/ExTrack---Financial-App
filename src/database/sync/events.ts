

const listeners = new Set<() => void>();

export const subscribeFinancialData = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };

export function changed() { listeners.forEach((listener) => listener()); }
