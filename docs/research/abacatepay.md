# Pesquisa: AbacatePay para a Cobrança por Pix

> Pesquisa feita em 2026-10-14 só com fontes primárias: docs oficiais ([docs.abacatepay.com](https://docs.abacatepay.com), lidas pelo [`llms-full.txt`](https://docs.abacatepay.com/llms-full.txt)), site e [termos de uso](https://www.abacatepay.com/termos) da AbacatePay, repositórios oficiais no GitHub ([AbacatePay/ecosystem](https://github.com/AbacatePay/ecosystem), [AbacatePay/abacatepay-cli](https://github.com/AbacatePay/abacatepay-cli)), o registry do npm (`npm view`) e a [Lei 12.865/2013](https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2013/lei/l12865.htm). As versões citadas são as `latest` do npm nessa data.
>
> Contexto: a Tina (Assistente de Cobrança) gera a Cobrança por Pix de cada Atendimento e manda para o Cliente pelo WhatsApp. A plataforma não cobra taxa própria, o dinheiro é do Profissional e a plataforma **nunca encosta nele** (sem custódia, sem repasse). O setup do Profissional precisa ser o mais simples possível, de preferência poucos toques no celular e sem copiar chave de API de um dashboard.

## TL;DR / recomendação

- **A AbacatePay não tem subcontas, contas conectadas, OAuth público nem split.** O split aparece como "Ainda não. [...] está em desenvolvimento" no FAQ da [home](https://www.abacatepay.com/) e na página [para marketplaces](https://www.abacatepay.com/para/marketplaces). Nenhuma rota de subconta ou de onboarding de terceiros existe na [referência da API](https://docs.abacatepay.com/llms.txt).
- **Hoje, o único modelo que cumpre "o dinheiro é do Profissional" é este: cada Profissional abre a própria conta AbacatePay, cria uma chave de API e entrega a chave ao app.** Para isso o Profissional precisa de **CNPJ (MEI serve, CPF não)** e de um **site da empresa no ar** com termos de uso, política de privacidade e CNPJ no rodapé ([produção](https://docs.abacatepay.com/pages/production#requisitos-para-produção)). Para um técnico de ar-condicionado MEI, o site é o maior bloqueio.
- **Pix:** `POST /v2/transparents/create` com `method: "PIX"` devolve `brCode` (copia-e-cola) e `brCodeBase64` (QR). Só `amount` é obrigatório: o CPF do Cliente **não** é exigido. Expiração padrão de 24h, ajustável com `expiresIn`. Para status há o webhook `transparent.completed` e `GET /transparents/check`. O reembolso é só total. No Dev mode o pagamento é simulado com `/transparents/simulate-payment`.
- **Taxas:** Pix recebido custa **R$ 0,80 fixo**. Saque Pix custa R$ 0,80 (até 20 por mês, depois R$ 2,50). TED custa R$ 5,00. Não há mensalidade ([pricing](https://www.abacatepay.com/pricing), [termos](https://www.abacatepay.com/termos)).
- **SDK:** `@abacatepay/sdk@3.0.0` (Apache-2.0, `engines.bun >=1.0.0`), publicado em 2026-10-12 com breaking changes. Para webhooks no Elysia existe `@abacatepay/elysia@2.0.3`. A autenticação é `Authorization: Bearer <chave>`, com permissões por rota.

### Modelos de conta contra os dois critérios do produto

| Modelo | Nunca encostar no dinheiro | Setup simples (poucos toques no celular, sem copiar chave) | Situação |
|---|---|---|---|
| **A. Conta própria do Profissional + chave de API entregue ao app** | ✅ O dinheiro cai no saldo do Profissional e o saque só vai para conta do mesmo CNPJ ([saques](https://docs.abacatepay.com/pages/concepts/saques)). Se a chave for criada **sem** `WITHDRAW:CREATE`, o app nem consegue mover o dinheiro ([permissões](https://docs.abacatepay.com/pages/authentication#permissões-da-chave-de-api)). | ❌ Cadastro web, KYC com site obrigatório, análise de até 3 dias úteis e chave copiada do dashboard ("Integração → API Keys → Criar Chave"). | **Única opção disponível hoje.** |
| **B. Conta da plataforma recebe e repassa** (via [Enviar PIX](https://docs.abacatepay.com/pages/pix/create)) | ❌ Viola o critério de saída: a plataforma passa a ter custódia e faz repasse. Há também risco regulatório (§2) e conflito com os termos da AbacatePay. | ✅ É o mais simples para o Profissional (só uma chave Pix). | **Descartar.** |
| **C. Split nativo (futuro)** | ✅ Pela descrição, "cada recebedor cadastrado terá sua própria conta" e recebe "sem transferência manual pela plataforma" ([marketplaces](https://www.abacatepay.com/para/marketplaces)). | ❓ O Profissional ainda precisaria de conta própria, e o onboarding do recebedor não está descrito. | Em desenvolvimento, sem data. |
| **D. OAuth / "Conectar com AbacatePay"** | ✅ seria ideal | ✅ seria ideal | **Não existe publicamente.** Há um fluxo de aprovação pelo navegador, mas ele é interno da CLI (§1.3). |

**Recomendação:** para o MVP, siga com o modelo A, sabendo que ele **não cumpre** o critério de simplicidade. Antes de decidir, pergunte à AbacatePay (ajuda@abacatepay.com): (1) se um app de terceiros pode usar o fluxo de aprovação da CLI ou se há um OAuth de parceiros previsto; (2) se o requisito de site é dispensado para MEI prestador de serviço local; (3) qual a data do split. Compare com a pesquisa da Woovi feita em paralelo (`docs/research/woovi.md`).

---

## 1. Modelo de conta

### 1.1 Subcontas, contas conectadas, split
- **Não há API de subcontas nem de contas conectadas.** O índice completo da API v2 lista Checkout, Links, Clientes, Checkout Transparente, Produtos, Cupons, Webhooks, Assinaturas, Saques, Transferências Pix, Loja, Extrato e Trust MRR. Nenhuma dessas rotas cria conta ou recebedor ([llms.txt](https://docs.abacatepay.com/llms.txt)).
- **Split:** o FAQ da home responde "Tem split de pagamento? Ainda não. O split de pagamento está em desenvolvimento e vai permitir dividir os valores automaticamente entre vários recebedores" ([abacatepay.com](https://www.abacatepay.com/)). A página [para marketplaces](https://www.abacatepay.com/para/marketplaces) repete: "Split automático entre plataforma e vendedores está em desenvolvimento". Pelo modelo descrito ali, cada recebedor terá a própria conta AbacatePay.
- **"Subcontas" nos termos é outra coisa.** São as contas operacionais que a AbacatePay abre **em nome do Usuário** nas Instituições Parceiras ("Asaas, Pagar.me, Malga e Woovi"), que fazem o processamento e a custódia. Não são subcontas que uma plataforma controle ([termos, §2.2](https://www.abacatepay.com/termos)).
- **Multi Lojas:** desde 20/04/2026 dá para "convidar pessoa, acessar suas lojas e também as de quem te convidar, tudo dentro de uma conta só" ([blog Q2W426](https://www.abacatepay.com/blog/Q2W426)). Ninguém documenta se um membro convidado pode criar chaves de API na loja de quem o convidou. Mesmo que possa, o Profissional ainda teria que ter conta e KYC próprios.

### 1.2 Consequência: cada Profissional tem conta própria e entrega a chave
- Uma chave identifica uma conta (loja) e define o ambiente: `abc_dev_...` para Dev mode e `abc_prod_...` para produção, ambos com a mesma URL base `https://api.abacatepay.com/v2` ([autenticação](https://docs.abacatepay.com/pages/authentication), [produção](https://docs.abacatepay.com/pages/production)).
- **As chaves têm permissões por rota, que não podem ser editadas depois de criadas** ([autenticação](https://docs.abacatepay.com/pages/authentication#permissões-da-chave-de-api)). Para o app, peça uma chave só com `TRANSPARENT:CREATE`, `TRANSPARENT:READ`, `WEBHOOK:CREATE`, `WEBHOOK:READ`, `STORE:READ` e, se o app for reembolsar, `REFUND:CREATE`. **Nunca peça `WITHDRAW:CREATE`**, que dá acesso a `/payouts/create` e `/pix/send`. Sem ela, a plataforma tecnicamente não consegue tirar dinheiro da conta do Profissional, o que reforça o critério "nunca encostar no dinheiro".
- Os termos dizem que "o Usuário deve manter seus dados de acesso em sigilo" ([termos, §4](https://www.abacatepay.com/termos)) e a doc diz que "a AbacatePay **nunca** solicitará sua chave" ([autenticação](https://docs.abacatepay.com/pages/authentication)). Os termos não proíbem expressamente entregar a chave a um software de terceiros, mas também não preveem esse caso (ver incertezas).

### 1.3 OAuth / onboarding de parceiro
- **Não há OAuth documentado para terceiros.** A única coisa parecida é o `abacatepay login` da CLI, que "abre o navegador para você aprovar o acesso" ([CLI auth](https://docs.abacatepay.com/pages/cli/auth)). No código-fonte da CLI, esse login é um *device flow*: `POST /app/oauth/cli/request` com `device.kind = "cli"`, aprovação em `app.abacatepay.com/oauth/cli?id=...`, polling em `/app/oauth/cli/{id}/status` e, depois de `APPROVED`, uma API key ([internal/auth/login.go](https://github.com/AbacatePay/abacatepay-cli/blob/main/internal/auth/login.go)). **Esse endpoint é interno e não está documentado, então não deve ser usado sem autorização da AbacatePay.** Mas ele mostra que o "Conectar com AbacatePay" em poucos toques é tecnicamente viável do lado deles.
- **Programa de Parcerias ABKT:** quem indica outras contas recebe um link de afiliação, e "cada transação válida realizada pelo Indicado gerará ao Parceiro um crédito fixo de R\$ 0,10" ([termos, §8](https://www.abacatepay.com/termos)). O crédito é pago pela AbacatePay e não é descontado do Profissional. Isso não muda a regra de "sem taxa da plataforma", mas é uma receita que vale decidir de forma explícita e transparente.

### 1.4 CPF/CNPJ, MEI e KYC
- **Só pessoa jurídica.** "A AbacatePay atende apenas pessoa jurídica (MEI e ME são aceitos)" ([produção](https://docs.abacatepay.com/pages/production#requisitos-para-produção)), "A AbacatePay não atende pessoas físicas" ([termos](https://www.abacatepay.com/termos)) e "Por enquanto a Abacate é só pra CNPJ. MEI serve" ([home](https://www.abacatepay.com/)). **Profissional só com CPF não consegue usar.**
- Para ativar a produção é preciso ([produção](https://docs.abacatepay.com/pages/production#requisitos-para-produção)):
  - CNPJ válido;
  - **site da empresa no ar**, com e-mail e WhatsApp de contato, termos de uso, política de privacidade e o CNPJ no rodapé;
  - dados do sócio administrador: nome, celular confirmado por código, data de nascimento e nome da mãe;
  - endereço e descrição do negócio. Documentos adicionais podem ser pedidos pelo dashboard.
- Os termos citam a coleta de "Documentos de identificação (RG, CNH, frente e verso)" e listam como motivo de recusa "selfie/documento de identificação [...] ilegíveis". A verificação "inclui a validação da identidade, do CNPJ e da titularidade da conta bancária" ([termos, §2.2 e §3](https://www.abacatepay.com/termos)).
- Também são motivos de recusa no KYC: empresa recém-constituída (passa por análise adicional), atividade real diferente da declarada "(apurada por meio de site, redes sociais...)" e porte incompatível. MEI pode receber "limites operacionais" ([termos, §3](https://www.abacatepay.com/termos)).

## 2. Se a conta da plataforma recebesse e repassasse

**Isso viola o critério do produto (a plataforma nunca encosta no dinheiro).** Fica registrado aqui só para justificar o descarte.

- **Mecânica possível:** a plataforma receberia na própria conta e repassaria com `POST /v2/pix/send` ("envia dinheiro para qualquer chave PIX de terceiros"), com a taxa descontada do valor enviado ([Enviar PIX](https://docs.abacatepay.com/pages/pix/create), [Pix reference](https://docs.abacatepay.com/pages/pix/reference)). O saque comum só vai para chave do mesmo CNPJ ([saques](https://docs.abacatepay.com/pages/concepts/saques)).
- **Custo:** R$ 0,80 no recebimento mais a taxa do Enviar PIX, que **não aparece** na [página de preços](https://www.abacatepay.com/pricing). Isso quebraria a regra de que "só a taxa da AbacatePay se aplica" ao Profissional, a menos que a plataforma absorvesse o custo.
- **Conflito com os termos da AbacatePay:** uma das hipóteses de recusa no KYC é "a empresa exerce, total ou parcialmente, atividade de instituição de pagamento, fintech [...] ou qualquer outra atividade financeira regulada não autorizada para uso da plataforma" ([termos, §3](https://www.abacatepay.com/termos)).
- **Regulatório (fonte primária, sem parecer jurídico):** a Lei 12.865/2013, art. 6º, III, define como instituição de pagamento a PJ que, entre outras atividades, "b) executar ou facilitar a instrução de pagamento [...], inclusive transferência originada de ou destinada a conta de pagamento" e "c) gerir conta de pagamento" ([Lei 12.865/2013](https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2013/lei/l12865.htm)). O §4º exclui arranjos e instituições cujo volume não ofereça risco, com parâmetros definidos pelo BCB. **Incerteza:** não verifiquei a regulamentação do BCB sobre subcredenciadores e sobre os limites do §4º. Reter e repassar valores de terceiros é exatamente a zona que exigiria parecer jurídico. Isso é mais um motivo para descartar o modelo B.

## 3. Pix pela API

### 3.1 Criar a Cobrança
`POST https://api.abacatepay.com/v2/transparents/create`, com permissão `TRANSPARENT:CREATE` ([criar cobrança PIX](https://docs.abacatepay.com/pages/transparents/create)).

```json
{
  "method": "PIX",
  "data": {
    "amount": 15000,
    "description": "Atendimento 12/10 - limpeza de split",
    "expiresIn": 86400,
    "externalId": "atendimento_abc123",
    "metadata": { "atendimentoId": "abc123" }
  }
}
```

- **Obrigatórios:** só `method` e `data.amount`, em centavos, com mínimo de `100` (R$ 1,00) ([criar cobrança PIX](https://docs.abacatepay.com/pages/transparents/create), [conceito Pix](https://docs.abacatepay.com/pages/concepts/pix)).
- **Expiração:** "Por padrão, o QR Code PIX expira 24 horas após a criação". Pela API, `expiresIn` é dado em segundos ([conceito Pix](https://docs.abacatepay.com/pages/concepts/pix)). No OpenAPI da página, o campo aparece como `x-mint: hidden`: ele existe, mas está escondido da referência renderizada.
- **Dados do Cliente:** o `customer` é **opcional** no Pix, "se informado, todos os campos são obrigatórios": `name`, `taxId` (CPF/CNPJ válido), `email` e `cellphone` (OpenAPI de [criar cobrança PIX](https://docs.abacatepay.com/pages/transparents/create)). **Para o MVP, dá para cobrar sem o CPF do Cliente** se o `customer` for omitido. Mandar só nome e celular sem CPF não parece aceito (ver incertezas).
- **`ensureSameTaxId`** (opcional) recusa o Pix se quem paga tiver CPF/CNPJ diferente de `customer.taxId`. Depende do provedor de Pix da conta e não é aplicado em Dev mode ([criar cobrança PIX](https://docs.abacatepay.com/pages/transparents/create)). Esse campo não é necessário no caso da Tina.
- **`externalId`:** "ID no seu sistema para idempotência" (OpenAPI). Use o id do Atendimento.
- **Resposta:** `id` (`pix_char_...`), `status: "PENDING"`, `brCode` (copia-e-cola), `brCodeBase64` (PNG em data URI), `platformFee`, `expiresAt` e `devMode`. A doc recomenda usar o "`brCode` (copia e cola) para enviar por WhatsApp" ([criar cobrança PIX](https://docs.abacatepay.com/pages/transparents/create)).
- **Formato de resposta:** sempre `{ data, success, error }`. "Sempre verifique `success` antes de acessar `data`" ([introdução](https://docs.abacatepay.com/pages/reference/introduction)).

### 3.2 Status
- `GET /v2/transparents/check?id=pix_char_...`, com permissão `TRANSPARENT:READ`. Os status são `PENDING`, `PAID`, `EXPIRED` e `CANCELLED`. A doc diz: "Prefira webhooks a fazer polling" ([checar status](https://docs.abacatepay.com/pages/transparents/check)).

### 3.3 Webhooks
- **Eventos relevantes:** `transparent.completed` (no Pix chega com `status: "PAID"`), `transparent.refunded` e `transparent.disputed`. A lista completa está em [webhooks](https://docs.abacatepay.com/pages/webhooks). O schema de criação também aceita `transparent.lost` e `checkout.lost` ([criar webhook](https://docs.abacatepay.com/pages/webhooks/create)).
- **Envelope:** `{ id, event, apiVersion: 2, devMode, data }`. Em `data` vêm `transparent` (com `id`, `amount`, `platformFee`, `status` e `metadata`), `customer` (que pode ser `null`, com `taxId` mascarado) e `payerInformation.PIX` (nome e CPF mascarado de quem pagou) ([evento transparent](https://docs.abacatepay.com/pages/webhooks/events/transparent), [webhooks](https://docs.abacatepay.com/pages/webhooks)).
- **Criação por API:** `POST /v2/webhooks/create` com `name`, `endpoint` (HTTPS público), `secret` e `events[]`, e permissão `WEBHOOK:CREATE` ([criar webhook](https://docs.abacatepay.com/pages/webhooks/create)). **Com isso o app cria o webhook na conta de cada Profissional sem o Profissional precisar fazer nada.** Webhooks de Dev mode não recebem eventos de produção: é preciso criar de novo com a chave de produção ([produção](https://docs.abacatepay.com/pages/production)).
- **O envelope não traz identificador da loja ou conta.** Para saber de qual Profissional é o evento, use uma URL por Profissional (ex.: `/webhooks/abacatepay/:profissionalId`) e/ou um `secret` diferente por Profissional, além do `metadata` da Cobrança. Isso é inferência a partir do payload documentado.
- **Verificação**, com as duas camadas juntas ([segurança](https://docs.abacatepay.com/pages/webhooks/security)):
  1. `?webhookSecret=...` na query, com o valor definido na criação. É o que "prova que o evento veio da AbacatePay".
  2. Header `X-Webhook-Signature`: HMAC-SHA256 em base64 do **corpo raw**, calculado com uma **chave pública e global** publicada na doc. Por isso "a assinatura sozinha não prova origem", ela só prova integridade ([SDK Ruby, tabela](https://docs.abacatepay.com/pages/sdks/ruby)). Compare com `timingSafeEqual`.
- **Entrega:** a AbacatePay espera `2xx` em até 30s. Se não vier, ela tenta de novo em 5s, 5min, 30min, 2h, 5h e 10h (7 tentativas em cerca de 18h), sempre com o mesmo `id`, que deve ser usado para deduplicar. Respostas `5xx`, `408`, `429` e timeout geram nova tentativa. Outros `4xx` e `3xx` não geram. `410` desativa o webhook ([webhooks](https://docs.abacatepay.com/pages/webhooks#entrega-e-retentativas)).
- A doc recomenda "não realizar validação do payload inteiro" com schema rígido ([webhooks](https://docs.abacatepay.com/pages/webhooks)).

### 3.4 Reembolso
- `POST /v2/transparents/refund` com `{ id, reason? }` e permissão `REFUND:CREATE`. **O reembolso é só total.** O Pix precisa estar `COMPLETE`, e o valor é debitado do saldo `available` da loja: sem saldo, a API devolve `INSUFFICIENT_FUNDS` ([reembolso](https://docs.abacatepay.com/pages/transparents/refund)). Ou seja, se o Profissional já sacou, o reembolso pela API falha. Um segundo pedido devolve HTTP 400 "Esta cobrança já foi reembolsada.". O evento disparado é `transparent.refunded`.

### 3.5 Dev mode
- Toda conta nova começa em Dev mode, sem documentos. Os pagamentos são simulados e o saque não está disponível ([dev mode](https://docs.abacatepay.com/pages/devmode), [produção](https://docs.abacatepay.com/pages/production)).
- **Simular um Pix pago:** `POST /v2/transparents/simulate-payment?id=pix_char_...`. Funciona só com chave dev e "em produção este endpoint retorna erro" ([simular pagamento](https://docs.abacatepay.com/pages/transparents/simulate-payment), [REST README](https://github.com/AbacatePay/ecosystem/blob/main/packages/rest/README.md)). No SDK é `abacate.pix.simulate(id)`. O status `PAID` da resposta "is optimistic, the payment is processed asynchronously" ([SDK src](https://github.com/AbacatePay/ecosystem/blob/main/packages/sdk/src/v2/index.ts)).
- **Webhook local:** `abacatepay listen --forward-to http://localhost:3000/webhooks/abacatepay` encaminha os eventos com `X-Webhook-Signature`, mas **não** adiciona o `webhookSecret`, que precisa ir no `--forward-to` ([CLI webhooks](https://docs.abacatepay.com/pages/cli/webhooks), [CLI casos de uso](https://docs.abacatepay.com/pages/cli/cases)).

## 4. Taxas

| Item | Valor | Fonte |
|---|---|---|
| Receber via Pix | **R$ 0,80 fixo** por transação. Gerar QR Code não custa nada. "R\$ 100,00 [...] o Usuário recebe R\$ 99,20" | [pricing](https://www.abacatepay.com/pricing), [termos §2.2](https://www.abacatepay.com/termos) |
| Saque via Pix | R$ 0,80 cada até 20 saques no mês. A partir do 21º, R$ 2,50 cada | [pricing](https://www.abacatepay.com/pricing), [termos](https://www.abacatepay.com/termos) |
| Saque via TED | R$ 5,00 | idem |
| Saque mínimo | R$ 3,50. Limite de 1 saque por minuto (HTTP 429). Limite diário definido pela conta | [saques](https://docs.abacatepay.com/pages/concepts/saques), [payouts](https://docs.abacatepay.com/pages/payouts/reference) |
| Mensalidade / conta | Não há. "Criar conta, acessar o dashboard [...] são gratuitos" | [taxas](https://docs.abacatepay.com/pages/concepts/taxas) |
| Boleto pago | R$ 2,50. Se pago pelo Pix do boleto, R$ 0,80 | [pricing](https://www.abacatepay.com/pricing) |
| Cartão | 3,5% + R$ 0,60 à vista (D+30), com reserva de 10% do líquido no saldo bloqueado | [pricing](https://www.abacatepay.com/pricing), [termos](https://www.abacatepay.com/termos) |
| Enviar PIX (terceiros) | **Não publicado** | [Pix reference](https://docs.abacatepay.com/pages/pix/reference) remete ao pricing, que não lista esse item |

- A taxa sai do valor recebido e aparece em `platformFee`, em centavos ([taxas](https://docs.abacatepay.com/pages/concepts/taxas)). A taxa exata de cada conta fica em "Perfil → Taxas" e pode ser negociada por volume.
- Os exemplos de resposta da doc mostram `platformFee: 100` numa cobrança de R$ 100. Isso não bate com R$ 0,80 e deve ser só dado de exemplo. Confirme o valor no Dev mode e na primeira transação real.

## 5. SDK, autenticação e rate limit

| Pacote | Versão (2026-10-14) | Notas |
|---|---|---|
| `@abacatepay/sdk` | `3.0.0` (publicado em 2026-10-12) | Apache-2.0, `engines: { bun: ">=1.0.0", node: ">=18" }`. Depende de `@abacatepay/rest ^1.1.0` e `@abacatepay/types ^4.0.0` (`npm view`) |
| `@abacatepay/elysia` | `2.0.3` (2026-07-27) | Recebe webhooks no Elysia e verifica assinatura e secret. `peerDependencies: elysia ^1.4.22` ([README](https://github.com/AbacatePay/ecosystem/blob/main/packages/elysia/README.md)) |
| `@abacatepay/rest` | `1.1.0` | Cliente REST "projetado para Node.js, Bun e runtimes modernos" ([README](https://github.com/AbacatePay/ecosystem/blob/main/packages/rest/README.md)) |

- O SDK oficial está no monorepo [AbacatePay/ecosystem](https://github.com/AbacatePay/ecosystem/tree/main/packages/sdk). A doc indica `bun add @abacatepay/sdk` ([SDK Node](https://docs.abacatepay.com/pages/sdks/nodejs)). O pacote antigo `abacatepay-nodejs-sdk` (1.6.0, de 2025) é da API v1, que está em legado ([SDKs](https://docs.abacatepay.com/pages/sdks/sdks)).
- **Métodos Pix da v2:** `pix.create(body)` (envia `method: 'PIX'` por baixo), `pix.status(id)`, `pix.simulate(id)` e `pix.refund(id, reason?)`, mais `webhooks.create/list/get/delete` ([src v2](https://github.com/AbacatePay/ecosystem/blob/main/packages/sdk/src/v2/index.ts)). Nenhum método lança exceção: todos resolvem com `{ data, error, success }` ([README](https://github.com/AbacatePay/ecosystem/blob/main/packages/sdk/README.md)).
- **Atenção ao 3.0.0:** ele tem dois dias e traz breaking changes. O [CHANGELOG](https://github.com/AbacatePay/ecosystem/blob/main/packages/sdk/CHANGELOG.md) diz que várias rotas da 2.x simplesmente não funcionavam (listas só traziam a primeira página, alguns deletes falhavam com 422, `payouts.create` falhava sempre). Por isso a 2.x não é uma alternativa segura. Para o fluxo da Tina (criar Pix, consultar status, criar webhook) há duas opções: fixar `@abacatepay/sdk@3.0.0` ou chamar a API REST direto (são 3 ou 4 rotas). O `@abacatepay/elysia@2.0.3` é anterior a `@abacatepay/types@4.0.0` e valida o payload, o que vai contra a recomendação da própria doc de não validar o payload inteiro. Avalie se uma verificação manual (secret + HMAC, ~15 linhas) não é mais segura.
- **Autenticação:** `Authorization: Bearer <chave>`. O erro 401 indica chave ausente ou inválida. O 403 `Insufficient permissions` indica que falta a permissão da rota ([introdução](https://docs.abacatepay.com/pages/reference/introduction)). A chave fica só no backend e nunca vai para o app ([SDKs](https://docs.abacatepay.com/pages/sdks/sdks)).
- **Retries do SDK/REST:** `GET` é repetido em timeout, 408, 425, 429 e 5xx. `POST` é repetido **só em 429**, "que a API responde antes de executar a requisição". O timeout padrão é 30s ([REST README](https://github.com/AbacatePay/ecosystem/blob/main/packages/rest/README.md)).
- **Rate limit:** a API responde 429 ([introdução](https://docs.abacatepay.com/pages/reference/introduction)), mas **não publica números**. A única exceção documentada é o saque: 1 por minuto ([payouts](https://docs.abacatepay.com/pages/payouts/reference)).

## 6. Copia-e-cola no WhatsApp (só o formato)

- O `brCode` é a string EMV do Pix (começa com `000201` e contém `BR.GOV.BCB.PIX`) e deve ser enviada como texto puro. A doc indica explicitamente o `brCode` para WhatsApp ([criar cobrança PIX](https://docs.abacatepay.com/pages/transparents/create)). O `brCodeBase64` é um `data:image/png;base64,...`: para mandar como imagem é preciso decodificar e subir a mídia.
- **O tamanho não está documentado.** O exemplo completo da doc (o Pix alternativo do boleto) tem 138 caracteres ([checkout transparente](https://docs.abacatepay.com/pages/transparents/reference)), mas o tamanho varia com o provedor e o nome do recebedor. Meça no Dev mode e compare com o limite do botão de copiar código, que está em `docs/research/whatsapp.md`.

## Onboarding do Profissional

Fluxo atual (modelo A), montado a partir das fontes:

| # | Passo | Onde | Fonte |
|---|---|---|---|
| 1 | Criar conta em app.abacatepay.com ("leva poucos minutos") | Web | [primeiro pagamento](https://docs.abacatepay.com/pages/guides/primeiro-pagamento) |
| 2 | Sair do Dev mode e preencher o cadastro: CNPJ, **site da empresa** (contato, termos, privacidade, CNPJ no rodapé), endereço, descrição do negócio, dados do sócio (celular confirmado por código, data de nascimento, nome da mãe), aceite dos termos | Dashboard web | [produção](https://docs.abacatepay.com/pages/production), [termos §2.2](https://www.abacatepay.com/termos) |
| 3 | Enviar documentos se forem pedidos: RG/CNH frente e verso, **selfie**, contrato social; validação da titularidade da conta bancária | Dashboard web | [termos §2.2 e §3](https://www.abacatepay.com/termos) |
| 4 | Esperar a análise: **até 3 dias úteis** | — | [produção](https://docs.abacatepay.com/pages/production), [para apps](https://www.abacatepay.com/para/apps) |
| 5 | Criar a chave de produção ("Integração → API Keys → Criar Chave") com as permissões certas e **copiar e colar no app** | Dashboard web | [autenticação](https://docs.abacatepay.com/pages/authentication), [produção](https://docs.abacatepay.com/pages/production) |
| 6 | O app cria o webhook na conta via API (sem ação do Profissional) | Backend | [criar webhook](https://docs.abacatepay.com/pages/webhooks/create) |

- **São cerca de 5 passos do Profissional e não é "poucos toques".** Não encontrei app nativo da AbacatePay nas lojas. O dashboard é web e pode ser aberto no navegador do celular, mas não confirmei se ele funciona bem em mobile. A doc só mostra telas de desktop.
- **O requisito de site é o principal bloqueio para o público da Acme** (técnicos, eletricistas, diaristas MEI). Muitos não têm site. A KYC também cruza a atividade com "site, redes sociais ou outras fontes públicas" ([termos §3](https://www.abacatepay.com/termos)).
- **O passo 5 contraria o critério "sem copiar chave".** Ele só sai da lista se a AbacatePay liberar para terceiros um fluxo de aprovação como o da CLI (§1.3).
- O Dev mode fica disponível na hora, sem documentos. O Profissional poderia ver a Tina "funcionando" em modo teste enquanto a análise corre.

## Pontos em aberto / incertezas

1. **OAuth / "Conectar com AbacatePay":** não existe publicamente. Precisa perguntar à AbacatePay se um app de terceiros pode usar o device flow da CLI (`/app/oauth/cli/*`, não documentado) ou se há um OAuth de parceiros previsto, com escopos equivalentes às permissões de chave.
2. **Split:** está "em desenvolvimento", sem data nem desenho de onboarding de recebedor. Também não se sabe se o recebedor precisará fazer KYC completo, com site.
3. **Requisito de site para MEI prestador de serviço local:** não encontrei exceção documentada. Perguntar se perfil de Instagram ou Google Business é aceito.
4. **Entregar a chave de API a um software de terceiros:** os termos não proíbem nem preveem. Confirmar por escrito que isso é permitido.
5. **Multi Lojas:** não está documentado se um membro convidado pode criar chaves de API ou se esse recurso serve para uma plataforma.
6. **`customer` parcial no Pix:** pelo OpenAPI, se informado, exige `name`, `taxId`, `email` e `cellphone`. Testar no Dev mode se nome e celular sem CPF são rejeitados.
7. **`expiresIn`:** o campo funciona, mas está escondido na referência. Não há máximo documentado.
8. **Rate limits:** não são publicados, exceto o do saque.
9. **Taxa do Enviar PIX:** não é publicada. Só importa para o modelo B, que foi descartado.
10. **Regulação BCB de subcredenciamento e repasse:** não verifiquei normas do BCB além da Lei 12.865/2013. Fica como risco qualitativo do modelo B, sem parecer jurídico.
11. **`@abacatepay/sdk@3.0.0`:** tem dois dias e traz breaking changes, e a 2.x tinha rotas quebradas. Considerar REST direto para as poucas rotas usadas.
12. **Tamanho do `brCode`:** não está documentado. Medir no Dev mode.
13. **Disputas MED:** um Pix contestado pelo Cliente pode ser devolvido por decisão da Instituição Parceira ([termos §9](https://www.abacatepay.com/termos)). A Tina precisaria tratar `transparent.disputed`.
