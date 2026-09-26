# Saturon

![Version](https://img.shields.io/npm/v/saturon)
![Downloads](https://img.shields.io/npm/dw/saturon)
![License](https://img.shields.io/npm/l/saturon)

A runtime-extensible JavaScript library for parsing, converting, and manipulating colors with full CSS spec support.

## 📋 Table of Contents

- [Features](#-features)
- [Installation](#-installation)
- [Usage](#-usage)
- [Examples](#-examples)
- [Documentation](#-documentation)
- [License](#-license)
- [Contact](#-contact)

## ✨ Features

- Full CSS Color 4/5 Parsing
- Infinite nested color functions (e.g. `color-mix(...)` inside `light-dark(...)`)
- Converts between all modern color spaces (OKLab, Display-P3, Rec.2020, etc.)
- High-precision color math for serious colorimetry
- Powerful plugin system for custom color spaces and syntaxes
- Supports complex color syntaxes like `color(from hsl(240 none calc(-infinity) / 0.5) display-p3 r calc(g + b) 100 / alpha)`

## 🔧 Installation

```bash
npm install saturon
# or
yarn add saturon
```

## 🚀 Usage

```js
import { Color } from "saturon";

// Parse any CSS color string
const color = Color.from("#1481b8ff");

// Access coordinates
console.log(color.toArray()); // → [20, 129, 184, 1]

// Convert to another format
console.log(color.to("oklch", { units: true })); // → "oklch(0.57368 0.12258 238.41345deg)"

// Access values in another color space
console.log(color.in("lab").toObject({ precision: 1 })); // → { l: 50.5, a: -13.9, b: -37.6, alpha: 1 }

// Modify components
const modified = color.in("hsl").with({ l: (l) => l * 1.2 });
console.log(modified.toString({ legacy: true })); // → "hsl(200, 80%, 48%)"
```

## 💡 Examples

### Converting Colors

```js
const color = Color.from("hsl(337 100% 60%)");
console.log(color.to("rgb")); // → rgb(255 51 129)
console.log(color.to("hex-color")); // → #ff3381
```

### Manipulating Components

```js
const color = Color.from("hwb(255 7% 1%)");
const hwb = color.with({ h: 100, b: (b) => b * 20 });
console.log(hwb.toString()); // → hwb(100 7 20)
```

### Mixing Colors

```js
const red = Color.from("hsl(0, 100%, 50%)");
const green = Color.from("hsl(120, 100%, 50%)");
const mixed = Color.mix({ in: "hsl", colors: [{ color: red }, { color: green }] });
console.log(mixed.toString()); // → hsl(60 100 50)
```

### New Named Color Registration

```js
Color.register("named-colors", [{ name: "sunsetblush", value: [255, 94, 77] }]);
const rgb = Color.from("rgb(255, 94, 77)");
console.log(rgb.to("named-color")); // → sunsetblush
```

### New Color Function Registration

```js
const converter = {
    components: {
        i: { index: 0, value: [0, 1] },
        ct: { index: 1, value: [-1, 1] },
        cp: { index: 2, value: [-1, 1] },
    },
    bridge: "rgb",
    toBridge: (ictcp: number[]) => [/* r, g, b */],
    fromBridge: (rgb: number[]) => [/* i, ct, cp */],
};

Color.register("color-models", [{ name: "ictcp", value: converter }]);
const ictcp = Color.from("ictcp(0.2 0.2 -0.1)");
console.log(ictcp.to("rgb")); // → rgb(6 7 90)
```

## 📚 Documentation

Full documentation is available at [saturon.js.org](https://saturon.js.org).

## 📜 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## 📧 Contact

For inquiries or more information, you can reach out to us at [ganemedelabs@gmail.com](mailto:ganemedelabs@gmail.com).
