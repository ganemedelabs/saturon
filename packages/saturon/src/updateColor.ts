import { ColorModel, colorModels, Component, ComponentDefinition } from "./converters.js";
import { ColorData } from "./syntax.js";
import { normalizeComponentValue } from "./toArray.js";

/* eslint-disable no-unused-vars */
export type ColorUpdateValues<M extends ColorModel = ColorModel> =
    | Partial<{ [K in Component<M>]: number | ((prev: number) => number) }>
    | ((components: { [K in Component<M>]: number }) =>
          Partial<{ [K in Component<M>]: number }> | (number | undefined)[])
    | (number | undefined)[];
/* eslint-enable no-unused-vars */

export function updateColor<M extends ColorModel = ColorModel>(
    data: ColorData,
    values: ColorUpdateValues<M>
): number[] {
    const { model } = data;
    const coords = data.coords.slice();

    const { components } = colorModels[model as ColorModel] as {
        components: Record<Component<M>, ComponentDefinition>;
    };

    const names = Object.keys(components) as Component<M>[];
    const componentDefs = Object.values(components) as ComponentDefinition[];

    const newValues =
        typeof values === "function"
            ? values(
                  Object.fromEntries(
                      names.map((k) => {
                          const def = components[k];
                          return [k, normalizeComponentValue(coords[def.index], def.value)];
                      })
                  ) as Record<Component<M>, number>
              )
            : values;

    if (Array.isArray(newValues)) {
        const adjusted = coords.map((curr, i) => {
            const incoming = newValues[i];
            if (typeof incoming !== "number") return curr;

            const def = componentDefs.find((d) => d.index === i)!;
            return normalizeComponentValue(incoming, def.value);
        });

        return [...adjusted.slice(0, 3), coords[3] ?? 1];
    }

    const next = [...coords];
    for (const name of names) {
        if (!(name in newValues)) continue;

        const { index, value } = components[name];
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

    return [...next.slice(0, 3), next[3] ?? coords[3] ?? 1];
}
