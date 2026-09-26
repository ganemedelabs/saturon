# Saturon Docs

Documentation site for [**Saturon**](https://www.npmjs.com/package/saturon) — a runtime-extensible JavaScript library for parsing, converting, and manipulating colors with full CSS spec support.

This repository contains the **source code and configuration** for the Saturon documentation website.

## 📚 About the Docs

The site provides:

- API references for all classes, methods, and utilities in **Saturon**
- Interactive examples and playgrounds
- Guides and tutorials on color manipulation and color space theory
- Plugin authoring documentation

The live docs are available at:
👉 **[https://saturon.js.org](https://saturon.js.org)**

## 🏗️ Local Development

### Prerequisites

- Node.js ≥ 18
- npm (comes with Node.js)
- Docker (for containerized development, optional)

### Installation

```bash
git clone https://github.com/ganemedelabs/saturon-docs.git
cd saturon-docs
npm install
```

### Running Locally

```bash
npm run dev

# or if you prefer to run it inside a Docker container
docker build -t saturon-docs .
docker run -p 3000:3000 saturon-docs
```

Then open [http://localhost:3000](http://localhost:3000) to preview the docs.

### Building for Production

```bash
npm run build
```

## 🧠 Contributing

We welcome contributions!
If you spot a typo, missing example, or unclear section:

1. Fork the repository
2. Create a new branch (`docs/fix-typo` or `docs/add-example`)
3. Commit your changes
4. Submit a Pull Request

## 📜 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## 🔗 Related Repositories

- **[Saturon (Core Library)](https://github.com/ganemedelabs/saturon)** – The main color manipulation engine
- **[Saturon Docs](https://github.com/ganemedelabs/saturon-docs)** – This repository
