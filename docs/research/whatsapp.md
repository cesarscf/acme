# Pesquisa: WhatsApp Business Platform para o MVP

> Pesquisa feita em 2026-10-14 só com fontes primárias: docs do WhatsApp em developers.facebook.com (versões `.md` da árvore `/documentation/business-messaging/whatsapp/`), o [changelog oficial](https://developers.facebook.com/documentation/business-messaging/whatsapp/changelog), os rate cards (XLSX) publicados na [página de preços](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing), os Termos da Plataforma e as FAQs/Help Center da Meta e do WhatsApp. O changelog tem como última entrada **12/05/2026**. Algumas páginas foram atualizadas depois disso e nem sempre batem entre si (ver §4 e §7).

Premissas (já decididas): cada **Profissional** conecta **o próprio número** à nossa plataforma. Os **Clientes** recebem templates com botões (aprovar **Orçamento**, **Cobrança** Pix, confirmação de **Visita**) vindos do número do Profissional. O login no app é por código enviado no WhatsApp.

## TL;DR

| Tema | Conclusão |
|---|---|
| Modelo | Viramos **Tech Provider**: Meta app do tipo Business, **Embedded Signup v4** e um WABA por Profissional, que é dono dos ativos. Business verification + App Review com Advanced access a `whatsapp_business_management` e `whatsapp_business_messaging`. Desde 03/10/2025, *access verification* não é mais exigida. |
| Prazos | App Review: média de ~24h. Business verification: até 14 dias úteis (Help Center). Sem as aprovações, o limite é de 10 Profissionais novos a cada 7 dias. Com elas, 200. Até lá, o dev mode só funciona para quem tem papel no app. |
| Número próprio + app (Coexistence) | Está **disponível** desde 11/02/2025. A Meta não publica uma lista positiva de países. Os anúncios posteriores só *adicionam* países (Índia, Austrália, Japão, UE/EEE/UK…) e o Brasil nunca aparece como excluído. Exige o app **WhatsApp Business** ≥ 2.24.17 e que já sejamos Tech Provider. Throughput fixo de 20 mps. |
| Mensagens dos Clientes chegam até nós? | **Sim.** Com coexistence, as mensagens enviadas e recebidas são espelhadas entre o app e a Cloud API, e as recebidas chegam no webhook `messages`. O que o Profissional digita no app chega no webhook `smb_message_echoes`. Também dá para importar até 180 dias de histórico (`history`) e os contatos (`smb_app_state_sync`). Isso permite que a Lia leia os pedidos automaticamente. |
| WhatsApp "normal" | Não serve. O Profissional precisa migrar para o app **WhatsApp Business** antes, o que mantém o histórico. Se ele registrar o número de novo no WhatsApp comum, a conexão cai (`BUSINESS_DOWNGRADE`). |
| Templates | São ativos **de cada WABA**. Não há compartilhamento entre WABAs de donos diferentes (a migração só funciona dentro do mesmo portfólio). Então criamos o nosso conjunto padrão via API em cada WABA no onboarding (`POST /<WABA_ID>/message_templates`). A aprovação leva até 24h e o status chega pelo webhook. Usar categoria **utility** para Orçamento, Visita e Cobrança. |
| Botões | Quick reply: até 10 por template. Copy code: só **1 por template e no máximo 20 caracteres**, o que não comporta um Pix copia-e-cola. Reply buttons interativos (dentro da janela de 24h): até 3. |
| Pix no WhatsApp (Brasil) | Disponível oficialmente: **`order_details` com `pix_dynamic_code`**, que mostra o botão "copiar código Pix", e o **template com botão `PAYMENT_REQUEST`** (Pix, Boleto ou link; até 3 por template), que ainda está "rolling out". O WhatsApp **não** confirma o pagamento: precisamos de um PSP/banco que gere o Pix dinâmico e nos avise. |
| Preço no Brasil (rate card de 01/10/2026) | Marketing: **R$ 0,3217** (US$ 0,0625). Utility e Authentication: **R$ 0,035** (US$ 0,0068), com descontos por volume. **Novidade de 01/10/2026: mensagens de serviço (não-template) e utility dentro da janela passam a ser cobradas, ambas a R$ 0,035**, segundo a página dedicada e o rate card. A página principal de preços ainda diz "free". |
| Quem paga | Como Tech Provider, **cada Profissional cadastra um cartão no próprio WABA** e a Meta cobra dele. Para nós pagarmos e repassarmos, precisaríamos ser ou usar um **Solution Partner** com linha de crédito. |
| Login (OTP) | Vem de um **WABA e número nossos** (integração direta). É um template **authentication** com botão copy code ou one-tap (o one-tap só funciona no Android e exige handshake/SDK no app). No iOS 26+, as sugestões de teclado fazem autofill desde 15/06/2026. Custa R$ 0,035 por OTP no Brasil. |
| Webhooks | Verificação via `GET` com `hub.challenge`. Assinatura `X-Hub-Signature-256` (HMAC-SHA256 do corpo com o app secret). Retries por até 7 dias, com duplicatas possíveis. Statuses `sent/delivered/read/failed/played` com o objeto `pricing`. |
| Bloqueios principais | (1) A business verification e o App Review da nossa empresa. (2) Cada Profissional precisa de conta Facebook/Meta, do app WhatsApp Business e de um cartão no WABA. (3) A cobrança de serviço desde 01/10/2026 muda a conta da Lia. (4) Risco de enquadramento como "AI Provider" (ver §4.4). |

---

## 1. Embedded Signup e Tech Provider

### 1.1 Tech Provider × Solution Partner
- **Tech Provider**: usa só *business tokens*. Os clientes **adicionam a própria forma de pagamento** ao WABA e só depois conseguem enviar mensagens ([Embedded Signup overview](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/overview)).
- **Solution Partner**: precisa de linha de crédito e de compartilhá-la com cada cliente (system user com `business_management` e papel Admin ou Financial Editor). O cliente envia mensagens na hora ([mesma página](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/overview)).
- Um Tech Provider também pode se juntar a um Solution Partner: é um passo extra de App Review, criando uma *partner solution* com o app ID do parceiro ([Become a Tech Provider](https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/get-started-for-tech-providers)).
- O cliente onboarded **é dono** de todos os ativos (portfólio, WABA, número) e tem acesso total ao WhatsApp Manager. Não é possível restringir isso ([overview](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/overview)).

### 1.2 Passos para virar Tech Provider
Fonte: [Become a Tech Provider](https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/get-started-for-tech-providers).
1. Criar um Meta app com o caso de uso WhatsApp e conectar um *business portfolio*. No App Dashboard, ir em **Use cases > Customize > Tech Provider onboarding**.
2. **Business verification** com nome, endereço, telefone, e-mail e site; documentos podem ser pedidos. "Your business must be verified before you can start the app review process."
3. **App Review**: configurações básicas (ícone, política de privacidade, categoria), mais **dois vídeos**: um com uma mensagem enviada pelo app e recebida no WhatsApp, outro com o app criando um template. Valem gravações do cURL do *API Setup* ou do WhatsApp Manager. Pedir **Advanced access** a `whatsapp_business_messaging` e `whatsapp_business_management`. Sem isso, chamadas em WABAs de terceiros retornam o erro `200`.
4. A [página de App Review](https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/app-review) pede **um vídeo e uma descrição por permissão**, diz que pedir permissões desnecessárias é causa comum de rejeição e informa: "**The average turnaround time for App Review is about 24 hours** … You don't need to wait for Embedded Signup to be fully implemented to start this process."
5. *Access verification* deixou de ser exigida para Tech Provider em **03/10/2025** ([changelog](https://developers.facebook.com/documentation/business-messaging/whatsapp/changelog)). A página do Embedded Signup ainda cita "Business Verification, App Review, and Access Verification" para subir o limite para 200, o que é provavelmente texto desatualizado.
6. **Business verification** leva até **14 dias úteis**, segundo o Help Center ([Verify your business](https://www.facebook.com/business/help/2058515294227817), via busca, porque a página não renderiza sem login). Editar os dados reinicia o processo. **Custos:** nenhuma das fontes cita taxa para virar Tech Provider. O custo é só o das mensagens.

### 1.3 Limites de onboarding
- O padrão é **10 clientes novos a cada 7 dias (janela móvel)**. Depois das verificações e do App Review, sobe para **200 a cada 7 dias**. Acima disso, é preciso virar Meta Business Partner ([overview](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/overview)).
- WABAs criados pelo "developer app" não podem ser onboarded pelo Embedded Signup ([idem](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/overview)).
- Cada portfólio novo de cliente começa com **messaging limit de 250** usuários únicos por 24h fora da janela. Sobe para 2.000 via verificação (inclusive *partner-led*) ou volume. Desde 08/10/2025 o limite é por portfólio, não por número ([Messaging limits](https://developers.facebook.com/documentation/business-messaging/whatsapp/messaging-limits), [changelog](https://developers.facebook.com/documentation/business-messaging/whatsapp/changelog)). Para um Profissional solo, 250 basta.

### 1.4 Fluxo técnico do onboarding (Tech Provider)
Fonte: [Onboarding as a Tech Provider](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-customers-as-a-tech-provider).
1. O Profissional faz login com a conta **Facebook/Meta**, aceita os termos, escolhe ou cria o portfólio e o WABA, verifica o número e define o display name ([overview](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/overview)).
2. No servidor: trocar o `code` por um **business token** (`GET /oauth/access_token`), fazer `POST /<WABA_ID>/subscribed_apps` e `POST /<PHONE_NUMBER_ID>/register` com PIN de 6 dígitos. **No coexistence, o register é pulado** (§2).
3. **Usar v4**: o Embedded Signup **v2 será descontinuado em 15/10/2026**. A v4 é configurada por uma *Facebook Login for Business Configuration* e continua suportando o onboarding de usuários do Business app via `feature_type` ([Version 4](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/version-4)). Desde a v3, o valor `coexistence` não vale mais. O certo é `whatsapp_business_app_onboarding` ([changelog](https://developers.facebook.com/documentation/business-messaging/whatsapp/changelog)).
4. Existe o **Hosted Embedded Signup**, um link hospedado pela Meta, desde 17/10/2025 ([changelog](https://developers.facebook.com/documentation/business-messaging/whatsapp/changelog)). Pode servir de atalho no MVP, já que o nosso app é Expo e o fluxo é web com o JS SDK.

### 1.5 Dá para desenvolver antes da aprovação?
- **Sim, com restrições.** Apps Business recebem *Standard access* automático, e quem tem papel `admin`, `developer` ou `tester` no app vê as permissões e consegue completar o fluxo ([App Review](https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/app-review), [overview](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/overview)). Em live mode, só aparecem as permissões aprovadas.
- A Business verification não é necessária se o app só for usado por pessoas com papel no app ([Business Verification](https://developers.facebook.com/documentation/development/release/business-verification)).
- **Sandbox account** (App Dashboard > WhatsApp > Quickstart > Testing Integrations): simula um cliente no Embedded Signup, vale por 30 dias e **o número dela não envia nem recebe mensagens**. Serve só para testar o fluxo e a troca de token ([overview](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/overview)).
- **Número de teste da Cloud API** (*API Setup*): permite enviar e receber com token temporário para números "To" cadastrados ([Get started](https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started)).
- **Ponto de atenção:** o coexistence lista como requisito "You must already be a Solution Partner or Tech Provider" ([Onboard Business app users](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users)). Não está documentado se o coexistence funciona em dev mode antes da aprovação (ver Pontos em aberto).

## 2. Coexistence (app WhatsApp Business + Cloud API no mesmo número)

Fonte principal: [Onboard WhatsApp Business app users](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users), salvo indicação.

### 2.1 Status e países
- **GA para solution providers desde 11/02/2025** ([changelog](https://developers.facebook.com/documentation/business-messaging/whatsapp/changelog)). Depois foram adicionados: números com DDI da Índia (05/05/2025) e, em 23/10/2025, Austrália, Japão, Filipinas, Rússia, Coreia do Sul, Turquia, EEE/UE e Reino Unido (mesmo changelog).
- **Brasil:** nenhuma fonte primária lista o Brasil nominalmente. Mas os anúncios só *adicionam* mercados que estavam excluídos, e o Brasil nunca aparece entre eles. A leitura é que o Brasil está coberto desde o lançamento. Confirmar com um teste real (Pontos em aberto).
- Nota de produto: o [rate card](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing) e a [página AI Providers](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/ai-providers) tratam o Brasil como mercado ativo da plataforma.

### 2.2 Requisitos
- App **WhatsApp Business** ≥ **2.24.17**. Já sermos Solution Partner ou Tech Provider. Webhook funcionando. Embedded Signup com *session logging*.
- O fluxo: o Profissional digita o número, recebe uma mensagem da conta oficial "Facebook Business" no app, toca **Connect**, escolhe se **compartilha o histórico** e cola o código. A sessão termina com o evento `FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING`.
- **Temos 24h após o onboarding para disparar a sincronização** (`POST /<PHONE_NUMBER_ID>/smb_app_data` com `sync_type: smb_app_state_sync` e depois `history`). Cada uma só pode ser feita **uma vez**. Se passar do prazo, é preciso fazer offboarding e o fluxo de novo. O Profissional deve manter o app aberto durante a sincronização.
- Para checar: `GET /<PHONE_NUMBER_ID>?fields=is_on_biz_app,platform_type` deve retornar `true` / `CLOUD_API`.

### 2.3 O que sincroniza e o que muda no app
| Recurso | No app depois do onboarding | Na Cloud API |
|---|---|---|
| Chats 1:1 | Ganham edição e revogação | **Suportados. Mensagens enviadas e recebidas são espelhadas**. Histórico de até 6 meses |
| Contatos | Sem mudança | Sincronizados (`smb_app_state_sync`) |
| Grupos | Sem mudança | **Não suportados** (não sincronizam) |
| Mensagens temporárias | **Desligadas** em todos os chats 1:1 | Não |
| Visualização única | **Desabilitada** | Não |
| Localização em tempo real | **Desabilitada** | Não |
| Listas de transmissão | **Desabilitadas** (as existentes ficam só leitura) | Não |
| Chamadas de voz e vídeo | Sem mudança | Não |
| Catálogo, pedidos, status, respostas rápidas, etiquetas, mensagem de ausência | Sem mudança | Não |

- **Aparelhos vinculados:** até 4 companions. Todos são desvinculados no onboarding e podem ser vinculados de novo. **WhatsApp para Windows e WearOS não são suportados.** Mensagens de usuários com companion não suportado não geram webhook `messages`.
- **Histórico (`history`):** cobre 180 dias, em 3 fases (0–1, 1–90 e 90–180 dias) e em *chunks*. As mídias só têm ID se forem dos últimos 14 dias. Se o Profissional recusar o compartilhamento, chega um `history` com o erro `2593109`.
- **Throughput fixo de 20 mps** no número em coexistence.
- **Janela de 24h:** só abre quando o Cliente escreve **depois** do onboarding. Mensagens enviadas pelo app **não** abrem, não estendem e não afetam a janela nem os preços da Cloud API.
- **Preço:** o que o Profissional envia pelo app continua **grátis**. O que enviamos pela Cloud API segue a tabela da Cloud API.
- Erro `131060` (*unsupported*) é esperado na primeira mensagem de um usuário novo (resolve em segundos) ou com companion não suportado.

### 2.4 As mensagens dos Clientes chegam para a Lia?
- **Sim.** As mensagens recebidas no número são espelhadas na Cloud API e chegam pelo webhook **`messages`** padrão. A própria doc descreve a exceção: companion não suportado "will not trigger messages webhooks".
- **O que o Profissional envia pelo app** (ou por companion) chega via **`smb_message_echoes`**, incluindo edição e revogação. A doc diz que devemos "digest and display in the contact message thread history" ([smb_message_echoes](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/smb_message_echoes)). Os tipos suportados no echo são `text`, `image`, `video`, `document`, `revoke` e `edit`.
- Edit e revoke em coexistence são suportados desde 25/11/2025 ([changelog](https://developers.facebook.com/documentation/business-messaging/whatsapp/changelog)).
- É preciso assinar no app os campos `history`, `smb_app_state_sync` e `smb_message_echoes`, além de `messages`.

### 2.5 Desconexão, e o caso do WhatsApp "normal"
- O número em coexistence **não pode** ser desregistrado pela API. O Profissional desconecta no app em **Configurações > Conta > Plataforma comercial > Desconectar**. Chega `account_update` com `PARTNER_REMOVED` e `disconnection_info.reason`, que pode ser `ACCOUNT_DISCONNECTED`, `BUSINESS_DOWNGRADE` (registrou o número no **WhatsApp comum**), `CHANGE_NUMBER`, `COMPANION_INACTIVITY` (~30 dias), **`PRIMARY_INACTIVITY` (aparelho principal inativo por ~14 dias)** ou `USER_RE_REGISTERED`.
- **WhatsApp comum (Messenger):** o coexistence é só para o app **WhatsApp Business**. O Profissional precisa migrar antes. A FAQ oficial diz que o Business detecta o número e oferece trazer o histórico, a mídia e as preferências. **Não dá para voltar o histórico** ao Messenger, e **um número não fica nos dois apps ao mesmo tempo** ([About moving](https://faq.whatsapp.com/223728052339165/), [How to move](https://faq.whatsapp.com/235676511161201/)).
- A alternativa é registrar o número só na Cloud API. Aí ele sai de qualquer app e o Profissional passa a usar apenas o nosso app (inferência a partir do fluxo padrão de register).

## 3. Templates e mensagens interativas

### 3.1 Categorias e aprovação
- São três categorias: **marketing**, **utility** e **authentication** ([Template categorization](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-categorization)).
  - **Utility** é algo disparado por ação ou pedido do usuário, ou essencial, e **sem conteúdo promocional**. Conteúdo misto vira marketing. Os nossos casos (confirmar Visita, Orçamento pedido pelo Cliente, lembrete de Cobrança) se encaixam em utility, desde que não tragam oferta.
  - **Authentication** só serve para OTP. Exige botão de OTP (copy code ou one-tap), não aceita URL, mídia nem emoji, e os parâmetros têm no máximo 15 caracteres.
  - Desde 09/04/2025, um template enviado como UTILITY que a Meta julgar marketing **é aprovado como MARKETING** (é possível pedir revisão em até 60 dias). A Meta também recategoriza templates já ativos, com aviso de 24h por webhook e e-mail ([idem](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-categorization)). Vale assinar `template_category_update`.
- **Revisão:** feita por ML com revisão manual, "**can take up to 24 hours**". Rejeições comuns: variáveis mal formatadas, template que começa ou termina com variável, **duplicata** de template existente e pedido de dados sensíveis ([Template review](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-review)).
- **Template Library:** templates utility e authentication já categorizados. Se não forem customizados, saem aprovados sem revisão ([Template Library](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-library)).

### 3.2 Templates por WABA (cada Profissional tem o seu)
- "Templates are WhatsApp Business Account assets" ([Templates overview](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview)). **Cada WABA precisa ter os seus.**
- **Migração** entre WABAs só funciona entre WABAs **do mesmo portfólio** ([Template migration](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-migration)). Não serve para nós, porque cada Profissional tem o próprio portfólio.
- **Como fazer:** no onboarding, criar via API (com o business token e `whatsapp_business_management`) o nosso conjunto padrão em `pt_BR` com `POST /<WABA_ID>/message_templates`, e acompanhar o webhook `message_template_status_update`. Limites: **100 criações por hora por WABA**. **250 templates** se o portfólio não for verificado, **6.000** se for verificado e tiver display name aprovado ([overview](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview)).
- **Novo modelo de contas (beta, Fase 1 no 2º semestre de 2026):** o WABA está se dividindo em *WhatsApp Business Account* (número e perfil) e *Messaging Account* (templates, billing e webhooks). "A Messaging Account can be owned by the client **or by a partner**", e "Templates belong to the Messaging Account … not shared across Messaging Accounts". A Fase 2 (1º semestre de 2027) exige `messaging_account_id` em cenários com várias contas. A Fase 3 (1º semestre de 2028) é a migração obrigatória para os IDs novos ([Updates to WhatsApp Business accounts](https://developers.facebook.com/documentation/business-messaging/whatsapp/account-model-evolution), [Onboarding changes](https://developers.facebook.com/documentation/business-messaging/whatsapp/account-model-evolution/onboarding)). No futuro, talvez permita uma Messaging Account nossa, mas é beta.
- **Direct Send API (beta):** envia utility e authentication sem pré-criar o template, e a Meta gera o template sozinha ([Direct Send](https://developers.facebook.com/documentation/business-messaging/whatsapp/direct-send)). Exige aceitar termos beta. Seria uma alternativa futura para não gerenciar templates por WABA.

### 3.3 Botões
Fonte: [Components](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/components) e [Reply buttons](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/interactive-reply-buttons-messages).
- **Template:** até **10 botões** no total. **Quick reply: até 10**, agrupados separados dos outros tipos. Com mais de 3 botões, aparecem 2 e um "Ver todas as opções". Templates com 4 ou mais botões, ou com quick reply misturado com outro tipo, **não aparecem no WhatsApp desktop**.
- **Copy code:** 1 por template, com **no máximo 20 caracteres**. **Não comporta um Pix copia-e-cola** (BR Code tem bem mais que isso). Para Pix, usar os recursos de §3.4.
- **Reply buttons interativos** (sem template, só dentro da janela): até **3 botões**, com `id` de até 256 caracteres e título de até 20.
- **Recomendação:** a aprovação de Orçamento e a confirmação de Visita usam um template utility com 2 ou 3 quick replies ("Aprovar" / "Recusar", "Confirmar" / "Remarcar").

### 3.4 Pix dentro do WhatsApp (Brasil): o que é oficial
- **Payments API – Brasil** com mensagens interativas `order_details` e `order_status`. Os meios são **Pix dinâmico**, payment links, **Boleto** e one-click com cartão offsite ([Payments API – Brazil](https://developers.facebook.com/documentation/business-messaging/whatsapp/payments/payments-br/overview)). "WhatsApp does NOT support payment reconciliations": a conciliação é nossa, com o PSP, via `reference_id` único por pedido.
- **Pix offsite:** `payment_settings[].type = "pix_dynamic_code"` com `code` (o copia-e-cola), `merchant_name`, `key` e `key_type` (CPF, CNPJ, EMAIL, PHONE ou EVP). `currency` é `BRL` e o `offset` é 100. Também existe uma versão simplificada, sem itens. O Cliente copia o código e paga no app do banco. "Merchants are responsible for integrating with a bank or PSP in order to generate dynamic Pix codes, and confirm their payment." Depois do pagamento, **devemos** enviar o `order_status` ([Pix](https://developers.facebook.com/documentation/business-messaging/whatsapp/payments/payments-br/offsite-pix), [Orders](https://developers.facebook.com/documentation/business-messaging/whatsapp/payments/payments-br/orders)).
- **Fora da janela de 24h:** usar o **Order details template** (utility ou marketing, botão fixo `ORDER_DETAILS`, com PDF opcional no header). Ele aceita Pix dinâmico ([Order details template](https://developers.facebook.com/documentation/business-messaging/whatsapp/payments/payments-br/orderdetailstemplate)).
- **Payment request CTA templates:** um botão `PAYMENT_REQUEST` com `pix_dynamic_code`, `boleto` ou `payment_link`, até 3 por template, combinável com outros botões e **sem precisar da Orders API**. Status: "**This feature is rolling out and might not be available yet for your WhatsApp Business account**" ([Payment request CTA](https://developers.facebook.com/documentation/business-messaging/whatsapp/payments/payments-br/payment-request-cta)). É o encaixe mais simples para a nossa **Cobrança**.

### 3.5 Janela de atendimento (24h)
- A janela abre ou renova a cada mensagem (ou chamada) do usuário. Dentro dela, vale qualquer mensagem. Fora dela, só template. Também é preciso ter **opt-in** do usuário ([Send messages](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages)).
- Existe uma janela de **72h grátis** (*free entry point*) quando a conversa nasce de anúncio Click-to-WhatsApp ou de CTA do Facebook ([Pricing](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing)).
- No coexistence, as mensagens enviadas pelo app não abrem a janela (§2.3).

## 4. Preços no Brasil (em 2026-10-14)

### 4.1 Modelo
- **Por mensagem desde 01/07/2025**, cobrada na **entrega** de template, conforme a categoria e o DDI do destinatário ([Pricing](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing), [changelog](https://developers.facebook.com/documentation/business-messaging/whatsapp/changelog)).
- Os volumes de utility e authentication são agregados **por portfólio** e por par mercado–categoria, e zeram todo mês ([Pricing](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing)). Na prática, cada Profissional tem o próprio portfólio e fica na faixa de lista.
- Os preços só mudam no 1º dia de cada trimestre ([pricing calendar](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing)).

### 4.2 Tabela Brasil (rate cards "effective October 1, 2026", baixados da [página de preços](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing))

| Categoria | BRL | USD |
|---|---|---|
| Marketing | R$ 0,3217 | US$ 0,0625 |
| Utility | R$ 0,035 | US$ 0,0068 |
| Authentication | R$ 0,035 | US$ 0,0068 |
| Authentication-international | n/a | n/a |
| **Service** (não-template) | **R$ 0,035** | **US$ 0,0068** |
| Meta Business Agent | US$ 2,00 por 1M de tokens | idem |

Faixas de volume para utility e authentication no Brasil (BRL):

| Faixa | Utility | Authentication |
|---|---|---|
| Lista | R$ 0,035 até 250 mil/mês | R$ 0,035 até 500 mil/mês |
| Mínimo | R$ 0,0263 (−25%) acima de 70M | R$ 0,0263 (−25%) acima de 20M |

### 4.3 Atenção: o que é grátis mudou em 01/10/2026
- A página [Pricing for non-template messages](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/non-template-messages) diz: "**Effective October 1, 2026**, Meta will charge for service messages" e também "for utility messages sent in response to users within an open 24-hour customer service window". Diz ainda: "**Any non-template message is charged as of October 1, 2026.**" O preço do service é igual ao de utility e authentication no mesmo mercado, **sem faixas de volume**. A página usa o próprio Brasil no exemplo: entrega a 0,68 centavo de dólar.
- O rate card de 01/10/2026 traz a coluna **Service** preenchida (Brasil: US$ 0,0068 / R$ 0,035).
- **Conflito:** a [página principal de preços](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing) ainda diz "All non-template messages are free" e "Utility templates delivered within an open customer service window are free". A página de marketing em pt-BR ([whatsappbusiness.com](https://whatsappbusiness.com/pt-br/products/platform-pricing/)) também diz que não cobra. **Para planejar, considere que tudo é cobrado** (ver Pontos em aberto).
- Impacto: cada resposta automática da Lia a um Cliente custaria **~R$ 0,035**, e uma confirmação de Visita dentro da janela também.
- O webhook de status mostra o que foi cobrado: `pricing.billable`, `type` (`regular` ou `free_customer_service`) e `category` ([status webhook](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages/status), [non-template](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/non-template-messages)).

### 4.4 "AI Providers" e o Brasil
- Os Termos (§4.7) definem *AI Providers* como "fornecedores e desenvolvedores de tecnologias de IA" (LLMs, plataformas de IA generativa, assistentes de uso geral), "conforme determinado pela Meta a seu critério exclusivo". Eles são proibidos de usar a plataforma **quando a IA é a funcionalidade principal (e não incidental ou auxiliar)**. Há exceções por país ([Termos da Plataforma, atualizados em 23/09/2026](https://www.facebook.com/legal/Meta-Terms-for-WhatsApp-Business-Platform)). Os mesmos Termos proíbem usar dados da plataforma para treinar modelos, exceto *fine-tuning* de uso exclusivo.
- Desde **11/03/2026**, a Meta cobra AI Providers por mensagens não-template entregues a usuários no **Brasil (+55)**. A cobrança na UE e no EEE acabou em 12/05/2026, mas a do Brasil continua ([AI Providers](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/ai-providers), [changelog](https://developers.facebook.com/documentation/business-messaging/whatsapp/changelog)).
- **Leitura:** a Lia é um assistente do negócio do Profissional (agenda, orçamento, cobrança), não um assistente de uso geral, então a IA tende a ser "auxiliar". Mas o enquadramento é **critério da Meta**. Na descrição do App Review, devemos posicionar o produto como software de gestão para prestadores de serviço.

### 4.5 Quem paga
- **Tech Provider:** "your onboarded business customers must add a payment method to their WhatsApp Business account" ([overview](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/overview); [Help Center: adicionar cartão](https://www.facebook.com/business/help/488291839463771)). **A Meta cobra o Profissional diretamente.** Sem forma de pagamento, ele não consegue enviar mensagens.
- **Para nós pagarmos e repassarmos**, precisamos ser Solution Partner com linha de crédito ou nos associar a um.
- **Faturamento em BRL:** desde **01/07/2026**, clientes cujo *Sold-To* no Billing Hub é o Brasil só criam WABAs novos em **BRL**, faturados pela Facebook Brasil. Todos os WABAs desses clientes precisam estar em BRL até **30/06/2027**, porque a partir de 01/07/2027 a Meta para de entregar mensagens de WABAs fora de BRL ([Pricing](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing)).

## 5. Login por OTP (número da plataforma)

- Precisamos de **um WABA e um número nossos** (integração direta, não pelo Embedded Signup). O Profissional ainda não conectou nada nesse ponto, e só **authentication templates** podem levar OTP ([categorization](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-categorization)).
- **Formato fixo:** "<código> is your verification code" (localizado), com aviso de segurança e de expiração (1–90 minutos) opcionais. O botão pode ser **one-tap**, **copy code** ou nenhum (zero-tap) ([Authentication templates](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/authentication-templates/authentication-templates)).
- **One-tap autofill:** "**only supported on Android**". Em outros aparelhos, vira copy code. Exige `supported_apps` com `package_name` e `signature_hash` (até 5 apps) e um **handshake** antes do envio. O handshake via `PendingIntent` será **descontinuado em 15/10/2026**, e a recomendação é o **OTP Android SDK** ([One-tap](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/authentication-templates/autofill-button-authentication-templates)). No Expo, isso exige código nativo (config plugin ou dev build).
- **iOS 26+:** desde **15/06/2026**, as *Keyboard suggestions* ficam ligadas por padrão em todos os authentication templates. O iOS detecta o OTP na notificação e oferece autofill no teclado, sem integração ([Authentication templates](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/authentication-templates/authentication-templates)).
- **Linked device security:** o OTP só chega no **aparelho principal**. Em aparelhos vinculados, a mensagem aparece mascarada (idem).
- **Para o MVP,** o copy code é o mais simples e funciona em todo lugar. O one-tap no Android fica para depois.
- **BSUID:** OTPs com one-tap, zero-tap ou copy code **exigem o telefone do usuário**, não funcionam com BSUID ([Business-scoped user IDs](https://developers.facebook.com/documentation/business-messaging/whatsapp/business-scoped-user-ids)). Como o login já é pelo telefone, não é problema.
- **Custo Brasil:** R$ 0,035 por OTP entregue (US$ 0,0068). Não existe tarifa authentication-international para o Brasil (§4.2).
- **Messaging limit** do nosso portfólio: começa em 250 usuários únicos por 24h. É preciso fazer a business verification logo para subir a 2.000 ([Messaging limits](https://developers.facebook.com/documentation/business-messaging/whatsapp/messaging-limits)).

## 6. Webhooks

Fontes: [Create a webhook endpoint](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/create-webhook-endpoint) e [Webhooks overview](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/overview).
- **Verificação:** um `GET` com `hub.mode=subscribe`, `hub.verify_token` e `hub.challenge`. Se o token bater, responder **200 com o `hub.challenge`**. Exige TLS válido (sem certificado autoassinado). mTLS é opcional.
- **Assinatura:** o cabeçalho `X-Hub-Signature-256: sha256=<hash>`, que é o HMAC-SHA256 do **corpo cru** com o **app secret**. Comparar com o valor depois de `sha256=`.
- **Entrega:** payload de até 3 MB. Sem resposta 200, a Meta **tenta de novo por até 7 dias**, e **duplicatas são possíveis**. Por isso, deduplicar pelo `wamid`. Os IPs mudam, então a doc recomenda mTLS em vez de allowlist.
- **Por cliente:** cada WABA onboarded precisa de `POST /<WABA_ID>/subscribed_apps`. Dá para sobrescrever o callback por WABA ([onboarding TP](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-customers-as-a-tech-provider)).
- **Status** ([status webhook](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages/status)): `sent`, `delivered`, `read`, `failed` e `played` (voz, desde 03/11/2025). `read` às vezes chega sem `delivered`. O objeto `pricing` vem com `billable`, `pricing_model`, `type` e `category`. Na v24+, o objeto `conversation` só aparece em janela free entry point. Existe também o `biz_opaque_callback_data`, um eco de um dado nosso que é útil para ligar o status ao Orçamento ou à Cobrança.
- **Clique em botão:**
  - Quick reply de template gera `type: "button"` com `button.payload` e `button.text`, mais `context.id` = o `wamid` do template ([button](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages/button)). **Mapear `context.id` para o Orçamento ou a Visita.**
  - Reply button interativo gera `type: "interactive"` com `interactive.button_reply.{id,title}`. Lista gera `list_reply` ([interactive](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages/interactive)).
- **Outros campos úteis:** `message_template_status_update`, `template_category_update`, `account_update` (desconexão no coexistence), `smb_message_echoes`, `history` e `smb_app_state_sync` ([overview](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/overview)).
- **BSUID e usernames:** desde abril de 2026, todo webhook traz `user_id` (BSUID, escopado ao portfólio). Se o Cliente adotar um username, **o telefone dele pode não vir** no webhook, salvo se houve interação nos últimos 30 dias com aquele número. Suportar BSUID "is required for all partners" ([Business-scoped user IDs](https://developers.facebook.com/documentation/business-messaging/whatsapp/business-scoped-user-ids)). O modelo de Cliente precisa aceitar o BSUID como identificador.

## Pontos em aberto / incertezas

1. **Coexistence no Brasil:** não há uma lista positiva de países na doc. A conclusão de que funciona vem por exclusão (o Brasil nunca aparece entre os mercados adicionados depois). Validar onboardando um número +55 real assim que formos Tech Provider.
2. **Coexistence antes da aprovação:** o requisito "must already be a Tech Provider" pode impedir testar em dev mode. Precisamos testar cedo. Se não der, fazer a business verification e o App Review **já** (o App Review leva ~24h, a verificação até 14 dias úteis).
3. **Cobrança de service e utility dentro da janela desde 01/10/2026:** a página dedicada e o rate card dizem que é cobrado. A página principal de preços e a página pt-BR dizem que é grátis. Conferir no primeiro envio pelo campo `pricing.billable` do webhook de status e na Pricing Analytics.
4. **Enquadramento como "AI Provider":** é critério exclusivo da Meta. Se formos enquadrados, ver as tarifas da [página AI Providers](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/ai-providers) (CSV não baixado) e o risco de restrição. Vale uma leitura jurídica dos Termos §4.7.
5. **Payment request CTA (Pix em template):** está "rolling out", pode não estar disponível no WABA de cada Profissional. Fallback: order details template com Pix ou link de pagamento. Também falta confirmar se `order_details` e `PAYMENT_REQUEST` aparecem corretamente para o Profissional no app em coexistence (não documentado).
6. **Fricção do onboarding do Profissional:** conta Facebook/Meta, app WhatsApp Business ≥ 2.24.17 (quem usa o WhatsApp comum precisa migrar antes), cartão no WABA (somos Tech Provider) e app aberto durante a sincronização (janela de 24h). Avaliar se vale ser ou usar um Solution Partner para tirar a etapa do cartão.
7. **Quick reply com payload customizado:** a referência do webhook mostra `payload` e `text`, mas não achei na doc nova a sintaxe para definir o payload no envio. Por ora, identificar o clique pelo `context.id`.
8. **Novo modelo de contas (WAAC / Messaging Account):** está em beta e a Fase 1 sai no 2º semestre de 2026. Pode mudar onde ficam templates e billing (inclusive Messaging Account do parceiro). Acompanhar, porque a Fase 3 (1º semestre de 2028) é obrigatória.
9. **Número de teste da Cloud API:** a doc atual não diz quantos destinatários "To" são permitidos. Ver no App Dashboard.
10. **Prazo de business verification:** os 14 dias úteis vêm do Help Center via busca (a página exige login para renderizar).
