import { SafeModal as Modal } from '../../../components/ui/safe-modal';
import { router } from 'expo-router';
import { assistantGuidance } from '../assistantGuidance';
import { FinancialContextPreview } from './FinancialContextPreview';
import { LocalReplyBubble } from './LocalReplyBubble';
import { Ionicons } from '@expo/vector-icons';
import { converseLocal, newConversation, formatLocalReply, type LocalAssistantReply } from '../localAssistant';
import { readLocalContext } from '../readLocalContext';
import { getDesignTheme } from "../../../constants/design";
import { useEffect, useRef, useState } from "react";
import {
ActivityIndicator,
Alert,
FlatList,
Keyboard,
KeyboardAvoidingView,
Platform,
StyleSheet,
Text,
TextInput,
TouchableOpacity,
View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../../contexts/AuthContext";
import { sendSupportMessage, supportChatEnabled, supportUsesWorker, SupportError, SupportMessage } from "../../../services/ai/supportService";


interface Message {
  id: string;
  role: "user" | "model";
  text: string;
  retryText?: string;
  failedText?: string;
  error?: boolean;
  local?: boolean;
  reply?: LocalAssistantReply;
}

interface ChatSupportProps {
  visible: boolean;
  onClose: () => void;
  isDarkMode?: boolean;
  reducedMotion?: boolean;
}

export default function ChatSupport({ visible, onClose, isDarkMode = true, reducedMotion = true }: ChatSupportProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showContext, setShowContext] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const nearBottom = useRef(true);
  const sequence = useRef(0);
  const consentPending = useRef(false);

  const { user } = useAuth();
  const busy = useRef(false);
  const generation = useRef(0);
  const history = useRef<SupportMessage[]>([]);
  const localSession = useRef(newConversation());
  useEffect(() => {
    generation.current++;
    history.current = [];
    localSession.current = newConversation();
    busy.current = false;
    setLoading(false);
    setInputMessage("");
    consentPending.current = false;
    setMessages([]);
    nearBottom.current = true;
    return () => { generation.current++; };
  }, [user?.uid, visible]);

  const styles = createStyles(isDarkMode);
  const colors = getDesignTheme(isDarkMode);
  const scrollToBottom = (animated = !reducedMotion) => flatListRef.current?.scrollToEnd({ animated });
  const handleSendMessage = async (userText = inputMessage.trim()) => {
    if (!userText || busy.current || !user) return;
    if (!supportChatEnabled) { Alert.alert("Support unavailable", "Support chat is not configured yet. Please use the Help FAQs."); return; }
    if (userText.length > 2000) { Alert.alert("Message too long", "Please use at most 2,000 characters."); return; }
    busy.current = true;
    setLoading(true);
    const requestGeneration = generation.current;
    const id = String(++sequence.current);
    const conversation: SupportMessage[] = [...history.current.slice(-10), { role: "user", text: userText }];
    while (conversation.length > 1 && conversation.reduce((total, message) => total + message.text.length, 0) > 12000) conversation.splice(0, 2);
    setMessages((prev) => [...prev, { id, role: "user", text: userText }]);
    nearBottom.current = true;
    setInputMessage((draft) => draft.trim() === userText ? '' : draft);
    try {
      const response = await sendSupportMessage(conversation);
      if (requestGeneration !== generation.current) return;
      history.current = [...conversation, { role: "model", text: response.slice(0, 2000) }];
      setMessages((prev) => [...prev, { id: id + "-reply", role: "model", text: response }]);
    } catch (error) {
      if (requestGeneration !== generation.current) return;
      setMessages((prev) => [...prev, { id: id + "-error", role: "model", error: true, failedText: userText, retryText: error instanceof SupportError && error.retryable ? userText : undefined, text: error instanceof Error ? error.message : "Support is unavailable. Try again." }]);
    } finally {
      if (requestGeneration === generation.current) { busy.current = false; setLoading(false); }
    }
  };

  const sendWithConsent = (text = inputMessage.trim()) => {
    if (!text || busy.current || consentPending.current || !user || !supportChatEnabled) return;
    consentPending.current = true;
    const captured = generation.current;
    return Alert.alert("Use Gemini for app support?", supportUsesWorker ? "Your message is sent to the ExTrack gateway, which selects a public help topic. Only that topic is sent to Google, not your conversation or financial records. Gemini free-tier input/output may be used for product improvement and human review. Do not type sensitive, confidential or personal information. Confirm only if you are 18+ and in an eligible region." : "Gemini free-tier prompts and responses may be used to improve Google's products, including human review. Your message and prior successful messages in this session will be shared. Do not include sensitive, confidential or personal information, amounts, passwords, account numbers or documents. Confirm only if you are 18+, in an eligible region and this conversation contains no private information.", [
      { text: "Cancel", style: "cancel", onPress: () => { consentPending.current = false; } },
      { text: "Send to Google", onPress: () => { consentPending.current = false; if (captured === generation.current) return handleSendMessage(text); } },
    ], { cancelable: true, onDismiss: () => { consentPending.current = false; } });
  };

  const sendLocal = (text = inputMessage.trim()) => {
    if (!text || busy.current || !user) return;
    if (text.length > 2000) { Alert.alert('Message too long', 'Use at most 2,000 characters.'); return; }
    busy.current = true;
    setLoading(true);
    const captured = generation.current;
    const owner = user.uid;
    const id = String(++sequence.current);
    nearBottom.current = true;
    setInputMessage(draft => draft.trim() === text ? '' : draft);
    setMessages(previous => [...previous, { id, role: 'user', text, local: true }]);
    // Yield one frame so local loading feedback can paint. No artificial delay or request.
    requestAnimationFrame(() => {
      if (generation.current !== captured) return;
      try {
        const result = converseLocal(text, { current: readLocalContext(owner), prior: readLocalContext(owner, 'prior') }, localSession.current);
        localSession.current = result.state;
        const reply = result.reply;
        setMessages(previous => [...previous.slice(-39), { id: id + '-local', role: 'model', text: formatLocalReply(reply), reply, local: true }]);
      } catch {
        setMessages(previous => [...previous, { id: id + '-error', role: 'model', text: 'Local guidance is unavailable. Review your local records or try a supported question.', error: true, failedText: text, local: true }]);
      } finally { busy.current = false; setLoading(false); }
    });
  };

  return (
    <Modal
      visible={visible}
      animationType={reducedMotion ? "none" : "slide"}
      presentationStyle="fullScreen"
      onRequestClose={onClose}
      surfaceColor={colors.background}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.modalRoot}
      >
        <SafeAreaView style={styles.modalContainer} edges={[]}>
          <View style={styles.modalHeader}>
            <View style={styles.headerIcon}><Ionicons name="sparkles-outline" size={21} color={colors.accent} /></View>
            <View style={{ flex: 1 }}><Text style={styles.modalHeaderTitle}>ExTrack Assistant</Text><Text accessibilityLiveRegion="polite" style={styles.status}>{loading ? 'Preparing...' : !user ? 'Sign in for local guidance' : 'On-device'}</Text></View>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Privacy, limitations and help" style={styles.closeButton} onPress={() => Alert.alert('Private by design', 'Replies use local recorded data and general education, not Gemini. Nothing from this local chat is transmitted. Records may be incomplete or unsynced; refunds are not reinterpreted. Surplus is not verified savings. Replies are snapshots; ask again for current figures. Do not type passwords or account details.', [{ text: 'Done', style: 'cancel' }, { text: 'App help', onPress: () => { onClose(); router.push('/help'); } }])}><Ionicons name="information-circle-outline" size={22} color={colors.secondary} /></TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close chat" onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Start a new local conversation" style={styles.contextToggle} onPress={() => { generation.current++; localSession.current = newConversation(); history.current = []; busy.current = false; setLoading(false); setMessages([]); setInputMessage(''); nearBottom.current = true; }}><Text style={styles.closeButtonText}>New chat</Text></TouchableOpacity>

          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            style={styles.chatListFlex}
            contentContainerStyle={styles.chatListContent}
            onContentSizeChange={() => { if (nearBottom.current) scrollToBottom(false); }}
            onScroll={({ nativeEvent: { contentOffset, contentSize, layoutMeasurement } }) => { nearBottom.current = contentSize.height - contentOffset.y - layoutMeasurement.height < 100; }}
            scrollEventThrottle={100}
            onLayout={() => scrollToBottom(false)}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            ListHeaderComponent={<View><TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded: showContext }} style={styles.contextToggle} onPress={() => setShowContext(!showContext)}><Ionicons name="pie-chart-outline" size={16} color={colors.accent} /><Text style={styles.closeButtonText}>{showContext ? 'Hide local summary' : 'Your local summary'}</Text><Ionicons name={showContext ? 'chevron-up' : 'chevron-down'} size={14} color={colors.secondary} /></TouchableOpacity>{visible && showContext && <FinancialContextPreview owner={user?.uid} dark={isDarkMode} />}</View>}
            onScrollBeginDrag={Keyboard.dismiss}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text accessibilityRole="header" style={styles.emptyTitle}>What would you like to understand?</Text>
                <Text style={styles.emptyCopy}>Your recorded finances, explained on this device — not Gemini.</Text>
                <View style={styles.chips}>{assistantGuidance.map((tip) => <TouchableOpacity key={tip.title} accessibilityRole="button" accessibilityLabel={tip.question} accessibilityHint="Answers locally. No data is sent." disabled={loading || !user} style={styles.suggestion} onPress={() => sendLocal(tip.question)}><Text style={styles.suggestionTitle}>{tip.title}</Text></TouchableOpacity>)}</View>
              </View>
            }
            renderItem={({ item }) => (
              <View
                style={[
                  styles.messageBubble,
                  item.role === "user" ? styles.userBubble : styles.aiBubble,
                ]}
              >
                <Text style={[styles.messageLabel, { color: item.role === 'user' ? '#FFFFFF' : colors.secondary }]}>{item.error ? 'Reply unavailable' : item.role === 'user' ? 'You' : item.local ? 'ExTrack / On device' : 'ExTrack / AI'}</Text>
                {item.reply ? <LocalReplyBubble reply={item.reply} dark={isDarkMode} /> : <Text selectable accessibilityLabel={`${item.error ? 'Reply unavailable' : item.role === 'user' ? 'You' : item.local ? 'ExTrack, on device' : 'ExTrack, AI'}: ${item.text}`} style={[styles.messageText, { color: item.role === "user" ? "#FFFFFF" : colors.text }]}>{item.text}</Text>}
                {item === messages[messages.length - 1] && item.reply?.suggestions && <View style={styles.chips}>{item.reply.suggestions.map((prompt: string) => <TouchableOpacity key={prompt} accessibilityRole="button" accessibilityLabel={prompt} disabled={loading || !user} style={styles.suggestion} onPress={() => sendLocal(prompt)}><Text style={styles.suggestionTitle}>{prompt}</Text></TouchableOpacity>)}</View>}
                {item.retryText && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Retry message with consent" disabled={loading || !supportChatEnabled || !user} style={styles.helpButton} onPress={() => sendWithConsent(item.retryText)}><Text style={styles.closeButtonText}>Retry with consent</Text></TouchableOpacity>}
                {item.failedText && <TouchableOpacity accessibilityRole="button" disabled={loading} style={styles.helpButton} onPress={() => { if (!inputMessage.trim()) setInputMessage(item.failedText!); else Alert.alert('Keep your draft?', 'Replace the current draft with this message?', [{ text: 'Keep draft', style: 'cancel' }, { text: 'Replace', onPress: () => setInputMessage(item.failedText!) }]); }}><Text style={styles.closeButtonText}>Edit message</Text></TouchableOpacity>}
              </View>
            )}
          />

          {!user && <Text accessibilityLiveRegion="polite" style={styles.notice}>Sign in to use your local summary.</Text>}
          {loading && (
            <View style={styles.loadingBubble} accessibilityLiveRegion="polite">
              <ActivityIndicator size="small" color="#3b82f6" />
              <Text style={styles.loadingText}>Preparing on-device guidance...</Text>
            </View>
          )}

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.chatInput}
              placeholder="Ask about this month or spending..."
              placeholderTextColor={colors.secondary}
              accessibilityLabel="Message to ExTrack assistant"
              maxLength={2000}
              value={inputMessage}
              editable={!loading && !!user}
              onChangeText={setInputMessage}
              multiline
              textAlignVertical="top"
              onFocus={() => { nearBottom.current = true; scrollToBottom(false); }}
            />
            <TouchableOpacity
              accessibilityRole="button" accessibilityLabel="Send message"
              accessibilityState={{ disabled: !inputMessage.trim() || loading || !user, busy: loading }}
              style={[styles.sendButton, (!inputMessage.trim() || loading || !user) && styles.sendButtonDisabled]}
              onPress={() => sendLocal()}
              disabled={!inputMessage.trim() || loading || !user}
            >
              <Ionicons name="arrow-up" size={23} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (dark: boolean) => {
  const c = getDesignTheme(dark);
  return StyleSheet.create({
    modalRoot: { flex: 1, backgroundColor: c.background },
    modalContainer: { flex: 1, backgroundColor: c.background, width: '100%', maxWidth: 720, alignSelf: 'center' },
    modalHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
    headerIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
    modalHeaderTitle: { color: c.text, fontSize: 16, fontWeight: '700' },
    headerCaption: { fontSize: 12, lineHeight: 20, color: c.secondary, marginTop: 4 },
    status: { color: c.secondary, fontSize: 11, marginTop: 2 },
    contextToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, marginBottom: 12 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    emptyContainer: { width: '100%', paddingVertical: 8 },
    emblem: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#365CCA', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
    emblemText: { color: '#FFFFFF', fontSize: 24, fontWeight: '700' },
    emptyTitle: { color: c.text, fontSize: 22, lineHeight: 29, fontWeight: '600', letterSpacing: -0.5 },
    emptyCopy: { color: c.secondary, fontSize: 13, lineHeight: 21, marginTop: 8, marginBottom: 18 },
    sectionLabel: { color: c.secondary, fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginBottom: 12 },
    suggestion: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 22, paddingHorizontal: 14, paddingVertical: 12, minHeight: 44 },
    suggestionTitle: { color: c.text, fontSize: 13, fontWeight: '500' },
    suggestionQuestion: { color: c.secondary, fontSize: 13, lineHeight: 20, marginTop: 4 },
    localLabel: { color: c.accent, fontSize: 12, fontWeight: '600', marginTop: 8 },
    closeButton: { minWidth: 48, minHeight: 48, justifyContent: 'center', alignItems: 'center' },
    closeButtonText: { color: c.accent, fontSize: 15, fontWeight: '600' },
    chatListFlex: { flex: 1 },
    chatListContent: { padding: 16, paddingBottom: 12, flexGrow: 1 },
    messageBubble: { maxWidth: '94%', padding: 12, borderRadius: 18, marginBottom: 12 },
    userBubble: { backgroundColor: '#365CCA', alignSelf: 'flex-end', borderBottomRightRadius: 6 },
    aiBubble: { backgroundColor: c.surface, alignSelf: 'flex-start', borderBottomLeftRadius: 6, borderWidth: 1, borderColor: c.border },
    messageText: { color: c.text, fontSize: 15, lineHeight: 22 },
    messageLabel: { fontSize: 10, fontWeight: '600', marginBottom: 6 },
    helpButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 8 },
    notice: { color: c.secondary, fontSize: 13, lineHeight: 21, marginHorizontal: 24, paddingVertical: 16 },
    loadingBubble: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', padding: 16, marginLeft: 24 },
    loadingText: { color: c.secondary, fontSize: 12, marginLeft: 8 },
    inputContainer: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border, backgroundColor: c.background, alignItems: 'flex-end' },
    chatInput: { flex: 1, minHeight: 48, maxHeight: 104, paddingVertical: 12, backgroundColor: c.surface, color: c.text, borderRadius: 24, paddingHorizontal: 16, fontSize: 15, borderWidth: 1, borderColor: c.border, marginRight: 8 },
    sendButton: { backgroundColor: '#365CCA', borderRadius: 24, width: 48, height: 48, justifyContent: 'center', alignItems: 'center' },
    sendButtonDisabled: { opacity: 0.4 },
    sendButtonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },
  });
};
