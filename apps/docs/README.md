# Saturon Docs

Documentation site for [Saturon](https://www.npmjs.com/package/saturon), a runtime-extensible JavaScript library for parsing, converting, and manipulating colors with full CSS spec support.

This app lives in the monorepo under `apps/docs` and is paired with the core library in `packages/saturon`.

## About the Docs

The site provides:

- API references for the library
- Interactive examples and playgrounds
- Guides and tutorials on color manipulation and color space theory
- Plugin authoring and extensibility documentation

The live docs are available at [saturon.js.org](https://saturon.js.org)

## Local development

### Prerequisites

- Node.js 18+
- pnpm

### Install dependencies

From the monorepo root:

```bash
pnpm install
```

### Run locally

```bash
pnpm dev
```

Then open [http://localhost:3000](http://localhost:3000) to preview the docs.

### Build for production

```bash
pnpm build
```
