'use client';

/** Wallet connection helper. behavior identical to the original panel:
 * request accounts from the injected provider, surface a message when absent. */
export async function connectWallet(): Promise<{
  account: string | null;
  error: string | null;
}> {
  const eth =
    typeof window !== 'undefined'
      ? (window as any).ethereum
      : undefined;
  if (!eth) return { account: null, error: 'No injected wallet found.' };
  const accounts: string[] = await eth.request({
    method: 'eth_requestAccounts',
  });
  return { account: accounts[0] ?? null, error: null };
}

export function shortAddress(a: string): string {
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}
