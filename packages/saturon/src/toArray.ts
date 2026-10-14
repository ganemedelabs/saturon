import { config } from "./config.js";
import { ComponentDefinition } from "./converters.js";
import { applyPrecision, fit } from "./fitMethods.js";
import { ComponentOptions } from "./formatters.js";
import { getLayout } from "./layout.js";
import { ColorData } from "./syntax.js";

/** Normalizes a component value to the expected range for its component definition. */
export function normalizeComponentValue(component: number, value: ComponentDefinition["value"]): number {
    if (Number.isFinite(component)) return component;
    if (typeof component !== "number" || Number.isNaN(component)) return 0;

    if (component === Infinity) {
        if (Array.isArray(value)) return value[1];
        if (value === "alpha-value") return 1;
        return value === "hue" ? 360 : 100;
    }

    // -Infinity
    return Array.isArray(value) ? value[0] : 0;
}

/**
 * Converts a ColorData object into an array of normalized component values, optionally applying fitting and precision adjustments.
 * @param color - The ColorData object containing the color model and its component coordinates.
 * @param options - Optional settings for fitting and precision adjustments.
 * @returns An array of normalized component values, including alpha if applicable.
 * @throws If the color model does not have defined components.
 */
export function toArray(color: ColorData, options: ComponentOptions = {}): number[] {
    const { fit: method = config.defaults.fit, precision } = options;

    const { model, coords } = color;
    const { alphaIndex, values, length } = getLayout(model);
    const alphaDef = values[alphaIndex];
    const colorDefs = values.filter((_, i) => i !== alphaIndex);

    const fitted = fit(
        { model, coords: colorDefs.map((d) => normalizeComponentValue(coords[d.index], d.value)) },
        { method, precision }
    );

    const result = new Array<number>(length);
    colorDefs.forEach((d, i) => {
        result[d.index] = normalizeComponentValue(fitted[i], d.value);
    });

    if (alphaDef) {
        const raw = normalizeComponentValue(coords[alphaDef.index] ?? 1, alphaDef.value);
        result[alphaIndex] = applyPrecision(raw, precision, alphaDef.precision ?? 3);
    }

    return result;
}
