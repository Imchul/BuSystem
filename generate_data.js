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

const catIdToName = Object.entries(categoryNames).reduce((acc, [k, v]) => { acc[v] = k; return acc; }, {});

function parse() {
    const text = fs.readFileSync('policy_text_v3.txt', 'utf8');

    // 1. Preprocess: Map Page Numbers to Content
    const pageContents = {};
    const lines = text.split('\n');
    let currentPage = 0;
    let tocText = '';

    for (const line of lines) {
        const pMatch = line.match(/--- Page (\d+) ---/);
        if (pMatch) {
            currentPage = parseInt(pMatch[1]);
            pageContents[currentPage] = "";
        } else if (currentPage > 0) {
            pageContents[currentPage] += line + "\n";
            // Accumulate TOC candidate text (approx range)
            if (currentPage >= 4 && currentPage <= 20) {
                tocText += line + "  ";
            }
        }
    }

    // 2. Parse Items from TOC with Strict Category State Machine
    let items = [];
    const categories = Object.keys(categoryMap).sort(); // 01, 02...

    // Create sections by finding header indices
    let catIndices = [];

    for (const catId of categories) {
        const namePart = catIdToName[catId].split('·')[0]; // First word e.g. "금융", "교육"
        const regex = new RegExp(`${catId}\\s+${namePart}`);
        const match = tocText.match(regex);
        if (match) {
            catIndices.push({ id: catId, index: match.index });
        }
    }
    catIndices.sort((a, b) => a.index - b.index);

    // Now process per block
    for (let i = 0; i < catIndices.length; i++) {
        const currentCat = catIndices[i];
        const nextCat = catIndices[i + 1];

        const start = currentCat.index;
        const end = nextCat ? nextCat.index : tocText.length;

        const blockText = tocText.substring(start, end);
        const currentCatId = categoryMap[currentCat.id];

        // Parse items in this block
        let match;
        const blockItemRegex = /([^\d]+?)\s+([가-힣]+부|[가-힣]+처|[가-힣]+청|[가-힣]+위원회|국가데이터처)\s+(\d{3})/g;

        while ((match = blockItemRegex.exec(blockText)) !== null) {
            let rawTitle = match[1].trim();
            const dept = match[2];
            const page = parseInt(match[3]);

            // Cleanup Title
            let title = rawTitle
                .replace(/^\d{2}\s+[가-힣·]+/, '')
                .replace(/분야별 달라지는 주요 제도/g, '')
                .replace(/https?:\/\/\S+/g, '')
                .trim();

            if (title.length < 2) continue;
            // Strict duplicate check: title AND page must match to be a dupe.
            // Actually, we trust the TOC list.
            if (items.find(x => x.title === title && x.pageNumber === page)) continue;

            items.push({
                id: items.length + 1,
                title: title,
                category: currentCatId,
                department: dept,
                pageNumber: page,
                description: '',
                ageGroups: [],
                gender: 'all',
                keywords: []
            });
        }
    }

    console.log(`Parsed ${items.length} items from TOC.`);

    // 3. Extract Details (HTML Format)
    for (let item of items) {
        let found = false;
        // Search offset logic
        const targetPdfPage = item.pageNumber + 41;

        // Scan range
        for (let p = targetPdfPage - 2; p <= targetPdfPage + 2; p++) {
            const content = pageContents[p] || "";
            // Check title match
            const cleanContent = content.replace(/\s+/g, '');
            const cleanTitle = item.title.replace(/\s+/g, '');

            if (cleanContent.includes(cleanTitle.substring(0, 15))) { // Partial match safe
                // Found page

                // Extract description (One-liner under title)
                const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
                const titleIdx = lines.findIndex(l => l.replace(/\s+/g, '').includes(cleanTitle.substring(0, 10)));

                let desc = "";
                if (titleIdx !== -1) {
                    for (let i = titleIdx + 1; i < lines.length; i++) {
                        const line = lines[i];
                        if (line.match(/(추진배경|주요내용|시행일)/)) break;
                        if (line.includes('www.') || line.includes('자세한 내용')) continue;
                        desc += line + " ";
                    }
                }
                item.description = desc.trim();
                if (!item.description) item.description = "2026년부터 달라지는 정책입니다.";
                if (item.description.length > 150) item.description = item.description.substring(0, 150) + "...";

                // Extract HTML Details
                let htmlParts = [];

                const backgroundMatch = content.match(/추진배경\s+([\s\S]*?)(?=주요내용|시행일|$)/);
                const mainContentMatch = content.match(/주요내용\s+([\s\S]*?)(?=시행일|$)/);
                const enforcementMatch = content.match(/시행일\s+([\s\S]*?)(?=재정경제부|[가-힣]+부|$)/);

                if (backgroundMatch) {
                    const text = backgroundMatch[1].trim().replace(/\n/g, '<br/>');
                    htmlParts.push(`<h3>📋 추진배경</h3><p>${text}</p>`);
                }
                if (mainContentMatch) {
                    const text = mainContentMatch[1].trim().replace(/\n/g, '<br/>');
                    htmlParts.push(`<h3>💡 주요내용</h3><p>${text}</p>`);
                }
                if (enforcementMatch) {
                    const text = enforcementMatch[1].trim().replace(/\n/g, '<br/>');
                    htmlParts.push(`<h3>📅 시행일</h3><p>${text}</p>`);
                }

                if (htmlParts.length > 0) {
                    item.detail = htmlParts.join('<br/><br/>');
                } else {
                    item.detail = `<p>${content}</p>`;
                }

                // Related Sites
                const urls = content.match(/https?:\/\/[^\s]+/g);
                if (urls) {
                    item.relatedSites = [...new Set(urls)].map(u => ({ name: '관련 사이트', url: u }));
                }

                inferTags(item);
                found = true;
                break;
            }
        }

        if (!found) {
            item.description = "2026년부터 시행되는 정책입니다.";
            item.detail = "<p>상세 정보를 준비 중입니다.</p>";
            inferTags(item);
        }
    }

    const tsOutput = generateTS(items);
    fs.writeFileSync('src/data/policies.ts', tsOutput);
    console.log('Generated src/data/policies.ts');
}

function inferTags(item) {
    const text = (item.title + ' ' + item.description).toLowerCase();

    // Age Groups - STRICT FILTERING LOGIC
    // If specific age keywords found, ONLY add that age group.
    // If NO specific age found, add 'all'.
    item.ageGroups = [];

    let isSpecific = false;
    if (text.includes('영유아') || text.includes('어린이') || text.includes(' 0-6세')) { item.ageGroups.push('infant'); isSpecific = true; }
    if (text.includes('아동') || text.includes('초등') || text.includes('학생')) { item.ageGroups.push('child'); isSpecific = true; }
    if (text.includes('청소년') || text.includes('청년') || text.includes('대학생') || text.includes('중고생')) { item.ageGroups.push('youth'); isSpecific = true; }
    if (text.includes('중장년') || text.includes('직장인')) { item.ageGroups.push('adult'); isSpecific = true; }
    if (text.includes('어르신') || text.includes('노인') || text.includes('고령자') || text.includes('연금')) { item.ageGroups.push('senior'); isSpecific = true; }

    if (!isSpecific) {
        item.ageGroups.push('all');
    }

    // Gender
    if (text.includes('여성') || text.includes('임산부') || text.includes('산모')) item.gender = 'female';
    else if (text.includes('남성') || text.includes('군인') || text.includes('장병')) item.gender = 'male';
    else item.gender = 'all';

    // Keywords (Ensure 4+)
    const keywordDB = [
        '세제', '금융', '복지', '교육', '보육', '여성', '안전', '환경', '주거', '청년', '노인', '장애인',
        '농촌', '교통', '의료', '소상공인', '육아', '세금', '지원금', '장학금', '일자리', '창업', '주택',
        '대출', '금리', '저출산', '다자녀', '한부모', '군인', '예비군', '에너지', '친환경',
        '탄소', '디지털', 'AI', '데이터', '연구', '개발', '수출', '관세', '저작권', '문화', '예술',
        '체육', '관광', '양육', '출산', '건강', '보험', '카드', '공제', '투자', '부담', '완화'
    ];

    item.keywords = keywordDB.filter(k => text.includes(k.toLowerCase()));

    // Category Fallbacks
    if (item.department) item.keywords.push(item.department);
    item.keywords.push(catIdToName[item.category] || '기타');

    const catKeywords = {
        'finance': ['경제', '재정', '자산'],
        'education': ['학교', '학습', '수업'],
        'welfare': ['사회', '복지', '생활'],
        'culture': ['문화', '여가'],
        'environment': ['기후', '생태'],
        'industry': ['혁신', '산업'],
        'transport': ['도로', '운전'],
        'agriculture': ['농업', '식품'],
        'defense': ['안보', '보훈'],
        'safety': ['재난', '예방']
    };

    if (catKeywords[item.category]) {
        item.keywords.push(...catKeywords[item.category]);
    }

    item.keywords = [...new Set(item.keywords)].slice(0, 6); // Cap at 6, ensure unique
    // Ensure min 4?
    while (item.keywords.length < 4) {
        item.keywords.push('2026');
        item.keywords.push('정책');
    }
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
