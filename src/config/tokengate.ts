import { base } from 'viem/chains'

// BRND Token Gate Configuration
export const TOKEN_GATE_CONFIG = {
    // Token contract address on Base
    tokenAddress: '0x41Ed0311640A5e489A90940b1c33433501a21B07' as `0x${string}`,

    // Minimum balance required (in token units, will be converted with decimals)
    minBalance: BigInt(10_000_000),

    // Token decimals (standard ERC-20 is 18)
    decimals: 18,

    // Chain where the token lives
    chainId: base.id,

    // Token metadata for display
    tokenName: 'BRND',
    tokenSymbol: 'BRND',
}

// Calculate minimum balance with decimals
export const MIN_BALANCE_WITH_DECIMALS =
    TOKEN_GATE_CONFIG.minBalance * BigInt(10 ** TOKEN_GATE_CONFIG.decimals)

// ERC-20 ABI - only the functions we need
export const ERC20_ABI = [
    {
        name: 'balanceOf',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ name: 'balance', type: 'uint256' }],
    },
    {
        name: 'decimals',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'uint8' }],
    },
    {
        name: 'symbol',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'string' }],
    },
] as const
