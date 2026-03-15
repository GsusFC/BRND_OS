import { cookieStorage, createConfig, createStorage, http } from 'wagmi'
import { base, mainnet } from 'wagmi/chains'
import { injected, walletConnect } from 'wagmi/connectors'

const walletConnectProjectId =
    process.env.NEXT_PUBLIC_REOWN_PROJECT_ID ||
    process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ||
    '349ee7a88d119a669be53f17c9449b78'

const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== 'undefined' ? window.location.origin : 'https://cntr.brnd.land')
const mainnetRpcUrl =
    process.env.NEXT_PUBLIC_MAINNET_RPC_URL ||
    'https://ethereum.publicnode.com'

const injectedConnector = injected({
    shimDisconnect: true,
})

const walletConnectConnector = walletConnect({
    projectId: walletConnectProjectId,
    showQrModal: false,
    metadata: {
        name: 'BRND Admin',
        description: 'BRND dashboard wallet access',
        url: appUrl,
        icons: [`${appUrl}/favicon.ico`],
    },
})

const configuredConnectors = walletConnectProjectId
    ? [injectedConnector, walletConnectConnector]
    : [injectedConnector]

export const wagmiConfig = createConfig({
    chains: [base, mainnet],
    connectors: configuredConnectors,
    transports: {
        [base.id]: http(process.env.NEXT_PUBLIC_BASE_RPC_URL || "https://mainnet.base.org"),
        [mainnet.id]: http(mainnetRpcUrl),
    },
    storage: createStorage({
        storage: cookieStorage,
    }),
    ssr: true,
})
