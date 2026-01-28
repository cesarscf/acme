# Claude Code Instructions

## Package Manager

Este projeto usa **Bun** como package manager. Sempre utilize `bun` para instalar dependências e rodar scripts:

```bash
bun install
bun run <script>
```

## Linting e Formatting

Este projeto usa **Biome.js** configurado na raiz (`biome.json`) para linting e formatting de todo o código. Os apps em `apps/web` e `apps/api` não possuem configurações próprias de ESLint, Prettier ou outros linters - todos utilizam o Biome da raiz.

## Git Commits

Antes de qualquer commit, executar os comandos do Biome.js para garantir que o código está formatado e sem erros de lint:

```bash
bun biome check --write .
```

Ao fazer commits, **não incluir** o Claude Code como co-author. Os commits devem conter apenas o usuário do git configurado localmente.
