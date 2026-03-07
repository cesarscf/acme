# (dashboard)

Route group protegido por auth. O layout verifica sessão via Better Auth e redireciona para `/login` se não autenticado.

## Estrutura

- Layout com `SidebarProvider`, `AppSidebar` e `SidebarInset`
- `_components/` — Componentes compartilhados do dashboard (sidebar, header, user card)
- `dashboard/` — Páginas do painel admin

## Padrões

- Páginas server component por padrão; componentes interativos (forms, buttons com actions) ficam em `_components/` da rota
- Dados são buscados via funções de `@/lib/queries/`
- Mutações via server actions de `@/lib/actions/`
- Componentes de UI usam shadcn/ui com `cn()` para classes condicionais
