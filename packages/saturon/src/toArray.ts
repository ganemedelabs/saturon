import { config } from "./config.js";
import { colorModels, ComponentDefinition } from "./converters.js";
import { applyPrecision, fit, FitMethod } from "./fitMethods.js";
import { ComponentOptions } from "./formatters.js";
import { ColorData } from "./syntax.js";

/**
 * Normalizes a component value to the expected range for its component definition.
 */
export function normalizeComponentValue(component: number, value: ComponentDefinition["value"]): number {
    if (Number.isFinite(component)) return component;
    if (Number.isNaN(component) || typeof component !== "number") return 0;

    if (component === Infinity) {
        if (Array.isArray(value)) return value[1];
        return value === "hue" ? 360 : 100;
    }

    if (Array.isArray(value)) return value[0];
    return 0;
}

export function toArray(color: ColorData, options?: ComponentOptions): number[] {
    const method = options?.fit ?? (config.defaults.fit as FitMethod);
    let precision = options?.precision;

    if (typeof precision === "number" && precision > 100) precision = undefined;

    const { model, coords } = color;
    const { components } = colorModels[model];

    if (!components) throw new Error(`Model ${model} does not have defined components.`);

    const defs: ComponentDefinition[] = [];

    for (const props of Object.values(components)) defs[props.index] = props;

    const limit = Math.min(coords.length, 3);
    const norm = new Array(limit);

    for (let i = 0; i < limit; i++) norm[i] = normalizeComponentValue(coords[i], defs[i].value);

    const fitted = fit({ model, coords: norm }, { fit: method, precision });

    const fitLimit = Math.min(fitted.length, 3);
    const result = new Array(fitLimit + 1);

    for (let i = 0; i < fitLimit; i++) result[i] = fitted[i];

    const alpha = normalizeComponentValue(coords[3] ?? 1, defs[3].value);

    result[fitLimit] = applyPrecision(alpha, precision, defs[fitLimit]?.precision ?? 3);

    return result;
}
