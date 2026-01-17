import fs from 'fs';
import path from 'path';

// --- Configuration ---
const INPUT_FILE = 'policy.md';
const OUT_DIR = 'src/data';

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

// Manual Title Corrections (Same as before, just in case)
const TITLE_CORRECTIONS = {
    "세까지 확대": "유아 무상교육·보육비 지원대상 4세까지 확대",
    "조 시행": "개정 「노동조합 및 노동관계조정법」 제2·3조 시행",
    "천원 인상": "여권발급수수료 2천원 인상",
    "억 보장": "전기차 화재 사고당 최대 100억 보장",
    "호 발사·운영": "국내 최초 공공 서비스 전용 국토위성 2호 발사·운영",
    "개월로 연장": "농식품 바우처, 청년 가구까지 지원 확대",
    "청년세대 성별균형 문화확산 사업 시행": "청년세대 성별균형 문화확산 사업 시행",
    "BBNJ": "BBNJ 협정 발효 (해양생물다양성 보호)",
    "청소년 시설 급식비 단가 인상": "청소년 시설",
    "상호금융 예탁금·출자금 비과세 적용기한 연장 및 적용범위 합리화": "상호금융 예탁금·출자금 비과세 적용기한 연장 및",
    "산업융합 규제샌드박스, 신속한 심의·규제 합리화로 산업 성장을 뒷받침합니다": "산업융합 규제샌드박스, 신속한 심의·규제 합리화로",
    "시정명령을 받은 사실에 대한 공표시 신문 제개면 제한 규정 폐지": "시정명령을 받은 사실에 대한 공표시",
    "물류기업 해외진출 시 컨설팅 확대": "물류기업 해외진출 시",
    "범죄피해자 등 주거상향 시 자산 소득 검증 생략": "범죄피해자 등 주거상향 시",
    "수입농산물 등 유통이력신고 대상품목 추가 및 신고방법 간소화": "수입농산물 등 유통이력신고 대상품목",
    "선박이 안전하고 환경친화적으로 재활용될 수 있도록 유해물질 관리기준 마련": "선박이 안전하고 환경친화적으로 재활용될 수 있도록",
    "기업부설연구소 등 육성.지원을 위한 법적기반 마련": "기업부설연구소 등 육성",
    "주민이 태양광발전사업을 시행하고 수익을 마을공동체가 공유하는 햇빛소득마을 조성": "주민이 태양광발전사업을 시행하고 수익을 마을공동체가",
    "출산전후휴가 급여 등 상한액 인상, 육아기 근로시간 단축 급여 기준금액 상한액 인상": "출산전후휴가 급여 등 상한액 인상",
    "통합문화이용권 1인당 지원금이 연간 15만원(7.1% 증)으로 인상": "통합문화이용권 1인당 지원금이 연간 15만원"
};

function cleanTitle(title) {
    let clean = title.replace(/\*\*/g, '').trim();
    // Remove "Page number" if attached (e.g. Title 123) - usually MD parser puts it separate but let's be safe
    // MD TOC lines: Title Dept **008**
    clean = clean.replace(/\*\*\d{3}\*\*$/, '').trim();
    clean = clean.replace(/[0-9]+$/, '').trim(); // Remove trailing page numbers if plain text
    return clean;
}

function normalize(str) {
    return str.replace(/\s+/g, '').replace(/\(.*\)/, '').replace(/\[.*\]/, '').replace(/<br\/?>/g, '');
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
    if (item.title.includes('전국민') || item.title.includes('모든')) { isSpecific = false; }
    if (!isSpecific) item.ageGroups.push('all');

    if (text.includes('여성') || text.includes('임산부') || text.includes('산모')) item.gender = 'female';
    else if (text.includes('남성') || text.includes('군인') || text.includes('장병')) item.gender = 'male';
    else item.gender = 'all';

    const keywordDB = ['세제', '금융', '복지', '교육', '보육', '여성', '안전', '환경', '주거', '청년', '노인', '장애인', '농촌', '교통', '의료', '소상공인', '육아', '세금', '지원금', '장학금', '일자리', '창업', '주택', '대출', '금리', '저출산', '다자녀', '한부모', '군인', '예비군', '에너지', '친환경', '탄소', '디지털', 'AI', '데이터', '반려동물'];
    item.keywords = keywordDB.filter(k => text.includes(k));
    if (item.department) item.keywords.push(item.department);
    item.keywords.push(catIdToName[item.category] || '기타');
    item.keywords = [...new Set(item.keywords)].slice(0, 6);
}

function parse() {
    console.log("Reading policy.md...");
    const markdown = fs.readFileSync(INPUT_FILE, 'utf8');
    const lines = markdown.split('\n');

    // --- Phase 1: Parse TOC ---
    // TOC is typically in the first part. We can find it by looking for "01 금융" etc.
    // Or we can just look for lines ending in **XXX** (Page Number)

    let items = [];
    let currentCatId = null;
    let tocMode = true;

    // Pattern for TOC line:  Title Dept **Page** OR Title **Page**
    // Regex: ^(.*?) (?:\*\*)?(\d{3})(?:\*\*)?$
    // Wait, the MD format from view_file:
    // 22: 통합고용세액공제 공제액 구조 개편 및 사후관리 합리화 재정경제부 **008**

    const tocRegex = /^(.*?)\s+([가-힣]+부|[가-힣]+처|[가-힣]+청|[가-힣]+위원회|국가데이터처)?\s*\*\*(\d{3})\*\*$/;

    // Also detect Category Headers in TOC
    // 19: **01** **금융·재정·조세**
    const catRegex = /^\*\*(\d{2})\*\*\s+\*\*(.*)\*\*$/;

    for (let i = 0; i < 2000; i++) { // Limit TOC scan to first 2000 lines
        const line = lines[i].trim();
        if (!line) continue;

        // Check Category
        const cMatch = line.match(catRegex);
        if (cMatch) {
            const catNum = cMatch[1];
            if (categoryMap[catNum]) {
                currentCatId = categoryMap[catNum];
                console.log(`Found Category: ${currentCatId} (${cMatch[2]})`);
            }
            continue;
        }

        // Check TOC Item
        const match = line.match(tocRegex);
        if (match && currentCatId) {
            let rawTitle = match[1].trim();
            const dept = match[2] || '';
            const page = parseInt(match[3]);

            // Filter garbage
            if (rawTitle.includes('달라지는 주요 제도') || rawTitle.includes('목차')) continue;

            // Apply corrections
            let title = cleanTitle(rawTitle);
            for (const [k, v] of Object.entries(TITLE_CORRECTIONS)) {
                if (title.includes(k)) title = v;
            }

            // Deduplicate
            if (!items.find(x => x.title === title && x.pageNumber === page)) {
                items.push({
                    id: items.length + 1,
                    title: title,
                    category: currentCatId,
                    department: dept,
                    pageNumber: page,
                    description: '',
                    ageGroups: [],
                    gender: 'all',
                    keywords: [],
                    contentBody: '',
                    implementationDate: '' // Initialize
                });
            }
        }
    }
    console.log(`Parsed ${items.length} items from TOC.`);

    // --- Phase 2: Extract Body Content ---
    // Strategy: Look for **Title** in the body.
    // We already have the list of expected titles.
    // We scan the file. If we hit specific markers or a known title, we start capturing.

    let matchedCount = 0;

    for (let item of items) {
        // Find line index where this title appears as **Title**
        // Heuristic: Strict match first, then fuzzy
        let startLine = -1;

        // Try exact match in lines
        const titlePattern = `**${item.title}**`;
        // Optimization: search in window around page number?
        // The file is huge, searching everywhere is slow but OK for node.
        // Better: The file is generally ordered. But MD structure might be weird.
        // Let's just search all, assuming uniqueness.

        // Actually, titles in body might differ slightly from TOC.
        // Try extracting normalized strings from all bold lines.

        // Create a Set of normalized strings for all titles to help detect the next policy
        const allTitlesNorm = new Set(items.map(i => normalize(i.title)));

        for (let i = 1000; i < lines.length; i++) { // Skip TOC area
            if (lines[i].includes(item.title) && lines[i].includes('**')) {
                // EXCLUDE TOC/Index lines which usually end like "Title **123**" or "Title 123"
                if (lines[i].trim().match(/\*\*\d{1,3}\*\*$/)) continue;
                if (lines[i].trim().match(/\s\d{1,3}$/)) continue;

                // Exclude Summary Sections
                let isSummary = false;
                for (let k = 1; k <= 5; k++) {
                    if (lines[i - k] && lines[i - k].includes('자세한 내용은')) isSummary = true;
                    if (lines[i + k] && lines[i + k].includes('자세한 내용은')) isSummary = true;
                }
                if (isSummary) continue;

                startLine = i;
                break;
            }
        }

        if (startLine === -1) {
            // Fuzzy match fallback
            const normTitle = normalize(item.title);
            for (let i = 1000; i < lines.length; i++) {
                const normLine = normalize(lines[i]);

                if (lines[i].includes('**')) {
                    // Check exclusion again
                    if (lines[i].trim().match(/\*\*\d{1,3}\*\*$/)) continue;

                    // Check if the line IS the title (mostly)
                    if (normLine.indexOf(normTitle) !== -1) {
                        // Exclude Summary Sections
                        let isSummary = false;
                        for (let k = 1; k <= 5; k++) {
                            if (lines[i - k] && lines[i - k].includes('자세한 내용은')) isSummary = true;
                            if (lines[i + k] && lines[i + k].includes('자세한 내용은')) isSummary = true;
                        }
                        if (isSummary) continue;

                        startLine = i;
                        break;
                    }
                }

                // Check Table Rows
                if (lines[i].trim().startsWith('|')) {
                    if (normLine.indexOf(normTitle) !== -1) {
                        startLine = i;
                        break;
                    }
                }
            }
        }

        if (startLine !== -1) {
            matchedCount++;

            // Extract Content until next **Title** or significant gap/Page marker
            let captured = [];
            let i = startLine + 1;
            // Capture Contact Info immediately if present
            // Look for next 10 lines for phone/dept
            let contactInfo = '';

            for (let j = 1; j < 10 && i + j < lines.length; j++) {
                if (lines[i + j].match(/☎|\d{2,3}-\d{3,4}-\d{4}/)) {
                    contactInfo = lines[i + j].replace(/\*\*/g, '').trim();
                    if (!item.department) {
                        // Extract department if possible
                        const deptMatch = contactInfo.match(/([가-힣\s]+과)/);
                        if (deptMatch) item.department = deptMatch[1].trim();
                    }
                }
            }

            // Capture Body
            while (i < lines.length) {
                const line = lines[i];
                const trimmed = line.trim();

                // Stop conditions
                // 1. Page Footer: "2026년부터 이렇게 달라집니다 123"
                if (trimmed.match(/^2026년부터 이렇게 달라집니다\s*\d+$/)) break;

                // 2. Next Category Header: "**01** **Category**"
                if (trimmed.match(/^\*\*\d{2}\*\*\s+\*\*/)) break;

                // 3. Next Policy Title: "**Title**"
                if (trimmed.startsWith('**') && trimmed.endsWith('**') && trimmed.length > 5) {
                    const potentialTitle = trimmed.replace(/\*\*/g, '').trim();
                    const normPot = normalize(potentialTitle);
                    // Check if this matches ANY other policy title
                    if (allTitlesNorm.has(normPot) && normPot !== normalize(item.title)) {
                        // Exclude Summary Sections
                        let isSummary = false;
                        for (let k = 1; k <= 5; k++) {
                            if (lines[i - k] && lines[i - k].includes('자세한 내용은')) isSummary = true;
                            if (lines[i + k] && lines[i + k].includes('자세한 내용은')) isSummary = true;
                        }

                        // Only break if it is NOT a summary section
                        if (!isSummary) {
                            break;
                        }
                    }
                }

                // Check Table Rows (Lines starting with |)
                if (trimmed.startsWith('|')) {
                    // Check if this row contains a new title that matches our list
                    // This is tricky because table rows contain lots of text.
                    // But usually we want to consume tables that belong to the current policy.
                    // The only risk is running into the NEXT policy's table row if the next policy is ONLY a table.
                    // But we rely on "Title" detection for that.
                }

                captured.push(line);
                i++;
            }

            // Extract Implementation Date from captured content (look for pattern in table rows)
            // Pattern: ('26.1.1.) or ('26. 1. 1.) or (2026.1.1.) usually at the end of a cell or line
            const dateRegex = /\(’?\d{2}\.\s*\d{1,2}\.\s*\d{1,2}\.?\s*(?:예정|시행)?\)/;
            let implementationDate = '';

            // Search in captured lines (especially table rows at the end)
            for (let k = captured.length - 1; k >= 0; k--) {
                const match = captured[k].match(dateRegex);
                if (match) {
                    implementationDate = match[0].replace(/[()]/g, '').trim();
                    break;
                }
            }

            // Clean Content
            item.detail = cleanContent(captured, contactInfo, item.department);
            item.implementationDate = implementationDate; // Add this field to Policy interface

            const fullText = captured.join('\n').trim();
            item.contentBody = fullText;

            // --- Process Content ---
            // 1. Description: First non-empty paragraph.
            const paragraphs = fullText.split(/\n\s*\n/);
            // Filter out contact info lines or boilerplate
            const cleanParas = paragraphs.filter(p => !p.includes('☎') && !p.includes('www') && p.trim().length > 10);

            if (cleanParas.length > 0) {
                item.description = cleanParas[0].replace(/\*\*/g, '').replace(/\n/g, ' ').trim();
                // Truncate
                if (item.description.length > 200) item.description = item.description.substring(0, 197) + '...';
            } else {
                item.description = item.title + "에 대한 상세 내용입니다.";
            }



            // Links
            const urlMatch = fullText.match(/https?:\/\/[^\s]+/g);
            if (urlMatch) {
                item.relatedSites = [...new Set(urlMatch)].map(u => ({ name: '관련 사이트', url: u }));
            }

        } else {
            console.log(`WARN: Could not find body for "${item.title}"`);
            item.detail = "<p>상세 내용을 불러오지 못했습니다.</p>";
        }

        inferTags(item);
        delete item.contentBody; // Cleanup
    }

    console.log(`Matched content for ${matchedCount}/${items.length} items.`);

    // Write output (Same as before)
    if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR);
    const itemsByCategory = {};
    for (const catId of Object.values(categoryMap)) {
        itemsByCategory[catId] = items.filter(i => i.category === catId);
    }

    for (const [catId, catItems] of Object.entries(itemsByCategory)) {
        const filename = `${OUT_DIR}/policies_${catId}.ts`;
        const fileContent = `import type { Policy } from './policies';\n\nexport const policies_${catId}: Policy[] = ${JSON.stringify(catItems, null, 2)};`;
        fs.writeFileSync(filename, fileContent);
    }

    // Main index
    const mainFileContent = `
import { policies_finance } from './policies_finance';
import { policies_education } from './policies_education';
import { policies_welfare } from './policies_welfare';
import { policies_culture } from './policies_culture';
import { policies_environment } from './policies_environment';
import { policies_industry } from './policies_industry';
import { policies_transport } from './policies_transport';
import { policies_agriculture } from './policies_agriculture';
import { policies_defense } from './policies_defense';
import { policies_safety } from './policies_safety';

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
  ...policies_finance,
  ...policies_education,
  ...policies_welfare,
  ...policies_culture,
  ...policies_environment,
  ...policies_industry,
  ...policies_transport,
  ...policies_agriculture,
  ...policies_defense,
  ...policies_safety,
];
`;
    fs.writeFileSync(`${OUT_DIR}/policies.ts`, mainFileContent);
    console.log("Done.");
}

parse();

function cleanContent(lines, contactInfo, department) {
    let html = '';

    // Add Contact Info Header
    if (department && contactInfo) {
        html += `<div class="policy-contact-header">
                    <span class="contact-label"><span class="icon">📞</span> 문의처</span>
                    <span class="contact-value">${department} ${contactInfo}</span>
                 </div>`;
        html += `<hr class="policy-divider" />`;
    }

    html += `<div class="md-content">`;

    let buffer = '';

    // Filter out "Summary" links, "Page number", AND Contact Info from body to avoid duplication
    const filteredLines = lines.filter(l => {
        const trimmed = l.trim();
        if (trimmed.match(/^자세한 내용은.*p\.\d+/)) return false;
        if (trimmed.match(/^\d+$/)) return false; // Lonely page numbers
        if (l.includes('2026년부터 이렇게 달라집니다')) return false;
        if (trimmed === '・ ・') return false;
        // Filter contact info if it looks like the header we just added
        if (trimmed.includes('☎') || (trimmed.includes(department) && trimmed.match(/\d{2,3}-\d{3,4}-\d{4}/))) return false;
        return true;
    });

    // State for table parsing
    let inTable = false;
    let tableBuffer = [];

    for (let i = 0; i < filteredLines.length; i++) {
        let line = filteredLines[i].trim();

        // Remove known garbage artifacts
        line = line.replace(/~~.*?~~/g, '');

        // Check for Table Block
        if (line.startsWith('|')) {
            if (!inTable) {
                // If we were parsing text, flush it
                if (buffer) {
                    html += `<div class="policy-text-block">${buffer}</div>`;
                    buffer = '';
                }
                inTable = true;
            }
            tableBuffer.push(line);
            continue;
        } else {
            // Not a table line.
            if (inTable) {
                // End of table block -> Render it
                html += renderTable(tableBuffer);
                tableBuffer = [];
                inTable = false;
            }
        }

        if (!line) {
            // Empty line.
            // Check if buffer needs to wait (e.g. sentence not finished).
            // If buffer DOES NOT end with punctuation, ignore this empty line (treat as soft break).
            if (buffer && !buffer.match(/[.?!]["”')]*$/)) {
                continue;
            }

            // Otherwise, it's a real paragraph break.
            if (buffer) {
                html += `<div class="policy-text-block">${buffer}</div>`;
                buffer = '';
            }
            continue;
        }

        // Detect List Items
        const isListItem = line.match(/^[-*・>]|\d+\.\s|\(\d+\)|※/);

        if (isListItem) {
            if (buffer) {
                html += `<div class="policy-text-block">${buffer}</div>`;
                buffer = '';
            }
            // Format as bullet point
            let content = line;
            if (line.startsWith('・') || line.startsWith('-')) {
                content = line.substring(1).trim();
            }
            html += `<div class="policy-bullet-item"><span class="bullet">•</span> ${content}</div>`;
        } else {
            // Normal text line.
            // Join if buffer implies continuation.
            if (buffer && !buffer.match(/[.?!]["”')]*$/) && !buffer.match(/[.?!]["”')]*\s*$/)) {
                buffer += ' ' + line;
            } else {
                if (buffer) {
                    html += `<div class="policy-text-block">${buffer}</div>`;
                }
                buffer = line;
            }
        }
    }

    // Flush remaining buffers
    if (inTable && tableBuffer.length > 0) {
        html += renderTable(tableBuffer);
    }
    if (buffer) {
        html += `<div class="policy-text-block">${buffer}</div>`;
    }

    html += `</div>`;
    return html;
}

function renderTable(lines) {
    if (lines.length === 0) return '';

    // Basic Markdown Table Parser
    let html = '<div class="policy-table-container"><table class="policy-table">';

    // Find separator line (e.g., |---|---|)
    const separatorIdx = lines.findIndex(l => l.match(/^\|?[\s-:]*\|[\s-:]*\|/));

    let startBody = 0;

    if (separatorIdx > 0) {
        // Has header
        html += '<thead>';
        // Usually the line immediately before separator is the header
        // But what if there are multiple header lines? MD tables usually have 1 header row.
        // Let's assume lines[0] to lines[separatorIdx-1] are headers? 
        // Standard GFM allows only 1 header row.

        const headerRow = lines[separatorIdx - 1];
        const cleanRow = headerRow.replace(/^\|/, '').replace(/\|$/, '');
        const cols = cleanRow.split('|');
        html += '<tr>';
        cols.forEach(c => html += `<th>${c.trim()}</th>`);
        html += '</tr></thead>';

        startBody = separatorIdx + 1;
    } else {
        // No separator found? Treat all as body or just fail?
        // Some MD tables might just be grid-like.
        // Or properly formatted but we missed the regex.
        // Let's just render all as rows.
    }

    html += '<tbody>';
    for (let i = startBody; i < lines.length; i++) {
        const line = lines[i];
        // Skip the separator line if we didn't filter it out yet (redundant check)
        if (line.match(/^\|?[\s-:]*\|[\s-:]*\|/)) continue;

        const cleanRow = line.replace(/^\|/, '').replace(/\|$/, '');
        const cols = cleanRow.split('|');
        html += '<tr>';
        cols.forEach(c => html += `<td>${c.trim()}</td>`);
        html += '</tr>';
    }
    html += '</tbody></table></div>';
    return html;
}
