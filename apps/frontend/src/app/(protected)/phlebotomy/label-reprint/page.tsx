import { redirect } from "next/navigation";

/**
 * Renamed from "Label Reprint" to "Label Print". Kept as a redirect so existing
 * bookmarks and the sampleId deep link from the phlebotomy worklist still land
 * on the right page.
 */
export default async function LabelReprintRedirect({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(await searchParams)) {
        if (Array.isArray(value)) {
            value.forEach((entry) => params.append(key, entry));
        } else if (value !== undefined) {
            params.set(key, value);
        }
    }

    const query = params.toString();
    redirect(`/phlebotomy/label-print${query ? `?${query}` : ""}`);
}
