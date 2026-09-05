import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  useColorScheme,
} from "react-native";
import Svg, {
  Path,
  Circle,
  Line,
  G,
  Text as SvgText,
} from "react-native-svg";

export interface CreditScoreModalProps {
  visible: boolean;
  onClose: () => void;
  creditScore: number;
  paymentHistoryCount: number;
  activeLoansCount: number;
  creditUtilizationPct: number;
}

export const CreditScoreModal: React.FC<CreditScoreModalProps> = ({
  visible,
  onClose,
  creditScore = 650,
  paymentHistoryCount = 0,
  activeLoansCount = 0,
  creditUtilizationPct = 0,
}) => {
  const systemColorScheme = useColorScheme();
  const isDark = systemColorScheme === "dark";

  const theme = {
    overlayBg: isDark ? "rgba(0, 0, 0, 0.75)" : "rgba(15, 23, 42, 0.65)",
    contentBg: isDark ? "#1E293B" : "#FFFFFF",
    dragHandleBg: isDark ? "#475569" : "#E2E8F0",
    textPrimary: isDark ? "#F8FAFC" : "#0F172A",
    textSecondary: isDark ? "#94A3B8" : "#64748B",
    closeBtnBg: isDark ? "#334155" : "#F8FAFC",
    closeBtnBorder: isDark ? "#475569" : "#F1F5F9",
    metricBoxBg: isDark ? "#0F172A" : "#F8FAFC",
    metricBoxBorder: isDark ? "#334155" : "#F1F5F9",
    gaugeBaseTrack: isDark ? "#334155" : "#E2E8F0",
    gaugeTick: isDark ? "#475569" : "#CBD5E1",
    centerCircleFill: isDark ? "#1E293B" : "#FFFFFF",
    needleShadow: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(15, 23, 42, 0.08)",
  };

  const MIN_SCORE = 300;
  const MAX_SCORE = 850;

  const clampedScore = Math.max(
    MIN_SCORE,
    Math.min(MAX_SCORE, Number(creditScore) || MIN_SCORE)
  );

  const [displayedScore, setDisplayedScore] = useState(MIN_SCORE);

  // Animated values
  const textScoreAnim = useRef(new Animated.Value(MIN_SCORE)).current;
  const needleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let listenerId: string | null = null;

    if (visible) {
      textScoreAnim.setValue(MIN_SCORE);
      needleAnim.setValue(0);
      setDisplayedScore(MIN_SCORE);

      listenerId = textScoreAnim.addListener(({ value }) => {
        setDisplayedScore(Math.round(value));
      });

      const targetRatio = (clampedScore - MIN_SCORE) / (MAX_SCORE - MIN_SCORE);

      Animated.parallel([
        Animated.timing(needleAnim, {
          toValue: targetRatio,
          duration: 1200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(textScoreAnim, {
          toValue: clampedScore,
          duration: 1200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
      ]).start();
    } else {
      textScoreAnim.setValue(MIN_SCORE);
      needleAnim.setValue(0);
      setDisplayedScore(MIN_SCORE);
    }

    return () => {
      if (listenerId) {
        textScoreAnim.removeListener(listenerId);
      }
    };
  }, [visible, clampedScore]);

  const needleRotation = needleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["-90deg", "90deg"],
  });

  const size = 280;
  const centerX = size / 2;
  const centerY = 140;

  const radius = 105;
  const strokeWidth = 22;

  const scoreToAngle = (score: number) => {
    const ratio = (score - MIN_SCORE) / (MAX_SCORE - MIN_SCORE);
    return 180 - ratio * 180;
  };

  const polarToCartesian = (
    cx: number,
    cy: number,
    r: number,
    angle: number
  ) => {
    const angleInRadians = (angle * Math.PI) / 180;

    return {
      x: cx + r * Math.cos(angleInRadians),
      y: cy - r * Math.sin(angleInRadians),
    };
  };

  const describeArc = (
    startAngle: number,
    endAngle: number,
    customRadius = radius
  ) => {
    const start = polarToCartesian(
      centerX,
      centerY,
      customRadius,
      startAngle
    );

    const end = polarToCartesian(
      centerX,
      centerY,
      customRadius,
      endAngle
    );

    const largeArcFlag = Math.abs(startAngle - endAngle) > 180 ? 1 : 0;

    return `
      M ${start.x} ${start.y}
      A ${customRadius} ${customRadius}
      0 ${largeArcFlag} 0
      ${end.x} ${end.y}
    `;
  };

  const getScoreColor = (score: number) => {
    if (score >= 800) return "#10B981";
    if (score >= 740) return "#3B82F6";
    if (score >= 670) return "#10B981";
    if (score >= 580) return "#F59E0B";
    return "#EF4444";
  };

  const getScoreRating = (score: number) => {
    if (score >= 800) return "Exceptional";
    if (score >= 740) return "Very Good";
    if (score >= 670) return "Good";
    if (score >= 580) return "Fair";
    return "Poor";
  };

  const currentColor = getScoreColor(displayedScore);
  const needleLength = 82;

  const tickScores = [300, 450, 580, 670, 740, 850];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={[styles.analyticsOverlay, { backgroundColor: theme.overlayBg }]}>
        <TouchableOpacity
          style={styles.backdropClickable}
          activeOpacity={1}
          onPress={onClose}
        />

        <View style={[styles.analyticsContent, { backgroundColor: theme.contentBg }]}>
          <View style={[styles.dragHandle, { backgroundColor: theme.dragHandleBg }]} />

          <View style={styles.analyticsHeader}>
            <View>
              <Text style={[styles.analyticsTitle, { color: theme.textPrimary }]}>
                Credit Score
              </Text>
              <Text style={[styles.analyticsSubtitle, { color: theme.textSecondary }]}>
                Real-time credit rating analysis
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.analyticsCloseButton,
                {
                  backgroundColor: theme.closeBtnBg,
                  borderColor: theme.closeBtnBorder,
                },
              ]}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={[styles.analyticsCloseText, { color: theme.textSecondary }]}>
                ✕
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.gaugeContainer}>
            <Svg width={size} height={190} viewBox={`0 0 ${size} 190`}>
              {/* Arc background base track */}
              <Path
                d={describeArc(180, 0)}
                fill="none"
                stroke={""}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
              />

              {tickScores.map((score) => {
                const angle = scoreToAngle(score);

                const outer = polarToCartesian(
                  centerX,
                  centerY,
                  radius + 16,
                  angle
                );

                const inner = polarToCartesian(
                  centerX,
                  centerY,
                  radius + 8,
                  angle
                );

                return (
                  <Line
                    key={score}
                    x1={inner.x}
                    y1={inner.y}
                    x2={outer.x}
                    y2={outer.y}
                    stroke={theme.gaugeTick}
                    strokeWidth={1.5}
                    strokeLinecap="round"
                  />
                );
              })}

              <Circle
                cx={centerX}
                cy={centerY}
                r={10}
                fill={theme.centerCircleFill}
                stroke={currentColor}
                strokeWidth={4}
              />

              <SvgText
                x={centerX - radius - 12}
                y={centerY + 22}
                fontSize="11"
                fontWeight="700"
                fill={theme.textSecondary}
                textAnchor="middle"
              >
                300
              </SvgText>

              <SvgText
                x={centerX}
                y={24}
                fontSize="11"
                fontWeight="700"
                fill={theme.textSecondary}
                textAnchor="middle"
              >
                580
              </SvgText>

              <SvgText
                x={centerX + radius + 12}
                y={centerY + 22}
                fontSize="11"
                fontWeight="700"
                fill={theme.textSecondary}
                textAnchor="middle"
              >
                850
              </SvgText>
            </Svg>

            {/* Smooth Animated Needle overlayed to support native driver transforms cleanly */}
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <Animated.View
                style={{
                  position: "absolute",
                  left: centerX,
                  top: centerY,
                  width: 0,
                  height: 0,
                  transform: [{ rotate: needleRotation }],
                }}
              >
                <Svg
                  width={size}
                  height={190}
                  viewBox={`0 0 ${size} 190`}
                  style={{ overflow: "visible", left: -centerX, top: -centerY }}
                >
                  <G>
                    <Line
                      x1={centerX + 2}
                      y1={centerY + 2}
                      x2={centerX + 2}
                      y2={centerY - needleLength + 2}
                      stroke={theme.needleShadow}
                      strokeWidth={6}
                      strokeLinecap="round"
                    />

                    <Line
                      x1={centerX}
                      y1={centerY}
                      x2={centerX}
                      y2={centerY - needleLength}
                      stroke={currentColor}
                      strokeWidth={4}
                      strokeLinecap="round"
                    />

                    <Circle
                      cx={centerX}
                      cy={centerY - needleLength}
                      r={4}
                      fill={currentColor}
                    />
                  </G>
                </Svg>
              </Animated.View>
            </View>

            <View style={styles.gaugeTextOverlay}>
              <Text style={[styles.gaugeValue, { color: theme.textPrimary }]}>
                {displayedScore}
              </Text>

              <View
                style={[
                  styles.badgeContainer,
                  { backgroundColor: `${currentColor}20` },
                ]}
              >
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: currentColor },
                  ]}
                />
                <Text
                  style={[
                    styles.gaugeBadgeText,
                    { color: currentColor },
                  ]}
                >
                  {getScoreRating(displayedScore)}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.cardsRow}>
            <View
              style={[
                styles.metricBox,
                {
                  backgroundColor: theme.metricBoxBg,
                  borderColor: theme.metricBoxBorder,
                },
              ]}
            >
              <View style={styles.cardHeader}>
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: "#10B981" },
                  ]}
                />
                <Text
                  style={[styles.cardTitle, { color: theme.textSecondary }]}
                  numberOfLines={1}
                >
                  Payments
                </Text>
              </View>
              <Text style={[styles.cardValue, { color: theme.textPrimary }]}>
                {paymentHistoryCount}
              </Text>
            </View>

            <View
              style={[
                styles.metricBox,
                {
                  backgroundColor: theme.metricBoxBg,
                  borderColor: theme.metricBoxBorder,
                },
              ]}
            >
              <View style={styles.cardHeader}>
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: "#F97316" },
                  ]}
                />
                <Text
                  style={[styles.cardTitle, { color: theme.textSecondary }]}
                  numberOfLines={1}
                >
                  Loans
                </Text>
              </View>
              <Text style={[styles.cardValue, { color: theme.textPrimary }]}>
                {activeLoansCount}
              </Text>
            </View>

            <View
              style={[
                styles.metricBox,
                {
                  backgroundColor: theme.metricBoxBg,
                  borderColor: theme.metricBoxBorder,
                },
              ]}
            >
              <View style={styles.cardHeader}>
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: "#3B82F6" },
                  ]}
                />
                <Text
                  style={[styles.cardTitle, { color: theme.textSecondary }]}
                  numberOfLines={1}
                >
                  Utilization
                </Text>
              </View>
              <Text style={[styles.cardValue, { color: theme.textPrimary }]}>
                {creditUtilizationPct}%
              </Text>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  analyticsOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdropClickable: {
    ...StyleSheet.absoluteFill,
  },
  analyticsContent: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 40,
    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: -10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 24,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  analyticsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  analyticsTitle: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  analyticsSubtitle: {
    fontSize: 13,
    fontWeight: "500",
    marginTop: 2,
  },
  analyticsCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  analyticsCloseText: {
    fontSize: 14,
    fontWeight: "700",
  },
  gaugeContainer: {
    alignItems: "center",
    justifyContent: "center",
    height: 215,
    marginTop: 8,
  },
  gaugeTextOverlay: {
    position: "absolute",
    top: 117,
    alignItems: "center",
  },
  gaugeValue: {
    fontSize: 48,
    fontWeight: "800",
    letterSpacing: -1,
  },
  badgeContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginTop: 2,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  gaugeBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  cardsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 16,
  },
  metricBox: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: "flex-start",
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: "600",
  },
  cardValue: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
});