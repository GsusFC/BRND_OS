const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateRankings() {
  try {
    console.log('Calculating rankings based on total podiums...');
    
    // Get all brands with their podium counts
    const podiumCounts = await prisma.$queryRaw`
      SELECT 
        brand1Id,
        SUM(CASE WHEN brand1Id IS NOT NULL THEN 1 ELSE 0 END) as gold_count,
        0 as silver_count,
        0 as bronze_count,
        SUM(CASE WHEN brand1Id IS NOT NULL THEN 1 ELSE 0 END) as total_podiums
      FROM user_brand_votes
      WHERE brand1Id IS NOT NULL
      GROUP BY brand1Id
      
      UNION ALL
      
      SELECT 
        brand2Id,
        0 as gold_count,
        SUM(CASE WHEN brand2Id IS NOT NULL THEN 1 ELSE 0 END) as silver_count,
        0 as bronze_count,
        SUM(CASE WHEN brand2Id IS NOT NULL THEN 1 ELSE 0 END) as total_podiums
      FROM user_brand_votes
      WHERE brand2Id IS NOT NULL
      GROUP BY brand2Id
      
      UNION ALL
      
      SELECT 
        brand3Id,
        0 as gold_count,
        0 as silver_count,
        SUM(CASE WHEN brand3Id IS NOT NULL THEN 1 ELSE 0 END) as bronze_count,
        SUM(CASE WHEN brand3Id IS NOT NULL THEN 1 ELSE 0 END) as total_podiums
      FROM user_brand_votes
      WHERE brand3Id IS NOT NULL
      GROUP BY brand3Id
    `;
    
    // Aggregate the results
    const aggregated = {};
    podiumCounts.forEach(row => {
      const brandId = row.brand1Id;
      if (!aggregated[brandId]) {
        aggregated[brandId] = {
          gold_count: 0,
          silver_count: 0,
          bronze_count: 0,
          total_podiums: 0
        };
      }
      aggregated[brandId].gold_count += row.gold_count;
      aggregated[brandId].silver_count += row.silver_count;
      aggregated[brandId].bronze_count += row.bronze_count;
      aggregated[brandId].total_podiums += row.total_podiums;
    });
    
    // Convert to array and sort by total podiums
    const sortedBrands = Object.entries(aggregated)
      .map(([brandId, counts]) => ({
        brandId: parseInt(brandId),
        ...counts
      }))
      .sort((a, b) => b.total_podiums - a.total_podiums);
    
    console.log(`Found ${sortedBrands.length} brands with podiums`);
    
    // Generate SQL for manual execution
    console.log('\nSQL commands to update rankings:');
    console.log('-- Copy and paste this SQL in your database admin panel:');
    console.log('BEGIN;');
    
    for (let i = 0; i < sortedBrands.length; i++) {
      const brand = sortedBrands[i];
      const rank = i + 1;
      
      console.log(`UPDATE brands SET currentRanking = ${rank}, ranking = '${rank}' WHERE id = ${brand.brandId};`);
      
      if (i < 10) { // Show top 10 details
        console.log(`-- Brand ID ${brand.brandId} -> Rank ${rank} (Podiums: ${brand.total_podiums})`);
      }
    }
    
    console.log('COMMIT;');
    
    // Show top 10 ranking preview
    console.log('\n=== TOP 10 RANKINGS PREVIEW ===');
    const brandIds = sortedBrands.slice(0, 10).map(b => b.brandId);
    const brands = await prisma.brand.findMany({
      where: { id: { in: brandIds } },
      select: { id: true, name: true }
    });
    
    sortedBrands.slice(0, 10).forEach((brand, index) => {
      const brandInfo = brands.find(b => b.id === brand.brandId);
      console.log(`${index + 1}. ID: ${brand.brandId}, Name: ${brandInfo?.name || 'Unknown'}, Total Podiums: ${brand.total_podiums}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateRankings();
