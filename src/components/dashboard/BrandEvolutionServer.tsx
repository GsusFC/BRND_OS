import { Suspense } from 'react'
import { getBrandsForEvolution } from '@/lib/intelligence/brand-evolution'
import { BrandEvolutionChart } from '@/components/intelligence/BrandEvolutionChart'
import { BrandEvolutionSkeleton } from './BrandEvolutionSkeleton'

async function BrandEvolutionData() {
    const brands = await getBrandsForEvolution()

    return (
        <BrandEvolutionChart
            initialBrands={brands}
        />
    )
}

export function BrandEvolutionServer() {
    return (
        <Suspense fallback={<BrandEvolutionSkeleton />}>
            <BrandEvolutionData />
        </Suspense>
    )
}
