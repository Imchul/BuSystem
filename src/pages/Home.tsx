import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { policies, categories, ageGroupLabels } from '../data/policies';
import '../App.css';

type AgeGroup = 'infant' | 'child' | 'youth' | 'adult' | 'senior' | 'all';
type Gender = 'all' | 'male' | 'female';

export default function Home() {
    const navigate = useNavigate();
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [selectedAgeGroup, setSelectedAgeGroup] = useState<AgeGroup | ''>('');
    const [selectedGender, setSelectedGender] = useState<Gender>('all');
    const [searchQuery, setSearchQuery] = useState('');

    const filteredPolicies = useMemo(() => {
        return policies.filter((policy) => {
            // Category filter
            if (selectedCategory !== 'all' && policy.category !== selectedCategory) {
                return false;
            }

            // Age group filter
            if (selectedAgeGroup && selectedAgeGroup !== 'all') {
                if (!policy.ageGroups.includes(selectedAgeGroup) && !policy.ageGroups.includes('all')) {
                    return false;
                }
            }

            // Gender filter
            if (selectedGender !== 'all') {
                if (policy.gender !== 'all' && policy.gender !== selectedGender) {
                    return false;
                }
            }

            // Search filter
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                return (
                    policy.title.toLowerCase().includes(query) ||
                    policy.description.toLowerCase().includes(query) ||
                    policy.keywords.some(k => k.toLowerCase().includes(query)) ||
                    policy.department.toLowerCase().includes(query)
                );
            }

            return true;
        });
    }, [selectedCategory, selectedAgeGroup, selectedGender, searchQuery]);

    const getCategoryInfo = (categoryId: string) => {
        return categories.find(c => c.id === categoryId) || categories[0];
    };

    const getAgeGroupDisplay = (ageGroups: AgeGroup[]) => {
        if (ageGroups.includes('all')) return '전 연령';
        return ageGroups.map(ag => {
            switch (ag) {
                case 'infant': return '영유아';
                case 'child': return '아동';
                case 'youth': return '청년';
                case 'adult': return '중장년';
                case 'senior': return '어르신';
                default: return ag;
            }
        }).join(', ');
    };

    const getGenderDisplay = (gender: Gender) => {
        switch (gender) {
            case 'male': return '남성';
            case 'female': return '여성';
            default: return '공통';
        }
    };

    return (
        <div className="home-container">
            {/* Filters Section */}
            <section className="filters-section">
                <div className="filter-group">
                    <label>검색</label>
                    <input
                        type="text"
                        placeholder="정책명, 키워드로 검색..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="search-input"
                    />
                </div>

                <div className="filter-group">
                    <label>나이대</label>
                    <select
                        value={selectedAgeGroup}
                        onChange={(e) => setSelectedAgeGroup(e.target.value as AgeGroup | '')}
                        className="filter-select"
                    >
                        <option value="">전체</option>
                        {Object.entries(ageGroupLabels).map(([key, label]) => (
                            <option key={key} value={key}>{label}</option>
                        ))}
                    </select>
                </div>

                <div className="filter-group">
                    <label>성별</label>
                    <select
                        value={selectedGender}
                        onChange={(e) => setSelectedGender(e.target.value as Gender)}
                        className="filter-select"
                    >
                        <option value="all">전체</option>
                        <option value="male">남성</option>
                        <option value="female">여성</option>
                    </select>
                </div>

                <div className="filter-group">
                    <label>분야</label>
                    <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="filter-select"
                    >
                        <option value="all">전체 분야</option>
                        {categories.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                                {cat.icon} {cat.name}
                            </option>
                        ))}
                    </select>
                </div>
            </section>

            {/* Category Pills */}
            <section className="category-pills">
                <button
                    className={`category-pill ${selectedCategory === 'all' ? 'active' : ''}`}
                    onClick={() => setSelectedCategory('all')}
                >
                    전체
                </button>
                {categories.map((cat) => (
                    <button
                        key={cat.id}
                        className={`category-pill ${selectedCategory === cat.id ? 'active' : ''}`}
                        onClick={() => setSelectedCategory(cat.id)}
                        style={{ '--cat-color': cat.color } as React.CSSProperties}
                    >
                        {cat.icon} {cat.name}
                    </button>
                ))}
            </section>

            {/* Results Count */}
            <div className="results-info">
                <span className="results-count">
                    총 <strong>{filteredPolicies.length}</strong>개의 정책
                </span>
                {(selectedAgeGroup || selectedGender !== 'all' || searchQuery) && (
                    <button
                        className="clear-filters"
                        onClick={() => {
                            setSelectedAgeGroup('');
                            setSelectedGender('all');
                            setSearchQuery('');
                        }}
                    >
                        필터 초기화
                    </button>
                )}
            </div>

            {/* Policies Grid */}
            <section className="policies-grid">
                {filteredPolicies.length === 0 ? (
                    <div className="no-results">
                        <span className="no-results-icon">🔍</span>
                        <p>조건에 맞는 정책이 없습니다.</p>
                        <p className="no-results-hint">다른 필터 조건을 선택해 보세요.</p>
                    </div>
                ) : (
                    filteredPolicies.map((policy) => {
                        const categoryInfo = getCategoryInfo(policy.category);

                        return (
                            <article
                                key={policy.id}
                                className="policy-card"
                                onClick={() => navigate(`/policy/${policy.id}`)}
                            >
                                <div
                                    className="policy-category-bar"
                                    style={{ backgroundColor: categoryInfo.color }}
                                />
                                <div className="policy-content">
                                    <div className="policy-header">
                                        <span className="policy-category-badge" style={{ backgroundColor: `${categoryInfo.color}20`, color: categoryInfo.color }}>
                                            {categoryInfo.icon} {categoryInfo.name}
                                        </span>
                                        <span className="policy-department">{policy.department}</span>
                                    </div>
                                    <h3 className="policy-title">{policy.title}</h3>
                                    <p className="policy-description">
                                        {policy.description}
                                    </p>
                                    <div className="policy-meta">
                                        <span className="policy-age-group">
                                            👤 {getAgeGroupDisplay(policy.ageGroups)}
                                        </span>
                                        {policy.gender !== 'all' && (
                                            <span className="policy-gender">
                                                {policy.gender === 'male' ? '♂️' : '♀️'} {getGenderDisplay(policy.gender)}
                                            </span>
                                        )}
                                    </div>
                                    <div className="policy-keywords">
                                        {policy.keywords.slice(0, 4).map((keyword) => (
                                            <span
                                                key={keyword}
                                                className="keyword-tag"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSearchQuery(keyword);
                                                }}
                                            >
                                                #{keyword}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </article>
                        );
                    })
                )}
            </section>
        </div>
    );
}
