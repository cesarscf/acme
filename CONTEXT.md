# Acme

App de assistentes de IA que cuidam do trabalho de escritório de quem presta serviço na casa ou empresa do cliente (agenda, orçamentos, cobrança), tudo por conversa no celular.

Os termos do domínio ficam em inglês (são os nomes usados no código e nas docs); entre parênteses, o rótulo que aparece na UI em pt-BR.

## Language

### Pessoas

**Professional** (Profissional):
Quem presta o serviço e usa o app; dono do Team de Assistants.
_Avoid_: User, técnico, prestador

**Customer** (Cliente):
Pessoa ou empresa que recebe o serviço do Professional. Nunca usa o app; fala com o Professional só pelo WhatsApp.
_Avoid_: Client, consumidor, contato

**WorkStyle** (Perfil):
Como o Professional trabalha: `solo` (Solo), `with_helper` (Com ajudante) ou `with_crew` (Com equipe). Define o Team sugerido.

**Trade** (Especialidade):
O tipo de serviço que o Professional faz (climatização, elétrica, limpeza…).
_Avoid_: Segment, category, especialidade

**Crew** (Equipe, no sentido de pessoas):
As pessoas que trabalham com o Professional (ajudantes, funcionários). Não confundir com o Team.
_Avoid_: Staff, team

### Assistants

**Assistant** (Assistente):
Um membro do Team com nome, mascote e uma função fixa (Agenda, Orçamentos, Cobrança…).
_Avoid_: Agent, bot, IA

**Team** (Equipe, no sentido de assistentes):
O conjunto de Assistants que o Professional escolheu.
_Avoid_: Crew, squad

**Briefing** (Combinar a função):
A conversa curta, em 5 passos, em que o Professional diz ao Assistant como ele deve trabalhar. Termina num Playbook aprovado.
_Avoid_: Setup, configuration, onboarding do assistente

**Playbook** (Ficha):
O resumo de como um Assistant trabalha, com os campos O que faz, Onde, Quando, Sozinho e Entrega. Fica em rascunho até o Professional aprovar.
_Avoid_: Configuration, settings, perfil do assistente

**Routine** (Rotina):
Uma tarefa que o Assistant faz sozinho num horário combinado no Playbook (ex.: confirmações na véspera, às 18h).
_Avoid_: Job, schedule, automation

### Trabalho

**Visit** (Visita):
Uma ida marcada à casa ou empresa de um Customer, num dia e horário.
_Avoid_: Appointment, booking, agendamento

**WorkRecord** (Atendimento):
O registro do que foi feito numa Visit (o que fez, material usado, como o Customer pagou). É o que vira Charge.
_Avoid_: Job, service, OS, ordem de serviço

**PriceItem** (Serviço):
Um item da tabela de preços do Professional, usado para montar Quotes.
_Avoid_: Service, product, item

**Quote** (Orçamento):
Proposta de preço enviada ao Customer, com validade, que ele aprova ou não.
_Avoid_: Estimate, proposal, cotação

**Charge** (Cobrança):
O pedido de pagamento de um WorkRecord ao Customer, por um dos PaymentMethods do Professional.
_Avoid_: Invoice, bill, fatura, boleto

**PaymentMethod** (Forma de recebimento):
Um jeito de o Professional receber do Customer (chave Pix, dinheiro, banco conectado…), combinado no Briefing da Tina.
_Avoid_: Payment option, meio de pagamento
