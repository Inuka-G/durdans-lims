package com.uom.lims.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.AwsCredentialsProvider;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3ClientBuilder;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.S3Presigner.Builder;

import java.net.URI;

/**
 * S3 wiring that works in BOTH environments without code changes:
 *
 * <ul>
 *   <li><b>Local / docker (LocalStack):</b> {@code spring.cloud.aws.endpoint} is set
 *       (e.g. http://localstack:4566) and static {@code test/test} credentials are
 *       supplied → endpoint override + path-style + static credentials.</li>
 *   <li><b>Cloud (real AWS, EC2/ECS):</b> the endpoint is left <i>blank</i> and no
 *       static access key is provided → talk to real S3 with virtual-host style and
 *       the {@link DefaultCredentialsProvider} (i.e. the IAM instance/task role — no
 *       long-lived keys baked anywhere).</li>
 * </ul>
 *
 * The switch is purely configuration-driven (blank endpoint / blank access key), so
 * the existing LocalStack flow is unchanged while production uses least-privilege
 * role credentials.
 */
@Configuration
public class S3Config {

    @Value("${spring.cloud.aws.credentials.access-key:}")
    private String accessKey;

    @Value("${spring.cloud.aws.credentials.secret-key:}")
    private String secretKey;

    @Value("${spring.cloud.aws.region}")
    private String region;

    @Value("${spring.cloud.aws.endpoint:}")
    private String endpoint;

    private boolean usesLocalStack() {
        return endpoint != null && !endpoint.isBlank();
    }

    private AwsCredentialsProvider credentialsProvider() {
        if (accessKey != null && !accessKey.isBlank()) {
            return StaticCredentialsProvider.create(AwsBasicCredentials.create(accessKey, secretKey));
        }
        // No static key supplied → IAM instance/task role via the default chain.
        return DefaultCredentialsProvider.create();
    }

    @Bean
    public S3Client s3Client() {
        S3ClientBuilder builder = S3Client.builder()
                .region(Region.of(region))
                .credentialsProvider(credentialsProvider());

        if (usesLocalStack()) {
            builder.endpointOverride(URI.create(endpoint))
                   .forcePathStyle(true); // LocalStack needs path-style addressing
        }
        return builder.build();
    }

    @Bean
    public S3Presigner s3Presigner() {
        Builder builder = S3Presigner.builder()
                .region(Region.of(region))
                .credentialsProvider(credentialsProvider());

        if (usesLocalStack()) {
            builder.endpointOverride(URI.create(endpoint))
                   .serviceConfiguration(S3Configuration.builder()
                           .pathStyleAccessEnabled(true)
                           .build());
        }
        return builder.build();
    }
}
