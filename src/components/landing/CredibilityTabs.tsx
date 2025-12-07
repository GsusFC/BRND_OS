'use client'

import { useState } from 'react'

const TABS = [
    {
        id: 'users',
        label: 'FOR USERS (BRAND LOVERS)',
        shortLabel: 'FOR USERS',
        content: [
            {
                title: 'Create & collect podiums:',
                description: 'Build your own brand rankings → Podiums, and showcase your takes. → Shape what matters: Create podiums that reflect what brands mean to you. Your taste, your community, onchain.'
            },
            {
                title: 'Earn $BRND:',
                description: 'Receive rewards for creating, sharing, and interacting with podiums.'
            },
            {
                title: 'Signal value:',
                description: 'Promote the brands you believe in, and see the community respond.'
            },
            {
                title: 'Track evolution:',
                description: 'Follow how brands climb, drop, or sustain relevance onchain. All in one place.'
            }
        ]
    },
    {
        id: 'brands',
        label: 'FOR BRANDS (THAT LOVE USERS)',
        shortLabel: 'FOR BRANDS',
        content: [
            {
                title: 'Visibility:',
                description: 'Get discovered in podiums created by the community and gain onchain presence.'
            },
            {
                title: 'Community validation:',
                description: 'See where your brand ranks, powered by the same scoring that rewards users. Every vote contributes to your brand\'s perceived value.'
            },
            {
                title: 'Dynamic positioning:',
                description: 'Your place isn\'t fixed. Claims, resets, and new podiums ensure constant movement and real-time relevance.'
            },
            {
                title: 'Trusted context:',
                description: 'Appear in a transparent, community-powered, onchain environment — not behind hidden algorithms.'
            }
        ]
    }
]

export function CredibilityTabs() {
    const [activeTab, setActiveTab] = useState('users')

    const activeContent = TABS.find(tab => tab.id === activeTab)?.content ?? []

    return (
        <section className="bg-black px-6 py-24">
            <div className="mx-auto max-w-4xl">
                {/* Title */}
                <h2 className="mb-8 md:mb-16 text-center font-display text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold uppercase leading-tight text-white">
                    Turning community activity into<br />
                    measurable, onchain credibility.
                </h2>

                {/* Tabs */}
                <div className="mb-8 md:mb-12 flex justify-center gap-4 md:gap-8">
                    {TABS.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`relative pb-2 font-sans text-xs sm:text-sm md:text-xl lg:text-2xl font-medium uppercase tracking-wide transition-colors ${
                                activeTab === tab.id
                                    ? 'text-white'
                                    : 'text-zinc-500 hover:text-zinc-300'
                            }`}
                        >
                            <span className="hidden sm:inline">{tab.label}</span>
                            <span className="sm:hidden">{tab.shortLabel}</span>
                            {activeTab === tab.id && (
                                <span className="absolute bottom-0 left-0 h-[2px] w-full bg-[#BFFF00]" />
                            )}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <ul className="space-y-4 md:space-y-6 pl-2 md:pl-4">
                    {activeContent.map((item, index) => (
                        <li key={index} className="flex gap-2 md:gap-3">
                            <span className="mt-2 md:mt-3 h-1.5 w-1.5 md:h-2 md:w-2 flex-shrink-0 rounded-full bg-white" />
                            <p className="font-sans text-sm sm:text-base md:text-lg lg:text-2xl leading-relaxed text-white">
                                <span className="font-medium">{item.title}</span>{' '}
                                <span className="text-zinc-300">{item.description}</span>
                            </p>
                        </li>
                    ))}
                </ul>
            </div>
        </section>
    )
}
