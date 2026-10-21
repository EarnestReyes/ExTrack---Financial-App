import { SafeModal as Modal } from '../../../components/ui/safe-modal';
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
import { sendSupportMessage, supportChatEnabled, supportUsesWorker, SupportMessage } from "../../../services/ai/supportService";


interface Message {
  id: string;
  role: "user" | "model";
  text: string;
}

interface ChatSupportProps {
  visible: boolean;
  onClose: () => void;
  isDarkMode?: boolean;
  reducedMotion?: boolean;
}

export default function ChatSupport({ visible, onClose, isDarkMode = true, reducedMotion = true }: ChatSupportProps) {
  const [messages, setMessages] = useState<Message[]>([
    { id: "1", role: "model", text: "Hello! I'm your ExTrack AI assistant. How can I help you with your app today?" }
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const { user } = useAuth();
  const busy = useRef(false);
  const generation = useRef(0);
  const history = useRef<SupportMessage[]>([]);
  useEffect(() => {
    generation.current++;
    history.current = [];
    busy.current = false;
    setLoading(false);
    setInputMessage("");
    setMessages([{ id: "welcome", role: "model", text: "I can help you use ExTrack. I cannot access account records or calculate your finances. Please do not share private financial information." }]);
    return () => { generation.current++; };
  }, [user?.uid]);

  const styles = createStyles(isDarkMode);
  const colors = getDesignTheme(isDarkMode);
  const scrollToBottom = (animated = !reducedMotion) => flatListRef.current?.scrollToEnd({ animated });
  const handleSendMessage = async () => {
    const userText = inputMessage.trim();
    if (!userText || busy.current || !user) return;
    if (!supportChatEnabled) { Alert.alert("Support unavailable", "Support chat is not configured yet. Please use the Help FAQs."); return; }
    if (userText.length > 2000) { Alert.alert("Message too long", "Please use at most 2,000 characters."); return; }
    busy.current = true;
    setLoading(true);
    const requestGeneration = generation.current;
    const id = String(Date.now());
    const conversation: SupportMessage[] = [...history.current.slice(-10), { role: "user", text: userText }];
    while (conversation.length > 1 && conversation.reduce((total, message) => total + message.text.length, 0) > 12000) conversation.splice(0, 2);
    setMessages((prev) => [...prev, { id, role: "user", text: userText }]);
    setInputMessage("");
    try {
      const response = await sendSupportMessage(conversation);
      if (requestGeneration !== generation.current) return;
      history.current = [...conversation, { role: "model", text: response.slice(0, 2000) }];
      setMessages((prev) => [...prev, { id: id + "-reply", role: "model", text: response }]);
    } catch (error) {
      if (requestGeneration !== generation.current) return;
      setMessages((prev) => [...prev, { id: id + "-error", role: "model", text: error instanceof Error ? error.message : "Support is unavailable. Try again." }]);
    } finally {
      if (requestGeneration === generation.current) { busy.current = false; setLoading(false); }
    }
  };

  const sendWithConsent = () => {
    if (!inputMessage.trim() || busy.current || !user || !supportChatEnabled) return handleSendMessage();
    const captured = generation.current;
    return Alert.alert("Use Gemini for app support?", supportUsesWorker ? "Your message is sent to the ExTrack gateway, which selects a public help topic. Only that topic is sent to Google, not your conversation or financial records. Gemini free-tier input/output may be used for product improvement and human review. Do not type sensitive, confidential or personal information. Confirm only if you are 18+ and in an eligible region." : "Gemini free-tier prompts and responses may be used to improve Google's products, including human review. Your message and prior successful messages in this session will be shared. Do not include sensitive, confidential or personal information, amounts, passwords, account numbers or documents. Confirm only if you are 18+, in an eligible region and this conversation contains no private information.", [
      { text: "Cancel", style: "cancel" },
      { text: "Send to Google", onPress: () => { if (captured === generation.current) return handleSendMessage(); } },
    ]);
  };

  return (
    <Modal
      visible={visible}
      animationType={reducedMotion ? "none" : "slide"}
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.modalRoot}
      >
        <SafeAreaView style={styles.modalContainer} edges={[]}>
          <View style={styles.modalHeader}>
            <View><Text style={styles.modalHeaderTitle}>ExTrack Assistant</Text><Text style={styles.headerCaption}>A little guidance. More clarity.</Text></View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>Done</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            style={styles.chatListFlex}
            contentContainerStyle={styles.chatListContent}
            onContentSizeChange={() => scrollToBottom(false)}
            onLayout={() => scrollToBottom(false)}
            keyboardShouldPersistTaps="handled"
            onScrollBeginDrag={Keyboard.dismiss}
            renderItem={({ item }) => (
              <View
                style={[
                  styles.messageBubble,
                  item.role === "user" ? styles.userBubble : styles.aiBubble,
                ]}
              >
                <Text selectable style={[styles.messageText, { color: item.role === "user" ? "#FFFFFF" : colors.text }]}>{item.text}</Text>
              </View>
            )}
          />

          {!supportChatEnabled && <Text accessibilityLiveRegion="polite" style={styles.notice}>AI is not activated. Use Help FAQs or the offline Insights summaries.</Text>}
          {loading && (
            <View style={styles.loadingBubble} accessibilityLiveRegion="polite">
              <ActivityIndicator size="small" color="#3b82f6" />
              <Text style={styles.loadingText}>ExTrack AI is typing...</Text>
            </View>
          )}

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.chatInput}
              placeholder="Ask your question here..."
              placeholderTextColor={colors.secondary}
              accessibilityLabel="Message to ExTrack assistant"
              maxLength={2000}
              value={inputMessage}
              onChangeText={setInputMessage}
              multiline={false}
            />
            <TouchableOpacity
              accessibilityRole="button" accessibilityLabel="Send message"
              style={[styles.sendButton, (!inputMessage.trim() || loading || !supportChatEnabled || !user) && styles.sendButtonDisabled]}
              onPress={sendWithConsent}
              disabled={!inputMessage.trim() || loading || !supportChatEnabled || !user}
            >
              <Text style={styles.sendButtonText}>Send</Text>
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
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
    modalHeaderTitle: { color: c.text, fontSize: 22, letterSpacing: -0.5, fontWeight: '700' },
    headerCaption: { fontSize: 12, lineHeight: 20, color: c.secondary, marginTop: 4 },
    closeButton: { minWidth: 48, minHeight: 48, justifyContent: 'center', alignItems: 'center' },
    closeButtonText: { color: c.accent, fontSize: 15, fontWeight: '600' },
    chatListFlex: { flex: 1 },
    chatListContent: { padding: 24, paddingBottom: 32, flexGrow: 1 },
    messageBubble: { maxWidth: '88%', padding: 18, borderRadius: 22, marginBottom: 16 },
    userBubble: { backgroundColor: '#365CCA', alignSelf: 'flex-end', borderBottomRightRadius: 6 },
    aiBubble: { backgroundColor: c.surface, alignSelf: 'flex-start', borderBottomLeftRadius: 6, borderWidth: 1, borderColor: c.border },
    messageText: { color: c.text, fontSize: 15, lineHeight: 24 },
    notice: { color: c.secondary, fontSize: 13, lineHeight: 21, marginHorizontal: 24, paddingVertical: 16 },
    loadingBubble: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', padding: 16, marginLeft: 24 },
    loadingText: { color: c.secondary, fontSize: 12, marginLeft: 8 },
    inputContainer: { flexDirection: 'row', padding: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border, backgroundColor: c.surface, alignItems: 'center' },
    chatInput: { flex: 1, minHeight: 52, backgroundColor: c.background, color: c.text, borderRadius: 16, paddingHorizontal: 16, fontSize: 15, borderWidth: 1, borderColor: c.border, marginRight: 8 },
    sendButton: { backgroundColor: '#365CCA', borderRadius: 16, minHeight: 52, paddingHorizontal: 18, justifyContent: 'center', alignItems: 'center' },
    sendButtonDisabled: { opacity: 0.4 },
    sendButtonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },
  });
};
