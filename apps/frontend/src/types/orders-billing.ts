// ==========================================
// ORDERS & BILLING TYPES
// ==========================================

// Basic patient for order creation (subset of main Patient)
export interface OrderPatient {
    id: string;
    patientId: string; // DH-88291
    fullName: string;
    age: number;
    gender: 'Male' | 'Female' | 'Other';
    phone: string;
}

// ── Lab Tests ──────────────────────────────────────────────────────────────
export interface LabTest {
    id: string;
    testCode: string; // LBT-001
    testName: string;
    category: TestCategory;
    price: number;
    sampleType?: string;
    tubeType?: string;
    turnAroundTimeHours?: number;
    department?: string;
    requiresFasting?: boolean;
    parametersCount?: number;
    analyzer?: string;
    specimenVolume?: string;
    source?: string;
}

export type TestCategory = 'Hematology' | 'Biochemistry' | 'Urinalysis';

// ── Orders ─────────────────────────────────────────────────────────────────
export interface TestOrder {
    id: string;
    orderId: string; // ORD-55210
    patientId: string;
    patientName: string;
    patientAge: number;
    patientGender: string;
    orderDate: string;
    tests: OrderTest[];
    status: OrderStatus;
    orderingPhysician?: string;
    subtotal: number;
    serviceCharge: number;
    discount: number;
    totalAmount: number;
    createdBy?: string;
    paymentStatus?: PaymentStatus;
}

export interface OrderTest {
    testId: string;
    testCode: string;
    testName: string;
    category: string;
    price: number;
}

export type OrderStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'SAMPLE_COLLECTED' | 'REJECTED';

export type OrderTrackingStatus = 'COMPLETED' | 'CURRENT' | 'PENDING' | 'FAILED';

export interface OrderTrackingStep {
    key: string;
    label: string;
    status: OrderTrackingStatus;
    timestamp?: string | null;
    description?: string | null;
}

export interface OrderTrackingEvent {
    id: string;
    stage: string;
    title: string;
    description?: string | null;
    status: OrderTrackingStatus;
    timestamp?: string | null;
    performedBy?: string | null;
    testName?: string | null;
    barcode?: string | null;
    method?: string | null;
    trackingNumber?: string | null;
    trackingUrl?: string | null;
}

export interface OrderTrackingResponse {
    orderId: string;
    orderNo: string;
    orderStatus: OrderStatus;
    currentStage: string;
    currentDescription?: string | null;
    steps: OrderTrackingStep[];
    events: OrderTrackingEvent[];
}

// ── Billing ────────────────────────────────────────────────────────────────
export interface Bill {
    id: string;
    billId: string; // INV-2023-004521
    orderId: string;
    patientId: string;
    patientName: string;
    patientPhone: string;
    orderDate: string;
    billDate: string;
    tests: BillLineItem[];
    subtotal: number;
    serviceCharge: number;
    discount: number;
    totalAmount: number;
    paidAmount: number;
    outstandingAmount: number;
    paymentStatus: PaymentStatus;
    payments: Payment[];
}

export interface BillLineItem {
    testCode: string;
    testName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
}

export type PaymentStatus = 'PAID' | 'PENDING';

export interface Payment {
    id: string;
    transactionId: string;
    billId: string;
    amount: number;
    method: PaymentMethod;
    date: string;
    receivedBy: string;
    receiptNumber: string;
}

export type PaymentMethod =
    | 'CASH'
    | 'CREDIT_CARD'
    | 'DEBIT_CARD'
    | 'INSURANCE'
    | 'BANK_TRANSFER';

// ── Dashboard Stats ────────────────────────────────────────────────────────
export interface OrdersBillingStats {
    testOrdersToday: number;
    pendingPayments?: number;
    overduePayments: number;
    partialPayments: number;
    totalRevenueToday: number;
    trend?: string;
}

// ── Tax Invoices ───────────────────────────────────────────────────────────
export type InvoiceStatus = 'ISSUED' | 'PENDING' | 'OVERDUE' | 'CANCELLED';

export interface TaxInvoice {
    id: string;
    invoiceNo: string;
    billId: string;
    patientName: string;
    patientId: string;
    issuedDate: string;
    dueDate: string;
    subtotal: number;
    taxRate: number;
    taxAmount: number;
    totalWithTax: number;
    status: InvoiceStatus;
    issuedBy: string;
}

// ── Payment History ────────────────────────────────────────────────────────
export type PaymentRecordStatus = 'SUCCESS' | 'PENDING' | 'FAILED' | 'REFUNDED';

export interface PaymentRecord {
    id: string;
    transactionId: string;
    billId: string;
    orderId: string;
    patientName: string;
    patientId: string;
    amount: number;
    method: PaymentMethod;
    status: PaymentRecordStatus;
    receivedBy: string;
    dateTime: string;
    receiptNo: string;
}

// ── API Response Wrappers ──────────────────────────────────────────────────
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    message?: string;
    errors?: string[];
}

export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}
