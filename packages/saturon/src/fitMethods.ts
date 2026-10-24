import { config } from "./config.js";
import { convert } from "./convert.js";
import { ColorModel, ColorModelConverter, colorModels, ColorSpace } from "./converters.js";
import { deltaEOK } from "./deltaE.js";
import { ComponentOptions } from "./formatters.js";
import { inGamut } from "./gamut.js";
import { get } from "./getters.js";
import { getLayout } from "./layout.js";
import { ColorData } from "./syntax.js";
import { toArray } from "./toArray.js";

function toNormArray(color: ColorData, model: ColorModel): number[] {
    const coords = convert(color, model);
    const { alphaIndex } = getLayout(model);
    const arr = toArray({ model, coords }, { fit: "none", precision: null });
    return alphaIndex !== -1 ? arr.filter((_, index) => index !== alphaIndex) : arr;
}

/** Represents a gamut mapping method. */
export type FitFunction = (data: ColorData) => number[]; // eslint-disable-line no-unused-vars

/** Describes the available methods for fitting the color into the target gamut. */
export type FitMethod = keyof typeof fitMethods | "none";

/**
 * A collection of color coordinate fitting methods used to ensure color values conform to specific constraints or gamuts.
 *
 * @remarks
 * Each method in `fitMethods` provides a different strategy for adjusting color coordinates:
 * - `"clip"`: Simple clipping to gamut boundaries (W3C Color 4, Section 13.1.1).
 * - `"chroma-reduction"`: Chroma reduction with local clipping in OKLCh (W3C Color 4, Section 14.1.5).
 * - `"css-gamut-map"`: CSS Gamut Mapping algorithm for RGB destinations (W3C Color 4, Section 14.2).
 *
 * @see {@link https://www.w3.org/TR/css-color-4/|CSS Color Module Level 4}
 */
export const fitMethods = {
    clip: (data) => {
        const { model, coords } = data;
        const { values: defs, hueIndex, alphaIndex } = getLayout(model);
        const clipped = new Array(coords.length);
        for (let i = 0; i < coords.length; i++) {
            const v = coords[i];

            if (i === hueIndex || i === alphaIndex) {
                clipped[i] = v;
                continue;
            }

            const prop = defs[i];
            if (!prop) throw new Error(`Missing component properties for index ${i}.`);

            const [min, max] = Array.isArray(prop.value) ? prop.value : [0, 100];
            clipped[i] = v < min ? min : v > max ? max : v;
        }
        return clipped;
    },
    "chroma-reduction": (data) => {
        const { model, coords } = data;
        let { targetGamut } = colorModels[model] as ColorModelConverter;
        if (targetGamut === null) return coords;
        if (targetGamut === undefined) targetGamut = "srgb";
        if (inGamut({ model, coords }, targetGamut as ColorSpace)) return coords;

        const [L, , H] = toNormArray({ model, coords }, "oklch");
        const L_clipped = Math.min(1, Math.max(0, L));

        let C_low = 0;
        let C_high = 1.0;
        const epsilon = 1e-6;
        let clipped: number[];

        while (C_high - C_low > epsilon) {
            const C_mid = (C_low + C_high) / 2;
            const candidate_color = { model: "oklch" as ColorModel, coords: [L_clipped, C_mid, H] };

            if (inGamut(candidate_color, targetGamut as ColorSpace)) C_low = C_mid;
            else {
                const clipped_coords = fit({ model, coords: toNormArray(candidate_color, model) }, { method: "clip" });
                const clipped_color = { model, coords: clipped_coords };
                const deltaE = deltaEOK(candidate_color, clipped_color);
                if (deltaE < 2) {
                    clipped = clipped_coords;
                    return clipped;
                } else C_high = C_mid;
            }
        }

        const finalColor = { model: "oklch" as ColorModel, coords: [L_clipped, C_low, H] };
        clipped = toNormArray(finalColor, model);
        return clipped;
    },
    "css-gamut-map": (data): number[] => {
        const { model, coords } = data;
        let { targetGamut } = colorModels[model] as ColorModelConverter;
        if (targetGamut === null) return coords;
        if (targetGamut === undefined) targetGamut = "srgb";

        const [L, C, H] = toNormArray({ model, coords }, "oklch");

        if (L >= 1.0) {
            const white = { model: "oklab" as ColorModel, coords: [1, 0, 0] };
            return toNormArray(white, model);
        }

        if (L <= 0.0) {
            const black = { model: "oklab" as ColorModel, coords: [0, 0, 0] };
            return toNormArray(black, model);
        }

        if (inGamut({ model, coords }, targetGamut as ColorSpace)) return coords;

        const JND = 0.02;
        const epsilon = 0.0001;

        const current = { model: "oklch" as ColorModel, coords: [L, C, H] };
        let clipped: number[] = fit({ model, coords: toNormArray(current, model) }, { method: "clip" });

        const initialClippedColor = { model, coords: clipped };
        const E = deltaEOK(current, initialClippedColor);

        if (E < JND) return clipped;

        let min = 0;
        let max = C;
        let min_inGamut = true;

        while (max - min > epsilon) {
            const chroma = (min + max) / 2;
            const candidate = { model: "oklch" as ColorModel, coords: [L, chroma, H] };

            if (min_inGamut && inGamut(candidate, targetGamut as ColorSpace)) min = chroma;
            else {
                const clippedCoords = fit({ model, coords: toNormArray(candidate, model) }, { method: "clip" });
                clipped = clippedCoords;
                const clippedColor = { model, coords: clippedCoords };
                const deltaE = deltaEOK(candidate, clippedColor);

                if (deltaE < JND) {
                    if (JND - deltaE < epsilon) return clipped;
                    else {
                        min_inGamut = false;
                        min = chroma;
                    }
                } else max = chroma;
            }
        }

        return clipped;
    },
} satisfies Record<string, FitFunction>;

/**
 * Fits or clips color coordinates to the target model and gamut.
 *
 * @param coords - The color coordinates to fit.
 * @param model - The target color model.
 * @param options - Optional fit method and precision settings.
 * @returns The fitted coordinates.
 * @throws If the target model has incomplete component definitions or an invalid fit method.
 */
export function fit(color: ColorData, options: Omit<ComponentOptions, "fit"> & { method?: FitMethod } = {}): number[] {
    const { model, coords } = color;
    const { method = config.defaults.fit, precision } = options;

    const { values: defs, hueIndex, alphaIndex } = getLayout(model);
    let fitted: number[];

    if (method === "none") fitted = coords;
    else {
        const fn = fitMethods[method];

        if (!fn) {
            throw new Error(`Invalid fit method: must be ${get("fit-methods").join(", ")}.`);
        }

        fitted = fn({ coords, model });
    }

    const final = new Array<number>(coords.length);

    for (let i = 0; i < coords.length; i++) {
        const p = defs[i]?.precision ?? 3;

        if (i === alphaIndex) {
            final[i] = coords[i];
        } else if (i === hueIndex) {
            final[i] = applyPrecision(((coords[i] % 360) + 360) % 360, precision, p);
        } else {
            final[i] = applyPrecision(fitted[i], precision, p);
        }
    }

    return final;
}

export function applyPrecision(
    value: number,
    precision: number | null | undefined,
    defaultPrecision: number | null = 3
): number {
    let p: number | null;

    if (typeof precision === "number" || precision === null) p = precision;
    else if (typeof precision === "undefined") {
        p = defaultPrecision;
    } else throw new TypeError(`Invalid precision value: ${precision}.`);

    if (p !== null && p > 100) p = null;

    return p === null ? value : Math.round(value * 10 ** p) / 10 ** p;
}
