export const DATABASE_SCHEMA = `
# BRND Database Schema (PostgreSQL - Indexer)
All tables use standard PostgreSQL naming. Use table names directly without schema prefix.

## Core Tables

### Table: users
Stores all user information and voting data.
- fid: INT (Primary Key) - Farcaster ID
- brnd_power_level: INT - User's BRND power level (1-5)
- total_votes: INT - Total number of votes cast
- points: DECIMAL(78,0) - User's current point balance (use ::numeric for display)
- last_vote_day: INT - Last day user voted (day number since season start)
- block_number: DECIMAL(78,0) - Blockchain block number
- transaction_hash: VARCHAR - Transaction hash

### Table: brands
Stores information about all brands that users can vote on.
- id: INT (Primary Key) - Brand ID
- fid: INT - Brand owner's Farcaster ID
- wallet_address: VARCHAR - Brand's wallet address
- handle: VARCHAR - Brand handle (NO @ symbol)
- metadata_hash: VARCHAR - IPFS metadata hash
- total_brnd_awarded: DECIMAL(78,0) - Total BRND tokens awarded to brand
- available_brnd: DECIMAL(78,0) - Available BRND tokens for withdrawal
- created_at: DECIMAL(78,0) - Creation timestamp (Unix seconds)
- block_number: DECIMAL(78,0)
- transaction_hash: VARCHAR

### Table: votes
Records user voting sessions with brand choices.
- id: VARCHAR (Primary Key, UUID)
- voter: VARCHAR - Voter's wallet address
- fid: INT - Voter's Farcaster ID
- day: DECIMAL(78,0) - Day number since season start
- brand_ids: TEXT - JSON array of 3 brand IDs voted for (e.g., "[19,62,227]")
- cost: DECIMAL(78,0) - Cost of the vote in BRND tokens
- block_number: DECIMAL(78,0)
- transaction_hash: VARCHAR
- timestamp: DECIMAL(78,0) - Vote timestamp (Unix seconds)

### Table: wallet_authorizations
Tracks wallets authorized by users for transactions.
- id: VARCHAR (Primary Key)
- fid: INT - User's Farcaster ID
- wallet: VARCHAR - Authorized wallet address
- block_number: DECIMAL(78,0)
- transaction_hash: VARCHAR
- timestamp: DECIMAL(78,0) - Authorization timestamp (Unix seconds)

## Reward Tables

### Table: reward_claims
Records reward claims by users (tips, engagement rewards).
- id: VARCHAR (Primary Key)
- recipient: VARCHAR - Recipient wallet address
- fid: INT - Recipient's Farcaster ID
- amount: DECIMAL(78,0) - Amount claimed (18 decimals, divide by 10^18 for display)
- day: DECIMAL(78,0) - Day number
- cast_hash: VARCHAR - Farcaster cast hash that triggered the claim
- caller: VARCHAR - Wallet that called the claim
- block_number: DECIMAL(78,0)
- transaction_hash: VARCHAR
- timestamp: DECIMAL(78,0) - Claim timestamp (Unix seconds)

### Table: brand_reward_withdrawals
Records brand owner withdrawals of accumulated BRND.
- id: VARCHAR (Primary Key)
- brand_id: INT - Foreign Key to brands.id
- fid: INT - Brand owner's Farcaster ID
- amount: DECIMAL(78,0) - Amount withdrawn (18 decimals)
- block_number: DECIMAL(78,0)
- transaction_hash: VARCHAR
- timestamp: DECIMAL(78,0) - Withdrawal timestamp (Unix seconds)

### Table: brnd_power_level_ups
Records BRND Power level upgrades by users.
- id: VARCHAR (Primary Key)
- fid: INT - User's Farcaster ID
- new_level: INT - New BRND power level (1-5)
- wallet: VARCHAR - User's wallet address
- block_number: DECIMAL(78,0)
- transaction_hash: VARCHAR
- timestamp: DECIMAL(78,0) - Level up timestamp (Unix seconds)

## Leaderboard Tables

### Table: daily_brand_leaderboard
Daily brand rankings and scores.
- id: VARCHAR (Primary Key, format: "brand_id-day")
- brand_id: INT - Foreign Key to brands.id
- day: DECIMAL(78,0) - Day number
- points: DECIMAL(78,0) - Points for the day (gold=3, silver=2, bronze=1)
- gold_count: INT - Number of first place votes
- silver_count: INT - Number of second place votes
- bronze_count: INT - Number of third place votes
- rank: INT - Daily ranking position
- block_number: DECIMAL(78,0)
- updated_at: DECIMAL(78,0) - Last update timestamp

### Table: weekly_brand_leaderboard
Weekly brand rankings and scores.
- id: VARCHAR (Primary Key, format: "brand_id-week")
- brand_id: INT - Foreign Key to brands.id
- week: DECIMAL(78,0) - Week number
- points: DECIMAL(78,0) - Points for the week
- gold_count: INT - Number of first place votes
- silver_count: INT - Number of second place votes
- bronze_count: INT - Number of third place votes
- rank: INT - Weekly ranking position
- block_number: DECIMAL(78,0)
- updated_at: DECIMAL(78,0)

### Table: monthly_brand_leaderboard
Monthly brand rankings and scores.
- id: VARCHAR (Primary Key, format: "brand_id-month")
- brand_id: INT - Foreign Key to brands.id
- month: DECIMAL(78,0) - Month number
- points: DECIMAL(78,0) - Points for the month
- gold_count: INT - Number of first place votes
- silver_count: INT - Number of second place votes
- bronze_count: INT - Number of third place votes
- rank: INT - Monthly ranking position
- block_number: DECIMAL(78,0)
- updated_at: DECIMAL(78,0)

### Table: all_time_brand_leaderboard
All-time brand rankings and scores.
- brand_id: INT (Primary Key) - Foreign Key to brands.id
- points: DECIMAL(78,0) - Total points all time
- gold_count: INT - Total first place votes
- silver_count: INT - Total second place votes
- bronze_count: INT - Total third place votes
- rank: INT - All-time ranking position
- block_number: DECIMAL(78,0)
- updated_at: DECIMAL(78,0)

### Table: all_time_user_leaderboard
All-time user rankings and scores.
- fid: INT (Primary Key) - Farcaster ID
- points: DECIMAL(78,0) - Total points all time
- rank: INT - All-time ranking position
- block_number: DECIMAL(78,0)
- updated_at: DECIMAL(78,0)

## Collectibles Tables (Podium NFTs)

### Table: podium_collectibles
NFT collectibles representing unique podium combinations (gold/silver/bronze brands).
- token_id: INT (Primary Key) - NFT token ID
- arrangement_hash: VARCHAR - Hash of the brand arrangement
- gold_brand_id: INT - Brand in 1st place
- silver_brand_id: INT - Brand in 2nd place
- bronze_brand_id: INT - Brand in 3rd place
- genesis_creator_fid: INT - FID of original creator
- current_owner_fid: INT - FID of current owner
- current_owner_wallet: VARCHAR - Current owner's wallet
- claim_count: INT - Number of times this collectible has been claimed/traded
- current_price: DECIMAL(78,0) - Current price (18 decimals, in BRND)
- last_sale_price: DECIMAL(78,0) - Last sale price
- total_fees_earned: DECIMAL(78,0) - Total fees earned by genesis creator
- created_at: DECIMAL(78,0) - Creation timestamp (Unix seconds)
- last_sale_at: DECIMAL(78,0) - Last sale timestamp (nullable)
- block_number: DECIMAL(78,0)
- transaction_hash: VARCHAR
- last_updated: DECIMAL(78,0)

### Table: collectible_sales
Records of collectible sales/trades.
- id: VARCHAR (Primary Key)
- token_id: INT - Foreign Key to podium_collectibles.token_id
- buyer_fid: INT - Buyer's Farcaster ID
- buyer_wallet: VARCHAR - Buyer's wallet
- seller_fid: INT - Seller's Farcaster ID
- seller_wallet: VARCHAR - Seller's wallet
- price: DECIMAL(78,0) - Sale price (18 decimals)
- seller_proceeds: DECIMAL(78,0) - Amount seller received
- genesis_royalty: DECIMAL(78,0) - Royalty to genesis creator
- protocol_fee: DECIMAL(78,0) - Protocol fee
- claim_number: INT - Which claim number this was
- block_number: DECIMAL(78,0)
- transaction_hash: VARCHAR
- timestamp: DECIMAL(78,0) - Sale timestamp (Unix seconds)

### Table: collectible_repeat_fees
Fees earned by collectible owners from repeat votes on their podium.
- id: VARCHAR (Primary Key)
- token_id: INT - Foreign Key to podium_collectibles.token_id
- owner_fid: INT - Owner's Farcaster ID at time of fee
- owner_wallet: VARCHAR - Owner's wallet
- fee_amount: DECIMAL(78,0) - Fee amount (18 decimals)
- votes_that_generated_fee: INT - Number of votes that generated this fee
- block_number: DECIMAL(78,0)
- transaction_hash: VARCHAR
- timestamp: DECIMAL(78,0) - Fee timestamp (Unix seconds)
- claim_nonce: INT - Claim nonce

### Table: collectible_ownership_history
Historical ownership records for collectibles.
- id: VARCHAR (Primary Key)
- token_id: INT - Foreign Key to podium_collectibles.token_id
- owner_fid: INT - Owner's Farcaster ID
- owner_wallet: VARCHAR - Owner's wallet
- acquisition_type: VARCHAR - How acquired: "mint", "purchase", "transfer"
- price_paid: DECIMAL(78,0) - Price paid (nullable, null for mints)
- acquired_at: DECIMAL(78,0) - Acquisition timestamp (Unix seconds)
- block_number: DECIMAL(78,0)
- transaction_hash: VARCHAR

## Key Relationships
1. Users: users.fid links to votes.fid, leaderboards, reward_claims
2. Brands: brands.id links to all leaderboard tables, collectibles (gold/silver/bronze_brand_id)
3. Votes: votes.brand_ids is a JSON array "[gold_id, silver_id, bronze_id]"
4. Collectibles: podium_collectibles.token_id links to sales, repeat_fees, ownership_history

## Common Query Patterns

### Current Week Brand Leaderboard (Top 10):
SELECT
    w.brand_id,
    b.handle as name,
    (w.points::numeric / 1e18)::bigint as score,
    w.gold_count as gold,
    w.silver_count as silver,
    w.bronze_count as bronze,
    (w.gold_count + w.silver_count + w.bronze_count) as total_podiums,
    w.rank
FROM weekly_brand_leaderboard w
JOIN brands b ON w.brand_id = b.id
WHERE w.week = (SELECT MAX(week) FROM weekly_brand_leaderboard)
ORDER BY w.points DESC
LIMIT 10

### Current Day Brand Leaderboard:
SELECT
    d.brand_id,
    b.handle as name,
    (d.points::numeric / 1e18)::bigint as score,
    d.gold_count, d.silver_count, d.bronze_count,
    (d.gold_count + d.silver_count + d.bronze_count) as total_podiums,
    d.rank
FROM daily_brand_leaderboard d
JOIN brands b ON d.brand_id = b.id
WHERE d.day = (SELECT MAX(day) FROM daily_brand_leaderboard)
ORDER BY d.points DESC
LIMIT 10

### User Voting History:
SELECT
    v.brand_ids,
    TO_TIMESTAMP(v.timestamp::bigint) as vote_time,
    v.cost::numeric / 1e18 as cost_brnd
FROM votes v
WHERE v.fid = $1
ORDER BY v.timestamp DESC
LIMIT 20

### Vote Analysis - Parse Brand IDs:
SELECT
    v.fid,
    (v.brand_ids::json->>0)::int as gold_choice,
    (v.brand_ids::json->>1)::int as silver_choice,
    (v.brand_ids::json->>2)::int as bronze_choice,
    TO_TIMESTAMP(v.timestamp::bigint) as vote_time
FROM votes v
LIMIT 10

### Daily Voting Activity (Last 30 Days):
SELECT
    TO_CHAR(TO_TIMESTAMP(v.timestamp::bigint), 'YYYY-MM-DD') as vote_date,
    COUNT(*) as votes_count,
    COUNT(DISTINCT v.fid) as unique_voters
FROM votes v
WHERE v.timestamp >= EXTRACT(EPOCH FROM NOW() - INTERVAL '30 days')
GROUP BY TO_CHAR(TO_TIMESTAMP(v.timestamp::bigint), 'YYYY-MM-DD')
ORDER BY vote_date DESC

### Top Voters (All Time):
SELECT
    u.fid,
    u.total_votes,
    u.points::numeric / 1e18 as points,
    u.brnd_power_level,
    l.rank
FROM users u
LEFT JOIN all_time_user_leaderboard l ON u.fid = l.fid
ORDER BY l.rank ASC NULLS LAST
LIMIT 20

### Brand Performance (All Time / "Top Marcas"):
SELECT
    b.id as brand_id,
    b.handle as name,
    (l.points::numeric / 1e18)::bigint as score,
    l.gold_count, l.silver_count, l.bronze_count,
    (l.gold_count + l.silver_count + l.bronze_count) as total_podiums,
    l.rank,
    b.total_brnd_awarded::numeric / 1e18 as total_brnd_awarded
FROM brands b
LEFT JOIN all_time_brand_leaderboard l ON b.id = l.brand_id
ORDER BY l.rank ASC NULLS LAST
LIMIT 20

### Total Reward Claims by User:
SELECT
    rc.fid,
    COUNT(*) as claim_count,
    SUM(rc.amount::numeric) / 1e18 as total_claimed_brnd
FROM reward_claims rc
GROUP BY rc.fid
ORDER BY total_claimed_brnd DESC
LIMIT 20

### Brand Withdrawals:
SELECT
    b.handle as brand_name,
    bw.fid as owner_fid,
    bw.amount::numeric / 1e18 as withdrawn_brnd,
    TO_TIMESTAMP(bw.timestamp::bigint) as withdrawal_time
FROM brand_reward_withdrawals bw
JOIN brands b ON bw.brand_id = b.id
ORDER BY bw.timestamp DESC
LIMIT 20

### BRND Power Level Distribution:
SELECT
    brnd_power_level,
    COUNT(*) as user_count
FROM users
GROUP BY brnd_power_level
ORDER BY brnd_power_level

### Top Collectibles by Price:
SELECT
    pc.token_id,
    b1.handle as gold_brand,
    b2.handle as silver_brand,
    b3.handle as bronze_brand,
    pc.current_price::numeric / 1e18 as price_brnd,
    pc.claim_count,
    pc.total_fees_earned::numeric / 1e18 as fees_earned
FROM podium_collectibles pc
JOIN brands b1 ON pc.gold_brand_id = b1.id
JOIN brands b2 ON pc.silver_brand_id = b2.id
JOIN brands b3 ON pc.bronze_brand_id = b3.id
ORDER BY pc.current_price DESC
LIMIT 10

### Recent Collectible Sales:
SELECT
    cs.token_id,
    cs.buyer_fid,
    cs.seller_fid,
    cs.price::numeric / 1e18 as price_brnd,
    cs.genesis_royalty::numeric / 1e18 as royalty_brnd,
    TO_TIMESTAMP(cs.timestamp::bigint) as sale_time
FROM collectible_sales cs
ORDER BY cs.timestamp DESC
LIMIT 20

### Collectibles by Brand (appearing in any position):
SELECT
    b.id as brand_id,
    b.handle as brand_name,
    COUNT(*) as collectible_count,
    SUM(pc.claim_count) as total_claims
FROM brands b
JOIN podium_collectibles pc ON
    b.id = pc.gold_brand_id OR
    b.id = pc.silver_brand_id OR
    b.id = pc.bronze_brand_id
GROUP BY b.id, b.handle
ORDER BY collectible_count DESC
LIMIT 20

### Genesis Creators Earnings:
SELECT
    pc.genesis_creator_fid,
    COUNT(DISTINCT pc.token_id) as collectibles_created,
    SUM(pc.total_fees_earned::numeric) / 1e18 as total_earnings_brnd
FROM podium_collectibles pc
GROUP BY pc.genesis_creator_fid
ORDER BY total_earnings_brnd DESC
LIMIT 20

### Repeat Fee Revenue by Collectible:
SELECT
    rf.token_id,
    COUNT(*) as fee_events,
    SUM(rf.fee_amount::numeric) / 1e18 as total_fees_brnd,
    SUM(rf.votes_that_generated_fee) as total_repeat_votes
FROM collectible_repeat_fees rf
GROUP BY rf.token_id
ORDER BY total_fees_brnd DESC
LIMIT 20

## IMPORTANT NOTES:
- Use table names directly WITHOUT schema prefix (e.g., weekly_brand_leaderboard, NOT "schema"."table")
- DECIMAL fields need ::numeric cast for display to avoid BigInt overflow
- For token amounts (BRND), divide by 1e18 for human-readable values
- Timestamps are Unix epoch seconds, use TO_TIMESTAMP() for date functions
- brand_ids in votes is a JSON array string: "[19,62,227]" - use JSON operators (::json->>0)
- PostgreSQL syntax (NOT MySQL)
- Use single quotes for strings in WHERE clauses
- Day/week/month fields are sequential numbers, not dates
`;
