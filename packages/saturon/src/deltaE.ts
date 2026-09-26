import { convert } from "./convert.js";
import { ColorModel } from "./converters.js";
import { ColorData } from "./syntax.js";
import { toArray } from "./toArray.js";

function toNormArray(color: ColorData, model: ColorModel): number[] {
    const coords = convert(color, model);
    return toArray({ model, coords }, { fit: "none", precision: null });
}

export function deltaEOK(color1: ColorData, color2: ColorData): number {
    const [L1, a1, b1] = toNormArray(color1, "oklab");
    const [L2, a2, b2] = toNormArray(color2, "oklab");

    const ΔL = L1 - L2;
    const ΔA = a1 - a2;
    const ΔB = b1 - b2;
    const distance = Math.sqrt(ΔL ** 2 + ΔA ** 2 + ΔB ** 2);

    return distance * 100;
}

export function deltaE76(color1: ColorData, color2: ColorData): number {
    const [L1, a1, b1] = toNormArray(color1, "lab");
    const [L2, a2, b2] = toNormArray(color2, "lab");

    const ΔL = L1 - L2;
    const ΔA = a1 - a2;
    const ΔB = b1 - b2;

    return Math.hypot(ΔL, ΔA, ΔB);
}

export function deltaE94(color1: ColorData, color2: ColorData): number {
    const [L1, a1, b1] = toNormArray(color1, "lab");
    const [L2, a2, b2] = toNormArray(color2, "lab");

    const ΔL = L1 - L2;
    const ΔA = a1 - a2;
    const ΔB = b1 - b2;

    const C1 = Math.sqrt(a1 * a1 + b1 * b1);
    const C2 = Math.sqrt(a2 * a2 + b2 * b2);
    const ΔC = C1 - C2;
    const ΔH = Math.sqrt(Math.max(0, ΔA * ΔA + ΔB * ΔB - ΔC * ΔC));

    const kL = 1,
        kC = 1,
        kH = 1;
    const K1 = 0.045,
        K2 = 0.015;

    const sC = 1 + K1 * C1;
    const sH = 1 + K2 * C1;

    return Math.sqrt((ΔL / kL) ** 2 + (ΔC / (kC * sC)) ** 2 + (ΔH / (kH * sH)) ** 2);
}

export function deltaE2000(color1: ColorData, color2: ColorData): number {
    const [L1, a1, b1] = toNormArray(color1, "lab");
    const [L2, a2, b2] = toNormArray(color2, "lab");

    const π = Math.PI,
        d2r = π / 180,
        r2d = 180 / π;

    const C1 = Math.sqrt(a1 ** 2 + b1 ** 2);
    const C2 = Math.sqrt(a2 ** 2 + b2 ** 2);
    const Cbar = (C1 + C2) / 2;

    const Gfactor = Math.pow(25, 7);
    const C7 = Math.pow(Cbar, 7);
    const G = 0.5 * (1 - Math.sqrt(C7 / (C7 + Gfactor)));

    const adash1 = (1 + G) * a1;
    const adash2 = (1 + G) * a2;

    const Cdash1 = Math.sqrt(adash1 ** 2 + b1 ** 2);
    const Cdash2 = Math.sqrt(adash2 ** 2 + b2 ** 2);

    let h1 = Math.atan2(b1, adash1);
    let h2 = Math.atan2(b2, adash2);
    if (h1 < 0) h1 += 2 * π;
    if (h2 < 0) h2 += 2 * π;
    h1 *= r2d;
    h2 *= r2d;

    const ΔL = L2 - L1;
    const ΔC = Cdash2 - Cdash1;

    const hdiff = h2 - h1;
    const habs = Math.abs(hdiff);
    let Δh = 0;
    if (Cdash1 * Cdash2 !== 0) {
        if (habs <= 180) Δh = hdiff;
        else if (hdiff > 180) Δh = hdiff - 360;
        else Δh = hdiff + 360;
    }
    const ΔH = 2 * Math.sqrt(Cdash1 * Cdash2) * Math.sin((Δh * d2r) / 2);

    const Ldash = (L1 + L2) / 2;
    const Cdash = (Cdash1 + Cdash2) / 2;
    const Cdash7 = Math.pow(Cdash, 7);

    const hsum = h1 + h2;
    let hdash;
    if (Cdash1 === 0 && Cdash2 === 0) {
        hdash = hsum;
    } else if (habs <= 180) {
        hdash = hsum / 2;
    } else if (hsum < 360) {
        hdash = (hsum + 360) / 2;
    } else {
        hdash = (hsum - 360) / 2;
    }

    const lsq = (Ldash - 50) ** 2;
    const SL = 1 + (0.015 * lsq) / Math.sqrt(20 + lsq);
    const SC = 1 + 0.045 * Cdash;

    let T = 1;
    T -= 0.17 * Math.cos((hdash - 30) * d2r);
    T += 0.24 * Math.cos(2 * hdash * d2r);
    T += 0.32 * Math.cos((3 * hdash + 6) * d2r);
    T -= 0.2 * Math.cos((4 * hdash - 63) * d2r);

    const SH = 1 + 0.015 * Cdash * T;
    const Δθ = 30 * Math.exp(-1 * ((hdash - 275) / 25) ** 2);
    const RC = 2 * Math.sqrt(Cdash7 / (Cdash7 + Gfactor));
    const RT = -1 * Math.sin(2 * Δθ * d2r) * RC;

    let dE = (ΔL / SL) ** 2;
    dE += (ΔC / SC) ** 2;
    dE += (ΔH / SH) ** 2;
    dE += RT * (ΔC / SC) * (ΔH / SH);

    return Math.sqrt(dE);
}
