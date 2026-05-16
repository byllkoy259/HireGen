import React from 'react';
import styles from './Logo.module.css';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'dark' | 'light';
}

const Logo: React.FC<LogoProps> = ({ size = 'md', variant = 'light' }) => {
  return (
    <div className={`${styles.logoWrapper} ${styles[size]} ${styles[variant]}`}>
      <div className={styles.iconBox}>
        <span className={styles.kanji}>採</span>
      </div>
      <span className={styles.brandName}>HireGen</span>
    </div>
  );
};

export default Logo;