package com.example.account.service;

import com.example.account.model.RefreshToken;
import com.example.account.repository.RefreshTokenRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@Service
public class RefreshTokenService {

    // 7 days in seconds
    private static final long REFRESH_TOKEN_VALIDITY = 7 * 24 * 60 * 60;

    @Autowired
    private RefreshTokenRepository refreshTokenRepository;

    /**
     * Create a new refresh token for a user
     */
    public RefreshToken createRefreshToken(Long userId) {
        RefreshToken refreshToken = new RefreshToken();
        refreshToken.setToken(UUID.randomUUID().toString());
        refreshToken.setUserId(userId);
        refreshToken.setExpiryDate(Instant.now().plusSeconds(REFRESH_TOKEN_VALIDITY));
        refreshToken.setRevoked(false);
        refreshToken.setCreatedAt(Instant.now());

        return refreshTokenRepository.save(refreshToken);
    }

    /**
     * Find refresh token by token string
     */
    public Optional<RefreshToken> findByToken(String token) {
        return refreshTokenRepository.findByToken(token);
    }

    /**
     * Verify that a refresh token is still valid
     */
    public RefreshToken verifyExpiration(RefreshToken token) {
        if (token.isExpired()) {
            refreshTokenRepository.delete(token);
            throw new RuntimeException("Refresh token has expired. Please login again.");
        }
        if (token.getRevoked()) {
            throw new RuntimeException("Refresh token has been revoked. Please login again.");
        }
        return token;
    }

    /**
     * Revoke a specific refresh token (logout from one device)
     */
    @Transactional
    public void revokeToken(String token) {
        Optional<RefreshToken> refreshToken = refreshTokenRepository.findByToken(token);
        if (refreshToken.isPresent()) {
            RefreshToken rt = refreshToken.get();
            rt.setRevoked(true);
            refreshTokenRepository.save(rt);
        }
    }

    /**
     * Revoke all refresh tokens for a user (logout from all devices)
     */
    @Transactional
    public void revokeAllUserTokens(Long userId) {
        refreshTokenRepository.deleteByUserId(userId);
    }

    /**
     * Delete all expired refresh tokens (scheduled cleanup)
     */
    @Transactional
    public int deleteExpiredTokens() {
        Instant now = Instant.now();
        refreshTokenRepository.deleteByExpiryDateBefore(now);
        return 0; // Could count deleted tokens if needed
    }
}
