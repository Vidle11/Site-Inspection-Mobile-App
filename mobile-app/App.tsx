import React from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { CaptureScreen } from './src/screens/CaptureScreen';

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Site Inspection Evidence</Text>
        <Text style={styles.subtitle}>Offline capture | Hash integrity | Sync aware</Text>
      </View>
      <CaptureScreen />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B1020' },
  header: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#28324A' },
  title: { color: 'white', fontSize: 22, fontWeight: '700' },
  subtitle: { color: '#A9B4D0', marginTop: 4 }
});
