import { convert } from "./convert.js";
import { ColorData } from "./syntax.js";
import { toArray } from "./toArray.js";

function toXYZArray(color: ColorData): number[] {
    const coords = convert(color, "xyz-d65");
    return toArray({ model: "xyz-d65", coords }, { fit: "none", precision: null });
}

export function contrast(color1: ColorData, color2: ColorData): number {
    const [, L1] = toXYZArray(color1);
    const [, L2] = toXYZArray(color2);
    return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
}
