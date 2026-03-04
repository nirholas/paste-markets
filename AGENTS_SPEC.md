# AGENTS.md Specification (Minimal, Source-Grounded)

## Goal

`AGENTS.md` should contain only runtime invariants that are directly grounded in:
- `SKILL.md`, or
- behavior enforced by plugin/adapter code.

It is not an install guide and not a maintainer policy file.

## Inclusion Rule

A line is allowed in `AGENTS.md` only if it has both:
1. A concrete source in this repo.
2. A user-impacting runtime reason to keep it.

## Exclusion Rule

Exclude from `AGENTS.md`:
- release-channel or rollout assumptions
- maintainership/process policy
- long workflow duplication from `SKILL.md`
- anything not verifiable in `SKILL.md` or runtime code

## Required Shape

1. one-line purpose
2. pointer to `SKILL.md` as canonical
3. short list of runtime invariants
4. short scope boundary

## Current Invariants and Sources

1. Keep `/trade` command unchanged.
- Source: `SKILL.md` frontmatter `name: trade`.
- Why: command rename breaks invocation contract.

2. Keep OpenClaw tool name `trade_slash_dispatch` unchanged.
- Source: `SKILL.md` frontmatter `command-tool: trade_slash_dispatch`; `openclaw-plugin/index-lib.mjs`.
- Why: dispatch wiring depends on stable tool name.

3. URL flow order: `extract.ts` -> `create-source.ts` before long steps.
- Source: `SKILL.md` Source-First Sequence; `openclaw-plugin/trade-slash-dispatch-lib.mjs` wrapper prompt.
- Why: ensures live source URL is created early.

4. Reuse same `run_id` across adapter calls.
- Source: wrapper prompt in `trade-slash-dispatch-lib.mjs`; `skill/adapters/board/run-id.ts`; downstream adapters expecting run-linked context.
- Why: prevents cross-run corruption and preserves traceability.

5. Finalization must account for every extracted thesis exactly once.
- Source: `skill/adapters/board/finalize-source.ts` validation.
- Why: prevents silent thesis loss/duplication on completion.

6. First run must not depend on X auth.
- Source: `SKILL.md` (X optional); fallback chain in `skill/adapters/transcript/extract.ts`.
- Why: prevents unnecessary first-run failures.

## Review Checklist for AGENTS.md

- Every line maps to a source file.
- No install-channel assumptions.
- No maintainer/process content.
- No conflicts with `SKILL.md`.
