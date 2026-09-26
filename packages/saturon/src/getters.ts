import { HueInterpolationMethod } from "./colorMix.js";
import { ColorModel, colorModels, ColorSpace, colorSpaces, Component } from "./converters.js";
import { FitMethod, fitMethods } from "./fitMethods.js";
import { formatters, OutputType } from "./formatters.js";
import { NamedColor, namedColors } from "./namedColors.js";
import { SystemColor, systemColors } from "./systemColors.js";

/** Base static getters */
const staticGetters = {
    "color-models": () => Object.keys(colorModels) as ColorModel[],
    "color-spaces": () => Object.keys(colorSpaces) as ColorSpace[],
    "named-colors": () => Object.keys(namedColors) as NamedColor[],
    "system-colors": () => Object.keys(systemColors) as SystemColor[],
    "output-types": () => {
        return Object.keys(formatters).filter((key) => {
            const type = formatters[key as OutputType];
            return typeof type["fromBridge"] === "function" && typeof type["format"] === "function";
        }) as OutputType[];
    },
    "fit-methods": () => ["none", ...Object.keys(fitMethods)] as FitMethod[],
    "hue-interpolation-methods": () => ["shorter", "longer", "increasing", "decreasing"] as HueInterpolationMethod[],
} as const;

/** Type map combining static getters and dynamic components:model getters */
export type GettersMap = typeof staticGetters & {
    [M in ColorModel as `components:${M}`]: () => Component<M>[];
};

/** A collection of getter functions that provide access to various registered items in the color engine. */
export const getters = new Proxy(staticGetters, {
    get(target, prop: string) {
        if (prop in target) {
            return target[prop as keyof typeof target];
        }

        if (prop.startsWith("components:")) {
            const model = prop.slice(11) as ColorModel;
            if (model in colorModels) {
                return () => Object.keys(colorModels[model].components) as Component<typeof model>[];
            }
        }

        return undefined;
    },
}) as GettersMap;

/** Represents the keys of the `getters` object, corresponding to the available getter categories. */
export type Getter = keyof GettersMap;

/**
 * Retrieves a list of registered items for the requested getter key.
 *
 * @template T - The getter category to query.
 * @param type - The getter name.
 * @returns The array produced by the selected getter.
 */
export function get<T extends Getter>(type: T): ReturnType<GettersMap[T]> {
    const fn = getters[type];
    if (!fn) throw new Error(`Unknown getter category: ${String(type)}`);
    return fn() as ReturnType<GettersMap[T]>;
}
