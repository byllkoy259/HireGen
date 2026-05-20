import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from 'antd';
import Logo from '../../components/common/Logo';
import Header from '../../components/layouts/Header';
import Footer from '../../components/layouts/Footer';
import styles from './AboutUs.module.css';

const AboutUs: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className={styles.layoutContainer}>
            <Header />

            {/* ── KHỐI 1: HERO SECTION (Tuyên ngôn sứ mệnh) ── */}
            <section className={styles.heroSection}>
                <div className={styles.heroBg}>
                    <div className={styles.heroBgGrid}></div>
                    <div className={styles.heroBgCircle}></div>
                </div>

                <div className={styles.heroContent}>
                    <div className={styles.heroBadge}>Sứ mệnh của chúng tôi</div>
                    <h1 className={styles.heroTitle}>
                        HireGen – Cầu nối tri thức IT Việt Nam &<br />
                        <span className={styles.accentText}>Tiêu chuẩn Nhật Bản</span>
                    </h1>
                    <p className={styles.heroDesc}>
                        Được xây dựng với tầm nhìn tối ưu hóa luồng dịch chuyển nhân lực chất lượng cao, HireGen là nền tảng tuyển dụng chuyên sâu (Agency/Headhunt) ứng dụng Trí tuệ nhân tạo (AI). Chúng tôi đồng hành cùng các kỹ sư công nghệ thông tin Việt Nam vượt qua rào cản ngôn ngữ, định vị năng lực chuẩn xác theo thang đo ITSS, và tiếp cận những cơ hội nghề nghiệp xứng tầm tại thị trường Nhật Bản.
                    </p>
                </div>
            </section>

            {/* ── KHỐI 2: CÂU CHUYÊN PHÁT TRIỂN (Dấu ấn Đồ án tốt nghiệp) ── */}
            <section className={styles.storySection}>
                <div className={styles.storyContainer}>
                    <div className={styles.storyVisual}>
                        {/* Khối hình ảnh thể hiện dấu ấn HUST & Tác giả */}
                        <div className={styles.visualCard}>
                            <img
                                src="https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&w=800&q=80"
                                alt="Quoc Bao Researching"
                                className={styles.authorImg}
                            />
                            <div className={styles.universityBadge}>
                                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>school</span>
                                <div>
                                    <strong>Đại học Bách Khoa Hà Nội (HUST)</strong>
                                    <span>Đồ án tốt nghiệp Cử nhân</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className={styles.storyTextContent}>
                        <span className={styles.subLabel}>Câu chuyện phát triển</span>
                        <h2 className={styles.sectionTitle}>Khởi nguồn từ một Đồ án tốt nghiệp đầy tâm huyết</h2>
                        <p className={styles.paragraph}>
                            HireGen không chỉ là một giải pháp thương mại, mà còn là kết tinh từ quá trình nghiên cứu chuyên sâu trong Đồ án tốt nghiệp của tác giả <strong>Vũ Quốc Bảo</strong>. Nhận thấy thực trạng hàng ngàn kỹ sư IT Việt Nam cực kỳ xuất sắc về kỹ thuật (Hard Skills) nhưng lại gặp khó khăn khi làm CV khớp với tiêu chuẩn khắt khe của doanh nghiệp Nhật, ý tưởng về HireGen đã ra đời.
                        </p>
                        <p className={styles.paragraph}>
                            Hệ thống được kiến trúc và phát triển độc lập từ khâu phân tích cơ sở dữ liệu, tích hợp AI Prompt Engineering để bóc tách hồ sơ thông minh, cho đến việc xây dựng trải nghiệm giao diện người dùng (UI/UX) tối giản, tinh tế theo đúng triết lý làm việc của người Nhật.
                        </p>
                    </div>
                </div>
            </section>

            {/* ── KHỐI 3: GIÁ TRỊ CỐT LÕI (Core Features Grid) ── */}
            <section className={styles.featuresSection}>
                <div className={styles.featuresContainer}>
                    <div className={styles.featuresHeader}>
                        <h2 className={styles.centerTitle}>Giá trị cốt lõi & Năng lực hệ thống</h2>
                        <p className={styles.centerSub}>Kiến trúc nền tảng chuyên biệt tối ưu hóa cho thị trường tuyển dụng khắt khe</p>
                    </div>

                    <div className={styles.featuresGrid}>
                        <div className={styles.featureCard}>
                            <div className={styles.iconBox} style={{ background: '#eef4fc', color: '#1e4076' }}>
                                <span className="material-symbols-outlined">auto_awesome</span>
                            </div>
                            <h3>AI-Powered Matching (Phân tích thông minh)</h3>
                            <p>
                                Ứng dụng AI để tự động đọc hiểu, trích xuất dữ liệu từ CV (PDF) và chấm điểm tương quan (Match Score) dựa trên các trọng số kỹ thuật, giúp ứng viên lọt vào mắt xanh của nhà tuyển dụng.
                            </p>
                        </div>

                        <div className={styles.featureCard}>
                            <div className={styles.iconBox} style={{ background: '#f0fdfa', color: '#0f6e68' }}>
                                <span className="material-symbols-outlined">schema</span>
                            </div>
                            <h3>Chuẩn hóa ITSS (Tiêu chuẩn quốc gia Nhật Bản)</h3>
                            <p>
                                Toàn bộ hệ thống kỹ năng được quy hoạch chặt chẽ theo 6 nhóm ngành kỹ thuật cốt lõi và thang đo 7 cấp độ (Skill Levels) do IPA Nhật Bản quy định.
                            </p>
                        </div>

                        <div className={styles.featureCard}>
                            <div className={styles.iconBox} style={{ background: '#f5f3ff', color: '#5b21b6' }}>
                                <span className="material-symbols-outlined">handshake</span>
                            </div>
                            <h3>Mô hình Agency Tận tâm (Human Touch)</h3>
                            <p>
                                Không dừng lại ở việc "đẩy" CV tự động, HireGen hoạt động theo mô hình Agency/Headhunt đồng hành 1-1, hỗ trợ ứng viên phân tích lỗ hổng năng lực (Gap Analysis) và chuẩn bị kỹ năng phỏng vấn thực chiến.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── KHỐI 4: LỜI TRI ÂN & CTA FOOTER ── */}
            <section className={styles.thanksCtaSection}>
                <div className={styles.thanksCtaBox}>
                    <div className={styles.thanksContent}>
                        <h2>Lời tri ân</h2>
                        <p>
                            Từ một ý tưởng trong môi trường đại học, HireGen đã từng bước 
                            được hoàn thiện nhờ sự đồng hành và định hướng tận tâm từ TS. Nguyễn Kiêm Hiếu 
                            và Hội đồng chuyên môn. Những đóng góp ấy chính là nền tảng để dự án phát triển 
                            thành một hệ thống mang tính ứng dụng thực tế.
                        </p>
                        <div className={styles.divider}></div>
                        <h3>Bạn đã sẵn sàng để nâng tầm sự nghiệp IT của mình tại thị trường Nhật Bản?</h3>
                        <Button
                            type="primary"
                            size="large"
                            className={styles.btnActionLarge}
                            onClick={() => navigate('/register')}
                        >
                            Đăng tải CV của bạn ngay
                        </Button>
                    </div>
                </div>
            </section>

            <Footer />
        </div>
    );
};

export default AboutUs;