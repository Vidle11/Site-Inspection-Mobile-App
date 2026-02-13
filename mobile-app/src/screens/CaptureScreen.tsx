import React, { useMemo, useState } from 'react';
import { Button, StyleSheet, Text, TextInput, View } from 'react-native';

import { sha256Hex } from '../services/hash';
import { getGpsFix } from '../services/location';
import { enqueue, listQueue } from '../services/syncQueue';

export function CaptureScreen() {
  const [noteText, setNoteText] = useState('');
  const [status, setStatus] = useState('Ready');

  const queueCount = useMemo(() => listQueue().filter((i) => i.status !== 'SYNCED').length, [status]);

  const captureEvidence = async () => {
    setStatus('Capturing...');
    const gps = await getGpsFix();
    const now = new Date();

    const metadata = {
      capturedAt: now.toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      noteText,
      gps
    };

    const metadataHash = await sha256Hex(JSON.stringify(metadata));

    enqueue({
      id: `${now.getTime()}`,
      operationType: 'CREATE_EVIDENCE',
      payload: { ...metadata, metadataHash },
      status: 'PENDING',
      attempts: 0
    });

    setStatus(`Captured. Hash ${metadataHash.slice(0, 12)}...`);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Quick evidence note</Text>
      <TextInput
        placeholder="Describe defect or compliance issue"
        placeholderTextColor="#7A879F"
        style={styles.input}
        value={noteText}
        onChangeText={setNoteText}
      />
      <Button title="Capture Evidence (3-tap flow)" onPress={captureEvidence} />
      <Text style={styles.status}>Status: {status}</Text>
      <Text style={styles.queue}>Pending Sync: {queueCount}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  label: { color: '#D7E0F8', fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: '#394764',
    borderRadius: 8,
    padding: 12,
    color: 'white',
    minHeight: 84,
    textAlignVertical: 'top'
  },
  status: { color: '#A9B4D0', marginTop: 8 },
  queue: { color: '#66E1A5', fontWeight: '600' }
});
