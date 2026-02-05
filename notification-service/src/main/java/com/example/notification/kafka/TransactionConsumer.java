package com.example.notification.kafka;

import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;

@Service
public class TransactionConsumer {
    @KafkaListener(topics = "transactions", groupId = "banking-group")
    public void listen(String message) {
        System.out.println("📩 Notification Service received: " + message);
    }
}
