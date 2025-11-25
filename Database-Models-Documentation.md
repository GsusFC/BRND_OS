# BRND API Database Models Documentation

This document explains all the database tables (models) in the BRND backend system. This guide is designed for non-technical team members who want to understand the data structure and create SQL queries using AI assistance.

## Overview

The BRND system is a brand ranking platform where users vote on brands and earn points. The database consists of 7 main tables that store information about users, brands, votes, categories, tags, notifications, and user actions.

## Database Tables

### 1. Users Table (`users`)

**Purpose**: Stores all user information and their profile data.

**Table Name**: `users`

**Columns**:
- `id` (number, auto-increment) - Unique user identifier
- `fid` (number, unique) - Farcaster ID (external user ID)
- `username` (text) - User's display name
- `photoUrl` (text, optional) - Profile picture URL
- `points` (number, default: 0) - User's current point balance
- `role` (text) - User role: "user" or "admin"
- `notificationsEnabled` (boolean, default: false) - Whether user wants notifications
- `notificationToken` (text, optional) - Token for sending notifications
- `notificationUrl` (text, optional) - URL for notification delivery
- `lastVoteReminderSent` (date, optional) - When last reminder was sent
- `createdAt` (timestamp) - When account was created
- `updatedAt` (timestamp) - When account was last modified

**Example SQL Queries**:
```sql
-- Get all users with their points
SELECT username, points FROM users ORDER BY points DESC;

-- Find users who have notifications enabled
SELECT username, fid FROM users WHERE notificationsEnabled = true;

-- Get admin users
SELECT username, role FROM users WHERE role = 'admin';
```

---

### 2. Brands Table (`brands`)

**Purpose**: Stores information about all the brands that users can vote on.

**Table Name**: `brands`

**Columns**:
- `id` (number, auto-increment) - Unique brand identifier
- `name` (text, unique) - Brand name
- `url` (text) - Brand's website URL
- `warpcastUrl` (text) - Brand's Warpcast profile URL
- `description` (text, up to 4096 characters) - Brand description
- `categoryId` (number) - Links to categories table
- `followerCount` (number) - Number of followers
- `imageUrl` (text) - Brand logo/image URL
- `profile` (text) - Profile information
- `channel` (text) - Channel information
- `ranking` (text) - Current ranking status
- `score` (number) - Current overall score
- `stateScore` (number) - State-specific score
- `scoreWeek` (number) - Weekly score
- `stateScoreWeek` (number) - State-specific weekly score
- `rankingWeek` (number, default: 0) - Weekly ranking position
- `scoreMonth` (number, default: 0) - Monthly score
- `stateScoreMonth` (number, default: 0) - State-specific monthly score
- `rankingMonth` (number, default: 0) - Monthly ranking position
- `bonusPoints` (number, default: 0) - Additional bonus points
- `banned` (number, default: 0) - Ban status (0 = not banned)
- `queryType` (number) - 0 for Channel, 1 for Profile
- `currentRanking` (number, default: 0) - Current ranking position
- `createdAt` (timestamp) - When brand was added
- `updatedAt` (timestamp) - When brand was last modified

**Example SQL Queries**:
```sql
-- Get top 10 brands by current score
SELECT name, score, currentRanking FROM brands ORDER BY score DESC LIMIT 10;

-- Find brands in a specific category
SELECT b.name, c.name as category_name 
FROM brands b 
JOIN categories c ON b.categoryId = c.id 
WHERE c.name = 'Technology';

-- Get brands with highest follower count
SELECT name, followerCount FROM brands ORDER BY followerCount DESC LIMIT 5;
```

---

### 3. Categories Table (`categories`)

**Purpose**: Organizes brands into different categories (e.g., Technology, Fashion, Food).

**Table Name**: `categories`

**Columns**:
- `id` (number, auto-increment) - Unique category identifier
- `name` (text) - Category name
- `createdAt` (timestamp) - When category was created
- `updatedAt` (timestamp) - When category was last modified

**Example SQL Queries**:
```sql
-- Get all categories
SELECT id, name FROM categories;

-- Count brands per category
SELECT c.name, COUNT(b.id) as brand_count 
FROM categories c 
LEFT JOIN brands b ON c.id = b.categoryId 
GROUP BY c.id, c.name;
```

---

### 4. Tags Table (`tags`)

**Purpose**: Stores tags that can be associated with brands for better categorization.

**Table Name**: `tags`

**Columns**:
- `id` (number, auto-increment) - Unique tag identifier
- `name` (text) - Tag name
- `createdAt` (timestamp) - When tag was created
- `updatedAt` (timestamp) - When tag was last modified

**Example SQL Queries**:
```sql
-- Get all available tags
SELECT id, name FROM tags ORDER BY name;

-- Find most popular tags
SELECT t.name, COUNT(bt.id) as usage_count 
FROM tags t 
LEFT JOIN brand_tags bt ON t.id = bt.tagId 
GROUP BY t.id, t.name 
ORDER BY usage_count DESC;
```

---

### 5. Brand Tags Table (`brand_tags`)

**Purpose**: Links brands to their associated tags (many-to-many relationship).

**Table Name**: `brand_tags`

**Columns**:
- `id` (number, auto-increment) - Unique identifier
- `tagId` (number) - Links to tags table
- `brandId` (number) - Links to brands table

**Example SQL Queries**:
```sql
-- Get all tags for a specific brand
SELECT t.name as tag_name 
FROM brand_tags bt 
JOIN tags t ON bt.tagId = t.id 
JOIN brands b ON bt.brandId = b.id 
WHERE b.name = 'Apple';

-- Find brands with a specific tag
SELECT b.name as brand_name 
FROM brand_tags bt 
JOIN brands b ON bt.brandId = b.id 
JOIN tags t ON bt.tagId = t.id 
WHERE t.name = 'innovative';
```

---

### 6. User Brand Votes Table (`user_brand_votes`)

**Purpose**: Records user voting sessions where they rank their top 3 favorite brands.

**Table Name**: `user_brand_votes`

**Columns**:
- `id` (UUID string) - Unique vote session identifier
- `userId` (number) - Links to users table
- `brand1Id` (number) - User's #1 choice (links to brands table)
- `brand2Id` (number) - User's #2 choice (links to brands table)
- `brand3Id` (number) - User's #3 choice (links to brands table)
- `date` (timestamp) - When the vote was cast
- `shared` (boolean, default: false) - Whether user shared their vote
- `castHash` (text, optional) - Hash of the social media post if shared

**Example SQL Queries**:
```sql
-- Get a user's voting history
SELECT u.username, b1.name as first_choice, b2.name as second_choice, b3.name as third_choice, date
FROM user_brand_votes ubv
JOIN users u ON ubv.userId = u.id
JOIN brands b1 ON ubv.brand1Id = b1.id
JOIN brands b2 ON ubv.brand2Id = b2.id
JOIN brands b3 ON ubv.brand3Id = b3.id
WHERE u.username = 'john_doe'
ORDER BY date DESC;

-- Count how many times each brand was voted for in position 1
SELECT b.name, COUNT(*) as first_place_votes
FROM user_brand_votes ubv
JOIN brands b ON ubv.brand1Id = b.id
GROUP BY b.id, b.name
ORDER BY first_place_votes DESC;

-- Find users who shared their votes
SELECT u.username, COUNT(*) as shared_votes
FROM user_brand_votes ubv
JOIN users u ON ubv.userId = u.id
WHERE ubv.shared = true
GROUP BY u.id, u.username;
```

---

### 7. User Daily Actions Table (`user_daily_actions`)

**Purpose**: Tracks special actions users perform to earn bonus points.

**Table Name**: `user_daily_actions`

**Columns**:
- `id` (number, auto-increment) - Unique identifier
- `userId` (number) - Links to users table
- `shareFirstTime` (boolean) - Whether user shared for the first time (earns bonus points)

**Example SQL Queries**:
```sql
-- Find users who completed first-time share action
SELECT u.username 
FROM user_daily_actions uda 
JOIN users u ON uda.userId = u.id 
WHERE uda.shareFirstTime = true;

-- Count bonus actions per user
SELECT u.username, COUNT(*) as bonus_actions
FROM user_daily_actions uda
JOIN users u ON uda.userId = u.id
GROUP BY u.id, u.username;
```

---

### 8. Notification Queue Table (`notification_queue`)

**Purpose**: Manages all notifications that need to be sent to users.

**Table Name**: `notification_queue`

**Columns**:
- `id` (number, auto-increment) - Unique notification identifier
- `userId` (number) - Links to users table
- `type` (enum) - Notification type: 'daily_reminder', 'evening_reminder', 'weekly_rankings', 'monthly_winner', 'welcome', 'leaderboard_update', 'brand_milestone'
- `notificationId` (text) - External notification ID for tracking
- `title` (text) - Notification title
- `body` (text) - Notification message content
- `targetUrl` (text) - URL to open when notification is clicked
- `status` (enum) - Current status: 'pending', 'sent', 'failed', 'skipped', 'processing'
- `retryCount` (number, default: 0) - How many times sending was attempted
- `scheduledFor` (timestamp) - When notification should be sent
- `sentAt` (timestamp, optional) - When notification was actually sent
- `errorMessage` (text, optional) - Error details if sending failed
- `createdAt` (timestamp) - When notification was created
- `updatedAt` (timestamp) - When notification was last modified

**Example SQL Queries**:
```sql
-- Get pending notifications
SELECT u.username, nq.title, nq.scheduledFor 
FROM notification_queue nq 
JOIN users u ON nq.userId = u.id 
WHERE nq.status = 'pending' 
ORDER BY nq.scheduledFor;

-- Count notifications by type
SELECT type, COUNT(*) as count 
FROM notification_queue 
GROUP BY type;

-- Find failed notifications that need retry
SELECT u.username, nq.title, nq.retryCount, nq.errorMessage
FROM notification_queue nq
JOIN users u ON nq.userId = u.id
WHERE nq.status = 'failed' AND nq.retryCount < 3;
```

---

## Relationships Between Tables

### Key Relationships:
1. **Users ↔ Votes**: One user can have many vote sessions (`users.id` → `user_brand_votes.userId`)
2. **Brands ↔ Categories**: Each brand belongs to one category (`categories.id` → `brands.categoryId`)
3. **Brands ↔ Tags**: Many-to-many through brand_tags table
4. **Brands ↔ Votes**: Each vote session references 3 brands
5. **Users ↔ Notifications**: One user can have many notifications
6. **Users ↔ Daily Actions**: One user can have many daily actions

## Common Query Patterns

### User Analytics:
```sql
-- Get user leaderboard with vote count
SELECT u.username, u.points, COUNT(ubv.id) as total_votes
FROM users u
LEFT JOIN user_brand_votes ubv ON u.id = ubv.userId
GROUP BY u.id, u.username, u.points
ORDER BY u.points DESC;
```

### Brand Performance:
```sql
-- Get brand popularity across all positions
SELECT b.name, 
  COUNT(CASE WHEN ubv.brand1Id = b.id THEN 1 END) as first_place,
  COUNT(CASE WHEN ubv.brand2Id = b.id THEN 1 END) as second_place,
  COUNT(CASE WHEN ubv.brand3Id = b.id THEN 1 END) as third_place
FROM brands b
LEFT JOIN user_brand_votes ubv ON b.id IN (ubv.brand1Id, ubv.brand2Id, ubv.brand3Id)
GROUP BY b.id, b.name
ORDER BY first_place DESC;
```

### Engagement Metrics:
```sql
-- Daily voting activity
SELECT DATE(date) as vote_date, COUNT(*) as votes_count
FROM user_brand_votes
WHERE date >= DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY)
GROUP BY DATE(date)
ORDER BY vote_date DESC;
```

## Tips for Creating SQL Queries

1. **Always use table aliases** for readability (e.g., `users u`, `brands b`)
2. **Use JOINs** to combine data from multiple tables
3. **Be specific about date ranges** when querying time-based data
4. **Use GROUP BY** when counting or aggregating data
5. **Add ORDER BY** to sort results meaningfully
6. **Use LIMIT** to restrict large result sets during testing

When asking an LLM to create SQL queries for this database, provide this documentation and specify:
- Which tables you want to query
- What information you want to retrieve
- Any filters or conditions needed
- How you want the results sorted or grouped