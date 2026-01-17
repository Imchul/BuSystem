
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
