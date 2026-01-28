# Claude Code Instructions

## Package Manager

This project uses **Bun** as package manager. Always use `bun` to install dependencies and run scripts:

```bash
bun install
bun run <script>
```

## Linting and Formatting

This project uses **Biome.js** configured at the root (`biome.json`) for linting and formatting all code. The apps in `apps/web` and `apps/api` do not have their own ESLint, Prettier, or other linter configurations - they all use Biome from the root.

## Git Commits

Before any commit, run Biome.js commands to ensure code is formatted and lint-free:

```bash
bun biome check --write .
```

When making commits, **do not include** Claude Code as co-author. Commits should only contain the locally configured git user.

## Contextual Documentation (CLAUDE.md)

This project uses `CLAUDE.md` files distributed across folders to document the context of each feature/module.

### Guidelines for creating and maintaining CLAUDE.md

1. **Contextual scope**: Each file should only document what is relevant to that folder/module. Avoid including details of features that are not directly related to the context.

2. **Avoid documenting folder structure**: Directory organization can change over time. Focus on documenting **code patterns**, **conventions**, **technical decisions**, and **expected behaviors**.

3. **Document code patterns**:
   - Naming conventions used
   - Module-specific patterns (e.g., how to create a new endpoint, how to add a component)
   - Important dependencies and how to use them
   - Relevant data flows

4. **Keep it updated**: When finishing a feature or significant implementation, **ask the user if the context's CLAUDE.md should be updated** with the new changes.

5. **Be concise**: Document what is necessary for another developer (or Claude) to quickly understand how to work in that context.
