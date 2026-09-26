import { cache } from "./config.js";
import { ColorModel, ColorModelConverter, colorModels } from "./converters.js";
import { ColorData } from "./syntax.js";

export function convert(color: ColorData, to: ColorModel): number[]; // eslint-disable-line no-unused-vars
export function convert(color: ColorData, to: string): number[]; // eslint-disable-line no-unused-vars
export function convert(color: ColorData, to: string | ColorModel): number[] {
    const from = color.model;
    const coords = color.coords;

    if (to === from) {
        return [
            isNaN(coords[0]) ? 0 : coords[0],
            isNaN(coords[1]) ? 0 : coords[1],
            isNaN(coords[2]) ? 0 : coords[2],
            isNaN(coords[3]) ? 0 : (coords[3] ?? 1),
        ];
    }

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

    let value = [isNaN(coords[0]) ? 0 : coords[0], isNaN(coords[1]) ? 0 : coords[1], isNaN(coords[2]) ? 0 : coords[2]];
    for (let i = 0; i < pipeline.length; i++) value = pipeline[i](value);
    return [value[0], value[1], value[2], coords[3] ?? 1];
}
