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

function cleanTitleForMatching(title) {
    // Remove category prefixes commonly found in titles
    let cleaned = title;
    Object.keys(categoryNames).forEach(catName => {
        cleaned = cleaned.replace(new RegExp(catName, 'g'), '');
    });
    // Remove leading numbers, common words like '분야별'
    cleaned = cleaned.replace(/^\d{2}\s+/, '')
        .replace(/분야별 달라지는 주요 제도/g, '')
        .replace(/\s+/g, '') // Remove all spaces for matching
        .trim();
    return cleaned;
}

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
            if (currentPage >= 4 && currentPage <= 20) {
                tocText += line + "  ";
            }
        }
    }

    // 2. Parse Items from TOC
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

            // Cleanup Title for Display
            let title = rawTitle
                .replace(/^\d{2}\s+[가-힣·]+/, '') // Remove "01 금융" prefix
                .replace(/분야별 달라지는 주요 제도/g, '')
                .replace(/https?:\/\/\S+/g, '')
                .trim();

            // Extra cleanup: If title starts with the category name, remove it
            const catName = catIdToName[currentCat.id];
            if (title.startsWith(catName)) {
                title = title.substring(catName.length).trim();
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

    // 3. Extract Details (Full Content + HTML)
    let matchedCount = 0;
    for (let item of items) {
        let found = false;
        const targetPdfPage = item.pageNumber + 41; // Offset confirmed

        for (let p = targetPdfPage - 2; p <= targetPdfPage + 2; p++) {
            const content = pageContents[p] || "";
            const cleanContent = content.replace(/\s+/g, '');
            const matchTitle = cleanTitleForMatching(item.title);

            // Fuzzy check: check if first 10 chars of cleaned title align, or if significant substring matches
            if (cleanContent.includes(matchTitle.substring(0, Math.min(10, matchTitle.length)))) {
                found = true;
                matchedCount++;

                // -- Extraction Logic --

                // 1. Description (Summary)
                // Use the first meaningful sentence that is NOT the title or meta info
                const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
                let desc = "";
                // Try to find where title ends
                let bodyStartIndex = 0;
                for (let i = 0; i < lines.length; i++) {
                    // Heuristic: skip lines that look like headers or page nums
                    if (lines[i].includes('2026년부터') || lines[i].includes('Page') || lines[i].includes('www.')) continue;
                    // If line matches title significantly
                    if (lines[i].replace(/\s+/g, '').includes(matchTitle.substring(0, 5))) {
                        bodyStartIndex = i + 1;
                        break;
                    }
                }

                // Grab first paragraph after title
                if (bodyStartIndex < lines.length) {
                    for (let i = bodyStartIndex; i < lines.length; i++) {
                        if (lines[i].match(/(추진배경|주요내용|시행일|지원대상|기대효과)/)) break;
                        desc += lines[i] + " ";
                    }
                }
                item.description = desc.trim();
                if (!item.description) item.description = "2026년부터 시행되는 새로운 정책입니다.";
                if (item.description.length > 200) item.description = item.description.substring(0, 197) + "...";

                // 2. HTML Detail Construction
                let htmlParts = [];

                // Define sections to look for
                const sections = [
                    { key: '추진배경', icon: '📋' },
                    { key: '지원대상', icon: '🎯' }, // New
                    { key: '주요내용', icon: '💡' },
                    { key: '기대효과', icon: '✨' }, // New
                    { key: '시행일', icon: '📅' }
                ];

                // Remove the "header" part of the page (roughly) to avoid matching TOC or running headers
                let cleanPageContent = content;

                sections.forEach((sec, idx) => {
                    // Regex lookahead for next section or end of specific sections
                    // We need to dynamically build regex to stop at ANY of the other keywords
                    const otherKeys = sections.filter(s => s.key !== sec.key).map(s => s.key).join('|');
                    // Regex: Key word, capture everything untill next key word or "재정경제부"(footer-ish) or end
                    const regex = new RegExp(`${sec.key}\\s+([\\s\\S]*?)(?=${otherKeys}|재정경제부|[가-힣]+부|$)`, 'i');
                    const match = cleanPageContent.match(regex);

                    if (match && match[1].trim()) {
                        const text = match[1].trim().replace(/\n/g, '<br/>');
                        htmlParts.push(`<h3>${sec.icon} ${sec.key}</h3><p>${text}</p>`);
                    }
                });

                // Fallback: If no structured sections found, use the whole body content
                if (htmlParts.length === 0) {
                    // Filter out likely garbage lines
                    const meaningfulLines = lines.filter(l =>
                        !l.match(/2026년부터 이렇게/) &&
                        !l.match(/--- Page/) &&
                        !l.includes('www.')
                    ).join('<br/>');
                    htmlParts.push(`<h3>📄 상세내용</h3><p>${meaningfulLines}</p>`);
                }

                item.detail = htmlParts.join('<br/><br/>');

                // Related Sites
                const urls = content.match(/https?:\/\/[^\s]+/g);
                if (urls) {
                    item.relatedSites = [...new Set(urls)].map(u => ({ name: '관련 사이트', url: u }));
                }

                inferTags(item);
                break;
            }
        }

        if (!found) {
            console.log(`Not found content for: ${item.title} (Page ${item.pageNumber}, Target ${item.pageNumber + 41})`);
            item.description = "상세 내용을 불러오지 못했습니다.";
            item.detail = "<p>PDF 원문 추출에 실패했습니다. 추후 업데이트 예정입니다.</p>";
            inferTags(item);
        }
    }

    console.log(`Matched content for ${matchedCount}/${items.length} items.`);

    // 4. Split and Write Files
    if (!fs.existsSync('src/data')) fs.mkdirSync('src/data');

    // Group items by category
    const itemsByCategory = {};
    for (const catId of Object.values(categoryMap)) {
        itemsByCategory[catId] = items.filter(i => i.category === catId);
    }

    // Write individual files
    for (const [catId, catItems] of Object.entries(itemsByCategory)) {
        const filename = `src/data/policies_${catId}.ts`;
        const fileContent = `import type { Policy } from './policies';\n\nexport const policies_${catId}: Policy[] = ${JSON.stringify(catItems, null, 2)};`;
        fs.writeFileSync(filename, fileContent);
        console.log(`Written ${filename} (${catItems.length} items)`);
    }

    // Write main aggregated file
    const mainFileContent = generateMainTS(Object.keys(itemsByCategory));
    fs.writeFileSync('src/data/policies.ts', mainFileContent);
    console.log('Generated src/data/policies.ts (Aggregator)');
}

function inferTags(item) {
    const text = (item.title + ' ' + item.description).toLowerCase();
    item.ageGroups = [];
    let isSpecific = false;
    if (text.includes('영유아') || text.includes('어린이') || text.includes(' 0-6세')) { item.ageGroups.push('infant'); isSpecific = true; }
    if (text.includes('아동') || text.includes('초등') || text.includes('학생')) { item.ageGroups.push('child'); isSpecific = true; }
    if (text.includes('청소년') || text.includes('청년') || text.includes('대학생') || text.includes('중고생')) { item.ageGroups.push('youth'); isSpecific = true; }
    if (text.includes('중장년') || text.includes('직장인')) { item.ageGroups.push('adult'); isSpecific = true; }
    if (text.includes('어르신') || text.includes('노인') || text.includes('고령자') || text.includes('연금')) { item.ageGroups.push('senior'); isSpecific = true; }
    if (!isSpecific) item.ageGroups.push('all');

    if (text.includes('여성') || text.includes('임산부') || text.includes('산모')) item.gender = 'female';
    else if (text.includes('남성') || text.includes('군인') || text.includes('장병')) item.gender = 'male';
    else item.gender = 'all';

    const keywordDB = ['세제', '금융', '복지', '교육', '보육', '여성', '안전', '환경', '주거', '청년', '노인', '장애인', '농촌', '교통', '의료', '소상공인', '육아', '세금', '지원금', '장학금', '일자리', '창업', '주택', '대출', '금리', '저출산', '다자녀', '한부모', '군인', '예비군', '에너지', '친환경', '탄소', '디지털', 'AI', '데이터'];
    item.keywords = keywordDB.filter(k => text.includes(k.toLowerCase()));
    if (item.department) item.keywords.push(item.department);
    item.keywords.push(catIdToName[item.category] || '기타');
    item.keywords = [...new Set(item.keywords)].slice(0, 6);
    while (item.keywords.length < 3) item.keywords.push('정책');
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
