package com.uom.lims.util;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

/**
 * WHY: Order numbers, invoice numbers, and sample barcodes must be globally
 * unique even under high concurrent load (e.g., multiple phlebotomists
 * collecting samples simultaneously). PostgreSQL sequences are atomic and
 * gap-safe — they guarantee uniqueness without application-level locking.
 * This service centralises all reference number generation so the format
 * can be changed in one place without touching business logic.
 */
@Service
public class ReferenceNumberGenerator {

    // WHY: DateTimeFormatter is thread-safe and cached here to avoid repeated allocation.
    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("yyyyMMdd");

    @PersistenceContext
    private EntityManager entityManager;

    /**
     * WHY: Orders need a human-readable reference number displayed on
     * request forms and reports. Format: ORD-{yyyyMMdd}-{000001}
     * The date prefix allows staff to quickly identify when an order was placed.
     *
     * @return unique order number string
     */
    public String generateOrderNo() {
        long nextVal = nextSequenceValue("seq_order_no");
        String datePart = LocalDate.now().format(DATE_FORMAT);
        return String.format("ORD-%s-%06d", datePart, nextVal);
    }

    /**
     * WHY: Invoices must carry a unique, sequential bill number for
     * accounting reconciliation and patient receipts.
     * Format: INV-{yyyyMMdd}-{000001}
     *
     * @return unique invoice number string
     */
    public String generateBillNo() {
        long nextVal = nextSequenceValue("seq_bill_no");
        String datePart = LocalDate.now().format(DATE_FORMAT);
        return String.format("INV-%s-%06d", datePart, nextVal);
    }

    /**
     * WHY: Sample tubes require a barcode that is unique across the
     * entire laboratory to prevent sample mix-ups — a critical patient
     * safety requirement. The 8-digit padding accommodates high-volume days.
     * Format: DH-{yyyyMMdd}-{00000001}
     *
     * @return unique barcode string safe to print on sample tube labels
     */
    public String generateBarcode() {
        long nextVal = nextSequenceValue("seq_barcode");
        String datePart = LocalDate.now().format(DATE_FORMAT);
        return String.format("DH-%s-%08d", datePart, nextVal);
    }

    /**
     * WHY: Encapsulates the native SQL sequence query in one place.
     * Using a native query (not JPQL) is intentional — JPA has no
     * portable abstraction for sequence nextval().
     *
     * @param sequenceName the name of the PostgreSQL sequence to advance
     * @return the next value from the sequence
     */
    private long nextSequenceValue(String sequenceName) {
        Object result = entityManager
                .createNativeQuery("SELECT nextval('" + sequenceName + "')")
                .getSingleResult();
        return ((Number) result).longValue();
    }
}
