import { config } from "./config.js";
import { convert } from "./convert.js";
import { ColorModel, colorModels, ColorSpace, colorSpaces } from "./converters.js";
import { FitMethod } from "./fitMethods.js";
import { ColorData } from "./syntax.js";
import { toArray } from "./toArray.js";

export type InGamutOptions = {
    /** Floating-point tolerance (defaults to the value of `EPSILON` in `"saturon/constants"`). */
    epsilon?: number;
};

export type ToGamutOptions = {
    method?: FitMethod;
};

function toNormArray(color: ColorData, model: ColorModel): number[] {
    const coords = convert(color, model);
    return toArray({ model, coords }, { fit: "none", precision: null });
}

export function inGamut(color: ColorData, gamut: ColorSpace | string, options: InGamutOptions = {}): boolean {
    const { epsilon = config.defaults.epsilon } = options;
    if (!(gamut in colorSpaces)) throw new Error(`Unsupported color gamut: '${gamut}'.`);

    const { components, targetGamut } = colorModels[gamut as ColorSpace];
    if (!targetGamut) return true;

    const coords = toNormArray(color, gamut as ColorSpace);
    return Object.values(components).every(({ index, value }) => {
        const v = coords[index];
        const [min, max] = Array.isArray(value) ? value : value === "hue" ? [0, 360] : [0, 100];
        return v >= min - epsilon && v <= max + epsilon;
    });
}

export function toGamut(color: ColorData, gamut: ColorSpace, options: ToGamutOptions = {}): number[] {
    const { method = config.defaults.fit } = options;
    if (gamut in colorSpaces === false) throw new Error(`Unsupported color gamut: '${gamut}'.`);

    const converted = convert(color, gamut);
    const fitted = toArray({ model: color.model, coords: converted }, { fit: method, precision: null });
    return convert({ model: gamut, coords: fitted }, color.model);
}
