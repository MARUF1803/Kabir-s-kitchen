UPDATE Users 
SET PasswordHash = '$2a$12$jTjlkUP/B0O8RbWXF3N8A.9J8TtrLHPheAHQdYkfvM4EWcDUw.0IS',
    RefreshToken = NULL,
    RefreshTokenExpiryTime = NULL
WHERE Id = 20;
SELECT Id, FullName, Email FROM Users WHERE Id = 20;
