import { cookieStorage, createConfig, createStorage, http } from 'wagmi'
import { base, mainnet } from 'wagmi/chains'
import { coinbaseWallet, injected, walletConnect } from 'wagmi/connectors'

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
        coinbaseWallet({
            appName: 'BRND Admin',
            appLogoUrl: 'https://cntr.brnd.land/favicon.ico',
        }),
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
    : [
        injectedConnector,
        coinbaseWallet({
            appName: 'BRND Admin',
            appLogoUrl: 'https://cntr.brnd.land/favicon.ico',
        }),
    ]

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
