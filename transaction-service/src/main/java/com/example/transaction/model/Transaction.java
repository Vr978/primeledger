package com.example.transaction.model;

import javax.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "transaction", indexes = {
    @Index(name = "idx_transaction_account_id", columnList = "accountId"),
    @Index(name = "idx_transaction_created_at", columnList = "createdAt")
})
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Getter
@Setter
public class Transaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long accountId;

    @Column(precision = 19, scale = 4, nullable = false)
    private BigDecimal amount;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private TransactionType type;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private TransactionCategory category;

    private String description;

    // For transfers: the other party's account number
    private String counterpartyAccountNumber;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = Instant.now();
        if (category == null) {
            category = TransactionCategory.OTHER;
        }
    }

    public enum TransactionType {
        DEPOSIT, WITHDRAW, TRANSFER_IN, TRANSFER_OUT
    }

    public enum TransactionCategory {
        GROCERIES, SALARY, RENT, BILLS, TRANSFER, ENTERTAINMENT, HEALTHCARE, TRAVEL, INVESTMENT, OTHER
    }
}
