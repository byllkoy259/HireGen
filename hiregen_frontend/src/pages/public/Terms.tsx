import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from 'antd';
import Logo from '../../components/common/Logo';
import styles from './Terms.module.css';

const Terms: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className={styles.layoutContainer}>
            {/* ── Top Navbar đồng bộ ── */}
            <nav className={styles.navbar}>
                <div className={styles.navContainer}>
                    <div onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
                        <Logo size="sm" variant="dark" />
                    </div>
                    
                    <div className={styles.navLinks}>
                        <a onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>Trang chủ</a>
                        <a onClick={() => navigate('/login?redirect=candidate/jobs')} style={{ cursor: 'pointer' }}>Việc làm</a>
                        <a onClick={() => navigate('/candidate/guide')} style={{ cursor: 'pointer' }}>Cẩm nang IT Nhật</a>
                    </div>
                    
                    <div className={styles.navActions}>
                        <Button className={styles.btnOutline} onClick={() => navigate('/register')}>
                            Đăng ký
                        </Button>
                        <Button type="primary" className={styles.btnPrimary} onClick={() => navigate('/login')}>
                            Đăng nhập
                        </Button>
                    </div>
                </div>
            </nav>

            {/* ── HEADER PHÁP LÝ ── */}
            <header className={styles.headerBlock}>
                <div className={styles.headerInner}>
                    <h1>Điều khoản Dịch vụ & Chính sách Bảo mật Dữ liệu</h1>
                    <p>Cập nhật lần cuối: Tháng 5, 2026</p>
                </div>
            </header>

            {/* ── NỘI DUNG ĐIỀU KHOẢN CHI TIẾT ── */}
            <main className={styles.contentMain}>
                <div className={styles.paperCard}>
                    
                    <section className={styles.termSection}>
                        <h2>1. Mục đích và Phạm vi dịch vụ</h2>
                        <p>
                            HireGen hoạt động dưới mô hình nền tảng hỗ trợ tuyển dụng (Agency). Chúng tôi cung cấp công cụ tạo lập hồ sơ, phân tích năng lực bằng Trí tuệ nhân tạo (AI) và kết nối ứng viên với các doanh nghiệp đối tác tại thị trường Nhật Bản. Toàn bộ tính năng dành cho ứng viên tìm việc đều hoàn toàn miễn phí.
                        </p>
                    </section>

                    <section className={styles.termSection}>
                        <h2>2. Quyền riêng tư & Xử lý dữ liệu bằng AI</h2>
                        <div className={styles.highlightCallout}>
                            <p>
                                <strong>Trích xuất dữ liệu:</strong> Khi ứng viên tải lên CV (định dạng PDF/Word), hệ thống AI của HireGen sẽ tự động quét, phân tích cấu trúc từ khóa (kinh nghiệm, kỹ năng, học vấn) để điền vào hồ sơ số.
                            </p>
                            <p>
                                <strong>Cam kết bảo mật:</strong> Dữ liệu sau khi AI xử lý chỉ được lưu trữ trên hệ thống máy chủ bảo mật của HireGen nhằm mục đích tính toán độ phù hợp (Match Score) với các công việc đang mở. Chúng tôi cam kết KHÔNG sử dụng dữ liệu CV của bạn để huấn luyện (train) các mô hình AI công cộng bên ngoài.
                            </p>
                        </div>
                    </section>

                    <section className={styles.termSection}>
                        <h2>3. Quy trình chia sẻ hồ sơ (Consent-based)</h2>
                        <p>
                            HireGen tôn trọng tuyệt đối quyền quyết định của ứng viên. CV gốc và thông tin liên hệ cá nhân của bạn sẽ chỉ được gửi tới bộ phận tuyển dụng của doanh nghiệp Nhật Bản khi và chỉ khi:
                        </p>
                        <ul className={styles.bulletList}>
                            <li>Bạn chủ động nhấn nút "Ứng tuyển" (Apply) vào một vị trí cụ thể.</li>
                            <li>Hoặc bạn xác nhận đồng ý thông qua trao đổi trực tiếp với chuyên viên tư vấn (Headhunter) của HireGen.</li>
                        </ul>
                    </section>

                    <section className={styles.termSection}>
                        <h2>4. Trách nhiệm của Ứng viên</h2>
                        <p>
                            Để đảm bảo uy tín của nguồn nhân lực IT Việt Nam trong mắt đối tác quốc tế, ứng viên sử dụng HireGen cam kết:
                        </p>
                        <ul className={styles.bulletList}>
                            <li>Cung cấp thông tin trung thực về bằng cấp, chứng chỉ ngoại ngữ (JLPT, TOEIC,...) và kinh nghiệm làm việc thực tế.</li>
                            <li>Tuân thủ các quy tắc giao tiếp chuyên nghiệp (Ho-Ren-So) trong quá trình tham gia phỏng vấn do HireGen kết nối.</li>
                        </ul>
                    </section>

                    <section className={styles.termSection}>
                        <h2>5. Giới hạn trách nhiệm (Hệ thống ĐATN)</h2>
                        <p>
                            Do HireGen hiện đang là phiên bản sản phẩm phát triển phục vụ Đồ án tốt nghiệp, một số tính năng kết nối hệ thống doanh nghiệp thực tế có thể hoạt động trong môi trường thử nghiệm (Sandbox).
                        </p>
                        <p>
                            HireGen đóng vai trò là cầu nối tư vấn; quyết định tuyển dụng, ký kết hợp đồng lao động và mức lương cuối cùng hoàn toàn thuộc về thỏa thuận trực tiếp giữa ứng viên và doanh nghiệp đối tác.
                        </p>
                    </section>

                </div>
            </main>

            {/* ── Footer đồng bộ ── */}
            <footer className={styles.footer}>
                <div className={styles.footerBottom}>
                    <p>© 2026 HireGen - Nền tảng tuyển dụng IT chuẩn ITSS Nhật Bản</p>
                </div>
            </footer>
        </div>
    );
};

export default Terms;