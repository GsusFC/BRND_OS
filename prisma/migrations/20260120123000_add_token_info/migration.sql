-- Add token info fields to brands
ALTER TABLE `brands`
  ADD COLUMN `tokenContractAddress` VARCHAR(255) NULL,
  ADD COLUMN `tokenTicker` VARCHAR(32) NULL;
