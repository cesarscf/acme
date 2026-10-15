# Pesquisa: transcrição de áudio (pt-BR) para os áudios do Professional

> Pesquisa feita em 2026-10-15 só com fontes primárias (docs, páginas de preço e model cards oficiais). Contexto: áudios de 5–60 s, em pt-BR, gravados em ambiente com ruído, transcritos antes de chegar ao Assistant.

## TL;DR / recomendação

- **Opção principal: `openai/whisper-large-v3-turbo` via OpenRouter, com `provider: { zdr: true }`.** Custa cerca de US$ 0,0002–0,0007/min, de 10 a 20 vezes menos que as outras opções. Os dois provedores que servem o modelo (DeepInfra e Groq) estão na lista ZDR do OpenRouter. Riscos: alucinações e repetições, que o model card reconhece, e possível queda de qualidade com ruído.
- **Fallback de qualidade: `gpt-4o-mini-transcribe` direto na OpenAI** (US$ 0,003/min). Não treina com os dados, a retenção para abuso é "None" e a OpenAI diz que ele alucina menos em ruído. A alternativa é o Deepgram Nova-3 com `pt-BR` e `mip_opt_out=true`.
- **Evitar o ElevenLabs direto:** treina por padrão, e o Zero Retention é só no plano Enterprise. Se o Scribe v2 se sair melhor nos testes, dá para usá-lo via OpenRouter com ZDR.
- **Nenhuma das opções publica WER oficial para pt-BR.** A escolha final depende de medir com 30 a 50 áudios reais de Professionals.

## Comparação

| | Whisper v3 Turbo via OpenRouter | Deepgram Nova-3 direto | ElevenLabs Scribe v2 direto | OpenAI direto |
|---|---|---|---|---|
| Preço/min | DeepInfra ≈ US$ 0,0002; Groq ≈ US$ 0,00067 [A] | US$ 0,0043 (mono) [B] | ≈ US$ 0,0037 [C] | gpt-4o-transcribe US$ 0,006; mini US$ 0,003; gpt-transcribe US$ 0,0045 [D] |
| pt-BR | `language: "pt"` [E] | `pt-BR` [F] | faixa "≤5% WER" [G] | parâmetro `language` [H] |
| WER pt publicado | nenhum oficial [I][J] | nenhum [K] | só do Scribe v1 (FLEURS pt 2,3%, número do próprio vendor) [L] | nenhum oficial [M] |
| Retenção e treino | OpenRouter não retém sem opt-in [N]; DeepInfra não grava nem treina [O]; Groq pode guardar logs até 30 dias, com ZDR disponível [P] | participa do programa de melhoria por padrão; opt-out com `mip_opt_out=true` [Q] | treina por padrão; Zero Retention só no Enterprise [R] | não treina; retenção "None"; elegível a ZDR [S] |
| Limites | 25 MB via multipart; timeout upstream de 60 s [E] | 2 GB; 10 min [U] | 3–5 GB; até 10 h [G][V] | 25 MB [H] |
| Chamada | `POST https://openrouter.ai/api/v1/audio/transcriptions` (JSON com `input_audio` em base64 ou multipart compatível com OpenAI); resposta `{text, usage:{seconds,cost}}` [E][X] | `POST https://api.deepgram.com/v1/listen?model=nova-3&language=pt-BR&smart_format=true&mip_opt_out=true`, header `Authorization: Token …` [U][Q] | `POST https://api.elevenlabs.io/v1/speech-to-text` multipart, header `xi-api-key` [V] | `POST /v1/audio/transcriptions` [H] |

No Bun, `fetch`, `FormData` e `Bun.file()` cobrem todas as opções sem SDK.

## Pontos em aberto / incertezas

1. Não há WER oficial para pt-BR em nenhuma das opções.
2. A API do OpenRouter não declara a unidade do preço; "por segundo" foi deduzido da página do modelo. Não está claro se o mínimo de 10 s por requisição da Groq vale via OpenRouter.
3. A página de ZDR do OpenRouter fala em "inference requests" sem citar áudio, mas a doc de STT documenta `provider.zdr` nesse endpoint. A lista ZDR muda, então é preciso revalidar.
4. A doc de dados da Groq não diz explicitamente se ela treina com dados da API.
5. Deepgram: não está claro se o opt-out muda o preço, nem qual é o prazo padrão de retenção.

## Fontes

- [A] https://openrouter.ai/openai/whisper-large-v3-turbo/providers
- [B] https://deepgram.com/pricing
- [C] https://elevenlabs.io/pricing/api
- [D] https://developers.openai.com/api/docs/pricing
- [E] https://openrouter.ai/docs/guides/overview/multimodal/stt
- [F] https://developers.deepgram.com/docs/models-languages-overview
- [G] https://elevenlabs.io/docs/overview/capabilities/speech-to-text
- [H] https://developers.openai.com/api/docs/guides/speech-to-text
- [I] https://console.groq.com/docs/speech-to-text
- [J] https://huggingface.co/openai/whisper-large-v3-turbo
- [K] https://deepgram.com/learn/introducing-nova-3-speech-to-text-api
- [L] https://elevenlabs.io/speech-to-text/portuguese
- [M] https://developers.openai.com/blog/updates-audio-models
- [N] https://openrouter.ai/docs/guides/features/zdr
- [O] https://docs.deepinfra.com/account/data-privacy
- [P] https://console.groq.com/docs/your-data
- [Q] https://developers.deepgram.com/docs/the-deepgram-model-improvement-partnership-program
- [R] https://elevenlabs.io/docs/eleven-api/resources/zero-retention-mode
- [S] https://developers.openai.com/api/docs/guides/your-data
- [T] https://openrouter.ai/api/v1/endpoints/zdr
- [U] https://developers.deepgram.com/docs/pre-recorded-audio
- [V] https://elevenlabs.io/docs/api-reference/speech-to-text/convert
- [W] https://elevenlabs.io/docs/overview/models
- [X] https://openrouter.ai/docs/api/api-reference/stt/create-transcription
