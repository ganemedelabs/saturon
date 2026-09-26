import { ColorModel, colorModels, Component } from "./converters.js";
import { ComponentOptions } from "./formatters.js";
import { ColorData } from "./syntax.js";
import { toArray } from "./toArray.js";

export function toObject<M extends ColorModel = ColorModel>(
    color: ColorData,
    options: ComponentOptions = {}
    // eslint-disable-next-line no-unused-vars
): { [key in Component<M>]: number } {
    const coords = toArray(color, options);
    const { components } = colorModels[color.model];

    if (!components) throw new Error(`Model ${color.model} does not have defined components.`);

    const result = {} as { [key in Component<M>]: number }; // eslint-disable-line no-unused-vars
    for (const [name, { index }] of Object.entries(components)) result[name as Component<M>] = coords[index];

    return result;
}
