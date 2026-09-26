# Saturon

A runtime-extensible JavaScript library for parsing, converting, and manipulating colors with full CSS spec support.

## Features

- Full CSS Color 4/5 parsing
- Infinite nested color functions (for example `color-mix(...)` inside `light-dark(...)`)
- Conversion between modern color spaces such as OKLab, Display-P3, and Rec.2020
- High-precision color math for colorimetry and conversion workflows
- Powerful plugin system for custom color spaces and syntaxes
- Support for complex CSS syntax including nested color functions and expressions

## Installation

```bash
npm install saturon
# or
pnpm add saturon
# or
yarn add saturon
```

## Usage

```js
import { Color } from "saturon";

const color = Color.from("#1481b8ff");
console.log(color.toArray());
console.log(color.to("oklch", { units: true }));
console.log(color.in("lab").toObject({ precision: 1 }));

const modified = color.in("hsl").with({ l: (l) => l * 1.2 });
console.log(modified.toString({ legacy: true }));
```

## Examples

### Converting Colors

```js
const color = Color.from("hsl(337 100% 60%)");
console.log(color.to("rgb"));
console.log(color.to("hex-color"));
```

### Manipulating Components

```js
const color = Color.from("hwb(255 7% 1%)");
const hwb = color.with({ h: 100, b: (b) => b * 20 });
console.log(hwb.toString());
```

### Mixing Colors

```js
const red = Color.from("hsl(0, 100%, 50%)");
const green = Color.from("hsl(120, 100%, 50%)");
const mixed = Color.mix({ in: "hsl", colors: [{ color: red }, { color: green }] });
console.log(mixed.toString());
```

### Registering a Named Color

```js
Color.register("named-colors", [{ name: "sunsetblush", value: [255, 94, 77] }]);
const rgb = Color.from("rgb(255, 94, 77)");
console.log(rgb.to("named-color"));
```

### Registering a Custom Color Function

```js
const converter = {
    components: {
        i: { index: 0, value: [0, 1] },
        ct: { index: 1, value: [-1, 1] },
        cp: { index: 2, value: [-1, 1] },
    },
    bridge: "rgb",
    toBridge: (ictcp) => [/* r, g, b */],
    fromBridge: (rgb) => [/* i, ct, cp */],
};

Color.register("color-models", [{ name: "ictcp", value: converter }]);
const ictcp = Color.from("ictcp(0.2 0.2 -0.1)");
console.log(ictcp.to("rgb"));
```

## Documentation

Full documentation is available at [saturon.js.org](https://saturon.js.org).

## License

This project is licensed under the MIT License. See the root [LICENSE](../../LICENSE) file for details.

## Contact

For inquiries or more information, you can reach out at [ganemedelabs@gmail.com](mailto:ganemedelabs@gmail.com).
