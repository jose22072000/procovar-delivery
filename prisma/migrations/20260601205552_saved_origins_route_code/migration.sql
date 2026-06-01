-- CreateTable
CREATE TABLE "SavedOrigin" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "lat" REAL NOT NULL,
    "lng" REAL NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SavedOrigin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Route" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "routeCode" TEXT,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "originAddress" TEXT,
    "originLat" REAL,
    "originLng" REAL,
    "totalDistance" REAL NOT NULL DEFAULT 0,
    "totalWeight" REAL NOT NULL DEFAULT 0,
    "totalPrice" REAL NOT NULL DEFAULT 0,
    "vehicleId" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "optimized" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Route_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Route_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Route" ("createdAt", "id", "name", "optimized", "originAddress", "originLat", "originLng", "status", "totalDistance", "totalPrice", "totalWeight", "updatedAt", "userId", "vehicleId") SELECT "createdAt", "id", "name", "optimized", "originAddress", "originLat", "originLng", "status", "totalDistance", "totalPrice", "totalWeight", "updatedAt", "userId", "vehicleId" FROM "Route";
DROP TABLE "Route";
ALTER TABLE "new_Route" RENAME TO "Route";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
