# Hướng dẫn Restore Database

> Chỉ chạy khi server công ty bị hỏng và cần khôi phục dữ liệu từ backup.

## Yêu cầu

- Server mới đã cài PostgreSQL (cùng version)
- File backup `.sql.gz.gpg` trong thư mục `/backups`

## Các bước

```bash
# 1. Giải mã backup
gpg --decrypt --batch --passphrase "<GPG_PASS>" \
  /backups/newway_20250701_020000.sql.gz.gpg | gunzip > restore.sql

# 2. Tạo database mới
psql -U postgres -c "CREATE DATABASE newway;"

# 3. Restore dữ liệu
psql -U newway_app -d newway < restore.sql

# 4. Dọn dẹp
rm restore.sql
```
