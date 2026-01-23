"use client"

import { useState } from "react"
import type { BrandFormFieldsProps } from "@/types/brand"
import { TabsContent } from "@/components/ui/tabs"
import { BrandFormTabs } from "@/components/brands/forms/BrandFormTabs"
import { FarcasterSection } from "@/components/brands/forms/FarcasterSection"
import { BasicInfoSection } from "@/components/brands/forms/BasicInfoSection"
import { WebMediaSection } from "@/components/brands/forms/WebMediaSection"
import { WalletSection } from "@/components/brands/forms/WalletSection"
import { TokenInfoSection } from "@/components/brands/forms/TokenInfoSection"

export function BrandFormFields({
    formData,
    onChange,
    errors,
    categories,
    disabled,
    onAutoFill,
    isAutoFilling,
    walletReadOnly,
}: BrandFormFieldsProps) {
    const [activeTab, setActiveTab] = useState("farcaster")

    return (
        <BrandFormTabs value={activeTab} onValueChange={setActiveTab}>

            <TabsContent value="farcaster" className="space-y-4">
                <FarcasterSection
                    formData={formData}
                    onChange={onChange}
                    errors={errors}
                    disabled={disabled}
                    onAutoFill={onAutoFill}
                    isAutoFilling={isAutoFilling}
                />
            </TabsContent>

            <TabsContent value="basic" className="space-y-4">
                <BasicInfoSection
                    formData={formData}
                    onChange={onChange}
                    errors={errors}
                    disabled={disabled}
                    categories={categories}
                />
            </TabsContent>

            <TabsContent value="media" className="space-y-4">
                <WebMediaSection
                    formData={formData}
                    onChange={onChange}
                    errors={errors}
                    disabled={disabled}
                />
            </TabsContent>

            <TabsContent value="wallet" className="space-y-4">
                <WalletSection
                    formData={formData}
                    onChange={onChange}
                    errors={errors}
                    disabled={disabled}
                    readOnly={walletReadOnly}
                />
            </TabsContent>

            <TabsContent value="token" className="space-y-4">
                <TokenInfoSection
                    formData={formData}
                    onChange={onChange}
                    errors={errors}
                    disabled={disabled}
                />
            </TabsContent>
        </BrandFormTabs>
    )
}
