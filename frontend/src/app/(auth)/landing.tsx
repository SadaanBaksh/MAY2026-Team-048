import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  LayoutChangeEvent,
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

// The hero image and everything through the capability bar are intentionally unchanged.
const heroImg = require('../../../assets/images/landing/hero-society-architectural.jpg');
const managerOperationsImg = require('../../../assets/images/landing/manager-operations-v2.jpg');
const communityServicesImg = require('../../../assets/images/landing/community-services-v2.jpg');
const appMockupImg = require('../../../assets/images/landing/customer-dashboard.png');

const P = {
  primary: '#0c8577',
  primaryDark: '#076659',
  primaryDeep: '#062F2B',
  primaryLight: '#E6F4F2',
  white: '#FFFFFF',
  canvas: '#F6F9F8',
  warm: '#F8F5F0',
  mint: '#DDF1ED',
  mintBright: '#8EDDD4',
  peach: '#FFF0E7',
  lavender: '#EEEBFF',
  sky: '#E9F3FF',
  text: '#14201E',
  textMuted: '#5D6B68',
  border: '#DAE6E3',
  borderLight: '#EAF0EE',
};

const useIsWide = () => useWindowDimensions().width >= 768;
const useIsDesktop = () => useWindowDimensions().width >= 1024;

function useReduceMotion() {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);

  return reduceMotion;
}

function SectionEyebrow({ children, dark }: { children: string; dark?: boolean }) {
  return (
    <View style={[s.eyebrow, dark && s.eyebrowDark]}>
      <View style={[s.eyebrowDot, dark && { backgroundColor: P.mintBright }]} />
      <Text style={[s.eyebrowText, dark && { color: '#B9EEE8' }]}>{children}</Text>
    </View>
  );
}

function SectionHeading({
  children,
  light,
  align = 'center',
}: {
  children: ReactNode;
  light?: boolean;
  align?: 'left' | 'center';
}) {
  return (
    <Text
      style={[
        s.sectionHeading,
        light && { color: P.white },
        align === 'left' && { textAlign: 'left', alignSelf: 'flex-start' },
      ]}
    >
      {children}
    </Text>
  );
}

function Btn({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'outlineLight' | 'outlineDark' | 'white';
  size?: 'md' | 'lg';
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const bg =
    variant === 'primary'
      ? P.primary
      : variant === 'ghost'
        ? 'rgba(12,133,119,0.08)'
        : variant === 'white'
          ? P.white
          : 'transparent';
  const textColor =
    variant === 'primary'
      ? P.white
      : variant === 'outlineLight'
        ? P.white
        : variant === 'white'
          ? P.primaryDeep
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
          opacity: pressed ? 0.86 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}
    >
      <Text style={[s.btnText, size === 'lg' && { fontSize: 16 }, { color: textColor }]}>
        {label}
      </Text>
      {icon && <Ionicons name={icon} size={16} color={textColor} />}
    </Pressable>
  );
}

function ScrollSection({
  children,
  scrollY,
  viewportHeight,
  reduceMotion,
  onLayout,
  style,
}: {
  children: ReactNode;
  scrollY: Animated.Value;
  viewportHeight: number;
  reduceMotion: boolean;
  onLayout?: (event: LayoutChangeEvent) => void;
  style?: object | object[];
}) {
  const [top, setTop] = useState<number | null>(null);
  const start = Math.max((top ?? viewportHeight * 2) - viewportHeight * 0.88, 0);
  const opacity = scrollY.interpolate({
    inputRange: [start, start + 170],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const translateY = scrollY.interpolate({
    inputRange: [start, start + 210],
    outputRange: [reduceMotion ? 0 : 42, 0],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View
      onLayout={(event) => {
        setTop(event.nativeEvent.layout.y);
        onLayout?.(event);
      }}
      style={[style, !reduceMotion && top != null && { opacity, transform: [{ translateY }] }]}
    >
      {children}
    </Animated.View>
  );
}

function AiCore({ reduceMotion }: { reduceMotion: boolean }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) return;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1800, useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0, duration: 1800, useNativeDriver: false }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse, reduceMotion]);

  return (
    <View style={s.aiCoreStage}>
      <Animated.View
        style={[
          s.aiPulseOuter,
          {
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.16, 0.38] }),
            transform: [
              { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.08] }) },
            ],
          },
        ]}
      />
      <View style={s.aiCore}>
        <LinearGradient colors={['#28B8A7', '#0C8577']} style={s.aiCoreGradient}>
          <Ionicons name="sparkles" size={30} color={P.white} />
        </LinearGradient>
      </View>
      <View style={[s.orbitChip, s.orbitChipOne]}>
        <Ionicons name="camera-outline" size={15} color={P.mintBright} />
        <Text style={s.orbitChipText}>Understands reports</Text>
      </View>
      <View style={[s.orbitChip, s.orbitChipTwo]}>
        <Ionicons name="git-merge-outline" size={15} color={P.mintBright} />
        <Text style={s.orbitChipText}>Finds duplicates</Text>
      </View>
      <View style={[s.orbitChip, s.orbitChipThree]}>
        <Ionicons name="megaphone-outline" size={15} color={P.mintBright} />
        <Text style={s.orbitChipText}>Drafts notices</Text>
      </View>
    </View>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Pressable onPress={() => setOpen((value) => !value)} style={[s.faqItem, open && s.faqOpen]}>
      <View style={s.faqHeader}>
        <Text style={s.faqQuestion}>{question}</Text>
        <View style={[s.faqToggle, open && s.faqToggleOpen]}>
          <Ionicons name={open ? 'remove' : 'add'} size={18} color={open ? P.white : P.primary} />
        </View>
      </View>
      {open && <Text style={s.faqAnswer}>{answer}</Text>}
    </Pressable>
  );
}

function MiniStatus({ color, children }: { color: string; children: string }) {
  return (
    <View style={[s.miniStatus, { backgroundColor: color }]}>
      <Text style={s.miniStatusText}>{children}</Text>
    </View>
  );
}

export default function LandingPage() {
  const isWide = useIsWide();
  const isDesktop = useIsDesktop();
  const { height: viewportHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();

  const goLogin = useCallback(() => router.push('/(auth)/customer-login'), []);
  const goRegister = useCallback(() => router.push('/(auth)/register'), []);
  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const sectionOffsets = useRef<Record<string, number>>({});

  const registerSection = useCallback(
    (key: string) => (event: LayoutChangeEvent) => {
      sectionOffsets.current[key] = event.nativeEvent.layout.y;
    },
    [],
  );
  const scrollToSection = useCallback((key: string) => {
    const y = sectionOffsets.current[key];
    if (y != null) scrollRef.current?.scrollTo({ y: Math.max(y - 24, 0), animated: true });
  }, []);

  const revealProps = { scrollY, viewportHeight, reduceMotion };

  return (
    <View style={{ flex: 1, backgroundColor: P.white }}>
      <StatusBar style="dark" />
      <Animated.ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: false,
        })}
      >
        {/* ───── LOCKED NAV BAR ───── */}
        <View style={[s.navbar, { paddingTop: Math.max(insets.top + 8, 16) }]}>
          <View style={[s.navInner, !isWide && s.navInnerMobile]}>
            <View style={s.logoBadge}>
              <View style={s.logoIconWrap}>
                <SimplifixLogo width={28} height={28} />
              </View>
              <Text style={s.logoText}>Simplifix</Text>
            </View>
            {isDesktop && (
              <View style={s.navLinks}>
                <Pressable onPress={() => scrollToSection('platform')}>
                  <Text style={s.navLink}>Platform</Text>
                </Pressable>
                <Pressable onPress={() => scrollToSection('howItWorks')}>
                  <Text style={s.navLink}>How it works</Text>
                </Pressable>
                <Pressable onPress={() => scrollToSection('whoItsFor')}>
                  <Text style={s.navLink}>Who it’s for</Text>
                </Pressable>
              </View>
            )}
            <View style={s.navActions}>
              {isWide && <Btn label="Log In" onPress={goLogin} variant="ghost" size="md" />}
              <Btn label="Get Started" onPress={goRegister} variant="primary" size="md" />
            </View>
          </View>
        </View>

        {/* ───── LOCKED HERO ───── */}
        <View style={[s.hero, !isWide && s.heroMobile, isDesktop && { minHeight: 650 }]}>
          {isWide ? (
            <>
              <Image
                source={heroImg}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                contentPosition="center"
              />
              <LinearGradient
                colors={['rgba(6,28,32,0.82)', 'rgba(6,28,32,0.50)', 'rgba(6,28,32,0.08)']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 0.78, y: 0.5 }}
                style={StyleSheet.absoluteFill}
              />
            </>
          ) : (
            <Image
              source={heroImg}
              style={s.heroMobileImage}
              contentFit="cover"
              contentPosition="right"
            />
          )}

          <View style={s.heroInner}>
            <View
              style={[
                s.heroContent,
                !isWide && s.heroContentMobile,
                isDesktop && { paddingVertical: 108 },
              ]}
            >
              <View style={s.heroAiTag}>
                <Ionicons name="business-outline" size={14} color="#A7E4DD" />
                <Text style={s.heroAiTagText}>Built for residential society managers</Text>
              </View>
              <Text
                style={[
                  s.heroTitle,
                  !isWide && s.heroTitleMobile,
                  isDesktop && { fontSize: 58, lineHeight: 64 },
                ]}
              >
                {'Run every maintenance request '}
                <Text style={s.heroTitleAccent}>from one place.</Text>
              </Text>
              <Text style={[s.heroSub, isDesktop && { fontSize: 18, lineHeight: 29 }]}>
                Simplifix uses AI to triage complaints, coordinate your maintenance team, and keep
                residents informed — all in one accountable workflow.
              </Text>
              <View style={[s.heroButtons, !isWide && s.heroButtonsMobile]}>
                <Btn label="Start for free" onPress={goRegister} variant="primary" size="lg" />
                <Btn
                  label="See how it works"
                  onPress={() => scrollToSection('howItWorks')}
                  variant="outlineLight"
                  size="lg"
                />
              </View>
              <View style={s.heroAssurance}>
                <Ionicons name="checkmark-circle" size={17} color="#A7E4DD" />
                <Text style={s.heroAssuranceText}>
                  One shared system for managers, teams, technicians, and residents
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* ───── LOCKED CAPABILITY BAR ───── */}
        <View style={s.capabilityBar}>
          <View style={[s.container, s.capabilityGrid, !isWide && s.capabilityGridMobile]}>
            {CAPABILITIES.map((item) => (
              <View key={item.title} style={[s.capability, !isWide && s.capabilityMobile]}>
                <View style={s.capabilityIcon}>
                  <Ionicons name={item.icon} size={20} color="#8EDDD4" />
                </View>
                <View style={s.capabilityCopy}>
                  <Text style={s.capabilityTitle}>{item.title}</Text>
                  <Text style={s.capabilityDetail}>{item.detail}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* ───── MANAGER VALUE / PLATFORM ───── */}
        <ScrollSection
          {...revealProps}
          onLayout={registerSection('platform')}
          style={[s.section, { backgroundColor: P.canvas }]}
        >
          <View style={s.container}>
            <View style={[s.splitHeader, isWide && s.splitHeaderWide]}>
              <View style={isWide && { flex: 1 }}>
                <SectionEyebrow>THE SIMPLIFIX PLATFORM</SectionEyebrow>
                <SectionHeading align="left">
                  Run the society.{isWide ? '\n' : ' '}
                  <Text style={s.headingAccent}>Not the inbox.</Text>
                </SectionHeading>
              </View>
              <Text style={[s.leadCopy, isWide && { flex: 0.8 }]}>
                Replace scattered calls, chats, and registers with one operational view across
                private complaints, shared community services, notices, teams, and every handoff in
                between.
              </Text>
            </View>

            <View style={[s.managerShowcase, isDesktop && s.managerShowcaseWide]}>
              <View style={[s.managerImageWrap, isDesktop && { width: '58%' }]}>
                <Image source={managerOperationsImg} style={s.coverImage} contentFit="cover" />
                <LinearGradient
                  colors={['transparent', 'rgba(5,35,31,0.76)']}
                  style={StyleSheet.absoluteFill}
                />
                <View style={s.managerImageCaption}>
                  <View style={s.liveDot} />
                  <Text style={s.managerCaptionKicker}>LIVE OPERATIONS</Text>
                  <Text style={s.managerCaptionTitle}>
                    The whole property, visible at a glance.
                  </Text>
                </View>
              </View>

              <View style={[s.commandPanel, isDesktop && { flex: 1 }]}>
                <View style={s.commandTopline}>
                  <View>
                    <Text style={s.commandEyebrow}>TODAY’S OPERATIONS</Text>
                    <Text style={s.commandTitle}>Good morning, Manager</Text>
                  </View>
                  <View style={s.avatarMini}>
                    <Text style={s.avatarMiniText}>FM</Text>
                  </View>
                </View>
                <View style={s.commandStats}>
                  {[
                    ['18', 'Open'],
                    ['07', 'In progress'],
                    ['03', 'Need attention'],
                  ].map(([value, label], index) => (
                    <View key={label} style={[s.commandStat, index === 2 && s.commandStatAlert]}>
                      <Text style={[s.commandStatValue, index === 2 && { color: '#C55A2C' }]}>
                        {value}
                      </Text>
                      <Text style={s.commandStatLabel}>{label}</Text>
                    </View>
                  ))}
                </View>
                <View style={s.queueHeader}>
                  <Text style={s.queueTitle}>Priority queue</Text>
                  <Text style={s.queueLink}>View all</Text>
                </View>
                {DASHBOARD_ROWS.map((row) => (
                  <View key={row.title} style={s.queueRow}>
                    <View style={[s.queueIcon, { backgroundColor: row.tint }]}>
                      <Ionicons name={row.icon} size={17} color={P.primaryDeep} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.queueRowTitle}>{row.title}</Text>
                      <Text style={s.queueRowMeta}>{row.meta}</Text>
                    </View>
                    <MiniStatus color={row.statusColor}>{row.status}</MiniStatus>
                  </View>
                ))}
                <View style={s.aiInsight}>
                  <View style={s.aiInsightIcon}>
                    <Ionicons name="sparkles" size={15} color={P.primary} />
                  </View>
                  <Text style={s.aiInsightText}>
                    <Text style={s.aiInsightStrong}>AI insight: </Text>Plumbing requests are up this
                    week. Consider adding one technician to the evening shift.
                  </Text>
                </View>
              </View>
            </View>

            <View style={[s.valueStrip, isWide && { flexDirection: 'row' }]}>
              {MANAGER_VALUES.map((item) => (
                <View key={item.title} style={[s.valueItem, isWide && { flex: 1 }]}>
                  <Ionicons name={item.icon} size={21} color={P.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.valueTitle}>{item.title}</Text>
                    <Text style={s.valueDesc}>{item.desc}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </ScrollSection>

        {/* ───── AI OPERATING LAYER ───── */}
        <ScrollSection {...revealProps} style={[s.section, s.aiSection]}>
          <View style={s.aiGlowTop} />
          <View style={s.container}>
            <View style={[s.aiIntro, isDesktop && { flexDirection: 'row', alignItems: 'center' }]}>
              <View style={[s.aiCopy, isDesktop && { flex: 1.05 }]}>
                <SectionEyebrow dark>AI, BUILT INTO THE WORK</SectionEyebrow>
                <SectionHeading light align="left">
                  Less manual sorting.{isWide ? '\n' : ' '}
                  <Text style={s.headingMint}>Better decisions.</Text>
                </SectionHeading>
                <Text style={s.aiLead}>
                  AI doesn’t sit in a separate chatbot. It helps at intake, coordination,
                  communication, and analysis—while your team keeps the final say.
                </Text>
                <View style={s.humanControlBadge}>
                  <Ionicons name="shield-checkmark-outline" size={17} color="#B9EEE8" />
                  <Text style={s.humanControlText}>
                    AI suggests. Your team reviews and controls.
                  </Text>
                </View>
              </View>
              <View style={[isDesktop && { flex: 0.95 }, !isDesktop && { marginTop: 42 }]}>
                <AiCore reduceMotion={reduceMotion} />
              </View>
            </View>

            <View style={[s.aiFeatureGrid, isWide && { flexDirection: 'row', flexWrap: 'wrap' }]}>
              {AI_FEATURES.map((feature, index) => (
                <Pressable
                  key={feature.title}
                  style={({ pressed }) => [
                    s.aiFeature,
                    isDesktop ? { width: '31.8%' } : isWide ? { width: '48%' } : { width: '100%' },
                    pressed && { transform: [{ translateY: -3 }] },
                  ]}
                >
                  <View style={s.aiFeatureTop}>
                    <View style={s.aiFeatureIcon}>
                      <Ionicons name={feature.icon} size={20} color={P.mintBright} />
                    </View>
                    <Text style={s.aiFeatureIndex}>0{index + 1}</Text>
                  </View>
                  <Text style={s.aiFeatureTitle}>{feature.title}</Text>
                  <Text style={s.aiFeatureDesc}>{feature.desc}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </ScrollSection>

        {/* ───── PRIVATE + COMMUNITY WORKFLOWS ───── */}
        <ScrollSection {...revealProps} style={[s.section, { backgroundColor: P.white }]}>
          <View style={s.container}>
            <View style={s.centerHeader}>
              <SectionEyebrow>ONE SYSTEM, TWO KINDS OF WORK</SectionEyebrow>
              <SectionHeading>
                Handle private fixes and shared issues{' '}
                <Text style={s.headingAccent}>beautifully.</Text>
              </SectionHeading>
              <Text style={s.sectionSub}>
                Every request gets the right workflow, the right visibility, and a complete history.
              </Text>
            </View>

            <View style={[s.workflowCards, isDesktop && { flexDirection: 'row' }]}>
              <View style={[s.workflowCard, isDesktop && { flex: 1 }]}>
                <View style={s.workflowCardTop}>
                  <View style={[s.workflowIcon, { backgroundColor: P.peach }]}>
                    <Ionicons name="home-outline" size={22} color="#AF4D29" />
                  </View>
                  <View>
                    <Text style={s.workflowLabel}>PRIVATE MAINTENANCE</Text>
                    <Text style={s.workflowTitle}>One resident. One accountable resolution.</Text>
                  </View>
                </View>
                <View style={s.ticketMock}>
                  <View style={s.ticketPhoto}>
                    <Ionicons name="water-outline" size={26} color="#317C92" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.ticketTitle}>Water leak under kitchen sink</Text>
                    <Text style={s.ticketMeta}>Tower B · 1204 · 8 min ago</Text>
                    <View style={s.ticketPills}>
                      <MiniStatus color="#FCE2D7">High priority</MiniStatus>
                      <MiniStatus color={P.mint}>Plumbing</MiniStatus>
                    </View>
                  </View>
                </View>
                <View style={s.timeline}>
                  {PRIVATE_FLOW.map((step, index) => (
                    <View key={step} style={s.timelineItem}>
                      <View style={s.timelineRail}>
                        <View style={[s.timelineDot, index === 1 && s.timelineDotActive]}>
                          {index < 1 && <Ionicons name="checkmark" size={10} color={P.white} />}
                        </View>
                        {index < PRIVATE_FLOW.length - 1 && <View style={s.timelineLine} />}
                      </View>
                      <Text style={[s.timelineText, index === 1 && s.timelineTextActive]}>
                        {step}
                      </Text>
                    </View>
                  ))}
                </View>
                <Text style={s.workflowFootnote}>
                  AI creates the summary, category, and urgency. Staff verify, assign, and resolve.
                  Residents confirm the work before closure.
                </Text>
              </View>

              <View style={[s.workflowCard, s.communityCard, isDesktop && { flex: 1 }]}>
                <Image source={communityServicesImg} style={s.communityImage} contentFit="cover" />
                <LinearGradient
                  colors={['transparent', 'rgba(4,37,33,0.91)']}
                  style={s.communityGradient}
                />
                <View style={s.communityCardCopy}>
                  <View style={s.communityPill}>
                    <Ionicons name="people-outline" size={15} color={P.white} />
                    <Text style={s.communityPillText}>COMMUNITY SERVICES</Text>
                  </View>
                  <Text style={s.communityTitle}>Many reports. One shared resolution page.</Text>
                  <Text style={s.communityDesc}>
                    Residents report common-area issues, discuss updates, and follow progress
                    together—without creating a noisy duplicate queue.
                  </Text>
                </View>
                <View style={s.mergeCard}>
                  <View style={s.mergeSpark}>
                    <Ionicons name="sparkles" size={16} color={P.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.mergeKicker}>AI SIMILARITY MATCH · 92%</Text>
                    <Text style={s.mergeTitle}>
                      3 reports may describe the same courtyard light
                    </Text>
                    <Text style={s.mergeMeta}>
                      Review and merge without losing any resident details
                    </Text>
                  </View>
                  <Ionicons name="arrow-forward" size={18} color={P.primary} />
                </View>
              </View>
            </View>
          </View>
        </ScrollSection>

        {/* ───── HOW IT WORKS ───── */}
        <ScrollSection
          {...revealProps}
          onLayout={registerSection('howItWorks')}
          style={[s.section, { backgroundColor: P.warm }]}
        >
          <View style={s.container}>
            <View style={[s.splitHeader, isWide && s.splitHeaderWide]}>
              <View style={isWide && { flex: 1 }}>
                <SectionEyebrow>HOW IT WORKS</SectionEyebrow>
                <SectionHeading align="left">
                  From “something’s wrong” to <Text style={s.headingAccent}>fully resolved.</Text>
                </SectionHeading>
              </View>
              <Text style={[s.leadCopy, isWide && { flex: 0.75 }]}>
                A structured service lifecycle keeps residents informed, teams accountable, and
                managers out of the follow-up loop.
              </Text>
            </View>

            <View style={[s.steps, isDesktop && { flexDirection: 'row' }]}>
              {STEPS.map((step, index) => (
                <View key={step.title} style={[s.stepCard, isDesktop && { flex: 1 }]}>
                  <View style={s.stepTopRow}>
                    <Text style={s.stepNumber}>0{index + 1}</Text>
                    <View style={[s.stepIcon, index === 1 && s.stepIconAi]}>
                      <Ionicons
                        name={step.icon}
                        size={20}
                        color={index === 1 ? P.white : P.primary}
                      />
                    </View>
                  </View>
                  <Text style={s.stepTitle}>{step.title}</Text>
                  <Text style={s.stepDesc}>{step.desc}</Text>
                  {step.ai && (
                    <View style={s.stepAiBadge}>
                      <Ionicons name="sparkles" size={11} color={P.primary} />
                      <Text style={s.stepAiText}>AI-assisted</Text>
                    </View>
                  )}
                  {index < STEPS.length - 1 && isDesktop && (
                    <View style={s.stepArrow}>
                      <Ionicons name="arrow-forward" size={17} color="#9EAAA7" />
                    </View>
                  )}
                </View>
              ))}
            </View>
          </View>
        </ScrollSection>

        {/* ───── NOTICES ───── */}
        <ScrollSection {...revealProps} style={[s.section, { backgroundColor: P.canvas }]}>
          <View
            style={[
              s.container,
              isDesktop && { flexDirection: 'row', gap: 72, alignItems: 'center' },
            ]}
          >
            <View style={[s.noticeVisual, isDesktop && { flex: 1.05 }]}>
              <View style={s.noticeBackdropOne} />
              <View style={s.noticeBackdropTwo} />
              <View style={s.noticeComposer}>
                <View style={s.noticeComposerTop}>
                  <View style={s.noticeIcon}>
                    <Ionicons name="megaphone-outline" size={21} color={P.primary} />
                  </View>
                  <View>
                    <Text style={s.noticeComposerTitle}>Create notice</Text>
                    <Text style={s.noticeComposerMeta}>Targeted community update</Text>
                  </View>
                </View>
                <View style={s.aiDraftBox}>
                  <View style={s.aiDraftTop}>
                    <Ionicons name="sparkles" size={14} color={P.primary} />
                    <Text style={s.aiDraftLabel}>AI DRAFT</Text>
                    <MiniStatus color={P.mint}>Editable</MiniStatus>
                  </View>
                  <Text style={s.aiDraftTitle}>Water supply maintenance</Text>
                  <Text style={s.aiDraftBody}>
                    Water supply in Towers B and C will be paused tomorrow from 10:00 AM to 12:00 PM
                    for scheduled maintenance.
                  </Text>
                </View>
                <View style={s.noticeSettings}>
                  <View style={s.noticeSetting}>
                    <Ionicons name="business-outline" size={16} color={P.textMuted} />
                    <Text style={s.noticeSettingText}>Towers B + C</Text>
                  </View>
                  <View style={s.noticeSetting}>
                    <Ionicons name="time-outline" size={16} color={P.textMuted} />
                    <Text style={s.noticeSettingText}>Tomorrow · 8:00 AM</Text>
                  </View>
                </View>
                <View style={s.noticeSendButton}>
                  <Text style={s.noticeSendText}>Schedule notice</Text>
                  <Ionicons name="arrow-forward" size={16} color={P.white} />
                </View>
              </View>
              <View style={s.noticeDelivered}>
                <View style={s.deliveredIcon}>
                  <Ionicons name="checkmark" size={13} color={P.white} />
                </View>
                <View>
                  <Text style={s.deliveredTitle}>Notice scheduled</Text>
                  <Text style={s.deliveredMeta}>Delivering to 184 residents</Text>
                </View>
              </View>
            </View>

            <View
              style={[s.noticeCopy, isDesktop && { flex: 0.95 }, !isDesktop && { marginTop: 58 }]}
            >
              <SectionEyebrow>SMART COMMUNITY NOTICES</SectionEyebrow>
              <SectionHeading align="left">
                Say the right thing, to the <Text style={s.headingAccent}>right residents.</Text>
              </SectionHeading>
              <Text style={[s.leadCopy, { marginBottom: 28 }]}>
                Turn a few rough details into a clear notice, edit it in your own voice, target
                specific towers, and schedule delivery and expiry from one flow.
              </Text>
              {NOTICE_FEATURES.map((item) => (
                <View key={item.title} style={s.checkFeature}>
                  <View style={s.checkFeatureIcon}>
                    <Ionicons name="checkmark" size={13} color={P.white} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.checkFeatureTitle}>{item.title}</Text>
                    <Text style={s.checkFeatureDesc}>{item.desc}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </ScrollSection>

        {/* ───── WHO IT IS FOR ───── */}
        <ScrollSection
          {...revealProps}
          onLayout={registerSection('whoItsFor')}
          style={[s.section, { backgroundColor: P.white }]}
        >
          <View style={s.container}>
            <View style={s.centerHeader}>
              <SectionEyebrow>BUILT AROUND YOUR TEAM</SectionEyebrow>
              <SectionHeading>
                One platform. A focused experience for{' '}
                <Text style={s.headingAccent}>every role.</Text>
              </SectionHeading>
              <Text style={s.sectionSub}>
                Managers stay in control while each person sees only the tools needed to move work
                forward.
              </Text>
            </View>
            <View style={[s.rolesGrid, isWide && { flexDirection: 'row', flexWrap: 'wrap' }]}>
              {ROLES.map((role, index) => (
                <Pressable
                  key={role.title}
                  style={({ pressed }) => [
                    s.roleCard,
                    index === 0 && s.roleCardFeatured,
                    isDesktop ? { width: '23.5%' } : isWide ? { width: '48%' } : { width: '100%' },
                    pressed && { transform: [{ translateY: -4 }] },
                  ]}
                >
                  {index === 0 && <Text style={s.roleDecisionBadge}>DECISION VIEW</Text>}
                  <View style={[s.roleIcon, index === 0 && s.roleIconFeatured]}>
                    <Ionicons
                      name={role.icon}
                      size={22}
                      color={index === 0 ? P.white : P.primary}
                    />
                  </View>
                  <Text style={[s.roleTitle, index === 0 && { color: P.white }]}>{role.title}</Text>
                  <Text style={[s.roleDesc, index === 0 && { color: 'rgba(255,255,255,0.68)' }]}>
                    {role.desc}
                  </Text>
                  <View style={s.roleLinkRow}>
                    <Text style={[s.roleLink, index === 0 && { color: '#AEE9E2' }]}>
                      {role.link}
                    </Text>
                    <Ionicons
                      name="arrow-forward"
                      size={15}
                      color={index === 0 ? '#AEE9E2' : P.primary}
                    />
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        </ScrollSection>

        {/* ───── CROSS PLATFORM ───── */}
        <ScrollSection {...revealProps} style={[s.section, s.deviceSection]}>
          <View
            style={[
              s.container,
              isDesktop && { flexDirection: 'row', alignItems: 'center', gap: 78 },
            ]}
          >
            <View style={[s.deviceCopy, isDesktop && { flex: 0.9 }]}>
              <SectionEyebrow dark>ONE CONNECTED WORKSPACE</SectionEyebrow>
              <SectionHeading light align="left">
                The office view and the field view,{' '}
                <Text style={s.headingMint}>always in sync.</Text>
              </SectionHeading>
              <Text style={s.aiLead}>
                Managers and coordinators can work from the web. Residents and maintenance teams can
                act from their phones. Every update lands in the same history.
              </Text>
              <View style={s.devicePills}>
                {['Web', 'iOS', 'Android', 'Role-based access'].map((label) => (
                  <View key={label} style={s.devicePill}>
                    <Ionicons name="checkmark-circle" size={15} color={P.mintBright} />
                    <Text style={s.devicePillText}>{label}</Text>
                  </View>
                ))}
              </View>
            </View>
            <View
              style={[s.phoneStage, isDesktop && { flex: 1.1 }, !isDesktop && { marginTop: 48 }]}
            >
              <View style={s.phoneGlow} />
              <View style={s.phoneFrame}>
                <View style={s.phoneSpeaker} />
                <Image
                  source={appMockupImg}
                  style={s.phoneImage}
                  contentFit="cover"
                  contentPosition="top"
                />
              </View>
              <View style={[s.floatingMetric, s.floatingMetricOne]}>
                <View style={[s.metricIcon, { backgroundColor: P.mint }]}>
                  <Ionicons name="checkmark-done" size={17} color={P.primary} />
                </View>
                <View>
                  <Text style={s.metricTitle}>Status updated</Text>
                  <Text style={s.metricMeta}>Resident notified instantly</Text>
                </View>
              </View>
              <View style={[s.floatingMetric, s.floatingMetricTwo]}>
                <View style={[s.metricIcon, { backgroundColor: P.lavender }]}>
                  <Ionicons name="sparkles" size={17} color="#6858A8" />
                </View>
                <View>
                  <Text style={s.metricTitle}>AI summary ready</Text>
                  <Text style={s.metricMeta}>Reviewed by facility staff</Text>
                </View>
              </View>
            </View>
          </View>
        </ScrollSection>

        {/* ───── OUTCOME STRIP ───── */}
        <ScrollSection {...revealProps} style={[s.section, { backgroundColor: P.canvas }]}>
          <View style={s.container}>
            <View style={s.centerHeader}>
              <SectionEyebrow>WHAT CHANGES FOR MANAGEMENT</SectionEyebrow>
              <SectionHeading>
                Clarity compounds across <Text style={s.headingAccent}>every operation.</Text>
              </SectionHeading>
            </View>
            <View style={[s.outcomes, isWide && { flexDirection: 'row' }]}>
              {OUTCOMES.map((outcome) => (
                <View key={outcome.title} style={[s.outcomeCard, isWide && { flex: 1 }]}>
                  <Text style={s.outcomeBefore}>{outcome.before}</Text>
                  <View style={s.outcomeArrow}>
                    <Ionicons name="arrow-forward" size={17} color={P.primary} />
                  </View>
                  <Text style={s.outcomeTitle}>{outcome.title}</Text>
                  <Text style={s.outcomeDesc}>{outcome.desc}</Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollSection>

        {/* ───── FAQ ───── */}
        <ScrollSection
          {...revealProps}
          onLayout={registerSection('faq')}
          style={[s.section, { backgroundColor: P.white }]}
        >
          <View style={s.container}>
            <View style={[s.faqLayout, isDesktop && { flexDirection: 'row', gap: 72 }]}>
              <View style={[s.faqIntro, isDesktop && { flex: 0.75 }]}>
                <SectionEyebrow>QUESTIONS, ANSWERED</SectionEyebrow>
                <SectionHeading align="left">What decision-makers usually ask.</SectionHeading>
                <Text style={s.leadCopy}>
                  Simplifix is built to make adoption practical for the people running the society
                  and simple for everyone using it.
                </Text>
              </View>
              <View
                style={[s.faqList, isDesktop && { flex: 1.25 }, !isDesktop && { marginTop: 38 }]}
              >
                {FAQS.map((faq) => (
                  <FaqItem key={faq.q} question={faq.q} answer={faq.a} />
                ))}
              </View>
            </View>
          </View>
        </ScrollSection>

        {/* ───── FINAL CTA ───── */}
        <View style={s.ctaSection}>
          <View style={s.ctaGlowOne} />
          <View style={s.ctaGlowTwo} />
          <View style={[s.container, s.ctaInner]}>
            <SectionEyebrow dark>READY FOR A CALMER OPERATION?</SectionEyebrow>
            <Text style={[s.ctaTitle, !isWide && s.ctaTitleMobile]}>
              Give your society one place to report, coordinate, communicate, and improve.
            </Text>
            <Text style={s.ctaSub}>
              Start with your team today and turn every service request into an accountable
              workflow.
            </Text>
            <View style={[s.ctaButtons, !isWide && { flexDirection: 'column', width: '100%' }]}>
              <Btn
                label="Get started free"
                onPress={goRegister}
                variant="white"
                size="lg"
                icon="arrow-forward"
              />
              <Btn label="Log in" onPress={goLogin} variant="outlineLight" size="lg" />
            </View>
          </View>
        </View>

        {/* ───── FOOTER ───── */}
        <View style={s.footer}>
          <View style={[s.container, isWide && { flexDirection: 'row', gap: 48 }]}>
            <View style={isWide && { flex: 2 }}>
              <View style={[s.logoBadge, { marginBottom: 14 }]}>
                <View style={s.logoIconWrapFooter}>
                  <SimplifixLogo width={18} height={18} />
                </View>
                <Text style={s.logoTextFooter}>Simplifix</Text>
              </View>
              <Text style={s.footerTagline}>
                AI-assisted society service management for clearer operations and better resident
                experiences.
              </Text>
            </View>
            {FOOTER_GROUPS.map((group) => (
              <View
                key={group.title}
                style={[{ marginTop: isWide ? 0 : 28 }, isWide && { flex: 1 }]}
              >
                <Text style={s.footerGroupTitle}>{group.title}</Text>
                {group.links.map((link) => {
                  const target = SECTION_KEYS[link];
                  return target ? (
                    <Pressable key={link} onPress={() => scrollToSection(target)}>
                      <Text style={s.footerLink}>{link}</Text>
                    </Pressable>
                  ) : (
                    <Text key={link} style={s.footerLink}>
                      {link}
                    </Text>
                  );
                })}
              </View>
            ))}
          </View>
          <View style={[s.footerBottom, { paddingBottom: Math.max(insets.bottom + 16, 16) }]}>
            <View
              style={[
                s.container,
                isWide && { flexDirection: 'row', justifyContent: 'space-between' },
              ]}
            >
              <Text style={s.footerBottomText}>
                © 2026 Pied Piper (MAY2026-Team-048). All rights reserved.
              </Text>
              <Text style={s.footerBottomText}>Built for B.S. in Data Science, IIT Madras.</Text>
            </View>
          </View>
        </View>
      </Animated.ScrollView>
    </View>
  );
}

const CAPABILITIES: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  detail: string;
}[] = [
  { icon: 'sparkles-outline', title: 'AI-assisted triage', detail: 'Clear tickets from day one' },
  {
    icon: 'people-outline',
    title: 'Smart assignment',
    detail: 'The right work, to the right team',
  },
  {
    icon: 'pulse-outline',
    title: 'Live status tracking',
    detail: 'Visibility from report to resolution',
  },
  {
    icon: 'shield-checkmark-outline',
    title: 'Complete audit history',
    detail: 'Every action recorded',
  },
];

const DASHBOARD_ROWS: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  meta: string;
  status: string;
  tint: string;
  statusColor: string;
}[] = [
  {
    icon: 'water-outline',
    title: 'Water leak · Tower B',
    meta: 'Assigned to Ravi · 12 min ago',
    status: 'High',
    tint: P.sky,
    statusColor: P.peach,
  },
  {
    icon: 'flash-outline',
    title: 'Corridor light · Tower A',
    meta: 'Community service · 3 reports',
    status: 'Merged',
    tint: P.lavender,
    statusColor: P.mint,
  },
  {
    icon: 'construct-outline',
    title: 'Lift inspection · Tower C',
    meta: 'In progress · Proof pending',
    status: 'Active',
    tint: P.mint,
    statusColor: P.sky,
  },
];

const MANAGER_VALUES: { icon: keyof typeof Ionicons.glyphMap; title: string; desc: string }[] = [
  {
    icon: 'layers-outline',
    title: 'One operational queue',
    desc: 'Complaints and shared services without channel-hopping.',
  },
  {
    icon: 'people-outline',
    title: 'Workload visibility',
    desc: 'See who is handling what before the backlog grows.',
  },
  {
    icon: 'analytics-outline',
    title: 'Decision-ready analytics',
    desc: 'Spot trends, recurring issues, and performance patterns.',
  },
];

const AI_FEATURES: { icon: keyof typeof Ionicons.glyphMap; title: string; desc: string }[] = [
  {
    icon: 'camera-outline',
    title: 'Report understanding',
    desc: 'Turns resident photos, videos, and notes into a clear complaint description.',
  },
  {
    icon: 'warning-outline',
    title: 'Urgency and category',
    desc: 'Suggests priority and routes each request to the right type of work.',
  },
  {
    icon: 'git-merge-outline',
    title: 'Similar-report matching',
    desc: 'Surfaces likely duplicate public reports for employee review and safe merging.',
  },
  {
    icon: 'megaphone-outline',
    title: 'Notice drafting',
    desc: 'Creates editable announcements that managers can target, schedule, and expire.',
  },
  {
    icon: 'chatbubbles-outline',
    title: 'Resident assistance',
    desc: 'Answers service questions with context from the resident’s own requests.',
  },
  {
    icon: 'trending-up-outline',
    title: 'Operational insight',
    desc: 'Helps expose recurring categories, overdue patterns, and workload pressure.',
  },
];

const PRIVATE_FLOW = [
  'AI-triaged and verified',
  'Assigned to technician',
  'Work in progress',
  'Resident verification',
  'Closed with full history',
];

const STEPS: { icon: keyof typeof Ionicons.glyphMap; title: string; desc: string; ai?: boolean }[] =
  [
    {
      icon: 'camera-outline',
      title: 'Report',
      desc: 'A resident shares media and a short note from their phone.',
    },
    {
      icon: 'sparkles',
      title: 'Understand',
      desc: 'AI suggests the description, category, priority, and similar reports.',
      ai: true,
    },
    {
      icon: 'person-add-outline',
      title: 'Coordinate',
      desc: 'Staff review the details and assign the right technician.',
    },
    {
      icon: 'construct-outline',
      title: 'Resolve',
      desc: 'The worker updates progress and adds completion proof.',
    },
    {
      icon: 'checkmark-done-outline',
      title: 'Verify',
      desc: 'The resident confirms the fix and the record closes cleanly.',
    },
  ];

const NOTICE_FEATURES = [
  { title: 'AI-assisted drafts', desc: 'Start from clear language instead of a blank page.' },
  { title: 'Precise targeting', desc: 'Send to the whole society or only the towers affected.' },
  { title: 'Scheduled lifecycle', desc: 'Choose delivery time and expiry so feeds stay relevant.' },
];

const ROLES: { icon: keyof typeof Ionicons.glyphMap; title: string; desc: string; link: string }[] =
  [
    {
      icon: 'bar-chart-outline',
      title: 'Facility managers',
      desc: 'Analytics, recurring issues, team performance, and total operational oversight.',
      link: 'Lead with clarity',
    },
    {
      icon: 'desktop-outline',
      title: 'Facility employees',
      desc: 'Review AI suggestions, merge shared reports, assign work, and manage the queue.',
      link: 'Coordinate the day',
    },
    {
      icon: 'construct-outline',
      title: 'Maintenance staff',
      desc: 'See assigned jobs, media, instructions, status steps, and completion proof.',
      link: 'Arrive prepared',
    },
    {
      icon: 'home-outline',
      title: 'Residents',
      desc: 'Report private or shared issues, follow progress, comment, verify, and rate.',
      link: 'Stay informed',
    },
  ];

const OUTCOMES = [
  {
    before: 'Scattered calls and chats',
    title: 'One source of truth',
    desc: 'Every request, comment, assignment, and update lives together.',
  },
  {
    before: 'Manual sorting and follow-ups',
    title: 'AI-assisted coordination',
    desc: 'Your team starts with structured information and acts with confidence.',
  },
  {
    before: 'Reactive reporting',
    title: 'Operational intelligence',
    desc: 'History becomes insight into workloads, patterns, and recurring problems.',
  },
];

const FAQS = [
  {
    q: 'Is Simplifix only for maintenance complaints?',
    a: 'No. Simplifix covers private apartment complaints, society-wide community service issues, shared discussions, manager notices, technician workflows, resident verification, and operational analytics in one platform.',
  },
  {
    q: 'Where does AI appear in the workflow?',
    a: 'AI helps generate complaint details, suggest categories and priorities, detect urgency, identify similar public reports for possible merging, draft manager notices, assist residents, and surface operational patterns. Human staff review and control important decisions.',
  },
  {
    q: 'Can the AI merge community reports automatically?',
    a: 'No. Simplifix suggests likely matches and shows a similarity score. A facility employee reviews the reports and decides whether to merge them, preserving the original information and resident context.',
  },
  {
    q: 'Can managers target notices to selected residents?',
    a: 'Managers can prepare editable AI-assisted drafts, target affected towers, schedule delivery, and set an expiry so residents see timely, relevant information.',
  },
  {
    q: 'Can I monitor maintenance staff performance?',
    a: 'Facility managers can review workload distribution, complaint trends, resolution time, recurring issues, resident ratings, and historical records to identify where attention is needed.',
  },
  {
    q: 'Does every role use the same interface?',
    a: 'Everyone shares the same underlying system, but each role receives a focused experience. Managers see analytics and oversight, employees coordinate work, technicians execute jobs, and residents report and track services.',
  },
];

const FOOTER_GROUPS = [
  { title: 'Product', links: ['Platform', 'How It Works', "Who It's For", 'FAQ'] },
  { title: 'Team', links: ['Pied Piper', 'IIT Madras', 'MAY2026-048'] },
];

const SECTION_KEYS: Record<string, string> = {
  Platform: 'platform',
  'How It Works': 'howItWorks',
  "Who It's For": 'whoItsFor',
  FAQ: 'faq',
};

const s = StyleSheet.create({
  container: { width: '100%', maxWidth: 1180, alignSelf: 'center', paddingHorizontal: 24 },
  section: { paddingVertical: 108, overflow: 'hidden' },
  navbar: {
    paddingBottom: 12,
    backgroundColor: P.white,
    borderBottomWidth: 1,
    borderBottomColor: P.borderLight,
    zIndex: 10,
  },
  navInner: {
    width: '100%',
    maxWidth: 1160,
    alignSelf: 'center',
    paddingHorizontal: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  navInnerMobile: { paddingHorizontal: 18 },
  navLinks: { flexDirection: 'row', alignItems: 'center', gap: 48 },
  navLink: { color: P.textMuted, fontFamily: FontFamily.semiBold, fontSize: 14 },
  navActions: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  logoBadge: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoIconWrap: {
    backgroundColor: P.primaryLight,
    borderRadius: 10,
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D4EDEA',
  },
  logoText: {
    fontSize: 20,
    fontFamily: FontFamily.extraBold,
    color: P.text,
    ...(Platform.OS === 'web' ? { letterSpacing: -0.5 } : {}),
  },
  btn: {
    paddingVertical: 13,
    paddingHorizontal: 24,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 9,
  },
  btnLg: { paddingVertical: 16, paddingHorizontal: 34 },
  btnText: { fontFamily: FontFamily.bold, fontSize: 14 },
  hero: {
    minHeight: 520,
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#071C20',
  },
  heroMobile: { minHeight: 0, justifyContent: 'flex-start' },
  heroMobileImage: { width: '100%', aspectRatio: 16 / 9 },
  heroInner: { width: '100%', maxWidth: 1160, alignSelf: 'center' },
  heroContent: { paddingHorizontal: 24, paddingVertical: 72, maxWidth: 650 },
  heroContentMobile: { paddingHorizontal: 22, paddingTop: 36, paddingBottom: 40 },
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
    marginBottom: 24,
  },
  heroAiTagText: {
    fontSize: 12,
    fontFamily: FontFamily.semiBold,
    color: '#9ADBD5',
    ...(Platform.OS === 'web' ? { letterSpacing: 0.5 } : {}),
  },
  heroTitle: {
    fontSize: 40,
    fontFamily: FontFamily.extraBold,
    color: P.white,
    lineHeight: 46,
    marginBottom: 22,
    ...(Platform.OS === 'web' ? { letterSpacing: -1.5 } : {}),
  },
  heroTitleMobile: { fontSize: 38, lineHeight: 43, marginBottom: 18 },
  heroTitleAccent: { color: '#8EDDD4' },
  heroSub: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.84)',
    lineHeight: 26,
    marginBottom: 34,
    maxWidth: 590,
  },
  heroButtons: { flexDirection: 'row', gap: 12, flexWrap: 'wrap', marginBottom: 24 },
  heroButtonsMobile: { flexDirection: 'column', alignItems: 'stretch' },
  heroAssurance: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroAssuranceText: {
    flexShrink: 1,
    fontSize: 13,
    fontFamily: FontFamily.medium,
    color: 'rgba(255,255,255,0.72)',
  },
  capabilityBar: { backgroundColor: '#102A2D' },
  capabilityGrid: { flexDirection: 'row' },
  capabilityGridMobile: { flexWrap: 'wrap', gap: 10, paddingHorizontal: 18, paddingVertical: 14 },
  capability: {
    flex: 1,
    minHeight: 104,
    paddingVertical: 24,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  capabilityMobile: {
    flex: 0,
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: 132,
    padding: 16,
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(142,221,212,0.10)',
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.035)',
  },
  capabilityIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(142,221,212,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  capabilityCopy: { flexShrink: 1 },
  capabilityTitle: { fontSize: 14, fontFamily: FontFamily.bold, color: P.white, marginBottom: 4 },
  capabilityDetail: { fontSize: 12, lineHeight: 17, color: 'rgba(255,255,255,0.52)' },
  eyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    marginBottom: 18,
  },
  eyebrowDark: {
    backgroundColor: 'rgba(142,221,212,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(142,221,212,0.15)',
    borderRadius: 50,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  eyebrowDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: P.primary },
  eyebrowText: {
    color: P.primary,
    fontFamily: FontFamily.bold,
    fontSize: 11,
    ...(Platform.OS === 'web' ? { letterSpacing: 1.5 } : {}),
  },
  sectionHeading: {
    maxWidth: 760,
    fontSize: 42,
    lineHeight: 49,
    color: P.text,
    fontFamily: FontFamily.extraBold,
    textAlign: 'center',
    alignSelf: 'center',
    ...(Platform.OS === 'web' ? { letterSpacing: -1.4 } : {}),
  },
  headingAccent: { color: P.primary },
  headingMint: { color: P.mintBright },
  sectionSub: {
    maxWidth: 650,
    marginTop: 18,
    fontSize: 16,
    lineHeight: 27,
    color: P.textMuted,
    textAlign: 'center',
  },
  splitHeader: { marginBottom: 48, gap: 20 },
  splitHeaderWide: { flexDirection: 'row', alignItems: 'flex-end', gap: 70 },
  leadCopy: { color: P.textMuted, fontSize: 16, lineHeight: 27 },
  centerHeader: { alignItems: 'center', marginBottom: 50 },
  managerShowcase: {
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: P.white,
    borderWidth: 1,
    borderColor: P.border,
  },
  managerShowcaseWide: { flexDirection: 'row', minHeight: 610 },
  managerImageWrap: { minHeight: 440, overflow: 'hidden', position: 'relative' },
  coverImage: { width: '100%', height: '100%', position: 'absolute' },
  managerImageCaption: { position: 'absolute', left: 30, right: 30, bottom: 30 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#76E2B6', marginBottom: 12 },
  managerCaptionKicker: {
    color: '#AEE9E2',
    fontFamily: FontFamily.bold,
    fontSize: 10,
    letterSpacing: 1.4,
    marginBottom: 7,
  },
  managerCaptionTitle: {
    maxWidth: 390,
    color: P.white,
    fontFamily: FontFamily.extraBold,
    fontSize: 27,
    lineHeight: 33,
  },
  commandPanel: { padding: 28, justifyContent: 'center' },
  commandTopline: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  commandEyebrow: {
    fontSize: 9,
    letterSpacing: 1.2,
    fontFamily: FontFamily.bold,
    color: P.primary,
    marginBottom: 6,
  },
  commandTitle: { fontSize: 20, fontFamily: FontFamily.bold, color: P.text },
  avatarMini: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: P.primaryDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarMiniText: { color: P.white, fontFamily: FontFamily.bold, fontSize: 11 },
  commandStats: { flexDirection: 'row', gap: 8, marginBottom: 26 },
  commandStat: {
    flex: 1,
    backgroundColor: P.canvas,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: P.borderLight,
  },
  commandStatAlert: { backgroundColor: '#FFF8F4', borderColor: '#F5DED3' },
  commandStatValue: {
    fontSize: 20,
    fontFamily: FontFamily.extraBold,
    color: P.text,
    marginBottom: 3,
  },
  commandStatLabel: { fontSize: 10, color: P.textMuted },
  queueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  queueTitle: { fontSize: 13, fontFamily: FontFamily.bold, color: P.text },
  queueLink: { fontSize: 11, fontFamily: FontFamily.semiBold, color: P.primary },
  queueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: P.borderLight,
  },
  queueIcon: {
    width: 35,
    height: 35,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  queueRowTitle: { fontSize: 12, fontFamily: FontFamily.semiBold, color: P.text, marginBottom: 3 },
  queueRowMeta: { fontSize: 9.5, color: P.textMuted },
  miniStatus: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 20,
  },
  miniStatusText: { fontSize: 9, fontFamily: FontFamily.bold, color: P.text },
  aiInsight: {
    marginTop: 20,
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    backgroundColor: P.primaryLight,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#CFE8E3',
  },
  aiInsightIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: P.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiInsightText: { flex: 1, fontSize: 10.5, lineHeight: 16, color: P.textMuted },
  aiInsightStrong: { fontFamily: FontFamily.bold, color: P.text },
  valueStrip: { marginTop: 18, gap: 12 },
  valueItem: {
    flexDirection: 'row',
    gap: 14,
    padding: 20,
    borderRadius: 16,
    backgroundColor: P.white,
    borderWidth: 1,
    borderColor: P.border,
  },
  valueTitle: { fontSize: 14, fontFamily: FontFamily.bold, color: P.text, marginBottom: 4 },
  valueDesc: { fontSize: 12, lineHeight: 18, color: P.textMuted },
  aiSection: { backgroundColor: P.primaryDeep, position: 'relative' },
  aiGlowTop: {
    position: 'absolute',
    top: -180,
    right: -120,
    width: 460,
    height: 460,
    borderRadius: 230,
    backgroundColor: 'rgba(39,184,167,0.10)',
  },
  aiIntro: { gap: 32 },
  aiCopy: { zIndex: 1 },
  aiLead: {
    maxWidth: 590,
    marginTop: 20,
    color: 'rgba(255,255,255,0.65)',
    fontSize: 16,
    lineHeight: 27,
  },
  humanControlBadge: {
    marginTop: 24,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 13,
    borderRadius: 50,
    backgroundColor: 'rgba(142,221,212,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(142,221,212,0.18)',
  },
  humanControlText: { color: '#B9EEE8', fontSize: 11.5, fontFamily: FontFamily.semiBold },
  aiCoreStage: {
    height: 330,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiPulseOuter: {
    position: 'absolute',
    width: 210,
    height: 210,
    borderRadius: 105,
    borderWidth: 1,
    borderColor: P.mintBright,
    backgroundColor: 'rgba(40,184,167,0.05)',
  },
  aiCore: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: 'rgba(255,255,255,0.06)',
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.13)',
  },
  aiCoreGradient: { flex: 1, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  orbitChip: {
    position: 'absolute',
    flexDirection: 'row',
    gap: 7,
    alignItems: 'center',
    backgroundColor: '#10423D',
    borderRadius: 50,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(142,221,212,0.18)',
  },
  orbitChipOne: { top: 18, left: '10%' },
  orbitChipTwo: { top: 72, right: '2%' },
  orbitChipThree: { bottom: 24, left: '13%' },
  orbitChipText: { color: '#D3F2EE', fontSize: 10.5, fontFamily: FontFamily.semiBold },
  aiFeatureGrid: { gap: 14, marginTop: 70 },
  aiFeature: {
    minHeight: 230,
    padding: 24,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  aiFeatureTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 28 },
  aiFeatureIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(142,221,212,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiFeatureIndex: { color: 'rgba(255,255,255,0.18)', fontFamily: FontFamily.bold, fontSize: 11 },
  aiFeatureTitle: { color: P.white, fontFamily: FontFamily.bold, fontSize: 17, marginBottom: 9 },
  aiFeatureDesc: { color: 'rgba(255,255,255,0.56)', fontSize: 13, lineHeight: 21 },
  workflowCards: { gap: 18 },
  workflowCard: {
    padding: 28,
    borderRadius: 24,
    backgroundColor: P.canvas,
    borderWidth: 1,
    borderColor: P.border,
    overflow: 'hidden',
  },
  workflowCardTop: { flexDirection: 'row', gap: 15, alignItems: 'center', marginBottom: 25 },
  workflowIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workflowLabel: {
    color: P.primary,
    fontFamily: FontFamily.bold,
    fontSize: 9.5,
    letterSpacing: 1.2,
    marginBottom: 5,
  },
  workflowTitle: {
    color: P.text,
    fontFamily: FontFamily.bold,
    fontSize: 18,
    lineHeight: 23,
    maxWidth: 360,
  },
  ticketMock: {
    flexDirection: 'row',
    gap: 13,
    padding: 15,
    backgroundColor: P.white,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: P.border,
    marginBottom: 24,
  },
  ticketPhoto: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: P.sky,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ticketTitle: { color: P.text, fontFamily: FontFamily.bold, fontSize: 13, marginBottom: 4 },
  ticketMeta: { color: P.textMuted, fontSize: 10, marginBottom: 8 },
  ticketPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  timeline: { marginLeft: 4 },
  timelineItem: { flexDirection: 'row', minHeight: 40 },
  timelineRail: { width: 24, alignItems: 'center' },
  timelineDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: P.primary,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  timelineDotActive: { backgroundColor: P.white, borderWidth: 4, borderColor: P.primary },
  timelineLine: { width: 1, flex: 1, backgroundColor: '#C8D8D4' },
  timelineText: { color: '#87928F', fontSize: 12.5, marginLeft: 10, paddingBottom: 16 },
  timelineTextActive: { color: P.text, fontFamily: FontFamily.bold },
  workflowFootnote: { marginTop: 8, color: P.textMuted, fontSize: 12, lineHeight: 19 },
  communityCard: {
    minHeight: 610,
    padding: 0,
    justifyContent: 'flex-end',
    backgroundColor: P.primaryDeep,
  },
  communityImage: { ...StyleSheet.absoluteFillObject },
  communityGradient: { ...StyleSheet.absoluteFillObject },
  communityCardCopy: { padding: 28, paddingBottom: 145 },
  communityPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(255,255,255,0.14)',
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: 50,
    marginBottom: 15,
  },
  communityPillText: {
    color: P.white,
    fontFamily: FontFamily.bold,
    fontSize: 9.5,
    letterSpacing: 1,
  },
  communityTitle: {
    color: P.white,
    fontFamily: FontFamily.extraBold,
    fontSize: 25,
    lineHeight: 31,
    marginBottom: 10,
  },
  communityDesc: { color: 'rgba(255,255,255,0.71)', fontSize: 13, lineHeight: 20 },
  mergeCard: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: P.white,
    borderRadius: 16,
    padding: 15,
  },
  mergeSpark: {
    width: 37,
    height: 37,
    borderRadius: 11,
    backgroundColor: P.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mergeKicker: {
    color: P.primary,
    fontFamily: FontFamily.bold,
    fontSize: 8.5,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  mergeTitle: { color: P.text, fontFamily: FontFamily.bold, fontSize: 11.5, marginBottom: 3 },
  mergeMeta: { color: P.textMuted, fontSize: 9.5 },
  steps: { gap: 10 },
  stepCard: {
    position: 'relative',
    padding: 22,
    borderRadius: 18,
    backgroundColor: P.white,
    borderWidth: 1,
    borderColor: '#E7E1D9',
    minHeight: 245,
  },
  stepTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 28,
  },
  stepNumber: { color: '#C6C0B8', fontFamily: FontFamily.bold, fontSize: 10, letterSpacing: 1 },
  stepIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: P.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepIconAi: { backgroundColor: P.primary },
  stepTitle: { fontSize: 16, color: P.text, fontFamily: FontFamily.bold, marginBottom: 8 },
  stepDesc: { color: P.textMuted, fontSize: 12.5, lineHeight: 20 },
  stepAiBadge: {
    marginTop: 14,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
    backgroundColor: P.primaryLight,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 30,
  },
  stepAiText: { color: P.primary, fontSize: 9.5, fontFamily: FontFamily.bold },
  stepArrow: {
    position: 'absolute',
    zIndex: 3,
    right: -15,
    top: 108,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: P.warm,
    borderWidth: 1,
    borderColor: '#DED7CD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeVisual: {
    minHeight: 560,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noticeCopy: {},
  noticeBackdropOne: {
    position: 'absolute',
    width: '88%',
    height: 420,
    borderRadius: 32,
    backgroundColor: P.mint,
    transform: [{ rotate: '-4deg' }],
  },
  noticeBackdropTwo: {
    position: 'absolute',
    width: '82%',
    height: 430,
    borderRadius: 32,
    backgroundColor: P.lavender,
    transform: [{ rotate: '4deg' }],
  },
  noticeComposer: {
    width: '88%',
    maxWidth: 470,
    backgroundColor: P.white,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: P.border,
    shadowColor: '#0A332F',
    shadowOpacity: 0.12,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 14 },
    elevation: 8,
  },
  noticeComposerTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  noticeIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: P.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeComposerTitle: {
    fontSize: 16,
    fontFamily: FontFamily.bold,
    color: P.text,
    marginBottom: 3,
  },
  noticeComposerMeta: { fontSize: 10.5, color: P.textMuted },
  aiDraftBox: {
    backgroundColor: P.canvas,
    borderRadius: 14,
    padding: 15,
    borderWidth: 1,
    borderColor: P.border,
  },
  aiDraftTop: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 11 },
  aiDraftLabel: {
    flex: 1,
    color: P.primary,
    fontFamily: FontFamily.bold,
    fontSize: 9,
    letterSpacing: 1,
  },
  aiDraftTitle: { color: P.text, fontFamily: FontFamily.bold, fontSize: 13, marginBottom: 6 },
  aiDraftBody: { color: P.textMuted, fontSize: 10.5, lineHeight: 16 },
  noticeSettings: { flexDirection: 'row', gap: 8, marginTop: 12 },
  noticeSetting: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    backgroundColor: P.white,
    borderWidth: 1,
    borderColor: P.border,
    padding: 10,
    borderRadius: 11,
  },
  noticeSettingText: { color: P.textMuted, fontSize: 9.5, flexShrink: 1 },
  noticeSendButton: {
    marginTop: 14,
    backgroundColor: P.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  noticeSendText: { color: P.white, fontFamily: FontFamily.bold, fontSize: 11 },
  noticeDelivered: {
    position: 'absolute',
    right: '1%',
    bottom: 30,
    backgroundColor: P.primaryDeep,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#062F2B',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 9,
  },
  deliveredIcon: {
    width: 25,
    height: 25,
    borderRadius: 13,
    backgroundColor: P.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deliveredTitle: { color: P.white, fontFamily: FontFamily.bold, fontSize: 10.5, marginBottom: 2 },
  deliveredMeta: { color: 'rgba(255,255,255,0.55)', fontSize: 8.5 },
  checkFeature: { flexDirection: 'row', gap: 13, marginBottom: 20 },
  checkFeatureIcon: {
    width: 25,
    height: 25,
    borderRadius: 13,
    backgroundColor: P.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkFeatureTitle: { color: P.text, fontFamily: FontFamily.bold, fontSize: 14, marginBottom: 4 },
  checkFeatureDesc: { color: P.textMuted, fontSize: 12.5, lineHeight: 19 },
  rolesGrid: { gap: 14 },
  roleCard: {
    minHeight: 285,
    padding: 24,
    borderRadius: 20,
    backgroundColor: P.canvas,
    borderWidth: 1,
    borderColor: P.border,
  },
  roleCardFeatured: { backgroundColor: P.primaryDeep, borderColor: P.primaryDeep },
  roleDecisionBadge: {
    alignSelf: 'flex-start',
    color: '#AEE9E2',
    fontFamily: FontFamily.bold,
    fontSize: 8.5,
    letterSpacing: 1.1,
    marginBottom: 15,
  },
  roleIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: P.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 21,
  },
  roleIconFeatured: { backgroundColor: 'rgba(142,221,212,0.14)' },
  roleTitle: { color: P.text, fontFamily: FontFamily.bold, fontSize: 17, marginBottom: 10 },
  roleDesc: { flex: 1, color: P.textMuted, fontSize: 12.5, lineHeight: 20 },
  roleLinkRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 20 },
  roleLink: { color: P.primary, fontFamily: FontFamily.bold, fontSize: 11.5 },
  deviceSection: { backgroundColor: '#092F2B', minHeight: 730 },
  deviceCopy: {},
  devicePills: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 28 },
  devicePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    borderRadius: 50,
    paddingVertical: 8,
    paddingHorizontal: 11,
  },
  devicePillText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 10.5,
    fontFamily: FontFamily.semiBold,
  },
  phoneStage: {
    minHeight: 530,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  phoneGlow: {
    position: 'absolute',
    width: 390,
    height: 390,
    borderRadius: 195,
    backgroundColor: 'rgba(40,184,167,0.14)',
  },
  phoneFrame: {
    width: 248,
    height: 510,
    borderRadius: 38,
    padding: 9,
    paddingTop: 18,
    backgroundColor: '#10201E',
    borderWidth: 2,
    borderColor: '#42645F',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.38,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 20 },
    elevation: 12,
  },
  phoneSpeaker: {
    position: 'absolute',
    top: 8,
    left: '37%',
    width: '26%',
    height: 5,
    borderRadius: 4,
    backgroundColor: '#31433F',
    zIndex: 3,
  },
  phoneImage: { flex: 1, borderRadius: 28, backgroundColor: P.white },
  floatingMetric: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: P.white,
    padding: 12,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 9,
  },
  floatingMetricOne: { right: 0, top: 95 },
  floatingMetricTwo: { left: 0, bottom: 85 },
  metricIcon: {
    width: 35,
    height: 35,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricTitle: { color: P.text, fontFamily: FontFamily.bold, fontSize: 10.5, marginBottom: 3 },
  metricMeta: { color: P.textMuted, fontSize: 8.5 },
  outcomes: { gap: 14 },
  outcomeCard: {
    padding: 26,
    borderRadius: 20,
    backgroundColor: P.white,
    borderWidth: 1,
    borderColor: P.border,
  },
  outcomeBefore: {
    color: '#87928F',
    fontSize: 11.5,
    textDecorationLine: 'line-through',
    marginBottom: 15,
  },
  outcomeArrow: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: P.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  outcomeTitle: { color: P.text, fontFamily: FontFamily.extraBold, fontSize: 18, marginBottom: 8 },
  outcomeDesc: { color: P.textMuted, fontSize: 12.5, lineHeight: 20 },
  faqLayout: {},
  faqIntro: {},
  faqList: { gap: 10 },
  faqItem: {
    backgroundColor: P.canvas,
    borderWidth: 1,
    borderColor: P.border,
    borderRadius: 15,
    overflow: 'hidden',
  },
  faqOpen: { backgroundColor: P.white, borderColor: '#B7DCD6' },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 19,
  },
  faqQuestion: {
    flex: 1,
    marginRight: 14,
    color: P.text,
    fontFamily: FontFamily.semiBold,
    fontSize: 14,
    lineHeight: 20,
  },
  faqToggle: {
    width: 29,
    height: 29,
    borderRadius: 15,
    backgroundColor: P.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  faqToggleOpen: { backgroundColor: P.primary },
  faqAnswer: {
    paddingHorizontal: 19,
    paddingBottom: 21,
    color: P.textMuted,
    fontSize: 13.5,
    lineHeight: 22,
  },
  ctaSection: {
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: P.primary,
    paddingVertical: 96,
  },
  ctaGlowOne: {
    position: 'absolute',
    left: -180,
    top: -220,
    width: 500,
    height: 500,
    borderRadius: 250,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  ctaGlowTwo: {
    position: 'absolute',
    right: -160,
    bottom: -260,
    width: 540,
    height: 540,
    borderRadius: 270,
    borderWidth: 80,
    borderColor: 'rgba(4,71,63,0.15)',
  },
  ctaInner: { alignItems: 'center' },
  ctaTitle: {
    maxWidth: 850,
    color: P.white,
    fontFamily: FontFamily.extraBold,
    fontSize: 45,
    lineHeight: 52,
    textAlign: 'center',
    letterSpacing: -1.3,
  },
  ctaTitleMobile: { fontSize: 33, lineHeight: 40 },
  ctaSub: {
    maxWidth: 620,
    marginTop: 18,
    color: 'rgba(255,255,255,0.72)',
    fontSize: 15,
    lineHeight: 25,
    textAlign: 'center',
  },
  ctaButtons: { flexDirection: 'row', gap: 12, marginTop: 32, justifyContent: 'center' },
  footer: { backgroundColor: '#101B19', paddingTop: 54 },
  logoIconWrapFooter: {
    backgroundColor: 'rgba(12,133,119,0.18)',
    borderRadius: 10,
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoTextFooter: { fontSize: 18, fontFamily: FontFamily.extraBold, color: P.white },
  footerTagline: { maxWidth: 330, color: 'rgba(255,255,255,0.52)', fontSize: 13.5, lineHeight: 22 },
  footerGroupTitle: {
    color: '#7DD9D0',
    fontFamily: FontFamily.bold,
    fontSize: 10,
    letterSpacing: 1.4,
    marginBottom: 15,
  },
  footerLink: { color: 'rgba(255,255,255,0.55)', fontSize: 13.5, marginBottom: 10 },
  footerBottom: {
    marginTop: 46,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
    paddingVertical: 17,
  },
  footerBottomText: {
    color: 'rgba(255,255,255,0.34)',
    fontSize: 11.5,
    textAlign: 'center',
    marginBottom: 4,
  },
});
