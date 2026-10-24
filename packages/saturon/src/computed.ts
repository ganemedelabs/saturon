import { colorModels } from "./converters.js";
import { ColorModel } from "./converters.js";
import { FitMethod } from "./fitMethods.js";
import { format } from "./format.js";
import { isValid } from "./isValid.js";
import { parse } from "./parse.js";

/** Context handed to computed-value rules. */
export type ComputedContext = {
    /** The original input string provided to the `computed` function. */
    input: string;

    /** The color model of the parsed input. */
    model: ColorModel;

    /** The color coordinates of the parsed input. */
    coords: number[];
};

/** A computed-value rule. */
export type ComputedRule = {
    /** Unique rule name. */
    name: string;

    /** Higher runs first. Built-ins use 0-100 in steps of 10; the default fallback uses -Infinity. Default: 0. */
    priority?: number;

    /** Return true if this rule applies to the color. */
    test: (ctx: ComputedContext) => boolean; // eslint-disable-line no-unused-vars

    /** Produce the computed value. Only called when `test` returned true. */
    compute: (ctx: ComputedContext) => string; // eslint-disable-line no-unused-vars
};

export const computedRules: ComputedRule[] = [
    {
        name: "alpha",
        priority: 100,
        test: ({ input }) => isValid(input, { rule: "<alpha()>" }),
        compute: ({ model, coords }) =>
            format({ model, coords }, "srgb", {
                normalized: false,
                fit: "none" as FitMethod,
            }) as string,
    },
    {
        name: "color-mix",
        priority: 90,
        test: ({ input }) => isValid(input, { rule: "<color-mix()>" }),
        compute: ({ model, coords }) =>
            format({ model, coords }, colorModels[model].bridge === "rgb" ? "srgb" : model, {
                legacy: true,
                units: false,
                normalized: false,
                fit: "none" as FitMethod,
            }) as string,
    },
    {
        name: "relative-color-syntax",
        priority: 80,
        test: ({ input }) => isValid(input, { rule: "<relative-color-syntax>" }),
        compute: ({ model, coords }) =>
            format({ model, coords }, model === "rgb" || colorModels[model].bridge === "rgb" ? "srgb" : model, {
                legacy: true,
                units: false,
                normalized: false,
                fit: "none" as FitMethod,
            }) as string,
    },
    {
        name: "rgb-bridge-legacy",
        priority: 70,
        test: ({ model, coords }) => colorModels[model].bridge === "rgb" && !coords.some((c) => isNaN(c)),
        compute: ({ model, coords }) =>
            format({ model, coords }, "rgb", {
                legacy: true,
                units: false,
                normalized: false,
                fit: "none" as FitMethod,
            }) as string,
    },
    {
        name: "default",
        priority: -Infinity,
        test: () => true,
        compute: ({ model, coords }) =>
            format({ model, coords }, model, {
                legacy: true,
                units: false,
                normalized: false,
                fit: "none" as FitMethod,
            }) as string,
    },
];

/**
 * Compute a color value from a string input, returning a string output in the most appropriate format.
 *
 * @param color - The input color string to compute.
 * @returns The computed color string in the most appropriate format.
 * @throws If no computed rule matches the input color.
 */
export function computed(color: string): string {
    const { model, coords } = parse(color);
    const ctx: ComputedContext = { input: color, model, coords };

    for (const rule of computedRules) {
        if (rule.test(ctx)) return rule.compute(ctx);
    }

    throw new Error(`No computed rule matched '${color}'.`);
}
