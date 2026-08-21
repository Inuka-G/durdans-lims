package com.uom.lims.audit;

import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The audit timestamp has to leave this service saying which zone it is in.
 *
 * <p>It did not. {@code LocalDateTime.toString()} emits "2026-08-21T18:30" with no offset,
 * and a date-time string with no offset is parsed by every browser as *local* time. The
 * stored value is UTC, so in Colombo (+5:30) every row rendered 5h30m early - and anything
 * recorded after 18:30 local was filed under the previous day. Accepting a sample at
 * 11pm showed yesterday's date, which is what made it visible.
 */
class AuditTimestampSerializationTest {

    private static final ZoneId COLOMBO = ZoneId.of("Asia/Colombo");

    /** What AuditLogController.toResponse now puts on the wire. */
    private static String onTheWire(LocalDateTime storedUtc) {
        return storedUtc.atOffset(ZoneOffset.UTC).toString();
    }

    /** What a browser does with that string: parse it, then render it in the local zone. */
    private static ZonedDateTime asReadByABrowserIn(ZoneId zone, String wireValue) {
        return java.time.OffsetDateTime.parse(wireValue).atZoneSameInstant(zone);
    }

    @Test
    void carriesAnExplicitOffset() {
        assertThat(onTheWire(LocalDateTime.of(2026, 8, 21, 18, 30, 0)))
                .isEqualTo("2026-08-21T18:30Z")
                .endsWith("Z");
    }

    @Test
    void anEveningActionKeepsItsOwnDateInColombo() {
        // 18:30 UTC is 00:00 the next day in Colombo. Read as a bare local time it showed
        // "Aug 21, 6:30 PM"; read with the offset it is midnight on the 22nd, which is
        // when the receptionist actually accepted the sample.
        ZonedDateTime read = asReadByABrowserIn(COLOMBO, onTheWire(LocalDateTime.of(2026, 8, 21, 18, 30)));

        assertThat(read.toLocalDate()).isEqualTo(java.time.LocalDate.of(2026, 8, 22));
        assertThat(read.toLocalTime()).isEqualTo(java.time.LocalTime.of(0, 0));
    }

    @Test
    void aMiddayActionIsShiftedButKeepsItsDate() {
        ZonedDateTime read = asReadByABrowserIn(COLOMBO, onTheWire(LocalDateTime.of(2026, 8, 21, 4, 15)));

        assertThat(read.toLocalDate()).isEqualTo(java.time.LocalDate.of(2026, 8, 21));
        assertThat(read.toLocalTime()).isEqualTo(java.time.LocalTime.of(9, 45));
    }

    @Test
    void theOldFormatIsWhatALocalReaderMisreads() {
        // Kept as the regression marker: this is the string that used to go out, and the
        // reading of it that produced the wrong day.
        String bare = LocalDateTime.of(2026, 8, 21, 18, 30).toString();

        assertThat(bare).isEqualTo("2026-08-21T18:30").doesNotContain("Z");
        assertThat(LocalDateTime.parse(bare).atZone(COLOMBO).toLocalDate())
                .isEqualTo(java.time.LocalDate.of(2026, 8, 21)); // the wrong day
    }
}
