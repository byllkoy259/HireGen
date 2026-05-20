import React, { useEffect, useState } from 'react';
import { Form, Input, Button, App } from 'antd';
import { useNavigate } from 'react-router-dom';
import axiosClient from '../../services/axiosClient';
import Logo from '../../components/common/Logo';
import { getValidDashboardPath } from '../../utils/auth';

import styles from './Login.module.css';

const Login: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [form] = Form.useForm();
    const navigate = useNavigate();
    const { message } = App.useApp();

    useEffect(() => {
        const dashboardPath = getValidDashboardPath();
        if (dashboardPath) navigate(dashboardPath, { replace: true });
    }, [navigate]);

    const onFinish = async (values: any) => {
        setLoading(true);
        try {
            const formData = new URLSearchParams();
            formData.append('username', values.username);
            formData.append('password', values.password);

            const response = await axiosClient.post('/api/auth/login', formData, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            });

            localStorage.setItem('access_token', response.data.access_token);
            const role = response.data.user_info.role;
            localStorage.setItem('user_role', role);
            message.success('Đăng nhập thành công!');
            if (role === 'HR') {
                navigate('/hr');
            } else if (role === 'Admin') {
                navigate('/admin');
            } else {
                navigate('/candidate');
            }
        } catch (error: any) {
            const statusCode = error.response?.status;
            const errorDetail = error.response?.data?.detail;

            if (statusCode === 401) {
                form.setFields([
                    {
                        name: 'username',
                        errors: [''],
                    },
                    {
                        name: 'password',
                        errors: ['Email hoặc mật khẩu không chính xác!'],
                    },
                ]);
            } else if (!error.response) {
                message.error('Không thể kết nối đến máy chủ. Vui lòng thử lại!');
            } else {
                message.error(errorDetail || 'Đăng nhập thất bại. Vui lòng kiểm tra lại!');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className={styles.layout}>
            <section className={styles.brandSide}>
                <div className={styles.brandPattern}></div>
                <Logo size="lg" variant="light" />
                <div className={styles.brandFooter}>
                    © 2026 HireGen. Giải pháp tuyển dụng hàng đầu.
                </div>
            </section>

            <section className={styles.formSide}>
                <div className={styles.formWrapper}>
                    <div className={styles.mobileBrand}>
                        <Logo size="sm" variant="light" />
                    </div>

                    <div className={styles.formHeader}>
                        <h2 className={styles.formTitle}>Đăng nhập</h2>
                        <p className={styles.formSubtitle}>Chào mừng bạn quay trở lại với HireGen.</p>
                    </div>

                    <Form
                        form={form}
                        name="login_form"
                        onFinish={onFinish}
                        layout="vertical"
                        requiredMark={false}
                        className={styles.antdForm}
                    >
                        <Form.Item
                            label={<span className={styles.inputLabel}>Email</span>}
                            name="username"
                            rules={[
                                { required: true, message: 'Vui lòng nhập email!' },
                                { type: 'email', message: 'Email không đúng định dạng!' },
                            ]}
                        >
                            <Input
                                className={styles.customInput}
                                placeholder="Nhập email của bạn"
                                // ✅ Xoá lỗi khi người dùng bắt đầu nhập lại
                                onChange={() => form.setFields([{ name: 'username', errors: [] }])}
                            />
                        </Form.Item>

                        <Form.Item
                            label={<span className={styles.inputLabel}>Mật khẩu</span>}
                            name="password"
                            rules={[
                                { required: true, message: 'Vui lòng nhập mật khẩu!' },
                                { min: 8, message: 'Mật khẩu phải có ít nhất 8 ký tự!' },
                            ]}
                            style={{ marginBottom: '8px' }}
                        >
                            <Input.Password
                                className={styles.customInput}
                                placeholder="Nhập mật khẩu"
                                // ✅ Xoá lỗi khi người dùng bắt đầu nhập lại
                                onChange={() => form.setFields([{ name: 'password', errors: [] }])}
                            />
                        </Form.Item>

                        <div className={styles.forgotPasswordWrapper}>
                            <a href="#" className={styles.forgotPasswordLink}>Quên mật khẩu?</a>
                        </div>

                        <Form.Item style={{ marginTop: '24px', marginBottom: 0 }}>
                            <Button
                                type="primary"
                                htmlType="submit"
                                block
                                loading={loading}
                                className={styles.submitBtn}
                            >
                                Đăng nhập
                            </Button>
                        </Form.Item>
                    </Form>

                    <div className={styles.registerSection}>
                        <p className={styles.registerText}>Bạn chưa có tài khoản?</p>
                        <Button block className={styles.registerBtn} onClick={() => navigate('/register')}>
                            Đăng ký
                        </Button>
                    </div>

                    <div className={styles.footerLinks}>
                        <div className={styles.footerLinksLeft}>
                            <a href="#">Trợ giúp</a>
                            <a href="#">Bảo mật</a>
                            <a href="#">Điều khoản</a>
                        </div>
                        <div className={styles.footerLanguage}>
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>language</span>
                            <span>Tiếng Việt</span>
                        </div>
                    </div>
                </div>
            </section>
        </main>
    );
};

export default Login;
