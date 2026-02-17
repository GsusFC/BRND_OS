import type { BrandFormValues } from "@/lib/validations/brand-form"

export type FetchSource = "farcaster" | "sheet" | "both"

export type SuggestionMap = Partial<BrandFormValues>

export type SheetBrandResult = {
    bid: number
    name: string
    url: string | null
    description: string | null
    iconLogoUrl: string | null
    tokenTicker?: string | null
    tokenContractAddress?: string | null
    ticker: string | null
    category: string | null
    profile: string | null
    channel: string | null
    guardianFid: number | null
    founder: string | null
    matchScore?: number
    matchReason?: string
    isReliable?: boolean
}

export type FarcasterFetchResult =
    | {
          success: true
          data: {
              name?: string | null
              description?: string | null
              imageUrl?: string | null
              followerCount?: string | number | null
              warpcastUrl?: string | null
              url?: string | null
              fid?: string | number | null
              canonicalProfile?: string
              canonicalChannel?: string
              canonicalHandle?: string
          }
      }
    | {
          error: string
      }

export type FetchNoticeCode =
    | "missing_farcaster_input"
    | "missing_sheet_query"
    | "sheet_no_results"
    | "sheet_ambiguous"
    | "no_changes"

export type FetchNotice = {
    code: FetchNoticeCode
    message: string
}
