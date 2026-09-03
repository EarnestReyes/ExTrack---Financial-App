import {
  Platform,
  ScrollView,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  useColorScheme,
} from 'react-native';

import { useState } from 'react';
import { router, type Href } from 'expo-router';

import * as ImagePicker from 'expo-image-picker';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from './_layout'; // Adjust import path if needed

import {
  BottomTabInset,
  MaxContentWidth,
  Spacing,
} from '@/constants/theme';

import { useTheme } from '@/hooks/use-theme';


export default function TabTwoScreen() {

  const { logout } = useAuth();
const handleLogout = () => {
    logout(); // Toggles isLoggedIn state in _layout.tsx instantly!
  };

  // ==============================
  // SAFE AREA
  // ==============================

  const safeAreaInsets = useSafeAreaInsets();


  const insets = {
    ...safeAreaInsets,

    bottom:
      safeAreaInsets.bottom +
      BottomTabInset +
      Spacing.three,
  };


  // ==============================
  // THEME
  // ==============================

  const theme = useTheme();

  const colorScheme = useColorScheme();

  const isDarkMode = colorScheme === 'dark';

  const styles = createStyles(isDarkMode);


  // ==============================
  // PROFILE STATES
  // ==============================

  const [isEditing, setIsEditing] =
    useState(false);

  const [name, setName] =
    useState('Earnest Rayleigh Reyes');

  const [address] =
    useState('Blk/Lot');

  const [birthday, setBirthday] =
    useState('August 18, 2005');

  const [email, setEmail] =
    useState('earnest@gmail.com');

  const [mobile, setMobile] =
    useState('09XXXXXXXXX');

  const [profileImage, setProfileImage] =
    useState<string | null>(null);


  // ==============================
  // EDIT FORM STATES
  // ==============================

  const [editName, setEditName] =
    useState('Earnest Rayleigh Reyes');

  const [editBirthday, setEditBirthday] =
    useState('August 18, 2005');

  const [editEmail, setEditEmail] =
    useState('earnest@gmail.com');

  const [editMobile, setEditMobile] =
    useState('09XXXXXXXXX');


  // ==============================
  // OPEN EDIT PROFILE
  // ==============================

  const openEditProfile = () => {

    setEditName(name);

    setEditBirthday(birthday);

    setEditEmail(email);

    setEditMobile(mobile);

    setIsEditing(true);
  };


  // ==============================
  // CHOOSE PROFILE PICTURE
  // ==============================

  const chooseProfilePicture = async () => {

    const permission =
      await ImagePicker
        .requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {

      Alert.alert(
        'Permission Required',
        'Please allow ExTrack to access your photos.'
      );

      return;
    }


    const result =
      await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],

        allowsEditing: true,

        aspect: [1, 1],

        quality: 1,
      });


    if (!result.canceled) {

      setProfileImage(
        result.assets[0].uri
      );
    }
  };


  // ==============================
  // SAVE PROFILE
  // ==============================

  const saveProfile = () => {

    setName(
      editName.trim() ||
      'Unknown User'
    );

    setBirthday(
      editBirthday.trim() ||
      'Not set'
    );

    setEmail(
      editEmail.trim() ||
      'Not set'
    );

    setMobile(
      editMobile.trim() ||
      'Not set'
    );

    setIsEditing(false);
  };


  // ==============================
  // CANCEL EDIT
  // ==============================

  const cancelEdit = () => {

    setIsEditing(false);
  };


  // ==============================
  // PLATFORM SPACING
  // ==============================

 const contentPlatformStyle =
  Platform.select({
    android: {
      paddingLeft: insets.left,
      paddingRight: insets.right,
      paddingBottom: insets.bottom,
    },

      web: {
        paddingTop: Spacing.six,

        paddingBottom: Spacing.four,
      },

      default: {
        paddingTop: insets.top,

        paddingBottom: insets.bottom,
      },
    });


  // ==================================================
  // EDIT PROFILE SCREEN
  // ==================================================

  if (isEditing) {

    return (
      <ScrollView
        style={styles.scrollView}

        contentContainerStyle={[
          contentPlatformStyle,
          styles.editScreenContent,
        ]}

        showsVerticalScrollIndicator={false}

        keyboardShouldPersistTaps="handled"
      >

        <View style={styles.editContainer}>


          {/* ==========================
              EDIT HEADER
          ========================== */}

          <View style={styles.editHeader}>

            <TouchableOpacity
              style={styles.backButton}
              onPress={cancelEdit}
            >

              <Text style={styles.backIcon}>
                ‹
              </Text>

            </TouchableOpacity>


            <Text style={styles.editHeaderTitle}>
              Edit Profile
            </Text>


            <View
              style={styles.headerPlaceholder}
            />

          </View>


          {/* ==========================
              PROFILE PICTURE
          ========================== */}

          <View
            style={styles.editPictureSection}
          >

            <View
              style={styles.editProfilePicture}
            >

              {profileImage ? (

                <Image
                  source={{
                    uri: profileImage,
                  }}

                  style={styles.profileImage}
                />

              ) : (

                <Text
                  style={styles.profileIcon}
                >
                  👤
                </Text>

              )}

            </View>


            <TouchableOpacity
              style={styles.changePhotoButton}
              onPress={chooseProfilePicture}
            >

              <Text
                style={styles.changePhotoText}
              >
                Change Profile Picture
              </Text>

            </TouchableOpacity>

          </View>


          {/* ==========================
              NAME
          ========================== */}

          <View style={styles.inputGroup}>

            <Text style={styles.inputLabel}>
              Name
            </Text>

            <TextInput
              style={styles.profileInput}

              value={editName}

              onChangeText={setEditName}

              placeholder="Enter your name"

              placeholderTextColor="#999"
            />

          </View>


          {/* ==========================
              BIRTHDAY
          ========================== */}

          <View style={styles.inputGroup}>

            <Text style={styles.inputLabel}>
              Birthday
            </Text>

            <TextInput
              style={styles.profileInput}

              value={editBirthday}

              onChangeText={setEditBirthday}

              placeholder="Enter your birthday"

              placeholderTextColor="#999"
            />

          </View>


          {/* ==========================
              EMAIL
          ========================== */}

          <View style={styles.inputGroup}>

            <Text style={styles.inputLabel}>
              Email
            </Text>

            <TextInput
              style={styles.profileInput}

              value={editEmail}

              onChangeText={setEditEmail}

              placeholder="Enter your email"

              placeholderTextColor="#999"

              keyboardType="email-address"

              autoCapitalize="none"
            />

          </View>


          {/* ==========================
              MOBILE NUMBER
          ========================== */}

          <View style={styles.inputGroup}>

            <Text style={styles.inputLabel}>
              Mobile Number
            </Text>

            <TextInput
              style={styles.profileInput}

              value={editMobile}

              onChangeText={setEditMobile}

              placeholder="Enter your mobile number"

              placeholderTextColor="#999"

              keyboardType="phone-pad"
            />

          </View>


          {/* ==========================
              SAVE BUTTON
          ========================== */}

          <TouchableOpacity
            style={styles.saveProfileButton}

            onPress={saveProfile}
          >

            <Text
              style={styles.saveProfileText}
            >
              SAVE CHANGES
            </Text>

          </TouchableOpacity>


          {/* ==========================
              CANCEL BUTTON
          ========================== */}

          <TouchableOpacity
            style={styles.cancelProfileButton}

            onPress={cancelEdit}
          >

            <Text
              style={styles.cancelProfileText}
            >
              CANCEL
            </Text>

          </TouchableOpacity>

        </View>

      </ScrollView>
    );
  }


  // ==================================================
  // NORMAL PROFILE SCREEN
  // ==================================================

  return (
    <ScrollView
      style={styles.scrollView}

      contentContainerStyle={[
        contentPlatformStyle,
        styles.profileScreenContent,
      ]}

      showsVerticalScrollIndicator={false}
    >

      <View style={styles.container}>


        {/* ==========================
            HEADER
        ========================== */}

        <View style={styles.header}>

          <Text style={styles.headerTitle}>
            Profile
          </Text>


          <TouchableOpacity
            style={styles.editIconButton}

            onPress={openEditProfile}
          >

            <Text style={styles.editIcon}>
              ✎
            </Text>

          </TouchableOpacity>

        </View>


        {/* ==========================
            PROFILE
        ========================== */}

        <View style={styles.profileInfo}>


          {/* PROFILE PICTURE */}

          <View style={styles.profilePicture}>

            {profileImage ? (

              <Image
                source={{
                  uri: profileImage,
                }}

                style={styles.profileImage}
              />

            ) : (

              <Text
                style={styles.profileIcon}
              >
                👤
              </Text>

            )}

          </View>


          {/* NAME */}

          <Text style={styles.profileName}>
            {name}
          </Text>


          {/* ==========================
              INFORMATION
          ========================== */}


          {/* ADDRESS */}

          <View style={styles.infoRow}>

            <Text style={styles.infoLabel}>
              Address
            </Text>

            <Text style={styles.infoValue}>
              {address}
            </Text>

          </View>


          {/* BIRTHDAY */}

          <View style={styles.infoRow}>

            <Text style={styles.infoLabel}>
              Birthday
            </Text>

            <Text style={styles.infoValue}>
              {birthday}
            </Text>

          </View>


          {/* EMAIL */}

          <View style={styles.infoRow}>

            <Text style={styles.infoLabel}>
              Email
            </Text>

            <Text style={styles.infoValue}>
              {email}
            </Text>

          </View>


          {/* MOBILE NUMBER */}

          <View style={styles.infoRow}>

            <Text style={styles.infoLabel}>
              Mobile Number
            </Text>

          
            <Text style={styles.infoValue}>
              {mobile}
            </Text>

          </View>

        </View>

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
        >
          <Text style={styles.logoutText}>
            LOG OUT
          </Text>
        </TouchableOpacity>
              
     </View>

    </ScrollView>


  );
}


// ==================================================
// STYLES
// ==================================================

const createStyles = (
  isDarkMode: boolean
) => {

  const backgroundColor =
    isDarkMode
      ? '#121212'
      : '#f5f5f5';

  const cardColor =
    isDarkMode
      ? '#1e1e1e'
      : 'white';

  const textColor =
    isDarkMode
      ? '#ffffff'
      : '#333333';

  const secondaryTextColor =
    isDarkMode
      ? '#aaaaaa'
      : 'gray';

  const borderColor =
    isDarkMode
      ? '#333333'
      : '#dddddd';

  const lightBorderColor =
    isDarkMode
      ? '#333333'
      : '#eeeeee';


  return StyleSheet.create({

    // =========================
    // MAIN SCREEN
    // =========================

    scrollView: {
      flex: 1,

      backgroundColor:
        backgroundColor,
    },

    profileScreenContent: {
      paddingBottom: 120,
    },

   container: {
  flex: 1,
  backgroundColor: backgroundColor,
  paddingHorizontal: 25,
  paddingTop: 0,
  paddingBottom: 30,
  marginTop: -40,
},


    // =========================
    // HEADER
    // =========================

    header: {
      flexDirection: 'row',

      alignItems: 'center',

      justifyContent:
        'space-between',

      marginBottom: 25,
    },

    headerTitle: {
      fontSize: 32,

      fontWeight: 'bold',

      color: textColor,
    },

    editIconButton: {
      width: 42,

      height: 42,

      borderRadius: 21,

      backgroundColor:
        cardColor,

      justifyContent: 'center',

      alignItems: 'center',
    },

    editIcon: {
      fontSize: 22,

      color: '#1e3a8a',

      fontWeight: '600',
    },


    // =========================
    // PROFILE
    // =========================

    profileInfo: {
      width: '100%',

      alignItems: 'center',

      marginTop: 5,
    },


    // =========================
    // PROFILE PICTURE
    // =========================

    profilePicture: {
      width: 110,

      height: 110,

      borderRadius: 55,

      backgroundColor:
        isDarkMode
          ? '#2a2a2a'
          : '#e5e7eb',

      justifyContent: 'center',

      alignItems: 'center',

      overflow: 'hidden',

      marginBottom: 15,
    },

    profileIcon: {
      fontSize: 42,
    },

    profileImage: {
      width: '100%',

      height: '100%',

      resizeMode: 'cover',
    },


    // =========================
    // PROFILE NAME
    // =========================

    profileName: {
      fontSize: 20,

      fontWeight: 'bold',

      color: textColor,

      textAlign: 'center',

      marginBottom: 25,
    },


    // =========================
    // PROFILE INFORMATION
    // =========================

    infoRow: {
      width: '100%',

      minHeight: 55,

      flexDirection: 'row',

      alignItems: 'center',

      paddingVertical: 14,

      borderBottomWidth: 1,

      borderBottomColor:
        lightBorderColor,
    },

    infoLabel: {
      width: 115,

      fontSize: 15,

      color: secondaryTextColor,
    },

    infoValue: {
      flex: 1,

      fontSize: 15,

      color: textColor,

      textAlign: 'right',
    },


    // =========================
    // EDIT SCREEN
    // =========================

    editScreenContent: {
      flexGrow: 1,

      paddingBottom: 120,
    },

    editContainer: {
      flex: 1,

      backgroundColor:
        backgroundColor,

      paddingHorizontal: 25,

      paddingTop: 0,

      paddingBottom: 50,
      marginTop: -40,
    },


    // =========================
    // EDIT HEADER
    // =========================

    editHeader: {
      flexDirection: 'row',

      alignItems: 'center',

      justifyContent:
        'space-between',

      marginBottom: 30,
    },

    backButton: {
      width: 42,

      height: 42,

      borderRadius: 21,

      backgroundColor:
        cardColor,

      justifyContent: 'center',

      alignItems: 'center',
    },

    backIcon: {
      fontSize: 32,

      color: textColor,

      fontWeight: '300',

      marginTop: -3,
    },

    editHeaderTitle: {
      fontSize: 25,

      fontWeight: 'bold',

      color: textColor,
    },

    headerPlaceholder: {
      width: 42,

      height: 42,
    },


    // =========================
    // EDIT PROFILE PICTURE
    // =========================

    editPictureSection: {
      alignItems: 'center',
      marginTop: 10,
      marginBottom: 20,
    },

    editProfilePicture: {
      width: 120,

      height: 120,

      borderRadius: 60,

      backgroundColor:
        isDarkMode
          ? '#2a2a2a'
          : '#e5e7eb',

      justifyContent: 'center',

      alignItems: 'center',

      overflow: 'hidden',

      marginBottom: 12,
    },

    changePhotoButton: {
      paddingVertical: 5,

      paddingHorizontal: 10,
    },

    changePhotoText: {
      color: '#1e3a8a',

      fontSize: 14,

      fontWeight: '600',
    },


    // =========================
    // INPUTS
    // =========================

    inputGroup: {
      marginBottom: 3,
    },

    inputLabel: {
      fontSize: 15,

      fontWeight: '600',

      color: textColor,

      marginBottom: 8,

      marginTop: 15,
    },

    profileInput: {
      backgroundColor:
        cardColor,

      borderRadius: 12,

      paddingHorizontal: 16,

      paddingVertical: 16,

      fontSize: 16,

      color: textColor,

      borderWidth: 1,

      borderColor:
        borderColor,
    },


    // =========================
    // SAVE BUTTON
    // =========================

    saveProfileButton: {
      backgroundColor:
        '#1e3a8a',

      padding: 18,

      borderRadius: 15,

      alignItems: 'center',

      marginTop: 35,
    },

    saveProfileText: {
      color: 'white',

      fontSize: 16,

      fontWeight: 'bold',
    },


    // =========================
    // CANCEL BUTTON
    // =========================

    cancelProfileButton: {
      paddingVertical: 15,

      alignItems: 'center',

      marginTop: 5,
    },

    cancelProfileText: {
      color:
        secondaryTextColor,

      fontSize: 15,

      fontWeight: '600',
    },

    logoutButton: {
      marginTop: 35,
      padding: 18,
      borderRadius: 15,
      alignItems: 'center',
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: '#ef4444',
    },

    logoutText: {
      color: '#ef4444',
      fontSize: 16,
      fontWeight: 'bold',
  },

  });
};
