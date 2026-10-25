import * as ImagePicker from 'expo-image-picker';

// Takes a photo with the camera (no gallery, so the photo is taken on the spot).
// Resolves to { uri, mimeType } or null if cancelled; throws with a readable message if the camera is not allowed.
export const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new Error('Allow camera access for Pharmalyx in your phone settings.');

    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.6, allowsEditing: false });
    if (result.canceled || !result.assets?.length) return null;

    const asset = result.assets[0];
    return { uri: asset.uri, mimeType: asset.mimeType || 'image/jpeg' };
};
