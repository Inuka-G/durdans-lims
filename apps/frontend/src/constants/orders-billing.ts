// ==========================================
// API ENDPOINTS (Ordering & Billing)
// ==========================================
export const ORDER_BILLING_ENDPOINTS = {
    ORDERS: {
        BASE: '/orders',
        CREATE: '/orders/create',
        BY_ID: (id: string) => `/orders/${id}`,
        CANCEL: (id: string) => `/orders/${id}/cancel`,
        STATS: '/orders/stats',
        RECENT: '/orders/recent',
    },
    BILLS: {
        BASE: '/bills',
        BY_ID: (id: string) => `/bills/${id}`,
        PAYMENTS: '/bills/payments',
        RECORD_PAYMENT: (id: string) => `/bills/${id}/payments`,
        STATS: '/bills/stats',
    },
    TESTS: {
        BASE: '/tests',
        SEARCH: '/tests/search',
        BY_CATEGORY: (category: string) => `/tests/category/${category}`,
    },
    DASHBOARD: {
        STATS: '/dashboard/orders-billing/stats',
    },
};

// ==========================================
// STATUS COLORS & BADGES
// ==========================================
// CURRENCY & FORMATTING
// ==========================================
export const CURRENCY_SYMBOL = 'LKR';

export const formatCurrency = (amount: number | string | null | undefined): string => {
    const numericAmount = Number(amount ?? 0);
    const safeAmount = Number.isFinite(numericAmount) ? numericAmount : 0;
    return `${CURRENCY_SYMBOL} ${safeAmount.toLocaleString('en-LK', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
};

export const formatDate = (date: string): string => {
    return new Date(date).toLocaleDateString('en-LK', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
};

export const formatDateTime = (date: string): string => {
    return new Date(date).toLocaleString('en-LK', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

// ==========================================
// TEST CATEGORIES
// ==========================================
export const TEST_CATEGORIES = [
    { value: 'Hematology', label: 'Hematology' },
    { value: 'Biochemistry', label: 'Biochemistry' },
    { value: 'Urinalysis', label: 'Urinalysis' },
];

// ==========================================
// PAYMENT METHODS
// ==========================================
export const PAYMENT_METHODS = [
    { value: 'CASH', label: 'Cash' },
    { value: 'CREDIT_CARD', label: 'Credit Card' },
    { value: 'DEBIT_CARD', label: 'Debit Card' },
    { value: 'INSURANCE', label: 'Insurance' },
    { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
];

export const METHOD_LABELS: Record<string, string> = {
    CASH: 'Cash',
    CREDIT_CARD: 'Credit Card',
    DEBIT_CARD: 'Debit Card',
    INSURANCE: 'Insurance',
    BANK_TRANSFER: 'Bank Transfer',
};

// ==========================================
// SERVICE CHARGE (5%)
// ==========================================
export const SERVICE_CHARGE_PERCENTAGE = 5;

export const calculateServiceCharge = (subtotal: number): number => {
    return (subtotal * SERVICE_CHARGE_PERCENTAGE) / 100;
};

export const calculateTotal = (subtotal: number, discount: number = 0): number => {
    const serviceCharge = calculateServiceCharge(subtotal);
    return subtotal + serviceCharge - discount;
};

// ==========================================
// PAGINATION
// ==========================================
export const PAGINATION = {
    DEFAULT_PAGE: 1,
    DEFAULT_PAGE_SIZE: 10,
    PAGE_SIZE_OPTIONS: [10, 25, 50],
};
