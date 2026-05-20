import React from 'react';
import Header from '../../components/layouts/Header';
import Footer from '../../components/layouts/Footer';
import styles from './Terms.module.css';

const Terms: React.FC = () => {
    return (
        <div className={styles.layoutContainer}>
            <Header />

            {/* ── HEADER PHÁP LÝ ── */}
            <header className={styles.headerBlock}>
                <div className={styles.headerInner}>
                    <h1>Điều khoản sử dụng & Chính sách dữ liệu</h1>
                    <p>Cập nhật lần cuối: Tháng 5, 2026</p>
                </div>
            </header>

            {/* ── NỘI DUNG ĐIỀU KHOẢN ── */}
            <main className={styles.contentMain}>
                <div className={styles.paperCard}>
                    <p className={styles.metaText}>
                        Vui lòng đọc kỹ các điều khoản dưới đây trước khi sử dụng HireGen.
                        Việc tiếp tục sử dụng hệ thống đồng nghĩa với việc bạn đã hiểu và đồng ý
                        với phạm vi dịch vụ, cách xử lý dữ liệu và trách nhiệm của các bên liên quan.
                    </p>

                    <section className={styles.termSection}>
                        <h2>
                            1. Mục đích và phạm vi dịch vụ
                        </h2>
                        <p>
                            HireGen là nền tảng hỗ trợ tuyển dụng theo mô hình Agency/Headhunt,
                            cung cấp các công cụ tạo lập hồ sơ, phân tích năng lực ứng viên bằng
                            Trí tuệ nhân tạo (AI) và hỗ trợ kết nối ứng viên với các cơ hội việc làm
                            trong lĩnh vực IT tại thị trường Nhật Bản.
                        </p>
                        <p>
                            Các tính năng dành cho ứng viên được cung cấp miễn phí trong phạm vi hệ thống,
                            bao gồm tạo hồ sơ cá nhân, tải lên CV, ứng tuyển công việc và nhận hỗ trợ
                            trong quá trình kết nối tuyển dụng.
                        </p>
                    </section>

                    <section className={styles.termSection}>
                        <h2>
                            2. Quyền riêng tư và xử lý dữ liệu bằng AI
                        </h2>

                        <p>
                            Khi ứng viên tải lên CV hoặc cung cấp thông tin hồ sơ, HireGen có thể sử dụng
                            các công cụ AI để hỗ trợ trích xuất, phân tích và chuẩn hóa dữ liệu như kỹ năng,
                            học vấn, kinh nghiệm làm việc, chứng chỉ và thông tin nghề nghiệp liên quan.
                        </p>

                        <div className={styles.highlightCallout}>
                            <p>
                                <strong>Mục đích xử lý dữ liệu:</strong> Dữ liệu được xử lý nhằm phục vụ
                                các chức năng của hệ thống như tạo hồ sơ số, gợi ý việc làm, tính toán
                                mức độ phù hợp với vị trí tuyển dụng và hỗ trợ quy trình tuyển dụng.
                            </p>
                            <p>
                                <strong>Cam kết bảo mật:</strong> Dữ liệu CV và thông tin cá nhân của ứng viên
                                chỉ được sử dụng trong phạm vi hoạt động của HireGen. Chúng tôi không sử dụng
                                dữ liệu CV của bạn để huấn luyện các mô hình AI công cộng bên ngoài.
                            </p>
                        </div>

                        <p>
                            Do quá trình phân tích bằng AI có thể phát sinh sai lệch trong một số trường hợp,
                            ứng viên có trách nhiệm kiểm tra lại thông tin đã được hệ thống trích xuất trước
                            khi sử dụng hồ sơ để ứng tuyển.
                        </p>
                    </section>

                    <section className={styles.termSection}>
                        <h2>
                            3. Quy trình chia sẻ hồ sơ dựa trên sự đồng ý
                        </h2>
                        <p>
                            HireGen tôn trọng quyền kiểm soát dữ liệu của ứng viên. CV gốc, thông tin liên hệ
                            cá nhân và các dữ liệu nhạy cảm liên quan đến hồ sơ ứng tuyển chỉ được chia sẻ với
                            doanh nghiệp tuyển dụng trong các trường hợp sau:
                        </p>

                        <ul className={styles.bulletList}>
                            <li>
                                Ứng viên chủ động nhấn nút <strong>Ứng tuyển</strong> vào một vị trí cụ thể
                                trên hệ thống.
                            </li>
                            <li>
                                Ứng viên xác nhận đồng ý chia sẻ hồ sơ thông qua trao đổi trực tiếp với
                                chuyên viên tư vấn hoặc nhân sự phụ trách của HireGen.
                            </li>
                            <li>
                                Việc chia sẻ hồ sơ là cần thiết để phục vụ đúng mục đích tuyển dụng mà ứng viên
                                đã lựa chọn hoặc đồng ý tham gia.
                            </li>
                        </ul>
                    </section>

                    <section className={styles.termSection}>
                        <h2>
                            4. Trách nhiệm của ứng viên
                        </h2>
                        <p>
                            Ứng viên có trách nhiệm đảm bảo tính chính xác, trung thực và cập nhật của các thông tin
                            được cung cấp trên hệ thống HireGen.
                        </p>

                        <ul className={styles.bulletList}>
                            <li>
                                Cung cấp thông tin đúng sự thật về học vấn, kinh nghiệm làm việc, kỹ năng chuyên môn,
                                dự án đã tham gia và chứng chỉ liên quan.
                            </li>
                            <li>
                                Không đăng tải hoặc sử dụng CV, tài liệu, chứng chỉ, thông tin cá nhân giả mạo
                                hoặc thuộc về người khác.
                            </li>
                            <li>
                                Tuân thủ quy trình trao đổi, phỏng vấn và phản hồi thông tin theo hướng dẫn của HireGen
                                trong quá trình ứng tuyển.
                            </li>
                        </ul>
                    </section>

                    <section className={styles.termSection}>
                        <h2>
                            5. Giới hạn trách nhiệm và phạm vi thử nghiệm
                        </h2>
                        <p>
                            HireGen hiện là phiên bản sản phẩm được phát triển trong phạm vi Đồ án tốt nghiệp,
                            do đó một số chức năng kết nối doanh nghiệp, xử lý dữ liệu hoặc quy trình tuyển dụng
                            có thể được mô phỏng trong môi trường thử nghiệm.
                        </p>
                        <p>
                            HireGen đóng vai trò là nền tảng hỗ trợ và cầu nối tư vấn. Quyết định tuyển dụng,
                            ký kết hợp đồng lao động, mức lương, điều kiện làm việc và các thỏa thuận liên quan
                            hoàn toàn thuộc về ứng viên và doanh nghiệp tuyển dụng.
                        </p>
                        <p>
                            Các kết quả phân tích, gợi ý việc làm hoặc điểm đánh giá mức độ phù hợp do hệ thống cung cấp
                            chỉ mang tính chất tham khảo và không được xem là cam kết tuyển dụng chính thức.
                        </p>
                    </section>

                    <section className={styles.termSection}>
                        <h2>
                            6. Liên hệ hỗ trợ
                        </h2>
                        <p>
                            Nếu có câu hỏi liên quan đến điều khoản sử dụng, chính sách dữ liệu hoặc cách hệ thống
                            xử lý hồ sơ ứng viên, bạn có thể liên hệ với đội ngũ HireGen để được hỗ trợ và giải thích
                            rõ hơn.
                        </p>
                    </section>

                    <div className={styles.finalNote}>
                        <p>
                            Bằng việc sử dụng HireGen, bạn xác nhận rằng mình đã đọc, hiểu và đồng ý với các điều khoản
                            được trình bày trên trang này.
                        </p>
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
};

export default Terms;