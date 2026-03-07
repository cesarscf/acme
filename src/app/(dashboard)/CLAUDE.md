# (dashboard)

Route group protegido por auth. O layout verifica sessão via Better Auth e redireciona para `/login` se não autenticado.

## Estrutura

- Layout com `SidebarProvider`, `AppSidebar` e `SidebarInset`
- `_components/` — Componentes compartilhados do dashboard (sidebar, header, user card)
- `dashboard/` — Páginas do painel admin
- `dashboard/settings/` — Configurações da conta
- `dashboard/tenants/[id]/` — Detalhe do tenant com 4 tabs: Landing Page, Links, Ofertas e Metricas
- `dashboard/tenants/[id]/links/[linkPageId]/` — Detalhe da pagina de links com form de edição e CRUD de links
- `dashboard/tenants/[id]/ofertas/[offerId]/` — Detalhe da oferta com form de edição

## Padrões

- Páginas server component por padrão; componentes interativos (forms, buttons com actions) ficam em `_components/` da rota
- Dados são buscados via funções de `@/lib/queries/`
- Mutações via server actions de `@/lib/actions/`
- Componentes de UI usam shadcn/ui com `cn()` para classes condicionais
- Conteúdo das páginas usa `w-full` (sem `max-w-xl`)
- Páginas internas incluem botão de voltar, título e breve descrição
- Forms de edição são inline (campos direto na página, sem modal), com botão "Salvar" alinhado à direita
- Forms de criação ficam dentro de `Dialog` (modal), abertos via botão
- Listagens vazias mostram empty state com ícone, texto e botão que abre o dialog de criação
- Para fechar o dialog após sucesso do action, usar `useCallback` wrapper em vez de `setOpen` dentro de `useEffect`
