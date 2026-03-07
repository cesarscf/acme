# (dashboard)

Route group protegido por auth. O layout verifica sessão via Better Auth e redireciona para `/login` se não autenticado.

## Estrutura

- Layout com `SidebarProvider`, `AppSidebar` e `SidebarInset`
- `_components/` — Componentes compartilhados do dashboard (sidebar, header, user card)
- `dashboard/` — Páginas do painel admin
- `dashboard/settings/` — Configurações da conta
- `dashboard/tenants/new/` — Criação de tenant
- `dashboard/tenants/[id]/` — Detalhe do tenant com 4 tabs: Landing Page, Links, Ofertas e Metricas

## Padrões

- Páginas server component por padrão; componentes interativos (forms, buttons com actions) ficam em `_components/` da rota
- Dados são buscados via funções de `@/lib/queries/`
- Mutações via server actions de `@/lib/actions/`
- Componentes de UI usam shadcn/ui com `cn()` para classes condicionais
- Conteúdo das páginas limitado a `max-w-xl` alinhado ao start
- Páginas internas incluem botão de voltar, título e breve descrição
- Forms de edição são inline (campos direto na página, sem modal), com botão "Salvar" alinhado à direita
