import { ColorModel, colorModels, Component } from "./converters.js";
import { ColorData } from "./syntax.js";

/** Options for generating a random color with custom component ranges or biases. */
export type RandomOptions<M extends ColorModel = ColorModel> = {
    /** The color model to use (e.g., "rgb" or "hsl"). */
    model?: M;

    /** Optional limits for each channel. Accepts partial tuples to define only min or max. */
    limits?: Partial<Record<Component<M>, [number | undefined, number | undefined]>>;

    /** Optional bias functions for each channel, which transform the random value. */
    bias?: Partial<Record<Component<M>, (x: number) => number>>; // eslint-disable-line no-unused-vars

    /** Optional base values for each channel. */
    base?: Partial<Record<Component<M>, number>>;

    /** Optional deviation values for each channel, used to control randomness. */
    deviation?: Partial<Record<Component<M>, number>>;
};

/**
 * Generates a random `ColorData` object.
 *
 * @template M - The color model type.
 * @param options - Random generation options.
 * @returns A new random `ColorData` object.
 * @throws If an invalid component is specified.
 */
export function random<M extends ColorModel = ColorModel>(options: RandomOptions<M> = {}): ColorData {
    const models = Object.keys(colorModels) as ColorModel[];
    const isModelSpecified = options.model !== undefined;
    const model = options.model ?? (models[Math.floor(Math.random() * models.length)] as M);
    const { components } = colorModels[model];

    const limits = isModelSpecified ? (options as RandomOptions<M>).limits : undefined;
    const bias = isModelSpecified ? (options as RandomOptions<M>).bias : undefined;
    const base = isModelSpecified ? (options as RandomOptions<M>).base : undefined;
    const deviation = isModelSpecified ? (options as RandomOptions<M>).deviation : undefined;

    const valid = new Set(Object.keys(components));

    if (isModelSpecified) {
        for (const record of [limits, bias, base, deviation]) {
            if (!record) continue;

            for (const key of Object.keys(record)) {
                if (!valid.has(key)) {
                    throw new Error(
                        `Invalid component "${key}" for model "${model}". Valid components: ${[...valid].join(", ")}`
                    );
                }
            }
        }
    }

    const coords: number[] = [];

    for (const [name, comp] of Object.entries(components)) {
        let defaultMin;
        let defaultMax;

        if (comp.value === "hue") [defaultMin, defaultMax] = [0, 360];
        else if (comp.value === "percentage") [defaultMin, defaultMax] = [0, 100];
        else if (Array.isArray(comp.value)) [defaultMin, defaultMax] = comp.value;
        else throw new Error(`Invalid component value definition for "${name}".`);

        let min = defaultMin;
        let max = defaultMax;

        const compLimits = limits?.[name as Component<M>];
        if (compLimits) {
            const [lMin, lMax] = compLimits;

            min = lMin ?? defaultMin;
            max = lMax ?? defaultMax;

            if (min > max) {
                throw new Error(`Limit min (${min}) cannot be greater than max (${max}) for component "${name}".`);
            }
        }

        let value: number;
        const compBase = base?.[name as Component<M>];
        const compDev = deviation?.[name as Component<M>];

        if (compBase != null || compDev != null) {
            const actualBase = compBase ?? (min + max) / 2;
            const actualDev = compDev ?? (max - min) / 6;
            const u = Math.random() || 1e-9;
            const v = Math.random() || 1e-9;

            value = actualBase + Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * actualDev;
        } else {
            let r = Math.random();
            const biasFn = bias?.[name as Component<M>];
            if (biasFn) r = biasFn(r);
            value = min + r * (max - min);
        }

        if (comp.value === "hue") value = ((value % 360) + 360) % 360;
        else value = Math.min(max, Math.max(min, value));

        if (comp.precision !== undefined) {
            const factor = Math.pow(10, comp.precision);
            value = Math.round(value * factor) / factor;
        }

        coords[comp.index] = value;
    }

    return { model, coords };
}
