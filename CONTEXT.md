# Acme

App de assistentes de IA que cuidam do trabalho de escritório de quem presta serviço na casa ou empresa do cliente (agenda, orçamentos, cobrança), tudo por conversa no celular.

## Pessoas

**Profissional**:
Quem presta o serviço e usa o app; dono da Equipe de assistentes.
_Avoid_: Usuário, técnico, prestador

**Cliente**:
Pessoa ou empresa que recebe o serviço do Profissional. Nunca usa o app.
_Avoid_: Consumidor, contato

**Perfil**:
Como o Profissional trabalha: Solo, Com ajudante ou Com equipe. Define a Equipe sugerida.

**Especialidade**:
O tipo de serviço que o Profissional faz (climatização, elétrica, limpeza…).
_Avoid_: Segmento, categoria

## Assistentes

**Assistente**:
Um membro da Equipe com nome, mascote e uma função fixa (Agenda, Orçamentos, Cobrança…).
_Avoid_: Agente, bot, IA

**Equipe**:
O conjunto de Assistentes que o Profissional escolheu.

**Combinar a função**:
A conversa curta, em 5 passos, em que o Profissional diz ao Assistente como ele deve trabalhar. Termina numa Ficha aprovada.
_Avoid_: Configurar, setup, onboarding do assistente

**Ficha**:
O resumo de como um Assistente trabalha, com os campos O que faz, Onde, Quando, Sozinho e Entrega. Fica em Rascunho até o Profissional aprovar.
_Avoid_: Configuração, perfil do assistente

**Rotina**:
Uma tarefa que o Assistente faz sozinho num horário combinado na Ficha (ex.: confirmações na véspera, às 18h).
_Avoid_: Job, agendamento, automação

## Trabalho

**Visita**:
Uma ida marcada à casa ou empresa de um Cliente, num dia e horário.
_Avoid_: Agendamento, compromisso

**Atendimento**:
O registro do que foi feito numa Visita (o que fez, material usado, como o Cliente pagou). É o que vira Cobrança.
_Avoid_: Serviço, serviço realizado, OS

**Serviço**:
Um item da tabela de preços do Profissional, usado para montar Orçamentos.
_Avoid_: Produto, item

**Orçamento**:
Proposta de preço enviada ao Cliente, com validade, que ele aprova ou não.
_Avoid_: Cotação, proposta

**Cobrança**:
O pedido de pagamento de um Atendimento ao Cliente, normalmente por Pix.
_Avoid_: Fatura, boleto, invoice
