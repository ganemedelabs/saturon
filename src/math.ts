import { Color } from "./Color.js";
import { colorModels } from "./converters.js";
import { ColorModelConverter, ColorSpace, FitFunction } from "./types.js";
import { multiplyMatrices, fit } from "./utils.js";

/**
 * A collection of commonly used color space conversion matrices.
 *
 * @see {@link https://www.w3.org/TR/css-color-4/|CSS Color Module Level 4}
 */
export const MATRICES = {
    D50_to_D65: [
        [0.955473421488075, -0.02309845494876471, 0.06325924320057072],
        [-0.0283697093338637, 1.0099953980813041, 0.021041441191917323],
        [0.012314014864481998, -0.020507649298898964, 1.330365926242124],
    ],
    D65_to_d50: [
        [1.0479297925449969, 0.022946870601609652, -0.05019226628920524],
        [0.02962780877005599, 0.9904344267538799, -0.017073799063418826],
        [-0.009243040646204504, 0.015055191490298152, 0.7518742814281371],
    ],
    SRGB_to_XYZD65: [
        [506752 / 1228815, 87881 / 245763, 12673 / 70218],
        [87098 / 409605, 175762 / 245763, 12673 / 175545],
        [7918 / 409605, 87881 / 737289, 1001167 / 1053270],
    ],
    XYZD65_to_SRGB: [
        [12831 / 3959, -329 / 214, -1974 / 3959],
        [-851781 / 878810, 1648619 / 878810, 36519 / 878810],
        [705 / 12673, -2585 / 12673, 705 / 667],
    ],
    P3_to_XYZD65: [
        [608311 / 1250200, 189793 / 714400, 198249 / 1000160],
        [35783 / 156275, 247089 / 357200, 198249 / 2500400],
        [0 / 1, 32229 / 714400, 5220557 / 5000800],
    ],
    XYZD65_to_P3: [
        [446124 / 178915, -333277 / 357830, -72051 / 178915],
        [-14852 / 17905, 63121 / 35810, 423 / 17905],
        [11844 / 330415, -50337 / 660830, 316169 / 330415],
    ],
    REC2020_to_XYZD65: [
        [63426534 / 99577255, 20160776 / 139408157, 47086771 / 278816314],
        [26158966 / 99577255, 472592308 / 697040785, 8267143 / 139408157],
        [0 / 1, 19567812 / 697040785, 295819943 / 278816314],
    ],
    XYZD65_to_REC2020: [
        [30757411 / 17917100, -6372589 / 17917100, -4539589 / 17917100],
        [-19765991 / 29648200, 47925759 / 29648200, 467509 / 29648200],
        [792561 / 44930125, -1921689 / 44930125, 42328811 / 44930125],
    ],
    A98_to_XYZD65: [
        [573536 / 994567, 263643 / 1420810, 187206 / 994567],
        [591459 / 1989134, 6239551 / 9945670, 374412 / 4972835],
        [53769 / 1989134, 351524 / 4972835, 4929758 / 4972835],
    ],
    ProPhoto_to_XYZD50: [
        [0.7977666449006423, 0.13518129740053308, 0.0313477341283922],
        [0.2880748288194013, 0.711835234241873, 0.00008993693872564],
        [0.0, 0.0, 0.8251046025104602],
    ],
    XYZD50_to_ProPhoto: [
        [1.3457868816471583, -0.25557208737979464, -0.05110186497554526],
        [-0.5446307051249019, 1.5082477428451468, 0.02052744743642139],
        [0.0, 0.0, 1.2119675456389452],
    ],
    XYZD65_to_A98: [
        [1829569 / 896150, -506331 / 896150, -308931 / 896150],
        [-851781 / 878810, 1648619 / 878810, 36519 / 878810],
        [16779 / 1248040, -147721 / 1248040, 1266979 / 1248040],
    ],
    LMS_to_XYZD65: [
        [1.2268798758459243, -0.5578149944602171, 0.2813910456659647],
        [-0.0405757452148008, 1.112286803280317, -0.0717110580655164],
        [-0.0763729366746601, -0.4214933324022432, 1.5869240198367816],
    ],
    XYZD65_to_LMS: [
        [0.819022437996703, 0.3619062600528904, -0.1288737815209879],
        [0.0329836539323885, 0.9292868615863434, 0.0361446663506424],
        [0.0481771893596242, 0.2642395317527308, 0.6335478284694309],
    ],
    LMS_to_OKLAB: [
        [0.210454268309314, 0.7936177747023054, -0.0040720430116193],
        [1.9779985324311684, -2.4285922420485799, 0.450593709617411],
        [0.0259040424655478, 0.7827717124575296, -0.8086757549230774],
    ],
    OKLAB_to_LMS: [
        [1.0, 0.3963377773761749, 0.2158037573099136],
        [1.0, -0.1055613458156586, -0.0638541728258133],
        [1.0, -0.0894841775298119, -1.2914855480194092],
    ],
};

/** A collection of common easing functions for interpolation. */
export const EASINGS = {
    linear: (t: number) => t,
    "ease-in": (t: number) => t * t,
    "ease-out": (t: number) => t * (2 - t),
    "ease-in-out": (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
    "ease-in-cubic": (t: number) => t * t * t,
    "ease-out-cubic": (t: number) => --t * t * t + 1,
    "ease-in-out-cubic": (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
};

/**
 * A collection of color coordinate fitting methods used to ensure color values conform to specific constraints or gamuts.
 *
 * @remarks
 * Each method in `fitMethods` provides a different strategy for adjusting color coordinates:
 * - `"clip"`: Simple clipping to gamut boundaries (W3C Color 4, Section 13.1.1).
 * - `"chroma-reduction"`: Chroma reduction with local clipping in OKLCh (W3C Color 4, Section 13.1.5).
 * - `"css-gamut-map"`: CSS Gamut Mapping algorithm for RGB destinations (W3C Color 4, Section 13.2).
 *
 * @see {@link https://www.w3.org/TR/css-color-4/|CSS Color Module Level 4}
 */
export const fitMethods = {
    "chroma-reduction": (coords, model) => {
        const color = new Color(model, coords);
        let { targetGamut } = colorModels[model] as ColorModelConverter;
        if (targetGamut === null) return coords;
        if (targetGamut === undefined) targetGamut = "srgb";
        if (color.inGamut(targetGamut as ColorSpace, 1e-5)) return coords;

        const [L, , H] = color.in("oklch").toArray({ fit: "none", precision: null });
        const L_clipped = Math.min(1, Math.max(0, L));

        let C_low = 0;
        let C_high = 1.0;
        const epsilon = 1e-6;
        let clipped: number[] = [];

        while (C_high - C_low > epsilon) {
            const C_mid = (C_low + C_high) / 2;
            const candidate_color = new Color("oklch", [L_clipped, C_mid, H]);

            if (candidate_color.inGamut(targetGamut as ColorSpace, 1e-5)) C_low = C_mid;
            else {
                const clipped_coords = fit(
                    candidate_color.toArray({ fit: "none", precision: null }).slice(0, 3),
                    model,
                    { method: "clip" }
                );
                const clipped_color = new Color(model, clipped_coords);
                const deltaE = candidate_color.deltaEOK(clipped_color);
                if (deltaE < 2) {
                    clipped = clipped_coords;
                    return clipped;
                } else C_high = C_mid;
            }
        }

        const finalColor = new Color("oklch", [L_clipped, C_low, H]);
        clipped = finalColor.in(model).toArray({ fit: "none", precision: null });
        return clipped;
    },
    "css-gamut-map": (coords, model): number[] => {
        let { targetGamut } = colorModels[model] as ColorModelConverter;
        if (targetGamut === null) return coords;
        if (targetGamut === undefined) targetGamut = "srgb";

        const color = new Color(model, coords);
        const [L, C, H] = color.in("oklch").toArray({ fit: "none", precision: null });

        if (L >= 1.0) {
            const white = new Color("oklab", [1, 0, 0]);
            return white.in(model).toArray({ fit: "none", precision: null });
        }

        if (L <= 0.0) {
            const black = new Color("oklab", [0, 0, 0]);
            return black.in(model).toArray({ fit: "none", precision: null });
        }

        if (color.inGamut(targetGamut as ColorSpace, 1e-5)) return coords;

        const JND = 0.02;
        const epsilon = 0.0001;

        const current = new Color("oklch", [L, C, H]);
        let clipped: number[] = fit(current.in(model).toArray({ fit: "none", precision: null }).slice(0, 3), model, {
            method: "clip",
        });

        const initialClippedColor = new Color(model, clipped);
        const E = current.deltaEOK(initialClippedColor);

        if (E < JND) return clipped;

        let min = 0;
        let max = C;
        let min_inGamut = true;

        while (max - min > epsilon) {
            const chroma = (min + max) / 2;
            const candidate = new Color("oklch", [L, chroma, H]);

            if (min_inGamut && candidate.inGamut(targetGamut as ColorSpace, 1e-5)) min = chroma;
            else {
                const clippedCoords = fit(
                    candidate.in(model).toArray({ fit: "none", precision: null }).slice(0, 3),
                    model,
                    { method: "clip" }
                );
                clipped = clippedCoords;
                const clippedColor = new Color(model, clippedCoords);
                const deltaE = candidate.deltaEOK(clippedColor);

                if (deltaE < JND) {
                    if (JND - deltaE < epsilon) return clipped;
                    else {
                        min_inGamut = false;
                        min = chroma;
                    }
                } else max = chroma;
            }
        }

        return clipped;
    },
} satisfies Record<string, FitFunction>;

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
    const [r, g, b] = rgb.map((v) => v / 255);
    const max = Math.max(r, g, b),
        min = Math.min(r, g, b);
    const L = (max + min) / 2;
    let H = 0,
        S = 0;
    const d = max - min;

    if (d !== 0) {
        S = d / (1 - Math.abs(2 * L - 1));
        H = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
        H *= 60;
    }

    return [H % 360, S * 100, L * 100];
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
    const [r, g, b] = rgb.map((v) => v / 255);
    const max = Math.max(r, g, b),
        min = Math.min(r, g, b);
    let H = 0;
    const d = max - min;

    if (d === 0) H = 0;
    else {
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
    const C = Math.hypot(a, b);
    let H = (Math.atan2(b, a) * 180) / Math.PI;
    if (H < 0) H += 360;
    return [L, C, H];
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
    const C = Math.hypot(a, b);
    let H = (Math.atan2(b, a) * 180) / Math.PI;
    if (H < 0) H += 360;
    return [L, C, H];
}
