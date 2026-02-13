import * as Location from 'expo-location';

export async function getGpsFix() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    return { available: false as const };
  }

  const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  return {
    available: true as const,
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracyMeters: position.coords.accuracy ?? undefined
  };
}
