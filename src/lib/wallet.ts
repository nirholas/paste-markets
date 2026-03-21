"use client";

import { useState, useEffect, useCallback } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ChainType = "evm" | "solana";
export type WalletProvider = "metamask" | "phantom" | "rabby" | "coinbase";

export interface WalletState {
  connected: boolean;
  address: string | null;
  chain: ChainType | null;
  provider: WalletProvider | null;
  balances: {
    usdc: number;
    native: number; // ETH or SOL
  };
}

const INITIAL_STATE: WalletState = {
  connected: false,
  address: null,
  chain: null,
  provider: null,
  balances: { usdc: 0, native: 0 },
};

// Storage key for persisting wallet connection
const WALLET_STORAGE_KEY = "paste_wallet_state";

// ---------------------------------------------------------------------------
// Provider detection
// ---------------------------------------------------------------------------

interface DetectedProvider {
  id: WalletProvider;
  name: string;
  chain: ChainType;
  available: boolean;
}

export function detectProviders(): DetectedProvider[] {
  if (typeof window === "undefined") return [];

  const providers: DetectedProvider[] = [];

  // MetaMask — check isMetaMask and not Rabby
  if (
    (window as any).ethereum?.isMetaMask &&
    !(window as any).ethereum?.isRabby
  ) {
    providers.push({
      id: "metamask",
      name: "MetaMask",
      chain: "evm",
      available: true,
    });
  }

  // Rabby
  if ((window as any).ethereum?.isRabby) {
    providers.push({
      id: "rabby",
      name: "Rabby",
      chain: "evm",
      available: true,
    });
  }

  // Coinbase Wallet
  if (
    (window as any).ethereum?.isCoinbaseWallet ||
    (window as any).coinbaseWalletExtension
  ) {
    providers.push({
      id: "coinbase",
      name: "Coinbase Wallet",
      chain: "evm",
      available: true,
    });
  }

  // Phantom (Solana)
  if ((window as any).solana?.isPhantom) {
    providers.push({
      id: "phantom",
      name: "Phantom",
      chain: "solana",
      available: true,
    });
  }

  return providers;
}

// ---------------------------------------------------------------------------
// Connect / disconnect
// ---------------------------------------------------------------------------

export async function connectWallet(
  providerId: WalletProvider
): Promise<WalletState> {
  if (typeof window === "undefined") {
    throw new Error("Wallet connection requires a browser environment");
  }

  if (providerId === "phantom") {
    return connectPhantom();
  }

  return connectEVM(providerId);
}

async function connectEVM(providerId: WalletProvider): Promise<WalletState> {
  const ethereum = (window as any).ethereum;
  if (!ethereum) throw new Error("No EVM wallet detected");

  try {
    const accounts: string[] = await ethereum.request({
      method: "eth_requestAccounts",
    });

    if (!accounts || accounts.length === 0) {
      throw new Error("No accounts returned");
    }

    const address = accounts[0];

    // Get chain ID
    const chainIdHex: string = await ethereum.request({
      method: "eth_chainId",
    });
    const chainId = parseInt(chainIdHex, 16);

    // Fetch balances
    const balances = await fetchEVMBalances(address, chainId);

    const state: WalletState = {
      connected: true,
      address,
      chain: "evm",
      provider: providerId,
      balances,
    };

    persistWalletState(state);
    return state;
  } catch (err: any) {
    if (err.code === 4001) {
      throw new Error("User rejected wallet connection");
    }
    throw err;
  }
}

async function connectPhantom(): Promise<WalletState> {
  const solana = (window as any).solana;
  if (!solana?.isPhantom) throw new Error("Phantom wallet not detected");

  try {
    const resp = await solana.connect();
    const address = resp.publicKey.toString();

    const state: WalletState = {
      connected: true,
      address,
      chain: "solana",
      provider: "phantom",
      balances: { usdc: 0, native: 0 },
    };

    persistWalletState(state);
    return state;
  } catch (err: any) {
    if (err.code === 4001) {
      throw new Error("User rejected wallet connection");
    }
    throw err;
  }
}

export async function disconnectWallet(): Promise<void> {
  if (typeof window === "undefined") return;

  // Disconnect Phantom if connected
  const solana = (window as any).solana;
  if (solana?.isPhantom && solana.isConnected) {
    try {
      await solana.disconnect();
    } catch {
      // ignore disconnect errors
    }
  }

  localStorage.removeItem(WALLET_STORAGE_KEY);
}

// ---------------------------------------------------------------------------
// Sign message
// ---------------------------------------------------------------------------

export async function signMessage(
  message: string,
  provider: WalletProvider
): Promise<string> {
  if (typeof window === "undefined") {
    throw new Error("Signing requires a browser environment");
  }

  if (provider === "phantom") {
    const solana = (window as any).solana;
    if (!solana) throw new Error("Phantom not available");
    const encoded = new TextEncoder().encode(message);
    const { signature } = await solana.signMessage(encoded, "utf8");
    return Array.from(signature as Uint8Array)
      .map((b: number) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  // EVM signing
  const ethereum = (window as any).ethereum;
  if (!ethereum) throw new Error("No EVM wallet available");

  const accounts: string[] = await ethereum.request({
    method: "eth_accounts",
  });
  if (!accounts.length) throw new Error("No connected account");

  const signature: string = await ethereum.request({
    method: "personal_sign",
    params: [message, accounts[0]],
  });

  return signature;
}

// ---------------------------------------------------------------------------
// EIP-712 typed data signing (for Hyperliquid)
// ---------------------------------------------------------------------------

export async function signTypedData(
  domain: Record<string, any>,
  types: Record<string, any>,
  value: Record<string, any>,
  address: string
): Promise<string> {
  const ethereum = (window as any).ethereum;
  if (!ethereum) throw new Error("No EVM wallet available");

  const msgParams = JSON.stringify({
    domain,
    message: value,
    primaryType: Object.keys(types).find((k) => k !== "EIP712Domain") ?? "Order",
    types: {
      EIP712Domain: [
        { name: "name", type: "string" },
        { name: "version", type: "string" },
        { name: "chainId", type: "uint256" },
        { name: "verifyingContract", type: "address" },
      ],
      ...types,
    },
  });

  const signature: string = await ethereum.request({
    method: "eth_signTypedData_v4",
    params: [address, msgParams],
  });

  return signature;
}

// ---------------------------------------------------------------------------
// Balance helpers
// ---------------------------------------------------------------------------

async function fetchEVMBalances(
  address: string,
  chainId: number
): Promise<{ usdc: number; native: number }> {
  try {
    const ethereum = (window as any).ethereum;

    // Native balance (ETH)
    const balHex: string = await ethereum.request({
      method: "eth_getBalance",
      params: [address, "latest"],
    });
    const native = parseInt(balHex, 16) / 1e18;

    // USDC balance — common addresses by chain
    const usdcAddresses: Record<number, string> = {
      1: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // Ethereum
      42161: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", // Arbitrum
      137: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", // Polygon
    };

    let usdc = 0;
    const usdcAddr = usdcAddresses[chainId];
    if (usdcAddr) {
      // ERC-20 balanceOf(address)
      const data = `0x70a08231000000000000000000000000${address.slice(2).toLowerCase()}`;
      const result: string = await ethereum.request({
        method: "eth_call",
        params: [{ to: usdcAddr, data }, "latest"],
      });
      usdc = parseInt(result, 16) / 1e6; // USDC has 6 decimals
    }

    return { usdc: Math.round(usdc * 100) / 100, native: Math.round(native * 10000) / 10000 };
  } catch {
    return { usdc: 0, native: 0 };
  }
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

function persistWalletState(state: WalletState): void {
  try {
    localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // storage full or unavailable
  }
}

function loadPersistedState(): WalletState | null {
  try {
    const raw = localStorage.getItem(WALLET_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as WalletState;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export function useWallet() {
  const [state, setState] = useState<WalletState>(INITIAL_STATE);
  const [providers, setProviders] = useState<DetectedProvider[]>([]);

  // Detect providers on mount
  useEffect(() => {
    setProviders(detectProviders());

    // Restore persisted state
    const persisted = loadPersistedState();
    if (persisted?.connected) {
      setState(persisted);
    }
  }, []);

  const connect = useCallback(async (providerId: WalletProvider) => {
    const newState = await connectWallet(providerId);
    setState(newState);
    return newState;
  }, []);

  const disconnect = useCallback(async () => {
    await disconnectWallet();
    setState(INITIAL_STATE);
  }, []);

  const sign = useCallback(
    async (message: string) => {
      if (!state.provider) throw new Error("No wallet connected");
      return signMessage(message, state.provider);
    },
    [state.provider]
  );

  const refreshBalances = useCallback(async () => {
    if (!state.connected || !state.address) return;

    if (state.chain === "evm") {
      const ethereum = (window as any).ethereum;
      if (!ethereum) return;
      const chainIdHex: string = await ethereum.request({
        method: "eth_chainId",
      });
      const chainId = parseInt(chainIdHex, 16);
      const balances = await fetchEVMBalances(state.address, chainId);
      const updated = { ...state, balances };
      setState(updated);
      persistWalletState(updated);
    }
  }, [state]);

  // Listen for account/chain changes
  useEffect(() => {
    if (typeof window === "undefined") return;

    const ethereum = (window as any).ethereum;
    if (!ethereum) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        disconnectWallet();
        setState(INITIAL_STATE);
      } else {
        setState((prev) => {
          const updated = { ...prev, address: accounts[0] };
          persistWalletState(updated);
          return updated;
        });
      }
    };

    const handleChainChanged = () => {
      // Reload balances on chain change
      if (state.connected) {
        refreshBalances();
      }
    };

    ethereum.on?.("accountsChanged", handleAccountsChanged);
    ethereum.on?.("chainChanged", handleChainChanged);

    return () => {
      ethereum.removeListener?.("accountsChanged", handleAccountsChanged);
      ethereum.removeListener?.("chainChanged", handleChainChanged);
    };
  }, [state.connected, refreshBalances]);

  return {
    ...state,
    providers,
    connect,
    disconnect,
    sign,
    refreshBalances,
  };
}

// ---------------------------------------------------------------------------
// Chain switching (Arbitrum for Hyperliquid)
// ---------------------------------------------------------------------------

export async function switchToArbitrum(): Promise<void> {
  const ethereum = (window as any).ethereum;
  if (!ethereum) throw new Error("No EVM wallet");

  try {
    await ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0xa4b1" }], // 42161
    });
  } catch (err: any) {
    // Chain not added — add it
    if (err.code === 4902) {
      await ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: "0xa4b1",
            chainName: "Arbitrum One",
            nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
            rpcUrls: ["https://arb1.arbitrum.io/rpc"],
            blockExplorerUrls: ["https://arbiscan.io"],
          },
        ],
      });
    } else {
      throw err;
    }
  }
}
