import { redirect } from 'next/navigation';

export default function VerificationIndexPage() {
    redirect('/verification/pending');
}
