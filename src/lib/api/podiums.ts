import prisma from "@/lib/prisma"

export async function getRecentPodiums() {
    try {
        const votes = await prisma.userBrandVote.findMany({
            orderBy: { date: 'desc' },
            take: 10,
            include: {
                user: {
                    select: {
                        username: true,
                        photoUrl: true,
                    }
                },
                brand1: {
                    select: {
                        id: true,
                        name: true,
                        imageUrl: true,
                    }
                },
                brand2: {
                    select: {
                        id: true,
                        name: true,
                        imageUrl: true,
                    }
                },
                brand3: {
                    select: {
                        id: true,
                        name: true,
                        imageUrl: true,
                    }
                },
            }
        })

        return votes
            .filter(vote => vote.user && vote.brand1 && vote.brand2 && vote.brand3)
            .map(vote => ({
                id: vote.id,
                date: vote.date,
                username: vote.user!.username,
                userPhoto: vote.user!.photoUrl,
                brand1: vote.brand1,
                brand2: vote.brand2,
                brand3: vote.brand3,
            }))
    } catch (error) {
        console.error('Error fetching podiums:', error)
        return []
    }
}
