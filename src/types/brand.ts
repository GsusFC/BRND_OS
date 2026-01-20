export interface BrandFormData {
    // Farcaster
    queryType: string
    channel: string
    profile: string
    warpcastUrl: string
    followerCount: string

    // Basic Info
    name: string
    description: string
    categoryId: string
    ownerFid: string
    ownerPrimaryWallet: string

    // Web & Media
    url: string
    imageUrl: string

    // Wallet
    walletAddress: string
}

export const EMPTY_BRAND_FORM: BrandFormData = {
    queryType: "0",
    channel: "",
    profile: "",
    warpcastUrl: "",
    followerCount: "",
    name: "",
    description: "",
    categoryId: "",
    ownerFid: "",
    ownerPrimaryWallet: "",
    url: "",
    imageUrl: "",
    walletAddress: "",
}

export interface CategoryOption {
    id: number
    name: string
}

export interface BrandFormSectionProps {
    formData: BrandFormData
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void
    errors?: Partial<Record<keyof BrandFormData, string[]>>
    disabled?: boolean
}

export interface BrandFormFieldsProps extends BrandFormSectionProps {
    categories: CategoryOption[]
    onAutoFill?: () => void
    isAutoFilling?: boolean
}
