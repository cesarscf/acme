# Fluxo de onboarding e criação de assistentes

> Baseado no app do Salte Workers (vídeos de 07/10/2026), adaptado para o prestador de serviço do [PITCH.md](PITCH.md).
> As telas de referência estão em [`docs/referencia-salte/`](docs/referencia-salte/), numeradas na ordem do fluxo.

---

## Os princípios que fazem o fluxo do Salte parecer fácil

1. **Valor antes de cadastro.** O usuário escolhe a equipe e vê os assistentes na tela inicial *antes* de criar conta. O cadastro aparece como uma folha que pode ser fechada ("Agora não").
2. **Formulário só para o mínimo.** São 3 telas curtas antes da equipe. Todo o resto é combinado na conversa com cada assistente.
3. **Toda pergunta tem resposta pronta.** Opções A, B, C, D e "Outro", mais o campo livre "Responda aqui ou escolha uma opção acima". O usuário quase não digita.
4. **O assistente explica o porquê.** Antes da próxima pergunta, ele comenta a resposta anterior: *"Mandando cedo, dá tempo de encaixar alguém no lugar de quem desmarcar."*
5. **O progresso fica sempre visível.** Acima do campo de texto aparece "Combinando a função de Otto · 2 de 5".
6. **Nada se perde ao pular.** Se o usuário toca em "Agora não" em "Conecte para eu começar", o assistente responde *"Tudo bem, conecto depois. Enquanto isso, vamos combinar o resto."*
7. **Termina com uma ficha que ele confere.** É um resumo estruturado com os botões "Ajustar" e "Está certo", e o aviso "Dá para mudar depois, é só falar".
8. **Toda ação pode ser desfeita.** Aparece uma linha de sistema "Rotina criada: Confirmações, dias úteis às 10h · **Desfazer**".
9. **O status é sempre claro.** O cabeçalho mostra "Esperando você", "Trabalhando…" ou a função do assistente. O avatar anima enquanto ele está "Pensando".

---

## Parte 1: Onboarding (antes da conta)

### Tela 1 · Boas-vindas
*Ref.: `01-boas-vindas.jpg`*

- Foto de fundo de um profissional no trabalho (no nosso caso, um técnico na rua com o celular na mão). Os mascotes dos assistentes flutuam em volta e um deles "fala" (balãozinho).
- Logo, título e subtítulo:
  - **"Uma equipe que cuida do escritório enquanto você trabalha."**
  - "Assistentes de IA para a rotina do seu serviço. Grátis para começar."
- Botões **Começar** (principal) e **Já tenho conta** (secundário).

### Tela 2 · Quem é você
*Ref.: `02-como-quer-ser-chamado.jpg`, `03-especialidade.jpg`*

- **"Como quer ser chamado?"** com o exemplo "Ex.: Carlos da Refrigeração".
- Abaixo, um seletor **"O que você faz"**. Ele abre uma folha com busca e várias opções marcáveis: Climatização e refrigeração, Elétrica, Hidráulica, Manutenção e reformas, Dedetização, Limpeza, Jardinagem e piscinas, Instalação (câmeras, antenas, internet, solar), Assistência técnica, Outro.
- Botão **Continuar**.

### Tela 3 · Como você trabalha
*Ref.: `04-sistemas.jpg`. No Salte essa tela pergunta "Quais sistemas você usa?". No nosso caso o perfil importa mais, porque é ele que define a equipe sugerida.*

- **"Como você trabalha hoje?"**
- Três cartões grandes, com uma ilustração cada:
  - **Sozinho**: "Eu faço tudo"
  - **Com ajudante**: "Eu e mais 1 ou 2"
  - **Com equipe**: "3 ou mais pessoas em campo"
- Opcional na mesma tela, com marcação múltipla: **"Por onde chegam os pedidos?"** (WhatsApp, ligação, Instagram, indicação, site).
- Botões **Continuar** e **Pular**.

### Tela 4 · Monte sua equipe
*Ref.: `05-monte-sua-equipe.jpg`*

- **"Monte sua equipe."** com o subtítulo "Assistentes fazem as tarefas do escritório por você."
- Grade de 2 colunas. Cada cartão tem o mascote, o **nome** e a **função numa frase curta**, com um verbo (como "Confirma consultas" ou "Cobra os atrasados" no Salte):

  | Assistente | Frase no cartão |
  |---|---|
  | Lia | Marca as visitas |
  | Olga | Faz os orçamentos |
  | Tina | Cobra no Pix |
  | Beto | Monta a rota do dia |
  | Edu | Cuida do material |
  | Nina | Emite as notas |
  | Duda | Chama o cliente de volta |
  | Fábio | Mostra quanto sobrou |
  | Gil | Organiza a equipe |

- **Diferença em relação ao Salte:** lá só um vem marcado. Aqui, os recomendados para o perfil da Tela 3 já vêm marcados, com um selo "Recomendado".
- Botão **Continuar** e o link **+ Criar o meu próprio**.
- No beta, o catálogo mostra só os 3 ou 4 assistentes que existem. Os outros podem aparecer como "Em breve" (pergunta em aberto).

### Tela 5 · Pronto
*Ref.: `06-pronto.jpg`*

- Os mascotes escolhidos se espalham pela tela, numa transição com animação.
- **"Pronto, Carlos!"** e "Agora é só combinar o trabalho conversando com cada um no chat."
- Botão **Começar**.

### Tela 6 · Início, com tour rápido
*Ref.: `07-coach-marks.jpg`*

- É uma lista de conversas no estilo WhatsApp, uma por assistente. Todas começam com o texto azul **"Combine comigo para eu começar"** e uma bolinha de não lido.
- O primeiro da lista tem o selo **"Próximo"**, que diz ao usuário por onde começar.
- Fixa no fim da lista fica a conversa oficial do app (equivalente ao "Salte ✓"), com novidades e avisos da conta.
- Dois balões de tour, com o botão "Próximo":
  1. "**Seus assistentes.** Toque em um e conte o que ele deve fazer. Ele aprende com você, no chat."
  2. "**Novidades.** Aqui chegam as novidades do app e os avisos da sua conta."
- Cabeçalho com "Olá, Carlos", avatar com as iniciais, busca e **+** (novo assistente).
- Botão flutuante embaixo, a ação principal do dia a dia. No Salte é "Iniciar consulta". Aqui seria **"Registrar serviço"**, com microfone (ver Parte 4).

### Folha · Criar conta (adiada)
*Ref.: `08-crie-sua-conta.jpg`*

- Aparece por cima da tela inicial, depois que o usuário já viu a equipe.
- **"Crie sua conta, Carlos."** e "É grátis, e sua equipe e as conversas ficam guardadas."
- O pitch diz "entra com o telefone, sem senha", então a ordem dos botões fica: **Continuar com WhatsApp** (código por WhatsApp ou SMS), **Continuar com a Apple**, **Continuar com o Google**.
- Link **Agora não** e, em letra miúda, "Ao continuar, você aceita os Termos e a Privacidade".

---

## Parte 2: Combinar a função de um assistente (o coração do produto)

### Estrutura que o Salte usa (sempre 5 passos)

| Passo | O que acontece | Vira o campo da ficha |
|---|---|---|
| 1 | **Conecte para eu começar**: cartão com as integrações, cada uma com o motivo ("Ler a agenda e os telefones"), e o link "Agora não" | Onde |
| 2 | **De onde vem a informação** (se não conectou) | Onde |
| 3 | **Quando fazer**: as opções viram rotina ("Na véspera, às 10h · Vira uma rotina minha") ou não ("Só quando alguém pedir · Sem rotina") | Quando |
| 4 | **O que fazer na exceção**: é aqui que se define a autonomia ("Ofereça os horários livres e remarque" / "Me pergunte antes" / …) | Sozinho |
| 5 | **O que te entregar no fim** ("Só quem não respondeu" / "O resumo de tudo" / "Por e-mail") | Entrega |

O mesmo esqueleto (O que faz, Onde, Quando, Sozinho, Entrega) serve para qualquer assistente, inclusive os que o usuário criar no futuro. **Esse é o modelo de dados do assistente.**

### Anatomia da conversa
*Ref.: `09` a `15`*

1. Divisor de sistema: "Hoje, 10:27 · **Lia** nasceu neste chat".
2. Saudação com a função em uma frase: *"Bom dia, Carlos! Sou a Lia. Vou marcar as suas visitas e confirmar com os clientes. Você só aprova."*
3. Cartão **"Conecte para eu começar"**, com uma linha por integração (ícone, nome e o motivo).
4. Pergunta em cartão com opções A, B, C, D, sempre com "Outro". O campo de texto muda o texto de exemplo para "Responda aqui ou escolha uma opção acima".
5. Faixa de progresso acima do campo de texto: "Combinando a função de Lia · 2 de 5". No último passo ela vira "Tudo combinado. Confere a ficha…".
6. Comentário com o motivo, e só então a próxima pergunta.
7. **Ficha (Rascunho)** com a lista de campos, o aviso "Dá para mudar depois, é só falar" e os botões **Ajustar** e **Está certo**.
8. Depois de aprovada, o selo "Rascunho" vira **Ver ficha**. Aparece a linha de sistema "Rotina criada: … · Desfazer", e a mensagem final *"Pronto! A partir de agora eu cuido disso. A primeira vez é amanhã, 10:00."*
9. O cabeçalho passa a mostrar a função ("Lia · Agenda") em vez de "Esperando você". Na tela inicial, a última mensagem dela aparece no lugar de "Combine comigo…".

### Folha de consentimento (LGPD)
*Ref.: `16-consentimento-ia.jpg`*

Aparece na primeira tarefa real, não no cadastro. O título é **"Usar IA nas tarefas?"** e a folha explica: os assistentes usam IA de terceiros, e os dados (inclusive de clientes) podem ser processados fora do Brasil. Tem o link "Ver detalhes" e o botão **Permitir**.

---

## Parte 3: Roteiro das perguntas para os assistentes do beta

### Lia · Agenda
- **Conecte:** WhatsApp ("Ler os pedidos e mandar as confirmações") e Google Agenda ("Se a sua agenda fica lá").
- **Onde fica sua agenda hoje?** Google Agenda / Caderno ou papel / Na cabeça / Outro
- **Quais dias e horários você atende?** Seg a sex, 8h às 18h / Seg a sáb, 8h às 12h no sábado / Outro
- **Para onde você vai?** "Me diga os bairros ou a cidade, ou mande a localização" (resposta livre, com chips das cidades mais próximas)
- **Quando o cliente pedir horário:** Ofereça os horários livres e marque / Me pergunte antes de marcar / Outro
- **Confirmações:** Na véspera, às 18h · Vira uma rotina minha / No dia, às 7h / Só quando eu pedir

### Olga · Orçamentos
- **Conecte:** WhatsApp ("Mandar o link do orçamento"). Também oferece "Mande uma foto da sua tabela de preços".
- **Você tem tabela de preços?** Tenho, vou mandar foto / Tenho, vou digitar / Não, cobro por serviço / Outro
- **Como cobra a visita técnica?** Grátis / Valor fixo / Desconto se fechar / Outro
- **Quanto tempo o orçamento vale?** 7 dias / 15 dias / 30 dias / Outro
- **Se o cliente não responder:** Lembro em 2 dias, sozinho / Te aviso e você decide / Não faço nada

### Tina · Cobrança
- **Conecte:** chave Pix ou conta ("Gerar o Pix e ver quando o dinheiro caiu").
- **Quando cobrar?** Assim que eu marcar o serviço como feito / No fim do dia, de tudo / Só quando eu pedir
- **Aceita como?** Só Pix / Pix e cartão / Pix e dinheiro / Outro
- **Se atrasar:** Lembrete educado em 3 dias, sozinho / Me pergunte antes de cobrar / Nunca cobre sozinho
- **O que te entregar:** Aviso a cada pagamento / Resumo do dia às 19h / Só quem está devendo

---

## Parte 4: Dia a dia (depois de combinado)

### Uma conversa por assistente, com o cabeçalho de status
- Cabeçalho: voltar, mascote, nome e status (**Esperando você** / **Trabalhando…** / função), e à direita o botão "ver o que ele está fazendo".
- Enquanto trabalha: o avatar anima com "Pensando", o campo de texto mostra "Escreva uma correção ou o próximo pedido" e o botão de enviar vira **parar**.
- Ao terminar: aparece "Trabalhou por 7s ›", que se expande para mostrar os passos.

### `@` para ver dados sem painel
*Ref.: `17` a `20`*

- Ao digitar `@` abre um menu com **Recentes** ("Agenda · de amanhã", "Faturamento · últimos 30 dias"), **Assistentes** e **Atalhos** ("Resumo do dia").
- A resposta vem como um **widget dentro do chat**, com título, filtro, abas Lista/Dia/Semana ou Gráfico/Tabela, botão de expandir para tela cheia e uma ação principal no rodapé ("Confirmar as 11", "Ver todas as 43").
- Tocar numa linha abre uma folha de ações: **Remarcar**, **Ver ficha** e **Perguntar sobre isto**.
- Selos de status nas linhas: Não enviado (cinza), Sem resposta (amarelo), Enviado ontem (azul).
- Atalhos sugeridos para nós: `@agenda`, `@rota`, `@orçamentos`, `@cobranças`, `@caixa`, `@cliente`, `@estoque`.

### Cartão de confirmação para ações sensíveis
*Ref.: `26-card-confirmacao.jpg`, `27-resultado-com-acao.jpg`, `28-sheet-assinatura.jpg`*

- **"Para confirmar: cobrar R$ 350 do João"**, com uma lista de campos (Cliente, Serviço, Valor, Forma, Envio).
- Linhas de **Aviso** em texto simples: *"Nada é enviado ao cliente agora. Depois de aprovado, ele recebe o link do Pix no WhatsApp."*
- Pergunta final com opções: **"Confirma: cobrar o João?"**, com A Confirmar e B Cancelar.
- O resultado vem com um botão de ação principal (no Salte, "Assinar documento") e o arquivo anexado (PDF do orçamento, recibo, nota).
- Vale para: enviar mensagem a cliente, cobrar, emitir nota, cancelar e remarcar, a não ser que a ficha diga "Sozinho".

### A ação principal fixa: "Registrar serviço"
*Ref.: `22` a `24`. O equivalente no Salte é "Iniciar consulta".*

- Aba **Serviços** ao lado de **Assistentes**, com um estado vazio que explica o recurso: "Toque em Registrar serviço quando terminar uma visita. Eu preparo a cobrança, a baixa do material e o retorno."
- O botão flutuante abre a gravação: o técnico fala o que fez ("troquei o capacitor, usei 2 metros de cobre, cliente pagou no Pix").
- O resultado mostra o resumo e chips de próximos passos: **Cobrar no Pix**, **Baixar material**, **Agendar retorno**, **Emitir nota**.
- É o "momento mágico" do pitch, feito em um toque.

### Limite do plano grátis
*Ref.: `25-limite-creditos.jpg`*

Uma faixa discreta acima do campo de texto: "Restam 4 tarefas hoje · O limite volta à meia-noite", com o botão **Ver planos**.

---

## Sistema visual (o que copiar do Salte)

- **Mascotes** 3D, com formas simples e só olhos, um por cor. Funcionam como avatar em todos os tamanhos (lista, cabeçalho, divisor "nasceu neste chat", menu do `@`).
- Fundo claro e neutro, **um único azul** para ações, cartões brancos com cantos bem arredondados e sombra leve.
- **Folhas que sobem de baixo** para tudo que é escolha ou confirmação (especialidade, conta, consentimento, ações de uma linha). Nunca uma tela nova para isso.
- Mensagens do assistente sem balão (texto direto), as do usuário em balão à direita, e linhas de sistema centralizadas, pequenas e cinza.
- O campo de texto é sempre o mesmo: anexo, `@`, microfone e enviar ou parar.

---

## Decisões que este fluxo pede

1. **Nome x conflito:** o Salte já usa "Nina", "Mia" e "Otto". Se os personagens ficarem, vale evitar nomes iguais.
2. **Renomear:** o usuário pode trocar o nome, a cor e o formato do assistente pronto? (O Salte permite isso só no "Criar o meu próprio".)
3. **Catálogo no beta:** mostrar os "Em breve" na Tela 4 ou só os disponíveis?
4. **Conta:** o cadastro pode mesmo ser adiado? Integrações como WhatsApp e Pix vão exigir conta antes do passo "Conecte".
