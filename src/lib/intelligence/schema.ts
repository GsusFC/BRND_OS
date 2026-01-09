export const DATABASE_SCHEMA = `
# BRND Database Schema

## Table: users
Stores all user information and profile data.
- id: INT (Primary Key, Auto Increment) - Unique user identifier
- fid: INT (Unique) - Farcaster ID (external user ID)
- username: VARCHAR(191) - User's display name
- photoUrl: VARCHAR(191) - Profile picture URL
- points: INT (Default: 0) - User's current point balance
- role: ENUM('user', 'admin') - User role
- notificationsEnabled: BOOLEAN - Whether user wants notifications
- notificationToken: VARCHAR(191) - Token for sending notifications
- lastVoteReminderSent: DATETIME - When last reminder was sent
- createdAt: DATETIME
- updatedAt: DATETIME

## Table: brands
Stores information about all brands that users can vote on.
- id: INT (Primary Key, Auto Increment)
- name: VARCHAR(191) (Unique) - Brand name (NO @ symbol)
- url: VARCHAR(191) - Brand's website URL
- warpcastUrl: VARCHAR(191) - Brand's Farcaster profile URL
- description: TEXT (up to 4096 chars) - Brand description
- categoryId: INT (Foreign Key → categories.id)
- followerCount: INT - Number of followers
- imageUrl: VARCHAR(191) - Brand logo/image URL
- profile: VARCHAR(191) - Profile information
- channel: VARCHAR(191) - Channel information
- ranking: VARCHAR(191) - Current ranking status
- score: INT - Current OVERALL score (all time)
- stateScore: INT - State-specific score
- scoreWeek: INT - WEEKLY score
- stateScoreWeek: INT - State-specific weekly score
- rankingWeek: INT (Default: 0) - Weekly ranking position
- scoreMonth: INT (Default: 0) - MONTHLY score
- stateScoreMonth: INT (Default: 0) - State-specific monthly score
- rankingMonth: INT (Default: 0) - Monthly ranking position
- bonusPoints: INT (Default: 0) - Additional bonus points
- banned: INT (0 = Active, 1 = Banned/Pending)
- queryType: INT - 0 for Channel, 1 for Profile
- currentRanking: INT (Default: 0) - Current ranking position
- createdAt: DATETIME
- updatedAt: DATETIME

## Table: categories
Organizes brands into different categories.
- id: INT (Primary Key, Auto Increment)
- name: VARCHAR(191) - Category name
- createdAt: DATETIME
- updatedAt: DATETIME

## Table: tags
Tags for brand categorization.
- id: INT (Primary Key, Auto Increment)
- name: VARCHAR(191) - Tag name
- createdAt: DATETIME
- updatedAt: DATETIME

## Table: brand_tags
Links brands to tags (many-to-many).
- id: INT (Primary Key, Auto Increment)
- tagId: INT (Foreign Key → tags.id)
- brandId: INT (Foreign Key → brands.id)

## Table: user_brand_votes
Records user voting sessions - each vote has TOP 3 brands.
- id: CHAR(36) (Primary Key, UUID)
- userId: INT (Foreign Key → users.id)
- brand1Id: INT (Foreign Key → brands.id) - User's #1 choice (GOLD 🥇)
- brand2Id: INT (Foreign Key → brands.id) - User's #2 choice (SILVER 🥈)
- brand3Id: INT (Foreign Key → brands.id) - User's #3 choice (BRONZE 🥉)
- date: DATETIME - When the vote was cast
- shared: BOOLEAN (Default: false) - Whether user shared their vote
- castHash: VARCHAR(191) - Hash of social media post if shared
- createdAt: DATETIME

## Table: user_daily_actions
Tracks special actions users perform for bonus points.
- id: INT (Primary Key, Auto Increment)
- userId: INT (Foreign Key → users.id)
- shareFirstTime: BOOLEAN - First-time share bonus

## Table: notification_queue
Manages notifications to users.
- id: INT (Primary Key, Auto Increment)
- userId: INT (Foreign Key → users.id)
- type: ENUM('daily_reminder', 'evening_reminder', 'weekly_rankings', 'monthly_winner', 'welcome', 'leaderboard_update', 'brand_milestone')
- title: VARCHAR(191)
- body: TEXT
- status: ENUM('pending', 'sent', 'failed', 'skipped', 'processing')
- scheduledFor: DATETIME
- sentAt: DATETIME
- createdAt: DATETIME

## Key Relationships:
1. Users ↔ Votes: users.id → user_brand_votes.userId
2. Brands ↔ Categories: categories.id → brands.categoryId
3. Brands ↔ Tags: Many-to-many through brand_tags
4. Brands ↔ Votes: Each vote references 3 brands (brand1Id, brand2Id, brand3Id)

## Common Query Patterns:

### Brand Leaderboard (Weekly):
SELECT b.name, b.scoreWeek,
  COUNT(CASE WHEN v.brand1Id = b.id THEN 1 END) as gold,
  COUNT(CASE WHEN v.brand2Id = b.id THEN 1 END) as silver,
  COUNT(CASE WHEN v.brand3Id = b.id THEN 1 END) as bronze
FROM brands b
LEFT JOIN user_brand_votes v ON (v.brand1Id = b.id OR v.brand2Id = b.id OR v.brand3Id = b.id)
  AND v.date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
WHERE b.banned = 0
GROUP BY b.id ORDER BY b.scoreWeek DESC LIMIT 10

### User Voting History:
SELECT u.username, b1.name as first, b2.name as second, b3.name as third, v.date
FROM user_brand_votes v
JOIN users u ON v.userId = u.id
JOIN brands b1 ON v.brand1Id = b1.id
JOIN brands b2 ON v.brand2Id = b2.id
JOIN brands b3 ON v.brand3Id = b3.id
WHERE u.username LIKE '%name%'
ORDER BY v.date DESC

### Brand Popularity (All Positions):
SELECT b.name,
  COUNT(CASE WHEN v.brand1Id = b.id THEN 1 END) as first_place,
  COUNT(CASE WHEN v.brand2Id = b.id THEN 1 END) as second_place,
  COUNT(CASE WHEN v.brand3Id = b.id THEN 1 END) as third_place,
  COUNT(*) as total_votes
FROM brands b
LEFT JOIN user_brand_votes v ON b.id IN (v.brand1Id, v.brand2Id, v.brand3Id)
GROUP BY b.id, b.name
ORDER BY first_place DESC

### Daily Voting Activity:
SELECT DATE(date) as vote_date, COUNT(*) as votes_count
FROM user_brand_votes
WHERE date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
GROUP BY DATE(date)
ORDER BY vote_date DESC

### Top Voters:
SELECT u.username, u.points, COUNT(v.id) as total_votes
FROM users u
LEFT JOIN user_brand_votes v ON u.id = v.userId
GROUP BY u.id, u.username, u.points
ORDER BY u.points DESC LIMIT 20

### Brands by Category:
SELECT c.name as category, b.name as brand, b.score
FROM brands b
JOIN categories c ON b.categoryId = c.id
WHERE b.banned = 0
ORDER BY c.name, b.score DESC
`;
