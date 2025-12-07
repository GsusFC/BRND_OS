"use client"

interface AttributeCardProps {
    title: string
    description: string
}

const AttributeCard = ({ title, description }: AttributeCardProps) => (
    <div className="relative flex h-full w-full items-center justify-center px-10 py-6 md:p-8">
        <div className="flex max-w-[320px] md:max-w-[460px] flex-col items-start gap-[17px]">
            <h3
                className="font-druk text-[24px] lg:text-[32px] font-bold leading-[103%] text-white"
                style={{ whiteSpace: 'pre-line' }}
            >
                {title}
            </h3>
            <p className="self-stretch font-inter text-[18px] lg:text-[24px] font-normal leading-[103%] text-white">
                {description}
            </p>
        </div>
    </div>
)

interface MediaSlotProps {
    src?: string
    type?: "video" | "image"
    alt?: string
}

const MediaSlot = ({ src, type = "image", alt = "" }: MediaSlotProps) => (
    <div className="relative h-full w-full bg-white">
        {src ? (
            type === "video" ? (
                <video
                    src={src}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="h-full w-full object-cover"
                />
            ) : (
                <img
                    src={src}
                    alt={alt}
                    className="h-full w-full object-cover"
                />
            )
        ) : null}
    </div>
)

const attributes = {
    archive: {
        title: "A Living Archive\nof Onchain Brands",
        description: "BRND is more than a snapshot—it's a growing history of brand activity and evolution. By archiving user podiums, votes, and brand movements, BRND builds an ongoing record for the whole ecosystem. Brands are given space to evolve, and community contributions are preserved as a testament to creative progress in Web3 design and strategy."
    },
    research: {
        title: "A Research\nEngine for Brands",
        description: "BRND redefines brand discovery, acting as a real-time research tool where users actively vote for their favorite onchain brands using $BRND tokens. Each podium and vote collected in the miniapp fuels a dynamic archive—curating not just assets, but lived interactions and continually updating insight into brand attention and relevance."
    },
    catalyst: {
        title: "A Catalyst\nfor Inspiration",
        description: "By connecting users, creators, and founders, BRND provides constant inspiration—the pulse of what's trending, shifting, and admired. It's not just about what's new; it's about showing changes over time, giving historical context to every brand that enters the leaderboard and spotlighting the creative energy that drives Web3 innovation."
    }
}

export const BrndAttributes = () => {
    return (
        <section className="w-full bg-black">
            {/* Title */}
            <div className="px-4 py-8 md:py-12 lg:py-16">
                <h2 className="text-center text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-black italic tracking-tight text-white">
                    BRND ATTRIBUTES
                </h2>
            </div>

            {/* Grid Layout - Single column mobile, 3 cols desktop */}
            <div className="grid grid-cols-1 md:grid-cols-3 md:h-screen md:grid-rows-2">
                {/* Row 1 */}
                {/* Archive - Black */}
                <div className="aspect-square md:aspect-auto bg-black">
                    <AttributeCard
                        title={attributes.archive.title}
                        description={attributes.archive.description}
                    />
                </div>

                {/* Media 1 - White */}
                <div className="aspect-square md:aspect-auto">
                    <MediaSlot />
                </div>

                {/* Research - Black */}
                <div className="aspect-square md:aspect-auto bg-black">
                    <AttributeCard
                        title={attributes.research.title}
                        description={attributes.research.description}
                    />
                </div>

                {/* Row 2 */}
                {/* Media 2 - White */}
                <div className="aspect-square md:aspect-auto">
                    <MediaSlot />
                </div>

                {/* Catalyst - Black */}
                <div className="aspect-square md:aspect-auto bg-black">
                    <AttributeCard
                        title={attributes.catalyst.title}
                        description={attributes.catalyst.description}
                    />
                </div>

                {/* Media 3 - White */}
                <div className="aspect-square md:aspect-auto">
                    <MediaSlot />
                </div>
            </div>
        </section>
    )
}
