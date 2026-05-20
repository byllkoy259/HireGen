import React from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from '../common/Logo';

import styles from './Footer.module.css';

const Footer: React.FC = () => {
    const navigate = useNavigate();

    return (
        <footer className={styles.footer}>
            <div className={styles.footerContainer}>
                <div className={styles.footerBrand}>
                    <Logo size="sm" variant="dark" />

                    <p>
                        HireGen là nền tảng tuyển dụng IT hàng đầu dành cho thị trường Nhật Bản,
                        kết nối nhân tài Việt với những cơ hội bứt phá sự nghiệp.
                    </p>
                </div>

                <div className={styles.footerCol}>
                    <h4>Ứng viên</h4>

                    <a
                        onClick={() => navigate('/jobs')}
                        style={{ cursor: 'pointer' }}
                    >
                        Tìm kiếm việc làm
                    </a>

                    <a
                        onClick={() => navigate('/login?redirect=candidate/profile')}
                        style={{ cursor: 'pointer' }}
                    >
                        Tạo hồ sơ
                    </a>

                    <a
                        onClick={() => navigate('/guide')}
                        style={{ cursor: 'pointer' }}
                    >
                        Cẩm nang IT Nhật
                    </a>
                </div>

                <div className={styles.footerCol}>
                    <h4>Nhà tuyển dụng</h4>

                    <a
                        onClick={() => navigate('/login?redirect=hr/jobs')}
                        style={{ cursor: 'pointer' }}
                    >
                        Đăng tin tuyển dụng
                    </a>

                    <a
                        onClick={() => navigate('/login?redirect=hr/candidates')}
                        style={{ cursor: 'pointer' }}
                    >
                        Tìm kiếm ứng viên
                    </a>

                    <a
                        onClick={() => navigate('/login?redirect=hr/companies')}
                        style={{ cursor: 'pointer' }}
                    >
                        Quản lý công ty
                    </a>
                </div>

                <div className={styles.footerCol}>
                    <h4>Hệ thống</h4>

                    <a
                        onClick={() => navigate('/about')}
                        style={{ cursor: 'pointer' }}
                    >
                        Về HireGen
                    </a>

                    <a
                        onClick={() => navigate('/terms')}
                        style={{ cursor: 'pointer' }}
                    >
                        Điều khoản
                    </a>

                    <a
                        onClick={() => navigate('/help')}
                        style={{ cursor: 'pointer' }}
                    >
                        Trung tâm hỗ trợ
                    </a>
                </div>
            </div>

            <div className={styles.footerBottom}>
                <p>© 2026 HireGen - Giải pháp tuyển dụng hàng đầu</p>
            </div>
        </footer>
    );
};

export default Footer;