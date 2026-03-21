/**
 * Solana utilities for wager system: tx verification and PDA derivation.
 */
import { Connection, PublicKey } from "@solana/web3.js";

const RPC_URL =
  process.env["SOLANA_RPC_URL"] || "https://api.mainnet-beta.solana.com";

let _connection: Connection | null = null;
function getConnection(): Connection {
  if (!_connection) {
    _connection = new Connection(RPC_URL, "confirmed");
  }
  return _connection;
}

// Base58 alphabet (Solana signatures are 87-88 base58 chars)
const BASE58_REGEX = /^[1-9A-HJ-NP-Za-km-z]{87,88}$/;

/**
 * Check whether a string looks like a valid Solana transaction signature.
 */
export function isValidSolanaSignature(sig: string): boolean {
  return BASE58_REGEX.test(sig);
}

export interface TxVerificationResult {
  verified: boolean;
  from?: string;
  amount?: number;
  error?: string;
}

/**
 * Verify that a transaction signature corresponds to a confirmed Solana transaction.
 * Returns verification result with optional sender and amount info.
 *
 * Graceful degradation: on RPC errors returns { verified: false, error }.
 */
export async function verifySolanaTransaction(
  signature: string,
): Promise<TxVerificationResult> {
  if (!isValidSolanaSignature(signature)) {
    return { verified: false, error: "Invalid signature format" };
  }

  try {
    const conn = getConnection();
    const tx = await conn.getTransaction(signature, {
      maxSupportedTransactionVersion: 0,
    });

    if (!tx) {
      return { verified: false, error: "Transaction not found" };
    }

    if (tx.meta?.err) {
      return { verified: false, error: "Transaction failed on-chain" };
    }

    // Extract sender (first account key is typically the fee payer / signer)
    const accountKeys = tx.transaction.message.getAccountKeys();
    const from = accountKeys.get(0)?.toBase58();

    return { verified: true, from };
  } catch (err) {
    console.error("[solana] RPC verification error:", err);
    return {
      verified: false,
      error: "RPC unavailable — could not verify transaction",
    };
  }
}

/**
 * Derive a Program Derived Address (PDA) for a wager vault.
 * Seeds: ["vault", trade_card_id] — matches on-chain paste_wager program.
 * Requires SOLANA_PROGRAM_ID to be set. Returns null if not configured.
 */
export function deriveVaultPDA(
  tradeCardId: string,
): { address: string; bump: number } | null {
  const programIdStr = process.env["SOLANA_PROGRAM_ID"];
  if (!programIdStr) return null;

  try {
    const programId = new PublicKey(programIdStr);
    const [pda, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), Buffer.from(tradeCardId)],
      programId,
    );
    return { address: pda.toBase58(), bump };
  } catch (err) {
    console.error("[solana] PDA derivation error:", err);
    return null;
  }
}

/**
 * Derive PDA for a wager entry (individual wagerer's position).
 * Seeds: ["wager", vault_pubkey, wagerer_pubkey] — matches on-chain program.
 */
export function deriveWagerEntryPDA(
  vaultAddress: string,
  wagererAddress: string,
): { address: string; bump: number } | null {
  const programIdStr = process.env["SOLANA_PROGRAM_ID"];
  if (!programIdStr) return null;

  try {
    const programId = new PublicKey(programIdStr);
    const vaultPubkey = new PublicKey(vaultAddress);
    const wagererPubkey = new PublicKey(wagererAddress);
    const [pda, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("wager"), vaultPubkey.toBuffer(), wagererPubkey.toBuffer()],
      programId,
    );
    return { address: pda.toBase58(), bump };
  } catch (err) {
    console.error("[solana] WagerEntry PDA derivation error:", err);
    return null;
  }
}
