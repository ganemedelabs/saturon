import { config } from "./config.js";
import { convert } from "./convert.js";
import { ColorModel, colorModels } from "./converters.js";
import { formatters, FormattingOptions, OutputType } from "./formatters.js";
import { ColorData } from "./syntax.js";
import { toArray } from "./toArray.js";

function toNormArray(color: ColorData, model: ColorModel): number[] {
    const coords = convert(color, model);
    return toArray({ model, coords }, { fit: "none", precision: null });
}

/**
 * Formats a ColorData object into a string representation in the specified output type, applying optional fitting and precision adjustments.
 * @param color - The ColorData object containing the color model and its component coordinates.
 * @param to - The desired output type or color model to format the color into.
 * @param options - Optional settings for legacy syntax, fitting method, precision, and unit suffixes.
 * @returns A string representation of the color in the specified format, or `undefined` if formatting fails.
 */
export function format(
    color: ColorData,
    to: OutputType | (string & {}),
    options: FormattingOptions = {}
): string | undefined {
    const { legacy = false, fit = config.defaults.fit, precision, units = false } = options;

    const conv = formatters[to as OutputType];
    if (!conv) throw new Error(`Unsupported color type: '${to}'.`);

    const { fromBridge, bridge, format: formatter } = conv;
    if (!fromBridge || !formatter) throw new Error(`Invalid output type: '${to}'.`);

    const fmt = (coords: number[]) => {
        const arr = [...coords];
        return formatter(arr, { legacy, fit, precision, units });
    };

    if (to === color.model) return fmt(color.coords);
    if (to in colorModels) return fmt(toNormArray(color, to as ColorModel));

    return fmt(fromBridge(toNormArray(color, bridge as ColorModel)));
}
