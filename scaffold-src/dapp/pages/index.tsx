
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useState } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { createNexusClient } from '@availproject/nexus'; // placeholder import; see docs
import { z } from 'zod';

export default function Home() {
  const { address } = useAccount();
  const { data: wallet } = useWalletClient();
  const [log, setLog] = useState<string>('');

  const handleRequestDeposit = async () => {
    if (!wallet) return;
    // Pseudo-code: call our vault.requestDeposit on Chain A,
    // then use Nexus to Bridge & Execute so that claim is finalized on Chain B.
    try {
      // TODO: wire viem contract call with ABI + address from @shared
      setLog(l => l + "\nRequested deposit; awaiting cross-chain settlement...");
      // TODO: create nexus client and submit an intent for bridge+execute
    } catch (e:any) {
      setLog(l => l + "\nError: " + e.message);
    }
  };

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Unchained Vaults</h1>
        <ConnectButton />
      </div>
      <p className="mt-2">Async cross-chain deposits & withdrawals with ERC-7540, PYUSD via LayerZero, Avail Nexus orchestration.</p>
      <div className="mt-6 space-x-3">
        <button className="btn" onClick={handleRequestDeposit}>Request Deposit (Demo)</button>
      </div>
      <pre className="mt-6 p-3 bg-black/5 rounded">{log}</pre>
    </main>
  )
}
