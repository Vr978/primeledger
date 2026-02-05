package com.example.account.dto;

public class AuthResponse {
    private String token; // Access token (JWT)
    private String refreshToken; // Refresh token (UUID)
    private String username;
    private String message;

    // Constructors
    public AuthResponse() {
    }

    public AuthResponse(String token, String username, String message) {
        this.token = token;
        this.username = username;
        this.message = message;
    }

    public AuthResponse(String token, String refreshToken, String username, String message) {
        this.token = token;
        this.refreshToken = refreshToken;
        this.username = username;
        this.message = message;
    }

    // Getters and Setters
    public String getToken() {
        return token;
    }

    public void setToken(String token) {
        this.token = token;
    }

    public String getRefreshToken() {
        return refreshToken;
    }

    public void setRefreshToken(String refreshToken) {
        this.refreshToken = refreshToken;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }
}
