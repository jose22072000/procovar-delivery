-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "items" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "Route" ADD COLUMN     "deliveryDate" TIMESTAMP(3);
