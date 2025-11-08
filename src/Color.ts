import { colorModels, colorTypes, colorSpaces } from "./converters.js";
import { cache, clean, fit } from "./utils.js";
import type {
    ComponentDefinition,
    Component,
    MixOptions,
    ColorType,
    OutputType,
    FormattingOptions,
    NamedColor,
    ColorSpace,
    FitMethod,
    ColorModelConverter,
    ColorModel,
    RandomOptions,
    GetOptions,
    ColorConverter,
} from "./types.js";
import { EASINGS } from "./math.js";
import { config } from "./config.js";

/**
 * The `Color` class represents a dynamic CSS color object, allowing for the manipulation
 * and retrieval of colors in various formats (e.g., RGB, HEX, HSL).
 */
export class Color<M extends ColorModel = ColorModel> {
    model: M;
    coords: number[];

    constructor(model: M, coords: number[] = [0, 0, 0, 0]) {
        if (model in colorModels === false) throw new Error(`Unsupported color model: '${model}'`);
        if ([3, 4].includes(coords.length) === false) throw new Error("Coordinates array must have 3 or 4 elements.");

        const c = coords.slice();
        if (c.length === 3) c.push(1);

        this.model = model;
        this.coords = c;
    }

    /**
     * Creates a new `Color` from a color string.
     *
     * @template T - Color model type.
     * @param color - Color string to parse.
     * @returns A new `Color` instance.
     */
    /* eslint-disable no-unused-vars, @typescript-eslint/no-explicit-any */
    static from(color: NamedColor): Color<"rgb">;
    static from(color: `#${string}`): Color<"rgb">;
    static from(color: `rgb(${string})` | `rgba(${string})`): Color<"rgb">;
    static from(color: `hsl(${string})` | `hsla(${string})`): Color<"hsl">;
    static from(color: `hwb(${string})`): Color<"hwb">;
    static from(color: `lab(${string})`): Color<"lab">;
    static from(color: `lch(${string})`): Color<"lch">;
    static from(color: `oklab(${string})`): Color<"oklab">;
    static from(color: `oklch(${string})`): Color<"oklch">;
    static from(color: string): Color<any>;
    static from<T extends ColorModel = ColorModel>(color: string): Color<T>;
    static from<T extends ColorModel = ColorModel>(color: NamedColor | string): Color<T | any> {
        /* eslint-enable no-unused-vars, @typescript-eslint/no-explicit-any */
        const c = clean(color);
        for (const type in colorTypes) {
            const t = type as ColorModel;
            const { parse, bridge, toBridge, isValid } = colorTypes[t];
            if (!isValid(c)) continue;

            const parsed = parse(c);
            const coords = t in colorModels ? parsed : toBridge(parsed);
            const model = (t in colorModels ? t : bridge) as T;
            return new Color(model, coords);
        }
        throw new Error(`Unsupported or invalid color format: '${color}'.`);
    }

    /**
     * Returns the detected color type, or `undefined` if unrecognized.
     *
     * @param color - Color string to analyze.
     * @param strict - Whether to validate full round-trip conversion.
     */
    static type(color: string, strict = false) {
        const c = clean(color);
        for (const type in colorTypes) {
            const t = type as ColorType;
            const { isValid, bridge, parse, toBridge } = colorTypes[t];
            if (!isValid(c)) continue;

            if (!strict) return t;
            try {
                const parsed = parse(c);
                const coords = t in colorModels ? parsed : toBridge(parsed);
                const model = (type in colorModels ? type : bridge) as ColorModel;
                return typeof new Color(model, coords) === "object" ? t : undefined;
            } catch {
                return undefined;
            }
        }
        return undefined;
    }

    /**
     * Validates a color string, optionally for a specific type.
     *
     * @param color - Color string to check.
     * @param type - Optional color type.
     * @returns `true` if valid, otherwise `false`.
     */
    static isValid(color: string, type?: ColorType): boolean; // eslint-disable-line no-unused-vars
    static isValid(color: string, type?: string): boolean; // eslint-disable-line no-unused-vars
    static isValid(color: string, type?: ColorType | string) {
        try {
            if (type) {
                const t = type?.trim().toLowerCase() as ColorType;
                const c = clean(color);

                const { isValid, bridge, parse, toBridge } = colorTypes[t];
                if (!isValid(c)) return false;

                const parsed = parse(c);
                const coords = t in colorModels ? parsed : toBridge(parsed);
                const model = (t in colorModels ? t : bridge) as ColorModel;
                return !!new Color(model, coords);
            }
            return !!Color.from(color);
        } catch {
            return false;
        }
    }

    /**
     * Generates a random `Color` instance.
     *
     * @template M - The color model type.
     * @param options - Random generation options.
     * @returns A new random `Color` instance.
     * @throws If an invalid component is specified.
     */
    static random<M extends ColorModel = ColorModel>(options: RandomOptions<M> = {}) {
        const models = Object.keys(colorModels) as ColorModel[];
        const model = options.model ?? (models[Math.floor(Math.random() * models.length)] as M);
        const { components } = colorModels[model];

        const valid = new Set([...Object.keys(components), "alpha"]);

        for (const section of ["limits", "bias", "base", "deviation"] as const) {
            const record = options[section];
            if (!record) continue;

            for (const key of Object.keys(record)) {
                if (!valid.has(key)) {
                    throw new Error(
                        `Invalid component "${key}" for model "${model}". Valid components: ${[...valid].join(", ")}`
                    );
                }
            }
        }

        const coords: number[] = [];

        for (const [name, comp] of Object.entries(components)) {
            const base = options.base?.[name as Component<M>];
            const dev = options.deviation?.[name as Component<M>];

            let value: number;

            if (base != null && dev != null) {
                const u = Math.random() || 1e-9;
                const v = Math.random() || 1e-9;
                value = base + Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * dev;
            } else {
                let [min, max] =
                    comp.value === "angle" ? [0, 360] : comp.value === "percentage" ? [0, 100] : comp.value;

                const limits = options.limits?.[name as Component<M>];
                if (limits) {
                    const [lMin, lMax] = limits;
                    min = Math.max(min, lMin);
                    max = Math.min(max, lMax);
                }

                let r = Math.random();
                const biasFn = options.bias?.[name as Component<M>];
                if (biasFn) r = biasFn(r);

                value = min + r * (max - min);
            }

            if (comp.value === "angle") value = ((value % 360) + 360) % 360;
            else if (comp.value === "percentage") value = Math.min(100, Math.max(0, value));
            else if (Array.isArray(comp.value)) {
                const [min, max] = comp.value;
                value = Math.min(max, Math.max(min, value));
            } else throw new Error(`Invalid component value definition for "${name}".`);

            coords[comp.index] = value;
        }

        return new Color(model, coords);
    }

    /**
     * Converts this color to a specified format.
     *
     * @param type - Target output format.
     * @param options - Optional formatting options.
     * @returns The formatted color string.
     */
    to(type: string, options?: FormattingOptions): string; // eslint-disable-line no-unused-vars
    to(type: OutputType, options?: FormattingOptions): string; // eslint-disable-line no-unused-vars
    to(type: OutputType | string, options: FormattingOptions = {}) {
        const t = type.toLowerCase() as OutputType;
        const { legacy = false, fit = config.defaults.fit, precision, units = false } = options;
        const conv = colorTypes[t];
        if (!conv) throw new Error(`Unsupported color type: '${t}'.`);

        const { fromBridge, bridge, format } = conv;
        if (!fromBridge || !format) throw new Error(`Invalid output type: '${t}'.`);

        const fmt = (coords: number[]) => format(coords, { legacy, fit, precision, units });

        if (t === this.model) return fmt(this.coords);
        if (t in colorModels) return fmt(this.in(t).toArray({ fit: "none", precision: null }));

        return fmt(fromBridge(this.in(bridge).toArray({ fit: "none", precision: null })));
    }

    /**
     * Converts this color to another model or gives access to its raw values in that model.
     *
     * @template T - Target color model type.
     * @param model - Target color model.
     * @returns A new `Color` instance in the specified model.
     */
    in<T extends ColorModel = ColorModel>(model: T): Color<T>; // eslint-disable-line no-unused-vars
    in(model: string): Color<any>; // eslint-disable-line no-unused-vars, @typescript-eslint/no-explicit-any
    in<T extends ColorModel = ColorModel>(model: string | T): Color<T> {
        const from = this.model;
        const to = model.trim().toLowerCase();
        if (to === from) return new Color(to as T, [...this.coords]);

        let graph = cache.get("graph");
        let paths = cache.get("paths");
        if (!graph) {
            graph = {};
            for (const [name, conv] of Object.entries(colorModels)) {
                const { bridge } = conv as ColorModelConverter;
                graph[name] = [...(graph[name] || []), bridge];
                graph[bridge] = [...(graph[bridge] || []), name];
            }
            cache.set("graph", graph);
        }
        if (!paths) {
            paths = new Map();
            cache.set("paths", paths);
        }

        const key = `${from}-${to}`;
        const coords = this.coords.slice(0, 3);

        if (!paths.has(key)) {
            const queue = [from],
                parent: Record<string, string | null> = { [from]: null };
            for (let i = 0; i < queue.length; i++) {
                const node = queue[i];
                if (node === to) break;
                for (const next of graph[node] || []) {
                    if (!(next in parent)) {
                        parent[next] = node;
                        queue.push(next);
                    }
                }
            }
            const path: string[] = [];
            for (let cur: string | null = to; cur; cur = parent[cur]) path.push(cur);
            path.reverse();
            if (!path.length || path[0] !== from) {
                throw new Error(`Cannot convert from ${from} to ${to}. No path found.`);
            }
            paths.set(key, path);
        }

        let value = [...coords];
        const path = paths.get(key)!;
        for (let i = 0; i < path.length - 1; i++) {
            const a = path[i] as ColorModel,
                b = path[i + 1] as ColorModel;
            const convA = colorModels[a] as ColorModelConverter;
            const convB = colorModels[b] as ColorModelConverter;

            if (convA.toBridge && convA.bridge === b) value = convA.toBridge(value);
            else if (convB.fromBridge && convB.bridge === a) value = convB.fromBridge(value);
            else throw new Error(`No conversion found between ${a} and ${b}.`);
        }

        return new Color(to as T, [...value.slice(0, 3), this.coords[3] ?? 1]);
    }

    /**
     * Formats this color as a string in its current model.
     *
     * @param options - Optional formatting options.
     * @returns The formatted color string.
     */
    toString(options: FormattingOptions = {}) {
        const { format } = colorTypes[this.model] as ColorConverter;
        const { legacy = false, fit = config.defaults.fit, precision, units = false } = options;
        return format?.(this.coords, { legacy, fit, precision, units }) as string;
    }

    /**
     * Returns the color as an object of component values.
     *
     * @param options - Optional retrieval options.
     * @returns An object mapping each component (and alpha) to its numeric value.
     * @throws If the model has no defined components.
     */
    toObject(options: GetOptions = {}) {
        const coords = this.toArray(options);
        const { components } = colorModels[this.model] as unknown as Record<
            string,
            Record<Component<M> | "alpha", ComponentDefinition>
        >;

        if (!components) throw new Error(`Model ${this.model} does not have defined components.`);

        const fullComponents = {
            ...components,
            alpha: { index: 3, value: [0, 1], precision: 3 },
        };

        const result = {} as { [key in Component<M> | "alpha"]: number }; // eslint-disable-line no-unused-vars
        for (const [name, { index }] of Object.entries(fullComponents))
            result[name as Component<M> | "alpha"] = coords[index];

        return result;
    }

    /**
     * Returns the color as an array of component values, optionally normalized and fitted.
     *
     * @param options - Conversion configuration.
     * @returns An array of normalized color components and alpha.
     * @throws If the model has no defined components.
     */
    toArray(options: GetOptions = {}) {
        const { fit: method = config.defaults.fit, precision } = options;
        const { model, coords } = this;
        const { components } = colorModels[model] as unknown as Record<
            string,
            Record<Component<M> | "alpha", ComponentDefinition>
        >;

        if (!components) throw new Error(`Model ${model} does not have defined components.`);

        const defs = {
            ...components,
            alpha: { index: 3, value: [0, 1], precision: 3 },
        };

        const normalize = (c: number, i: number) => {
            const v = Object.values(defs)[i]?.value;
            const [min, max] = Array.isArray(v) ? v : v === "angle" ? [0, 360] : [0, 100];

            if (Number.isNaN(c)) return 0;
            if (c === Infinity) return max;
            if (c === -Infinity) return min;
            return typeof c === "number" ? c : 0;
        };

        const norm = coords.slice(0, 3).map(normalize);
        const fitted = fit(norm, model, {
            method: method as FitMethod,
            precision,
        });
        return [...fitted.slice(0, 3), coords[3]];
    }

    /**
     * Returns a new `Color` instance with updated or replaced component values.
     *
     * This method supports several flexible update styles:
     *
     * ### 1. Direct component update (object)
     * Update one or more components directly by providing a partial object.
     * ```typescript
     * color.with({ l: 50 })
     * color.with({ r: 128, g: 64 })
     * ```
     *
     * ### 2. Functional component update (object with updater functions)
     * You can use updater functions to modify existing component values dynamically.
     * ```typescript
     * color.with({ r: r => r * 2 })
     * ```
     *
     * ### 3. Functional bulk update (function returning object)
     * Pass a function that receives all current components and returns updated ones.
     * ```typescript
     * color.with(({ r, g, b }) => ({
     *   r: r * 0.393 + g * 0.769 + b * 0.189,
     *   g: r * 0.349 + g * 0.686 + b * 0.168,
     *   b: r * 0.272 + g * 0.534 + b * 0.131,
     * }));
     * ```
     *
     * ### 4. Direct coordinate array replacement
     * Replace all component coordinates directly via an array.
     * ```typescript
     * color.with([0.5, 0.6, 0.7, 1]);
     * ```
     *
     * ### 5. Functional coordinate update (function returning array)
     * The updater function can also return a new coordinate array.
     * ```typescript
     * color.with(({ r, g, b }) => [r * 0.5, g * 0.5, b * 0.5, 1]);
     * ```
     *
     * @param values - Either:
     * - a partial object of component values,
     * - an updater function returning an object or array,
     * - or an array of new coordinates.
     * @returns A new `Color` instance with updated values.
     * @throws If the color model has no defined components.
     */
    /* eslint-disable no-unused-vars */
    with(
        values:
            | Partial<{ [K in Component<M> | "alpha"]: number | ((prev: number) => number) }>
            | ((components: { [K in Component<M> | "alpha"]: number }) =>
                  | Partial<{ [K in Component<M> | "alpha"]: number }>
                  | (number | undefined)[])
            | (number | undefined)[]
    ) {
        /* eslint-enable no-unused-vars */
        const { model } = this;
        const coords = this.toArray({ fit: "none", precision: null });
        const { components } = colorModels[model] as unknown as Record<
            string,
            Record<Component<M> | "alpha", ComponentDefinition>
        >;

        if (!components) throw new Error(`Model ${model} does not have defined components.`);

        const defs = {
            ...components,
            alpha: { index: 3, value: [0, 1], precision: 3 },
        };

        const names = Object.keys(defs) as (Component<M> | "alpha")[];

        let newValues:
            | Partial<{ [K in Component<M> | "alpha"]: number | ((prev: number) => number) }> // eslint-disable-line no-unused-vars
            | (number | undefined)[];

        if (typeof values === "function") {
            const result = values(
                Object.fromEntries(names.map((c) => [c, coords[defs[c].index]])) as Record<
                    Component<M> | "alpha",
                    number
                >
            );
            newValues = result;
        } else {
            newValues = values;
        }

        if (Array.isArray(newValues)) {
            const adjusted = coords.map((curr, i) => {
                const incoming = newValues[i];
                const { value } = Object.values(defs).find((d) => d.index === i)!;

                if (typeof incoming !== "number") return curr;

                const [min, max] = Array.isArray(value) ? value : value === "angle" ? [0, 360] : [0, 100];
                if (Number.isNaN(incoming)) return 0;
                if (incoming === Infinity) return max;
                if (incoming === -Infinity) return min;
                return incoming;
            });

            return new Color(model, [...adjusted.slice(0, 3), coords[3]]);
        }

        const next = [...coords];
        for (const name of names) {
            if (!(name in newValues)) continue;
            const { index, value } = defs[name];
            const current = coords[index];
            const raw = newValues[name];
            let val = typeof raw === "function" ? raw(current) : raw;

            if (typeof val === "number") {
                const [min, max] = Array.isArray(value) ? value : value === "angle" ? [0, 360] : [0, 100];
                if (Number.isNaN(val)) val = 0;
                else if (val === Infinity) val = max;
                else if (val === -Infinity) val = min;
            }
            next[index] = val as number;
        }

        return new Color(model, [...next.slice(0, 3), next[3] ?? coords[3]]);
    }

    /**
     * Mixes this color with another by a specified amount.
     *
     * @param other - The color to mix with. Can be a string or a `Color` instance.
     * @param options - Options for how the colors are mixed.
     * @returns A new `Color` instance representing the mixed color.
     * @throws If the color model does not have defined components.
     */
    mix(other: Color<ColorModel> | string, options: MixOptions = {}): Color<M> {
        const { model } = this;
        const coords = this.toArray({ fit: "none", precision: null });
        const { components } = colorModels[model] as unknown as Record<
            string,
            Record<Component<M> | "alpha", ComponentDefinition>
        >;

        if (!components) throw new Error(`Model ${model} does not have defined components.`);

        const { hue = "shorter", amount = 0.5, easing = "linear", gamma = 1.0 } = options;

        const defs = {
            ...components,
            alpha: { index: 3, value: [0, 1], precision: 3 },
        };

        const hueDelta = (a: number, b: number) => {
            const d = (((b - a) % 360) + 360) % 360;
            return d > 180 ? d - 360 : d;
        };

        const hueDeltaLong = (a: number, b: number) =>
            hueDelta(a, b) >= 0 ? hueDelta(a, b) - 360 : hueDelta(a, b) + 360;

        const interpolateHue = (a: number, b: number, t: number, method: string) => {
            const wrapped = (v: number) => ((v % 360) + 360) % 360;
            switch (method) {
                case "shorter":
                    return wrapped(a + t * hueDelta(a, b));
                case "longer":
                    return wrapped(a + t * hueDeltaLong(a, b));
                case "increasing":
                    return wrapped(a * (1 - t) + (b < a ? b + 360 : b) * t);
                case "decreasing":
                    return wrapped(a * (1 - t) + (b > a ? b - 360 : b) * t);
                default:
                    throw new Error(`Invalid hue interpolation method: ${method}`);
            }
        };

        const t = Math.max(0, Math.min(1, amount));
        const ease = typeof easing === "function" ? easing : EASINGS[easing];
        const tt = Math.pow(ease(t), 1 / gamma);

        const otherColor = (typeof other === "string" ? Color.from(other) : other) as Color<M>;
        const thisCoords = coords.slice(0, 3);
        const otherCoords = otherColor.in(model).toArray({ fit: "none", precision: null }).slice(0, 3) as number[];

        const thisAlpha = coords[3];
        const otherAlpha = otherColor.coords[3];

        const hueIndex = Object.entries(defs).find(([k]) => k === "h")?.[1].index;

        if (t === 0) return new Color(model, [...thisCoords, thisAlpha]);
        if (t === 1) return new Color(model, [...otherCoords, otherAlpha]);

        if (thisAlpha < 1 || otherAlpha < 1) {
            const premixed = thisCoords.map((start, i) => {
                const end = otherCoords[i];
                if (i === hueIndex) return interpolateHue(start, end, tt, hue);
                const a = start * thisAlpha;
                const b = end * otherAlpha;
                return a * (1 - tt) + b * tt;
            });

            const mixedAlpha = thisAlpha * (1 - tt) + otherAlpha * tt;
            const mixed =
                mixedAlpha > 0
                    ? premixed.map((c, i) => (i === hueIndex ? c : c / mixedAlpha))
                    : thisCoords.map((_, i) => (i === hueIndex ? premixed[i] : 0));

            return new Color(model, [...mixed, mixedAlpha]);
        }

        const mixedCoords = thisCoords.map((start, i) => {
            const entry = Object.values(defs).find((d) => d.index === i);
            if (!entry) return start;
            const end = otherCoords[i];
            return entry.value === "angle" ? interpolateHue(start, end, tt, hue) : start + (end - start) * tt;
        });

        return new Color(model, [...mixedCoords, 1]);
    }

    /**
     * Fits this color within the specified gamut using a given method.
     *
     * @param gamut - Target color space.
     * @param method - Fitting method (default to `config.defaults.fit` value).
     * @returns A new `Color` instance fitted to the gamut.
     * @throws If the gamut is unsupported.
     */
    within(gamut: ColorSpace, method: FitMethod = config.defaults.fit) {
        const g = gamut.trim().toLowerCase() as ColorSpace;
        if (g in colorSpaces === false) throw new Error(`Unsupported color gamut: '${g}'.`);

        const fitted = this.in(g).toArray({ fit: method, precision: null });
        return new Color(g, fitted).in(this.model);
    }

    /**
     * Calculates the WCAG 2.1 contrast ratio between this color and another.
     *
     * @param other - The comparison color (instance or string).
     * @returns Contrast ratio from 1 to 21.
     *
     * @remarks
     * - Ratios ≥ 4.5 are generally accessible for normal text.
     * - For perceptual accuracy, consider using APCA instead.
     */
    contrast(other: Color<ColorModel> | string) {
        const o = typeof other === "string" ? Color.from(other) : other;
        const [, L1] = this.in("xyz-d65").toArray({ fit: "none", precision: null });
        const [, L2] = o.in("xyz-d65").toArray({ fit: "none", precision: null });
        return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    }

    /**
     * Calculates the color difference (ΔEOK) between the current color and another color using the OKLAB color space.
     *
     * @param other - The other color to compare against (as a Color instance or string).
     * @returns A number in range (0-1) (smaller indicates more similar colors).
     *
     * @remarks
     * This method uses the Euclidean distance in OKLAB color space, scaled to approximate a Just Noticeable Difference (JND) of ~2.
     * OKLAB's perceptual uniformity allows for a straightforward distance calculation without additional weighting.
     * The result is normalized by a factor of 100 to align with OKLAB's L range (0-1) and approximate the JND scale.
     */
    deltaEOK(other: Color<ColorModel> | string) {
        const coordsOptions = { fit: "none", precision: null } as const;
        const [L1, a1, b1] = this.in("oklab").toArray(coordsOptions);
        const [L2, a2, b2] = (typeof other === "string" ? Color.from(other) : other).in("oklab").toArray(coordsOptions);

        const ΔL = L1 - L2;
        const ΔA = a1 - a2;
        const ΔB = b1 - b2;
        const distance = Math.sqrt(ΔL ** 2 + ΔA ** 2 + ΔB ** 2);

        return distance * 100;
    }

    /**
     * Calculates the color difference (ΔE) between two colors using the CIE76 formula.
     * This is a simple Euclidean distance in LAB color space.
     *
     * @param other - The other color to compare against (as a Color instance or string).
     * @returns A number in range (0-1) (smaller indicates more similar colors).
     */
    deltaE76(other: Color<ColorModel> | string) {
        const coordsOptions = { fit: "none", precision: null } as const;
        const [L1, a1, b1] = this.in("lab").toArray(coordsOptions);
        const [L2, a2, b2] = (typeof other === "string" ? Color.from(other) : other).in("lab").toArray(coordsOptions);

        const ΔL = L1 - L2;
        const ΔA = a1 - a2;
        const ΔB = b1 - b2;

        return Math.hypot(ΔL, ΔA, ΔB);
    }

    /**
     * Calculates the color difference (ΔE) between two colors using the CIE94 formula.
     * This method improves perceptual accuracy over CIE76 by applying weighting factors.
     *
     * @param other - The other color to compare against (as a Color instance or string).
     * @returns A number in range (0-1) (smaller indicates more similar colors).
     */
    deltaE94(other: Color<ColorModel> | string) {
        const coordsOptions = { fit: "none", precision: null } as const;
        const [L1, a1, b1] = this.in("lab").toArray(coordsOptions);
        const [L2, a2, b2] = (typeof other === "string" ? Color.from(other) : other).in("lab").toArray(coordsOptions);

        const ΔL = L1 - L2;
        const ΔA = a1 - a2;
        const ΔB = b1 - b2;

        const C1 = Math.sqrt(a1 * a1 + b1 * b1);
        const C2 = Math.sqrt(a2 * a2 + b2 * b2);
        const ΔC = C1 - C2;
        const ΔH = Math.sqrt(Math.max(0, ΔA * ΔA + ΔB * ΔB - ΔC * ΔC));

        const kL = 1,
            kC = 1,
            kH = 1;
        const K1 = 0.045,
            K2 = 0.015;

        const sC = 1 + K1 * C1;
        const sH = 1 + K2 * C1;

        return Math.sqrt((ΔL / kL) ** 2 + (ΔC / (kC * sC)) ** 2 + (ΔH / (kH * sH)) ** 2);
    }

    /**
     * Calculates the color difference (ΔE) between two colors using the CIEDE2000 formula.
     * This is the most perceptually accurate method, accounting for interactions between hue, chroma, and lightness.
     *
     * @param other - The other color to compare against (as a Color instance or string).
     * @returns A number in range (0-1) (smaller indicates more similar colors).
     */
    deltaE2000(other: Color<ColorModel> | string) {
        const coordsOptions = { fit: "none", precision: null } as const;
        const [L1, a1, b1] = this.in("lab").toArray(coordsOptions);
        const [L2, a2, b2] = (typeof other === "string" ? Color.from(other) : other).in("lab").toArray(coordsOptions);

        const π = Math.PI,
            d2r = π / 180,
            r2d = 180 / π;

        const C1 = Math.sqrt(a1 ** 2 + b1 ** 2);
        const C2 = Math.sqrt(a2 ** 2 + b2 ** 2);
        const Cbar = (C1 + C2) / 2;

        const Gfactor = Math.pow(25, 7);
        const C7 = Math.pow(Cbar, 7);
        const G = 0.5 * (1 - Math.sqrt(C7 / (C7 + Gfactor)));

        const adash1 = (1 + G) * a1;
        const adash2 = (1 + G) * a2;

        const Cdash1 = Math.sqrt(adash1 ** 2 + b1 ** 2);
        const Cdash2 = Math.sqrt(adash2 ** 2 + b2 ** 2);

        let h1 = Math.atan2(b1, adash1);
        let h2 = Math.atan2(b2, adash2);
        if (h1 < 0) h1 += 2 * π;
        if (h2 < 0) h2 += 2 * π;
        h1 *= r2d;
        h2 *= r2d;

        const ΔL = L2 - L1;
        const ΔC = Cdash2 - Cdash1;

        const hdiff = h2 - h1;
        const habs = Math.abs(hdiff);
        let Δh = 0;
        if (Cdash1 * Cdash2 !== 0) {
            if (habs <= 180) Δh = hdiff;
            else if (hdiff > 180) Δh = hdiff - 360;
            else Δh = hdiff + 360;
        }
        const ΔH = 2 * Math.sqrt(Cdash1 * Cdash2) * Math.sin((Δh * d2r) / 2);

        const Ldash = (L1 + L2) / 2;
        const Cdash = (Cdash1 + Cdash2) / 2;
        const Cdash7 = Math.pow(Cdash, 7);

        const hsum = h1 + h2;
        let hdash = 0;
        if (Cdash1 === 0 && Cdash2 === 0) {
            hdash = hsum;
        } else if (habs <= 180) {
            hdash = hsum / 2;
        } else if (hsum < 360) {
            hdash = (hsum + 360) / 2;
        } else {
            hdash = (hsum - 360) / 2;
        }

        const lsq = (Ldash - 50) ** 2;
        const SL = 1 + (0.015 * lsq) / Math.sqrt(20 + lsq);
        const SC = 1 + 0.045 * Cdash;

        let T = 1;
        T -= 0.17 * Math.cos((hdash - 30) * d2r);
        T += 0.24 * Math.cos(2 * hdash * d2r);
        T += 0.32 * Math.cos((3 * hdash + 6) * d2r);
        T -= 0.2 * Math.cos((4 * hdash - 63) * d2r);

        const SH = 1 + 0.015 * Cdash * T;
        const Δθ = 30 * Math.exp(-1 * ((hdash - 275) / 25) ** 2);
        const RC = 2 * Math.sqrt(Cdash7 / (Cdash7 + Gfactor));
        const RT = -1 * Math.sin(2 * Δθ * d2r) * RC;

        let dE = (ΔL / SL) ** 2;
        dE += (ΔC / SC) ** 2;
        dE += (ΔH / SH) ** 2;
        dE += RT * (ΔC / SC) * (ΔH / SH);

        return Math.sqrt(dE);
    }

    /**
     * Checks numeric equality with another color within a tolerance.
     *
     * @param other - Color or string to compare.
     * @param epsilon - Allowed floating-point difference (default: 1e-5).
     * @returns `true` if equal within tolerance.
     *
     * @remarks
     * - This method checks **numeric equality** in the underlying color space
     *   (or XYZ if the models differ). It is not a perceptual comparison.
     * - Use this for exactness in conversions, testing, or serialization,
     *   not for determining whether two colors "look the same" to the human eye.
     * - For perceptual comparisons, use one of the ΔE methods instead:
     *   - {@link deltaEOK} (modern, based on OKLAB)
     *   - {@link deltaE76} (basic, Euclidean distance in LAB)
     *   - {@link deltaE94} (weighted improvements over LAB)
     *   - {@link deltaE2000} (most accurate, accounts for perceptual interactions)
     */
    equals(other: Color<ColorModel> | string, epsilon = 1e-5) {
        const o = typeof other === "string" ? Color.from(other) : other;

        if (o.model === this.model) return this.coords.every((v, i) => Math.abs(v - o.coords[i]) <= epsilon);

        const a = this.in("xyz-d65").toArray({ fit: "none", precision: null });
        const b = o.in("xyz-d65").toArray({ fit: "none", precision: null });
        return a.every((v, i) => Math.abs(v - b[i]) <= epsilon);
    }

    /**
     * Determines whether this color lies within a given gamut.
     *
     * @param gamut - Target color space.
     * @param epsilon - Floating-point tolerance (default: 1e-5).
     * @returns `true` if inside gamut, else `false`.
     */
    inGamut(gamut: ColorSpace | string, epsilon = 1e-5) {
        const g = gamut.trim().toLowerCase();
        if (!(g in colorSpaces)) throw new Error(`Unsupported color gamut: '${g}'.`);

        const { components, targetGamut } = colorModels[g as ColorSpace];
        if (!targetGamut) return true;

        const coords = this.in(g).toArray({ fit: "none", precision: null });
        return Object.values(components).every(({ index, value }) => {
            const v = coords[index];
            const [min, max] = Array.isArray(value) ? value : value === "angle" ? [0, 360] : [0, 100];
            return v >= min - epsilon && v <= max + epsilon;
        });
    }
}
