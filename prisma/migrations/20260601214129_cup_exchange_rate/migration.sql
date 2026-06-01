-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "baseFee" REAL NOT NULL DEFAULT 5.0,
    "costPerKm" REAL NOT NULL DEFAULT 1.5,
    "costPerKg" REAL NOT NULL DEFAULT 0.5,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "cupRate" REAL NOT NULL DEFAULT 320.0,
    "cupRateUpdatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Settings" ("baseFee", "costPerKg", "costPerKm", "currency", "id") SELECT "baseFee", "costPerKg", "costPerKm", "currency", "id" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
