import { config } from "./config.js";
import { convert } from "./convert.js";
import { ColorModel, colorModels } from "./converters.js";
import { applyPrecision } from "./fitMethods.js";
import { formatters, FormattingOptions, OutputType } from "./formatters.js";
import { ColorData } from "./syntax.js";
import { toArray } from "./toArray.js";

function toNormArray(color: ColorData, model: ColorModel): number[] {
    const coords = convert(color, model);
    return toArray({ model, coords }, { fit: "none", precision: null });
}

function alphaDefaultPrecision(model: ColorModel): number {
    const { components } = colorModels[model];
    return Object.values(components).find((c) => c.index === 3)?.precision ?? 3;
}

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

    const targetModel = (to in colorModels ? to : bridge) as ColorModel;

    const fmt = (coords: number[]) => {
        const arr = [...coords];
        if (arr[3] !== undefined) arr[3] = applyPrecision(arr[3], precision, alphaDefaultPrecision(targetModel));
        return formatter(arr, { legacy, fit, precision, units });
    };

    if (to === color.model) return fmt(color.coords);
    if (to in colorModels) return fmt(toNormArray(color, to as ColorModel));

    return fmt(fromBridge(toNormArray(color, bridge as ColorModel)));
}
