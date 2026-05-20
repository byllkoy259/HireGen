
import re
with open('src/pages/public/PublicJobs.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

text = re.sub(r'/\* Phân rã van b?n.*?\n};\n', '', text, flags=re.DOTALL)

header = '''import styles from './PublicJobs.module.css';

/* Phân rã van b?n thành các g?ch d?u dòng chi ti?t */
const formatDescLines = (desc?: string): string[] => {
    if (!desc) return ['Chua có thông tin c?p nh?t.'];
    return desc
        .split('\\n')
        .filter(line => line.trim() !== '')
        .map(line => line.replace(/^[-•]\s*/, '').trim());
};
'''
text = text.replace('import styles from \'' + './PublicJobs.module.css\';', header)

with open('src/pages/public/PublicJobs.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

