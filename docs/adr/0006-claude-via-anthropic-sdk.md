# Claude direto pelo SDK da Anthropic, sem camada de provedor

Os Assistants rodam no Claude pela API da Anthropic, com o SDK oficial (`@anthropic-ai/sdk`) e o tool runner; o modelo padrão é o Claude Opus 5.5. Descartamos os modelos grátis do OpenRouter, porque o teto de cerca de 1.000 requisições por dia na conta inteira não aguenta um piloto, e descartamos uma camada genérica de provedor (como o Vercel AI SDK), porque ela esconde recursos que usamos de propósito, como `strict: true` nas tools e o cache do prompt. Trocar de modelo dentro do Claude é uma linha; trocar de provedor passa a ser uma reescrita do loop dos Assistants, e aceitamos esse custo.

## Consequences

- O uso de tokens é registrado por Professional desde o M1, para medir o custo real antes de decidir por um modelo mais barato.
- A análise de privacidade e LGPD da pesquisa (`docs/research/mvp-stack.md`, §6.3) foi feita para o OpenRouter e precisa ser refeita para a Anthropic.
