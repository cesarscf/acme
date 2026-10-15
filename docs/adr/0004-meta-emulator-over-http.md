# Meta Emulator por HTTP em vez de adaptador falso dentro da API

Em dev, a API não fala com a Graph API da Meta, e sim com o `apps/meta-emulator`: um servidor que imita, por HTTP, o pedaço da Graph API que usamos (envio de mensagens, templates com status de aprovação, `subscribed_apps`, Embedded Signup) e dispara para a API webhooks assinados de verdade (`X-Hub-Signature-256`). Uma tela web do emulador faz o papel do WhatsApp do Customer (ver mensagens, clicar em botões, responder) e do WhatsApp Business do Professional (o que ele digita, via `smb_message_echoes`). A única diferença entre dev e produção é a URL base da Graph API no `.env`. Escolhemos isso em vez de um adaptador falso dentro da API porque assim a assinatura, o parsing dos webhooks e a deduplicação por `wamid` rodam em dev do mesmo jeito que em produção, e o dev não depende de contas, números de teste nem aprovações da Meta.

## Consequences

- O MVP sai em dois marcos: o M1 roda inteiro contra o emulador; o M2 liga a Meta de verdade. O emulador imita desde o M1 o envio de mensagens, os templates com botões e os webhooks assinados; o que depende de conta real (Embedded Signup, coexistence, aprovação de templates, cartão no WABA) só entra no M2. Professionals reais só usam o app depois do M2.

- O emulador precisa acompanhar o formato real dos payloads da Meta; quando a Meta mudar algo, ele muda junto.
- Antes de ir para produção, cada fluxo ainda precisa ser validado uma vez contra a Meta de verdade (Embedded Signup com coexistence, templates, Pix via `order_details`).
