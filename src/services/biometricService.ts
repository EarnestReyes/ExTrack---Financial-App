import * as LocalAuthentication from "expo-local-authentication";

export const checkBiometricsSupport = async () => {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();

  return {
    hasHardware,
    isEnrolled,
    supportedTypes, // 1 = Fingerprint, 2 = Facial Recognition, 3 = Iris
  };
};

export const authenticateUser = async (promptMessage = "Authenticate to continue"): Promise<boolean> => {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) return false;

    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    if (!isEnrolled) return false;

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      fallbackLabel: "Use Passcode",
      disableDeviceFallback: false,
    });

    return result.success;
  } catch (error) {
    console.error("Biometric Authentication Error:", error);
    return false;
  }
};