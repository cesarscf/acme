# Pesquisa: setup técnico do MVP (Turborepo + Bun + Elysia + Expo + Postgres)

> Pesquisa feita em 2026-10-14 só com fontes primárias: docs oficiais, repositórios oficiais no GitHub, o registry do npm (`npm view`) e o Docker Hub. As versões citadas são as `latest` do npm nessa data.

## TL;DR / recomendação

| Peça | Escolha | Versão (2026-10-14) |
|---|---|---|
| Bun | runtime + package manager + workspaces | `1.4.3` ([release](https://github.com/oven-sh/bun/releases/tag/bun-v1.4.3)) |
| Turborepo | `turbo` | `2.11.8` (npm `latest`) |
| Expo SDK | **57** (estável). O SDK 58 está em beta desde 15/09 | `expo@57.0.29`, `react-native@0.86.3`, `react@19.2.3`, `expo-router@57.0.27`, `typescript@~6.0.3` |
| Tailwind no mobile | **NativeWind 4.2.7 + Tailwind v3** (estável). A alternativa com Tailwind v4 é o Uniwind 1.12.2 | `nativewind@4.2.7`, `tailwindcss@^3.4.17` |
| API | Elysia 1.4 (estável). O 2.0 está em beta | `elysia@1.4.30`, `@elysia/eden@1.4.10`, `@elysia/openapi@1.4.16`, `@elysia/cors@1.4.2` |
| ORM | Drizzle **0.45 (estável)**, não o `@rc` que as docs mostram | `drizzle-orm@0.45.4`, `drizzle-kit@0.31.11`, `drizzle-typebox@0.3.3` |
| Driver Postgres | `postgres` (postgres.js), por causa dos bugs abertos no driver Bun SQL | `postgres@3.4.9` |
| Postgres local | Docker `postgres:18` | `18.6` |
| Auth | Better Auth com o plugin Expo (há página oficial de integração no Elysia) | `better-auth@1.7.8` |
| Lint/format | Escolha livre. Sugestão: Biome na raiz | `@biomejs/biome@2.5.15` |

Comandos-chave:

```sh
bunx create-turbo@latest                    # ou montar a raiz à mão (ver §3)
bun create expo-app apps/mobile             # template "default" (Expo Router + TS)
# no app.json: web.output -> "single" (ou "static"); nunca "server"; nenhum arquivo +api.ts
bun add nativewind@4.2.7 react-native-safe-area-context   # dentro de apps/mobile
bun expo install react-native-reanimated react-native-worklets react-native-safe-area-context
bun add -d tailwindcss@^3.4.17 prettier-plugin-tailwindcss@^0.5.11 babel-preset-expo
bun add elysia @elysia/openapi @elysia/cors                 # apps/api
bun add drizzle-orm@0.45 postgres drizzle-typebox@0.3      # packages/db ou apps/api
bun add -d drizzle-kit@0.31
```

Decisões que exigem atenção:
- **Bun 1.4 com isolated installs + Expo gera módulos nativos Expo duplicados.** Até sair um Bun posterior ao 1.4.3 com a correção, use `linker = "hoisted"` em `bunfig.toml` (ver §1.4).
- **Drizzle v1 RC usa `typebox` 1.x. O Elysia 1.4 usa `@sinclair/typebox` 0.34.** Por isso, fique no Drizzle 0.45 + `drizzle-typebox` (ver §2.4).
- **O template do SDK 58 vem com `web.output: "server"`, e no SDK 58 isso liga as API routes por padrão.** Ao migrar para o 58, troque esse valor (ver §1.3).

---

## 1. Expo + Tailwind

### 1.1 SDK atual
- O último SDK estável é o **57**, lançado em 30/06/2026. O SDK 58 Beta saiu em 15/09/2026 ([changelog](https://expo.dev/changelog)). No npm, `expo` `latest`/`sdk-57` = `57.0.29` e `next` = `58.0.10`.
- O SDK 57 atualizou o React Native de 0.85 para 0.86 (o patch `expo@57.0.17` levou ao 0.86.3) e manteve o React 19.2 ([SDK 57](https://expo.dev/changelog/sdk-57)). O template oficial do SDK 57 fixa `react-native 0.86.3`, `react 19.2.3`, `react-native-reanimated 4.5.1`, `react-native-worklets 0.10.1` e `typescript ~6.0.3` ([package.json do template, branch sdk-57](https://github.com/expo/expo/blob/sdk-57/templates/expo-template-default/package.json)).
- Há regressões conhecidas do Hermes V1, corrigidas em `expo@57.0.9`/`57.0.17` ([SDK 57](https://expo.dev/changelog/sdk-57)). Use a versão de patch mais recente.

### 1.2 Tailwind: o que a Expo recomenda hoje
- O guia oficial [docs.expo.dev/guides/tailwind](https://docs.expo.dev/guides/tailwind/) **cobre só Tailwind na web/DOM**, com v3 ou v4 via PostCSS e `isCSSEnabled: true` no Metro. Ele avisa que o Tailwind não roda em Android/iOS (lá ele só funciona em DOM components, dentro de WebView). **Para nativo, o guia aponta para [NativeWind](https://www.nativewind.dev/) ou [Uniwind](https://uniwind.dev/), sem escolher entre os dois.**
- **NativeWind v4.2.7 é a versão estável. Ela usa Tailwind v3 e "adds Expo SDK 57 support"** ([instalação](https://www.nativewind.dev/docs/getting-started/installation)). A v5 (Tailwind v4 + `react-native-css`) está em `5.0.0-rc.0`, e a doc diz: "This is a pre-release version of Nativewind. It is not intended for production use" ([v5](https://www.nativewind.dev/v5/getting-started/installation)). No npm, `nativewind` `latest` = 4.2.7 e `rc` = 5.0.0-rc.0. Em resumo: o `react-native-css` é o motor da NativeWind v5, que ainda não é estável.
- **Uniwind** (`uniwind@1.12.2`, MIT) suporta **só Tailwind 4**, dispensa preset Babel e se configura com `withUniwindConfig` no Metro ([quickstart](https://docs.uniwind.dev/quickstart)). Existe o exemplo `npx create-expo-app -e with-router-uniwind`. Em monorepo, use `@source` no `global.css` para pacotes fora do app ([monorepos](https://docs.uniwind.dev/monorepos)). Os peerDeps incluem `metro`, `metro-cache` e `@expo/metro-config` (`npm view uniwind peerDependencies`).

**Setup NativeWind 4.2.7 (SDK 57)**, conforme a [doc oficial](https://www.nativewind.dev/docs/getting-started/installation):

```sh
bun add nativewind@4.2.7 react-native-safe-area-context
bun expo install react-native-reanimated react-native-worklets react-native-safe-area-context
bun add -d tailwindcss@^3.4.17 prettier-plugin-tailwindcss@^0.5.11 babel-preset-expo
bunx tailwindcss init
```

```js
// tailwind.config.js (content ajustado para o template src/app)
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: { extend: {} },
  plugins: [],
};
```

```css
/* src/global.css (o template do SDK 57 já tem src/global.css; substitua o conteúdo) */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

```js
// babel.config.js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [["babel-preset-expo", { jsxImportSource: "nativewind" }], "nativewind/babel"],
  };
};
```

```js
// metro.config.js
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const config = getDefaultConfig(__dirname);
module.exports = withNativeWind(config, { input: "./src/global.css" });
```

```ts
// nativewind-env.d.ts (não use o nome nativewind.d.ts)
/// <reference types="nativewind/types" />
```

Também é preciso: `"web": { "bundler": "metro" }` no `app.json` e importar `global.css` no `src/app/_layout.tsx`.

### 1.3 Template e como evitar API routes
- Os templates disponíveis são `default` (recomendado, com Expo Router e TS), `blank`, `blank-typescript`, `tabs` e `bare-minimum` ([create-expo](https://docs.expo.dev/more/create-expo/)). Com Bun: `bun create expo-app my-app` ([using-bun](https://docs.expo.dev/guides/using-bun/)).
- O template `default` do SDK 57 tem `src/app/{_layout,index,explore}.tsx`, **nenhum arquivo `+api`** e `"web": { "output": "static" }` ([app.json sdk-57](https://github.com/expo/expo/blob/sdk-57/templates/expo-template-default/app.json)).
- As API routes exigem `web.output: "server"`, ou `"static"` com `apiRoutes` habilitado no plugin `expo-router`, e arquivos `+api.ts`. **"In SDK 58 and later, API routes are enabled by default"** com `server` ([api-routes](https://docs.expo.dev/router/web/api-routes/)). O template no `main` (SDK 58) já vem com `"output": "server"` ([app.json main](https://github.com/expo/expo/blob/main/templates/expo-template-default/app.json)).
- **Para garantir que não haja API routes:** não crie `+api.ts`, não habilite `apiRoutes` no plugin `expo-router`, não instale `expo-server` e deixe `web.output` em `"single"` ou `"static"`. Se o app não tiver alvo web, `"single"` é o mais simples. Ao subir para o SDK 58, troque o `"server"` do template. Os valores aceitos são `single` (SPA), `static` e `server` ("outputs static HTML, and API Routes"), e o default é `single` ([app config](https://docs.expo.dev/versions/latest/config/app/)).

### 1.4 Monorepo (docs.expo.dev/guides/monorepos)
- O guia oficial ([monorepos](https://docs.expo.dev/guides/monorepos/)) diz:
  - Bun é suportado ("first-class support for monorepos").
  - **Desde o SDK 52 o Metro é configurado automaticamente**: não defina `watchFolders`, `nodeModulesPath`, `extraNodeModules` nem `disableHierarchicalLookup`.
  - Layout `apps/` + `packages/`.
  - Desde o SDK 54 há suporte a isolated installs, e "Bun and pnpm have first-class support for isolated installs".
  - `experiments.autolinkingModuleResolution` é automático em monorepos desde o SDK 55.
  - Duplicatas de `react`, `react-native` ou módulos nativos quebram o app. Diagnostique com `bun pm why <pkg>` e force versões com `resolutions`.
- No Bun, **isolated é o default para novos workspaces** (lockfile `configVersion = 1`). Para voltar ao hoisted: `bunfig.toml` → `[install] linker = "hoisted"` ([bun isolated installs](https://bun.com/docs/pm/isolated-installs)).
- **Problema conhecido (SDK 57 + Bun 1.4 isolated):**
  - O `expo-doctor` acusa `expo`/`expo-constants` duplicados porque o Bun cria cópias físicas distintas em ciclos de peerDeps. O `autolinkingModuleResolution` não resolve, e com hoisted o problema some. A Expo fechou a issue como problema do Bun ([expo#49261](https://github.com/expo/expo/issues/49261)).
  - A issue do Bun, [oven-sh/bun#29343](https://github.com/oven-sh/bun/issues/29343), foi fechada em 14/10/2026 pelo PR [#44968](https://github.com/oven-sh/bun/pull/44968), merged no mesmo dia. **Isso aconteceu depois do Bun 1.4.3 (10/10).**
  - **Recomendação:** `linker = "hoisted"` até sair uma release do Bun com essa correção.
- Bun também não roda lifecycle scripts de dependências. Pacotes que precisem de `postinstall` (ex.: `@sentry/cli`) vão em `trustedDependencies`. O EAS escolhe Bun pelo `bun.lock`, e a versão pode ser fixada no `eas.json` ([using-bun](https://docs.expo.dev/guides/using-bun/)).

## 2. Elysia

### 2.1 Versões e pacotes
- `elysia` `latest` = **1.4.30**. O 2.0 está em `next` (`2.0.0-beta.31`). Os plugins oficiais **foram para o escopo `@elysia/*`**: `@elysia/eden@1.4.10`, `@elysia/openapi@1.4.16` e `@elysia/cors@1.4.2`. As docs atuais usam esse escopo ([openapi](https://elysiajs.com/plugins/openapi), [eden](https://elysiajs.com/eden/installation)). Os antigos `@elysiajs/*` continuam no npm (`npm view`).
- O Elysia 1.4 exige `@sinclair/typebox >=0.34 <1`, `typescript >=5`, `@types/bun >=1.2` e `exact-mirror` como peers (`npm view elysia peerDependencies`).

### 2.2 Best practice oficial ([elysiajs.com/essential/best-practice](https://elysiajs.com/essential/best-practice))
- **Pastas por feature**, cada uma com `index.ts` (controller = instância Elysia), `service.ts` (lógica) e `model.ts` (schemas):

```
apps/api/src/
  index.ts            # new Elysia().use(auth).use(clientes)... ; export type App
  modules/
    auth/{index,service,model}.ts
    clientes/{index,service,model}.ts
```

- **"1 Elysia instance = 1 controller"**:
  - Os handlers chamam serviços, ex.: `({ body }) => Clientes.criar(body)`.
  - **Não passe o `Context` inteiro** para classes; desestruture o que precisar.
  - Teste com `app.handle(new Request(...))`.
- **Services:**
  - Lógica sem dependência de request fica em `abstract class` com métodos `static`, ou em funções.
  - Lógica que depende de request vira uma instância Elysia nomeada com `.macro`/`resolve`, ex.: `new Elysia({ name: 'Auth.Service' }).macro({...})`.
- **Models:**
  - Use `t` (TypeBox) como fonte única de validação e tipos (`UnwrapSchema<typeof X>`); não use classes como modelo.
  - Agrupe os schemas num objeto (`AuthModel`) e registre com `.model({...})` para referenciar por nome, ex.: `body: 'auth.Sign'`. Isso também "improves TypeScript inference speed".
  - Standard Schema (Zod/Valibot/ArkType) também é aceito, e os dois podem ser misturados ([validation](https://elysiajs.com/essential/validation)).
- **Deduplicação:** com `name` (e `seed` opcional), o plugin vira singleton. Sem isso, ele roda de novo a cada `.use` ([plugin](https://elysiajs.com/essential/plugin)).
- **Escopo:** os hooks são `local` por padrão. `as('scoped')`/`as('global')` exportam o hook. Global só vale para coisas sem tipos, como CORS e log ([plugin](https://elysiajs.com/essential/plugin)).
- **`.decorate`:** "decorate only for request-dependent properties" ([best-practice](https://elysiajs.com/essential/best-practice)). **`.resolve` é preferível a `.derive`**: o `derive` roda antes da validação e o `resolve` depois ("more secure"). Use `resolve` dentro de `guard`/macro ([life-cycle](https://elysiajs.com/essential/life-cycle)).
- **Erros** ([error-handling](https://elysiajs.com/patterns/error-handling)):
  - `throw status(...)` passa pelo `onError`; `return status(...)` não passa.
  - Erros customizados são registrados com `.error({ MinhaClasse })` e diferenciados por `code`.
  - `toResponse()` na classe define a resposta.
  - Os códigos built-in incluem `VALIDATION` e `NOT_FOUND`. Erro desconhecido vira `UNKNOWN`/500.

### 2.3 Eden Treaty entre pacotes do monorepo
- No servidor, use `export type App = typeof app` e encadeie todos os métodos: sem encadeamento os tipos se perdem. No cliente, `treaty<App>('localhost:3000')` ([eden/installation](https://elysiajs.com/eden/installation)).
- Os requisitos no cliente (`apps/mobile`) são ([eden/installation](https://elysiajs.com/eden/installation)):
  - `@elysia/eden`;
  - `elysia` como devDependency **na mesma versão do servidor** (deve haver uma única versão; confira com `bun pm why elysia`);
  - `"strict": true`;
  - TS >= 5.0;
  - `@types/bun`, se algum handler retornar API do Bun.
- **Path aliases:** os aliases precisam resolver para os mesmos arquivos nos dois lados. Se não resolverem, "type inference will be resolved as any" ([eden/installation](https://elysiajs.com/eden/installation)).
- **Abordagem sugerida:** em vez de `paths`, que o Turborepo desaconselha em pacotes JIT (§3), exponha o tipo pelo `package.json` do `apps/api` (`"exports": { "./app": "./src/index.ts" }`) e no mobile importe com `import type { App } from '@acme/api/app'`. Use **só `import type`**, para que o Metro não empacote código do servidor. Isso é inferência minha a partir das duas docs, não uma receita oficial.

### 2.4 Drizzle + Elysia + Postgres no Bun
- **A integração oficial do Elysia** ([integrations/drizzle](https://elysiajs.com/integrations/drizzle)) usa `bun add drizzle-orm drizzle-typebox`:
  - os schemas vêm de `createInsertSchema`/`createSelectSchema` e são refinados com `t`, ex.: `t.Omit(_createUser, ['id','salt','createdAt'])`;
  - a página traz os utilitários `spread`/`spreads` (em `src/database/utils.ts`) para copiar;
  - atribua o resultado do drizzle-typebox a uma variável antes de aninhar, ou aparece "Type instantiation is possibly infinite";
  - **fixe `@sinclair/typebox`** na versão usada pelo `elysia` com `overrides`/`resolutions`. O exemplo da página ainda mostra `0.32.4`, que está desatualizado: o Elysia 1.4 pede `>=0.34`.
- **Drizzle hoje** ([latest](https://orm.drizzle.team/docs/get-started/postgresql-new), [upgrade-v1](https://orm.drizzle.team/docs/upgrade-v1)):
  - As docs instruem `drizzle-orm@rc` / `drizzle-kit@rc` (v1 RC; `1.0.0-rc.4` saiu em 27/06/2026 e está marcada como prerelease no [GitHub](https://github.com/drizzle-team/drizzle-orm/releases)). O `latest` estável continua `0.45.4` (08/10/2026).
  - **Na v1, o validador TypeBox é `drizzle-orm/typebox` e usa o pacote `typebox` (1.x)** ([typebox](https://orm.drizzle.team/docs/typebox)). Para `@sinclair/typebox` existe `drizzle-orm/typebox-legacy` ([typebox-legacy](https://orm.drizzle.team/docs/typebox-legacy)).
  - **Conclusão:** com Elysia 1.4 (`@sinclair/typebox` 0.34), use `drizzle-orm@0.45` + `drizzle-typebox@0.3.3` (peer `@sinclair/typebox >=0.34.8`). Isso casa com a página do Elysia. Se for para a v1, use `typebox-legacy`.
- **Drivers:** o Drizzle suporta `node-postgres`, `postgres.js` e Bun SQL (`drizzle-orm/bun-sql`) ([connect-bun-sql](https://orm.drizzle.team/docs/connect-bun-sql)). A doc do Bun SQL só alerta sobre concorrência no Bun 1.2.0 ([get-started bun-sql](https://orm.drizzle.team/docs/get-started/bun-sql-new)), mas há issues abertas relevantes:
  - JSON não serializado: [#6132](https://github.com/drizzle-team/drizzle-orm/issues/6132), de 08/2026;
  - timezone/mode: [#4311](https://github.com/drizzle-team/drizzle-orm/issues/4311);
  - processo encerrando com código 0 em scripts: [#5451](https://github.com/drizzle-team/drizzle-orm/issues/5451).
- **Recomendação:** use **postgres.js** (`drizzle-orm/postgres-js`, pacote `postgres@3.4.9`) no MVP. Ele roda bem no Bun e evita esses bugs; reavalie o Bun SQL depois.

```ts
// packages/db/src/client.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
export const db = drizzle({ client: postgres(process.env.DATABASE_URL!) });
```

### 2.5 OpenAPI e Auth
- O pacote é `@elysia/openapi`, com `.use(openapi())`:
  - a UI fica em `/openapi` e o JSON em `/openapi/json`;
  - o provider padrão é Scalar ([plugins/openapi](https://elysiajs.com/plugins/openapi));
  - `references: fromTypes()` gera a documentação a partir dos tipos TS;
  - em produção, pré-gere o `.d.ts`; em monorepo, passe `projectRoot` (e `tsconfigPath`, se for o caso);
  - Zod 4 precisa de `mapJsonSchema: { zod: z.toJSONSchema }` ([patterns/openapi](https://elysiajs.com/patterns/openapi)).
- **Auth:** o Elysia tem página oficial de **Better Auth** ([integrations/better-auth](https://elysiajs.com/integrations/better-auth)):
  - `.mount(auth.handler)`;
  - macro `auth` com `resolve` que chama `auth.api.getSession({ headers })` e retorna 401 sem sessão; as rotas usam `{ auth: true }`;
  - CORS via `@elysia/cors` com `credentials: true`;
  - plugin `openAPI()` do Better Auth para mesclar os schemas no `@elysia/openapi`;
  - o exemplo usa `pg.Pool`, mas com Drizzle o adapter é `drizzleAdapter(db, { provider: "pg" })` e o schema sai de `npx auth@latest generate` ([better-auth drizzle](https://better-auth.com/docs/adapters/drizzle)).
- **Mobile** ([better-auth expo](https://better-auth.com/docs/integrations/expo)):
  - pacotes `@better-auth/expo`, `expo-secure-store` e `expo-network`;
  - `plugins: [expo()]` no servidor e `trustedOrigins: ["<scheme>://"]`;
  - `expoClient({ scheme, storagePrefix, storage: SecureStore })` no cliente;
  - não precisa mexer no Metro (package exports já são default desde o SDK 53);
  - a doc deixa explícito que dá para usar um **servidor separado** em vez de Expo API routes.

## 3. Turborepo com Bun

- **Bun 1.2+ tem suporte "Stable"** na tabela de package managers ([support-policy](https://turborepo.dev/docs/support-policy)). O domínio das docs agora é turborepo.dev. Para criar: `bunx create-turbo@latest` ([installation](https://turborepo.dev/docs/getting-started/installation)).
- **Layout:**
  - `apps/` para aplicações e serviços, `packages/` para o resto;
  - com Bun, `"workspaces": ["apps/*", "packages/*"]` no `package.json` da raiz;
  - **pacotes aninhados (`apps/**`) não são suportados**;
  - use namespace (`@acme/*` ou `@repo/*`) e prefira `exports` a `main`;
  - o exemplo de raiz da doc usa `devEngines.packageManager` (bun) ([structuring-a-repository](https://turborepo.dev/docs/crafting-your-repository/structuring-a-repository)).
- **Pacotes internos** ([internal-packages](https://turborepo.dev/docs/core-concepts/internal-packages)):
  - **JIT** quer dizer `exports` apontando para `.ts`, transpilado pelo consumidor. O Metro e o Bun fazem isso.
  - Limitações do JIT: não pode usar `compilerOptions.paths` e não tem cache de `build`.
  - **Compiled** são pacotes com build próprio.
  - Para um MVP com Bun + Metro, **JIT basta**.
- **TypeScript** ([guides/tools/typescript](https://turborepo.dev/docs/guides/tools/typescript)):
  - crie um pacote `@repo/typescript-config` com `base.json` (`strict`, `isolatedModules`, `module: NodeNext`), estendido pelos outros configs;
  - **project references não são recomendadas**;
  - nos pacotes JIT, use subpath imports (`"imports": { "#*": "./src/*" }`, TS 5.4+) em vez de `paths`;
  - a tarefa de checagem é `check-types` (`tsc --noEmit`).
  - **Atenção:** o `apps/mobile` estende `expo/tsconfig.base`. Ele não deve herdar o `module: NodeNext` do `base.json`, então mantenha um config de app separado (inferência).
- **turbo.json** sugerido, montado a partir de [configuring-tasks](https://turborepo.dev/docs/crafting-your-repository/configuring-tasks), com transit node para tarefas paralelas que dependem do código dos pacotes:

```json
{
  "$schema": "https://turborepo.dev/schema.json",
  "tasks": {
    "transit": { "dependsOn": ["^transit"] },
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "dev": { "persistent": true, "cache": false },
    "check-types": { "dependsOn": ["transit"] },
    "test": { "dependsOn": ["transit"] },
    "//#format-and-lint": {},
    "//#format-and-lint:fix": { "cache": false }
  }
}
```

- **Lint/format:**
  - **Não há recomendação first-party de um linter.** O Turborepo tem guias de ESLint e de Biome sem compará-los ([biome](https://turborepo.dev/docs/guides/tools/biome), [eslint](https://turborepo.dev/docs/guides/tools/eslint)). Para Biome, ele recomenda uma *Root Task* (`//#format-and-lint`), com o trade-off de cache miss global.
  - O ferramental da Expo é ESLint (`expo lint`, `eslint-config-expo`), com Prettier opcional, e não cita Biome ([using-eslint](https://docs.expo.dev/guides/using-eslint/)).
  - **Biome 2.5 na raiz é escolha nossa** (uma ferramenta, rápida). O custo é perder as regras específicas da Expo e de React hooks do `eslint-config-expo`.

## 4. Postgres local + migrações Drizzle

- Imagem oficial: tags atuais `18` / `18.6`; `19beta4` é beta ([Docker Hub](https://hub.docker.com/_/postgres)). **No 18+, o volume deve ser montado em `/var/lib/postgresql`**, e não mais em `.../data` (o PGDATA virou `/var/lib/postgresql/18/docker`) ([docs da imagem](https://github.com/docker-library/docs/blob/master/postgres/README.md)). A doc da imagem não traz healthcheck; o abaixo usa `pg_isready`, que vem na imagem.

```yaml
# compose.yaml (derivado do exemplo oficial da imagem)
services:
  db:
    image: postgres:18
    restart: unless-stopped
    shm_size: 128mb
    environment:
      POSTGRES_USER: acme
      POSTGRES_PASSWORD: acme
      POSTGRES_DB: acme
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U acme -d acme"]
      interval: 5s
      timeout: 3s
      retries: 10
volumes:
  pgdata:
```

`DATABASE_URL=postgres://acme:acme@localhost:5432/acme`. O formato vem do [guia local do Drizzle](https://orm.drizzle.team/docs/guides/postgresql-local-setup).

```ts
// packages/db/drizzle.config.ts (formato oficial)
import { defineConfig } from 'drizzle-kit';
export default defineConfig({
  out: './drizzle',
  schema: './src/schema.ts',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```

O Bun carrega `.env` sozinho, então o `import 'dotenv/config'` da doc é dispensável quando o comando roda via Bun (inferência).

**Workflow** ([migrations](https://orm.drizzle.team/docs/migrations), [kit-overview](https://orm.drizzle.team/docs/kit-overview)):
- **Opção 3 (recomendada para o time):**
  1. `drizzle-kit generate` gera o SQL versionado no git.
  2. `drizzle-kit migrate` aplica as migrações.
- **Opção 2:** `drizzle-kit push` serve para protótipo rápido local.
- **Opção 4:** `migrate(db, { migrationsFolder })` de `drizzle-orm/postgres-js/migrator` no boot ou no deploy.

```json
// packages/db/package.json (scripts)
{ "db:generate": "drizzle-kit generate", "db:migrate": "drizzle-kit migrate", "db:push": "drizzle-kit push", "db:studio": "drizzle-kit studio" }
```

O formato da pasta de migrações muda na v1: sai o `journal.json` e cada migração vira uma pasta. Para converter, existe `drizzle-kit up` ([upgrade-v1](https://orm.drizzle.team/docs/upgrade-v1)). Isso pesa ao migrar do 0.45 para a v1 mais tarde.

## 5. Uniwind

> Decisão do time: Uniwind no lugar de NativeWind. Fontes: docs oficiais ([docs.uniwind.dev](https://docs.uniwind.dev/llms.txt)), releases e issues do [GitHub uni-stack/uniwind](https://github.com/uni-stack/uniwind) e `npm view`, todos consultados em 2026-10-14.

### 5.1 Versão, licença e requisitos
- `uniwind` `latest` = **1.12.2**, de 05/10/2026 ([release](https://github.com/uni-stack/uniwind/releases/tag/v1.12.2)). Licença **MIT**. A única outra dist-tag é `beta` = `1.6.7-beta.0`, que é antiga (`npm view uniwind dist-tags`).
- **peerDependencies:** `react >=19.0.0`, `react-native >=0.81.0`, `tailwindcss >=4`, `metro`, `metro-cache`, `metro-transform-worker` e `@expo/metro-config` (todos `*`) (`npm view uniwind peerDependencies`).
- **Tailwind:** "Uniwind only supports **Tailwind 4**" ([quickstart](https://docs.uniwind.dev/quickstart)). O `tailwindcss` `latest` é `4.3.3`.
  - O Tailwind 4.3.3 trouxe regressões, corrigidas no Uniwind 1.12.0 e 1.12.1: variants aninhadas ([#661](https://github.com/uni-stack/uniwind/issues/661)) e `ios:`/`android:` vazando para a outra plataforma ([#668](https://github.com/uni-stack/uniwind/issues/668)).
  - Os mantenedores pedem que o tema siga só a sintaxe da doc (`@layer theme` → `:root` → `@variant dark`). Outras formas podem quebrar a cada patch do Tailwind ([#669](https://github.com/uni-stack/uniwind/issues/669), fechada como *not planned*). **Use Uniwind ≥ 1.12.1 com Tailwind 4.3.x.**

### 5.2 Compatibilidade com SDK 57 / RN 0.86 / React 19.2 / New Architecture
- **A versão free não publica matriz de compatibilidade.** As evidências primárias de suporte ao SDK 57 são:
  - O release **1.10.1** (03/08/2026) traz "chore: update to expo 57" ([PR #591](https://github.com/uni-stack/uniwind/pull/591), [release](https://github.com/uni-stack/uniwind/releases/tag/v1.10.1)).
  - O 1.11.0 já alinha tipos e color scheme com o RN 0.87 ([release](https://github.com/uni-stack/uniwind/releases/tag/v1.11.0)).
  - Os peerDeps (`react-native >=0.81`, `react >=19`) cobrem RN 0.86.3 e React 19.2.3.
  - O exemplo oficial da Expo [`with-router-uniwind`](https://github.com/expo/examples/blob/master/with-router-uniwind/package.json) usa `expo ^57.0.1`, `react-native 0.86.0` e `react 19.2.3`, mas ainda fixa `uniwind ~1.0.0` e `tailwindcss ~4.1.16`. **Não copie essas duas versões.**
- **Uniwind Pro:** a [tabela de compatibilidade](https://docs.uniwind.dev/pro/compatibility) é explícita: Pro **1.8.1 → RN 0.81–0.88, Expo SDK 54–57**. Exige Reanimated ≥ 4 e `react-native-nitro-modules` ≥ 0.37.1.
- **New Architecture:** a versão free é só JS: "No native code to compile", segundo a tabela free vs Pro ([pro-version](https://docs.uniwind.dev/pro-version)), e funciona no Expo Go. Por isso ela não depende da New Arch. Não achei menção explícita da versão free à New Arch. A Pro usa C++/Nitro e ShadowTree, que são Fabric.
- **TypeScript:** os tipos são gerados pelo Metro no `dtsFile` ("You need to run metro server to generate typings") ([quickstart](https://docs.uniwind.dev/quickstart)). O *Strict TypeScript API* do RN (opt-in no 0.86, default no 0.87) apagava os tipos de `className`. Isso foi corrigido em 20/08/2026 ([#636](https://github.com/uni-stack/uniwind/issues/636)).
- **Bloqueios:** não encontrei issue aberta que bloqueie SDK 57 + Expo Router. As 6 issues abertas em 14/10 são de nicho: [#731](https://github.com/uni-stack/uniwind/issues/731) (o `withUniwind` trata como estilo toda prop que termina em `Style`), parser de `fontVariant`, Pro/iOS, web e media queries de altura ([lista](https://github.com/uni-stack/uniwind/issues)).

### 5.3 Setup oficial no Expo ([quickstart](https://docs.uniwind.dev/quickstart))

```sh
bun add uniwind tailwindcss            # dentro de apps/mobile; sem preset Babel
```

```css
/* apps/mobile/src/global.css */
@import 'tailwindcss';
@import 'uniwind';
/* pacotes do monorepo fora do app (ver §5.4) */
@source '../../../packages/ui';
```

```js
// apps/mobile/metro.config.js — withUniwindConfig TEM de ser o wrapper mais externo
const { getDefaultConfig } = require('expo/metro-config');
const { withUniwindConfig } = require('uniwind/metro');
const config = getDefaultConfig(__dirname);
module.exports = withUniwindConfig(config, {
  cssEntryFile: './src/global.css',      // caminho relativo; nada de path.resolve
  dtsFile: './src/uniwind-types.d.ts',   // gerado ao rodar o Metro
});
```

- **Babel:** nenhum preset ("No Babel preset required"). Em migração, removem-se o `nativewind/babel`, o `jsxImportSource`, o `tailwind.config.js` e o `nativewind-env.d.ts` ([migração](https://docs.uniwind.dev/migration-from-nativewind)).
- **Onde importar o `global.css`:** no componente raiz. Com Expo Router, isso é o `src/app/_layout.tsx`. Não importe no `index.ts` que registra o app, porque aí cada mudança vira reload completo ([quickstart](https://docs.uniwind.dev/quickstart)).
- **Onde fica o `global.css`:** a localização dele define a raiz do scan de classes. Se ele estiver em `src/` e houver componentes fora dessa pasta, use `@source` ([monorepos](https://docs.uniwind.dev/monorepos), [FAQ Expo Router](https://docs.uniwind.dev/faq)).
- **Package exports:** o Uniwind exige `unstable_enablePackageExports` ligado no Metro (é o default do Expo). Se precisar desligá-lo, há um resolver seletivo na [FAQ](https://docs.uniwind.dev/faq).
- **Safe area:** na versão free, as classes de safe area exigem `react-native-safe-area-context` + `SafeAreaListener` → `Uniwind.updateInsets(insets)` ([FAQ](https://docs.uniwind.dev/faq)).
- **`rem`:** o default é 16px. A NativeWind usava 14px, e dá para configurar `rem: 14` no Metro ([migração](https://docs.uniwind.dev/migration-from-nativewind)).

### 5.4 Monorepo (Bun workspaces, linker hoisted, Metro) e Expo Router
- **Doc oficial:** a única recomendação para monorepo é `@source` apontando para os pacotes fora do app ([monorepos](https://docs.uniwind.dev/monorepos)). Não há guia específico para Bun.
- **Histórico de bugs de resolução em monorepo, todos já fechados:**
  - **Bun + Expo Router + dev client:** `Unexpectedly escaped traversal` no Metro ([#512](https://github.com/uni-stack/uniwind/issues/512), fechada por falta de reprodução, 04/2026);
  - recursão no resolver com várias cópias do `uniwind` ([#353](https://github.com/uni-stack/uniwind/issues/353), corrigida no 1.9.0, [#570](https://github.com/uni-stack/uniwind/pull/570));
  - symlinks do pnpm ([#598](https://github.com/uni-stack/uniwind/issues/598), [#609](https://github.com/uni-stack/uniwind/pull/609) no 1.12.0);
  - `exports` sem `main` no `expo export` do SDK 57 ([#679](https://github.com/uni-stack/uniwind/issues/679)), corrigido no 1.12.1 ("add Metro main/react-native fallbacks", [#683](https://github.com/uni-stack/uniwind/pull/683));
  - "resolve aliased uniwind copy when Expo autolinking resolution picks a hoisted one" ([#694](https://github.com/uni-stack/uniwind/pull/694), 1.12.1).
- **Implicações para nós (inferência):**
  - Com `linker = "hoisted"` (§1.4) os casos de symlink e de cópias isoladas não se aplicam.
  - Mesmo assim, **garanta uma única cópia do `uniwind`** (`bun pm why uniwind`) e mantenha o `uniwind` só no `apps/mobile`. Os pacotes compartilhados levam apenas as strings de classe, e o `@source` faz o resto.
  - O histórico de issues mostra que a resolução no Metro é a área mais frágil. Valide no scaffold.

### 5.5 Lacunas vs NativeWind (chat, bottom sheet, dark mode, animações)
- **Componentes de terceiros:**
  - Não existe `cssInterop` global ("We don't override global components").
  - Cada componente é embrulhado com `withUniwind(Comp)`, com mapeamento de props customizadas, ou recebe estilo via `useResolveClassNames('...')` ([third-party](https://docs.uniwind.dev/components/other-components), [withUniwind](https://docs.uniwind.dev/api/with-uniwind)).
  - Para bottom sheet (ex.: `@gorhom/bottom-sheet`), o caminho seria `withUniwind` ou `useResolveClassNames` nas props de estilo. Não achei doc nem issue específica (inferência).
  - Cuidado com o [#731](https://github.com/uni-stack/uniwind/issues/731), ainda aberto: no `withUniwind`, toda prop que termina em `Style` vira array de estilo.
- **Animações:**
  - **A versão free não traduz classes de animação** ("No translation layer, you need to use `style` property"). As classes `animate-*`/`transition-*` da NativeWind devem ser trocadas por Reanimated direto ([pro-version](https://docs.uniwind.dev/pro-version), [migração, passo 14](https://docs.uniwind.dev/migration-from-nativewind)).
  - Reanimated 4 via `className` é **exclusivo da Pro**.
  - Houve relato de `withUniwind` quebrando o `AnimatedStyleHandle` do Reanimated ([#530](https://github.com/uni-stack/uniwind/issues/530)), fechado sem reprodução. Prefira `Animated.View` com `style` animado e `className` estático.
- **Dark mode:**
  - Já vem pronto, com os temas `light`, `dark` e `system`, a variante `dark:`, `Uniwind.setTheme()` e temas custom em CSS, sem ThemeProvider ([theming](https://docs.uniwind.dev/theming/basics)).
  - Na versão free a troca de tema é instantânea; as transições animadas são da Pro.
  - As *group variants* (`group-active:`) são "Parsed, no runtime effect" na free.
- **Merge e variants:**
  - O Uniwind **não deduplica classes**. A doc recomenda `tailwind-merge` + `clsx` num helper `cn()` ([FAQ](https://docs.uniwind.dev/faq), [migração, passo 15](https://docs.uniwind.dev/migration-from-nativewind)).
  - `cva`/`tailwind-variants` não são citados na doc. Como só geram strings de classe, devem funcionar (inferência).
  - Há suporte nativo a `data-[...]` variants ([data selectors](https://docs.uniwind.dev/api/data-selectors)).
- **UI kits recomendados:** React Native Reusables (shadcn) e HeroUI Native ([FAQ](https://docs.uniwind.dev/faq)).

### 5.6 Free vs Pro
- **Free (MIT):**
  - Tailwind v4 completo, temas e dark mode, platform selectors, parser CSS, automapping de props de todos os componentes RN, scoped variables (1.11+);
  - funciona no **Expo Go**;
  - suporte da comunidade ([pro-version](https://docs.uniwind.dev/pro-version)).
- **Pro (comercial, engine C++ do Unistyles):**
  - updates no ShadowTree sem re-render, Reanimated 4 via `className`, transições nativas de tema, insets nativos, group variants, default styles (experimental) e suporte prioritário;
  - **exige dev build**: não roda no Expo Go;
  - **preço:** a partir de **US$ 99/seat/ano** para as seats 1–3; as seats 4–6 custam US$ 49, as 7–15 US$ 29 e as 16+ US$ 1 ([pricing](https://uniwind.dev/pricing));
  - **licenças:** Individual (300 downloads/mês), Team (1.000/mês por projeto) e CI/CD (1.000/mês) ([licenças](https://docs.uniwind.dev/pro/get-license)).
- **Para o MVP:** a free basta. A troca para a Pro é "swap the package, keep your code" ([pro-version](https://docs.uniwind.dev/pro-version)).

## 6. OpenRouter (modelos grátis)

> Fontes: docs oficiais ([índice llms.txt](https://openrouter.ai/docs/llms.txt)), a API pública (`GET /api/v1/models`, `/api/v1/models/{id}/endpoints`, `/api/v1/endpoints/zdr`) e `npm view`, consultados em 2026-10-14.

### 6.1 Como funcionam os modelos grátis
- **Variante `:free`:**
  - É o ID do modelo com o sufixo `:free`, e só existe para modelos que listam uma entrada grátis. A doc diz que free variants "may have different rate limits or availability compared to paid versions" ([free variant](https://openrouter.ai/docs/guides/routing/model-variants/free)).
- **Roteador `openrouter/free`:**
  - "automatically selects a free model at random". Antes de sortear, ele filtra pelos recursos que a requisição pede (visão, tool calling, structured outputs) e devolve em `model` qual modelo foi usado ([free router](https://openrouter.ai/docs/guides/routing/routers/free-router)).
  - **Para produção ele não serve:** a qualidade e o comportamento mudam a cada chamada (inferência). Fixe um modelo `:free` com fallback.
- **Rate limits dos `:free`** ([limits](https://openrouter.ai/docs/api/reference/limits)):

| Créditos comprados (total histórico) | Req/min | Req/dia |
|---|---|---|
| < 10 | 20 | 50 |
| ≥ 10 | 20 | 1.000 |

  - **Quem pesa nos limites:** o limite diário depende do total de créditos comprados, e não do saldo. A doc libera o teto maior já a partir de 9 créditos, para absorver taxas.
  - **Consulta e erros:** `GET /api/v1/key` devolve `free_model_daily_requests {used, limit, remaining}` (o limite por minuto não aparece ali). Estourar o limite dá 429, com headers `X-RateLimit-*`. Com **saldo negativo** vêm erros 402 "including for free models". O DDoS protection da Cloudflare bloqueia uso muito acima do razoável.
- **Implicação para o MVP:** com US$ 10 comprados uma vez, ficam **1.000 req/dia e 20 req/min** somados entre todos os modelos `:free`. Uma conversa com tool calling gasta várias requisições por turno, e esse teto é por conta, não por usuário final (inferência). Dá para piloto e demo; não dá para uso real com vários usuários.

### 6.2 Modelos grátis com tool calling (catálogo de 14/10/2026)
O `GET https://openrouter.ai/api/v1/models` retornou 462 modelos, 17 deles com preço zero. Destes, **15 aceitam `tools`**. Os de texto mais relevantes, com dados de `/api/v1/models/{id}/endpoints`, são:

| Modelo (`:free`) | Provider | Contexto | Tools | Structured outputs | Entrada |
|---|---|---|---|---|---|
| `nvidia/nemotron-3-super-120b-a12b:free` | NVIDIA | 262k | sim | **sim** (`structured_outputs` + `response_format`) | texto |
| `nvidia/nemotron-3-ultra-550b-a55b:free` | NVIDIA | 1M | sim | não | texto |
| `nvidia/nemotron-3.5-lightning:free` | NVIDIA | 1M | sim | não | texto |
| `thinkingmachines/inkling:free` / `inkling-small:free` | Thinking Machines | 1M | sim | não | texto, imagem, **áudio** |
| `google/gemma-4-31b-it:free` (e `26b-a4b`) | Google AI Studio | 262k | sim | `response_format` | texto, imagem, vídeo |
| `dots-studio/dots-3-note-preview:free` | AtlasCloud | 512k | sim | **sim** | texto, imagem |
| `poolside/laguna-s-2.1:free` | Poolside | 262k | sim | não | texto |
| `openrouter/free` (roteador) | vários | 200k | sim | sim | texto, imagem |

Outros com tools: `poolside/laguna-xs-2.1`, `cohere/north-mini-code` (focado em código), `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning` (aceita áudio) e `liquid/lfm-2.5-2.6b` (pequeno). **Cada modelo grátis tem um único provider**, então não há fallback de provider dentro do mesmo modelo. Use a lista `models` de fallback do OpenRouter ([provider-selection](https://openrouter.ai/docs/guides/routing/provider-selection)). A disponibilidade muda com frequência ("Free model availability changes frequently", [free router](https://openrouter.ai/docs/guides/routing/routers/free-router)). Não achei informação primária sobre a qualidade em português de nenhum deles.

### 6.3 Privacidade, treino e LGPD
- **O OpenRouter em si** ([data collection](https://openrouter.ai/docs/guides/privacy/data-collection)):
  - "does not store your prompts or responses, *unless* you opt in". Há dois opt-ins, ambos desligados por padrão: o logging privado de I/O e o uso dos dados pelo OpenRouter, que dá 1% de desconto.
  - Ele guarda metadados (tokens, latência) e faz uma categorização anônima de uma amostra dos prompts, usando um modelo com ZDR.
- **Os providers seguem políticas próprias** ([provider logging](https://openrouter.ai/docs/guides/privacy/provider-logging)):
  - Há um toggle de conta que permite ou bloqueia rotear para providers que podem treinar com os dados, e "There are separate settings for paid and free models".
  - Quando o OpenRouter não consegue confirmar a política de um endpoint, ele assume que o endpoint "both retains and trains" ([ZDR](https://openrouter.ai/docs/guides/features/zdr)).
- **Política padrão dos providers dos modelos grátis** (campo `dataPolicy` da API `https://openrouter.ai/api/frontend/v1/all-providers`, a mesma que alimenta a tabela da doc):

| Provider | Treina com prompts? | Retém prompts? |
|---|---|---|
| NVIDIA (Nemotron free; termos de *API Trial*) | **sim** | sim |
| Thinking Machines (Inkling free; termos de "free research API tier") | **sim** (inclusive `trainingOpenRouter`) | sim |
| Liquid | **sim** | sim |
| Google AI Studio (Gemma) | não | sim, 55 dias |
| AtlasCloud (dots) | não | sim |
| Poolside | não | sim |
| Cohere | não | sim, 30 dias |

  - Essa é a política **padrão do provider**. A doc avisa que a política de um endpoint específico pode ser diferente, e o endpoint grátis pode ser mais permissivo que o pago (ver incertezas).
- **ZDR:**
  - Pode ser imposto na conta, por grupo de modelos, por guardrail ou por requisição (`provider: { zdr: true }`) ([ZDR](https://openrouter.ai/docs/guides/features/zdr)).
  - Outra opção é `provider: { data_collection: "deny" }`, que filtra os providers que "may store data" ([provider-selection](https://openrouter.ai/docs/guides/routing/provider-selection)).
  - **Na lista `GET /api/v1/endpoints/zdr` (951 endpoints) não há nenhum LLM de texto grátis.** Os únicos itens de preço zero são de imagem e áudio. Na prática, **ZDR ou `data_collection: deny` eliminam todos os modelos grátis de chat**.
- **Termos:**
  - Para uso comercial vale o [DPA](https://openrouter.ai/terms) do OpenRouter (seção 10.2 dos termos).
  - Os termos também dizem que cabe ao cliente avaliar se cada modelo e os termos do provider servem para uso "regulated, high-risk, sensitive, or customer-facing" ([terms §5](https://openrouter.ai/terms)).
- **LGPD (inferência minha, não é parecer jurídico):**
  - Nome, telefone e endereço de clientes finais são dados pessoais. Mandá-los para endpoints grátis que **treinam e retêm** (NVIDIA, Thinking Machines, Liquid) é compartilhar com terceiros para uma finalidade (treino) que o titular não autorizou. Isso fica difícil de justificar e transfere dados para fora do país (arts. 6º, 7º e 33).
  - Mesmo nos que não treinam, há retenção de 30 a 55 dias ou por prazo indefinido.
  - **Recomendação:**
    1. No MVP com modelos grátis, **não mandar PII real**. Use dados sintéticos, ou pseudonimize antes do LLM (ex.: `[[CLIENTE_1]]`, telefone mascarado), com a reidentificação no nosso backend.
    2. Na conta, bloqueie "providers that may train" também para os modelos grátis, sabendo que isso remove os Nemotron e Inkling.
    3. Quando houver dado real, vá para modelos pagos com `zdr: true`.

### 6.4 Integração TypeScript (Bun, Elysia)
| Opção | Pacote (versão em 14/10/2026) | Notas |
|---|---|---|
| SDK oficial | `@openrouter/sdk@1.4.25` (Apache-2.0, ESM-only, dep. `zod`) | Gerado do OpenAPI e espelha a API 1:1 ([client SDKs](https://openrouter.ai/docs/client-sdks/overview)). **Lista Bun v1+ como runtime suportado** ([RUNTIMES.md](https://github.com/OpenRouterTeam/typescript-sdk/blob/main/RUNTIMES.md)). Cobre `chat`, `stt` e `tts`. O toolkit de agentes saiu para `@openrouter/agent@0.11.0` ([migração](https://openrouter.ai/docs/client-sdks/agent-migration)). |
| Vercel AI SDK | `ai@7.0.140` + `@openrouter/ai-sdk-provider@3.1.0` (peers `ai ^7`, `zod ^3.25.76 \|\| ^4.1.8`) | Página oficial no OpenRouter ([Vercel AI SDK](https://openrouter.ai/docs/guides/community/vercel-ai-sdk)). O README pede "Node.js 22 or newer, ESM-only" ([ai-sdk-provider](https://github.com/OpenRouterTeam/ai-sdk-provider)). A doc mostra `bun add`, mas não há declaração explícita de suporte a Bun. |
| SDK da OpenAI | `openai@7.34.0` com `baseURL: "https://openrouter.ai/api/v1"` | Funciona ([OpenAI SDK](https://openrouter.ai/docs/guides/community/openai-sdk)), mas os campos específicos (`provider`, `models`) ficam sem tipo. |

- **Recomendação: Vercel AI SDK (`ai` + `@openrouter/ai-sdk-provider`) no `apps/api`, atrás de uma interface nossa**, por exemplo `packages/llm` exportando `LlmPort { chat(...); structured(...) }`.
  - **Por quê:** o loop de tool calling, a saída estruturada com schema e o streaming vêm prontos. Trocar o OpenRouter por outro provider vira trocar o provider do AI SDK, sem reescrever a lógica.
  - **Requisitos de configuração:** o modelo vem de config (env), com uma lista de fallback. As preferências `provider: { zdr, data_collection }` passam pelas opções do provider.
  - **Para STT**, use o `@openrouter/sdk` (`openRouter.stt.createTranscription`) ou `fetch` direto.
  - **Ressalvas:** o AI SDK usa Zod para os schemas, e o Elysia usa TypeBox. São dois validadores no backend. A execução no Bun 1.4 é inferência: o provider declara Node ≥ 22 e o Bun implementa as APIs Web/Node usadas. Valide no scaffold.

### 6.5 Speech-to-text
- **Existe, mas só pago.** O endpoint dedicado é `POST /api/v1/audio/transcriptions` ([STT](https://openrouter.ai/docs/guides/overview/multimodal/stt)).
  - Aceita base64 JSON ou multipart compatível com a OpenAI (limite de 25 MB) e formatos `wav`, `mp3`, `m4a`, `ogg`, `webm`, `aac` etc. O idioma vai em `language` (ISO-639-1, ex.: `pt`) e há `verbose_json` com timestamps.
  - O timeout upstream é de 60 s, então áudios longos precisam ser divididos.
- **Modelos:** `GET /api/v1/models?output_modalities=transcription` lista 26 modelos de STT, **nenhum grátis**.
  - Os mais baratos cobram US$ 0,00000333/s (~US$ 0,012/hora de áudio): `openai/whisper-large-v3-turbo`, `qwen/qwen3-asr-0.6b` e `nvidia/nemotron-3.5-asr-streaming-multilingual-0.6b`.
  - O `openai/whisper-1` custa US$ 0,0001/s (US$ 0,006/min).
  - Outros: `deepgram/nova-3`, `elevenlabs/scribe-v2`, `assemblyai/universal-3-6-pro`, `google/chirp-3`, `mistralai/voxtral-*`, `openai/gpt-4o(-mini)-transcribe`, `microsoft/mai-transcribe-2`.
- **Alternativa grátis:** mandar áudio como entrada de chat (`input_audio` em `/chat/completions`, [audio](https://openrouter.ai/docs/guides/overview/multimodal/audio)) para modelos `:free` que aceitam áudio: `thinkingmachines/inkling(-small):free` e `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free`. **Os dois providers treinam com os dados** (§6.3), então isso não serve para voz de cliente real.

---

## Pontos em aberto / incertezas

1. **Tailwind no mobile:** a Expo não escolhe entre NativeWind e Uniwind. NativeWind 4.2.7 (Tailwind v3) é a opção estável e conservadora. Uniwind é a opção estável com Tailwind v4, mas eu não confirmei em fonte primária uma matriz de compatibilidade com o SDK 57. A NativeWind v5 está em RC e "not intended for production".
2. **SDK 58:** está em beta (npm `next` = 58.0.10) e pode virar estável em breve, com React 19.3 e RN 0.88 no template do `main`. Antes de travar, decida se começamos no 57 ou se esperamos o 58. No 58 o template vem com `web.output: "server"`.
3. **`web.output: "single"`:** é o default quando o campo é omitido. A conclusão de que ele não liga API routes é dedução: a doc diz que as API routes exigem `static`+`apiRoutes` ou `server`.
4. **Bun isolated + Expo:** a correção ([bun#44968](https://github.com/oven-sh/bun/pull/44968)) foi merged em 14/10/2026 e ainda não saiu em release. Não verifiquei se ela elimina o problema; até lá, use hoisted.
5. **Drizzle v1 vs 0.45:** as docs do Drizzle já assumem `@rc`, mas o npm `latest` é 0.45.4. O RC não teve release nova desde 27/06/2026. Não há data para a v1 estável. A página de Drizzle do Elysia está desatualizada (override `@sinclair/typebox` `0.32.4`) e não cobre a v1.
6. **Elysia 2.0** está em beta (`2.0.0-beta.31`). Não verifiquei se ele migra para `typebox` 1.x, o que mudaria a escolha do validador do Drizzle. Também não encontrei nota oficial de depreciação dos pacotes `@elysiajs/*`; a migração para `@elysia/*` foi deduzida das docs e do npm.
7. **Eden entre workspaces:** a doc oficial sugere `paths` com `baseUrl` na raiz, e o Turborepo desaconselha `paths` em pacotes JIT. A abordagem com `exports` + `import type` é inferência minha e precisa ser validada no scaffold, em especial se o Metro (com hoisted) não acaba resolvendo código do servidor.
8. **Bun SQL:** recomendo postgres.js por causa das issues abertas. Não fiz benchmark nem testei as issues.
9. **`turbo prune` com `bun.lock`:** não encontrei em fonte primária se é suportado (relevante para imagem Docker da API).
10. **Lint:** Biome é escolha nossa, sem endosso first-party. Se as regras de hooks e da Expo fizerem falta, a alternativa é `eslint-config-expo` só no `apps/mobile`.
11. **Uniwind free × SDK 57:** a versão free não publica matriz de compatibilidade. O suporte foi deduzido do release 1.10.1 ("update to expo 57"), dos peerDeps e do exemplo `with-router-uniwind` da Expo. Só a Pro tem tabela oficial (SDK 54–57). O exemplo da Expo fixa `uniwind ~1.0.0` e `tailwindcss ~4.1`, que estão desatualizados. Não testei Bun hoisted + `@source` + Expo Router.
12. **Uniwind e Tailwind 4.3.x:** os patches do Tailwind já quebraram o Uniwind três vezes em 2026 (#661, #668, #669). Fixe as versões exatas de `tailwindcss` e `uniwind` no `package.json` e atualize as duas juntas.
13. **Uniwind e componentes de terceiros:** não verifiquei bottom sheet (`@gorhom/bottom-sheet`), `cva`/`tailwind-variants` nem animações. A versão free não anima via `className`, então é preciso usar Reanimated com `style`. A issue #731 (props que terminam em `Style`) segue aberta.
14. **Política de dados por endpoint grátis:** a tabela da §6.3 mostra a política *padrão do provider*. A política do endpoint `:free` pode ser diferente: o Google AI Studio grátis, por exemplo, pode ter termos diferentes do pago. A API pública de endpoints não expõe esse campo. Confirme logado em `/settings/privacy` ou com `GET /api/v1/models/user` depois de configurar os filtros.
15. **LGPD:** a análise da §6.3 é inferência técnica, não parecer jurídico. Falta decidir com quem cuidar do jurídico: base legal, transferência internacional (art. 33), DPA do OpenRouter e se a pseudonimização antes do LLM basta.
16. **Teto dos modelos grátis:** são 1.000 req/dia por conta (com ≥ US$ 10 comprados) e 20 req/min, somados entre os modelos `:free`. Não medi quantas requisições um turno típico com tools consome. O catálogo de modelos grátis muda com frequência, então a lista da §6.2 é um retrato de 14/10/2026.
17. **AI SDK no Bun:** o `@openrouter/ai-sdk-provider` declara Node ≥ 22 e não cita Bun. O `@openrouter/sdk` declara suporte a Bun v1+. Rodar o AI SDK no Bun 1.4 é inferência e precisa ser validado. Também não achei avaliação primária da qualidade em português dos modelos grátis.
