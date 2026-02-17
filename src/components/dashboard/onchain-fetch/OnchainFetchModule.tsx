"use client"

import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

import type { FetchNotice, FetchSource } from "./types"

const getButtonLabel = (fetchSource: FetchSource): string => {
    if (fetchSource === "sheet") return "Fetch Sheet"
    if (fetchSource === "both") return "Fetch Both"
    return "Fetch Farcaster"
}

const getLoadingLabel = ({
    isFetching,
    isSheetSearching,
}: {
    isFetching: boolean
    isSheetSearching: boolean
}): string | null => {
    if (isFetching && isSheetSearching) return "Merging results (Sheet + Farcaster)..."
    if (isSheetSearching) return "Searching Google Sheet..."
    if (isFetching) return "Fetching Farcaster..."
    return null
}

export function OnchainFetchModule({
    fetchSource,
    setFetchSource,
    sheetQuery,
    setSheetQuery,
    onFetch,
    disabled,
    isFetching,
    isSheetSearching,
    channelOrProfile,
    hasSuggestions,
    notice,
    onAcceptAll,
    onIgnoreAll,
    className,
}: {
    fetchSource: FetchSource
    setFetchSource: (value: FetchSource) => void
    sheetQuery: string
    setSheetQuery: (value: string) => void
    onFetch: () => Promise<void> | void
    disabled: boolean
    isFetching: boolean
    isSheetSearching: boolean
    channelOrProfile: string
    hasSuggestions: boolean
    notice: FetchNotice | null
    onAcceptAll: () => void
    onIgnoreAll: () => void
    className?: string
}) {
    const isBusy = isFetching || isSheetSearching
    const loadingLabel = getLoadingLabel({ isFetching, isSheetSearching })
    const disableFetch =
        disabled || isBusy || ((fetchSource === "farcaster" || fetchSource === "both") && !channelOrProfile.trim()) || hasSuggestions

    return (
        <div className={className}>
            <div className="rounded-lg border border-zinc-800 bg-black/30 p-3">
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                    <div>
                        <label className="text-xs font-mono text-zinc-500">Data source</label>
                        <Select
                            value={fetchSource}
                            onValueChange={(value) => setFetchSource(value as FetchSource)}
                            disabled={disabled || isBusy}
                        >
                            <SelectTrigger className="mt-2 w-full">
                                <SelectValue placeholder="Select source" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="farcaster">Farcaster</SelectItem>
                                <SelectItem value="sheet">Google Sheet</SelectItem>
                                <SelectItem value="both">Both (Sheet + Farcaster)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <Button type="button" variant="secondary" size="sm" onClick={onFetch} disabled={disableFetch}>
                        {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : getButtonLabel(fetchSource)}
                    </Button>
                </div>

                {(fetchSource === "sheet" || fetchSource === "both") && (
                    <div className="mt-3">
                        <label className="text-xs font-mono text-zinc-500">Sheet Query</label>
                        <Input
                            value={sheetQuery}
                            onChange={(event) => setSheetQuery(event.target.value)}
                            className="mt-2"
                            placeholder="BID, name, ticker, channel or profile"
                            disabled={disabled}
                        />
                    </div>
                )}

                {loadingLabel && <p className="mt-2 text-[11px] font-mono text-zinc-500">{loadingLabel}</p>}
                {notice?.message && <p className="mt-2 text-[11px] font-mono text-zinc-500">{notice.message}</p>}
            </div>

            {hasSuggestions && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button type="button" variant="default" size="sm" onClick={onAcceptAll} disabled={disabled}>
                        Accept All Suggestions
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={onIgnoreAll} disabled={disabled}>
                        Ignore All
                    </Button>
                </div>
            )}
        </div>
    )
}
