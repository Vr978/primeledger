package com.example.accountservice;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;


@SpringBootApplication(scanBasePackages = {"com.example.account", "com.example.accountservice"})
@EntityScan(basePackages = "com.example.account.model")
@EnableJpaRepositories(basePackages = "com.example.account.repository")
public class AccountserviceApplication {
    public static void main(String[] args) {
        SpringApplication.run(AccountserviceApplication.class, args);
        System.out.println("This is my application ------------------------- "+ java.util.TimeZone.getDefault().getID());
    }
}
