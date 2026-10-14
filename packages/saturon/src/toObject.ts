import { ColorModel, colorModels, Component } from "./converters.js";
import { ComponentOptions } from "./formatters.js";
import { ColorData } from "./syntax.js";
import { toArray } from "./toArray.js";

/**
 * Converts a ColorData object into an object mapping component names to their normalized values.
 *
 * @template M - The color model type.
 * @param color - The ColorData object containing the color model and its component coordinates.
 * @param options - Optional settings for fitting and precision adjustments.
 * @returns An object where keys are component names and values are their corresponding normalized values.
 * @throws If the color model does not have defined components.
 */
export function toObject<M extends ColorModel = ColorModel>(
    color: ColorData,
    options: ComponentOptions = {}
    // eslint-disable-next-line no-unused-vars
): { [key in Component<M>]: number } {
    const coords = toArray(color, options);
    const { components } = colorModels[color.model];

    const result = {} as { [key in Component<M>]: number }; // eslint-disable-line no-unused-vars
    for (const [name, { index }] of Object.entries(components)) result[name as Component<M>] = coords[index];

    return result;
}
