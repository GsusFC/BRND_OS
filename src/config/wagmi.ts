import { cookieStorage, createConfig, createStorage, http } from 'wagmi'
import { base, mainnet } from 'wagmi/chains'
import { injected, walletConnect } from 'wagmi/connectors'

const walletConnectProjectId =
    process.env.NEXT_PUBLIC_REOWN_PROJECT_ID ||
    process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ||
    ''

const injectedConnector = injected({
    shimDisconnect: true,
})

const configuredConnectors = walletConnectProjectId
    ? [
        injectedConnector,
        walletConnect({
            projectId: walletConnectProjectId,
            showQrModal: true,
            metadata: {
                name: 'BRND Admin',
                description: 'BRND dashboard wallet access',
                url: 'https://cntr.brnd.land',
                icons: ['https://cntr.brnd.land/favicon.ico'],
            },
        }),
    ]
    : [injectedConnector]

export const wagmiConfig = createConfig({
    chains: [base, mainnet],
    connectors: configuredConnectors,
    transports: {
        [base.id]: http(process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://mainnet.base.org"),
        [mainnet.id]: http(),
    },
    storage: createStorage({
        storage: cookieStorage,
    }),
    ssr: true,
})
