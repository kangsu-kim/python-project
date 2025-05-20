const fs = require('fs');
const path = require('path');

// 실제 형식의 테스트 인증 정보
const testCredentials = {
  "type": "service_account",
  "project_id": "cargo-transport-system",
  "private_key_id": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDbz4x3UQzQvXPW\nfMGg0ALt/WIrAUk+yANtTNX4O+OSLCPvVMxHqXsrnRAEwXweKQKlpzKvlR0QLTal\niEHUYfIL/DZCm79GV6dmXofBu2EBLXneH+FWh+RZm1bKg9J5Pmo5oPT1mOIjWwx1\nBVN3X5rqJX2TK6atKXYh66kR+pbcNAqEjJR762LD9/nVsE2lLodQX1ujADI8Z8So\niQK2SvtmcQf7G8AktP2/ccqXLEUxeCb8KYqtGxqXhNHjj1aqXvPN/YJRaajh5ZSK\nEYi4SC+QVLt1UPXcXRaSWfwUsWq6+HZh6lGW7GZ62NQNE4o/DDkPkrJD1QY8lCue\nP+KVrYfDAgMBAAECggEAAK5goQ8AY0MHMJPdYBQB8XcbnHlTUHmL0OG7Hs94Y9Nz\nC+uEQR4CxFCmL+MUMZ3HlnCsZ2fNL9uXrYY/Zw+Nx+a9AGc2BXQe4zx6sfqq+hSZ\nW2NWw+oQYIsgWXm91sVQ4REmxZ3W9RbDFW5VAXVDooxnLfwmUVRZHHLAG1qzjByr\nWbxA4HoKXrpM1laAkb5Pcu53SrLqhSk96obUmwfNRHbBh8x0Vww5PzaWhjXzpb3K\nc3OcmgM27lFnJ6pTFPiJh+DuE6IzLpwWBvEdI8m4+QCaTQj1kS6UYDSlAuzrayLx\nxDZgwShFIW1YRF/t7MsMl9kM0nzL9BrJO/VycOhGgQKBgQDzj29xY73Y/4GQlpzh\nDL2HXPBWi2BMUbvKJvnj89ZZc0dOAfQz/JYLQWMQJi/qLYnCSrh6MDzGeelFzCcw\nn6mkp3PAVbfW6jRKukZWpXMKNUXVxDRA4Kq79jrEgEX0rPk2QqOoFhg2MkJTzMqw\ndgMHYlj+5zp1LlCqGlG/Gv6Y2QKBgQDmyjtv9TP4xfiCV+Q6WxykUNs+Z9SQN8jW\nJGcf2bLa5mKUQNbHU2ygSEQRnjwP1v22Ga5E5qFVOiJGTGJCiTdXdDDIeL731flE\n3Ke8RywdKYQqwzPbzvV0rWTFI89jDHW8ZcSUoWvyUhsF3DR6YLxoGcBKUHvnKZci\nOt2BK9JLuwKBgQCwh4/XBFLJlSC1uxhXJAl2+g+4M3AdW29XcvPh6U8LehGd5fy4\nBOr32aJFXzkUbBz9tUFkL+lEkCH/XHCXqHCYv/sAfPZnGbEUlnMkHRl/Fv3hD7Hr\nudh3aJHAF4ONTQOtV4tXQCuIPMCXGp92UgF8uSDHjNuE4ZHcLWCK9s8EgQKBgHSM\n5s3VBK5YDRFo5SPXKU8kJVQnQEQR2QxfnmvBrWNZSRCYIMVgKI5OplCZJa8QjX5S\nP7c9K0jV93xZKpEHJQFEJ9jKr43tMXN5jLgQcH5+V/MuCR2taf/yaPSx5j6cjrLL\nA6l5mWUC6OuGPXJxVpEBnEi4V9nBxRmQDTZHiP6tAoGBAO2foGRBIoEjvB4KQhsn\nYUVoQZiwzUEO3+nE43+yLAsrKuAVyno8ysEeQZcUxIXtE9/KyaQCBnEz0jBUbEPm\n0M6CfKlbYeGFFxJHmMrVwAzIxDEVRqfF2F/VblDL06UXXCoFESMKJsAWvQTSsRF6\n+EV8VBt5llrPRekA9r1h4KLn\n-----END PRIVATE KEY-----\n",
  "client_email": "cargo-sheet-reader@cargo-transport-system.iam.gserviceaccount.com",
  "client_id": "123456789012345678901",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/cargo-sheet-reader%40cargo-transport-system.iam.gserviceaccount.com",
  "universe_domain": "googleapis.com"
};

// 인증 정보 파일 저장 경로
const credentialsPath = path.join(__dirname, 'config', 'google', 'credentials.json');

// 파일 생성
fs.writeFileSync(credentialsPath, JSON.stringify(testCredentials, null, 2));

console.log(`테스트 인증 정보가 ${credentialsPath}에 저장되었습니다.`); 