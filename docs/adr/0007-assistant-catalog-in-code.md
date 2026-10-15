# Catalog de Assistants no código, não numa tabela com seed

O Catalog (um Role por entrada, com nome e mascote padrão, roteiro do Briefing, tools e system prompt) é uma constante no código da API. No banco só existe o Assistant de cada Professional: uma linha com o `role`, o `name` (copiado do Catalog e renomeável) e o Playbook. Descartamos uma tabela de Catalog com seed porque tools e prompts já são código: manter as duas coisas em sincronia a cada deploy, e mudar um prompt por migração de dados, custaria mais do que ganha.

## Consequences

- Os Assistants pré-configurados (Lia, Olga, Tina) e um Assistant criado do zero têm o mesmo formato no banco; o criado do zero usa `role: 'custom'`, com uma entrada genérica no Catalog.
- Mudar um prompt ou uma tool vale para todos os Professionals no próximo deploy; não há versão de prompt por Professional.
