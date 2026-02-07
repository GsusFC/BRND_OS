import { cookieStorage, createConfig, createStorage, http } from 'wagmi'
import { base, mainnet } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'

export const wagmiConfig = createConfig({
    chains: [base, mainnet],
    connectors: [
        injected({
            shimDisconnect: true,
        }),
    ],
    transports: {
        [base.id]: http(process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://mainnet.base.org"),
        [mainnet.id]: http(),
    },
    storage: createStorage({
        storage: cookieStorage,
    }),
    ssr: true,
})
