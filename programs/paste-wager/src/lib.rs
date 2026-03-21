use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("11111111111111111111111111111111");

/// Maximum caller tip: 50% (5000 bps)
const MAX_CALLER_TIP_BPS: u16 = 5000;

/// Maximum single wager: 500 USDC (6 decimals)
const MAX_WAGER_AMOUNT: u64 = 500_000_000;

// ─── Program ────────────────────────────────────────────────────────────────

#[program]
pub mod paste_wager {
    use super::*;

    /// Create a new wager vault for a trade card.
    /// The vault PDA is derived from ["vault", trade_card_id].
    pub fn initialize_vault(
        ctx: Context<InitializeVault>,
        trade_card_id: String,
        caller_tip_bps: u16,
        wager_deadline: i64,
        settlement_deadline: i64,
    ) -> Result<()> {
        require!(trade_card_id.len() <= 64, WagerError::TradeCardIdTooLong);
        require!(
            caller_tip_bps <= MAX_CALLER_TIP_BPS,
            WagerError::TipTooHigh
        );

        let clock = Clock::get()?;
        require!(
            wager_deadline > clock.unix_timestamp,
            WagerError::DeadlineInPast
        );
        require!(
            settlement_deadline > wager_deadline,
            WagerError::SettlementBeforeDeadline
        );

        let vault = &mut ctx.accounts.vault;
        vault.authority = ctx.accounts.authority.key();
        vault.caller = ctx.accounts.caller.key();
        vault.trade_card_id = trade_card_id;
        vault.caller_tip_bps = caller_tip_bps;
        vault.wager_deadline = wager_deadline;
        vault.settlement_deadline = settlement_deadline;
        vault.total_wagered = 0;
        vault.wager_count = 0;
        vault.status = VaultStatus::Active;
        vault.settled_pnl_bps = 0;
        vault.bump = ctx.bumps.vault;

        Ok(())
    }

    /// Place a wager by transferring USDC into the vault token account.
    /// Creates a WagerEntry PDA for the wagerer.
    pub fn place_wager(ctx: Context<PlaceWager>, amount: u64) -> Result<()> {
        require!(amount > 0, WagerError::ZeroAmount);
        require!(amount <= MAX_WAGER_AMOUNT, WagerError::AmountTooLarge);

        let vault = &ctx.accounts.vault;
        require!(vault.status == VaultStatus::Active, WagerError::VaultNotActive);

        let clock = Clock::get()?;
        require!(
            clock.unix_timestamp <= vault.wager_deadline,
            WagerError::DeadlinePassed
        );

        // Prevent caller from wagering on their own trade
        require!(
            ctx.accounts.wagerer.key() != vault.caller,
            WagerError::CallerCannotWager
        );

        // Transfer USDC from wagerer to vault token account
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.wagerer_token_account.to_account_info(),
                    to: ctx.accounts.vault_token_account.to_account_info(),
                    authority: ctx.accounts.wagerer.to_account_info(),
                },
            ),
            amount,
        )?;

        // Initialize wager entry
        let entry = &mut ctx.accounts.wager_entry;
        entry.vault = ctx.accounts.vault.key();
        entry.wagerer = ctx.accounts.wagerer.key();
        entry.amount = amount;
        entry.claimed = false;
        entry.bump = ctx.bumps.wager_entry;

        // Update vault totals
        let vault = &mut ctx.accounts.vault;
        vault.total_wagered = vault
            .total_wagered
            .checked_add(amount)
            .ok_or(WagerError::Overflow)?;
        vault.wager_count = vault
            .wager_count
            .checked_add(1)
            .ok_or(WagerError::Overflow)?;

        Ok(())
    }

    /// Authority settles the vault with the final PnL (in basis points).
    /// Positive = profit, negative = loss. E.g. +1200 = +12%, -500 = -5%.
    pub fn settle(ctx: Context<Settle>, pnl_bps: i16) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        require!(vault.status == VaultStatus::Active, WagerError::VaultNotActive);

        let clock = Clock::get()?;
        require!(
            clock.unix_timestamp >= vault.settlement_deadline,
            WagerError::SettlementTooEarly
        );

        vault.status = VaultStatus::Settled;
        vault.settled_pnl_bps = pnl_bps;

        Ok(())
    }

    /// Wagerer claims their payout after settlement.
    /// Payout = principal +/- (principal * pnl_bps / 10000) - caller tip on profit.
    /// If the vault doesn't have enough tokens (loss exceeded deposits), wagerer gets
    /// their proportional share of remaining tokens.
    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        let vault = &ctx.accounts.vault;
        require!(vault.status == VaultStatus::Settled, WagerError::NotSettled);

        let entry = &ctx.accounts.wager_entry;
        require!(!entry.claimed, WagerError::AlreadyClaimed);

        let pnl_bps = vault.settled_pnl_bps as i64;
        let principal = entry.amount as i64;

        // Calculate gross payout: principal + (principal * pnl_bps / 10000)
        let gross_pnl = principal
            .checked_mul(pnl_bps)
            .ok_or(WagerError::Overflow)?
            / 10_000i64;

        let gross_payout = principal
            .checked_add(gross_pnl)
            .ok_or(WagerError::Overflow)?;

        // Deduct caller tip from profit only
        let payout = if gross_pnl > 0 {
            let tip = gross_pnl
                .checked_mul(vault.caller_tip_bps as i64)
                .ok_or(WagerError::Overflow)?
                / 10_000i64;
            gross_payout.checked_sub(tip).ok_or(WagerError::Overflow)?
        } else {
            gross_payout
        };

        // Clamp to [0, vault_balance] — wagerer can't get negative or drain past what's there
        let vault_balance = ctx.accounts.vault_token_account.amount;
        let payout_u64 = if payout <= 0 {
            0u64
        } else {
            (payout as u64).min(vault_balance)
        };

        // Transfer payout from vault token account to wagerer
        if payout_u64 > 0 {
            let trade_card_id = vault.trade_card_id.as_bytes();
            let bump = &[vault.bump];
            let seeds: &[&[u8]] = &[b"vault", trade_card_id, bump];
            let signer_seeds = &[seeds];

            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.vault_token_account.to_account_info(),
                        to: ctx.accounts.wagerer_token_account.to_account_info(),
                        authority: ctx.accounts.vault.to_account_info(),
                    },
                    signer_seeds,
                ),
                payout_u64,
            )?;
        }

        // Mark claimed
        let entry = &mut ctx.accounts.wager_entry;
        entry.claimed = true;

        Ok(())
    }

    /// Authority sends the caller tip after all wagerers have claimed.
    /// Transfers remaining vault tokens to the caller's token account.
    pub fn collect_caller_tip(ctx: Context<CollectCallerTip>) -> Result<()> {
        let vault = &ctx.accounts.vault;
        require!(vault.status == VaultStatus::Settled, WagerError::NotSettled);

        let balance = ctx.accounts.vault_token_account.amount;
        if balance == 0 {
            return Ok(());
        }

        let trade_card_id = vault.trade_card_id.as_bytes();
        let bump = &[vault.bump];
        let seeds: &[&[u8]] = &[b"vault", trade_card_id, bump];
        let signer_seeds = &[seeds];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault_token_account.to_account_info(),
                    to: ctx.accounts.caller_token_account.to_account_info(),
                    authority: ctx.accounts.vault.to_account_info(),
                },
                signer_seeds,
            ),
            balance,
        )?;

        Ok(())
    }

    /// Authority cancels the vault. No settlement occurs.
    pub fn cancel(ctx: Context<Cancel>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        require!(vault.status == VaultStatus::Active, WagerError::VaultNotActive);

        vault.status = VaultStatus::Cancelled;
        Ok(())
    }

    /// Wagerer reclaims their full deposit after vault cancellation.
    pub fn refund(ctx: Context<Refund>) -> Result<()> {
        let vault = &ctx.accounts.vault;
        require!(
            vault.status == VaultStatus::Cancelled,
            WagerError::NotCancelled
        );

        let entry = &ctx.accounts.wager_entry;
        require!(!entry.claimed, WagerError::AlreadyClaimed);

        let refund_amount = entry.amount.min(ctx.accounts.vault_token_account.amount);

        if refund_amount > 0 {
            let trade_card_id = vault.trade_card_id.as_bytes();
            let bump = &[vault.bump];
            let seeds: &[&[u8]] = &[b"vault", trade_card_id, bump];
            let signer_seeds = &[seeds];

            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.vault_token_account.to_account_info(),
                        to: ctx.accounts.wagerer_token_account.to_account_info(),
                        authority: ctx.accounts.vault.to_account_info(),
                    },
                    signer_seeds,
                ),
                refund_amount,
            )?;
        }

        let entry = &mut ctx.accounts.wager_entry;
        entry.claimed = true;

        Ok(())
    }
}

// ─── Accounts ───────────────────────────────────────────────────────────────

#[derive(Accounts)]
#[instruction(trade_card_id: String)]
pub struct InitializeVault<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    /// CHECK: Caller wallet that receives tips. Not a signer — set by authority.
    pub caller: UncheckedAccount<'info>,

    #[account(
        init,
        payer = authority,
        space = WagerVault::space(&trade_card_id),
        seeds = [b"vault", trade_card_id.as_bytes()],
        bump,
    )]
    pub vault: Account<'info, WagerVault>,

    /// USDC mint
    pub usdc_mint: Account<'info, Mint>,

    /// Vault's USDC token account (ATA), owned by the vault PDA
    #[account(
        init,
        payer = authority,
        token::mint = usdc_mint,
        token::authority = vault,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct PlaceWager<'info> {
    #[account(mut)]
    pub wagerer: Signer<'info>,

    #[account(mut)]
    pub vault: Account<'info, WagerVault>,

    #[account(
        init,
        payer = wagerer,
        space = WagerEntry::SPACE,
        seeds = [b"wager", vault.key().as_ref(), wagerer.key().as_ref()],
        bump,
    )]
    pub wager_entry: Account<'info, WagerEntry>,

    /// Wagerer's USDC token account
    #[account(
        mut,
        constraint = wagerer_token_account.owner == wagerer.key(),
    )]
    pub wagerer_token_account: Account<'info, TokenAccount>,

    /// Vault's USDC token account
    #[account(
        mut,
        constraint = vault_token_account.owner == vault.key(),
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Settle<'info> {
    #[account(
        constraint = authority.key() == vault.authority @ WagerError::Unauthorized,
    )]
    pub authority: Signer<'info>,

    #[account(mut)]
    pub vault: Account<'info, WagerVault>,
}

#[derive(Accounts)]
pub struct Claim<'info> {
    pub wagerer: Signer<'info>,

    #[account(
        constraint = vault.status == VaultStatus::Settled @ WagerError::NotSettled,
    )]
    pub vault: Account<'info, WagerVault>,

    #[account(
        mut,
        seeds = [b"wager", vault.key().as_ref(), wagerer.key().as_ref()],
        bump = wager_entry.bump,
        constraint = wager_entry.wagerer == wagerer.key() @ WagerError::Unauthorized,
    )]
    pub wager_entry: Account<'info, WagerEntry>,

    /// Wagerer's USDC token account
    #[account(
        mut,
        constraint = wagerer_token_account.owner == wagerer.key(),
    )]
    pub wagerer_token_account: Account<'info, TokenAccount>,

    /// Vault's USDC token account
    #[account(
        mut,
        constraint = vault_token_account.owner == vault.key(),
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct CollectCallerTip<'info> {
    #[account(
        constraint = authority.key() == vault.authority @ WagerError::Unauthorized,
    )]
    pub authority: Signer<'info>,

    #[account(
        constraint = vault.status == VaultStatus::Settled @ WagerError::NotSettled,
    )]
    pub vault: Account<'info, WagerVault>,

    /// Caller's USDC token account
    #[account(
        mut,
        constraint = caller_token_account.owner == vault.caller @ WagerError::Unauthorized,
    )]
    pub caller_token_account: Account<'info, TokenAccount>,

    /// Vault's USDC token account
    #[account(
        mut,
        constraint = vault_token_account.owner == vault.key(),
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Cancel<'info> {
    #[account(
        constraint = authority.key() == vault.authority @ WagerError::Unauthorized,
    )]
    pub authority: Signer<'info>,

    #[account(mut)]
    pub vault: Account<'info, WagerVault>,
}

#[derive(Accounts)]
pub struct Refund<'info> {
    pub wagerer: Signer<'info>,

    #[account(
        constraint = vault.status == VaultStatus::Cancelled @ WagerError::NotCancelled,
    )]
    pub vault: Account<'info, WagerVault>,

    #[account(
        mut,
        seeds = [b"wager", vault.key().as_ref(), wagerer.key().as_ref()],
        bump = wager_entry.bump,
        constraint = wager_entry.wagerer == wagerer.key() @ WagerError::Unauthorized,
    )]
    pub wager_entry: Account<'info, WagerEntry>,

    /// Wagerer's USDC token account
    #[account(
        mut,
        constraint = wagerer_token_account.owner == wagerer.key(),
    )]
    pub wagerer_token_account: Account<'info, TokenAccount>,

    /// Vault's USDC token account
    #[account(
        mut,
        constraint = vault_token_account.owner == vault.key(),
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

// ─── State ──────────────────────────────────────────────────────────────────

#[account]
pub struct WagerVault {
    /// Admin authority who can settle/cancel
    pub authority: Pubkey,
    /// Caller wallet that receives tip on profitable trades
    pub caller: Pubkey,
    /// Trade card ID (matches paste.trade system)
    pub trade_card_id: String,
    /// Caller tip in basis points (e.g. 1000 = 10%)
    pub caller_tip_bps: u16,
    /// Unix timestamp: no new wagers after this
    pub wager_deadline: i64,
    /// Unix timestamp: settlement allowed after this
    pub settlement_deadline: i64,
    /// Total USDC wagered (6 decimals)
    pub total_wagered: u64,
    /// Number of wagers placed
    pub wager_count: u32,
    /// Vault lifecycle status
    pub status: VaultStatus,
    /// Final PnL in basis points (set at settlement)
    pub settled_pnl_bps: i16,
    /// PDA bump seed
    pub bump: u8,
}

impl WagerVault {
    /// Dynamic space calculation based on trade_card_id length
    pub fn space(trade_card_id: &str) -> usize {
        8 +                              // discriminator
        32 +                             // authority
        32 +                             // caller
        4 + trade_card_id.len() +        // trade_card_id (String: 4-byte len + data)
        2 +                              // caller_tip_bps
        8 +                              // wager_deadline
        8 +                              // settlement_deadline
        8 +                              // total_wagered
        4 +                              // wager_count
        1 +                              // status (enum)
        2 +                              // settled_pnl_bps
        1 +                              // bump
        64                               // padding for future fields
    }
}

#[account]
pub struct WagerEntry {
    /// The vault this wager belongs to
    pub vault: Pubkey,
    /// Wagerer's wallet
    pub wagerer: Pubkey,
    /// USDC amount wagered (6 decimals)
    pub amount: u64,
    /// Whether payout/refund has been claimed
    pub claimed: bool,
    /// PDA bump seed
    pub bump: u8,
}

impl WagerEntry {
    pub const SPACE: usize = 8 + 32 + 32 + 8 + 1 + 1 + 32; // discriminator + fields + padding
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum VaultStatus {
    Active,
    Settled,
    Cancelled,
}

// ─── Errors ─────────────────────────────────────────────────────────────────

#[error_code]
pub enum WagerError {
    #[msg("Trade card ID exceeds 64 characters")]
    TradeCardIdTooLong,
    #[msg("Caller tip exceeds maximum of 50%")]
    TipTooHigh,
    #[msg("Wager deadline must be in the future")]
    DeadlineInPast,
    #[msg("Settlement deadline must be after wager deadline")]
    SettlementBeforeDeadline,
    #[msg("Vault is not active")]
    VaultNotActive,
    #[msg("Wager deadline has passed")]
    DeadlinePassed,
    #[msg("Callers cannot wager on their own trades")]
    CallerCannotWager,
    #[msg("Wager amount must be greater than zero")]
    ZeroAmount,
    #[msg("Wager exceeds maximum of 500 USDC")]
    AmountTooLarge,
    #[msg("Vault has not been settled yet")]
    NotSettled,
    #[msg("Vault has not been cancelled")]
    NotCancelled,
    #[msg("Payout already claimed")]
    AlreadyClaimed,
    #[msg("Settlement too early — must wait until settlement deadline")]
    SettlementTooEarly,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Arithmetic overflow")]
    Overflow,
}
