import { useMemo, useState } from "react"
import type { BrandFormData } from "@/types/brand"

export function useBrandForm(initial: BrandFormData) {
    const [formData, setFormData] = useState<BrandFormData>(initial)

    const handleInputChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ) => {
        const { name, value } = e.target
        setFormData((prev) => ({ ...prev, [name]: value }))
    }

    const setField = (key: keyof BrandFormData, value: string) => {
        setFormData((prev) => ({ ...prev, [key]: value }))
    }

    const queryType = useMemo(() => (formData.queryType === "1" ? "1" : "0"), [formData.queryType])

    return {
        formData,
        setFormData,
        setField,
        handleInputChange,
        queryType,
    }
}
