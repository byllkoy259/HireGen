import React, { useEffect, useState } from 'react';
import { Form, Input, Button, App, Divider } from 'antd';
import { useNavigate } from 'react-router-dom';
import axiosClient from '../../services/axiosClient';
import Logo from '../../components/common/Logo';
import { getValidDashboardPath } from '../../utils/auth';

import styles from './Register.module.css';

const Register: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [form] = Form.useForm();
    const navigate = useNavigate();
    const { message } = App.useApp(); // ✅ Dùng hook thay vì import static

    useEffect(() => {
        const dashboardPath = getValidDashboardPath();
        if (dashboardPath) navigate(dashboardPath, { replace: true });
    }, [navigate]);

    const onFinish = async (values: any) => {
        setLoading(true);
        try {
            await axiosClient.post('/api/auth/register', {
                full_name: values.full_name,
                email: values.email,
                password: values.password,
                confirm_password: values.confirm_password
            });

            message.success('Đăng ký tài khoản thành công! Vui lòng đăng nhập.');
            navigate('/login');
        } catch (error: any) {
            const status = error.response?.status;
            const errorDetail = error.response?.data?.detail;

            if (status === 409 || (typeof errorDetail === 'string' && errorDetail.toLowerCase().includes('email'))) {
                // ✅ Email đã tồn tại — hiện lỗi ngay trên field
                form.setFields([
                    { name: 'email', errors: [errorDetail || 'Email này đã được đăng ký!'] }
                ]);
            } else if (!error.response) {
                // ✅ Lỗi mạng
                message.error('Không thể kết nối đến máy chủ. Vui lòng thử lại!');
            } else {
                message.error(errorDetail || 'Đăng ký thất bại. Vui lòng kiểm tra lại thông tin!');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className={styles.layout}>
            {/* Left Side: Brand Identity (40% width) */}
            <section className={styles.brandSide}>
                <div className={styles.brandPattern}></div>
                
                <Logo size="lg" variant="light" />

                <div className={styles.brandFooter}>
                    © 2026 HireGen. Giải pháp tuyển dụng hàng đầu.
                </div>
            </section>

            {/* Right Side: Register Form (60% width) */}
            <section className={styles.formSide}>
                <div className={styles.formWrapper}>
                    
                    {/* Mobile Branding */}
                    <div className={styles.mobileBrand}>
                        <Logo size="sm" variant="dark" />
                    </div>

                    <div className={styles.formHeader}>
                        <h2 className={styles.formTitle}>Đăng ký</h2>
                        <p className={styles.formSubtitle}>Tạo tài khoản để bắt đầu trải nghiệm HireGen.</p>
                    </div>

                    <Form
                        form={form} // ✅ Gắn form instance để setFields hoạt động
                        name="register_form"
                        onFinish={onFinish}
                        layout="vertical"
                        requiredMark={false}
                        className={styles.antdForm}
                    >
                        <Form.Item
                            label={<span className={styles.inputLabel}>Họ và tên</span>}
                            name="full_name"
                            rules={[{ required: true, message: 'Vui lòng nhập họ và tên!' }]}
                            style={{ marginBottom: '16px' }}
                        >
                            <Input className={styles.customInput} placeholder="Nhập họ tên của bạn" />
                        </Form.Item>

                        <Form.Item
                            label={<span className={styles.inputLabel}>Email</span>}
                            name="email"
                            rules={[
                                { required: true, message: 'Vui lòng nhập email!' },
                                { type: 'email', message: 'Email không đúng định dạng!' }
                            ]}
                            style={{ marginBottom: '16px' }}
                        >
                            <Input
                                className={styles.customInput}
                                placeholder="Nhập email của bạn"
                                // ✅ Xoá lỗi khi người dùng sửa lại email
                                onChange={() => form.setFields([{ name: 'email', errors: [] }])}
                            />
                        </Form.Item>

                        <Form.Item
                            label={<span className={styles.inputLabel}>Mật khẩu</span>}
                            name="password"
                            rules={[
                                { required: true, message: 'Vui lòng nhập mật khẩu!' },
                                { min: 8, message: 'Mật khẩu phải có ít nhất 8 ký tự!' }
                            ]}
                            style={{ marginBottom: '16px' }}
                        >
                            <Input.Password className={styles.customInput} placeholder="Tạo mật khẩu (tối thiểu 8 ký tự)" />
                        </Form.Item>

                        <Form.Item
                            label={<span className={styles.inputLabel}>Xác nhận mật khẩu</span>}
                            name="confirm_password"
                            dependencies={['password']}
                            rules={[
                                { required: true, message: 'Vui lòng xác nhận lại mật khẩu!' },
                                ({ getFieldValue }) => ({
                                    validator(_, value) {
                                        if (!value || getFieldValue('password') === value) {
                                            return Promise.resolve();
                                        }
                                        return Promise.reject(new Error('Mật khẩu xác nhận không khớp!'));
                                    },
                                }),
                            ]}
                            style={{ marginBottom: '8px' }}
                        >
                            <Input.Password className={styles.customInput} placeholder="Nhập lại mật khẩu" />
                        </Form.Item>

                        <div className={styles.loginPromptWrapper}>
                            <span onClick={() => navigate('/login')} className={styles.actionLink} style={{ cursor: 'pointer' }}>
                                Bạn đã có tài khoản?
                            </span>
                        </div>

                        <Form.Item style={{ marginTop: '24px', marginBottom: 0 }}>
                            <Button
                                type="primary"
                                htmlType="submit"
                                block
                                loading={loading}
                                className={styles.submitBtn}
                            >
                                Đăng ký
                            </Button>
                        </Form.Item>
                    </Form>

                    <Divider plain className={styles.dividerText}>Hoặc đăng ký bằng</Divider>

                    <Button block className={styles.googleBtn}>
                        <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
                            <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
                                <path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z"/>
                                <path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z"/>
                                <path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z"/>
                                <path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 41.939 C -8.804 40.009 -11.514 38.989 -14.754 38.989 C -19.444 38.989 -23.494 41.689 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z"/>
                            </g>
                        </svg>
                        <span>Đăng ký bằng Google</span>
                    </Button>

                    <div className={styles.termsSection}>
                        Bằng cách đăng ký, bạn đồng ý với <a href="#">Điều khoản Dịch vụ</a> và <a href="#">Chính sách Bảo mật</a> của chúng tôi.
                    </div>
                </div>
            </section>
        </main>
    );
};

export default Register;
