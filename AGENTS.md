## Coding standards

Read before writing or reviewing code: naming (kebab-case files, plural tables), language, comments, how much abstraction, framework practice. See `docs/agents/coding-standards.md`.

## Agent skills

### Issue tracker

Issues and specs live as local markdown files under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Assistant evals

Before changing an Assistant's prompt, a tool (name, description, schema) or the model (`CLAUDE_MODEL`), run `bun run evals` (in `apps/api`, or from the root) before and after the change. It plays the scripted conversations in `apps/api/src/modules/*/*.eval.ts` against the real model and checks the tools called and their arguments. It spends tokens (about 2 cents on Haiku 5.5), so it never runs in `bun run test`. A new prompt rule or tool deserves a new scripted conversation.
