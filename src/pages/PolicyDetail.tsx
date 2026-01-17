import { useParams, useNavigate } from 'react-router-dom';
import { policies, categories, ageGroupLabels } from '../data/policies';
import '../App.css';

export default function PolicyDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const policy = policies.find(p => p.id === Number(id));

    if (!policy) {
        return (
            <div className="not-found">
                <h2>정책을 찾을 수 없습니다.</h2>
                <button onClick={() => navigate('/')}>메인으로 돌아가기</button>
            </div>
        );
    }

    const categoryInfo = categories.find(c => c.id === policy.category) || categories[0];

    return (
        <div className="policy-detail-container">
            <button className="back-button" onClick={() => navigate('/')}>
                ← 목록으로 돌아가기
            </button>

            <article className="policy-detail-card">
                <header className="detail-header" style={{ borderLeft: `6px solid ${categoryInfo.color}` }}>
                    <div className="detail-badges">
                        <span className="policy-category-badge" style={{ backgroundColor: `${categoryInfo.color}20`, color: categoryInfo.color }}>
                            {categoryInfo.icon} {categoryInfo.name}
                        </span>
                        <span className="policy-department">{policy.department}</span>
                        {policy.implementationDate && (
                            <span className="implementation-date-badge">
                                📅 시행: {policy.implementationDate}
                            </span>
                        )}
                    </div>
                    <h1>{policy.title}</h1>
                </header>

                <section className="detail-content">

                    {/* Meta Info Bar: Target (Left) / Contact (Right) */}
                    <div className="detail-meta-bar">
                        <div className="meta-group left">
                            <span className="meta-label">지원 대상</span>
                            <span className="meta-value highlight">
                                {policy.ageGroups.includes('all')
                                    ? '전 연령'
                                    : policy.ageGroups.map(g => ageGroupLabels[g].split(' ')[0]).join(', ')}
                                {policy.gender !== 'all' && ` (${policy.gender === 'male' ? '남성' : '여성'})`}
                            </span>
                        </div>

                        {(policy.contactInfo || policy.department) && (
                            <div className="meta-group right">
                                <span className="meta-label">문의처</span>
                                <span className="meta-value">
                                    {policy.contactInfo ? (
                                        <>
                                            <span className="contact-dept">{policy.contactInfo.split('☎')[0]}</span>
                                            {policy.contactInfo.includes('☎') && (
                                                <a href={`tel:${policy.contactInfo.split('☎')[1].trim()}`} className="contact-phone">
                                                    📞 {policy.contactInfo.split('☎')[1].trim()}
                                                </a>
                                            )}
                                        </>
                                    ) : (
                                        policy.department
                                    )}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Full Width Content */}
                    <div className="main-description full-width">
                        <div
                            className="detail-text"
                            dangerouslySetInnerHTML={{ __html: policy.detail || '' }}
                        />
                    </div>

                    {policy.relatedSites && policy.relatedSites.length > 0 && (
                        <div className="related-sites">
                            <h3>관련 사이트</h3>
                            <div className="links">
                                {policy.relatedSites.map((site, idx) => (
                                    <a key={idx} href={site.url} target="_blank" rel="noopener noreferrer" className="site-link">
                                        {site.name} 🔗
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}

                    {policy.imageUrl && (
                        <div className="detail-image">
                            <img src={policy.imageUrl} alt={policy.title} />
                        </div>
                    )}
                    {policy.imageUrl && (
                        <div className="detail-image">
                            <img src={policy.imageUrl} alt={policy.title} />
                        </div>
                    )}
                </section>
            </article>
        </div>
    );
}
