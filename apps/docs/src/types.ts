export type InputTab = "string" | "random" | "direct";
export type OutputType = "string" | "object" | "array";

export interface ConversionResultItem {
    type: string;
    value: string | Record<string, number> | number[];
    isMatch: boolean;
}
