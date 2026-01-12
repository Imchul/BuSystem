import fs from 'fs';

const categoryMap = {
    '01': 'finance',
    '02': 'education',
    '03': 'welfare',
    '04': 'culture',
    '05': 'environment',
    '06': 'industry',
    '07': 'transport',
    '08': 'agriculture',
    '09': 'defense',
    '10': 'safety'
};

const categoryNames = {
    '금융·재정·조세': '01',
    '교육·보육·가족': '02',
    '보건·복지·고용': '03',
    '문화·체육·관광': '04',
    '환경·에너지·기상': '05',
    '산업·중소기업': '06',
    '국토·교통': '07',
    '농림·수산·식품': '08',
    '국방·병무': '09',
    '행정·안전·질서': '10'
};

// Reverse map for later
const catIdToName = Object.entries(categoryNames).reduce((acc, [k, v]) => { acc[v] = k; return acc; }, {});
const catIdToEnglish = Object.entries(categoryMap).reduce((acc, [k, v]) => { acc[k] = v; return acc; }, {});

function parse() {
    const text = fs.readFileSync('policy_text_v3.txt', 'utf8');

    // Extract TOC Text (Pages 5 to 16)
    // We will join lines from these pages into one big string to handle the "one line per page" issue.

    let tocText = '';
    const lines = text.split('\n');
    let inToc = false;
    // Map of Page -> Content for later
    const pageContents = {};
    let currentPage = 0;

    for (const line of lines) {
        const pMatch = line.match(/--- Page (\d+) ---/);
        if (pMatch) {
            currentPage = parseInt(pMatch[1]);
            pageContents[currentPage] = "";
            if (currentPage >= 5 && currentPage <= 16) inToc = true;
            else inToc = false;
        } else if (currentPage > 0) {
            pageContents[currentPage] += line + "\n";
            if (inToc) tocText += line + "  "; // append with spaces
        }
    }

    // Now extract items from tocText
    const itemRegex = /([^\d]+?)\s+([가-힣]+부|[가-힣]+처|[가-힣]+청|[가-힣]+위원회|국가데이터처)\s+(\d{3})/g;

    let items = [];
    let match;
    let currentCategory = 'finance';

    while ((match = itemRegex.exec(tocText)) !== null) {
        let rawTitle = match[1].trim();
        const dept = match[2];
        const page = match[3];

        // Check for Category Header in rawTitle
        const catMatch = rawTitle.match(/(\d{2})\s+([가-힣·]+)/);
        if (catMatch) {
            const catId = catMatch[1];
            if (categoryMap[catId]) {
                currentCategory = categoryMap[catId];
                const split = rawTitle.split(catMatch[0]);
                if (split.length > 1) {
                    rawTitle = split[1].trim();
                } else {
                    if (!rawTitle) continue;
                }
            }
        }

        // Cleanup title
        let title = rawTitle;
        title = title.replace(/분야별 달라지는 주요 제도/g, '').trim();
        title = title.replace(/부처별 달라지는 주요 제도/g, '').trim();
        title = title.replace(/시기별 달라지는 주요 제도/g, '').trim();
        title = title.replace(/https?.*/g, '').trim();

        if (title.length < 2) continue;
        if (items.find(i => i.title === title)) continue;

        items.push({
            id: items.length + 1,
            title: title,
            category: currentCategory,
            department: dept,
            pageNumber: parseInt(page),
            description: '',
            ageGroups: ['all'],
            gender: 'all',
            keywords: []
        });
    }

    console.log(`Parsed ${items.length} items from TOC.`);

    // 2. Extract Description and Details
    for (let item of items) {
        let found = false;
        const targetPdfPage = item.pageNumber + 41;

        // Scan range
        for (let p = targetPdfPage - 5; p <= targetPdfPage + 5; p++) {
            const content = pageContents[p] || "";
            // Heuristic cleanup of content checks
            const searchContent = content.replace(/\s+/g, '');
            const searchTitle = item.title.replace(/\s+/g, '');

            if (searchContent.includes(searchTitle)) {
                // Formatting for Structured content
                const backgroundMatch = content.match(/추진배경\s+([\s\S]*?)(?=주요내용|시행일|$)/);
                const mainContentMatch = content.match(/주요내용\s+([\s\S]*?)(?=시행일|$)/);
                const enforcementMatch = content.match(/시행일\s+([\s\S]*?)(?=재정경제부|$)/); // Sometimes dept name follows

                let detailParts = [];
                let summaryLines = [];

                // 1. One-line Summary (Description)
                const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);

                // Find title index
                const titleIdx = lines.findIndex(l => l.replace(/\s+/g, '').includes(searchTitle.substring(0, 10)));

                if (titleIdx !== -1) {
                    // Look for summary in lines after title but before keywords like "추진배경"
                    for (let i = titleIdx + 1; i < lines.length; i++) {
                        const line = lines[i];
                        if (line.includes('추진배경') || line.includes('주요내용')) break;
                        // Skip metadata lines like "시행일: ..." or Department names or URLs
                        if (line.includes('시행일') || line.includes('자세한 내용은') || line.length < 5 || line.includes('www.')) continue;

                        summaryLines.push(line);
                    }
                }

                if (summaryLines.length > 0) {
                    item.description = summaryLines.join(' ');
                    if (item.description.length > 150) item.description = item.description.substring(0, 147) + '...';
                } else if (mainContentMatch) {
                    // Fallback: Use first sentence of main content
                    const firstSentence = mainContentMatch[1].trim().split('\n')[0];
                    item.description = firstSentence;
                } else {
                    item.description = "2026년부터 시행되는 새로운 정책입니다.";
                }

                // 2. Structured Detail
                if (backgroundMatch) detailParts.push(`### 📋 추진배경\n${backgroundMatch[1].trim()}`);
                if (mainContentMatch) detailParts.push(`### 💡 주요내용\n${mainContentMatch[1].trim()}`);
                if (enforcementMatch) detailParts.push(`### 📅 시행일\n${enforcementMatch[1].trim()}`);

                if (detailParts.length > 0) {
                    item.detail = detailParts.join('\n\n');
                } else {
                    // Fallback to raw content cleanup
                    item.detail = content.split('\n').filter(l => !l.includes('--- Page') && !l.includes('2026년부터 이렇게')).join('\n');
                }

                // Add related sites if found (URLs)
                const urls = content.match(/https?:\/\/[^\s]+/g);
                if (urls) {
                    const uniqueUrls = [...new Set(urls)];
                    item.relatedSites = uniqueUrls.map(u => ({ name: '관련 사이트', url: u }));
                }

                inferTags(item);
                found = true;
                break;
            }
        }
        if (!found) {
            item.description = "2026부터 시행되는 정책입니다.";
            item.detail = "상세 정보를 준비 중입니다.";
            inferTags(item);
        }
    }

    // 3. Generate TS
    const tsOutput = generateTS(items);
    fs.writeFileSync('src/data/policies.ts', tsOutput);
    console.log('Generated src/data/policies.ts');
}

function inferTags(item) {
    const text = (item.title + ' ' + item.description + ' ' + (item.detail || '')).toLowerCase();

    // Age Groups
    item.ageGroups = [];
    if (text.includes('영유아') || text.includes('어린이') || text.includes(' 0-6세')) item.ageGroups.push('infant');
    if (text.includes('아동') || text.includes('초등') || text.includes('학생')) item.ageGroups.push('child');
    if (text.includes('청소년') || text.includes('청년') || text.includes('대학생') || text.includes('중고생') || text.includes('고교생')) item.ageGroups.push('youth');
    if (text.includes('중장년') || text.includes('근로자') || text.includes('직장인') || text.includes('부부')) item.ageGroups.push('adult');
    if (text.includes('어르신') || text.includes('노인') || text.includes('고령자') || text.includes('연금')) item.ageGroups.push('senior');
    if (item.ageGroups.length === 0) item.ageGroups = ['all'];

    // Gender
    if (text.includes('여성') || text.includes('임산부') || text.includes('산모')) item.gender = 'female';
    else if (text.includes('남성') || text.includes('군인') || text.includes('장병') || text.includes('예비군')) item.gender = 'male';
    else item.gender = 'all';

    // Keywords - Expanded List
    const keywordDB = [
        '세제', '금융', '복지', '교육', '보육', '여성', '안전', '환경', '주거', '청년', '노인', '장애인',
        '농촌', '교통', '의료', '소상공인', '육아', '세금', '지원금', '장학금', '일자리', '창업', '주택',
        '대출', '금리', '저출산', '다자녀', '한부모', '군인', '예비군', '반려동물', '에너지', '친환경',
        '탄소', '디지털', 'AI', '데이터', '연구', '개발', '수출', '관세', '저작권', '문화', '예술',
        '체육', '관광', '양육', '출산', '건강', '보험', '카드', '공제', '장려금', '스마트', '투자', '부담', '완화'
    ];

    item.keywords = keywordDB.filter(k => text.includes(k.toLowerCase()));

    // Category specific fallback keywords
    const categoryKeywords = {
        'finance': ['경제', '재정', '자산', '투자', '소득'],
        'education': ['학교', '학습', '교원', '학생', '수업'],
        'welfare': ['사회', '복지', '지원', '생활', '돌봄'],
        'culture': ['문화', '예술', '체육', '관광', '여가'],
        'environment': ['환경', '탄소', '기후', '에너지', '생태'],
        'industry': ['기업', '산업', '기술', '혁신', '성장'],
        'transport': ['교통', '도로', '철도', '항공', '운전'],
        'agriculture': ['농업', '어업', '식품', '유통', '농촌'],
        'defense': ['국방', '병역', '군사', '안보', '보훈'],
        'safety': ['안전', '행정', '질서', '재난', '예방']
    };

    // Pad with Category Name and Department
    if (item.department && !item.keywords.includes(item.department)) item.keywords.push(item.department);
    const catName = catIdToName[item.category];
    if (catName && !item.keywords.includes(catName)) item.keywords.push(catName);

    // Pad with Category-specific generic terms until length >= 4
    const fallbacks = categoryKeywords[item.category] || [];
    for (const fb of fallbacks) {
        if (item.keywords.length >= 4) break;
        if (!item.keywords.includes(fb)) item.keywords.push(fb);
    }

    // Last resort if still < 4
    if (item.keywords.length < 4) {
        if (!item.keywords.includes('정책')) item.keywords.push('정책');
        if (!item.keywords.includes('2026')) item.keywords.push('2026');
    }

    // Ensure uniqueness again
    item.keywords = [...new Set(item.keywords)];
}

function generateTS(items) {
    return `export interface Policy {
  id: number;
  title: string;
  category: string;
  department: string;
  description: string;
  ageGroups: ('infant' | 'child' | 'youth' | 'adult' | 'senior' | 'all')[];
  gender: 'all' | 'male' | 'female';
  keywords: string[];
  pageNumber: number;
  detail?: string;
  relatedSites?: { name: string; url: string }[];
  imageUrl?: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export const categories: Category[] = [
  { id: 'finance', name: '금융·재정·조세', icon: '💰', color: '#3B82F6' },
  { id: 'education', name: '교육·보육·가족', icon: '📚', color: '#8B5CF6' },
  { id: 'welfare', name: '보건·복지·고용', icon: '🏥', color: '#EC4899' },
  { id: 'culture', name: '문화·체육·관광', icon: '🎭', color: '#F59E0B' },
  { id: 'environment', name: '환경·에너지·기상', icon: '🌿', color: '#10B981' },
  { id: 'industry', name: '산업·중소기업', icon: '🏭', color: '#6366F1' },
  { id: 'transport', name: '국토·교통', icon: '🚗', color: '#14B8A6' },
  { id: 'agriculture', name: '농림·수산·식품', icon: '🌾', color: '#713F12' }, 
  { id: 'defense', name: '국방·병무', icon: '🎖️', color: '#64748B' },
  { id: 'safety', name: '행정·안전·질서', icon: '🛡️', color: '#EF4444' },
];

export const ageGroupLabels = {
  infant: '영유아 (0-6세)',
  child: '아동 (7-12세)',
  youth: '청소년·청년 (13-34세)',
  adult: '중장년 (35-64세)',
  senior: '어르신 (65세 이상)',
  all: '전 연령',
};

export const policies: Policy[] = ${JSON.stringify(items, null, 2)};
`;
}

parse();
