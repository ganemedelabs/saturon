# Saturon Monorepo

![Version](https://img.shields.io/npm/v/saturon)
![Downloads](https://img.shields.io/npm/dw/saturon)
![License](https://img.shields.io/npm/l/saturon)

This repository contains the core `saturon` package and the documentation site for the project.

Saturon is a runtime-extensible JavaScript library for parsing, converting, and manipulating colors with full CSS color spec support.

## 📋 Table of Contents

- [Workspace Structure](#-workspace-structure)
- [Quick Start](#-quick-start)
- [Common Commands](#-common-commands)
- [Project Links](#-project-links)
- [Contributing](#-contributing)
- [License](#-license)

## 📂 Workspace Structure

- `packages/saturon` — published npm package and core library source
- `apps/docs` — Next.js documentation site and examples
- root configuration — workspace scripts and shared tooling

## 🚀 Quick Start

```bash
pnpm install
pnpm dev
```

The root `dev` script starts the docs app, which is the recommended way to work on the project locally.

## 🧪 Common Commands

```bash
pnpm dev              # start the docs site
pnpm build            # build the library and docs site
pnpm build:lib        # build only the core package
pnpm test             # run package tests
pnpm lint             # lint all workspace packages
pnpm format           # format the monorepo
```

## 🔗 Project Links

- Library package: `packages/saturon`
- Docs app: `apps/docs`
- Documentation site: https://saturon.js.org
- npm: https://www.npmjs.com/package/saturon

## 🧠 Contributing

Contributions are welcome. Please refer to the [.github/CONTRIBUTING.md](.github/CONTRIBUTING.md) guide for the full process, branch expectations, and pull request workflow.

## 📜 License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
