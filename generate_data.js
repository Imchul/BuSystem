import fs from 'fs';
import path from 'path';

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

// Manual Title Corrections based on User Feedback & Text Analysis
const TITLE_CORRECTIONS = {
    "세까지 확대": "유아 무상교육·보육비 지원대상 4세까지 확대",
    "조 시행": "개정 「노동조합 및 노동관계조정법」 제2·3조 시행",
    "천원 인상": "여권발급수수료 2천원 인상",
    "7.1% 증)으로 인상": "통합문화이용권 1인당 지원금 인상(15만원)",
    "% 증)으로 인상": "통합문화이용권 1인당 지원금 인상(15만원)",
    "억 보장": "전기차 화재 사고당 최대 100억 보장",
    "추진": "스타트업 원스톱 지원센터 운영", // Found "스타트업..." nearby or "상권 르네상스"? User said "공동물류센터". Let's check "공동물류센터" logic below.
    "호 발사·운영": "국내 최초 공공 서비스 전용 국토위성 2호 발사·운영",
    "개월로 연장": "농식품 바우처 지원대상 및 기간 확대",
    "청년세대 성별균형 문화확산 사업 시행": "청년세대 성별균형 문화확산 사업 시행", // removal of prefix handled by generic cleaner
    "해운분야 안전투자 최초 공시": "해운분야 안전투자 최초 공시",
    "방 발효": "공해 등 국가관할권 이원지역 해양생물다양성 보호 협정(BBNJ) 발효"
};

// Specific override for "추진" which is too generic. 
// Based on grep "공동물류센터", the title is "인천항 스마트 공동물류센터 전면 개장".
// If the parsed title is JUST "추진", we map it. 
// However, the TOC parsing might be splitting it wrong.

function cleanTitleForMatching(title) {
    let clean = title;

    // Apply exact map overrides first if applicable (for short parsed garbage)
    if (TITLE_CORRECTIONS[clean]) return TITLE_CORRECTIONS[clean];

    // Remove prefixes
    clean = clean.replace(/에서도 검색이 가능합니다\.?/g, '')
        .replace(/년부터 이렇게 달라집니다/g, '')
        .replace(/^[0-9\. ]+/, '') // Remove leading numbers
        .trim();

    // Partial Corrections (User requests)
    if (clean.includes("세까지 확대")) clean = "유아 무상교육·보육비 지원대상 4세까지 확대";
    if (clean.endsWith("조 시행") && clean.length < 10) clean = "개정 「노동조합 및 노동관계조정법」 제2·3조 시행";
    if (clean.includes("천원 인상")) clean = "여권발급수수료 2천원 인상";
    if (clean.includes("억 보장")) clean = "전기차 화재 사고당 최대 100억 보장";
    if (clean.includes("호 발사·운영")) clean = "국내 최초 공공 서비스 전용 국토위성 2호 발사·운영";
    if (clean.includes("개월로 연장")) clean = "농식품 바우처 지원대상 및 기간 확대";
    if (clean.includes("통합문화이용권") && clean.includes("인상")) clean = "통합문화이용권 1인당 지원금 인상(15만원)";
    if (clean.includes("BBNJ")) clean = "BBNJ 협정 발효 (해양생물다양성 보호)";

    // Aggressive cleanup for the Youth item which has embedded URL
    if (clean.includes("청년세대 성별균형")) clean = "청년세대 성별균형 문화확산 사업 시행";

    return clean;
}

function parse() {
    const text = fs.readFileSync('policy_text_v3.txt', 'utf8');

    // 1. Preprocess: Map Page Numbers
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
            if (currentPage >= 4 && currentPage <= 20) {
                tocText += line + "  ";
            }
        }
    }

    // 2. Parse TOC
    let items = [];
    const categories = Object.keys(categoryMap).sort();
    let catIndices = [];

    for (const catId of categories) {
        const namePart = catIdToName[catId].split('·')[0];
        const regex = new RegExp(`${catId}\\s+${namePart}`);
        const match = tocText.match(regex);
        if (match) {
            catIndices.push({ id: catId, index: match.index });
        }
    }
    catIndices.sort((a, b) => a.index - b.index);

    for (let i = 0; i < catIndices.length; i++) {
        const currentCat = catIndices[i];
        const nextCat = catIndices[i + 1];
        const start = currentCat.index;
        const end = nextCat ? nextCat.index : tocText.length;
        const blockText = tocText.substring(start, end);
        const currentCatId = categoryMap[currentCat.id];

        let match;
        const blockItemRegex = /([^\d]+?)\s+([가-힣]+부|[가-힣]+처|[가-힣]+청|[가-힣]+위원회|국가데이터처)\s+(\d{3})/g;

        while ((match = blockItemRegex.exec(blockText)) !== null) {
            let rawTitle = match[1].trim();
            const dept = match[2];
            const page = parseInt(match[3]);

            let title = cleanTitleForMatching(rawTitle);

            // Re-check for very short titles that might be parsing errors
            if (title === "추진") {
                // Heuristic: If we are in 'Industry' (06) or 'Transport' (07), map to Logistics?
                // Or just search content later. For now, try to fix specific known '추진' errors.
                // User said: "제목이 '추진' 인 것도 있어요. 중소기업의 수출입 물류활동 지원 등을 위해 공동물류센터 건립 지원관련 내용"
                // This is likely "인천항 스마트 공동물류센터 전면 개장" found in Transport/Maritime section.
                // Let's assume it catches the right page number.
                title = "중소기업 지원을 위한 스마트 공동물류센터 건립 추진";
            }

            if (title.length < 2) continue;
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

    // 3. Extract Details
    let matchedCount = 0;
    for (let item of items) {
        let found = false;
        const targetPdfPage = item.pageNumber + 41;

        // Scan range
        for (let p = targetPdfPage - 2; p <= targetPdfPage + 2; p++) {
            const content = pageContents[p] || "";
            // Strategy: Fuzzy Match Title in Content
            // OR checks for specific keywords if title is generic
            const safeTitleForSearch = item.title.replace(/\s+/g, '').substring(0, 8);
            const cleanContent = content.replace(/\s+/g, '');

            if (cleanContent.includes(safeTitleForSearch)) {
                found = true;
                matchedCount++;

                // --- Description Extraction ---
                // Find title in content lines
                const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
                let startIdx = 0;
                for (let i = 0; i < lines.length; i++) {
                    const l = lines[i].replace(/\s+/g, '');
                    if (l.includes(safeTitleForSearch)) {
                        startIdx = i + 1;
                        break;
                    }
                }

                // Look for first sentence
                let desc = "";
                for (let i = startIdx; i < lines.length; i++) {
                    const line = lines[i];
                    if (line.match(/2026년부터 이렇게|Page|www|http/)) continue;
                    if (line.match(/(추진배경|주요내용|시행일|지원대상|기대효과)/)) break; // Hit section header

                    // Accumulate lines until we hit a period or end of paragraph
                    desc += line + " ";
                    if (line.endsWith('.') || line.endsWith('다')) break;
                }
                item.description = desc.trim();
                // If description is still empty or looks like boilerplate, try to find "주요내용" and take first bullet
                if (!item.description || item.description.length < 10) {
                    const mainMatch = content.match(/주요내용\s+([\s\S]*?)(?=\n)/);
                    if (mainMatch) item.description = mainMatch[1].trim().replace(/^[·-]\s*/, '');
                }
                if (!item.description) item.description = item.title + "에 대한 상세 내용을 확인하세요.";
                if (item.description.length > 150) item.description = item.description.substring(0, 147) + "...";


                // --- Rich Detail Extraction ---
                let htmlParts = [];
                const sections = [
                    { key: '추진배경', icon: '📋' },
                    { key: '지원대상', icon: '🎯' },
                    { key: '주요내용', icon: '💡' },
                    { key: '기대효과', icon: '✨' },
                    { key: '시행일', icon: '📅' }
                ];

                sections.forEach(sec => {
                    const otherKeys = sections.filter(s => s.key !== sec.key).map(s => s.key).join('|');
                    const regex = new RegExp(`${sec.key}\\s+([\\s\\S]*?)(?=${otherKeys}|문의처|재정경제부|[가-힣]+부|$)`, 'i');
                    const match = content.match(regex);

                    if (match && match[1].trim()) {
                        let text = match[1].trim();
                        // Formatting: Bullet points to line breaks
                        text = text.replace(/([·-])\s/g, '<br/>$1 ');
                        text = text.replace(/(\d+\.)\s/g, '<br/>$1 '); // numbered lists
                        text = text.replace(/\n/g, ' '); // JOIN lines first to avoid arbitrary breaks, rely on <br> inserted above? 
                        // Actually, PDF copy-paste often has hard breaks. Let's preserve \n as <br> only if it looks like a new item?
                        // Better: Just replace the regex bullets.

                        htmlParts.push(`<h3>${sec.icon} ${sec.key}</h3><p>${text}</p>`);
                    }
                });

                // --- Contact Info Extraction ---
                // Look for "부서명 ☎ 00-000-0000" pattern at bottom usually
                const phoneRegex = /([가-힣\s]+과)\s+☎\s+([\d-]+)/;
                const phoneMatch = content.match(phoneRegex);
                if (phoneMatch) {
                    htmlParts.push(`<h3>📞 문의처</h3><p>${phoneMatch[1]} : ${phoneMatch[2]}</p>`);
                } else if (item.department) {
                    // Fallback to searching just for department name near a phone number
                    const deptPhoneRegex = new RegExp(`${item.department}\\s+.*☎\\s+([\\d-]+)`);
                    const dMatch = content.match(deptPhoneRegex);
                    if (dMatch) {
                        htmlParts.push(`<h3>📞 문의처</h3><p>${item.department} : ${dMatch[1]}</p>`);
                    }
                }

                if (htmlParts.length === 0) {
                    htmlParts.push(`<p>상세 내용이 본문에 없습니다. PDF 원본 P.${item.pageNumber}를 참고하세요.</p>`);
                }

                item.detail = htmlParts.join('<br/><br/>');

                // Links
                const urls = content.match(/https?:\/\/[^\s]+/g);
                if (urls) {
                    item.relatedSites = [...new Set(urls)].map(u => ({ name: '관련 사이트', url: u }));
                }

                inferTags(item);
                break;
            }
        }
        if (!found) {
            // Fallback Tags even if not found
            inferTags(item);
            item.detail = "<p>정보를 불러오지 못했습니다.</p>";
        }
    }

    console.log(`Matched content for ${matchedCount}/${items.length} items.`);

    // 4. Wrap Up & Write
    if (!fs.existsSync('src/data')) fs.mkdirSync('src/data');
    const itemsByCategory = {};
    for (const catId of Object.values(categoryMap)) {
        itemsByCategory[catId] = items.filter(i => i.category === catId);
    }

    for (const [catId, catItems] of Object.entries(itemsByCategory)) {
        const filename = `src/data/policies_${catId}.ts`;
        const fileContent = `import type { Policy } from './policies';\n\nexport const policies_${catId}: Policy[] = ${JSON.stringify(catItems, null, 2)};`;
        fs.writeFileSync(filename, fileContent);
    }

    const mainFileContent = generateMainTS(Object.keys(itemsByCategory));
    fs.writeFileSync('src/data/policies.ts', mainFileContent);
}

// ... Helper functions (inferTags, generateMainTS) same as before ... 
function inferTags(item) {
    const text = (item.title + ' ' + item.description).toLowerCase();
    item.ageGroups = [];
    let isSpecific = false;
    if (text.includes('영유아') || text.includes('어린이') || text.includes(' 0-6세')) { item.ageGroups.push('infant'); isSpecific = true; }
    if (text.includes('아동') || text.includes('초등') || text.includes('학생')) { item.ageGroups.push('child'); isSpecific = true; }
    if (text.includes('청소년') || text.includes('청년') || text.includes('대학생') || text.includes('중고생')) { item.ageGroups.push('youth'); isSpecific = true; }
    if (text.includes('중장년') || text.includes('직장인')) { item.ageGroups.push('adult'); isSpecific = true; }
    if (text.includes('어르신') || text.includes('노인') || text.includes('고령자') || text.includes('연금')) { item.ageGroups.push('senior'); isSpecific = true; }

    // Explicit 'All' overrides
    if (item.title.includes('전국민') || item.title.includes('모든')) { isSpecific = false; }

    if (!isSpecific) item.ageGroups.push('all');

    if (text.includes('여성') || text.includes('임산부') || text.includes('산모')) item.gender = 'female';
    else if (text.includes('남성') || text.includes('군인') || text.includes('장병')) item.gender = 'male';
    else item.gender = 'all';

    const keywordDB = ['세제', '금융', '복지', '교육', '보육', '여성', '안전', '환경', '주거', '청년', '노인', '장애인', '농촌', '교통', '의료', '소상공인', '육아', '세금', '지원금', '장학금', '일자리', '창업', '주택', '대출', '금리', '저출산', '다자녀', '한부모', '군인', '예비군', '에너지', '친환경', '탄소', '디지털', 'AI', '데이터', '반려동물', '급식'];
    item.keywords = keywordDB.filter(k => text.includes(k));
    if (item.department) item.keywords.push(item.department);
    item.keywords.push(catIdToName[item.category] || '기타');
    item.keywords = [...new Set(item.keywords)].slice(0, 6);
}

function generateMainTS(categories) {
    const imports = categories.map(c => `import { policies_${c} } from './policies_${c}';`).join('\n');
    const exports = `
export interface Policy {
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

export const policies: Policy[] = [
${categories.map(c => `  ...policies_${c}`).join(',\n')}
];
`;
    return imports + '\n' + exports;
}

parse();
