import { evaluateCSSValue } from "./calc.js";
import { convert } from "./convert.js";
import { ColorModel, colorModels } from "./converters.js";
import { extractToken } from "./parsers.js";
import { parseNode, ParseNode, ColorData } from "./syntax.js";

/** Specifies the method used for interpolating hue values during color mixing. */
export type HueInterpolationMethod = "shorter" | "longer" | "increasing" | "decreasing";

/** Represents an individual color component within a color-mix array in `Color.mix()`. */
export type MixItem = {
    /** The Color instance to be mixed. */
    color: ColorData;

    /** The optional user-specified mixing weight factor (0 to 1). */
    percentage?: number;
};

/** Options configuring color mixing behavior in `Color.mix()`. */
export type MixOptions<M extends ColorModel = ColorModel> = {
    /** The color model to perform the mix in. If omitted, the mix is performed in OKLAB. */
    in?: M;

    /** The strategy used for hue interpolation in cylindrical spaces (e.g., "shorter", "longer"). */
    hue?: HueInterpolationMethod;
};

/**
 * Computes the shortest signed hue delta between two angles.
 *
 * @param a - The starting hue angle in degrees.
 * @param b - The ending hue angle in degrees.
 * @returns The signed delta in degrees.
 */
export function hueDelta(a: number, b: number): number {
    const d = (((b - a) % 360) + 360) % 360;
    return d > 180 ? d - 360 : d;
}

/**
 * Computes the longer signed hue delta between two angles.
 *
 * @param a - The starting hue angle in degrees.
 * @param b - The ending hue angle in degrees.
 * @returns The signed delta in degrees over the longer arc.
 */
export function hueDeltaLong(a: number, b: number): number {
    const d = hueDelta(a, b);
    return d >= 0 ? d - 360 : d + 360;
}

/**
 * Interpolates between two hue angles using the requested interpolation strategy.
 *
 * @param a - The starting hue angle in degrees.
 * @param b - The ending hue angle in degrees.
 * @param t - The interpolation factor between `0` and `1`.
 * @param method - The hue interpolation strategy, such as `shorter` or `longer`.
 * @returns The interpolated hue angle in degrees.
 * @throws If the interpolation method is unknown.
 */
export function interpHue(a: number, b: number, t: number, method: string): number {
    if (Number.isNaN(a) || Number.isNaN(b)) return NaN;

    switch (method) {
        case "shorter":
            return (((a + t * hueDelta(a, b)) % 360) + 360) % 360;
        case "longer":
            return (((a + t * hueDeltaLong(a, b)) % 360) + 360) % 360;
        case "increasing":
            return (((a * (1 - t) + (b < a ? b + 360 : b) * t) % 360) + 360) % 360;
        case "decreasing":
            return (((a * (1 - t) + (b > a ? b - 360 : b) * t) % 360) + 360) % 360;
        default:
            throw new Error(`Invalid hue interpolation: ${method}`);
    }
}

/**
 * Parses a `color-mix()` function into color data by resolving its interpolation method and color items.
 *
 * @param node - The parse tree node for the `color-mix()` function.
 * @returns The mixed color data.
 * @throws If no color components are present in the mix expression.
 */
export function parseColorMixFunction(node: ParseNode): ColorData {
    let model: ColorModel = "oklab";
    let hue: HueInterpolationMethod = "shorter";

    const children = node.value as ParseNode[];
    let i = 2;

    if (children[i]?.type === "<color-interpolation-method>") {
        const parts = children[i].value as ParseNode[];
        i++;

        if (parts[1]) model = extractToken(parts[1]) as ColorModel;
        if (parts[2] && parts[2].type !== "symbol") hue = extractToken(parts[2]) as HueInterpolationMethod;
    }

    const items: MixItem[] = [];

    while (i < children.length) {
        const current = children[i];

        if (current.type === "symbol" && (current.value === "," || current.value === ")")) {
            i++;
            continue;
        }

        let percentage: number | undefined;
        let colorNode: ParseNode | undefined;

        if (current.type === "<percentage>") {
            const rawVal = evaluateCSSValue(String(current.value || ""), "percentage");
            percentage = rawVal !== undefined ? rawVal / 100 : undefined;
            i++;
            colorNode = children[i];
        } else {
            colorNode = current;
            const nextNode = children[i + 1];
            if (nextNode?.type === "<percentage>") {
                const rawVal = evaluateCSSValue(String(nextNode.value || ""), "percentage");
                percentage = rawVal !== undefined ? rawVal / 100 : undefined;
                i++;
            }
        }

        const color = colorNode ? parseNode(colorNode) : null;
        if (color?.coords) {
            items.push({ color, percentage });
            i++;
            continue;
        }

        i++;
    }

    if (items.length === 0) throw new Error("color-mix() must contain at least one color component.");

    return {
        model,
        coords: items.length === 1 ? convert(items[0].color, model) : mixColors(items, { in: model, hue }),
    };
}

/**
 * Mixes multiple colors together using the supplied weights and interpolation options.
 *
 * @template M - The target color model for the mix.
 * @param colors - The colors and optional percentages to blend.
 * @param options - The interpolation model and hue strategy to use.
 * @returns The blended coordinates in the requested color model.
 * @throws If no colors are supplied.
 */
export function mixColors<M extends ColorModel = "oklab">(colors: MixItem[], options: MixOptions<M> = {}): number[] {
    const { in: model = "oklab" as M, hue = "shorter" } = options;

    if (!colors?.length) throw new Error("At least one color must be provided.");

    if (colors.length === 1) return convert(colors[0].color, model);

    const rawWeights = colors.map((c) => (c.percentage !== undefined ? c.percentage : undefined));
    const definedSum = rawWeights.reduce((sum: number, w) => sum + (w || 0), 0);
    const missingCount = rawWeights.filter((w) => w === undefined).length;

    if (rawWeights.length > 0 && rawWeights.every((w) => w === 0)) {
        const { components } = colorModels[model] as any; // eslint-disable-line @typescript-eslint/no-explicit-any
        const hueIndex = components?.h?.index ?? -1;

        const result = [0, 0, 0, 0];
        if (hueIndex !== -1) result[hueIndex] = NaN;
        return result;
    }

    let alphaMult = 1;
    const weights: number[] = new Array(colors.length);

    if (missingCount === 0 && definedSum < 1) {
        alphaMult = definedSum;
        const scale = 1 / definedSum;
        for (let i = 0; i < rawWeights.length; i++) weights[i] = (rawWeights[i] as number) * scale;
    } else if (missingCount > 0) {
        const share = Math.max(0, 1 - definedSum) / missingCount;
        for (let i = 0; i < rawWeights.length; i++) weights[i] = rawWeights[i] ?? share;
    } else {
        for (let i = 0; i < rawWeights.length; i++) weights[i] = (rawWeights[i] as number) / definedSum;
    }

    const converted = colors.map((item) => convert(item.color, model));

    const { components } = colorModels[model] as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    const hueIndex = components?.h?.index ?? -1;

    for (let c = 0; c < 4; c++) {
        const nonNaNIndex = converted.findIndex((coords) => !Number.isNaN(coords[c]));
        if (nonNaNIndex !== -1) {
            const fallbackVal = converted[nonNaNIndex][c];
            for (let i = 0; i < converted.length; i++) {
                if (Number.isNaN(converted[i][c])) converted[i][c] = fallbackVal;
            }
        }
    }

    let totalAlpha = 0;
    for (let i = 0; i < converted.length; i++) {
        const a = converted[i][3] ?? 1;
        totalAlpha += a * weights[i];
    }

    const result = [0, 0, 0, totalAlpha * alphaMult];
    if (totalAlpha === 0) {
        for (let c = 0; c < 3; c++) result[c] = c === hueIndex ? NaN : 0;
        return result;
    }

    if (colors.length === 2 && hueIndex !== -1) {
        const t = weights[1];
        const aA = converted[0][3] ?? 1;
        const aB = converted[1][3] ?? 1;

        for (let c = 0; c < 3; c++) {
            if (c === hueIndex) result[c] = interpHue(converted[0][c], converted[1][c], t, hue);
            else {
                const premixed = converted[0][c] * aA * (1 - t) + converted[1][c] * aB * t;
                result[c] = premixed / totalAlpha;
            }
        }
    } else {
        const refHue = hueIndex !== -1 ? converted[0][hueIndex] : 0;

        for (let c = 0; c < 3; c++) {
            let sum = 0;
            for (let i = 0; i < converted.length; i++) {
                const alpha = converted[i][3] ?? 1;
                const val = converted[i][c];

                if (c === hueIndex) {
                    const delta = hueDelta(refHue, val);
                    sum += (refHue + delta) * weights[i];
                } else sum += val * alpha * weights[i];
            }

            result[c] = c === hueIndex ? ((sum % 360) + 360) % 360 : sum / totalAlpha;
        }
    }

    return result;
}
