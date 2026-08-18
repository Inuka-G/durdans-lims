package com.uom.lims.config;

import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.kafka.KafkaProperties;
import org.springframework.boot.ssl.SslBundles;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.annotation.EnableKafka;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.core.ConsumerFactory;
import org.springframework.kafka.core.DefaultKafkaConsumerFactory;
import org.springframework.kafka.core.DefaultKafkaProducerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.core.ProducerFactory;
import org.springframework.kafka.listener.ContainerProperties;
import org.springframework.kafka.listener.DeadLetterPublishingRecoverer;
import org.springframework.kafka.listener.DefaultErrorHandler;
import org.springframework.util.backoff.FixedBackOff;

import java.util.HashMap;
import java.util.Map;

/**
 * Kafka wiring.
 *
 * <p>Both factories are built from {@link KafkaProperties}, i.e. from the
 * {@code spring.kafka.*} block in {@code application.yml}, and override only the
 * few things that cannot be expressed there. Declaring a {@code ProducerFactory}
 * or {@code ConsumerFactory} bean makes Boot's Kafka auto-configuration back off,
 * so a factory that assembles its own property map does not merely ignore the
 * YAML — it silently discards it. That is what used to happen here: the YAML set
 * {@code acks}, {@code retries} and {@code enable.idempotence} for durability and
 * none of them ever reached a producer. Seed from the properties, override
 * deliberately, and there is only one place to read to know how Kafka is tuned.
 */
@Configuration
@EnableKafka
public class KafkaConfig {

    private final KafkaProperties kafkaProperties;
    private final SslBundles sslBundles;

    public KafkaConfig(KafkaProperties kafkaProperties, ObjectProvider<SslBundles> sslBundles) {
        this.kafkaProperties = kafkaProperties;
        this.sslBundles = sslBundles.getIfAvailable();
    }

    @Bean
    public ProducerFactory<String, Object> producerFactory() {
        return new DefaultKafkaProducerFactory<>(kafkaProperties.buildProducerProperties(sslBundles));
    }

    @Bean
    public KafkaTemplate<String, Object> kafkaTemplate() {
        KafkaTemplate<String, Object> template = new KafkaTemplate<>(producerFactory());
        // G6: emit producer spans and propagate W3C trace headers (the hand-built
        // template bypasses Boot auto-config that would otherwise enable this).
        template.setObservationEnabled(true);
        return template;
    }

    @Bean
    public ConsumerFactory<String, String> kafkaStringConsumerFactory() {
        Map<String, Object> props = new HashMap<>(kafkaProperties.buildConsumerProperties(sslBundles));
        // This factory backs the lab-report listener, which takes the raw JSON and
        // parses it itself, so both halves stay Strings regardless of any
        // deserializer configured for other consumers.
        props.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class);
        props.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class);
        return new DefaultKafkaConsumerFactory<>(props);
    }

    /**
     * Retries a failing record a few times then routes it to a {@code <topic>.DLT}
     * dead-letter topic instead of blocking the partition or dropping the message.
     */
    @Bean
    public DefaultErrorHandler kafkaErrorHandler(KafkaTemplate<String, Object> kafkaTemplate) {
        DeadLetterPublishingRecoverer recoverer = new DeadLetterPublishingRecoverer(kafkaTemplate);
        return new DefaultErrorHandler(recoverer, new FixedBackOff(1000L, 3L));
    }

    @Bean
    public ConcurrentKafkaListenerContainerFactory<String, String> kafkaStringListenerContainerFactory(
            DefaultErrorHandler kafkaErrorHandler) {
        ConcurrentKafkaListenerContainerFactory<String, String> factory = new ConcurrentKafkaListenerContainerFactory<>();
        factory.setConsumerFactory(kafkaStringConsumerFactory());
        factory.setCommonErrorHandler(kafkaErrorHandler);
        // Pairs with spring.kafka.consumer.enable-auto-commit=false: an offset is
        // committed per successfully-processed record, so a failing record can
        // neither have its offset silently advanced (message loss) nor be
        // redelivered forever.
        factory.getContainerProperties().setAckMode(ContainerProperties.AckMode.RECORD);
        // G6: continue the trace from the inbound record's W3C headers on the consumer side.
        factory.getContainerProperties().setObservationEnabled(true);
        return factory;
    }
}
