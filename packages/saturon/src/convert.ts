import { cache } from "./config.js";
import { ColorModel, ColorModelConverter, colorModels } from "./converters.js";
import { getLayout } from "./layout.js";
import { ColorData } from "./syntax.js";

/**
 * Converts a color from one model to another using the defined conversion graph.
 *
 * @param color - The color data to convert, including its model and coordinates.
 * @param to - The target color model to convert to.
 * @returns The converted color coordinates in the target model.
 * @throws If no conversion path exists between the source and target models.
 */
export function convert(color: ColorData, to: ColorModel): number[]; // eslint-disable-line no-unused-vars
export function convert(color: ColorData, to: string): number[]; // eslint-disable-line no-unused-vars
export function convert(color: ColorData, to: string | ColorModel): number[] {
    const from = color.model;
    const coords = color.coords;

    if (to === from) return coords;

    let graph = cache.get("graph");
    let paths = cache.get("paths") as Map<string, ((coords: number[]) => number[])[]>; // eslint-disable-line no-unused-vars

    if (!graph) {
        graph = {};
        for (const [name, conv] of Object.entries(colorModels)) {
            const { bridge } = conv as ColorModelConverter;
            graph[name] = [...(graph[name] || []), bridge];
            graph[bridge] = [...(graph[bridge] || []), name];
        }
        cache.set("graph", graph);
    }

    if (!paths) {
        paths = new Map();
        cache.set("paths", paths);
    }

    const key = `${from}-${to}`;
    let pipeline = paths.get(key);

    if (!pipeline) {
        const queue = [from];
        const parent: Record<string, string | null> = { [from]: null };

        for (let i = 0; i < queue.length; i++) {
            const node = queue[i];
            if (node === to) break;
            for (const next of graph[node] || []) {
                if (!(next in parent)) {
                    parent[next] = node;
                    queue.push(next);
                }
            }
        }

        const path: string[] = [];
        for (let cur: string | null = to; cur; cur = parent[cur]) path.push(cur);
        path.reverse();

        if (!path.length || path[0] !== from) throw new Error(`Cannot convert from ${from} to ${to}. No path found.`);

        pipeline = [];
        for (let i = 0; i < path.length - 1; i++) {
            const a = path[i] as ColorModel;
            const b = path[i + 1] as ColorModel;
            const convA = colorModels[a] as ColorModelConverter;
            const convB = colorModels[b] as ColorModelConverter;

            if (convA.toBridge && convA.bridge === b) pipeline.push(convA.toBridge);
            else if (convB.fromBridge && convB.bridge === a) pipeline.push(convB.fromBridge);
            else throw new Error(`No conversion found between ${a} and ${b}.`);
        }

        paths.set(key, pipeline);
    }

    const { alphaIndex: fromAlphaIndex } = getLayout(from);
    const { alphaIndex: toAlphaIndex, length: toLen } = getLayout(to as ColorModel);

    const input = coords.slice();
    let alpha = 1;
    if (fromAlphaIndex !== -1) alpha = input.splice(fromAlphaIndex, 1)[0] ?? 1;

    let value = input;
    for (let i = 0; i < pipeline.length; i++) value = pipeline[i](value);

    const result = new Array<number>(toLen);
    for (let i = 0, j = 0; i < toLen; i++) result[i] = i === toAlphaIndex ? alpha : value[j++];
    return result;
}
