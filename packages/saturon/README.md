# Saturon

Saturon is a CSS color engine for JavaScript. It implements the CSS color grammar itself, soo anything a browser accepts works here too: `color-mix()`, relative colors, `calc()`, and any nesting of them.

```typescript
Color.from(
    `color-mix(
        in oklch longer hue,
        color(from hsl(240deg none calc(-infinity) / 0.5) display-p3 r calc(g + b) 100 / alpha),
        rebeccapurple 20%
    )`
).to("hwb");
```

## Why Saturon

- Strings are parsed using a grammar-aware engine rather than standard pattern matching, allowing complex color functions to nest freely.
- Its parsing and conversion performance outperforms Color.js even while enforcing strict, full grammar validation (see [Benchmarks](https://saturon.js.org/docs/benchmarks)).
- All ported Web Platform Tests cases run automatically in CI to ensure high spec conformance (see [Conformance](https://saturon.js.org/docs/conformance)).
- Custom color models and relative color syntax can be registered easily, enabling `color-mix()` and other utilities to work with them seamlessly (see [Recipes](https://saturon.js.org/docs/recipes)).
- The package is fully tree-shakable, letting you import the primary `Color` class or only individual functions as needed (see [Tree Shakability](https://saturon.js.org/docs/guides/tree-shakability)).

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
