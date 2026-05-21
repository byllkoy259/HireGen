import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import styles from './PublicProfile.module.css';
import axiosClient from '../../services/axiosClient';

const PublicProfile: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const res = await axiosClient.get(`/api/candidate/public/${id}`);
                setProfile(res.data);
            } catch (error) {
                console.error('Lỗi khi tải hồ sơ', error);
            } finally {
                setLoading(false);
            }
        };

        if (id) fetchProfile();
    }, [id]);

    if (loading) {
        return <div className={styles.loading}>Đang tải hồ sơ...</div>;
    }

    if (!profile) {
        return (
            <div className={styles.error}>
                404 - Không tìm thấy hồ sơ hoặc hồ sơ không tồn tại.
            </div>
        );
    }

    // Hàm gọi in PDF trình duyệt
    const handleDownloadPdf = () => {
        window.print();
    };

    const formatDesc = (desc: string) => {
        if (!desc) return null;
        return desc
            .split('\n')
            .filter((line) => line.trim() !== '')
            .map((line, idx) => (
                <li key={idx}>
                    {line.replace(/^[-•]\s*/, '')}
                </li>
            ));
    };

    // Hàm lược bỏ https:// và www. cho URL hiển thị đẹp hơn
    const cleanUrl = (url: string) => {
        if (!url) return '';
        return url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
    };

    const getPeriodText = (item: any) => {
        if (item?.period) return item.period;
        if (item?.duration) return item.duration;
        if (item?.start_date && item?.end_date) return `${item.start_date} - ${item.end_date}`;
        return item?.end_date || item?.start_date || '';
    };

    const normalizeSkillText = (value?: string | string[]) => {
        if (Array.isArray(value)) return value.filter(Boolean).join(', ');
        return value || '';
    };

    const splitTechText = (value?: string | string[]) => normalizeSkillText(value)
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);

    return (
        <div className={styles.page}>
            {/* Thanh công cụ (Sẽ bị ẩn khi in ra PDF) */}
            <div className={styles.topBar}>
                <button className={styles.btnDownload} onClick={handleDownloadPdf}>
                    <span className="material-symbols-outlined">download</span>
                    Tải CV (PDF)
                </button>
            </div>

            {/* Khung Resume (Trang giấy A4) */}
            <div className={styles.resumeDocument}>
                
                {/* HEADER */}
                <header className={styles.header}>
                    <h1 className={styles.name}>{profile.full_name}</h1>
                    <div className={styles.contactInfo}>
                        {[
                            profile.address,
                            profile.user?.email,
                            profile.phone,
                            profile.linkedin_url ? cleanUrl(profile.linkedin_url) : '',
                            profile.github_url ? cleanUrl(profile.github_url) : '',
                            profile.portfolio_url ? cleanUrl(profile.portfolio_url) : ''
                        ]
                            .filter(Boolean)
                            .map((item, index, array) => (
                                <React.Fragment key={index}>
                                    <span>{item}</span>
                                    {index < array.length - 1 && <span className={styles.separator}>|</span>}
                                </React.Fragment>
                            ))}
                    </div>
                </header>

                {/* EDUCATION */}
                {profile.education?.length > 0 && (
                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>EDUCATION</h2>
                        {profile.education.map((edu: any, idx: number) => (
                            <div key={idx} className={styles.itemBlock}>
                                <div className={styles.row}>
                                    {/* Dùng school_name và end_date */}
                                    <strong>{edu.school_name}</strong> 
                                    <span>{edu.end_date}</span>
                                </div>
                                <div className={styles.row}>
                                    {/* Dùng major */}
                                    <i>{edu.major}</i> 
                                </div>
                                {/* Dùng description */}
                                {edu.description && ( 
                                    <ul className={styles.bulletList}>
                                        {formatDesc(edu.description)}
                                    </ul>
                                )}
                            </div>
                        ))}
                    </section>
                )}

                {/* WORK EXPERIENCE */}
                {profile.work_experience?.length > 0 && (
                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>EXPERIENCE</h2>
                        {profile.work_experience.map((exp: any, idx: number) => (
                            <div key={idx} className={styles.itemBlock}>
                                <div className={styles.row}>
                                    {/* Dùng company_name và end_date */}
                                    <strong>{exp.company_name}</strong>
                                    <span>{getPeriodText(exp)}</span>
                                </div>
                                <div className={styles.row}>
                                    {/* Dùng position */}
                                    <i>{exp.position}</i>
                                </div>
                                {splitTechText(exp.technologies || exp.skills).length > 0 && (
                                    <div className={styles.techLine}>
                                        <strong>Technologies:</strong> {splitTechText(exp.technologies || exp.skills).join(', ')}
                                    </div>
                                )}
                                {exp.description && (
                                    <ul className={styles.bulletList}>
                                        {formatDesc(exp.description)}
                                    </ul>
                                )}
                            </div>
                        ))}
                    </section>
                )}

                {/* PROJECTS */}
                {profile.projects?.length > 0 && (
                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>PROJECTS</h2>
                        {profile.projects.map((proj: any, idx: number) => (
                            <div key={idx} className={styles.itemBlock}>
                                <div className={styles.row}>
                                    {/* Dùng project_name */}
                                    <strong>{proj.project_name}</strong>
                                    <span>{getPeriodText(proj)}</span>
                                </div>
                                <div className={styles.row}>
                                    <i>{proj.role}</i>
                                </div>
                                {splitTechText(proj.technologies || proj.skills).length > 0 && (
                                    <div className={styles.techLine}>
                                        <strong>Technologies:</strong> {splitTechText(proj.technologies || proj.skills).join(', ')}
                                    </div>
                                )}
                                {proj.description && (
                                    <ul className={styles.bulletList}>
                                        {formatDesc(proj.description)}
                                    </ul>
                                )}
                            </div>
                        ))}
                    </section>
                )}

                {/* SKILLS */}
                {(profile.tech_skills?.length > 0 || profile.soft_skills?.length > 0) && (
                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>SKILLS</h2>
                        <div className={styles.itemBlock}>
                            {profile.tech_skills?.length > 0 && (
                                <div className={styles.skillLine}>
                                    <strong>Technical Skills:</strong> {profile.tech_skills.join(', ')}
                                </div>
                            )}
                            {profile.soft_skills?.length > 0 && (
                                <div className={styles.skillLine}>
                                    <strong>Soft Skills:</strong> {profile.soft_skills.join(', ')}
                                </div>
                            )}
                        </div>
                    </section>
                )}

                {/* CERTIFICATIONS */}
                {profile.certifications?.length > 0 && (
                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>CERTIFICATIONS</h2>
                        {profile.certifications.map((cert: any, idx: number) => (
                            <div key={idx} className={styles.itemBlock}>
                                <div className={styles.row}>
                                    <div>
                                        <strong>{cert.name}</strong>
                                        {/* Dùng issuer */}
                                        {cert.issuer && <i>, {cert.issuer}</i>} 
                                    </div>
                                    {/* Dùng year */}
                                    <span>{cert.year}</span> 
                                </div>
                            </div>
                        ))}
                    </section>
                )}

            </div>
        </div>
    );
};

export default PublicProfile;
