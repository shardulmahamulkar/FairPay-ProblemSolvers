import Accommodation from "@/assets/Accomodation.png";
import Beverages from "@/assets/Beverages.png";
import Entertainment from "@/assets/Entertainment.png";
import Other from "@/assets/Other.png";
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
