# Uniwind em vez de NativeWind para Tailwind no app

O app usa Uniwind (Tailwind v4) e não NativeWind, que é a opção mais comum. A versão estável do NativeWind (4.x) ainda usa Tailwind v3, e a v5 com Tailwind v4 está em RC e não é recomendada para produção; o Uniwind já é estável com Tailwind v4 e roda no Expo SDK 57 (ver `docs/research/mvp-stack.md`, seção 5).

## Consequences

- Uniwind e Tailwind ficam com versão exata fixada, porque patches do Tailwind já quebraram o Uniwind.
- Animações não usam `className` (é recurso do Uniwind Pro); são feitas com Reanimated.
- Componentes de terceiros precisam de `withUniwind`, e a junção de classes usa `tailwind-merge`.
