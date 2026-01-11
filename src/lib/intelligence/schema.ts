export const DATABASE_SCHEMA = `
# BRND Database Schema (PostgreSQL - Indexer)

## Table: IndexerUser (users)
Stores all user information and voting data.
- fid: INT (Primary Key) - Farcaster ID
- brnd_power_level: INT - User's BRND power level
- total_votes: INT - Total number of votes cast
- points: DECIMAL(78,0) - User's current point balance
- last_vote_day: INT - Last day user voted
- block_number: DECIMAL(78,0) - Blockchain block number
- transaction_hash: VARCHAR - Transaction hash

## Table: IndexerBrand (brands)
Stores information about all brands that users can vote on.
- id: INT (Primary Key) - Brand ID
- fid: INT - Brand's Farcaster ID
- wallet_address: VARCHAR - Brand's wallet address
- handle: VARCHAR - Brand handle (NO @ symbol)
- metadata_hash: VARCHAR - Metadata hash
- total_brnd_awarded: DECIMAL(78,0) - Total BRND tokens awarded
- available_brnd: DECIMAL(78,0) - Available BRND tokens
- created_at: DECIMAL(78,0) - Creation timestamp

## Table: IndexerVote (votes)
Records user voting sessions with brand choices.
- id: VARCHAR (Primary Key, UUID)
- voter: VARCHAR - Voter's wallet address
- fid: INT - Voter's Farcaster ID
- day: DECIMAL(78,0) - Day of the vote (timestamp)
- brand_ids: TEXT - JSON array of brand IDs voted for (e.g., [19,62,227])
- cost: DECIMAL(78,0) - Cost of the vote in BRND tokens
- block_number: DECIMAL(78,0) - Blockchain block number
- transaction_hash: VARCHAR - Transaction hash
- timestamp: DECIMAL(78,0) - Vote timestamp

## Table: IndexerWeeklyBrandLeaderboard (weekly_brand_leaderboard)
Weekly brand rankings and scores.
- id: VARCHAR (Primary Key)
- brand_id: INT - Foreign Key to IndexerBrand.id
- week: DECIMAL(78,0) - Week identifier
- points: DECIMAL(78,0) - Points for the week
- gold_count: INT - Number of first place votes
- silver_count: INT - Number of second place votes
- bronze_count: INT - Number of third place votes
- rank: INT - Weekly ranking position
- block_number: DECIMAL(78,0) - Blockchain block number
- updated_at: DECIMAL(78,0) - Last update timestamp

## Table: IndexerAllTimeBrandLeaderboard (all_time_brand_leaderboard)
All-time brand rankings and scores.
- brand_id: INT (Primary Key) - Foreign Key to IndexerBrand.id
- points: DECIMAL(78,0) - Total points all time
- gold_count: INT - Total first place votes
- silver_count: INT - Total second place votes
- bronze_count: INT - Total third place votes
- rank: INT - All-time ranking position
- block_number: DECIMAL(78,0) - Blockchain block number
- updated_at: DECIMAL(78,0) - Last update timestamp

## Table: IndexerAllTimeUserLeaderboard (all_time_user_leaderboard)
All-time user rankings and scores.
- fid: INT (Primary Key) - Farcaster ID
- points: DECIMAL(78,0) - Total points all time
- rank: INT - All-time ranking position
- block_number: DECIMAL(78,0) - Blockchain block number
- updated_at: DECIMAL(78,0) - Last update timestamp

## Key Relationships:
1. Users: IndexerUser.fid is the primary identifier
2. Brands: IndexerBrand.id links to leaderboards
3. Votes: IndexerVote.brand_ids contains comma-separated brand IDs
4. Leaderboards: Track rankings by time period

## Common Query Patterns:

### Brand Leaderboard (Weekly) - CURRENT DATA:
SELECT 
    b.handle as name,
    '' as imageUrl,
    '' as channel,
    w.points::numeric as score,
    w.gold_count as gold,
    w.silver_count as silver,
    w.bronze_count as bronze,
    (w.gold_count + w.silver_count + w.bronze_count) as totalVotes
FROM "production-5"."weekly_brand_leaderboard" w
JOIN "production-5"."brands" b ON w.brand_id = b.id
WHERE w.week = (SELECT MAX(week) FROM "production-5"."weekly_brand_leaderboard")
ORDER BY w.points DESC
LIMIT 10

### User Voting History:
SELECT 
    u.fid,
    u.total_votes,
    u.points::numeric as points,
    v.brand_ids,
    v.timestamp::numeric as vote_time
FROM "production-5"."users" u
LEFT JOIN "production-5"."votes" v ON u.fid = v.fid
WHERE u.fid = ?
ORDER BY v.timestamp DESC

### Vote Analysis with Brand Breakdown:
SELECT 
    v.fid,
    v.brand_ids,
    json_array_length(v.brand_ids::json) as brands_count,
    v.brand_ids::json->0 as first_choice,
    v.brand_ids::json->1 as second_choice,
    v.brand_ids::json->2 as third_choice
FROM "production-5"."votes" v
LIMIT 10

### Daily Voting Activity:
SELECT 
    DATE(TO_TIMESTAMP(v.timestamp::bigint)) as vote_date,
    COUNT(*) as votes_count
FROM "production-5"."votes" v
WHERE v.timestamp >= EXTRACT(EPOCH FROM NOW() - INTERVAL '30 days')
GROUP BY DATE(TO_TIMESTAMP(v.timestamp::bigint))
ORDER BY vote_date DESC

### Top Voters (All Time):
SELECT 
    u.fid,
    u.points::numeric as points,
    u.total_votes,
    l.rank
FROM "production-5"."users" u
LEFT JOIN "production-5"."all_time_user_leaderboard" l ON u.fid = l.fid
ORDER BY u.points DESC
LIMIT 20

### Brand Performance (All Time):
SELECT 
    b.handle as name,
    b.total_brnd_awarded::numeric as total_awarded,
    l.points::numeric as leaderboard_points,
    l.gold_count,
    l.silver_count,
    l.bronze_count,
    l.rank
FROM "production-5"."brands" b
LEFT JOIN "production-5"."all_time_brand_leaderboard" l ON b.id = l.brand_id
ORDER BY l.points DESC NULLS LAST

### Brand Voting Analysis (using JSON array):
SELECT 
    b.handle,
    COUNT(CASE WHEN v.brand_ids::json->0 = b.id::text THEN 1 END) as first_place,
    COUNT(CASE WHEN v.brand_ids::json->1 = b.id::text THEN 1 END) as second_place,  
    COUNT(CASE WHEN v.brand_ids::json->2 = b.id::text THEN 1 END) as third_place,
    COUNT(CASE WHEN v.brand_ids::text LIKE '%' || b.id || '%' THEN 1 END) as total_votes
FROM "production-5"."brands" b
LEFT JOIN "production-5"."votes" v ON (
    v.brand_ids::json->0 = b.id::text OR 
    v.brand_ids::json->1 = b.id::text OR 
    v.brand_ids::json->2 = b.id::text
)
GROUP BY b.id, b.handle
ORDER BY total_votes DESC

IMPORTANT NOTES:
- Use schema-qualified table names: "production-5"."table_name"
- DECIMAL fields need ::numeric cast for display (bigint causes overflow)
- Timestamps are Unix epoch format, use TO_TIMESTAMP() for date functions
- brand_ids in votes is JSON array format: [19,62,227] - use JSON functions to parse
- PostgreSQL syntax, not MySQL
- ALL TABLES ARE IN THE "production-5" SCHEMA
`;
