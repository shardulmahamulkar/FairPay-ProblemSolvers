import Tesseract from "tesseract.js";

export interface BillParseResult {
    amount: string;
    note: string;
    category: string;
    rawText: string;
}

const CATEGORY_KEYWORDS: Record<string, string[]> = {
    Food: ["restaurant", "food", "cafe", "dine", "meal", "eat", "pizza", "burger", "biryani", "swiggy", "zomato", "kitchen", "dhaba", "hotel", "thali", "lunch", "dinner", "breakfast", "snack", "bakery", "chai", "tea", "coffee"],
    Transport: ["uber", "ola", "cab", "taxi", "petrol", "fuel", "diesel", "bus", "metro", "train", "flight", "parking", "toll", "auto", "rickshaw", "rapido"],
    Accommodation: ["hotel", "room", "stay", "airbnb", "hostel", "lodge", "resort", "oyo", "booking", "rent", "accommodation"],
    Utilities: ["electric", "water", "gas", "wifi", "internet", "broadband", "recharge", "bill", "jio", "airtel", "vodafone", "bsnl"],
    Entertainment: ["movie", "cinema", "pvr", "inox", "game", "concert", "show", "netflix", "spotify", "ticket", "amusement", "park"],
    Shopping: ["amazon", "flipkart", "myntra", "mall", "shop", "store", "mart", "market", "retail", "purchase", "fashion", "cloth"],
    Beverages: ["beer", "wine", "drink", "bar", "pub", "juice", "soda", "water", "beverage", "alcohol", "whisky", "rum"],
};

/**
 * Extract the most likely total amount from OCR text.
 * We look for patterns like "Total: 1,234.56", "Grand Total ₹1234", "Amount: Rs. 500" etc.
 * Falls back to the largest number found.
 */
function extractAmount(text: string): string {
    // Normalise currency symbols and whitespace
    const cleaned = text
        .replace(/[₹$€£]/g, " ")
        .replace(/Rs\.?/gi, " ")
        .replace(/INR/gi, " ");

    // Priority patterns — look for labelled totals first
    const totalPatterns = [
        /(?:grand\s*total|net\s*total|total\s*(?:amount|amt|due|payable)?)\s*[:\-=]?\s*([\d,]+\.?\d*)/gi,
        /(?:amount\s*(?:due|payable)?|bill\s*(?:amount|total)?)\s*[:\-=]?\s*([\d,]+\.?\d*)/gi,
        /(?:pay|paid)\s*[:\-=]?\s*([\d,]+\.?\d*)/gi,
    ];

    for (const pattern of totalPatterns) {
        const matches = [...cleaned.matchAll(pattern)];
        if (matches.length > 0) {
            // Take the last match (usually the final total on a receipt)
            const raw = matches[matches.length - 1][1].replace(/,/g, "");
            const num = parseFloat(raw);
            if (num > 0 && num < 10_000_000) return String(num);
        }
    }

    // Fallback: find all numbers and pick the largest reasonable one
    const numbers = [...cleaned.matchAll(/([\d,]+\.?\d+)/g)]
        .map(m => parseFloat(m[1].replace(/,/g, "")))
        .filter(n => n >= 1 && n < 10_000_000);

    if (numbers.length > 0) {
        return String(Math.max(...numbers));
    }

    return "";
}

/**
 * Build a short note / description from the first meaningful line of the receipt.
 */
function extractNote(text: string): string {
    const lines = text
        .split("\n")
        .map(l => l.trim())
        .filter(l => l.length > 2 && !/^[-=_*]+$/.test(l));

    // First non-numeric line is usually the merchant name
    for (const line of lines.slice(0, 5)) {
        if (!/^\d+$/.test(line) && !/^(date|time|bill|invoice|gst|tax)/i.test(line)) {
            // Clean up and truncate
            return line.replace(/[^a-zA-Z0-9 &'.\-,]/g, "").substring(0, 60).trim();
        }
    }

    return "";
}

/**
 * Guess expense category based on keyword matching in the OCR text.
 */
function guessCategory(text: string): string {
    const lower = text.toLowerCase();
    let bestCategory = "Other";
    let bestScore = 0;

    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
        const score = keywords.filter(kw => lower.includes(kw)).length;
        if (score > bestScore) {
            bestScore = score;
            bestCategory = category;
        }
    }

    return bestCategory;
}

/**
 * Run Tesseract OCR on an image file and parse bill details.
 * Runs entirely in the browser — no API key needed, no usage limits.
 */
export async function scanBill(
    imageSource: File | string,
    onProgress?: (progress: number) => void
): Promise<BillParseResult> {
    const result = await Tesseract.recognize(imageSource, "eng", {
        logger: (m) => {
            if (m.status === "recognizing text" && onProgress) {
                onProgress(Math.round(m.progress * 100));
            }
        },
    });

    const rawText = result.data.text;

    return {
        amount: extractAmount(rawText),
        note: extractNote(rawText),
        category: guessCategory(rawText),
        rawText,
    };
}
