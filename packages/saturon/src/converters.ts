import { MATRICES } from "./matrices.js";

/** Represents the available `<color-function>`s. */
export type ColorFunction = keyof typeof colorModels;

/** Represents the available color spaces for `<color()>` function. */
export type ColorSpace = keyof typeof colorSpaces;

/** Represents the available manipulatable color models. */
export type ColorModel = keyof typeof colorModels;

/** Represents a converter for `<color-function>`s. */
export type ColorModelConverter = {
    /** The target color gamut identifier that the function should be clamped to (e.g., `"srgb"`, `"display-p3"`), or `null` for color spaces without a fixed gamut (e.g., `lab`, `lch`). */
    targetGamut?: string | null;

    /** Indicates if legacy (comma-separated) syntax is supported. */
    supportsLegacy?: boolean;

    /** The name of the alpha-channel variant of the color function, if it has one (e.g., `"rgba"` for `"rgb"`). */
    alphaVariant?: string;

    /** A mapping of component names to their definitions. */
    components: Record<string, ComponentDefinition>;

    /** The intermediate "bridge" color space used for conversion. Must be another `<color-function>` identifier (e.g., `"rgb"`, `"xyz"`). */
    bridge: string;

    /**
     * Converts coordinates from the native color function into the bridge color space.
     *
     * @param coords - The coordinates in the native color function's space.
     * @returns The coordinates converted to the bridge color space.
     */
    toBridge: (coords: number[]) => number[]; // eslint-disable-line no-unused-vars

    /**
     * Converts coordinates from the bridge color space back into the native color function's coordinate system.
     *
     * @param coords - The coordinates in the bridge color space.
     * @returns The coordinates converted back to the native color function's space.
     */
    fromBridge: (coords: number[]) => number[]; // eslint-disable-line no-unused-vars
};

/** Represents a converter for the color spaces used in `<color()>` function. */
export type ColorSpaceConverter = {
    /** The target color gamut for conversion. Defaults to null if the color space has no limits (e.g., `"xyz-d65"`). */
    targetGamut?: null;

    /** Names of components in this space. */
    components: string[];

    /**
     * Linearization function. Must be undefined if the matrix is linear.
     *
     * @param c - The component value to linearize.
     * @returns The linearized component value.
     */
    toLinear?: (c: number) => number; // eslint-disable-line no-unused-vars

    /**
     * Inverse linearization. Must be undefined if the matrix is linear.
     *
     * @param c - The linear component value to convert back.
     * @returns The non-linear component value.
     */
    fromLinear?: (c: number) => number; // eslint-disable-line no-unused-vars

    /** The intermediate "bridge" color space used for conversion. Must be another `<color-function>` identifier (e.g., `"rgb"`, `"xyz"`). */
    bridge: string;

    /** Matrix to convert to the bridge color space. */
    toBridgeMatrix: number[][];

    /** Matrix to convert from the bridge color space. */
    fromBridgeMatrix: number[][];
};

/** Defines the properties of a color component within a converter. */
export type ComponentDefinition = {
    /** Position of the component in the color array */
    index: number;

    /** The value type for the component, which can be a tuple of two numbers representing a range, or a string indicating a special type ("hue" or "percentage"). */
    value: number[] | "hue" | "percentage";

    /** Precision for rounding the component value, or `null` to disable rounding. Defaults to 3 if left undefined. */
    precision?: number | null;
};

/**
 * Represents a component export type for a given color model.
 *
 * @template M - The color model type.
 */
export type Component<M extends ColorModel> = keyof (typeof colorModels)[M]["components"];

/**
 * Multiplies two matrices or vectors.
 *
 * @param A - The first matrix or vector (1D treated as row vector).
 * @param B - The second matrix or vector (1D treated as column vector).
 * @returns The product:
 * - Scalar if both are vectors.
 * - Vector if one is 1D and the other 2D.
 * - Matrix if both are 2D.
 * @throws If dimensions are incompatible.
 */
export function multiplyMatrices<A extends number[] | number[][], B extends number[] | number[][]>(
    A: A,
    B: B
): A extends number[] ? (B extends number[] ? number : number[]) : B extends number[] ? number[] : number[][] {
    const m = Array.isArray(A[0]) ? A.length : 1;
    const A_matrix: number[][] = Array.isArray(A[0]) ? (A as number[][]) : [A as number[]];
    const B_matrix: number[][] = Array.isArray(B[0]) ? (B as number[][]) : (B as number[]).map((x) => [x]);
    const p = B_matrix[0].length;
    const B_cols = B_matrix[0].map((_, i) => B_matrix.map((x) => x[i]));
    const product = A_matrix.map((row) => B_cols.map((col) => row.reduce((a, c, i) => a + c * (col[i] || 0), 0)));

    if (m === 1) return product[0] as A extends number[] ? (B extends number[] ? number : number[]) : never;
    if (p === 1)
        return product.map((x) => x[0]) as A extends number[] ? (B extends number[] ? number : number[]) : never;
    return product as A extends number[]
        ? B extends number[]
            ? number
            : number[]
        : B extends number[]
          ? number[]
          : number[][];
}

/**
 * Adapts a color-space converter into the shape expected by the color-model registry.
 *
 * @template C - The tuple of component names used by the converter.
 * @param name - The color-space name.
 * @param converter - The space converter definition to adapt.
 * @returns A compatible model converter definition.
 */
export function spaceConverterToModelConverter<const C extends readonly string[]>(
    name: string,
    converter: Omit<ColorSpaceConverter, "components"> & { components: C }
) {
    const { fromLinear = (c) => c, toLinear = (c) => c, toBridgeMatrix, fromBridgeMatrix } = converter;

    return {
        supportsLegacy: false,
        targetGamut: converter.targetGamut === null ? null : name,
        components: {
            ...Object.fromEntries(
                converter.components.map((comp, index) => [comp, { index, value: [0, 1], precision: 5 }])
            ),
        } as Record<C[number], ComponentDefinition>,
        bridge: converter.bridge,
        toBridge: (coords: number[]) => {
            return multiplyMatrices(
                toBridgeMatrix,
                coords.map((c) => toLinear(c))
            );
        },
        fromBridge: (coords: number[]) => multiplyMatrices(fromBridgeMatrix, coords).map((c) => fromLinear(c)),
    } satisfies ColorModelConverter;
}

/**
 * Converts RGB to XYZ (D65).
 *
 * @param rgb - [R, G, B] each in range 0–255
 * @returns [X, Y, Z] in range 0–1
 */
export function RGB_to_XYZD65(rgb: number[]) {
    const lin_sRGB = rgb.map((v) => {
        const n = v / 255;
        const sign = n < 0 ? -1 : 1,
            abs = Math.abs(n);
        return abs <= 0.04045 ? n / 12.92 : sign * ((abs + 0.055) / 1.055) ** 2.4;
    });
    return multiplyMatrices(MATRICES.SRGB_to_XYZD65, lin_sRGB);
}

/**
 * Converts XYZ (D65) to RGB.
 *
 * @param xyz - [X, Y, Z] in range 0–1
 * @returns [R, G, B] each in range 0–255
 */
export function XYZD65_to_RGB(xyz: number[]) {
    const linRGB = multiplyMatrices(MATRICES.XYZD65_to_SRGB, xyz);
    const gammaRGB = linRGB.map((v) => {
        const sign = v < 0 ? -1 : 1,
            abs = Math.abs(v);
        return abs > 0.0031308 ? sign * (1.055 * abs ** (1 / 2.4) - 0.055) : 12.92 * v;
    });
    return gammaRGB.map((v) => v * 255);
}

/**
 * Converts HSL to RGB.
 *
 * @param hsl - [h, s, l] where H ∈ [0, 360], S ∈ [0, 100], L ∈ [0, 100]
 * @returns [R, G, B] each in range 0–255
 */
export function HSL_to_RGB([h, s, l]: number[]) {
    s /= 100;
    l /= 100;
    const f = (n: number) => {
        const k = (n + h / 30) % 12;
        const a = s * Math.min(l, 1 - l);
        return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    };
    return [f(0) * 255, f(8) * 255, f(4) * 255];
}

/**
 * Converts RGB to HSL.
 *
 * @param rgb - [R, G, B] each in range 0–255
 * @returns [H, S, L] where H ∈ [0, 360], S ∈ [0, 100], L ∈ [0, 100]
 */
export function RGB_to_HSL(rgb: number[]) {
    const epsilon = 1 / 100000;
    const [r, g, b] = rgb.map((v) => v / 255);
    const max = Math.max(r, g, b),
        min = Math.min(r, g, b);
    const L = (max + min) / 2;
    const d = max - min;
    let H = NaN,
        S = 0;
    if (d > 0) {
        S = d / (1 - Math.abs(2 * L - 1));
        H = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
        H = (H * 60) % 360;
    }
    const S_out = S * 100,
        L_out = L * 100;
    const invalid = L_out <= epsilon || 100 - L_out <= epsilon || S_out <= epsilon;
    return [invalid ? NaN : H, S_out, L_out];
}

/**
 * Converts HWB to RGB.
 *
 * @param hwb - [h, w, b] where H ∈ [0, 360], W ∈ [0, 100], B ∈ [0, 100]
 * @returns [R, G, B] each in range 0–255
 */
export function HWB_to_RGB([h, w, b]: number[]) {
    w /= 100;
    b /= 100;
    if (w + b >= 1) {
        const gray = (w / (w + b)) * 255;
        return [gray, gray, gray];
    }
    const rgb = HSL_to_RGB([h, 100, 50]).map((c) => c / 255);
    return rgb.map((v) => (v * (1 - w - b) + w) * 255);
}

/**
 * Converts RGB to HWB.
 *
 * @param rgb - [R, G, B] each in range 0–255
 * @returns [H, W, B] where H ∈ [0, 360], W ∈ [0, 100], B ∈ [0, 100]
 */
export function RGB_to_HWB(rgb: number[]) {
    const epsilon = 1 / 100000;
    const [r, g, b] = rgb.map((v) => v / 255);
    const max = Math.max(r, g, b),
        min = Math.min(r, g, b);
    const d = max - min;
    let H = NaN;
    if (d > epsilon) {
        H = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
        H = (H * 60) % 360;
    }
    return [H, min * 100, (1 - max) * 100];
}

/**
 * Converts LAB to XYZ (D50).
 *
 * @param lab - [L, a, b] where L ∈ [0, 100], a ∈ [-125, 125], b ∈ [-125, 125]
 * @returns [X, Y, Z] in range 0–1
 */
export function LAB_to_XYZD50([L, a, b]: number[]) {
    const D50 = [0.3457 / 0.3585, 1, (1 - 0.3457 - 0.3585) / 0.3585];
    const κ = 24389 / 27,
        ε = 216 / 24389;
    const fy = (L + 16) / 116,
        fx = a / 500 + fy,
        fz = fy - b / 200;
    const xyz = [
        fx ** 3 > ε ? fx ** 3 : (116 * fx - 16) / κ,
        L > κ * ε ? fy ** 3 : L / κ,
        fz ** 3 > ε ? fz ** 3 : (116 * fz - 16) / κ,
    ];
    return xyz.map((v, i) => v * D50[i]);
}

/**
 * Converts XYZ (D50) to LAB.
 *
 * @param xyz - [X, Y, Z] in range 0–1
 * @returns [L, a, b] where L ∈ [0, 100], a ∈ [-125, 125], b ∈ [-125, 125]
 */
export function XYZD50_to_LAB(xyz: number[]) {
    const D50 = [0.3457 / 0.3585, 1, (1 - 0.3457 - 0.3585) / 0.3585];
    const κ = 24389 / 27,
        ε = 216 / 24389;
    const xyz_d50 = xyz.map((v, i) => v / D50[i]);
    const [fx, fy, fz] = xyz_d50.map((v) => (v > ε ? Math.cbrt(v) : (κ * v + 16) / 116));
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/**
 * Converts LCH to LAB.
 *
 * @param [L, C, H] - L ∈ [0, 100], C ∈ [0, 150], H ∈ [0, 360]
 * @returns [L, a, b] where a ∈ [-125, 125], b ∈ [-125, 125]
 */
export function LCH_to_LAB([L, C, H]: number[]) {
    return [L, C * Math.cos((H * Math.PI) / 180), C * Math.sin((H * Math.PI) / 180)];
}

/**
 * Converts LAB to LCH.
 *
 * @param [L, a, b] - L ∈ [0, 100], a ∈ [-125, 125], b ∈ [-125, 125]
 * @returns [L, C, H] where L ∈ [0, 100], C ∈ [0, 150], H ∈ [0, 360]
 */
export function LAB_to_LCH([L, a, b]: number[]) {
    const epsilon = 0.0015;
    const C = Math.hypot(a, b);
    let H = (Math.atan2(b, a) * 180) / Math.PI;
    if (H < 0) H += 360;
    return [L, C, C <= epsilon ? NaN : H];
}

/**
 * Converts OKLab to XYZ (D65).
 *
 * @param [L, a, b] - L ∈ [0, 1], a ∈ [-0.4, 0.4], b ∈ [-0.4, 0.4]
 * @returns [X, Y, Z] in range 0–1
 */
export function OKLAB_to_XYZD65(oklab: number[]) {
    const { LMS_to_XYZD65, OKLAB_to_LMS } = MATRICES;
    const LMSnl = multiplyMatrices(OKLAB_to_LMS, oklab);
    return multiplyMatrices(
        LMS_to_XYZD65,
        LMSnl.map((c) => c ** 3)
    );
}

/**
 * Converts XYZ (D65) to OKLab.
 *
 * @param [X, Y, Z] - each ∈ [0, 1]
 * @returns [L, a, b] where L ∈ [0, 1], a ∈ [-0.4, 0.4], b ∈ [-0.4, 0.4]
 */
export function XYZD65_to_OKLAB(xyz: number[]) {
    const { XYZD65_to_LMS, LMS_to_OKLAB } = MATRICES;
    const LMS = multiplyMatrices(XYZD65_to_LMS, xyz);
    return multiplyMatrices(LMS_to_OKLAB, LMS.map(Math.cbrt));
}

/**
 * Converts OKLCH to OKLab.
 *
 * @param [L, C, H] - L ∈ [0, 1], C ∈ [0, 0.4], H ∈ [0, 360]
 * @returns [L, a, b] where a ∈ [-0.4, 0.4], b ∈ [-0.4, 0.4]
 */
export function OKLCH_to_OKLAB([L, C, H]: number[]) {
    return [L, C * Math.cos((H * Math.PI) / 180), C * Math.sin((H * Math.PI) / 180)];
}

/**
 * Converts OKLab to OKLCH.
 *
 * @param [L, a, b] - L ∈ [0, 1], a ∈ [-0.4, 0.4], b ∈ [-0.4, 0.4]
 * @returns [L, C, H] where C ∈ [0, 0.4], H ∈ [0, 360]
 */
export function OKLAB_to_OKLCH([L, a, b]: number[]) {
    const epsilon = 0.000004;
    const C = Math.hypot(a, b);
    let H = (Math.atan2(b, a) * 180) / Math.PI;
    if (H < 0) H += 360;
    return [L, C, C <= epsilon ? NaN : H];
}

/**
 * A collection of color spaces for `<color()>` function and their conversion logic.
 *
 * @see {@link https://www.w3.org/TR/css-color-4/|CSS Color Module Level 4}
 */
export const colorSpaces = {
    srgb: spaceConverterToModelConverter("srgb", {
        components: ["r", "g", "b", "alpha"],
        bridge: "xyz-d65",
        toLinear: (c: number) => {
            const sign = c < 0 ? -1 : 1;
            const abs = Math.abs(c);
            if (abs <= 0.04045) return sign * (abs / 12.92);
            return sign * Math.pow((abs + 0.055) / 1.055, 2.4);
        },
        fromLinear: (c: number) => {
            const sign = c < 0 ? -1 : 1;
            const abs = Math.abs(c);
            if (abs > 0.0031308) return sign * (1.055 * Math.pow(abs, 1 / 2.4) - 0.055);
            return sign * (12.92 * abs);
        },
        toBridgeMatrix: MATRICES.SRGB_to_XYZD65,
        fromBridgeMatrix: MATRICES.XYZD65_to_SRGB,
    }),
    "srgb-linear": spaceConverterToModelConverter("srgb-linear", {
        components: ["r", "g", "b", "alpha"],
        bridge: "xyz-d65",
        toBridgeMatrix: MATRICES.SRGB_to_XYZD65,
        fromBridgeMatrix: MATRICES.XYZD65_to_SRGB,
    }),
    "display-p3": spaceConverterToModelConverter("display-p3", {
        components: ["r", "g", "b", "alpha"],
        bridge: "xyz-d65",
        toLinear: (c: number) => {
            const sign = c < 0 ? -1 : 1;
            const abs = Math.abs(c);
            if (abs <= 0.04045) return sign * (abs / 12.92);
            return sign * Math.pow((abs + 0.055) / 1.055, 2.4);
        },
        fromLinear: (c: number) => {
            const sign = c < 0 ? -1 : 1;
            const abs = Math.abs(c);
            if (abs > 0.0031308) return sign * (1.055 * Math.pow(abs, 1 / 2.4) - 0.055);
            return sign * (12.92 * abs);
        },
        toBridgeMatrix: MATRICES.P3_to_XYZD65,
        fromBridgeMatrix: MATRICES.XYZD65_to_P3,
    }),
    rec2020: spaceConverterToModelConverter("rec2020", {
        components: ["r", "g", "b", "alpha"],
        bridge: "xyz-d65",
        toLinear: (c: number) => {
            const α = 1.09929682680944;
            const β = 0.018053968510807;
            const sign = c < 0 ? -1 : 1;
            const abs = Math.abs(c);
            if (abs < β * 4.5) return sign * (abs / 4.5);
            return sign * Math.pow((abs + α - 1) / α, 1 / 0.45);
        },
        fromLinear: (c: number) => {
            const α = 1.09929682680944;
            const β = 0.018053968510807;
            const sign = c < 0 ? -1 : 1;
            const abs = Math.abs(c);
            if (abs > β) return sign * (α * Math.pow(abs, 0.45) - (α - 1));
            return sign * (4.5 * abs);
        },
        toBridgeMatrix: MATRICES.REC2020_to_XYZD65,
        fromBridgeMatrix: MATRICES.XYZD65_to_REC2020,
    }),
    "a98-rgb": spaceConverterToModelConverter("a98-rgb", {
        components: ["r", "g", "b", "alpha"],
        bridge: "xyz-d65",
        toLinear: (c: number) => {
            const sign = c < 0 ? -1 : 1;
            const abs = Math.abs(c);
            return sign * Math.pow(abs, 563 / 256);
        },
        fromLinear: (c: number) => {
            const sign = c < 0 ? -1 : 1;
            const abs = Math.abs(c);
            return sign * Math.pow(abs, 256 / 563);
        },
        toBridgeMatrix: MATRICES.A98_to_XYZD65,
        fromBridgeMatrix: MATRICES.XYZD65_to_A98,
    }),
    "prophoto-rgb": spaceConverterToModelConverter("prophoto-rgb", {
        components: ["r", "g", "b", "alpha"],
        bridge: "xyz-d50",
        toLinear: (c: number) => {
            const Et2 = 16 / 512;
            const sign = c < 0 ? -1 : 1;
            const abs = Math.abs(c);
            if (abs <= Et2) return sign * (abs / 16);
            return sign * Math.pow(abs, 1.8);
        },
        fromLinear: (c: number) => {
            const Et = 1 / 512;
            const sign = c < 0 ? -1 : 1;
            const abs = Math.abs(c);
            if (abs >= Et) return sign * Math.pow(abs, 1 / 1.8);
            return sign * (16 * abs);
        },
        toBridgeMatrix: MATRICES.ProPhoto_to_XYZD50,
        fromBridgeMatrix: MATRICES.XYZD50_to_ProPhoto,
    }),
    "xyz-d65": spaceConverterToModelConverter("xyz-d65", {
        targetGamut: null,
        components: ["x", "y", "z", "alpha"],
        bridge: "xyz-d65",
        toBridgeMatrix: [
            [1, 0, 0],
            [0, 1, 0],
            [0, 0, 1],
        ],
        fromBridgeMatrix: [
            [1, 0, 0],
            [0, 1, 0],
            [0, 0, 1],
        ],
    }),
    "xyz-d50": spaceConverterToModelConverter("xyz-d50", {
        targetGamut: null,
        components: ["x", "y", "z", "alpha"],
        bridge: "xyz-d65",
        toBridgeMatrix: MATRICES.D50_to_D65,
        fromBridgeMatrix: MATRICES.D65_to_d50,
    }),
    xyz: spaceConverterToModelConverter("xyz", {
        targetGamut: null,
        components: ["x", "y", "z", "alpha"],
        bridge: "xyz-d65",
        toBridgeMatrix: [
            [1, 0, 0],
            [0, 1, 0],
            [0, 0, 1],
        ],
        fromBridgeMatrix: [
            [1, 0, 0],
            [0, 1, 0],
            [0, 0, 1],
        ],
    }),
} as const satisfies Record<string, ColorModelConverter>;

/**
 * A collection of manipulatable color models and their conversion logic.
 *
 * @see {@link https://www.w3.org/TR/css-color-4/|CSS Color Module Level 4}
 */
export const colorModels = {
    rgb: {
        supportsLegacy: true,
        alphaVariant: "rgba",
        components: {
            r: { index: 0, value: [0, 255], precision: 0 },
            g: { index: 1, value: [0, 255], precision: 0 },
            b: { index: 2, value: [0, 255], precision: 0 },
            alpha: { index: 3, value: [0, 1], precision: 3 },
        },
        bridge: "xyz-d65",
        toBridge: RGB_to_XYZD65,
        fromBridge: XYZD65_to_RGB,
    },
    hsl: {
        supportsLegacy: true,
        alphaVariant: "hsla",
        components: {
            h: { index: 0, value: "hue", precision: 0 },
            s: { index: 1, value: "percentage", precision: 0 },
            l: { index: 2, value: "percentage", precision: 0 },
            alpha: { index: 3, value: [0, 1], precision: 3 },
        },
        bridge: "rgb",
        toBridge: HSL_to_RGB,
        fromBridge: RGB_to_HSL,
    },
    hwb: {
        components: {
            h: { index: 0, value: "hue", precision: 0 },
            w: { index: 1, value: "percentage", precision: 0 },
            b: { index: 2, value: "percentage", precision: 0 },
            alpha: { index: 3, value: [0, 1], precision: 3 },
        },
        bridge: "rgb",
        toBridge: HWB_to_RGB,
        fromBridge: RGB_to_HWB,
    },
    lab: {
        targetGamut: null,
        components: {
            l: { index: 0, value: "percentage", precision: 5 },
            a: { index: 1, value: [-125, 125], precision: 5 },
            b: { index: 2, value: [-125, 125], precision: 5 },
            alpha: { index: 3, value: [0, 1], precision: 3 },
        },
        bridge: "xyz-d50",
        toBridge: LAB_to_XYZD50,
        fromBridge: XYZD50_to_LAB,
    },
    lch: {
        targetGamut: null,
        components: {
            l: { index: 0, value: "percentage", precision: 5 },
            c: { index: 1, value: [0, 150], precision: 5 },
            h: { index: 2, value: "hue", precision: 5 },
            alpha: { index: 3, value: [0, 1], precision: 3 },
        },
        bridge: "lab",
        toBridge: LCH_to_LAB,
        fromBridge: LAB_to_LCH,
    },
    oklab: {
        targetGamut: null,
        components: {
            l: { index: 0, value: [0, 1], precision: 5 },
            a: { index: 1, value: [-0.4, 0.4], precision: 5 },
            b: { index: 2, value: [-0.4, 0.4], precision: 5 },
            alpha: { index: 3, value: [0, 1], precision: 3 },
        },
        bridge: "xyz-d65",
        toBridge: OKLAB_to_XYZD65,
        fromBridge: XYZD65_to_OKLAB,
    },
    oklch: {
        targetGamut: null,
        components: {
            l: { index: 0, value: [0, 1], precision: 5 },
            c: { index: 1, value: [0, 0.4], precision: 5 },
            h: { index: 2, value: "hue", precision: 5 },
            alpha: { index: 3, value: [0, 1], precision: 3 },
        },
        bridge: "oklab",
        toBridge: OKLCH_to_OKLAB,
        fromBridge: OKLAB_to_OKLCH,
    },
    ...colorSpaces,
} as const;
