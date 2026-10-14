import { ColorModel, colorModels, Component } from "./converters.js";
import { getLayout } from "./layout.js";
import { ColorData } from "./syntax.js";
import { normalizeComponentValue } from "./toArray.js";

/* eslint-disable no-unused-vars */
export type ColorUpdateValues<M extends ColorModel = ColorModel> =
    | Partial<{ [K in Component<M>]: number | ((prev: number) => number) }>
    | ((components: { [K in Component<M>]: number }) =>
          Partial<{ [K in Component<M>]: number }> | (number | undefined)[])
    | (number | undefined)[];
/* eslint-enable no-unused-vars */

/**
 * Updates the component values of a given color data object based on the provided update values.
 *
 * @template M The color model type.
 * @param data The color data object containing the model and coordinates.
 * @param values The new values to update the color components, which can be an object, a function, or an array.
 * @returns An array of updated color coordinates after applying the new values.
 */
export function updateColor<M extends ColorModel = ColorModel>(
    data: ColorData,
    values: ColorUpdateValues<M>
): number[] {
    const { model } = data;
    const coords = data.coords.slice();

    const { components } = colorModels[model as ColorModel];

    const names = Object.keys(components) as Component<M>[];
    const { alphaIndex, values: defs } = getLayout(model);

    const newValues =
        typeof values === "function"
            ? values(
                  Object.fromEntries(
                      names.map((k) => {
                          const def = components[k as Component<typeof model>];
                          return [k, normalizeComponentValue(coords[def.index], def.value)];
                      })
                  ) as Record<Component<M>, number>
              )
            : values;

    if (Array.isArray(newValues)) {
        const adjusted = coords.map((c, i) => {
            const incoming = newValues[i];
            if (typeof incoming !== "number") return c;

            const def = defs.find((d) => d.index === i);
            if (!def) return c;
            return normalizeComponentValue(incoming, def.value);
        });

        if (alphaIndex !== -1 && (adjusted[alphaIndex] === undefined || Number.isNaN(adjusted[alphaIndex]))) {
            adjusted[alphaIndex] = coords[alphaIndex] ?? 1;
        }

        return adjusted;
    }

    const next = [...coords];
    for (const name of names) {
        if (!(name in newValues)) continue;

        const { index, value } = components[name as Component<typeof model>];
        const raw = newValues[name];
        const prev = normalizeComponentValue(coords[index], value);

        const val =
            typeof raw === "function"
                ? normalizeComponentValue(raw(prev), value)
                : typeof raw === "number"
                  ? normalizeComponentValue(raw, value)
                  : coords[index];

        next[index] = val;
    }

    if (alphaIndex !== -1 && (next[alphaIndex] === undefined || Number.isNaN(next[alphaIndex]))) {
        next[alphaIndex] = next[alphaIndex] ?? coords[alphaIndex] ?? 1;
    }

    return next;
}
