package com.uom.lims.config;

import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.kafka.KafkaProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.ConfigDataApplicationContextInitializer;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.kafka.core.ConsumerFactory;
import org.springframework.kafka.core.ProducerFactory;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Guards a wiring mistake that already happened once and produced no error.
 *
 * <p>{@link KafkaConfig} declares its own {@code ProducerFactory}, which makes
 * Boot's Kafka auto-configuration back off. While that factory assembled its own
 * property map, every producer setting in {@code application.yml} — {@code acks},
 * {@code retries}, {@code enable.idempotence} — was silently discarded: the file
 * documented a strict, patient-safety-grade producer that no producer ever used.
 *
 * <p>These assertions load the real {@code application.yml} and read the
 * properties off the factory that would actually build the producer, so the
 * settings have to reach it rather than merely be present in the file.
 */
class KafkaProducerPropertiesTest {

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withInitializer(new ConfigDataApplicationContextInitializer())
            .withUserConfiguration(KafkaPropertiesTestConfig.class, KafkaConfig.class);

    @EnableConfigurationProperties(KafkaProperties.class)
    static class KafkaPropertiesTestConfig {
    }

    /** Config values arrive as Strings or boxed numbers depending on the source. */
    private static String valueOf(Map<String, Object> properties, String key) {
        Object value = properties.get(key);
        return value == null ? null : String.valueOf(value);
    }

    @Test
    void producerDurabilitySettingsFromYamlReachTheProducerFactory() {
        runner.run(context -> {
            ProducerFactory<?, ?> factory = (ProducerFactory<?, ?>) context.getBean(ProducerFactory.class);
            Map<String, Object> props = factory.getConfigurationProperties();

            // Wait for all in-sync replicas, and dedupe on the broker so a retried
            // publish is not delivered twice. Losing or duplicating a report event
            // is a patient-safety event.
            assertThat(valueOf(props, ProducerConfig.ACKS_CONFIG)).isEqualTo("all");
            assertThat(valueOf(props, ProducerConfig.RETRIES_CONFIG)).isEqualTo("5");
            assertThat(valueOf(props, ProducerConfig.ENABLE_IDEMPOTENCE_CONFIG)).isEqualTo("true");
            assertThat(valueOf(props, ProducerConfig.MAX_IN_FLIGHT_REQUESTS_PER_CONNECTION))
                    .isEqualTo("5");
        });
    }

    @Test
    void producerFailsFastSoTheOutboxRelayDrivesRetries() {
        runner.run(context -> {
            ProducerFactory<?, ?> factory = (ProducerFactory<?, ?>) context.getBean(ProducerFactory.class);
            Map<String, Object> props = factory.getConfigurationProperties();

            // OutboxRelay allows a send 5s and then leaves the row for the next
            // poll. A producer-level timeout longer than that would never be
            // reached, so these stay tuned to the relay rather than to the broker.
            assertThat(valueOf(props, ProducerConfig.DELIVERY_TIMEOUT_MS_CONFIG)).isEqualTo("5000");
            assertThat(valueOf(props, ProducerConfig.REQUEST_TIMEOUT_MS_CONFIG)).isEqualTo("3000");
            assertThat(valueOf(props, ProducerConfig.MAX_BLOCK_MS_CONFIG)).isEqualTo("1000");
        });
    }

    @Test
    void consumerCommitsPerRecordAndKeepsPayloadsAsStrings() {
        runner.run(context -> {
            ConsumerFactory<?, ?> factory = (ConsumerFactory<?, ?>) context.getBean(ConsumerFactory.class);
            Map<String, Object> props = factory.getConfigurationProperties();

            // Pairs with AckMode.RECORD: no timer-based commit, so a failing record
            // cannot have its offset silently advanced.
            assertThat(valueOf(props, ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG)).isEqualTo("false");
            assertThat(valueOf(props, ConsumerConfig.GROUP_ID_CONFIG)).isEqualTo("lims-dispatch-ingress");
            assertThat(valueOf(props, ConsumerConfig.AUTO_OFFSET_RESET_CONFIG)).isEqualTo("earliest");

            // The lab-report listener parses the raw JSON itself.
            assertThat(valueOf(props, ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG))
                    .contains("StringDeserializer");
        });
    }
}
