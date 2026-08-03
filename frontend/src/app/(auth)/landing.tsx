import Ionicons from "@react-native-vector-icons/ionicons";
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

import { SimplifixLogo } from '@/components/ui/SimplifixLogo';
import { FontFamily } from '@/constants/theme';

// ─── Images ──────────────────────────────────────────
const heroImg = require('../../../assets/images/landing/hero-banner.jpg');
const residentImg = require('../../../assets/images/landing/resident-complaint.jpg');
const managerImg = require('../../../assets/images/landing/manager-dashboard.jpg');
const workerImg = require('../../../assets/images/landing/maintenance-worker.jpg');
const appMockupImg = require('../../../assets/images/landing/customer-dashboard.png');

// ─── Palette ─────────────────────────────────────────
const P = {
  primary: '#0c8577',
  primaryDark: '#076659',
  primaryLight: '#E6F4F2',
  white: '#FFFFFF',
  offWhite: '#F7FAFA',
  mintSoft: '#EAF5F4',
  sagePastel: '#D4EDEA',
  peachPastel: '#FFF3EE',
  skyPastel: '#EEF6FF',
  lavenderPastel: '#F0EEFF',
  text: '#18201F',
  textMuted: '#57686A',
  border: '#DDE9E8',
  borderLight: '#EBF3F2',
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

function SectionEyebrow({ children, dark }: { children: string; dark?: boolean }) {
  return (
    <Text
      style={[
        s.eyebrow,
        dark && { color: '#9ADBD5', backgroundColor: 'rgba(154,219,213,0.12)' },
      ]}>
      {children}
    </Text>
  );
}

function SectionHeading({
  children,
  light,
  align,
}: {
  children: string;
  light?: boolean;
  align?: 'left' | 'center';
}) {
  return (
    <Text
      style={[
        s.sectionHeading,
        light && { color: P.white },
        align === 'left' && { textAlign: 'left' },
      ]}>
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
  variant?: 'primary' | 'ghost' | 'outlineLight' | 'outlineDark';
  size?: 'md' | 'lg';
}) {
  const bg =
    variant === 'primary'
      ? P.primary
      : variant === 'ghost'
      ? 'rgba(12,133,7,0.08)'
      : 'transparent';

  const textColor =
    variant === 'primary'
      ? P.white
      : variant === 'ghost'
      ? P.primary
      : variant === 'outlineLight'
      ? P.white
      : P.primary;

  const borderColor =
    variant === 'outlineLight'
      ? 'rgba(255,255,255,0.55)'
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
          opacity: pressed ? 0.82 : 1,
        },
      ]}>
      <Text style={[s.btnText, size === 'lg' && { fontSize: 16 }, { color: textColor }]}>
        {label}
      </Text>
    </Pressable>
  );
}

function FeatureIcon({ name, tint }: { name: keyof typeof Ionicons.glyphMap; tint?: string }) {
  return (
    <View style={[s.featureIconWrap, tint ? { backgroundColor: tint } : {}]}>
      <Ionicons name={name} size={22} color={P.primary} />
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
        <View style={[s.faqToggleWrap, open && { backgroundColor: P.primary }]}>
          <Text style={[s.faqToggle, open && { color: P.white }]}>{open ? '-' : '+'}</Text>
        </View>
      </View>
      {open && <Text style={s.faqAnswer}>{answer}</Text>}
    </Pressable>
  );
}

// ─── AI Badge ────────────────────────────────────────
function AiBadge({ label }: { label: string }) {
  return (
    <View style={s.aiBadge}>
      <Ionicons name="sparkles" size={11} color={P.primary} />
      <Text style={s.aiBadgeText}>{label}</Text>
    </View>
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
      <StatusBar style="dark" />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}>

        {/* ───── NAV BAR ───── */}
        <View
          style={[
            s.navbar,
            { paddingTop: Math.max(insets.top + 8, 16) },
            isDesktop && { paddingHorizontal: 48 },
          ]}>
          <View style={s.logoBadge}>
            <View style={s.logoIconWrap}>
              <SimplifixLogo width={28} height={28} />
            </View>
            <Text style={s.logoText}>Simplifix</Text>
          </View>
          <View style={s.navActions}>
            <Btn label="Log In" onPress={goLogin} variant="ghost" size="md" />
            <Btn label="Get Started" onPress={goRegister} variant="primary" size="md" />
          </View>
        </View>

        {/* ───── HERO ───── */}
        <View style={[s.hero, isDesktop && { minHeight: 620 }]}>
          <Image source={heroImg} style={StyleSheet.absoluteFill} contentFit="cover" />
          <LinearGradient
            colors={[
              'rgba(0,0,0,0.65)',
              'rgba(0,0,0,0.40)',
              'rgba(0,0,0,0.20)',
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />

          <View
            style={[
              s.heroContent,
              isDesktop && { maxWidth: 660, paddingVertical: 100 },
            ]}>
            <View style={s.heroAiTag}>
              <Ionicons name="sparkles" size={13} color="#9ADBD5" />
              <Text style={s.heroAiTagText}>AI-First Maintenance Platform</Text>
            </View>

            <Text style={[s.heroTitle, isDesktop && { fontSize: 54, lineHeight: 60 }]}>
              {'Maintenance complaints,\n'}
              <Text style={{ color: '#7DD9D0' }}>resolved before they escalate.</Text>
            </Text>

            <Text style={[s.heroSub, isDesktop && { fontSize: 17, lineHeight: 28 }]}>
              Simplifix gives residents a frictionless way to report issues, and gives your team
              the intelligence to resolve them — faster, smarter, and with full transparency.
            </Text>

            <View style={[s.heroButtons, !isWide && { flexDirection: 'column' }]}>
              <Btn label="Get Started Free" onPress={goRegister} variant="primary" size="lg" />
              <Btn label="Log In to Dashboard" onPress={goLogin} variant="outlineLight" size="lg" />
            </View>

            <View style={s.heroPillRow}>
              {['Snap & Submit', 'AI Triage', 'Real-Time Tracking', 'Instant Alerts'].map((p) => (
                <View key={p} style={s.heroPill}>
                  <Text style={s.heroPillText}>{p}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* ───── STATS BAR ───── */}
        <View style={s.statsBar}>
          <View style={[s.container, s.statsGrid, !isWide && { flexWrap: 'wrap' }]}>
            {[
              { num: '5', label: 'Status Stages' },
              { num: '4', label: 'User Roles' },
              { num: '100%', label: 'AI-Powered Triage' },
              { num: '<24h', label: 'SLA for Critical Issues' },
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
              <SectionHeading>One platform. Every stakeholder. Zero chaos.</SectionHeading>
              <Text style={s.sectionSub}>
                From the moment a resident snaps a photo to the moment a technician uploads proof of
                repair — every step is tracked, intelligent, and transparent.
              </Text>
            </View>

            <View style={[s.card, isWide && { flexDirection: 'row' }]}>
              <Image
                source={residentImg}
                style={[s.cardImg, isWide && { width: '52%' }]}
                contentFit="cover"
              />
              <View style={[s.cardBody, isWide && { flex: 1, justifyContent: 'center' }]}>
                <AiBadge label="AI Complaint Engine" />
                <Text style={s.cardTitle}>Residents just snap. AI does the rest.</Text>
                <Text style={s.cardDesc}>
                  Upload a photo or video of your issue — our AI instantly generates a detailed
                  description, selects the right category, and assigns a priority. No forms.
                  No guesswork. No follow-up calls.
                </Text>
                <View style={s.cardFeatureRow}>
                  {['Auto-categorization', 'Priority scoring', 'AI Summarizer'].map((tag) => (
                    <View key={tag} style={s.cardTag}>
                      <Text style={s.cardTagText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            <View style={[{ gap: 16 }, isWide && { flexDirection: 'row' }]}>
              <View style={[s.card, isWide && { flex: 1 }]}>
                <Image source={managerImg} style={s.cardImg} contentFit="cover" />
                <View style={s.cardBody}>
                  <AiBadge label="Smart Dashboard" />
                  <Text style={s.cardTitle}>Your team, always in control.</Text>
                  <Text style={s.cardDesc}>
                    Facility employees review AI-processed tickets, override details where
                    needed, assign the right technician, and monitor every SLA — from a single
                    pane of glass.
                  </Text>
                </View>
              </View>
              <View style={[s.card, isWide && { flex: 1 }]}>
                <Image source={workerImg} style={s.cardImg} contentFit="cover" />
                <View style={s.cardBody}>
                  <AiBadge label="Mobile Worker View" />
                  <Text style={s.cardTitle}>Workers arrive prepared, not surprised.</Text>
                  <Text style={s.cardDesc}>
                    Maintenance staff see the AI-generated complaint summary before they set
                    foot on site — right tools, right parts, right first time.
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* ───── AI FEATURES SPOTLIGHT ───── */}
        <View style={[s.section, { backgroundColor: P.white }]}>
          <View style={s.container}>
            <View style={{ alignItems: 'center' }}>
              <SectionEyebrow>Powered by AI</SectionEyebrow>
              <SectionHeading>Intelligence built into every step</SectionHeading>
              <Text style={s.sectionSub}>
                {'Simplifix doesn\'t bolt AI on as an afterthought. It\'s woven into the entire complaint lifecycle — from intake to closure.'}
              </Text>
            </View>

            <View
              style={[
                s.aiGrid,
                isWide && { flexDirection: 'row', flexWrap: 'wrap' },
              ]}>
              {AI_FEATURES.map((f) => (
                <View
                  key={f.title}
                  style={[
                    s.aiTile,
                    isDesktop ? { width: '47%' } : { width: '100%' },
                    { backgroundColor: f.bg },
                  ]}>
                  <View style={s.aiTileIconWrap}>
                    <Ionicons name={f.icon as keyof typeof Ionicons.glyphMap} size={24} color={P.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.aiTileTitle}>{f.title}</Text>
                    <Text style={s.aiTileDesc}>{f.desc}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* ───── HOW IT WORKS ───── */}
        <View style={[s.section, { backgroundColor: P.primaryDark }]}>
          <View style={s.container}>
            <View style={{ alignItems: 'center' }}>
              <SectionEyebrow dark>How It Works</SectionEyebrow>
              <SectionHeading light>From complaint to closed in 5 steps</SectionHeading>
              <Text style={[s.sectionSub, { color: 'rgba(255,255,255,0.60)' }]}>
                A structured workflow that eliminates the back-and-forth, so nothing slips through the cracks.
              </Text>
            </View>
            <View style={[s.stepsContainer, isDesktop && { maxWidth: 720, alignSelf: 'center' }]}>
              {STEPS.map((step, i) => (
                <View key={step.title} style={s.step}>
                  <View style={s.stepMarkerCol}>
                    <View style={s.stepMarker}>
                      <Text style={s.stepNum}>{i + 1}</Text>
                    </View>
                    {i < STEPS.length - 1 && <View style={s.stepConnector} />}
                  </View>
                  <View style={s.stepBody}>
                    <Text style={s.stepTitle}>{step.title}</Text>
                    <Text style={s.stepDesc}>{step.desc}</Text>
                    {step.badge && (
                      <View style={s.stepBadge}>
                        <Ionicons name="sparkles" size={10} color={P.primary} />
                        <Text style={s.stepBadgeText}>{step.badge}</Text>
                      </View>
                    )}
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* ───── FEATURES GRID ───── */}
        <View style={[s.section, { backgroundColor: P.offWhite }]}>
          <View style={s.container}>
            <View style={{ alignItems: 'center' }}>
              <SectionEyebrow>Core Features</SectionEyebrow>
              <SectionHeading>Everything your community needs</SectionHeading>
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
                  <FeatureIcon
                    name={f.icon as keyof typeof Ionicons.glyphMap}
                    tint={f.tint}
                  />
                  <Text style={s.featureTileTitle}>{f.title}</Text>
                  <Text style={s.featureTileDesc}>{f.desc}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* ───── ROLES / WHO IT'S FOR ───── */}
        <View style={[s.section, { backgroundColor: P.white }]}>
          <View style={s.container}>
            <View style={{ alignItems: 'center' }}>
              <SectionEyebrow>{"Who It's For"}</SectionEyebrow>
              <SectionHeading>Built for everyone in the workflow</SectionHeading>
              <Text style={s.sectionSub}>
                Simplifix delivers a precisely tailored experience for each person involved —
                from the resident who spots the issue to the manager who closes the loop.
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
                  <View
                    style={[
                      s.roleIconWrap,
                      role.highlight && { backgroundColor: 'rgba(255,255,255,0.15)' },
                    ]}>
                    <Ionicons
                      name={role.icon as keyof typeof Ionicons.glyphMap}
                      size={26}
                      color={role.highlight ? P.white : P.primary}
                    />
                  </View>
                  <Text style={[s.roleTitle, role.highlight && { color: P.white }]}>
                    {role.title}
                  </Text>
                  <Text style={[s.roleSubtitle, role.highlight && { color: 'rgba(255,255,255,0.7)' }]}>
                    {role.subtitle}
                  </Text>
                  {role.items.map((item) => (
                    <View key={item} style={s.roleListItem}>
                      <View
                        style={[
                          s.roleCheckDot,
                          role.highlight && { backgroundColor: 'rgba(255,255,255,0.25)' },
                        ]}>
                        <Ionicons
                          name="checkmark"
                          size={10}
                          color={role.highlight ? P.white : P.primary}
                        />
                      </View>
                      <Text
                        style={[
                          s.roleItemText,
                          role.highlight && { color: 'rgba(255,255,255,0.85)' },
                        ]}>
                        {item}
                      </Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* ───── APP SHOWCASE ───── */}
        <View style={[s.section, { backgroundColor: P.mintSoft }]}>
          <View
            style={[
              s.container,
              isWide && { flexDirection: 'row', alignItems: 'center', gap: 56 },
            ]}>
            <View style={[{ alignItems: 'center' }, isWide && { flex: 1 }]}>
              <Image
                source={appMockupImg}
                style={[s.appMockup, isWide && { width: 312, height: 675 }]}
                contentFit="cover"
              />
            </View>
            <View style={[isWide && { flex: 1 }]}>
              <SectionEyebrow>Cross-Platform</SectionEyebrow>
              <SectionHeading align="left">One app. Every role. Any device.</SectionHeading>
              <Text style={[s.sectionSub, { textAlign: 'left', marginBottom: 24 }]}>
                Built with React Native and Expo — residents, managers, and maintenance staff
                share one codebase but experience their own focused interface. Available on
                iOS, Android, and web.
              </Text>
              <View style={s.techList}>
                {[
                  'React Native + Expo',
                  'FastAPI Backend',
                  'PostgreSQL',
                  'AI (Gemini / GPT-4)',
                  'Celery + Redis',
                  'JWT Auth (RBAC)',
                ].map((tech) => (
                  <View key={tech} style={s.techPill}>
                    <Text style={s.techPillText}>{tech}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* ───── FAQ ───── */}
        <View style={[s.section, { backgroundColor: P.offWhite }]}>
          <View style={s.container}>
            <View style={{ alignItems: 'center' }}>
              <SectionEyebrow>FAQ</SectionEyebrow>
              <SectionHeading>Your questions, answered</SectionHeading>
            </View>
            <View style={[s.faqList, isDesktop && { maxWidth: 740, alignSelf: 'center' }]}>
              {FAQS.map((faq) => (
                <FaqItem key={faq.q} question={faq.q} answer={faq.a} />
              ))}
            </View>
          </View>
        </View>

        {/* ───── CTA ───── */}
        <View style={[s.section, { backgroundColor: P.primary }]}>
          <View style={[s.container, { alignItems: 'center' }]}>
            <View style={s.ctaIcon}>
              <Ionicons name="home" size={28} color={P.white} />
            </View>
            <Text style={s.ctaTitle}>
              {'Ready to transform your community\'s maintenance?'}
            </Text>
            <Text style={s.ctaSub}>
              Join the apartment communities that have moved from scattered WhatsApp threads
              to a single, intelligent platform. Residents get peace of mind. Your team gets results.
            </Text>
            <View style={[s.heroButtons, !isWide && { flexDirection: 'column', width: '100%' }]}>
              <Btn label="Create Your Account" onPress={goRegister} variant="ghost" size="lg" />
              <Btn label="Log In" onPress={goLogin} variant="outlineLight" size="lg" />
            </View>
          </View>
        </View>

        {/* ───── FOOTER ───── */}
        <View style={s.footer}>
          <View style={[s.container, isWide && { flexDirection: 'row', gap: 48 }]}>
            <View style={[isWide && { flex: 2 }]}>
              <View style={[s.logoBadge, { marginBottom: 12 }]}>
                <View style={s.logoIconWrapFooter}>
                  <SimplifixLogo width={18} height={18} />
                </View>
                <Text style={s.logoTextFooter}>Simplifix</Text>
              </View>
              <Text style={s.footerTagline}>
                AI-assisted maintenance complaint management for residential communities.
                Smarter resolution. Happier residents.
              </Text>
            </View>
            {FOOTER_GROUPS.map((group) => (
              <View
                key={group.title}
                style={[{ marginTop: isWide ? 0 : 28 }, isWide && { flex: 1 }]}>
                <Text style={s.footerGroupTitle}>{group.title}</Text>
                {group.links.map((link) => (
                  <Text key={link} style={s.footerLink}>
                    {link}
                  </Text>
                ))}
              </View>
            ))}
          </View>
          <View
            style={[s.footerBottom, { paddingBottom: Math.max(insets.bottom + 16, 16) }]}>
            <View
              style={[
                s.container,
                isWide && { flexDirection: 'row', justifyContent: 'space-between' },
              ]}>
              <Text style={s.footerBottomText}>
                © 2026 Pied Piper (MAY2026-Team-048). All rights reserved.
              </Text>
              <Text style={s.footerBottomText}>
                Built for B.S. in Data Science, IIT Madras.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Data ────────────────────────────────────────────

const AI_FEATURES = [
  {
    icon: 'camera-outline',
    title: 'AI Complaint Generation',
    desc: 'Residents upload a photo or video. Our AI instantly writes a precise complaint description, so maintenance staff know exactly what to bring before they arrive.',
    bg: P.mintSoft,
  },
  {
    icon: 'document-text-outline',
    title: 'AI Complaint Summarizer',
    desc: 'Long comment threads and status histories? Simplifix condenses every ticket into a crisp summary — helping managers make faster decisions without reading every line.',
    bg: P.skyPastel,
  },
  {
    icon: 'warning-outline',
    title: 'Emergency Detection',
    desc: 'When urgency keywords like "leak," "no power," or "fire" are detected, the system automatically escalates priority and alerts the team — before it becomes a crisis.',
    bg: P.peachPastel,
  },
  {
    icon: 'grid-outline',
    title: 'Smart Categorization',
    desc: 'Plumbing, electrical, civil, cleaning — the AI routes every complaint to the right category and the right specialist automatically, with a confidence score for full transparency.',
    bg: P.lavenderPastel,
  },
];

const FEATURES = [
  {
    icon: 'person-circle-outline',
    tint: P.mintSoft,
    title: 'Role-Based Access',
    desc: 'Tailored dashboards for Residents, Facility Employees, Maintenance Staff, and Facility Managers. Everyone sees exactly what they need.',
  },
  {
    icon: 'pulse-outline',
    tint: P.skyPastel,
    title: 'Real-Time Tracking',
    desc: 'Five-stage pipeline: Pending → Assigned → In Progress → Resolved → Closed. Every stakeholder knows where things stand — without a single phone call.',
  },
  {
    icon: 'notifications-outline',
    tint: P.peachPastel,
    title: 'Automated Alerts',
    desc: 'Status changes trigger instant in-app notifications. Overdue tickets surface automatically past their SLA — no manual chasing required.',
  },
  {
    icon: 'bar-chart-outline',
    tint: P.sagePastel,
    title: 'Manager Analytics',
    desc: 'Resolution times, category trends, staff performance, and satisfaction scores — the data managers need to improve operations week over week.',
  },
  {
    icon: 'chatbubbles-outline',
    tint: P.lavenderPastel,
    title: 'In-App AI Assistant',
    desc: "Residents can ask our AI chat assistant about their complaint status, assigned technician, or cost responsibility — and get an instant, accurate answer.",
  },
  {
    icon: 'shield-checkmark-outline',
    tint: P.skyPastel,
    title: 'Full Audit Trail',
    desc: 'Every assignment, status change, and remark is recorded. Disputes are resolved with facts, not memory.',
  },
];

const STEPS = [
  {
    title: 'Snap & Submit',
    desc: 'The resident uploads a photo or video — or adds a voice note — directly from their phone.',
    badge: undefined as string | undefined,
  },
  {
    title: 'AI Analyzes & Categorizes',
    desc: 'Our AI engine reads the media, writes a detailed description, assigns a category, detects urgency, and scores priority — all in seconds.',
    badge: 'AI-Powered',
  },
  {
    title: 'Team Reviews & Assigns',
    desc: 'The facility employee reviews the AI-processed ticket, verifies or overrides the details, and assigns it to the best-suited maintenance worker.',
    badge: undefined as string | undefined,
  },
  {
    title: 'Worker Resolves',
    desc: 'The technician arrives prepared, performs the repair, updates the status, and uploads proof of completion.',
    badge: undefined as string | undefined,
  },
  {
    title: 'Resident Verifies & Rates',
    desc: 'The resident confirms the fix and submits a rating — officially closing the complaint and feeding data back into the analytics engine.',
    badge: undefined as string | undefined,
  },
];

const ROLES = [
  {
    icon: 'home-outline',
    title: 'Residents',
    subtitle: 'For apartment owners & tenants',
    highlight: false,
    items: [
      'Submit complaints with a photo, video, or voice note',
      'Review & confirm AI-generated descriptions',
      'Track status end-to-end in real time',
      'Know who is assigned and when work begins',
      'Verify completion and rate the service',
    ],
  },
  {
    icon: 'desktop-outline',
    title: 'Facility Team',
    subtitle: 'For managers & employees',
    highlight: true,
    items: [
      'Centralized dashboard with all active tickets',
      'Override AI categories, priority, and cost details',
      'Smart worker assignment ranked by skill & workload',
      'Auto-flagged overdue tickets — no manual monitoring',
      'Analytics, audit trails, and performance reports',
    ],
  },
  {
    icon: 'construct-outline',
    title: 'Maintenance Staff',
    subtitle: 'For technicians & workers',
    highlight: false,
    items: [
      'AI complaint summary before arriving on site',
      'Mobile-friendly view of active assignments',
      'Update status: Assigned to In Progress to Resolved',
      'Upload proof-of-work photos and remarks',
      'Fewer repeat visits with better upfront information',
    ],
  },
];

const FAQS = [
  {
    q: 'What is Simplifix?',
    a: 'Simplifix is an AI-powered complaint management platform built for residential apartment communities. It covers the entire maintenance lifecycle — from a resident snapping a photo, to AI-powered triage, to worker assignment, resolution, and resident verification.',
  },
  {
    q: 'How does the AI work?',
    a: 'When a resident uploads media, our system analyzes it using a multimodal AI (GPT-4 / Gemini) to generate a precise complaint description, select the correct maintenance category, and assign a priority level. Urgency keywords like "leak" or "no power" automatically escalate the priority.',
  },
  {
    q: 'What is the AI Summarizer?',
    a: "The AI Summarizer condenses a complaint's full comment thread, status history, and assignment details into a concise summary. This helps managers quickly understand a ticket's situation without reading through every update.",
  },
  {
    q: "Can managers override the AI's decisions?",
    a: 'Absolutely. AI suggestions are a starting point, not a final word. Facility employees can review and override the generated description, category, priority, and cost responsibility before assigning any complaint.',
  },
  {
    q: 'What user roles does Simplifix support?',
    a: 'Simplifix supports four roles: Residents (submit and track complaints), Facility Employees (coordinate and assign), Maintenance Staff (execute repairs), and Facility Managers (monitor analytics and performance). Each role sees a focused, purpose-built interface.',
  },
  {
    q: 'Is Simplifix available on iOS and Android?',
    a: 'Yes. Simplifix is built with React Native and Expo, making it fully cross-platform across iOS, Android, and web from a single codebase.',
  },
];

const FOOTER_GROUPS = [
  { title: 'Product', links: ['Features', 'How It Works', "Who It's For", 'FAQ'] },
  { title: 'Technology', links: ['React Native', 'FastAPI', 'PostgreSQL', 'AI (GPT-4 / Gemini)'] },
  { title: 'Team', links: ['Pied Piper', 'IIT Madras', 'MAY2026-048'] },
];

// ─── Styles ──────────────────────────────────────────

const s = StyleSheet.create({
  // Layout
  container: {
    width: '100%',
    maxWidth: 1160,
    alignSelf: 'center',
    paddingHorizontal: 24,
  },
  section: {
    paddingVertical: 80,
  },

  // Navbar
  navbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 14,
    backgroundColor: P.white,
    borderBottomWidth: 1,
    borderBottomColor: P.borderLight,
    zIndex: 10,
  },
  navActions: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },

  // Logo
  logoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 0,
  },
  logoIconWrap: {
    backgroundColor: P.primaryLight,
    borderRadius: 10,
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: P.sagePastel,
  },
  logoIconWrapFooter: {
    backgroundColor: 'rgba(12,133,119,0.18)',
    borderRadius: 10,
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 20,
    fontFamily: FontFamily.extraBold,
    color: P.text,
    ...(Platform.OS === 'web' ? { letterSpacing: -0.5 } : {}),
  },
  logoTextFooter: {
    fontSize: 18,
    fontFamily: FontFamily.extraBold,
    color: P.white,
    ...(Platform.OS === 'web' ? { letterSpacing: -0.5 } : {}),
  },

  // Hero
  hero: {
    minHeight: 520,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  heroContent: {
    padding: 32,
    paddingBottom: 52,
    maxWidth: 600,
  },
  heroAiTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(154,219,213,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(154,219,213,0.38)',
    borderRadius: 50,
    paddingVertical: 6,
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
    marginBottom: 20,
  },
  heroAiTagText: {
    fontSize: 12,
    fontFamily: FontFamily.semiBold,
    color: '#9ADBD5',
    ...(Platform.OS === 'web' ? { letterSpacing: 0.5 } : {}),
  },
  heroTitle: {
    fontSize: 36,
    fontFamily: FontFamily.extraBold,
    color: P.white,
    lineHeight: 44,
    marginBottom: 20,
    ...(Platform.OS === 'web' ? { letterSpacing: -1 } : {}),
  },
  heroSub: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.80)',
    lineHeight: 26,
    marginBottom: 32,
  },
  heroButtons: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
    marginBottom: 28,
  },
  heroPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  heroPill: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    borderRadius: 50,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  heroPillText: {
    fontSize: 12,
    fontFamily: FontFamily.medium,
    color: 'rgba(255,255,255,0.80)',
  },

  // Buttons
  btn: {
    paddingVertical: 13,
    paddingHorizontal: 24,
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
    fontSize: 14,
  },

  // Stats
  statsBar: {
    backgroundColor: P.text,
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
    fontSize: 26,
    fontFamily: FontFamily.extraBold,
    color: '#7DD9D0',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: FontFamily.semiBold,
    color: 'rgba(255,255,255,0.55)',
    textTransform: 'uppercase',
    ...(Platform.OS === 'web' ? { letterSpacing: 1 } : {}),
    textAlign: 'center',
  },

  // Sections
  eyebrow: {
    fontSize: 11,
    fontFamily: FontFamily.bold,
    textTransform: 'uppercase',
    color: P.primary,
    backgroundColor: P.primaryLight,
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 50,
    marginBottom: 14,
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? { letterSpacing: 1.5 } : {}),
    alignSelf: 'center',
  },
  sectionHeading: {
    fontSize: 30,
    fontFamily: FontFamily.extraBold,
    color: P.text,
    textAlign: 'center',
    marginBottom: 14,
    lineHeight: 38,
    ...(Platform.OS === 'web' ? { letterSpacing: -0.5 } : {}),
  },
  sectionSub: {
    fontSize: 16,
    color: P.textMuted,
    textAlign: 'center',
    lineHeight: 26,
    maxWidth: 580,
    marginBottom: 40,
  },

  // Product cards
  card: {
    backgroundColor: P.white,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: P.border,
  },
  cardImg: {
    width: '100%',
    aspectRatio: 16 / 9,
  },
  cardBody: {
    padding: 28,
  },
  cardTitle: {
    fontSize: 20,
    fontFamily: FontFamily.bold,
    color: P.text,
    marginBottom: 10,
    marginTop: 10,
    ...(Platform.OS === 'web' ? { letterSpacing: -0.3 } : {}),
  },
  cardDesc: {
    fontSize: 14,
    color: P.textMuted,
    lineHeight: 23,
  },
  cardFeatureRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  cardTag: {
    backgroundColor: P.primaryLight,
    borderRadius: 50,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  cardTagText: {
    fontSize: 12,
    fontFamily: FontFamily.semiBold,
    color: P.primary,
  },

  // AI Badge (inline)
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: P.primaryLight,
    borderRadius: 50,
    paddingVertical: 4,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
  },
  aiBadgeText: {
    fontSize: 11,
    fontFamily: FontFamily.bold,
    color: P.primary,
    ...(Platform.OS === 'web' ? { letterSpacing: 0.5 } : {}),
  },

  // AI Features grid
  aiGrid: {
    gap: 14,
    justifyContent: 'center',
  },
  aiTile: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    borderRadius: 16,
    padding: 22,
    borderWidth: 1,
    borderColor: P.border,
  },
  aiTileIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: P.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: P.border,
  },
  aiTileTitle: {
    fontSize: 15,
    fontFamily: FontFamily.bold,
    color: P.text,
    marginBottom: 5,
  },
  aiTileDesc: {
    fontSize: 13,
    color: P.textMuted,
    lineHeight: 20,
  },

  // Features grid
  featuresGrid: {
    gap: 14,
  },
  featureTile: {
    backgroundColor: P.white,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: P.border,
  },
  featureIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: P.mintSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  featureTileTitle: {
    fontSize: 15,
    fontFamily: FontFamily.bold,
    color: P.text,
    marginBottom: 6,
  },
  featureTileDesc: {
    fontSize: 13,
    color: P.textMuted,
    lineHeight: 21,
  },

  // Steps
  stepsContainer: {
    marginTop: 44,
    width: '100%',
  },
  step: {
    flexDirection: 'row',
    gap: 20,
    alignItems: 'flex-start',
  },
  stepMarkerCol: {
    alignItems: 'center',
    width: 48,
  },
  stepMarker: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(154,219,213,0.40)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepConnector: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(154,219,213,0.20)',
    marginTop: 4,
    marginBottom: 4,
  },
  stepNum: {
    fontSize: 17,
    fontFamily: FontFamily.extraBold,
    color: P.white,
  },
  stepBody: {
    flex: 1,
    paddingTop: 8,
    paddingBottom: 24,
  },
  stepTitle: {
    fontSize: 17,
    fontFamily: FontFamily.bold,
    color: '#9ADBD5',
    marginBottom: 5,
  },
  stepDesc: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.65)',
    lineHeight: 22,
  },
  stepBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: P.primaryLight,
    borderRadius: 50,
    paddingVertical: 3,
    paddingHorizontal: 9,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  stepBadgeText: {
    fontSize: 10,
    fontFamily: FontFamily.bold,
    color: P.primary,
    ...(Platform.OS === 'web' ? { letterSpacing: 0.5 } : {}),
  },

  // Roles
  roleCard: {
    backgroundColor: P.white,
    borderRadius: 20,
    padding: 28,
    borderWidth: 2,
    borderColor: P.border,
  },
  roleCardHighlight: {
    backgroundColor: '#1B2E2C',
    borderColor: '#1B2E2C',
  },
  roleIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: P.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  roleTitle: {
    fontSize: 19,
    fontFamily: FontFamily.bold,
    color: P.text,
    marginBottom: 4,
  },
  roleSubtitle: {
    fontSize: 13,
    color: P.textMuted,
    fontFamily: FontFamily.medium,
    marginBottom: 16,
  },
  roleListItem: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
    alignItems: 'flex-start',
  },
  roleCheckDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: P.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  roleItemText: {
    fontSize: 13,
    color: P.textMuted,
    lineHeight: 20,
    flex: 1,
  },

  // App showcase
  appMockup: {
    width: 220,
    height: 390,
    borderRadius: 24,
    marginTop: 24,
    marginBottom: 24,
  },
  techList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  techPill: {
    backgroundColor: P.white,
    borderWidth: 1,
    borderColor: P.border,
    borderRadius: 50,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  techPillText: {
    fontSize: 12,
    fontFamily: FontFamily.semiBold,
    color: P.text,
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
    borderColor: P.primary,
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
  },
  faqQuestion: {
    fontSize: 14,
    fontFamily: FontFamily.semiBold,
    color: P.text,
    flex: 1,
    marginRight: 12,
    lineHeight: 20,
  },
  faqToggleWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: P.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  faqToggle: {
    fontSize: 16,
    fontFamily: FontFamily.bold,
    color: P.primary,
    lineHeight: 20,
  },
  faqAnswer: {
    paddingHorizontal: 18,
    paddingBottom: 20,
    fontSize: 14,
    color: P.textMuted,
    lineHeight: 22,
  },

  // CTA
  ctaIcon: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  ctaTitle: {
    fontSize: 28,
    fontFamily: FontFamily.extraBold,
    color: P.white,
    textAlign: 'center',
    marginBottom: 14,
    ...(Platform.OS === 'web' ? { letterSpacing: -0.5 } : {}),
    maxWidth: 520,
  },
  ctaSub: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.70)',
    textAlign: 'center',
    lineHeight: 26,
    maxWidth: 480,
    marginBottom: 32,
  },

  // Footer
  footer: {
    backgroundColor: P.text,
    paddingTop: 52,
  },
  footerTagline: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 22,
    maxWidth: 300,
  },
  footerGroupTitle: {
    fontSize: 11,
    fontFamily: FontFamily.bold,
    textTransform: 'uppercase',
    color: '#7DD9D0',
    marginBottom: 14,
    ...(Platform.OS === 'web' ? { letterSpacing: 1.5 } : {}),
  },
  footerLink: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.55)',
    marginBottom: 9,
    fontFamily: FontFamily.regular,
  },
  footerBottom: {
    marginTop: 44,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
    paddingVertical: 16,
  },
  footerBottomText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.38)',
    textAlign: 'center',
    marginBottom: 4,
  },
});
