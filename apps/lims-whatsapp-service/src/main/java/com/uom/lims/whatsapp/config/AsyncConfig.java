package com.uom.lims.whatsapp.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.ThreadPoolExecutor;

/**
 * The executor replies run on. Small on purpose — one lab's WhatsApp traffic is tens of
 * messages a minute at worst — and bounded, with caller-runs as the overflow policy:
 * under a burst the event-publishing thread slows down rather than replies being
 * silently dropped. The webhook ack itself is never on this path.
 */
@Configuration
@EnableAsync
public class AsyncConfig {

    public static final String REPLY_EXECUTOR = "replyExecutor";

    @Bean(name = REPLY_EXECUTOR)
    public ThreadPoolTaskExecutor replyExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(4);
        executor.setQueueCapacity(200);
        executor.setThreadNamePrefix("wa-reply-");
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        return executor;
    }
}
