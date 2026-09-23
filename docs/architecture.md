# Arquitetura — EixoForma Mobile

## Camadas

```
UI (src/app, src/components)
  → Services / Use Cases (src/services)
    → Repositories (src/repositories)
      → SQLite (src/database)
```

Componentes React nunca executam SQL nem importam `expo-sqlite` diretamente.
Repositories dependem da interface `SQLiteClient` (`src/database/sqliteClient.ts`),
não de `expo-sqlite` — isso permite rodar migrations e repositories contra um
motor SQLite real em Jest (`tests/support/nodeSqliteClient.ts`, sobre o módulo
nativo `node:sqlite` do Node), em vez de reimplementar as regras de SQL em um
mock JS.

## Prescrição e execução são entidades distintas

`WorkoutPlan → WorkoutDay → PrescribedExercise → PrescribedSet` representa o
que foi prescrito e é imutável do ponto de vista da execução. `WorkoutSession
→ PerformedExercise → PerformedSet` representa o que o aluno realmente fez;
`PerformedSet` referencia `prescribedSetId` por id, mas nunca herda ou
sobrescreve os campos prescritos (ver `tests/repositories/workoutSessionRepository.test.ts`,
teste "registra uma série realizada sem alterar a prescrição").

## SQLite é a fonte local atual

O app não tem backend. Todo o estado (catálogo de exercícios, plano,
sessões, séries realizadas) vive em SQLite local (`expo-sqlite`), com schema
versionado via `PRAGMA user_version` (`src/database/migrate.ts`). Um índice
único parcial (`workout_sessions` com `WHERE status = 'in_progress'`) impede
duas sessões simultâneas no nível do banco, não só na camada de aplicação.

Quando o backend do EixoForma existir, ele deve **substituir/sincronizar a
camada de persistência** (repositories passam a falar com uma API e/ou um
sync engine), não a UI nem o domínio — services e componentes continuam
chamando as mesmas assinaturas.

## Mídia de exercício (ExerciseMedia)

As imagens master de cada exercício (alta resolução, formato de composição
dupla início/fim do movimento) são preservadas no Google Drive EixoForma, não
no repositório — só os derivados `.webp` otimizados (768×768) entram em
`assets/exercises/`, referenciados por `require()` literal em
`src/catalog/exercise-media.ts` (ver comentário no arquivo sobre por que
`require()` precisa ser sempre literal). `assets/exercises-masters/` é local
e ignorado via `.gitignore` quando alguém baixa uma master pra gerar um novo
derivado.

A POC do lote piloto (`ex_agachamento_livre`, `ex_supino_inclinado_halteres`,
`ex_puxada_frente`, `ex_elevacao_lateral`) confirmou que a composição dupla
funciona bem em `hero` (imagem grande, tela de detalhe/execução), mas tem
legibilidade limitada em `thumbnail` (56×56 — as duas poses ficam pequenas
demais pra comunicar o movimento, servem só como assinatura visual do
exercício). Evolução futura prevista, não implementada ainda: `thumbnail`
com uma pose só + `hero` com a composição de duas fases, exigiria estender
`ExerciseMediaEntry` (os campos `start`/`end` já comentados nesse arquivo
seriam o caminho natural).

## Decisões de toolchain

### ESLint fixado em 9.39.5, não a versão mais recente (10.x)

`eslint-config-expo@57.0.2` depende de `eslint-plugin-react@^7.37.3`, cuja
última versão publicada (7.37.5) declara suporte oficial só até
`eslint@^9.7` — com ESLint 10 ele quebra em runtime (`TypeError:
contextOrFilename.getFilename is not a function`, incompatibilidade com a
Context API do ESLint 10). Confirmado rodando `npx expo lint` localmente.
Reavaliar quando o `eslint-config-expo`/`eslint-plugin-react` publicarem uma
versão compatível com ESLint 10.

### `--legacy-peer-deps` (`.npmrc`)

O registro do npm hoje tem `react-dom@19.3.0` (peer `react@^19.3.0`) mais
novo que o `react@19.2.3` que o Expo SDK 57 fixa. `react-dom` é uma
peerDependency **opcional** de `expo` (usada só para suporte web/DOM
components, irrelevante para o app mobile), mas sem `legacy-peer-deps` o
resolver do npm tenta satisfazê-la mesmo assim e todo `npm install` falha
com `ERESOLVE`. `.npmrc` fixa `legacy-peer-deps=true` para que
`npm install`/`npm ci` funcionem sem flag manual, em qualquer máquina ou CI.
Não é um workaround "por cima" de um problema real do projeto — é a
resolução correta de uma peerOptional dependency que este app nunca usa.

### Não rodar `npm audit fix --force` sem análise

`npm audit fix --force` pode trocar `expo` para uma versão fora da faixa do
SDK 57 e quebrar a compatibilidade nativa entre os módulos Expo — nunca
rodar sem antes conferir o que ele pretende alterar (`npm audit fix
--force --dry-run` primeiro, e comparar com `npx expo install --check`
depois).

### 13 vulnerabilidades moderadas conhecidas (toolchain, não runtime)

`npm audit --omit=dev` reporta 13 vulnerabilidades moderadas, todas
transitivas em ferramentas de build da própria Expo (`@expo/cli`,
`@expo/config-plugins`, `xcode`, dependendo de versões antigas de `uuid`).
Nenhuma delas roda no app instalado no dispositivo — são dependências do CLI
usado em tempo de desenvolvimento/build. Revisar a cada atualização de SDK.
