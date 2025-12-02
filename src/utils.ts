import { Color } from "./Color.js";
import { config, systemColors } from "./config.js";
import { colorBases, colorModels, colorFunctions, colorSpaces, colorTypes, namedColors } from "./converters.js";
import { fitMethods } from "./math.js";
import type {
    ColorBase,
    ColorConverter,
    ColorFunction,
    ColorModelConverter,
    ColorModel,
    ColorSpace,
    ColorSpaceConverter,
    ColorType,
    ComponentDefinition,
    FitFunction,
    FitMethod,
    FormattingOptions,
    NamedColor,
    Plugin,
    Config,
    OutputType,
    SystemColor,
} from "./types.js";

/** Global cache for internal Color operations. */
export const cache = new Map();

/** Registered plugin functions for the Color class. */
export const plugins = new Set<(colorClass: typeof Color) => void>(); // eslint-disable-line no-unused-vars

/**
 * Multiplies two matrices or vectors.
 *
 * @param A - The first matrix or vector (1D treated as row vector).
 * @param B - The second matrix or vector (1D treated as column vector).
 * @returns The product:
 * - Scalar if both are vectors.
 * - Vector if one is 1D and the other 2D.
 * - Matrix if both are 2D.
 * @throws If dimensions are incompatible.
 */
export function multiplyMatrices<A extends number[] | number[][], B extends number[] | number[][]>(
    A: A,
    B: B
): A extends number[] ? (B extends number[] ? number : number[]) : B extends number[] ? number[] : number[][] {
    const m = Array.isArray(A[0]) ? A.length : 1;
    const A_matrix: number[][] = Array.isArray(A[0]) ? (A as number[][]) : [A as number[]];
    const B_matrix: number[][] = Array.isArray(B[0]) ? (B as number[][]) : (B as number[]).map((x) => [x]);
    const p = B_matrix[0].length;
    const B_cols = B_matrix[0].map((_, i) => B_matrix.map((x) => x[i]));
    const product = A_matrix.map((row) => B_cols.map((col) => row.reduce((a, c, i) => a + c * (col[i] || 0), 0)));

    if (m === 1) return product[0] as A extends number[] ? (B extends number[] ? number : number[]) : never;
    if (p === 1)
        return product.map((x) => x[0]) as A extends number[] ? (B extends number[] ? number : number[]) : never;
    return product as A extends number[]
        ? B extends number[]
            ? number
            : number[]
        : B extends number[]
          ? number[]
          : number[][];
}

/**
 * Merges user configuration into the existing app config.
 *
 * @param options - Partial configuration to apply.
 */
export function configure(options: Partial<Config>) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const merge = (target: any, source: any) => {
        for (const key in source) {
            if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key])) {
                if (!target[key] || typeof target[key] !== "object") target[key] = {};
                merge(target[key], source[key]);
            } else if (source[key] !== undefined) {
                target[key] = source[key];
            }
        }
    };

    merge(config, options);
}

/**
 * Registers one or more plugins to extend the Color class.
 *
 * @param pluginFns - Functions that receive the Color class and enhance it.
 * @throws If no plugins are provided or a plugin is not a function.
 */
export function use(...pluginFns: Plugin[]) {
    if (!pluginFns.length) throw new Error("use() requires at least one plugin.");

    for (const [i, plugin] of pluginFns.entries()) {
        if (typeof plugin !== "function")
            throw new TypeError(`Plugin at index ${i} is not a function (received ${typeof plugin})`);

        if (plugins.has(plugin)) {
            console.warn(`Plugin at index ${i} is already registered. Skipping.`);
            continue;
        }

        try {
            plugin(Color);
            plugins.add(plugin);
        } catch (err) {
            console.error(`Error running plugin at index ${i}:`, err);
        }
    }
}

const getterRegistry = {
    "color-types": () => Object.keys(colorTypes) as ColorType[],
    "color-bases": () => Object.keys(colorBases) as ColorBase[],
    "color-functions": () => Object.keys(colorFunctions) as ColorFunction[],
    "color-models": () => Object.keys(colorModels) as ColorModel[],
    "color-spaces": () => Object.keys(colorSpaces) as ColorSpace[],
    "named-colors": () => Object.keys(namedColors) as NamedColor[],
    "system-colors": () => Object.keys(systemColors) as SystemColor[],
    "output-types": () => {
        return Object.keys(colorTypes).filter((key) => {
            const type = colorTypes[key as ColorType];
            return (
                typeof type["fromBridge" as keyof typeof type] === "function" &&
                typeof type["format" as keyof typeof type] === "function"
            );
        }) as OutputType[];
    },
    plugins: () => Object.keys(plugins),
    "fit-methods": () => ["none", "clip", ...Object.keys(fitMethods)] as FitMethod[],
} as const;

type Getter = keyof typeof getterRegistry;

/**
 * Retrieve a list of registered items of a specified type.
 *
 * @param type - The getter type, e.g. "color-types".
 * @returns The array returned by the getter.
 */
export function get<T extends Getter>(type: T) {
    const fn = getterRegistry[type];
    return fn() as ReturnType<(typeof getterRegistry)[T]>;
}

const converterRegistry = {
    /* eslint-disable no-unused-vars */
    "color-type": { fn: registerColorType as (name: string, value: ColorConverter) => void },
    "color-base": { fn: registerColorBase as (name: string, value: ColorConverter) => void },
    "color-function": { fn: registerColorFunction as (name: string, value: ColorModelConverter) => void },
    "color-space": { fn: registerColorSpace as (name: string, value: ColorSpaceConverter) => void },
    "named-color": { fn: registerNamedColor as (name: string, value: number[]) => void },
    "fit-method": { fn: registerFitMethod as (name: string, value: FitFunction) => void },
    /* eslint-enable no-unused-vars */
} as const;

type ConverterType = keyof typeof converterRegistry;

type ConverterEntry<T extends ConverterType> = {
    name: string;
    value: Parameters<(typeof converterRegistry)[T]["fn"]>[1];
};

/**
 * Bulk register multiple converters of a specified type.
 *
 * @param type - The converter type, e.g. "color-function".
 * @param entries - Array of { name, value } objects.
 */
export function register<T extends ConverterType>(type: T, entries: ConverterEntry<T>[]) {
    const fn = converterRegistry[type].fn;
    for (const entry of entries) fn(entry.name, entry.value as any); // eslint-disable-line @typescript-eslint/no-explicit-any
}

/**
 * Registers a new `<color>` converter under the specified name.
 *
 * @param name - Unique name for the `<color>` converter.
 * @param converter - Converter implementing color conversion logic.
 * @throws If the name is already used or the converter is invalid.
 */
export function registerColorType(name: string, converter: ColorConverter) {
    const n = name.replace(/(?:\s+)/g, "-").toLowerCase() as ColorType;
    const types = colorTypes as Record<string, ColorConverter>;

    if (n in types) {
        throw new Error(`The name '${n}' is already used.`);
    }

    if (typeof converter !== "object" || converter === null) {
        throw new TypeError("Converter must be a non-null object.");
    }

    const requiredFns: Array<[keyof ColorConverter, string]> = [
        ["isValid", "function"],
        ["bridge", "string"],
        ["toBridge", "function"],
        ["parse", "function"],
    ];

    for (const [key, type] of requiredFns) {
        if (typeof converter[key] !== type) {
            throw new TypeError(`Converter.${String(key)} must be a ${type}.`);
        }
    }

    const hasFromBridge = "fromBridge" in converter;
    const hasFormat = "format" in converter;

    if (hasFromBridge && typeof converter.fromBridge !== "function") {
        throw new TypeError("Converter.fromBridge must be a function if provided.");
    }

    if (hasFormat && typeof converter.format !== "function") {
        throw new TypeError("Converter.format must be a function if provided.");
    }

    if (hasFromBridge !== hasFormat) {
        throw new Error("Converter.fromBridge and Converter.format must either both be provided or both be omitted.");
    }

    if (converter.bridge in colorModels === false) {
        throw new Error(`Converter.bridge '${converter.bridge}' does not correspond to any registered color model.`);
    }

    types[n] = converter;
    cache.delete("graph");
    cache.delete("paths");
}

/**
 * Registers a new `<color-base>` converter under the specified name.
 *
 * @param name - The unique name for the `<color-base>` converter.
 * @param converter - Converter implementing color conversion logic.
 * @throws If the name is already used or the converter is invalid.
 */
export function registerColorBase(name: string, converter: ColorConverter) {
    const n = name.replace(/(?:\s+)/g, "-").toLowerCase() as ColorType;
    const bases = colorBases as Record<string, ColorConverter>;
    const types = colorTypes as Record<string, ColorConverter>;

    if (n in types) {
        throw new Error(`The name '${n}' is already used.`);
    }

    if (typeof converter !== "object" || converter === null) {
        throw new TypeError("Converter must be a non-null object.");
    }

    const requiredFns: Array<[keyof ColorConverter, string]> = [
        ["isValid", "function"],
        ["bridge", "string"],
        ["toBridge", "function"],
        ["parse", "function"],
    ];

    for (const [key, type] of requiredFns) {
        if (typeof converter[key] !== type) {
            throw new TypeError(`Converter.${String(key)} must be a ${type}.`);
        }
    }

    const hasFromBridge = "fromBridge" in converter;
    const hasFormat = "format" in converter;

    if (hasFromBridge && typeof converter.fromBridge !== "function") {
        throw new TypeError("Converter.fromBridge must be a function if provided.");
    }

    if (hasFormat && typeof converter.format !== "function") {
        throw new TypeError("Converter.format must be a function if provided.");
    }

    if (hasFromBridge !== hasFormat) {
        throw new Error("Converter.fromBridge and Converter.format must either both be provided or both be omitted.");
    }

    if (converter.bridge in colorModels === false) {
        throw new Error(`Converter.bridge '${converter.bridge}' does not correspond to any registered color model.`);
    }

    bases[n] = converter;
    types[n] = converter;
    cache.delete("graph");
    cache.delete("paths");
}

/**
 * Registers a new `<color-function>` converter under the specified name.
 *
 * @param name - The unique name for the `<color-function>` converter.
 * @param converter - Converter implementing color conversion logic.
 * @throws If the name is already used or the converter is invalid.
 */
export function registerColorFunction(name: string, converter: ColorModelConverter) {
    const n = name.replace(/(?:\s+)/g, "").toLowerCase() as ColorType;
    const models = colorModels as unknown as Record<string, ColorModelConverter>;
    const functions = colorFunctions as Record<string, ColorConverter>;
    const types = colorTypes as Record<string, ColorConverter>;

    if (
        typeof converter.components === "object" &&
        converter.components !== null &&
        !Array.isArray(converter.components)
    ) {
        const normalized: Record<string, ComponentDefinition> = {};
        for (const key of Object.keys(converter.components)) {
            normalized[key.toLowerCase()] = converter.components[key];
        }
        converter.components = normalized;
    } else {
        throw new TypeError("Converter.components must be a non-null object.");
    }

    if (n in types) {
        throw new Error(`The name '${n}' is already used.`);
    }

    if (typeof converter !== "object" || converter === null) {
        throw new TypeError("Converter must be a non-null object.");
    }

    const requiredFns: Array<[keyof ColorModelConverter, string]> = [
        ["bridge", "string"],
        ["toBridge", "function"],
        ["fromBridge", "function"],
    ];

    for (const [key, type] of requiredFns) {
        if (typeof converter[key] !== type) {
            throw new TypeError(`Converter.${String(key)} must be a ${type}.`);
        }
    }

    if (converter.bridge in colorModels === false) {
        throw new Error(`Converter.bridge '${converter.bridge}' does not correspond to any registered color model.`);
    }

    if ("targetGamut" in converter && converter.targetGamut !== null && typeof converter.targetGamut !== "string") {
        throw new TypeError(`Converter.targetGamut must be a string or null.`);
    }

    if ("supportsLegacy" in converter && typeof converter.supportsLegacy !== "boolean") {
        throw new TypeError(`Converter.supportsLegacy must be a boolean.`);
    }

    if ("alphaVariant" in converter && typeof converter.alphaVariant !== "string") {
        throw new TypeError(`Converter.alphaVariant must be a string.`);
    }

    const componentNames = Object.keys(converter.components);
    if (new Set(componentNames).size !== componentNames.length) {
        throw new Error("Converter.components must have unique component names.");
    }
    if (componentNames.includes("none")) {
        throw new Error('Converter.components cannot have a component named "none".');
    }

    const colorConv = modelConverterToColorConverter(n, converter);
    models[n] = converter;
    functions[n] = colorConv;
    types[n] = colorConv;
    cache.delete("graph");
    cache.delete("paths");
}

/**
 * Registers a new color space converter for `<color()>` function under the specified name.
 *
 * @param name - The unique name for the color space converter.
 * @param converter - Converter implementing color space conversion logic.
 * @throws If the name is already used or the converter is invalid.
 */
export function registerColorSpace(name: string, converter: ColorSpaceConverter) {
    const n = name.replace(/(?:\s+)/g, "-").toLowerCase() as ColorType;
    const spaces = colorSpaces as unknown as Record<string, ColorModelConverter>;
    const models = colorModels as unknown as Record<string, ColorModelConverter>;
    const functions = colorFunctions as Record<string, ColorConverter>;
    const types = colorTypes as Record<string, ColorConverter>;

    if (n in types) {
        throw new Error(`The name '${n}' is already used.`);
    }

    if (typeof converter !== "object" || converter === null) {
        throw new TypeError("Converter must be a non-null object.");
    }

    if (!Array.isArray(converter.components) || converter.components.some((c) => typeof c !== "string")) {
        throw new TypeError("Converter.components must be an array of strings.");
    }

    if (typeof converter.bridge !== "string") {
        throw new TypeError("Converter.bridge must be a string.");
    }

    const matrixChecks: Array<[keyof ColorSpaceConverter, string]> = [
        ["toBridgeMatrix", "toBridgeMatrix"],
        ["fromBridgeMatrix", "fromBridgeMatrix"],
    ];

    for (const [key, label] of matrixChecks) {
        const matrix = converter[key];
        if (
            !Array.isArray(matrix) ||
            matrix.some((row) => !Array.isArray(row) || row.some((val) => typeof val !== "number"))
        ) {
            throw new TypeError(`Converter.${label} must be a 2D array of numbers.`);
        }
    }

    if (converter.bridge in colorModels === false) {
        throw new Error(`Converter.bridge '${converter.bridge}' does not correspond to any registered color model.`);
    }

    if ("targetGamut" in converter && converter.targetGamut !== null) {
        throw new TypeError("Converter.targetGamut must be null if provided.");
    }

    if ("toLinear" in converter && typeof converter.toLinear !== "function") {
        throw new TypeError("Converter.toLinear must be a function if provided.");
    }

    if ("fromLinear" in converter && typeof converter.fromLinear !== "function") {
        throw new TypeError("Converter.fromLinear must be a function if provided.");
    }

    const modelConv = spaceConverterToModelConverter(n, converter);
    const colorConv = modelConverterToColorConverter(n, modelConv);

    spaces[n] = modelConv;
    models[n] = modelConv;
    functions[n] = colorConv;
    types[n] = colorConv;
    cache.delete("graph");
    cache.delete("paths");
}

/**
 * Registers a new `<named-color>` with the specified RGB value.
 *
 * @param name - Color name (letters only, case-insensitive).
 * @param rgb - RGB array [r, g, b].
 * @throws If RGB is invalid, or the name or value is already registered.
 */
export function registerNamedColor(name: string, rgb: number[]) {
    if (!Array.isArray(rgb) || rgb.length !== 3) {
        throw new Error(`RGB value must be an array of exactly three numbers, received length ${rgb.length}.`);
    }

    const n = name.replace(/[^a-zA-Z]/g, "").toLowerCase() as NamedColor;
    const names = namedColors as Record<NamedColor, number[]>;

    if (names[n]) {
        throw new Error(`<named-color> '${n}' is already registered.`);
    }

    const duplicate = Object.entries(names).find(([, value]) => value.every((channel, i) => channel === rgb[i]));

    if (duplicate) {
        throw new Error(`RGB value [${rgb.join(", ")}] is already registered as '${duplicate[0]}'.`);
    }

    names[n] = rgb;
}

/**
 * Registers a new fit method under a specified name.
 *
 * @param name - Name for the fit method (whitespace → hyphens, lowercased).
 * @param method - The fit function.
 * @throws If name exists or method is not a function.
 */
export function registerFitMethod(name: string, method: FitFunction) {
    const n = name.trim().replace(/\s+/g, "-").toLowerCase() as FitMethod;
    const methods = fitMethods as Record<string, FitFunction>;

    if (n in methods) throw new Error(`Fit method '${n}' already exists.`);
    if (typeof method !== "function") throw new TypeError("Fit method must be a function.");

    methods[n] = method;
}

/**
 * Unregisters one or more color types from the registry.
 *
 * @param types - Names of color types to remove.
 */
export function unregister(...types: string[]) {
    for (const type of types) {
        delete colorTypes[type as ColorType];
        delete colorBases[type as ColorBase];
        delete colorFunctions[type as ColorFunction];
        delete colorModels[type as ColorModel];
        delete colorSpaces[type as ColorSpace];
    }
    cache.delete("graph");
    cache.delete("paths");
}

/**
 * Cleans and normalizes a CSS color string.
 *
 * @param color - The CSS color string.
 * @returns The normalized string.
 */
export function clean(color: string) {
    return color
        .trim()
        .replace(/\s+/g, " ")
        .replace(/\( /g, "(")
        .replace(/ \)/g, ")")
        .replace(/\s*,\s*/g, ", ")
        .replace(/ ,/g, ",")
        .replace(/calc\(NaN\)/g, "0")
        .replace(/[A-Z]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 32));
}

/**
 * Extracts a balanced expression from a string starting at a given index.
 *
 * - If the character at `start` is '(', extracts the full parenthetical expression (including nested parentheses).
 * - Otherwise, extracts a contiguous sequence of alphanumeric characters, hyphens, percent signs, or '#'.
 *
 * @param input - The string to extract from.
 * @param start - Index to start extraction.
 * @returns An object with the extracted `expression` and the index `end` after it.
 */
export function extractBalancedExpression(input: string, start: number) {
    let i = start;
    let expression = "";
    let depth = 0;

    if (input[i] !== "(") {
        while (i < input.length && /[a-zA-Z0-9-%#]/.test(input[i])) {
            expression += input[i];
            i++;
        }
    }

    if (input[i] === "(") {
        expression += "(";
        i++;
        depth = 1;

        while (i < input.length && depth > 0) {
            const char = input[i];
            if (char === "(") depth++;
            else if (char === ")") depth--;
            if (depth > 0) expression += char;
            i++;
        }
        expression += ")";
    }

    return { expression, end: i };
}

/**
 * Fits or clips color coordinates to a specified model and gamut.
 *
 * @param coords - Color coordinates to fit/clip.
 * @param model - Target color model.
 * @param options - Optional settings: method ("clip", "none", etc.) and precision.
 * @returns Fitted/clipped color coordinates.
 * @throws If component properties are missing or an invalid method is specified.
 */
export function fit(
    coords: number[],
    model: ColorModel,
    options: { method?: FitMethod; precision?: number | null } = {}
) {
    const { method = config.defaults.fit, precision } = options;
    const { components } = colorModels[model] as ColorModelConverter;

    const componentProps: ComponentDefinition[] = Object.values(components).reduce<ComponentDefinition[]>(
        (arr, props) => ((arr[props.index] = props), arr),
        []
    );

    let clipped: number[];

    if (method === "none") {
        clipped = coords;
    } else if (method === "clip") {
        clipped = coords.slice(0, 3).map((v, i) => {
            const prop = componentProps[i];
            if (!prop) throw new Error(`Missing component properties for index ${i}.`);
            if (prop.value === "angle") return ((v % 360) + 360) % 360;

            const [min, max] = Array.isArray(prop.value) ? prop.value : [0, 100];
            return Math.min(max, Math.max(min, v));
        });
    } else {
        const fn = fitMethods[method];
        if (!fn) {
            throw new Error(`Invalid gamut clipping method: must be ${Object.keys(fitMethods).join(", ")} or "none".`);
        }
        clipped = fn(coords, model);
    }

    return clipped.slice(0, 3).map((v, i) => {
        let p: number | null;
        if (typeof precision === "number" || precision === null) p = precision;
        else if (typeof precision === "undefined") p = componentProps[i]?.precision ?? 3;
        else throw new TypeError(`Invalid precision value: ${precision}.`);

        return p === null ? v : Number(v.toFixed(p));
    });
}

/**
 * Converts a color model converter to `<color>` converter.
 *
 * @param name - The name of the color model.
 * @param converter - The color model converter definition.
 * @returns An object of type `ColorConverter`.
 */
export function modelConverterToColorConverter(name: string, converter: ColorModelConverter) {
    type AST = {
        fn: string;
        space: string | null;
        fromOrigin: string | null;
        c1: string;
        c2: string;
        c3: string;
        alpha: string;
        commaSeparated: boolean;
    };

    const evaluateComponent = (
        token: string,
        value: number[] | "angle" | "percentage",
        base: Record<string, number> = {},
        commaSeparated = false,
        relative = false
    ) => {
        const parsePercent = (str: string, min: number, max: number) => {
            const percent = parseFloat(str);
            if (isNaN(percent)) throw new Error(`Invalid percentage value: '${str}'.`);
            if (value === "percentage") return percent;
            if (min < 0 && max > 0) return ((percent / 100) * (max - min)) / 2;
            return (percent / 100) * (max - min) + min;
        };

        const parseAngle = (token: string) => {
            const value = parseFloat(token);
            if (isNaN(value)) throw new Error(`Invalid angle value: '${token}'.`);
            if (token.slice(-3) === "deg") return value;
            if (token.slice(-3) === "rad") return value * (180 / pi);
            if (token.slice(-4) === "grad") return value * 0.9;
            if (token.slice(-4) === "turn") return value * 360;
            return value;
        };

        const parseCalc = (token: string, _min: number, _max: number) => {
            type T = { type: "number" | "identifier" | "operator"; value: number | string };
            type N =
                | { type: "number"; value: number }
                | { type: "var"; name: string }
                | { type: "binary"; op: string | number; left: N; right: N }
                | { type: "unary"; op: string | number; arg: N }
                | { type: "call"; func: string; args: N[] };

            const tokenize = (s: string): T[] => {
                const out: T[] = [];
                for (let i = 0; i < s.length; ) {
                    const c = s[i];
                    if (/\s/.test(c)) {
                        i++;
                        continue;
                    }
                    if (s.slice(i, i + 2) === "**") {
                        out.push({ type: "operator", value: "**" });
                        i += 2;
                        continue;
                    }
                    if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(s[i + 1] || ""))) {
                        let num = "";
                        while (i < s.length && /[0-9.]/.test(s[i])) num += s[i++];
                        if (i < s.length && /[eE]/.test(s[i])) {
                            num += s[i++];
                            if (/[+-]/.test(s[i])) num += s[i++];
                            while (i < s.length && /[0-9]/.test(s[i])) num += s[i++];
                        }
                        out.push({ type: "number", value: parseFloat(num) });
                        continue;
                    }
                    if (/[a-zA-Z_]/.test(c)) {
                        let id = "";
                        while (i < s.length && /[a-zA-Z0-9_]/.test(s[i])) id += s[i++];
                        out.push({ type: "identifier", value: id });
                        continue;
                    }
                    if ("+-*/%(),".includes(c)) {
                        out.push({ type: "operator", value: c });
                        i++;
                        continue;
                    }
                    throw new Error(`Unexpected character: ${c}`);
                }
                return out;
            };

            const parse = (tokens: T[]): N => {
                let pos = 0;
                const cur = (): T | null => (pos < tokens.length ? tokens[pos] : null);
                const nxt = (): T => {
                    if (pos >= tokens.length) throw new Error("Unexpected end of input");
                    return tokens[pos++];
                };
                const expect = (v: string) => {
                    const t = cur();
                    if (!t || t.value !== v)
                        throw new Error(`Expected "${v}" but got "${t ? t.value : "end of input"}`);
                    nxt();
                };

                const parsePrimary = (): N => {
                    const t = cur();
                    if (!t) throw new Error("Unexpected end of input");
                    if (t.type === "number") {
                        nxt();
                        return { type: "number", value: t.value as number };
                    }
                    if (t.type === "identifier") {
                        nxt();
                        if (cur() && cur()!.value === "(") {
                            nxt();
                            const args: N[] = [];
                            if (cur() && cur()!.value !== ")") {
                                args.push(parseAdd());
                                while (cur() && cur()!.value === ",") {
                                    nxt();
                                    args.push(parseAdd());
                                }
                            }
                            expect(")");
                            return { type: "call", func: t.value as string, args };
                        }
                        return { type: "var", name: t.value as string };
                    }
                    if (t.value === "(") {
                        nxt();
                        const e = parseAdd();
                        expect(")");
                        return e;
                    }
                    throw new Error(`Unexpected token: ${t.value}`);
                };

                const parseUnary = (): N => {
                    if (cur() && (cur()!.value === "+" || cur()!.value === "-")) {
                        const op = nxt().value as string;
                        return { type: "unary", op, arg: parseUnary() };
                    }
                    return parsePrimary();
                };

                const parsePower = (): N => {
                    let left = parseUnary();
                    while (cur() && cur()!.value === "**") {
                        const op = nxt().value as string;
                        left = { type: "binary", op, left, right: parseUnary() };
                    }
                    return left;
                };

                const parseMul = (): N => {
                    let left = parsePower();
                    while (cur() && ["*", "/", "%"].includes(String(cur()!.value))) {
                        const op = nxt().value as string;
                        left = { type: "binary", op, left, right: parsePower() };
                    }
                    return left;
                };

                const parseAdd = (): N => {
                    let left = parseMul();
                    while (cur() && (cur()!.value === "+" || cur()!.value === "-")) {
                        const op = nxt().value as string;
                        left = { type: "binary", op, left, right: parseMul() };
                    }
                    return left;
                };

                const ast = parseAdd();
                if (pos < tokens.length)
                    throw new Error(
                        `Extra tokens after expression: ${tokens
                            .slice(pos)
                            .map((t) => t.value)
                            .join(" ")}`
                    );
                return ast;
            };

            // eslint-disable-next-line no-unused-vars
            const evaluate = (ast: N, env: Record<string, number | ((...a: number[]) => number)>): number => {
                switch (ast.type) {
                    case "number":
                        return ast.value;
                    case "var": {
                        const v = env[ast.name];
                        if (v === undefined) throw new Error(`Unknown variable: ${ast.name}`);
                        if (typeof v === "function")
                            throw new Error(`Expected variable but found function: ${ast.name}`);
                        return v as number;
                    }
                    case "binary": {
                        const L = evaluate(ast.left, env),
                            R = evaluate(ast.right, env);
                        switch (ast.op) {
                            case "+":
                                return L + R;
                            case "-":
                                return L - R;
                            case "*":
                                return L * R;
                            case "/":
                                return L / R;
                            case "%":
                                return L % R;
                            case "**":
                                return L ** R;
                            default:
                                throw new Error(`Unknown binary operator: ${ast.op}`);
                        }
                    }
                    case "unary": {
                        const v = evaluate(ast.arg, env);
                        switch (ast.op) {
                            case "+":
                                return +v;
                            case "-":
                                return -v;
                            default:
                                throw new Error(`Unknown unary operator: ${ast.op}`);
                        }
                    }
                    case "call": {
                        const fn = env[ast.func];
                        if (typeof fn !== "function") throw new Error(`Unknown function: ${ast.func}`);
                        return (fn as (...a: number[]) => number)(...ast.args.map((a) => evaluate(a, env))); // eslint-disable-line no-unused-vars
                    }
                    default: {
                        throw new Error(`Unknown AST node type: ${(ast as any).type}`); // eslint-disable-line @typescript-eslint/no-explicit-any
                    }
                }
            };

            let inner = token.slice(5, -1).trim();
            if (inner === "infinity") return _max;
            if (inner === "-infinity") return _min;
            if (inner === "NaN") return 0;

            inner = inner.replace(/(\d+(\.\d+)?)%/g, (m) => {
                if (relative === true)
                    throw new Error("<angle> and <percentage> values are converted to <number> in relative syntax.");
                const r = parsePercent(m, _min, _max);
                return r !== undefined ? String(r) : "0";
            });

            inner = inner.replace(/(\d+(\.\d+)?)(deg|rad|grad|turn)/g, (_, num, __, unit) => {
                if (relative === true)
                    throw new Error("<angle> and <percentage> values are converted to <number> in relative syntax.");
                return String(parseAngle(`${parseFloat(num)}${unit}`));
            });

            const caclEnv = {
                ...base,
                pi,
                e,
                tau: pi * 2,
                pow,
                sqrt,
                sin,
                cos,
                tan,
                asin,
                acos,
                atan,
                atan2,
                exp,
                log,
                log10,
                log2,
                abs,
                min,
                max,
                hypot,
                round,
                ceil,
                floor,
                sign,
                trunc,
                random,
            };

            try {
                const tokens = tokenize(inner);
                const ast = parse(tokens);
                const result = evaluate(ast, caclEnv);
                return result as number;
            } catch (err) {
                throw new Error(`Evaluation error: ${err}`);
            }
        };

        const evaluateAngle = () => {
            if (/^-?(?:\d+|\d*\.\d+)(?:deg|rad|grad|turn)$/.test(token)) {
                return parseAngle(token);
            }

            if (/^-?(?:\d+|\d*\.\d+)$/.test(token)) {
                return parseFloat(token);
            }

            const [min, max] = [0, 360];

            if (token[token.length - 1] === "%") {
                if (commaSeparated && supportsLegacy === true) {
                    throw new Error("The legacy color syntax does not allow percentages for <angle> components.");
                }
                if (relative === true) {
                    throw new Error("The relative color syntax doesn't allow percentages for <angle> components.");
                }
                return parsePercent(token, min, max);
            }

            if (token.slice(0, 5) === "calc(") {
                return parseCalc(token, min, max);
            }

            throw new Error(
                `Invalid angle value: '${token}'. Must be a number, a number with a unit (deg, rad, grad, turn), or a percentage.`
            );
        };

        const evaluatePercent = () => {
            if (/^-?(?:\d+|\d*\.\d+)$/.test(token)) {
                if (commaSeparated && supportsLegacy === true) {
                    throw new Error("The legacy color syntax does not allow numbers for <percentage> components.");
                }
                return parseFloat(token);
            }

            const [min, max] = [0, 100];

            if (token[token.length - 1] === "%") {
                return parsePercent(token, min, max);
            }

            if (token.slice(0, 5) === "calc(") {
                return parseCalc(token, min, max);
            }

            throw new Error(`Invalid percentage value: '${token}'. Must be a percentage or a number.`);
        };

        const evaluateNumber = () => {
            if (/^-?(?:\d+|\d*\.\d+)$/.test(token)) {
                return parseFloat(token);
            }

            const [min, max] = value as number[];

            if (token[token.length - 1] === "%") {
                return parsePercent(token, min, max);
            }

            if (token.slice(0, 5) === "calc(") {
                return parseCalc(token, min, max);
            }

            throw new Error(
                `Invalid number value: '${token}'. Must be a number${relative === false ? " or a percentage" : ""}.`
            );
        };

        if (token === "none") return 0;

        if (token in base) return base[token];

        if (value === "angle") return evaluateAngle();

        if (value === "percentage") return evaluatePercent();

        if (Array.isArray(value)) return evaluateNumber();

        throw new Error(`Unable to parse component token: ${token}`);
    };

    const parseAST = (ast: AST) => {
        const { fn, space, fromOrigin, c1, c2, c3, alpha, commaSeparated } = ast;
        const { components, supportsLegacy } = converter;
        components.alpha = { index: 3, value: [0, 1], precision: 3 };

        if (commaSeparated && supportsLegacy !== true) {
            throw new Error(`<${fn}()> does not support comma-separated syntax.`);
        }

        const sorted = Object.entries(components).sort((a, b) => a[1].index - b[1].index);

        if (fromOrigin) {
            let colorSpace;
            if (fn === "color") {
                colorSpace = space;
            } else if (fn in colorModels) {
                colorSpace = fn;
            } else {
                for (const model in colorModels) {
                    if ((colorModels[model as ColorModel] as ColorModelConverter).alphaVariant === fn) {
                        colorSpace = model;
                        break;
                    }
                }
            }

            const originComponents = Color.from(fromOrigin)
                .in(colorSpace as ColorModel)
                .toObject({ fit: "none", precision: null });

            const evaluatedComponents = [c1, c2, c3, alpha].map((token, i) => {
                const [, meta] = sorted[i];

                return evaluateComponent(token, meta.value, originComponents, commaSeparated, true);
            });

            return evaluatedComponents.slice(0, 4);
        } else {
            const result: number[] = [];
            const percentFlags: boolean[] = [];
            const tokens = [c1, c2, c3, alpha];

            for (let i = 0; i < sorted.length; i++) {
                const [, meta] = sorted[i];
                const token = tokens[i];

                if (commaSeparated && token === "none") {
                    throw new Error(`${fn}() cannot use "none" in comma-separated syntax.`);
                }

                if (
                    meta.index !== 3 &&
                    meta.value !== "angle" &&
                    meta.value !== "percentage" &&
                    token.slice(0, 5) !== "calc("
                ) {
                    percentFlags.push(token.trim()[token.length - 1] === "%");
                }

                if (token) {
                    const value = evaluateComponent(token, meta.value, {}, commaSeparated);
                    result[meta.index] = value;
                }
            }

            if (commaSeparated && percentFlags.length > 1) {
                const allPercent = percentFlags.every(Boolean);
                const nonePercent = percentFlags.every((f) => !f);
                if (!allPercent && !nonePercent) {
                    throw new Error(`${fn}()'s <number> components must all be numbers or all percentages.`);
                }
            }

            return result.slice(0, 4);
        }
    };

    /**
     * Index reference
     *
     * | 0     | 1    | 2   | 3    | 4 | 5   | 6   | 7     | 8     |
     * -------------------------------------------------------------
     * | rgb   | 255  | ,   | 0    | , | 0   |     |       |       |
     * | rgb   | 255  | ,   | 0    | , | 0   | ,   | 0.5   |       |
     * | rgb   | 255  | 0   | 0    |   |     |     |       |       |
     * | rgb   | 255  | 0   | 0    | / | 0.5 |     |       |       |
     * | rgb   | from | red | r    | g | b   |     |       |       |
     * | rgb   | from | red | r    | g | b   | /   | alpha |       |
     * | color | srgb | 1   | 0    | 0 |     |     |       |       |
     * | color | srgb | 1   | 0    | 0 | /   | 0.5 |       |       |
     * | color | from | red | srgb | r | g   | b   |       |       |
     * | color | from | red | srgb | r | g   | b   | /     | alpha |
     */
    const getAST = (tokens: string[]) => {
        const getAlpha = (index: number, separator: "/" | "," = "/") => {
            if (tokens[index] !== undefined) {
                if (tokens[index] === separator) {
                    return { value: tokens[index + 1], hasAlpha: true };
                }
                throw new Error("Invalid alpha separator");
            }
            return { value: "1", hasAlpha: false };
        };

        let fn: string,
            space: string | null,
            fromOrigin: string | null,
            c1: string,
            c2: string,
            c3: string,
            alpha: string,
            commaSeparated = false,
            expectedLength: number;

        if (tokens[0] === "color") {
            fn = "color";
            if (tokens[1] === "from") {
                // color(from red srgb r g b) OR color(from red srgb r g b / alpha)
                space = tokens[3];
                fromOrigin = tokens[2];
                c1 = tokens[4];
                c2 = tokens[5];
                c3 = tokens[6];
                const { value, hasAlpha } = getAlpha(7);
                expectedLength = hasAlpha ? 9 : 7;
                alpha = value;
            } else {
                // color(srgb 1 0 0) OR color(srgb 1 0 0 / 0.5)
                space = tokens[1];
                fromOrigin = null;
                c1 = tokens[2];
                c2 = tokens[3];
                c3 = tokens[4];
                const { value, hasAlpha } = getAlpha(5);
                expectedLength = hasAlpha ? 7 : 5;
                alpha = value;
            }
        } else {
            fn = tokens[0];
            space = null;
            if (tokens[1] === "from") {
                // rgb(from red r g b) OR rgb(from red r g b / alpha)
                fromOrigin = tokens[2];
                c1 = tokens[3];
                c2 = tokens[4];
                c3 = tokens[5];
                const { value, hasAlpha } = getAlpha(6);
                expectedLength = hasAlpha ? 8 : 6;
                alpha = value;
            } else {
                fromOrigin = null;
                c1 = tokens[1];
                if (tokens[2] === "," && tokens[4] === ",") {
                    // rgb(255, 0, 0) OR rgb(255, 0, 0, 0.5)
                    commaSeparated = true;
                    c2 = tokens[3];
                    c3 = tokens[5];
                    const { value, hasAlpha } = getAlpha(6, ",");
                    expectedLength = hasAlpha ? 8 : 6;
                    if (hasAlpha && tokens[6] !== ",") {
                        throw new Error("Comma optional syntax requires no commas at all.");
                    }
                    alpha = value;
                } else {
                    // rgb(255 0 0) OR rgb(255 0 0 / 0.5)
                    c2 = tokens[2];
                    c3 = tokens[3];
                    const { value, hasAlpha } = getAlpha(4);
                    expectedLength = hasAlpha ? 6 : 4;
                    alpha = value;
                }
            }
        }

        if (tokens.length !== expectedLength) {
            throw new Error(
                `Invalid number of tokens for ${fn}(): expected ${expectedLength} but got ${tokens.length}.`
            );
        }

        return { fn, space, fromOrigin, c1, c2, c3, alpha, commaSeparated };
    };

    /**
     * Tokenization examples
     *
     * ─── rgb() ────────────────────────────────────────────────
     * "rgb(255, 0, 0)"          --> [ "rgb", "255", ",", "0", ",", "0" ]
     * "rgb(255, 0, 0, 0.5)"       --> [ "rgb", "255", ",", "0", ",", "0", ",", "0.5" ]
     * "rgb(255 0 0)"              --> [ "rgb", "255", "0", "0" ]
     * "rgb(255 0 0 / 0.5)"        --> [ "rgb", "255", "0", "0", "/", "0.5" ]
     * "rgb(from red r g b)"       --> [ "rgb", "from", "red", "r", "g", "b" ]
     * "rgb(from red r g b / a)"   --> [ "rgb", "from", "red", "r", "g", "b", "/", "alpha" ]
     *
     * ─── color() ─────────────────────────────────────────────
     * "color(srgb 1 0 0)"                --> [ "color", "srgb", "1", "0", "0" ]
     * "color(srgb 1 0 0 / 0.5)"          --> [ "color", "srgb", "1", "0", "0", "/", "0.5" ]
     * "color(from red srgb r g b)"       --> [ "color", "from", "red", "srgb", "r", "g", "b" ]
     * "color(from red srgb r g b / a)"   --> [ "color", "from", "red", "srgb", "r", "g", "b", "/", "alpha" ]
     */
    const tokenize = (str: string) => {
        const tokens: string[] = [];
        let i = 0;
        let funcName = "";

        while (i < str.length && str[i] !== "(") {
            funcName += str[i];
            i++;
        }
        funcName = funcName.trim();
        tokens.push(funcName);

        const innerStart = str.indexOf("(") + 1;
        const innerStr = str.slice(innerStart, -1).trim();

        i = 0;

        if (innerStr.slice(0, 5) === "from ") {
            tokens.push("from");

            i += 5;
            while (i < innerStr.length && innerStr[i] === " ") i++;

            const colorStart = i;
            while (i < innerStr.length && innerStr[i] !== " ") i++;
            const colorStr = innerStr.slice(colorStart, i);

            if (colorStr.includes("(")) {
                const { expression, end } = extractBalancedExpression(innerStr, colorStart);
                tokens.push(expression);
                i = end;
            } else {
                tokens.push(colorStr);
            }
            while (i < innerStr.length && innerStr[i] === " ") i++;
        }

        if (tokens[0] === "color" && i < innerStr.length) {
            const spaceStart = i;
            while (i < innerStr.length && innerStr[i] !== " ") i++;
            tokens.push(innerStr.slice(spaceStart, i));
            while (i < innerStr.length && innerStr[i] === " ") i++;
        }

        while (i < innerStr.length) {
            const char = innerStr[i];

            if (char === ",") {
                tokens.push(",");
                i++;
                if (innerStr[i] === " ") i++;
            } else if (char === "/") {
                tokens.push("/");
                i++;
                if (innerStr[i] === " ") i++;
            } else if (char === " ") {
                i++;
            } else if (/[a-zA-Z#]/.test(char)) {
                const identStart = i;
                let ident = "";
                while (i < innerStr.length && /[a-zA-Z0-9-%#]/.test(innerStr[i])) {
                    ident += innerStr[i];
                    i++;
                }
                if (i < innerStr.length && innerStr[i] === "(") {
                    const { expression, end } = extractBalancedExpression(innerStr, identStart);
                    tokens.push(expression);
                    i = end;
                } else {
                    tokens.push(ident);
                }
            } else if (/[\d.-]/.test(char)) {
                let num = "";
                while (i < innerStr.length && /[\d.eE+-]/.test(innerStr[i])) {
                    num += innerStr[i];
                    i++;
                }
                if (i < innerStr.length && innerStr[i] === "%") {
                    num += "%";
                    i++;
                    tokens.push(num);
                } else if (i < innerStr.length && /[a-zA-Z]/.test(innerStr[i])) {
                    let unit = "";
                    while (i < innerStr.length && /[a-zA-Z]/.test(innerStr[i])) {
                        unit += innerStr[i];
                        i++;
                    }
                    tokens.push(num + unit);
                } else {
                    tokens.push(num);
                }
            } else {
                throw new Error(`Unexpected character: ${char}`);
            }
        }

        return tokens;
    };

    const validateRelativeColorSpace = (str: string, name: string) => {
        const prefix = "color(from ";
        if (str.slice(0, 11) !== prefix || str[str.length - 1] !== ")") {
            return false;
        }

        const innerStr = str.slice(prefix.length, -1).trim();

        const { expression, end } = extractBalancedExpression(innerStr, 0);

        if (!expression) {
            return false;
        }

        const rest = innerStr.slice(end).trim();

        const parts = rest.split(/\s+/);
        if (parts.length < 1) {
            return false;
        }

        const colorSpace = parts[0];
        return colorSpace === name;
    };

    const { components, bridge, fromBridge, toBridge, alphaVariant, supportsLegacy } = converter;

    const {
        PI: pi,
        E: e,
        pow,
        sqrt,
        sin,
        cos,
        tan,
        asin,
        acos,
        atan,
        atan2,
        exp,
        log,
        log10,
        log2,
        abs,
        min,
        max,
        hypot,
        round,
        ceil,
        floor,
        sign,
        trunc,
        random,
    } = Math;

    return {
        isValid: (str: string) => {
            const { alphaVariant = name } = converter;

            if (name in colorSpaces) {
                const startsWithColor = str.slice(0, `color(${name} `.length) === `color(${name} `;
                const startsWithFrom =
                    str.slice(0, "color(from".length) === "color(from" && validateRelativeColorSpace(str, name);

                return (startsWithColor || startsWithFrom) && str[str.length - 1] === ")";
            }

            return (
                (str.slice(0, `${name}(`.length) === `${name}(` ||
                    str.slice(0, `${alphaVariant}(`.length) === `${alphaVariant}(`) &&
                str[str.length - 1] === ")"
            );
        },

        bridge,

        toBridge: (coords: number[]) => [...toBridge(coords.slice(0, 3)), coords[3] ?? 1],

        parse: (str: string) => {
            const tokens = tokenize(str);
            const ast = getAST(tokens);
            const components = parseAST(ast);
            return [...components.slice(0, 3), components[3] ?? 1];
        },

        fromBridge: (coords: number[]) => [...fromBridge(coords), coords[3] ?? 1],

        format: ([c1, c2, c3, a = 1]: number[], options: FormattingOptions = {}) => {
            const { legacy = false, fit: fitMethod = config.defaults.fit, precision, units = false } = options;

            const clipped = fit([c1, c2, c3], name as ColorModel, { method: fitMethod, precision });
            const alpha = Number(min(max(a, 0), 1).toFixed(3)).toString();

            const formatted = clipped.map((v, index) => {
                if ((units || legacy) && components) {
                    const def = Object.values(components).find((comp) => comp.index === index);
                    if (def?.value === "percentage") return `${v}%`;
                    if (def?.value === "angle" && units) return `${v}deg`;
                }
                return v.toString();
            });

            if (name in colorSpaces) {
                return `color(${name} ${formatted.join(" ")}${a !== 1 ? ` / ${alpha}` : ""})`;
            }

            if (legacy && supportsLegacy) {
                return a === 1
                    ? `${name}(${formatted.join(", ")})`
                    : `${alphaVariant || name}(${formatted.join(", ")}, ${alpha})`;
            }

            return `${name}(${formatted.join(" ")}${a !== 1 ? ` / ${alpha}` : ""})`;
        },
    };
}

/**
 * Converts a color space converter to a color model converter.
 *
 * @template C - A tuple of component names for the color space (e.g., ["r", "g", "b"]).
 * @param name - The name of the color space.
 * @param converter - The color space converter definition.
 * @returns An object of type `ColorModelConverter`.
 */
export function spaceConverterToModelConverter<const C extends readonly string[]>(
    name: string,
    converter: Omit<ColorSpaceConverter, "components"> & { components: C }
) {
    const { fromLinear = (c) => c, toLinear = (c) => c, toBridgeMatrix, fromBridgeMatrix } = converter;

    return {
        supportsLegacy: false,
        targetGamut: converter.targetGamut === null ? null : name,
        components: Object.fromEntries(
            converter.components.map((comp, index) => [comp, { index, value: [0, 1], precision: 5 }])
        ) as Record<C[number], ComponentDefinition>,
        bridge: converter.bridge,
        toBridge: (coords: number[]) => {
            return multiplyMatrices(
                toBridgeMatrix,
                coords.map((c) => toLinear(c))
            );
        },
        fromBridge: (coords: number[]) => multiplyMatrices(fromBridgeMatrix, coords).map((c) => fromLinear(c)),
    } satisfies ColorModelConverter;
}
