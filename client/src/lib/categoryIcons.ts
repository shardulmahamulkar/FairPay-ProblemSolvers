import Accommodation from "@/assets/Accomodation.svg";
import Beverages from "@/assets/Beverages.svg";
import Entertainment from "@/assets/Entertainment.png";
import Other from "@/assets/Other.svg";
import Shopping from "@/assets/Shopping.png";
import Travel from "@/assets/Travel.png";
import Utilities from "@/assets/Utilities.png";
import Food from "@/assets/fast-food.png";

const CATEGORY_ICONS: Record<string, string> = {
    // exact DB values (case-insensitive lookup done in helper)
    food: Food,
    transport: Travel,
    travel: Travel,
    accommodation: Accommodation,
    accomodation: Accommodation,
    utilities: Utilities,
    entertainment: Entertainment,
    shopping: Shopping,
    beverages: Beverages,
    other: Other,
};

export function getCategoryIcon(category?: string, note?: string): string {
    let cat = (category || "").toLowerCase();

    // If category is "other" or empty, try parsing the note for keywords
    if (!cat || cat === "other") {
        const n = (note || "").toLowerCase();
        for (const key of Object.keys(CATEGORY_ICONS)) {
            if (n.includes(key)) {
                cat = key;
                break;
            }
        }
    }

    return CATEGORY_ICONS[cat] ?? Other;
}

export function getCategoryName(category?: string, note?: string): string {
    let cat = (category || "").toLowerCase();

    // If category is "other" or empty, try parsing the note for keywords
    if (!cat || cat === "other") {
        const n = (note || "").toLowerCase();
        for (const key of Object.keys(CATEGORY_ICONS)) {
            if (n.includes(key)) {
                cat = key;
                break;
            }
        }
    }

    if (!cat || cat === "other") return "Other";
    return cat.charAt(0).toUpperCase() + cat.slice(1);
}

/** Returns { bg, text } classes for each category — navy glassmorphism */
const GLASS_BG = "bg-[#0f1c3f] border border-[#c9a84c]/40 shadow-[0_0_8px_rgba(201,168,76,0.2)]";
const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
    food: { bg: GLASS_BG, text: "text-slate-700 dark:text-white" },
    transport: { bg: GLASS_BG, text: "text-slate-700 dark:text-white" },
    travel: { bg: GLASS_BG, text: "text-slate-700 dark:text-white" },
    accommodation: { bg: GLASS_BG, text: "text-slate-700 dark:text-white" },
    accomodation: { bg: GLASS_BG, text: "text-slate-700 dark:text-white" },
    utilities: { bg: GLASS_BG, text: "text-slate-700 dark:text-white" },
    entertainment: { bg: GLASS_BG, text: "text-slate-700 dark:text-white" },
    shopping: { bg: GLASS_BG, text: "text-slate-700 dark:text-white" },
    beverages: { bg: GLASS_BG, text: "text-slate-700 dark:text-white" },
    other: { bg: GLASS_BG, text: "text-slate-700 dark:text-white" },
};

export function getCategoryColor(category?: string, note?: string): { bg: string; text: string } {
    let cat = (category || "").toLowerCase();
    if (!cat || cat === "other") {
        const n = (note || "").toLowerCase();
        for (const key of Object.keys(CATEGORY_COLORS)) {
            if (n.includes(key)) { cat = key; break; }
        }
    }
    return CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.other;
}
