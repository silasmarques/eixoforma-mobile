# EixoForma Mobile

App de treino do EixoForma (React Native + Expo). Protótipo offline-first,
prioridade iPhone/iOS, compatibilidade Android preservada desde o primeiro
commit.

## Rodando localmente

```bash
npm install
npm run ios      # abre no iOS Simulator
npm run android   # abre no Android emulator
```

## Scripts

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # expo lint
npm test             # jest
npm run check        # os três acima em sequência
npx expo-doctor       # diagnóstico de config/dependências
```

## Arquitetura

Ver [docs/architecture.md](docs/architecture.md) para as decisões técnicas
(camadas, SQLite, prescrição vs. execução) e as pendências conhecidas de
toolchain.
