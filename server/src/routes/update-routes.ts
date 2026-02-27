import { Router } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const updateRoutes = Router();

// This endpoint checks if a new version exists
updateRoutes.get("/check", (req, res) => {
    try {
        const metadataPath = path.join(__dirname, "../../updates/metadata.json");

        // If no metadata exists, just return version 1.0.0 telling client there's no update
        if (!fs.existsSync(metadataPath)) {
            return res.json({
                version: "1.0.0",
                url: `${process.env.VITE_API_URL || 'http://localhost:3000'}/updates/dist.zip`
            });
        }

        const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf-8"));

        res.json({
            version: metadata.version,
            // Provide the direct public URL to the zip bundle we will statically serve
            url: `${process.env.PURL || 'http://localhost:3000'}/updates/dist.zip`
        });

    } catch (error) {
        console.error("Error checking for updates:", error);
        res.status(500).json({ error: "Failed to check update" });
    }
});
