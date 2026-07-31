import { redirect } from "next/navigation";

export default function PaymentHistoryPage() {
    redirect("/orders-billing/bills");
}
