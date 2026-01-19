export const BRND_CONTRACT_ADDRESS = "0x6C551239379238926A425826C0572fCDa7485DaE"

export const BRND_CONTRACT_ABI = [
    {
        type: "function",
        name: "createBrand",
        stateMutability: "nonpayable",
        inputs: [
            { name: "handle", type: "string" },
            { name: "metadataHash", type: "string" },
            { name: "fid", type: "uint256" },
            { name: "walletAddress", type: "address" },
        ],
        outputs: [{ name: "brandId", type: "uint16" }],
    },
    {
        type: "function",
        name: "isAdmin",
        stateMutability: "view",
        inputs: [{ name: "account", type: "address" }],
        outputs: [{ name: "", type: "bool" }],
    },
    {
        type: "function",
        name: "updateBrand",
        stateMutability: "nonpayable",
        inputs: [
            { name: "brandId", type: "uint16" },
            { name: "newMetadataHash", type: "string" },
            { name: "newFid", type: "uint256" },
            { name: "newWalletAddress", type: "address" },
        ],
        outputs: [],
    },
    {
        type: "function",
        name: "getBrand",
        stateMutability: "view",
        inputs: [{ name: "brandId", type: "uint16" }],
        outputs: [
            {
                components: [
                    { name: "fid", type: "uint256" },
                    { name: "walletAddress", type: "address" },
                    { name: "totalBrndAwarded", type: "uint256" },
                    { name: "availableBrnd", type: "uint256" },
                    { name: "handle", type: "string" },
                    { name: "metadataHash", type: "string" },
                    { name: "createdAt", type: "uint256" },
                ],
                name: "",
                type: "tuple",
            },
        ],
    },
] as const
