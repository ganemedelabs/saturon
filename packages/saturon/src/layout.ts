import { cache } from "./config.js";
import { ColorModel, colorModels, ComponentDefinition } from "./converters.js";

interface ModelLayout {
    length: number;
    alphaIndex: number;
    hueIndex: number;
    values: ComponentDefinition[];
}

export function getLayout(model: ColorModel): ModelLayout {
    let layouts = cache.get("layouts") as Map<string, ModelLayout> | undefined;
    if (!layouts) {
        layouts = new Map();
        cache.set("layouts", layouts);
    }

    let layout = layouts.get(model);
    if (layout) return layout;

    if (!(model in colorModels)) throw new Error(`Unsupported color model: '${model}'`);

    const { components } = colorModels[model];

    if (!components) throw new Error(`Color model '${model}' does not have defined components.`);

    const values = Object.values(components);

    layout = {
        values,
        length: values.length,
        alphaIndex: values.find((c) => c.value === "alpha-value")?.index ?? -1,
        hueIndex: Object.values(components).find((c) => c.value === "hue")?.index ?? -1,
    };

    layouts.set(model, layout);
    return layout;
}
