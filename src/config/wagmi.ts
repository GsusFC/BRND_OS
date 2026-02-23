import { cookieStorage, createConfig, createStorage, http } from 'wagmi'
import { base, mainnet } from 'wagmi/chains'
import { injected, walletConnect } from 'wagmi/connectors'

const walletConnectEnabled = process.env.NEXT_PUBLIC_ENABLE_WALLETCONNECT === 'true'
const walletConnectProjectId =
    process.env.NEXT_PUBLIC_REOWN_PROJECT_ID ||
    process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ||
    ''

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

const configuredConnectors =
    walletConnectEnabled && walletConnectProjectId
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
