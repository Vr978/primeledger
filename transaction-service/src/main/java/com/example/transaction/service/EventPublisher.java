package com.example.transaction.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.core.SdkBytes;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.kinesis.KinesisClient;
import software.amazon.awssdk.services.kinesis.model.PutRecordRequest;

import javax.annotation.PostConstruct;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

/**
 * Unified event publisher - publishes to Kafka (local/docker) OR Kinesis (AWS).
 * Automatically selects based on which is available.
 */
@Service
public class EventPublisher {

    @Autowired(required = false)
    private KafkaTemplate<String, String> kafkaTemplate;

    @Value("${kinesis.stream-name:}")
    private String kinesisStreamName;

    @Value("${aws.region:us-east-1}")
    private String awsRegion;

    private KinesisClient kinesisClient;

    @PostConstruct
    public void init() {
        // Only create Kinesis client if stream name is configured (AWS environment)
        if (kinesisStreamName != null && !kinesisStreamName.isBlank()) {
            try {
                kinesisClient = KinesisClient.builder()
                        .region(Region.of(awsRegion))
                        .build();
            } catch (Exception e) {
                // Kinesis not available (running locally without AWS credentials)
                kinesisClient = null;
            }
        }
    }

    public void publish(String event) {
        // Try Kinesis first (AWS)
        if (kinesisClient != null && kinesisStreamName != null && !kinesisStreamName.isBlank()) {
            try {
                PutRecordRequest request = PutRecordRequest.builder()
                        .streamName(kinesisStreamName)
                        .partitionKey(UUID.randomUUID().toString())
                        .data(SdkBytes.fromString(event, StandardCharsets.UTF_8))
                        .build();
                kinesisClient.putRecord(request);
                return;
            } catch (Exception e) {
                // Fall through to Kafka
            }
        }

        // Fallback to Kafka (local/docker)
        if (kafkaTemplate != null) {
            kafkaTemplate.send("transactions", event);
        }
    }
}
