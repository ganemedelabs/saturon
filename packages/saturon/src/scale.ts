import { MixOptions } from "./colorMix.js";
import { ColorModel } from "./converters.js";
import { interpolate } from "./interpolate.js";
import { ColorData } from "./syntax.js";

export interface ScaleOptions<M extends ColorModel = ColorModel> extends MixOptions<M> {
    steps?: number;
}

export function scale<M extends ColorModel = "oklab">(
    colors: ColorData[],
    options: ScaleOptions<M> = {} as ScaleOptions<M>
): number[][] {
    const { steps = 5, ...mixOptions } = options;
    if (steps < 2) throw new Error("scale requires at least 2 steps.");

    const interpolator = interpolate(colors, mixOptions as MixOptions<M>);
    const scale: number[][] = [];

    for (let i = 0; i < steps; i++) {
        const t = i / (steps - 1);
        scale.push(interpolator(t));
    }

    return scale;
}
