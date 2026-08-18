import { redirect } from "next/navigation";

/**
 * The page was renamed from "Barcode Reprint" to "Barcode Print" — printing a
 * label is the normal action, not an exception. This stub keeps bookmarks and
 * any links still in the wild working, forwarding the query string so a deep
 * link from Quality Verification or a sample page lands on the right sample.
 */
export default async function BarcodeReprintRedirect({
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
    redirect(`/reception/barcode-print${query ? `?${query}` : ""}`);
}
