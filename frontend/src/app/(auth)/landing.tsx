import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import HouseLogo from '@/assets/images/house_logo-house-white.svg';
import { FontFamily } from '@/constants/theme';

// ─── Images ──────────────────────────────────────────
const heroImg = require('../../../assets/images/landing/hero-banner.jpg');
const residentImg = require('../../../assets/images/landing/resident-complaint.jpg');
const managerImg = require('../../../assets/images/landing/manager-dashboard.jpg');
const workerImg = require('../../../assets/images/landing/maintenance-worker.jpg');
const appMockupImg = require('../../../assets/images/landing/app-mockup.jpg');

// ─── Palette ─────────────────────────────────────────
const P = {
  primary: '#0c2d35',
  primaryLight: '#134750',
  accent: '#ffdf00',
  accentHover: '#e6c800',
  white: '#ffffff',
  offWhite: '#f8f8f6',
  text: '#1a1a1a',
  textMuted: '#5a5f6b',
  border: '#e4e6ea',
};

// ─── Breakpoints ─────────────────────────────────────
const useIsWide = () => {
  const { width } = useWindowDimensions();
  return width >= 768;
};
const useIsDesktop = () => {
  const { width } = useWindowDimensions();
  return width >= 1024;
};

// ─── Shared sub-components ───────────────────────────

function SectionEyebrow({ children, light }: { children: string; light?: boolean }) {
  return (
    <Text
      style={[
        s.eyebrow,
        light && { color: P.accent, backgroundColor: 'rgba(255,223,0,0.12)' },
      ]}>
      {children}
    </Text>
  );
}

function SectionHeading({ children, light, align }: { children: string; light?: boolean; align?: 'left' | 'center' }) {
  return (
    <Text style={[s.sectionHeading, light && { color: P.white }, align === 'left' && { textAlign: 'left' }]}>
      {children}
    </Text>
  );
}

function Btn({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'accent' | 'outlineLight' | 'outlineDark';
  size?: 'md' | 'lg';
}) {
  const bg =
    variant === 'primary'
      ? P.primary
      : variant === 'accent'
      ? P.accent
      : 'transparent';
  const textColor =
    variant === 'primary'
      ? P.white
      : variant === 'accent'
      ? P.primary
      : variant === 'outlineLight'
      ? P.white
      : P.primary;
  const borderColor =
    variant === 'outlineLight'
      ? 'rgba(255,255,255,0.6)'
      : variant === 'outlineDark'
      ? P.primary
      : 'transparent';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        s.btn,
        size === 'lg' && s.btnLg,
        {
          backgroundColor: bg,
          borderColor,
          borderWidth: variant === 'outlineLight' || variant === 'outlineDark' ? 2 : 0,
          opacity: pressed ? 0.85 : 1,
        },
      ]}>
      <Text style={[s.btnText, size === 'lg' && { fontSize: 16 }, { color: textColor }]}>{label}</Text>
    </Pressable>
  );
}

function FeatureIcon({ name }: { name: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={s.featureIconWrap}>
      <Ionicons name={name} size={24} color={P.accent} />
    </View>
  );
}

// ─── FAQ Item ────────────────────────────────────────
function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Pressable onPress={() => setOpen((o) => !o)} style={[s.faqItem, open && s.faqItemOpen]}>
      <View style={s.faqHeader}>
        <Text style={s.faqQuestion}>{question}</Text>
        <Text style={s.faqToggle}>{open ? '−' : '+'}</Text>
      </View>
      {open && <Text style={s.faqAnswer}>{answer}</Text>}
    </Pressable>
  );
}

// ═══════════════════════════════════════════════════════
//  MAIN LANDING PAGE COMPONENT
// ═══════════════════════════════════════════════════════

export default function LandingPage() {
  const isWide = useIsWide();
  const isDesktop = useIsDesktop();
  const insets = useSafeAreaInsets();

  const goLogin = useCallback(() => router.push('/(auth)/customer-login'), []);
  const goRegister = useCallback(() => router.push('/(auth)/register'), []);

  return (
    <View style={{ flex: 1, backgroundColor: P.white }}>
      <StatusBar style="light" />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}>

        {/* ───── HERO ───── */}
        <View style={[s.hero, isDesktop && { minHeight: 600 }]}>
          <Image source={heroImg} style={StyleSheet.absoluteFill} contentFit="cover" />
          <LinearGradient
            colors={['rgba(12,45,53,0.9)', 'rgba(12,45,53,0.55)', 'rgba(12,45,53,0.35)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={[s.heroContent, isDesktop && { maxWidth: 640, paddingVertical: 100 }, { paddingTop: Math.max(insets.top + 16, 28) }]}>
            <View style={s.logoBadge}>
              <HouseLogo width={28} height={28} />
              <Text style={s.logoText}>Simplifix</Text>
            </View>
            <Text style={[s.heroTitle, isDesktop && { fontSize: 52, lineHeight: 56 }]}>
              Smarter maintenance for modern communities
            </Text>
            <Text style={[s.heroSub, isDesktop && { fontSize: 18, lineHeight: 28 }]}>
              An AI-powered platform that takes apartment maintenance complaints from chaos to resolution — automatically.
            </Text>
            <View style={[s.heroButtons, !isWide && { flexDirection: 'column' }]}>
              <Btn label="Log In" onPress={goLogin} variant="accent" size="lg" />
              <Btn label="Create Account" onPress={goRegister} variant="outlineLight" size="lg" />
            </View>
          </View>
        </View>

        {/* ───── STATS BAR ───── */}
        <View style={s.statsBar}>
          <View style={[s.container, s.statsGrid, !isWide && { flexWrap: 'wrap' }]}>
            {[
              { num: '3', label: 'Distinct User Roles' },
              { num: '6', label: 'Complaint Categories' },
              { num: '5', label: 'Status Stages' },
              { num: '100%', label: 'AI-Powered Triage' },
            ].map((stat) => (
              <View key={stat.label} style={[s.stat, !isWide && { width: '50%' }]}>
                <Text style={s.statNum}>{stat.num}</Text>
                <Text style={s.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ───── PRODUCT OVERVIEW ───── */}
        <View style={[s.section, { backgroundColor: P.offWhite }]}>
          <View style={s.container}>
            <View style={{ alignItems: 'center' }}>
              <SectionEyebrow>The Simplifix Platform</SectionEyebrow>
              <SectionHeading>Your complete maintenance ecosystem</SectionHeading>
              <Text style={s.sectionSub}>
                We pull every moving part of your community&apos;s complaint lifecycle into one intelligent platform.
              </Text>
            </View>

            {/* Large card */}
            <View style={[s.card, isWide && { flexDirection: 'row' }]}>
              <Image
                source={residentImg}
                style={[s.cardImg, isWide && { width: '55%' }]}
                contentFit="cover"
              />
              <View style={[s.cardBody, isWide && { flex: 1, justifyContent: 'center' }]}>
                <Text style={s.cardTitle}>AI-Powered Complaint Intake</Text>
                <Text style={s.cardDesc}>
                  Residents upload a photo or video. Our multimodal AI instantly generates a detailed description, determines the category, and assigns a priority level — no forms to fill.
                </Text>
              </View>
            </View>

            {/* Two smaller cards */}
            <View style={[{ gap: 16 }, isWide && { flexDirection: 'row' }]}>
              <View style={[s.card, isWide && { flex: 1 }]}>
                <Image source={managerImg} style={s.cardImg} contentFit="cover" />
                <View style={s.cardBody}>
                  <Text style={s.cardTitle}>Centralized Manager Dashboard</Text>
                  <Text style={s.cardDesc}>
                    Review AI-processed complaints, override generated tags, assign workers, and monitor resolution times — all from a single pane.
                  </Text>
                </View>
              </View>
              <View style={[s.card, isWide && { flex: 1 }]}>
                <Image source={workerImg} style={s.cardImg} contentFit="cover" />
                <View style={s.cardBody}>
                  <Text style={s.cardTitle}>Mobile Worker Action Center</Text>
                  <Text style={s.cardDesc}>
                    Maintenance staff receive assignments in real-time, update job status on the go, and upload completion proof.
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* ───── FEATURES GRID ───── */}
        <View style={s.section}>
          <View style={s.container}>
            <View style={{ alignItems: 'center' }}>
              <SectionEyebrow>Core Features</SectionEyebrow>
              <SectionHeading>Everything you need, nothing you don&apos;t</SectionHeading>
            </View>
            <View
              style={[
                s.featuresGrid,
                isWide && { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
              ]}>
              {FEATURES.map((f) => (
                <View
                  key={f.title}
                  style={[
                    s.featureTile,
                    isDesktop ? { width: '31%' } : isWide ? { width: '47%' } : { width: '100%' },
                  ]}>
                  <FeatureIcon name={f.icon as keyof typeof Ionicons.glyphMap} />
                  <Text style={s.featureTileTitle}>{f.title}</Text>
                  <Text style={s.featureTileDesc}>{f.desc}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* ───── HOW IT WORKS ───── */}
        <View style={[s.section, { backgroundColor: P.primary }]}>
          <View style={s.container}>
            <View style={{ alignItems: 'center' }}>
              <SectionEyebrow light>How it Works</SectionEyebrow>
              <SectionHeading light>From complaint to resolution in 5 steps</SectionHeading>
            </View>
            <View style={[s.stepsContainer, isDesktop && { maxWidth: 700, alignSelf: 'center' }]}>
              {STEPS.map((step, i) => (
                <View key={step.title} style={s.step}>
                  <View style={s.stepMarker}>
                    <Text style={s.stepNum}>{i + 1}</Text>
                  </View>
                  <View style={s.stepBody}>
                    <Text style={s.stepTitle}>{step.title}</Text>
                    <Text style={s.stepDesc}>{step.desc}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* ───── ROLES / WHO IT'S FOR ───── */}
        <View style={[s.section, { backgroundColor: P.offWhite }]}>
          <View style={s.container}>
            <View style={{ alignItems: 'center' }}>
              <SectionEyebrow>Who it&apos;s For</SectionEyebrow>
              <SectionHeading>One platform, every stakeholder</SectionHeading>
              <Text style={s.sectionSub}>
                Simplifix delivers a tailored experience for each person in the maintenance workflow.
              </Text>
            </View>
            <View style={[{ gap: 16 }, isWide && { flexDirection: 'row' }]}>
              {ROLES.map((role) => (
                <View
                  key={role.title}
                  style={[
                    s.roleCard,
                    isWide && { flex: 1 },
                    role.highlight && s.roleCardHighlight,
                  ]}>
                  <View style={[s.roleIconWrap, role.highlight && { backgroundColor: 'rgba(255,223,0,0.15)' }]}>
                    <Ionicons
                      name={role.icon as keyof typeof Ionicons.glyphMap}
                      size={28}
                      color={role.highlight ? P.accent : P.primary}
                    />
                  </View>
                  <Text style={[s.roleTitle, role.highlight && { color: P.accent }]}>{role.title}</Text>
                  {role.items.map((item) => (
                    <View key={item} style={s.roleListItem}>
                      <Text style={[s.roleCheck, role.highlight && { color: P.accent }]}>✓</Text>
                      <Text style={[s.roleItemText, role.highlight && { color: 'rgba(255,255,255,0.8)' }]}>{item}</Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* ───── APP SHOWCASE ───── */}
        <View style={s.section}>
          <View style={[s.container, isWide && { flexDirection: 'row', alignItems: 'center', gap: 48 }]}>
            <View style={[isWide && { flex: 1 }]}>
              <SectionEyebrow>The Simplifix App</SectionEyebrow>
              <SectionHeading align="left">Built with React Native. Available everywhere.</SectionHeading>
              <Text style={[s.sectionSub, { textAlign: 'left', marginBottom: 24 }]}>
                Simplifix is a cross-platform mobile application built with Expo and React Native. Residents, managers, and workers all share one app — but see only the experience designed for them.
              </Text>
              <View style={s.techList}>
                {['React Native + Expo', 'FastAPI Backend', 'PostgreSQL', 'GPT-4 / Gemini AI', 'Celery + Redis', 'JWT Auth (RBAC)'].map(
                  (tech) => (
                    <View key={tech} style={s.techPill}>
                      <Text style={s.techPillText}>{tech}</Text>
                    </View>
                  )
                )}
              </View>
            </View>
            <View style={[{ alignItems: 'center' }, isWide && { flex: 1 }]}>
              <Image
                source={appMockupImg}
                style={[s.appMockup, isWide && { width: 300, height: 520 }]}
                contentFit="cover"
              />
            </View>
          </View>
        </View>

        {/* ───── FAQ ───── */}
        <View style={[s.section, { backgroundColor: P.offWhite }]}>
          <View style={s.container}>
            <View style={{ alignItems: 'center' }}>
              <SectionEyebrow>FAQ</SectionEyebrow>
              <SectionHeading>Frequently asked questions</SectionHeading>
            </View>
            <View style={[s.faqList, isDesktop && { maxWidth: 720, alignSelf: 'center' }]}>
              {FAQS.map((faq) => (
                <FaqItem key={faq.q} question={faq.q} answer={faq.a} />
              ))}
            </View>
          </View>
        </View>

        {/* ───── CTA ───── */}
        <View style={[s.section, { backgroundColor: P.accent }]}>
          <View style={[s.container, { alignItems: 'center' }]}>
            <Text style={s.ctaTitle}>Ready to simplify your community&apos;s maintenance?</Text>
            <Text style={s.ctaSub}>
              Join the future of intelligent apartment management. Simplifix turns frustration into resolution — powered by AI.
            </Text>
            <View style={[s.heroButtons, !isWide && { flexDirection: 'column', width: '100%' }]}>
              <Btn label="Log In" onPress={goLogin} variant="primary" size="lg" />
              <Btn label="Create Account" onPress={goRegister} variant="outlineDark" size="lg" />
            </View>
          </View>
        </View>

        {/* ───── FOOTER ───── */}
        <View style={s.footer}>
          <View style={[s.container, isWide && { flexDirection: 'row', gap: 48 }]}>
            <View style={[isWide && { flex: 2 }]}>
              <View style={[s.logoBadge, { marginBottom: 12 }]}>
                <HouseLogo width={22} height={22} />
                <Text style={[s.logoText, { fontSize: 18 }]}>Simplifix</Text>
              </View>
              <Text style={s.footerTagline}>
                AI-assisted complaint management for residential communities.
              </Text>
            </View>
            {FOOTER_GROUPS.map((group) => (
              <View key={group.title} style={[{ marginTop: isWide ? 0 : 28 }, isWide && { flex: 1 }]}>
                <Text style={s.footerGroupTitle}>{group.title}</Text>
                {group.links.map((link) => (
                  <Text key={link} style={s.footerLink}>{link}</Text>
                ))}
              </View>
            ))}
          </View>
          <View style={[s.footerBottom, { paddingBottom: Math.max(insets.bottom + 16, 16) }]}>
            <View style={[s.container, isWide && { flexDirection: 'row', justifyContent: 'space-between' }]}>
              <Text style={s.footerBottomText}>© 2026 Pied Piper (MAY2026-Team-048). All rights reserved.</Text>
              <Text style={s.footerBottomText}>Built for B.S. in Data Science, IIT Madras.</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Data ────────────────────────────────────────────

const FEATURES = [
  { icon: 'person-circle-outline', title: 'Role-Based Access Control', desc: 'Distinct dashboards for Residents, Managers, and Maintenance Staff. JWT-based security ensures focused workflows.' },
  { icon: 'sparkles-outline', title: 'Multimodal AI Engine', desc: 'Powered by GPT-4 / Gemini API to analyze images and videos, auto-generate descriptions, and estimate priority.' },
  { icon: 'pulse-outline', title: 'Real-Time Tracking', desc: 'Complaints move through Pending → Assigned → In Progress → Resolved → Closed. Every stakeholder stays in the loop.' },
  { icon: 'bar-chart-outline', title: 'Manager Analytics', desc: 'Resolution times, category trends, recurring issues, staff performance — data-driven decisions at a glance.' },
  { icon: 'notifications-outline', title: 'Smart Notifications', desc: 'Automated alerts for overdue tasks. If a ticket sits idle for 24 hours, workers and managers are notified.' },
  { icon: 'document-text-outline', title: 'Complete History', desc: 'Full audit trail for every ticket — from submission and AI analysis to resolution and resident rating.' },
];

const STEPS = [
  { title: 'Snap & Submit', desc: 'The resident uploads an image or video of the maintenance issue through the Simplifix app.' },
  { title: 'AI Analyzes', desc: 'Our backend triggers a background AI task that generates a description, determines the category, and assigns a priority level.' },
  { title: 'Manager Reviews', desc: 'The facility manager reviews the AI-processed ticket, verifies the details, and assigns it to the right maintenance worker.' },
  { title: 'Worker Resolves', desc: 'The assigned worker sees the ticket, performs the repair, updates the status, and uploads proof of completion.' },
  { title: 'Resident Verifies', desc: 'The resident checks the resolved status, confirms the fix, and provides a rating to officially close the complaint.' },
];

const ROLES = [
  {
    icon: 'home-outline',
    title: 'Resident',
    highlight: false,
    items: ['Submit complaints via image or video', 'Review AI-generated descriptions', 'Track real-time complaint status', 'Verify resolution and rate the work'],
  },
  {
    icon: 'desktop-outline',
    title: 'Facility Manager',
    highlight: true,
    items: ['Centralized dashboard with all tickets', 'Override AI categories and priorities', 'Assign workers to verified complaints', 'Monitor resolution times and performance'],
  },
  {
    icon: 'construct-outline',
    title: 'Maintenance Staff',
    highlight: false,
    items: ['Mobile-friendly view of assigned jobs', 'Update status: Assigned → In Progress → Resolved', 'Add closing remarks and images', 'Upload proof of resolution'],
  },
];

const FAQS = [
  { q: 'What is Simplifix?', a: 'Simplifix is an AI-assisted complaint management system designed for residential apartment communities. It streamlines the entire lifecycle of maintenance complaints — from submission through AI-powered triage to resolution and resident verification.' },
  { q: 'How does the AI analysis work?', a: 'When a resident uploads an image or video, our backend triggers an asynchronous task using Celery and Redis. The media is passed to a multimodal AI (GPT-4 / Gemini) which generates a detailed description, categorizes the issue, and estimates a priority level.' },
  { q: 'What roles does the platform support?', a: 'Simplifix uses Role-Based Access Control (RBAC) to manage three user types: Residents who submit and track complaints, Facility Managers who review, triage, and assign work, and Maintenance Staff who execute repairs and provide proof of completion.' },
  { q: 'What technology stack is used?', a: 'The frontend is built with React Native and Expo. The backend uses FastAPI with PostgreSQL, SQLAlchemy, and Alembic. AI integration uses GPT-4 or Google Gemini API. Async processing is handled by Celery with Redis.' },
  { q: 'Can managers override AI-generated data?', a: 'Yes. While the AI populates the description, category, and priority automatically, managers have full authority to review and manually override any AI-generated tags before assigning a complaint.' },
  { q: 'Is the app available for both Android and iOS?', a: 'Yes. Simplifix is built with React Native and Expo, enabling cross-platform development for both Android and iOS from a single codebase. It also supports a web target.' },
];

const FOOTER_GROUPS = [
  { title: 'Product', links: ['Features', 'How it Works', 'Who it\'s For', 'FAQ'] },
  { title: 'Tech Stack', links: ['React Native', 'FastAPI', 'PostgreSQL', 'GPT-4 / Gemini'] },
  { title: 'Team', links: ['Pied Piper', 'IIT Madras', 'GitHub'] },
];

// ─── Styles ──────────────────────────────────────────

const s = StyleSheet.create({
  // Layout
  container: {
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
    paddingHorizontal: 24,
  },
  section: {
    paddingVertical: 72,
  },

  // Hero
  hero: {
    minHeight: 500,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  heroContent: {
    padding: 28,
    paddingBottom: 48,
    maxWidth: 580,
  },
  logoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 24,
  },
  logoText: {
    fontSize: 22,
    fontFamily: FontFamily.extraBold,
    color: P.white,
    ...(Platform.OS === 'web' ? { letterSpacing: -0.5 } : {}),
  },
  heroTitle: {
    fontSize: 32,
    fontFamily: FontFamily.extraBold,
    color: P.white,
    lineHeight: 38,
    marginBottom: 24,
    ...(Platform.OS === 'web' ? { letterSpacing: -1 } : {}),
  },
  heroSub: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 26,
    marginBottom: 36,
  },
  heroButtons: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },

  // Buttons
  btn: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnLg: {
    paddingVertical: 16,
    paddingHorizontal: 36,
  },
  btnText: {
    fontFamily: FontFamily.bold,
    fontSize: 15,
  },

  // Stats
  statsBar: {
    backgroundColor: P.primary,
  },
  statsGrid: {
    flexDirection: 'row',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 28,
  },
  statNum: {
    fontSize: 28,
    fontFamily: FontFamily.extraBold,
    color: P.accent,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: FontFamily.semiBold,
    color: 'rgba(255,255,255,0.65)',
    textTransform: 'uppercase',
    ...(Platform.OS === 'web' ? { letterSpacing: 1 } : {}),
    textAlign: 'center',
  },

  // Sections
  eyebrow: {
    fontSize: 12,
    fontFamily: FontFamily.bold,
    textTransform: 'uppercase',
    color: P.primary,
    backgroundColor: 'rgba(12,45,53,0.08)',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 50,
    marginBottom: 14,
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? { letterSpacing: 2 } : {}),
  },
  sectionHeading: {
    fontSize: 28,
    fontFamily: FontFamily.extraBold,
    color: P.primary,
    textAlign: 'center',
    marginBottom: 14,
    lineHeight: 34,
    ...(Platform.OS === 'web' ? { letterSpacing: -0.5 } : {}),
  },
  sectionSub: {
    fontSize: 16,
    color: P.textMuted,
    textAlign: 'center',
    lineHeight: 26,
    maxWidth: 600,
    marginBottom: 36,
  },

  // Product cards
  card: {
    backgroundColor: P.white,
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 16,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 16 },
      android: { elevation: 3 },
      default: {},
    }),
  },
  cardImg: {
    width: '100%',
    aspectRatio: 16 / 9,
  },
  cardBody: {
    padding: 24,
  },
  cardTitle: {
    fontSize: 18,
    fontFamily: FontFamily.bold,
    color: P.primary,
    marginBottom: 10,
  },
  cardDesc: {
    fontSize: 14,
    color: P.textMuted,
    lineHeight: 22,
  },

  // Features grid
  featuresGrid: {
    gap: 16,
  },
  featureTile: {
    backgroundColor: P.offWhite,
    borderRadius: 14,
    padding: 24,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  featureIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: P.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  featureTileTitle: {
    fontSize: 16,
    fontFamily: FontFamily.bold,
    color: P.primary,
    marginBottom: 6,
  },
  featureTileDesc: {
    fontSize: 14,
    color: P.textMuted,
    lineHeight: 21,
  },

  // Steps
  stepsContainer: {
    marginTop: 40,
    width: '100%',
  },
  step: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 36,
    alignItems: 'flex-start',
  },
  stepMarker: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: P.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNum: {
    fontSize: 18,
    fontFamily: FontFamily.extraBold,
    color: P.primary,
  },
  stepBody: {
    flex: 1,
    paddingTop: 4,
  },
  stepTitle: {
    fontSize: 18,
    fontFamily: FontFamily.bold,
    color: P.accent,
    marginBottom: 4,
  },
  stepDesc: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.72)',
    lineHeight: 22,
  },

  // Roles
  roleCard: {
    backgroundColor: P.white,
    borderRadius: 18,
    padding: 28,
    borderWidth: 2,
    borderColor: P.border,
  },
  roleCardHighlight: {
    backgroundColor: P.primary,
    borderColor: P.primary,
  },
  roleIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: 'rgba(12,45,53,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  roleTitle: {
    fontSize: 20,
    fontFamily: FontFamily.bold,
    color: P.primary,
    marginBottom: 16,
  },
  roleListItem: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
    alignItems: 'flex-start',
  },
  roleCheck: {
    fontFamily: FontFamily.bold,
    color: P.primary,
    fontSize: 14,
    marginTop: 1,
  },
  roleItemText: {
    fontSize: 14,
    color: P.textMuted,
    lineHeight: 20,
    flex: 1,
  },

  // App showcase
  appMockup: {
    width: 240,
    height: 420,
    borderRadius: 24,
    marginTop: 24,
  },
  techList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  techPill: {
    backgroundColor: P.offWhite,
    borderWidth: 1,
    borderColor: P.border,
    borderRadius: 50,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  techPillText: {
    fontSize: 13,
    fontFamily: FontFamily.semiBold,
    color: P.primary,
  },

  // FAQ
  faqList: {
    width: '100%',
    gap: 10,
  },
  faqItem: {
    backgroundColor: P.white,
    borderWidth: 1,
    borderColor: P.border,
    borderRadius: 14,
    overflow: 'hidden',
  },
  faqItemOpen: {
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10 },
      android: { elevation: 2 },
      default: {},
    }),
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
  },
  faqQuestion: {
    fontSize: 15,
    fontFamily: FontFamily.semiBold,
    color: P.primary,
    flex: 1,
    marginRight: 12,
  },
  faqToggle: {
    fontSize: 20,
    fontFamily: FontFamily.bold,
    color: P.accentHover,
  },
  faqAnswer: {
    paddingHorizontal: 18,
    paddingBottom: 18,
    fontSize: 14,
    color: P.textMuted,
    lineHeight: 22,
  },

  // CTA
  ctaTitle: {
    fontSize: 26,
    fontFamily: FontFamily.extraBold,
    color: P.primary,
    textAlign: 'center',
    marginBottom: 14,
    ...(Platform.OS === 'web' ? { letterSpacing: -0.5 } : {}),
  },
  ctaSub: {
    fontSize: 16,
    color: 'rgba(12,45,53,0.65)',
    textAlign: 'center',
    lineHeight: 26,
    maxWidth: 500,
    marginBottom: 28,
  },

  // Footer
  footer: {
    backgroundColor: P.primary,
    paddingTop: 48,
  },
  footerTagline: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.65)',
    lineHeight: 22,
    maxWidth: 280,
  },
  footerGroupTitle: {
    fontSize: 12,
    fontFamily: FontFamily.bold,
    textTransform: 'uppercase',
    color: P.accent,
    marginBottom: 14,
    ...(Platform.OS === 'web' ? { letterSpacing: 1.5 } : {}),
  },
  footerLink: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.65)',
    marginBottom: 8,
  },
  footerBottom: {
    marginTop: 40,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 16,
  },
  footerBottomText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginBottom: 4,
  },
});
