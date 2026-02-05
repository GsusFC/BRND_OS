export const DATABASE_SCHEMA = `
# BRND Database Schema (PostgreSQL - Indexer)
All tables use standard PostgreSQL naming. Use table names directly without schema prefix.

## Core Tables

### Table: users
Stores all user information and voting data.
- fid: INT (Primary Key) - Farcaster ID (Primary Key)
- brnd_power_level: INT - User's BRND power level (1-5)
- total_votes: INT - Total number of votes cast
- points: DECIMAL(78,0) - User's current point balance (use ::numeric for display)
- last_vote_day: INT (nullable) - Last day user voted (day number since season start)
- block_number: DECIMAL(78,0)
- transaction_hash: VARCHAR

### Table: brands
Stores information about all brands that users can vote on.
- id: INT (Primary Key) - Brand ID (Primary Key)
- fid: INT - Brand owner's Farcaster ID
- wallet_address: VARCHAR
- handle: VARCHAR - Brand handle (NO @ symbol)
- metadata_hash: VARCHAR
- total_brnd_awarded: DECIMAL(78,0) - Total BRND tokens awarded to brand
- available_brnd: DECIMAL(78,0) - Available BRND tokens for withdrawal
- created_at: DECIMAL(78,0)
- block_number: DECIMAL(78,0)
- transaction_hash: VARCHAR

### Table: votes
Records user voting sessions with brand choices.
- id: VARCHAR (Primary Key)
- voter: VARCHAR
- fid: INT
- day: DECIMAL(78,0) - Day number since season start
- brand_ids: VARCHAR - JSON array of 3 brand IDs voted for (e.g., "[19,62,227]")
- cost: DECIMAL(78,0) - Cost of the vote in BRND tokens
- block_number: DECIMAL(78,0)
- transaction_hash: VARCHAR
- timestamp: DECIMAL(78,0) - Vote timestamp (Unix seconds)

### Table: wallet_authorizations
Tracks wallets authorized by users for transactions.
- id: VARCHAR (Primary Key)
- fid: INT
- wallet: VARCHAR
- block_number: DECIMAL(78,0)
- transaction_hash: VARCHAR
- timestamp: DECIMAL(78,0)

## Leaderboard Tables

### Table: all_time_brand_leaderboard
All-time brand ranking by total points.
- brand_id: INT (Primary Key)
- points: DECIMAL(78,0)
- gold_count: INT
- silver_count: INT
- bronze_count: INT
- rank: INT (nullable)
- block_number: DECIMAL(78,0)
- updated_at: DECIMAL(78,0)

### Table: all_time_user_leaderboard
All-time user ranking by points.
- fid: INT (Primary Key)
- points: DECIMAL(78,0)
- rank: INT (nullable)
- block_number: DECIMAL(78,0)
- updated_at: DECIMAL(78,0)

### Table: brand_reward_withdrawals
Records of brand owners withdrawing their BRND rewards.
- id: VARCHAR (Primary Key)
- brand_id: INT
- fid: INT
- amount: DECIMAL(78,0)
- block_number: DECIMAL(78,0)
- transaction_hash: VARCHAR
- timestamp: DECIMAL(78,0)

### Table: brnd_power_level_ups
Records of users leveling up their BRND power.
- id: VARCHAR (Primary Key)
- fid: INT
- new_level: INT
- wallet: VARCHAR
- block_number: DECIMAL(78,0)
- transaction_hash: VARCHAR
- timestamp: DECIMAL(78,0)

## Collectible NFT Tables

### Table: collectible_ownership_history
Ownership transfer history for collectibles.
- id: VARCHAR (Primary Key)
- token_id: INT
- owner_fid: INT
- owner_wallet: VARCHAR
- acquisition_type: VARCHAR
- price_paid: DECIMAL(78,0) (nullable)
- acquired_at: DECIMAL(78,0)
- block_number: DECIMAL(78,0)
- transaction_hash: VARCHAR

### Table: collectible_repeat_fees
Repeat fee claims for collectible owners.
- id: VARCHAR (Primary Key)
- token_id: INT
- owner_fid: INT
- owner_wallet: VARCHAR
- fee_amount: DECIMAL(78,0)
- votes_that_generated_fee: INT
- block_number: DECIMAL(78,0)
- transaction_hash: VARCHAR
- timestamp: DECIMAL(78,0)
- claim_nonce: INT

### Table: collectible_sales
Sales history for podium collectible NFTs.
- id: VARCHAR (Primary Key)
- token_id: INT
- buyer_fid: INT
- buyer_wallet: VARCHAR
- seller_fid: INT
- seller_wallet: VARCHAR
- price: DECIMAL(78,0)
- seller_proceeds: DECIMAL(78,0)
- genesis_royalty: DECIMAL(78,0)
- protocol_fee: DECIMAL(78,0)
- claim_number: INT
- block_number: DECIMAL(78,0)
- transaction_hash: VARCHAR
- timestamp: DECIMAL(78,0)

## Leaderboard Tables

### Table: daily_brand_leaderboard
Daily brand rankings and medal counts.
- id: VARCHAR (Primary Key)
- brand_id: INT
- day: DECIMAL(78,0)
- points: DECIMAL(78,0)
- gold_count: INT
- silver_count: INT
- bronze_count: INT
- rank: INT (nullable)
- block_number: DECIMAL(78,0)
- updated_at: DECIMAL(78,0)

### Table: monthly_brand_leaderboard
Monthly brand rankings and medal counts.
- id: VARCHAR (Primary Key)
- brand_id: INT
- month: DECIMAL(78,0)
- points: DECIMAL(78,0)
- gold_count: INT
- silver_count: INT
- bronze_count: INT
- rank: INT (nullable)
- block_number: DECIMAL(78,0)
- updated_at: DECIMAL(78,0)

## Collectible NFT Tables

### Table: podium_collectibles
NFT collectibles representing podium arrangements.
- token_id: INT (Primary Key) - NFT token ID (Primary Key)
- arrangement_hash: VARCHAR - Hash of brand arrangement (gold+silver+bronze)
- gold_brand_id: INT - Brand ID in gold position
- silver_brand_id: INT - Brand ID in silver position
- bronze_brand_id: INT - Brand ID in bronze position
- genesis_creator_fid: INT - FID of the user who first minted this arrangement
- current_owner_fid: INT - FID of the current NFT owner
- current_owner_wallet: VARCHAR
- claim_count: INT - Number of times this NFT has been claimed/bought
- current_price: DECIMAL(78,0) - Current price in BRND tokens
- last_sale_price: DECIMAL(78,0)
- total_fees_earned: DECIMAL(78,0)
- created_at: DECIMAL(78,0)
- last_sale_at: DECIMAL(78,0) (nullable)
- block_number: DECIMAL(78,0)
- transaction_hash: VARCHAR
- last_updated: DECIMAL(78,0)

### Table: reward_claims
Records of BRND reward claims by users.
- id: VARCHAR (Primary Key)
- recipient: VARCHAR
- fid: INT
- amount: DECIMAL(78,0)
- day: DECIMAL(78,0)
- cast_hash: VARCHAR
- caller: VARCHAR
- block_number: DECIMAL(78,0)
- transaction_hash: VARCHAR
- timestamp: DECIMAL(78,0)

## Leaderboard Tables

### Table: weekly_brand_leaderboard
Weekly brand rankings and medal counts.
- id: VARCHAR (Primary Key)
- brand_id: INT
- week: DECIMAL(78,0)
- points: DECIMAL(78,0)
- gold_count: INT
- silver_count: INT
- bronze_count: INT
- rank: INT (nullable)
- block_number: DECIMAL(78,0)
- updated_at: DECIMAL(78,0)

## Query Tips

### Time Handling
- Timestamps are stored as Unix seconds (DECIMAL). Convert with: to_timestamp(timestamp)
- Day numbers are relative to season start. Current day: EXTRACT(EPOCH FROM NOW())::bigint / 86400

### Common Joins
- votes.fid → users.fid (voter info)
- votes.brand_ids → brands.id (voted brands, parse JSON array)
- daily_brand_leaderboard.brand_id → brands.id
- podium_collectibles.gold_brand_id/silver_brand_id/bronze_brand_id → brands.id

### Numeric Display
- For large decimals use: points::numeric or ROUND(points::numeric, 2)
- Brand IDs from votes: Use json_array_elements_text(brand_ids::json)::int

### Week Calculation
- Week number: (day_number - 1) / 7 + 1
- Current week in leaderboards: ORDER BY week DESC LIMIT 1
`;