# Get Sitemap Links & SEO Keyword Pruner

Ứng dụng full-stack trích xuất, phân tích dữ liệu XML Sitemap và chuẩn hóa cấu trúc Category/Subcategory, phục vụ tối ưu SEO website với đầy đủ hệ thống xác thực người dùng và phân quyền quản trị.

---

## 🚀 Các Tính Năng Trọng Tâm

1. **Trích xuất Sitemap thông minh**:
   - Tự động dò tìm sitemap từ domain/URL (`robots.txt`, WordPress REST API, RSS/Atom feeds).
   - Hỗ trợ vượt tường lửa Cloudflare/WAF qua đa tầng fallback hoặc dán trực tiếp mã XML.
   - Streaming SSE hiển thị liên kết theo thời gian thực.
2. **Bộ công cụ xử lý & xuất dữ liệu**:
   - **Copy 25000 dòng**: Sao chép nhanh dữ liệu 2 cột (Category, Subcategory) tối đa 25.000 dòng vào bộ nhớ tạm để dán trực tiếp vào Google Sheets / Excel.
   - **Tải excel 2 cột**: Xuất file Excel định dạng chuẩn 2 cột (Category, Subcategory).
   - **Tải excel 3 cột**: Xuất file Excel đầy đủ 3 cột (Category, Subcategory, Full URL).
   - **Tỉa Keyword**: Tự động nhận diện cấu trúc taxonomy, trích xuất slug, phân loại danh mục, tỉa từ khóa và loại trừ tiền tố không cần thiết.
3. **Bảo mật & Phân quyền (Auth & Admin)**:
   - Đăng nhập qua tài khoản **Google (Gmail)**.
   - Đăng nhập qua **Tên đăng nhập (Username)** hoặc **Email** và Mật khẩu.
   - Bảng điều khiển Admin (`letuanthhcm@gmail.com`):
     - Nút **Tạo User & Pass** cấp tài khoản trực tiếp cho nhân viên/thành viên.
     - Tạo mật khẩu ngẫu nhiên an toàn, 1-click sao chép thông tin gửi người dùng.
     - Quản lý trạng thái: Kích hoạt (Active), Chờ duyệt (Pending), Tạm khóa (Disabled), Xóa tài khoản.

---

## 📦 Hướng Dẫn Đẩy Code Lên GitHub

Mở terminal tại thư mục gốc của dự án:

```bash
# 1. Khởi tạo Git (nếu chưa có)
git init

# 2. Kiểm tra các file sẽ commit
git status

# 3. Thêm tất cả file vào git
git add .

# 4. Tạo commit
git commit -m "feat: complete sitemap crawler with user/pass admin management and excel exports"

# 5. Đổi tên nhánh sang main
git branch -M main

# 6. Gán remote GitHub của bạn (thay bằng URL repo của bạn)
git remote add origin https://github.com/USERNAME/REPO_NAME.git

# 7. Đẩy code lên GitHub
git push -u origin main
```

---

## 🌐 Hướng Dẫn Deploy Lên VPS

### CÁCH 1: Deploy Bằng Docker & Docker Compose (Khuyên dùng - Nhanh & An Toàn Nhất)

Đây là cách tốt nhất vì không lo xung đột phiên bản Node.js trên VPS.

#### Bước 1: Cài đặt Docker trên VPS (nếu chưa có)
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
```

#### Bước 2: Clone code từ GitHub về VPS
```bash
git clone https://github.com/USERNAME/REPO_NAME.git /var/www/sitemap-app
cd /var/www/sitemap-app
```

#### Bước 3: Tạo file `.env` (tùy chọn)
```bash
cp .env.example .env
# Chỉnh sửa nếu cần bổ sung key Gemini hoặc biến cấu hình
nano .env
```

#### Bước 4: Khởi chạy container
```bash
docker compose up -d --build
```
Ứng dụng sẽ tự động build và chạy tại cổng `3000`.

---

### CÁCH 2: Deploy Trực Tiếp Bằng Node.js & PM2

#### Bước 1: Cài đặt Node.js 20+ và PM2 trên VPS
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g pm2
```

#### Bước 2: Clone repository và cài đặt thư viện
```bash
cd /var/www
git clone https://github.com/USERNAME/REPO_NAME.git sitemap-app
cd sitemap-app
npm install
```

#### Bước 3: Build dự án
```bash
npm run build
```
Lệnh này sẽ build giao diện React ra thư mục `dist/` và bundle server Express thành file `dist/server.cjs`.

#### Bước 4: Khởi chạy ứng dụng với PM2
```bash
pm2 start dist/server.cjs --name "sitemap-app"
pm2 save
pm2 startup
```

---

## 🛡️ Cấu Hình Nginx Reverse Proxy & SSL (Domain riêng)

Để chạy ứng dụng dưới tên miền riêng (ví dụ: `sitemap.yourdomain.com`) với cổng 80/443:

### Bước 1: Tạo file cấu hình Nginx
```bash
sudo nano /etc/nginx/sites-available/sitemap.conf
```

Dán nội dung sau vào file:

```nginx
server {
    listen 80;
    server_name sitemap.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        # Hỗ trợ WebSocket và Server-Sent Events (SSE) cho tính năng streaming sitemap
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;

        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Tắt buffer để Server-Sent Events (SSE) phản hồi tức thì
        proxy_buffering off;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
}
```

### Bước 2: Kích hoạt cấu hình và reload Nginx
```bash
sudo ln -s /etc/nginx/sites-available/sitemap.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Bước 3: Cài đặt chứng chỉ SSL miễn phí với Certbot
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d sitemap.yourdomain.com
```

Certbot sẽ tự động cấu hình HTTPS và tự động gia hạn chứng chỉ khi hết hạn.

---

## 🔒 Kiểm Tra & Quản Trị Hệ Thống

- **Xem log ứng dụng**:
  - Dùng Docker: `docker compose logs -f`
  - Dùng PM2: `pm2 logs sitemap-app`
- **Khởi động lại**:
  - Dùng Docker: `docker compose restart`
  - Dùng PM2: `pm2 restart sitemap-app`
- **Cập nhật code mới từ GitHub**:
  ```bash
  cd /var/www/sitemap-app
  git pull origin main
  # Nếu dùng Docker:
  docker compose up -d --build
  # Nếu dùng PM2:
  npm install
  npm run build
  pm2 restart sitemap-app
  ```
