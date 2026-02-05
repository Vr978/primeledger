package com.example.transactionservice;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

@SpringBootApplication(scanBasePackages = {"com.example.transaction", "com.example.transactionservice"})
@EntityScan(basePackages = "com.example.transaction.model")
@EnableJpaRepositories(basePackages = "com.example.transaction.repository")
public class TransactionserviceApplication {
    public static void main(String[] args) {
        SpringApplication.run(TransactionserviceApplication.class, args);
    }
}
