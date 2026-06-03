package com.example.notification.kinesis;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.kinesis.KinesisClient;
import software.amazon.awssdk.services.kinesis.model.*;

import javax.annotation.PostConstruct;
import java.util.HashMap;
import java.util.Map;

/**
 * Polls Kinesis stream for transaction events and processes notifications.
 * Uses simple polling (not KCL) to keep dependencies minimal for a demo.
 */
@Service
@EnableScheduling
public class KinesisConsumer {

    private static final Logger log = LoggerFactory.getLogger(KinesisConsumer.class);

    @Value("${kinesis.stream-name:}")
    private String streamName;

    @Value("${aws.region:us-east-1}")
    private String awsRegion;

    private KinesisClient kinesisClient;
    private final Map<String, String> shardIterators = new HashMap<>();
    private boolean initialized = false;

    @PostConstruct
    public void init() {
        if (streamName == null || streamName.isBlank()) {
            log.info("Kinesis stream name not configured. Kinesis consumer disabled.");
            return;
        }

        try {
            kinesisClient = KinesisClient.builder()
                    .region(Region.of(awsRegion))
                    .build();

            // Get shard iterators
            ListShardsResponse shardsResponse = kinesisClient.listShards(
                    ListShardsRequest.builder().streamName(streamName).build());

            for (Shard shard : shardsResponse.shards()) {
                GetShardIteratorResponse iteratorResponse = kinesisClient.getShardIterator(
                        GetShardIteratorRequest.builder()
                                .streamName(streamName)
                                .shardId(shard.shardId())
                                .shardIteratorType(ShardIteratorType.LATEST)
                                .build());
                shardIterators.put(shard.shardId(), iteratorResponse.shardIterator());
            }

            initialized = true;
            log.info("Kinesis consumer initialized for stream: {} ({} shards)", streamName, shardIterators.size());
        } catch (Exception e) {
            log.warn("Failed to initialize Kinesis consumer: {}. Running without event consumption.", e.getMessage());
        }
    }

    @Scheduled(fixedDelay = 5000) // Poll every 5 seconds
    public void pollKinesis() {
        if (!initialized || kinesisClient == null) return;

        for (Map.Entry<String, String> entry : shardIterators.entrySet()) {
            try {
                String shardId = entry.getKey();
                String iterator = entry.getValue();

                if (iterator == null) continue;

                GetRecordsResponse response = kinesisClient.getRecords(
                        GetRecordsRequest.builder()
                                .shardIterator(iterator)
                                .limit(100)
                                .build());

                for (software.amazon.awssdk.services.kinesis.model.Record record : response.records()) {
                    String data = record.data().asUtf8String();
                    processEvent(data);
                }

                // Update iterator for next poll
                shardIterators.put(shardId, response.nextShardIterator());
            } catch (Exception e) {
                log.error("Error polling Kinesis shard {}: {}", entry.getKey(), e.getMessage());
            }
        }
    }

    private void processEvent(String eventJson) {
        log.info("📩 Notification received: {}", eventJson);
        // In production: parse JSON, send email via SES, push notification, etc.
        // For demo: just log it
    }
}
