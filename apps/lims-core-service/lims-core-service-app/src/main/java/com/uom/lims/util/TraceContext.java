package com.uom.lims.util;

import io.opentelemetry.api.trace.Span;
import io.opentelemetry.api.trace.SpanContext;

/**
 * Captures the current OpenTelemetry trace context as a W3C {@code traceparent} string
 * (G6) so it can be persisted on an outbox row and re-attached to the Kafka message when
 * the relay publishes it — joining the async HTTP → outbox → Kafka → consumer → dispatch
 * hops into one trace. Returns null when no valid span is active (e.g. tracing disabled,
 * or a non-request thread), degrading gracefully.
 */
public final class TraceContext {

    private TraceContext() {
    }

    public static String currentTraceparent() {
        SpanContext context = Span.current().getSpanContext();
        if (!context.isValid()) {
            return null;
        }
        return "00-" + context.getTraceId() + "-" + context.getSpanId() + "-" + context.getTraceFlags().asHex();
    }
}
