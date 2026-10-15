# Pix pela chave do próprio Professional, sem PSP no MVP

No MVP a Charge por Pix usa a chave Pix que o Professional já tem no banco dele: geramos o código copia-e-cola com o valor e um identificador, e o dinheiro cai direto na conta dele, sem PSP no meio. Descartamos Woovi (afiliado) e AbacatePay porque os dois exigem CNPJ e um cadastro a mais do Professional, e a AbacatePay ainda pede um site e a cópia de uma chave de API. O custo da escolha é que ninguém confirma o pagamento automaticamente: o Customer toca em "Já paguei" e o Professional confirma no app que o dinheiro caiu.

## Consequences

- A Charge tem um estado intermediário, "aguardando confirmação", entre enviada e paga.
- Uma chave digitada errada manda o dinheiro para outra pessoa; o Briefing da Tina mostra a chave de volta e pede confirmação.
- "Conectar banco" aparece no app como "em breve"; quando existir, ele traz a confirmação automática e não substitui a chave Pix.
