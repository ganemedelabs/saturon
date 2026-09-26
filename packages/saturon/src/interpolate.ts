import { mixColors, MixItem, MixOptions } from "./colorMix.js";
import { ColorData } from "./syntax.js";

/**
 * Creates a function that performs multi-stop color interpolation across an array of color data objects.
 *
 * @param colors - Array of `ColorData` objects to interpolate through (minimum 2 required).
 * @param options - Configuration options controlling target color space (`in`) and hue interpolation strategy (`hue`).
 * @returns A function taking normalized progress `t` (`0` to `1`) and returning the raw numerical coordinate array for that point.
 *
 * @throws If `colors` array contains fewer than 2 elements.
 */
// eslint-disable-next-line no-unused-vars
export function interpolate(colors: ColorData[], options: MixOptions): (t: number) => number[] {
    if (colors.length < 2) throw new Error("interpolate requires at least two colors.");

    const { in: model = "oklab", hue = "shorter" } = options;
    const segments = colors.length - 1;

    return (t: number) => {
        const clampedT = Math.max(0, Math.min(1, t));

        const scaledT = clampedT * segments;
        const index = Math.min(Math.floor(scaledT), segments - 1);
        const localT = scaledT - index;

        const items = [
            { color: colors[index], percentage: 1 - localT },
            { color: colors[index + 1], percentage: localT },
        ] as MixItem[];

        return mixColors(items, { in: model, hue });
    };
}
