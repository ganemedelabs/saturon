import { config } from "./config.js";
import { ColorModel, ColorModelConverter, colorModels, colorSpaces } from "./converters.js";
import { ParseNode } from "./syntax.js";
import { FitMethod, applyPrecision, fit } from "./fitMethods.js";
import { namedColors } from "./namedColors.js";
import { toArray } from "./toArray.js";
import { Validator } from "./validators.js";
import { getLayout } from "./layout.js";

/** Represents the color types that can be formatted to string output. */
export type OutputType = keyof typeof formatters;

/** Represents options for retrieving the coordinates. */
export type ComponentOptions = {
    /** Method for fitting the color into the target gamut. Defaults to `config.defaults.fit`. */
    fit?: FitMethod;

    /** Overrides the auto precision of the output color components, or `null` to disable rounding. */
    precision?: number | null;
};

/** Options for formatting color components. */
export type FormattingOptions = ComponentOptions & {
    /** Use legacy syntax (e.g., `"rgba(255, 0, 0, 0.5)"`). */
    legacy?: boolean;

    /** Output components with optional unit suffixes (e.g., `"hsl(250deg 74% 54%)"`). */
    units?: boolean;
};

/** Represents an interface for serializing internal color data structures into specific string formats. */
export type ColorFormatter = {
    /** The intermediate "bridge" color space used for conversion (e.g., `"rgb"`, `"srgb"`). */
    bridge: string;

    /**
     * Translates coordinates from the bridge color space into the format's local coordinate system.
     *
     * @param coords - The coordinates in the bridge color space.
     * @returns The transformed coordinate values.
     */
    fromBridge: (coords: number[]) => number[]; // eslint-disable-line no-unused-vars

    /**
     * Converts native channel coordinates into their string representation.
     *
     * @param coords - The coordinate array to format, with optional alpha at the last index.
     * @param options - Options for adjusting output format, legacy syntax, and precision.
     * @returns The formatted color string, or `undefined` if formatting fails.
     */
    format: (coords: number[], options?: FormattingOptions) => string | undefined; // eslint-disable-line no-unused-vars
};

/** Defines a grammar rule specification used to extend the CSS color parser engine. */
export type GrammarRuleSpec = {
    /** The name or names of existing grammar rules to append this rule to (e.g., `"<color>"`). */
    appendTo?: string | string[];

    /** The CSS-style syntax matching pattern for the custom grammar statement, or a validator function. */
    rule: string | Validator;

    /**
     * Translates a matched abstract syntax tree node into a color model and coordinate array.
     *
     * @param node - The matched parse tree node.
     * @returns The color model identifier and calculated coordinate values.
     */
    parse?: (node: ParseNode) => { model: ColorModel; coords: number[] }; // eslint-disable-line no-unused-vars
};

export function createColorFormatter(model: string, converter: ColorModelConverter): ColorFormatter {
    const { bridge, fromBridge, supportsLegacy, alphaVariant } = converter;

    const { length, values: defs, alphaIndex } = getLayout(model as ColorModel);
    const nonAlphaComponents = defs.filter((_, i) => i !== alphaIndex);

    const { alphaIndex: bridgeAlphaIndex } = getLayout(bridge as ColorModel);

    return {
        bridge,
        fromBridge: (coords: number[]) => {
            const rawConverted = fromBridge(coords);
            const alpha = bridgeAlphaIndex !== -1 ? (coords[bridgeAlphaIndex] ?? 1) : 1;

            const result = new Array(length);
            let rawIdx = 0;
            for (const comp of defs) {
                if (comp.value === "alpha-value") result[comp.index] = alpha;
                else result[comp.index] = rawConverted[rawIdx++];
            }
            return result;
        },
        format: (coords: number[], options: FormattingOptions = {}) => {
            const { legacy = false, fit: fitMethod = config.defaults.fit, precision, units = false } = options;

            const values = toArray({ model: model as ColorModel, coords }, { fit: fitMethod as FitMethod, precision });

            const alpha = alphaIndex !== -1 ? values[alphaIndex] : 1;
            const alphaStr = String(alpha);

            const f = nonAlphaComponents.map((c) => {
                const v = values[c.index];
                if (c.value === "percentage" && (units || legacy)) return `${v}%`;
                if (c.value === "hue" && units) return `${v}deg`;
                return String(v);
            });

            if (model in colorSpaces) return `color(${model} ${f.join(" ")}${alpha !== 1 ? ` / ${alphaStr}` : ""})`;

            if (legacy && supportsLegacy) {
                return alpha === 1
                    ? `${model}(${f.join(", ")})`
                    : `${alphaVariant || model}(${f.join(", ")}, ${alphaStr})`;
            }

            return `${model}(${f.join(" ")}${alpha !== 1 ? ` / ${alphaStr}` : ""})`;
        },
    };
}

/** A collection of color formatters that convert internal color representations into various string formats. */
export const formatters = {
    "hex-color": {
        bridge: "rgb",
        fromBridge: (coords: number[]) => coords,
        format: ([r, g, b, a = 1]: number[]) => {
            const toHex = (v: number) => v.toString(16).padStart(2, "0");
            const hex = [r, g, b].map((v) => toHex(Math.round(Math.max(0, Math.min(255, v))))).join("");
            return `#${hex}${a < 1 ? toHex(Math.round(a * 255)) : ""}`;
        },
    },

    "named-color": {
        bridge: "rgb",
        fromBridge: (coords: number[]) => coords,
        format: (rgb: number[]) => {
            const [r, g, b] = rgb.map((v, i) => (i < 3 ? Math.round(Math.min(255, Math.max(0, v))) : v));
            for (const [name, [nr, ng, nb]] of Object.entries(namedColors)) {
                if (r === nr && g === ng && b === nb) return name;
            }
        },
    },

    "device-cmyk": {
        bridge: "rgb",
        fromBridge: (coords: number[]) => coords,
        format: ([red, green, blue, alpha = 1]: number[], options: FormattingOptions = {}) => {
            const { legacy = false, precision = 3, fit: fitMethod = config.defaults.fit } = options;
            const [fr, fg, fb] = fit({ model: "rgb", coords: [red, green, blue] }, { method: fitMethod });

            const r = fr / 255;
            const g = fg / 255;
            const b = fb / 255;
            const k = 1 - Math.max(r, g, b);

            const c = applyPrecision(k === 1 ? 0 : (1 - r - k) / (1 - k), precision, 3);
            const m = applyPrecision(k === 1 ? 0 : (1 - g - k) / (1 - k), precision, 3);
            const y = applyPrecision(k === 1 ? 0 : (1 - b - k) / (1 - k), precision, 3);
            const kFormatted = applyPrecision(k, precision, 3);
            const alphaFormatted = applyPrecision(alpha, precision, 3);

            if (legacy) {
                return `device-cmyk(${c}, ${m}, ${y}, ${kFormatted})`;
            }

            return `device-cmyk(${c} ${m} ${y} ${kFormatted}${alpha < 1 ? ` / ${alphaFormatted}` : ""})`;
        },
    },

    ...(Object.fromEntries(
        Object.entries(colorModels).map(([model, converter]) => [
            model,
            createColorFormatter(model, converter as ColorModelConverter),
        ])
    ) as Record<ColorModel, ColorFormatter>),
} satisfies Record<string, ColorFormatter>;
