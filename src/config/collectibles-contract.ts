/**
 * BRND Podium Collectibles (ERC-721) contract config.
 *
 * Set the env var NEXT_PUBLIC_COLLECTIBLES_CONTRACT_ADDRESS to the deployed address.
 * The contract lives on Base (chain 8453) and exposes a standard `tokenURI(uint256)`
 * that returns the metadata JSON for each podium collectible NFT.
 *
 * See: /Users/gsus/Indexer/new-brnd-v2-indexer/abis/BRNDCollectiblesAbi.ts for the full ABI.
 */

export const COLLECTIBLES_CONTRACT_ADDRESS =
    (process.env.NEXT_PUBLIC_COLLECTIBLES_CONTRACT_ADDRESS ?? "") as `0x${string}`

/** Minimal ABI — only the read functions we need for metadata */
export const COLLECTIBLES_CONTRACT_ABI = [
    {
        type: "function",
        name: "tokenURI",
        stateMutability: "view",
        inputs: [{ name: "tokenId", type: "uint256" }],
        outputs: [{ name: "", type: "string" }],
    },
    {
        type: "function",
        name: "getPodium",
        stateMutability: "view",
        inputs: [{ name: "tokenId", type: "uint256" }],
        outputs: [
            {
                components: [
                    { name: "brandIds", type: "uint16[3]" },
                    { name: "genesisCreatorFid", type: "uint256" },
                    { name: "ownerFid", type: "uint256" },
                    { name: "claimCount", type: "uint256" },
                    { name: "lastSalePrice", type: "uint256" },
                    { name: "totalFeesEarned", type: "uint256" },
                    { name: "createdAt", type: "uint256" },
                ],
                name: "",
                type: "tuple",
            },
        ],
    },
    {
        type: "function",
        name: "totalMinted",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint256" }],
    },
] as const
