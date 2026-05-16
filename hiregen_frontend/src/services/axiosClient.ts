import axios from 'axios';

// 1. Khởi tạo instance Axios với Base URL trỏ về Backend FastAPI
const axiosClient = axios.create({
  baseURL: 'http://127.0.0.1:8000',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// 2. Request Interceptor: Tự động gắn Token trước khi gửi request đi
axiosClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 3. Response Interceptor: Xử lý lỗi trả về từ Backend
axiosClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    const status = error.response?.status;
    const requestUrl = error.config?.url || '';

    // ✅ Chỉ redirect khi 401 xảy ra NGOÀI trang login
    // (tức là token hết hạn giữa chừng, không phải đăng nhập sai)
    const isLoginRequest = requestUrl.includes('/api/auth/login');

    if (status === 401 && !isLoginRequest) {
      console.warn('Token hết hạn hoặc không hợp lệ. Đang đăng xuất...');
      localStorage.removeItem('access_token');
      window.location.href = '/login';
    }

    // Luôn reject để các trang tự xử lý lỗi của mình
    return Promise.reject(error);
  }
);

export default axiosClient;