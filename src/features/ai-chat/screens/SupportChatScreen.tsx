import { router } from 'expo-router';
import { useDesignTheme } from '../../../hooks/use-design-theme';
import { useReducedMotion } from '../../../hooks/use-reduced-motion';
import ChatSupport from '../components/ChatSupport';

export default function SupportChatScreen() {
  const { dark } = useDesignTheme();
  const reducedMotion = useReducedMotion();
  return <ChatSupport visible onClose={() => router.back()} isDarkMode={dark} reducedMotion={reducedMotion} />;
}
