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

// ---------------------------------------------------------------------------
// Enhanced USDC transfer verification
// ---------------------------------------------------------------------------

const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const USDC_DECIMALS = 6;

export interface UsdcVerificationResult {
  verified: boolean;
  sender?: string;
  recipient?: string;
  usdcAmount?: number;
  error?: string;
}

/**
 * Verify that a Solana transaction is a confirmed USDC SPL transfer
 * to the expected recipient for (at least) the expected amount.
 *
 * Parses token balance changes from transaction metadata to confirm
 * the transfer without needing to decode instruction data.
 */
export async function verifySolanaUsdcTransfer(
  signature: string,
  expectedRecipient: string,
  expectedAmount: number,
): Promise<UsdcVerificationResult> {
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

    // Extract sender from fee payer
    const accountKeys = tx.transaction.message.getAccountKeys();
    const sender = accountKeys.get(0)?.toBase58();

    // Parse pre/post token balances to find USDC transfers
    const preBalances = tx.meta?.preTokenBalances ?? [];
    const postBalances = tx.meta?.postTokenBalances ?? [];

    // Build a map of account index → pre/post USDC amounts
    const usdcChanges = new Map<
      string,
      { pre: number; post: number; owner: string }
    >();

    for (const bal of preBalances) {
      if (bal.mint === USDC_MINT && bal.owner) {
        usdcChanges.set(bal.owner, {
          pre: Number(bal.uiTokenAmount.uiAmount ?? 0),
          post: 0,
          owner: bal.owner,
        });
      }
    }

    for (const bal of postBalances) {
      if (bal.mint === USDC_MINT && bal.owner) {
        const existing = usdcChanges.get(bal.owner);
        if (existing) {
          existing.post = Number(bal.uiTokenAmount.uiAmount ?? 0);
        } else {
          usdcChanges.set(bal.owner, {
            pre: 0,
            post: Number(bal.uiTokenAmount.uiAmount ?? 0),
            owner: bal.owner,
          });
        }
      }
    }

    // Find the recipient's balance change
    const recipientChange = usdcChanges.get(expectedRecipient);
    if (!recipientChange) {
      return {
        verified: false,
        sender,
        error: "Recipient did not receive USDC in this transaction",
      };
    }

    const receivedAmount = recipientChange.post - recipientChange.pre;

    // Allow small floating-point tolerance (0.001 USDC)
    if (receivedAmount < expectedAmount - 0.001) {
      return {
        verified: false,
        sender,
        recipient: expectedRecipient,
        usdcAmount: receivedAmount,
        error: `Insufficient USDC transferred: expected ${expectedAmount}, got ${receivedAmount.toFixed(2)}`,
      };
    }

    return {
      verified: true,
      sender,
      recipient: expectedRecipient,
      usdcAmount: receivedAmount,
    };
  } catch (err) {
    console.error("[solana] USDC verification RPC error:", err);
    return {
      verified: false,
      error: "RPC unavailable — could not verify USDC transfer",
    };
  }
}

// ---------------------------------------------------------------------------
// Server-side USDC payout (settlement)
// ---------------------------------------------------------------------------

export interface PayoutResult {
  signature?: string;
  error?: string;
}

/**
 * Send a USDC payout from the treasury to a recipient.
 * Uses the TREASURY_PRIVATE_KEY env var (base58-encoded Solana keypair).
 *
 * Returns the transaction signature on success, or an error message.
 */
export async function sendUsdcPayout(
  recipientAddress: string,
  amount: number,
): Promise<PayoutResult> {
  const treasuryKeyStr = process.env["TREASURY_PRIVATE_KEY"];
  if (!treasuryKeyStr) {
    return { error: "TREASURY_PRIVATE_KEY not configured" };
  }

  try {
    const {
      Connection: Conn,
      PublicKey: PK,
      Transaction,
      Keypair,
      sendAndConfirmTransaction,
    } = await import("@solana/web3.js");

    const {
      getAssociatedTokenAddress,
      createAssociatedTokenAccountInstruction,
      createTransferInstruction,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    } = await import("@solana/spl-token");

    // Decode treasury keypair from base58
    const bs58 = await import("bs58");
    const secretKey = bs58.default.decode(treasuryKeyStr);
    const treasuryKeypair = Keypair.fromSecretKey(secretKey);

    const conn = new Conn(RPC_URL, "confirmed");
    const usdcMint = new PK(USDC_MINT);
    const recipientPubkey = new PK(recipientAddress);

    // Derive associated token accounts
    const treasuryAta = await getAssociatedTokenAddress(
      usdcMint,
      treasuryKeypair.publicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );
    const recipientAta = await getAssociatedTokenAddress(
      usdcMint,
      recipientPubkey,
      true,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );

    const transaction = new Transaction();

    // Create recipient ATA if it doesn't exist
    const recipientAccountInfo = await conn.getAccountInfo(recipientAta);
    if (!recipientAccountInfo) {
      transaction.add(
        createAssociatedTokenAccountInstruction(
          treasuryKeypair.publicKey,
          recipientAta,
          recipientPubkey,
          usdcMint,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID,
        ),
      );
    }

    // Build USDC transfer instruction
    const amountLamports = BigInt(Math.round(amount * 10 ** USDC_DECIMALS));
    transaction.add(
      createTransferInstruction(
        treasuryAta,
        recipientAta,
        treasuryKeypair.publicKey,
        amountLamports,
        [],
        TOKEN_PROGRAM_ID,
      ),
    );

    const signature = await sendAndConfirmTransaction(conn, transaction, [
      treasuryKeypair,
    ]);

    return { signature };
  } catch (err: any) {
    console.error("[solana] Payout error:", err);
    return { error: err.message || String(err) };
  }
}

// ---------------------------------------------------------------------------
// PDA derivation
// ---------------------------------------------------------------------------

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
