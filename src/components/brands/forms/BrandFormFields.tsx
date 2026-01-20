"use client"

import type { BrandFormFieldsProps } from "@/types/brand"
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
    return (
        <div className="space-y-6">
            <FarcasterSection
                formData={formData}
                onChange={onChange}
                errors={errors}
                disabled={disabled}
                onAutoFill={onAutoFill}
                isAutoFilling={isAutoFilling}
            />
            <BasicInfoSection
                formData={formData}
                onChange={onChange}
                errors={errors}
                disabled={disabled}
                categories={categories}
            />
            <WebMediaSection
                formData={formData}
                onChange={onChange}
                errors={errors}
                disabled={disabled}
            />
            <WalletSection
                formData={formData}
                onChange={onChange}
                errors={errors}
                disabled={disabled}
                readOnly={walletReadOnly}
            />
            <TokenInfoSection
                formData={formData}
                onChange={onChange}
                errors={errors}
                disabled={disabled}
            />
        </div>
    )
}
