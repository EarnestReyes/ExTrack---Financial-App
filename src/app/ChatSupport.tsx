import { useState, useRef, useEffect } from "react";
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    Modal,
    TextInput,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Keyboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

interface Message {
  id: string;
  role: "user" | "model";
  text: string;
}

interface ChatSupportProps {
  visible: boolean;
  onClose: () => void;
}

export default function ChatSupport({ visible, onClose }: ChatSupportProps) {
  const [messages, setMessages] = useState<Message[]>([
    { id: "1", role: "model", text: "Hello! I'm your ExTrack AI assistant. How can I help you with your app today?" }
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Keep a reference to the active chat session so history is preserved
  const chatSessionRef = useRef<any>(null);

  useEffect(() => {
    // Initialize the chat session with system instructions once when component mounts
    chatSessionRef.current = ai.chats.create({
      model: "gemini-3.6-flash",
      config: {
        systemInstruction: `
          You are the official in-app AI assistant for "ExTrack", an expense and finance tracking mobile application.
          Your job is to help users understand how to use the app and its features.
          
          Here are the core functions and features of ExTrack:
          - Tracking and logging daily expenses.
          - Viewing transaction history and categories.
          - Setting up budgets and spending limits.
          - Accessing AI support chat for troubleshooting.

          Always keep your answers concise, friendly, and specific to the ExTrack app. If a user asks something unrelated to the app, gently guide them back to how ExTrack can help them manage their expenses.
        `,
      },
    });
  }, []);

  const scrollToBottom = (animated = true) => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated });
    }, 100);
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || loading || !chatSessionRef.current) return;

    const userText = inputMessage.trim();
    setInputMessage("");

    const newUserMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      text: userText,
    };

    setMessages((prev) => [...prev, newUserMessage]);
    scrollToBottom(true);
    setLoading(true);

    try {
      // Send message using the persistent chat session which automatically includes history
      const response = await chatSessionRef.current.sendMessage({
        message: userText,
      });

      const aiResponseText = response.text || "I couldn't generate a response right now.";

      const newAiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "model",
        text: aiResponseText,
      };

      setMessages((prev) => [...prev, newAiMessage]);
      scrollToBottom(true);
    } catch (error) {
      console.error("Gemini Error:", error);
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: "model", text: "Sorry, system is down today. We'll contact you once the issue is solved:)" }
      ]);
      scrollToBottom(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.modalRoot}
      >
        <SafeAreaView style={styles.modalContainer} edges={["top", "left", "right", "bottom"]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalHeaderTitle}>ExTrack AI Support</Text>
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
                <Text style={styles.messageText}>{item.text}</Text>
              </View>
            )}
          />

          {loading && (
            <View style={styles.loadingBubble}>
              <ActivityIndicator size="small" color="#3b82f6" />
              <Text style={styles.loadingText}>ExTrack AI is typing...</Text>
            </View>
          )}

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.chatInput}
              placeholder="Ask your question here..."
              placeholderTextColor="#94a3b8"
              value={inputMessage}
              onChangeText={setInputMessage}
              multiline={false}
            />
            <TouchableOpacity 
              style={[styles.sendButton, !inputMessage.trim() && styles.sendButtonDisabled]} 
              onPress={handleSendMessage}
              disabled={!inputMessage.trim() || loading}
            >
              <Text style={styles.sendButtonText}>Send</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  modalHeaderTitle: {
    color: "#f8fafc",
    fontSize: 17,
    fontWeight: "bold",
  },
  closeButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  closeButtonText: {
    color: "#3b82f6",
    fontSize: 16,
    fontWeight: "600",
  },
  chatListFlex: {
    flex: 1,
  },
  chatListContent: {
    padding: 16,
    paddingBottom: 24,
  },
  messageBubble: {
    maxWidth: "80%",
    padding: 12,
    borderRadius: 14,
    marginBottom: 12,
  },
  userBubble: {
    backgroundColor: "#3b82f6",
    alignSelf: "flex-end",
    borderBottomRightRadius: 2,
  },
  aiBubble: {
    backgroundColor: "#1e293b",
    alignSelf: "flex-start",
    borderBottomLeftRadius: 2,
    borderWidth: 1,
    borderColor: "#334155",
  },
  messageText: {
    color: "#f8fafc",
    fontSize: 14,
    lineHeight: 20,
  },
  loadingBubble: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#1e293b",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginLeft: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#334155",
  },
  loadingText: {
    color: "#94a3b8",
    fontSize: 12,
    marginLeft: 8,
  },
  inputContainer: {
    flexDirection: "row",
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "#334155",
    backgroundColor: "#0f172a",
    alignItems: "center",
  },
  chatInput: {
    flex: 1,
    backgroundColor: "#1e293b",
    color: "#f8fafc",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#334155",
    marginRight: 8,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: "#3b82f6",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#334155",
  },
  sendButtonText: {
    color: "#ffffff",
    fontWeight: "600",
  },
});