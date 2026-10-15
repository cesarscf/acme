# Claude direto pelo SDK da Anthropic, sem camada de provedor

Os Assistants rodam no Claude pela API da Anthropic, com o SDK oficial (`@anthropic-ai/sdk`) e o tool runner; o modelo padrão é o Claude Opus 5.5. Descartamos os modelos grátis do OpenRouter, porque o teto de cerca de 1.000 requisições por dia na conta inteira não aguenta um piloto, e descartamos uma camada genérica de provedor (como o Vercel AI SDK), porque ela esconde recursos que usamos de propósito, como `strict: true` nas tools e o cache do prompt. Trocar de modelo dentro do Claude é uma linha; trocar de provedor passa a ser uma reescrita do loop dos Assistants, e aceitamos esse custo.

## Consequences

- O uso de tokens é registrado por Professional desde o M1, para medir o custo real antes de decidir por um modelo mais barato.
- A análise de privacidade e LGPD da pesquisa (`docs/research/mvp-stack.md`, §6.3) foi feita para o OpenRouter e precisa ser refeita para a Anthropic.
- Em 2026-10-15 o padrão do M1 passou a ser o Claude Haiku 5.5 (`effort: low`), para os créditos de teste durarem; `CLAUDE_MODEL=claude-opus-5-5` volta ao Opus. O Haiku 5.5 não tem fallback no servidor, então `fallbacks: "default"` só vai nas requisições de modelos que o aceitam; a recusa (`stop_reason: refusal`) é tratada em qualquer modelo.
