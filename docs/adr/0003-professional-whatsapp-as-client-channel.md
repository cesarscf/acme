# WhatsApp do próprio Profissional como único canal com o Cliente

Toda interação com o Cliente (aprovar Orçamento, receber Cobrança, confirmar Visita) acontece pelo WhatsApp, com templates e botões, enviados do número do próprio Profissional conectado via Embedded Signup da Meta. Não existe página pública nem conta para o Cliente, e o login do Profissional é por código enviado por WhatsApp (sem SMS, sem sessão anônima). Escolhemos o número do Profissional, e não um número único da plataforma, porque o Cliente já conversa com ele por esse número, apesar do custo de virar Tech Provider da Meta.

## Consequences

- Em dev, o WhatsApp é um adaptador simulado; o código de login aparece no log da API.
- Detalhes de viabilidade (Tech Provider, coexistência com o app WhatsApp Business, templates por WABA) em `docs/research/whatsapp.md`.
