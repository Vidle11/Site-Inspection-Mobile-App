import * as Crypto from 'expo-crypto';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system/legacy';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { REGULATION_SNAPSHOT, TYPICAL_FINDING_TEMPLATES } from '../data/regulatoryContent';
import { sha256Hex } from '../services/hash';
import {
  createEvidenceCapture,
  DEFAULT_SYNC_BASE_URL,
  getQueueSummary,
  getSetting,
  getSyncBaseUrl,
  listQueue,
  listRecentEvidence,
  setSetting,
  setSyncBaseUrl
} from '../services/localStore';
import { getGpsFix } from '../services/location';
import { syncPendingQueue } from '../services/syncQueue';
import { EvidenceRecord, QueueItem, QueueSummary, SyncStatus } from '../types/domain';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMPTY_QUEUE_SUMMARY: QueueSummary = {
  pending: 0,
  inFlight: 0,
  failed: 0,
  requiresReview: 0,
  synced: 0,
  total: 0
};

interface CapturedPhotoState {
  uri: string;
  width: number;
  height: number;
  exifJson: string;
}

function colorForStatus(status: SyncStatus): string {
  if (status === 'SYNCED') return '#66E1A5';
  if (status === 'PENDING' || status === 'IN_FLIGHT') return '#FFCE73';
  if (status === 'FAILED') return '#FF9B71';
  return '#FF6E6E';
}

function shortId(id: string): string {
  return id.slice(0, 8);
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error';
}

async function persistPhoto(localCameraUri: string): Promise<string> {
  const rootDirectory = FileSystem.documentDirectory;
  if (!rootDirectory) {
    throw new Error('Document directory is unavailable on this device.');
  }

  const evidenceDirectory = `${rootDirectory}evidence-photos`;
  await FileSystem.makeDirectoryAsync(evidenceDirectory, { intermediates: true });

  const extension = localCameraUri.toLowerCase().endsWith('.png') ? 'png' : 'jpg';
  const destinationUri = `${evidenceDirectory}/${Crypto.randomUUID()}.${extension}`;
  await FileSystem.copyAsync({ from: localCameraUri, to: destinationUri });
  return destinationUri;
}

function normalizeSyncBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

export function CaptureScreen() {
  const cameraRef = useRef<CameraView | null>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const [inspectionId, setInspectionId] = useState('');
  const [checklistItemKey, setChecklistItemKey] = useState('FOUNDATION.WATERPROOFING');
  const [title, setTitle] = useState('');
  const [noteText, setNoteText] = useState('');
  const [clauseReference, setClauseReference] = useState('');
  const [syncBaseUrlInput, setSyncBaseUrlInput] = useState(DEFAULT_SYNC_BASE_URL);

  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);

  const [capturedPhoto, setCapturedPhoto] = useState<CapturedPhotoState | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isTakingPhoto, setIsTakingPhoto] = useState(false);

  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isTestingServer, setIsTestingServer] = useState(false);
  const [status, setStatus] = useState('Initializing...');

  const [recentEvidence, setRecentEvidence] = useState<EvidenceRecord[]>([]);
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [queueSummary, setQueueSummary] = useState<QueueSummary>(EMPTY_QUEUE_SUMMARY);

  const selectedTemplate = useMemo(
    () => TYPICAL_FINDING_TEMPLATES.find((item) => item.id === selectedTemplateId) ?? null,
    [selectedTemplateId]
  );

  const queueProblems = useMemo(
    () => queueItems.filter((item) => item.status === 'FAILED' || item.status === 'REQUIRES_REVIEW').slice(0, 5),
    [queueItems]
  );

  const refreshDashboard = async (): Promise<void> => {
    const [evidence, summary, queue] = await Promise.all([listRecentEvidence(25), getQueueSummary(), listQueue(120)]);
    setRecentEvidence(evidence);
    setQueueSummary(summary);
    setQueueItems(queue);
  };

  useEffect(() => {
    const bootstrap = async (): Promise<void> => {
      setIsBootstrapping(true);
      try {
        const [savedInspectionId, savedChecklistKey, savedSyncBaseUrl] = await Promise.all([
          getSetting('active_inspection_id'),
          getSetting('default_checklist_item_key'),
          getSyncBaseUrl()
        ]);

        if (savedInspectionId && UUID_PATTERN.test(savedInspectionId)) {
          setInspectionId(savedInspectionId);
        } else {
          const generated = Crypto.randomUUID();
          setInspectionId(generated);
          await setSetting('active_inspection_id', generated);
        }

        if (savedChecklistKey) {
          setChecklistItemKey(savedChecklistKey);
        }

        setSyncBaseUrlInput(savedSyncBaseUrl);
        await refreshDashboard();
        setStatus('Ready for evidence capture.');
      } catch (error) {
        setStatus(`Initialization failed: ${errorMessage(error)}`);
      } finally {
        setIsBootstrapping(false);
      }
    };

    void bootstrap();
  }, []);

  const applyTemplate = (templateId: string): void => {
    const template = TYPICAL_FINDING_TEMPLATES.find((item) => item.id === templateId);
    if (!template) {
      return;
    }

    setSelectedTemplateId(template.id);
    setChecklistItemKey(template.defaultChecklistKey);
    setClauseReference(template.referenceSummary);
    setTitle((prev) => (prev.trim() ? prev : template.defaultTitle));
    setNoteText((prev) => {
      const current = prev.trim();
      if (!current) {
        return template.defaultPrompt;
      }
      return `${current}\n${template.defaultPrompt}`;
    });
    setShowTemplateMenu(false);
    setStatus(`Template selected: ${template.label}. Edit text as needed.`);
  };

  const openCamera = async (): Promise<void> => {
    try {
      if (!cameraPermission?.granted) {
        const result = await requestCameraPermission();
        if (!result.granted) {
          setStatus('Camera permission denied.');
          return;
        }
      }
      setIsCameraOpen(true);
      setStatus('Camera ready.');
    } catch (error) {
      setStatus(`Unable to open camera: ${errorMessage(error)}`);
    }
  };

  const takePhoto = async (): Promise<void> => {
    if (!cameraRef.current) {
      setStatus('Camera is not ready yet.');
      return;
    }

    setIsTakingPhoto(true);
    try {
      const picture = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        exif: true,
        shutterSound: true
      });
      const persistedUri = await persistPhoto(picture.uri);

      setCapturedPhoto({
        uri: persistedUri,
        width: picture.width,
        height: picture.height,
        exifJson: JSON.stringify(picture.exif ?? {})
      });
      setIsCameraOpen(false);
      setStatus('Photo captured.');
    } catch (error) {
      setStatus(`Photo capture failed: ${errorMessage(error)}`);
    } finally {
      setIsTakingPhoto(false);
    }
  };

  const testServerConnection = async (): Promise<void> => {
    const trimmedUrl = normalizeSyncBaseUrl(syncBaseUrlInput);
    if (!trimmedUrl) {
      setStatus('Set a server URL before testing.');
      return;
    }

    setIsTestingServer(true);
    setStatus('Testing server connectivity...');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const normalized = await setSyncBaseUrl(trimmedUrl);
      setSyncBaseUrlInput(normalized);

      const response = await fetch(`${normalized}/api/v1/health`, {
        method: 'GET',
        signal: controller.signal
      });

      if (!response.ok) {
        setStatus(`Server reachable but returned HTTP ${response.status}.`);
        return;
      }

      setStatus('Server connection OK. You can sync now.');
    } catch (error) {
      setStatus(`Server test failed: ${errorMessage(error)}`);
    } finally {
      clearTimeout(timeoutId);
      setIsTestingServer(false);
    }
  };

  const captureEvidence = async (): Promise<void> => {
    const trimmedInspectionId = inspectionId.trim();
    const trimmedChecklistItemKey = checklistItemKey.trim();
    const trimmedTitle = title.trim();
    const trimmedNote = noteText.trim();
    const trimmedClauseRef = clauseReference.trim();

    if (!UUID_PATTERN.test(trimmedInspectionId)) {
      setStatus('Inspection ID must be a valid UUID.');
      return;
    }
    if (!trimmedChecklistItemKey) {
      setStatus('Checklist item key is required.');
      return;
    }
    if (!trimmedNote && !capturedPhoto) {
      setStatus('Add a note or a photo before saving evidence.');
      return;
    }

    setIsSaving(true);
    setStatus('Saving locally...');

    try {
      const gps = await getGpsFix().catch(() => ({ available: false as const }));
      const now = new Date();
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

      const finalTitle =
        trimmedTitle || selectedTemplate?.defaultTitle || trimmedNote.slice(0, 70) || 'Untitled evidence item';

      const finalNote = [
        selectedTemplate ? `Template: ${selectedTemplate.label}` : null,
        trimmedClauseRef ? `Reference: ${trimmedClauseRef}` : null,
        trimmedNote
      ]
        .filter(Boolean)
        .join('\n');

      const metadata = {
        capturedAt: now.toISOString(),
        timezone,
        inspectionId: trimmedInspectionId,
        checklistItemKey: trimmedChecklistItemKey,
        title: finalTitle,
        noteText: finalNote,
        clauseReference: trimmedClauseRef,
        templateId: selectedTemplate?.id ?? null,
        gps,
        photo: capturedPhoto
          ? {
              uri: capturedPhoto.uri,
              width: capturedPhoto.width,
              height: capturedPhoto.height
            }
          : null
      };
      const metadataHash = await sha256Hex(JSON.stringify(metadata));

      const saved = await createEvidenceCapture({
        inspectionId: trimmedInspectionId,
        checklistItemKey: trimmedChecklistItemKey,
        title: finalTitle,
        noteText: finalNote,
        deviceTimestamp: now.toISOString(),
        timezone,
        gps,
        metadataHash,
        photo: capturedPhoto
          ? {
              uri: capturedPhoto.uri,
              width: capturedPhoto.width,
              height: capturedPhoto.height,
              exifJson: capturedPhoto.exifJson
            }
          : undefined
      });

      await Promise.all([
        setSetting('active_inspection_id', trimmedInspectionId),
        setSetting('default_checklist_item_key', trimmedChecklistItemKey)
      ]);

      setTitle('');
      setNoteText('');
      setCapturedPhoto(null);
      setIsCameraOpen(false);
      await refreshDashboard();

      setStatus(`Saved locally (${shortId(saved.id)}). Metadata hash ${saved.metadataHash.slice(0, 12)}...`);
    } catch (error) {
      setStatus(`Save failed: ${errorMessage(error)}`);
    } finally {
      setIsSaving(false);
    }
  };

  const syncNow = async (): Promise<void> => {
    if (!syncBaseUrlInput.trim()) {
      setStatus('Set a sync server URL first.');
      return;
    }

    setIsSyncing(true);
    setStatus('Syncing pending queue...');

    try {
      const storedBaseUrl = await setSyncBaseUrl(syncBaseUrlInput);
      setSyncBaseUrlInput(storedBaseUrl);
      const result = await syncPendingQueue({ baseUrl: storedBaseUrl });
      await refreshDashboard();
      setStatus(result.message);
    } catch (error) {
      setStatus(`Sync failed: ${errorMessage(error)}`);
    } finally {
      setIsSyncing(false);
    }
  };

  if (isBootstrapping) {
    return (
      <View style={styles.loadingState}>
        <ActivityIndicator size="large" color="#66E1A5" />
        <Text style={styles.loadingText}>Preparing local evidence store...</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>NCC / BCA Snapshot</Text>
        <Text style={styles.helpText}>Current code: {REGULATION_SNAPSHOT.currentNccVersion}</Text>
        <Text style={styles.helpText}>Effective date: {REGULATION_SNAPSHOT.currentNccEffectiveDate}</Text>
        <Text style={styles.helpText}>
          Next: {REGULATION_SNAPSHOT.nextEditionPreview} (released {REGULATION_SNAPSHOT.nextEditionPreviewReleaseDate})
        </Text>
        <Text style={styles.helpText}>Likely adoption from: {REGULATION_SNAPSHOT.nextEditionLikelyAdoptionDate}</Text>
        {REGULATION_SNAPSHOT.notes.map((note) => (
          <Text key={note} style={styles.hintText}>
            - {note}
          </Text>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sync</Text>
        <TextInput
          placeholder="http://192.168.1.50:8000"
          placeholderTextColor="#7A879F"
          style={styles.input}
          value={syncBaseUrlInput}
          onChangeText={setSyncBaseUrlInput}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <View style={styles.buttonRow}>
          <Pressable
            style={[styles.secondaryButtonFlex, isTestingServer && styles.buttonDisabled]}
            onPress={testServerConnection}
            disabled={isTestingServer}
          >
            <Text style={styles.secondaryButtonLabel}>{isTestingServer ? 'Testing...' : 'Test Server'}</Text>
          </Pressable>
          <Pressable style={[styles.primaryButtonFlex, isSyncing && styles.buttonDisabled]} onPress={syncNow} disabled={isSyncing}>
            <Text style={styles.primaryButtonLabel}>{isSyncing ? 'Syncing...' : 'Sync Now'}</Text>
          </Pressable>
        </View>

        <Text style={styles.queueText}>
          Pending {queueSummary.pending} | In flight {queueSummary.inFlight} | Failed {queueSummary.failed} | Review{' '}
          {queueSummary.requiresReview}
        </Text>
        <Text style={styles.helpText}>
          Pending sync means evidence is saved on-device and waiting to upload to the server.
        </Text>

        {queueProblems.length > 0 && (
          <View style={styles.problemList}>
            <Text style={styles.problemTitle}>Latest sync errors</Text>
            {queueProblems.map((item) => (
              <Text key={item.id} style={styles.problemItem}>
                {item.operationType} ({item.status}) attempts {item.attempts}: {item.lastError || 'No error detail'}
              </Text>
            ))}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Capture Evidence</Text>

        <Text style={styles.label}>Typical finding template</Text>
        <Pressable style={styles.secondaryButton} onPress={() => setShowTemplateMenu((prev) => !prev)}>
          <Text style={styles.secondaryButtonLabel}>
            {selectedTemplate ? selectedTemplate.label : 'Select a common finding'}
          </Text>
        </Pressable>

        {showTemplateMenu && (
          <View style={styles.templateList}>
            {TYPICAL_FINDING_TEMPLATES.map((template) => (
              <Pressable key={template.id} style={styles.templateOption} onPress={() => applyTemplate(template.id)}>
                <Text style={styles.templateLabel}>{template.label}</Text>
                <Text style={styles.templateHint}>{template.referenceSummary}</Text>
              </Pressable>
            ))}
          </View>
        )}

        <Text style={styles.label}>NCC/BCA reference (editable)</Text>
        <TextInput
          placeholder="e.g. NCC 2022 Amd 2 Vol 1 Section F"
          placeholderTextColor="#7A879F"
          style={styles.input}
          value={clauseReference}
          onChangeText={setClauseReference}
        />

        <Text style={styles.label}>Inspection ID (UUID)</Text>
        <TextInput
          placeholder="Inspection UUID"
          placeholderTextColor="#7A879F"
          style={styles.input}
          value={inspectionId}
          onChangeText={setInspectionId}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={styles.label}>Checklist Item Key</Text>
        <TextInput
          placeholder="e.g. FOUNDATION.WATERPROOFING"
          placeholderTextColor="#7A879F"
          style={styles.input}
          value={checklistItemKey}
          onChangeText={setChecklistItemKey}
          autoCapitalize="characters"
          autoCorrect={false}
        />

        <Text style={styles.label}>Title</Text>
        <TextInput
          placeholder="Short issue title"
          placeholderTextColor="#7A879F"
          style={styles.input}
          value={title}
          onChangeText={setTitle}
        />

        <Text style={styles.label}>Defect / Compliance Note (fully editable)</Text>
        <TextInput
          placeholder="Describe defect or compliance issue, or overwrite the template text"
          placeholderTextColor="#7A879F"
          style={[styles.input, styles.notesInput]}
          value={noteText}
          onChangeText={setNoteText}
          multiline
          textAlignVertical="top"
        />

        {!isCameraOpen && (
          <Pressable style={styles.secondaryButton} onPress={openCamera}>
            <Text style={styles.secondaryButtonLabel}>{capturedPhoto ? 'Retake Photo' : 'Open Camera'}</Text>
          </Pressable>
        )}

        {isCameraOpen && (
          <View style={styles.cameraContainer}>
            <CameraView ref={cameraRef} style={styles.camera} facing="back" />
            <Pressable
              style={[styles.primaryButton, isTakingPhoto && styles.buttonDisabled]}
              onPress={takePhoto}
              disabled={isTakingPhoto}
            >
              <Text style={styles.primaryButtonLabel}>{isTakingPhoto ? 'Capturing...' : 'Take Photo'}</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => setIsCameraOpen(false)}>
              <Text style={styles.secondaryButtonLabel}>Close Camera</Text>
            </Pressable>
          </View>
        )}

        {capturedPhoto && (
          <View style={styles.photoPreview}>
            <Image source={{ uri: capturedPhoto.uri }} style={styles.photo} />
            <Text style={styles.helpText}>
              Photo ready: {capturedPhoto.width} x {capturedPhoto.height}
            </Text>
          </View>
        )}

        <Pressable style={[styles.primaryButton, isSaving && styles.buttonDisabled]} onPress={captureEvidence} disabled={isSaving}>
          <Text style={styles.primaryButtonLabel}>{isSaving ? 'Saving...' : 'Save Evidence Locally'}</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Captures</Text>
        {recentEvidence.length === 0 ? (
          <Text style={styles.helpText}>No captures yet.</Text>
        ) : (
          recentEvidence.map((item) => (
            <View key={item.id} style={styles.evidenceCard}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={[styles.statusBadge, { color: colorForStatus(item.syncStatus) }]}>{item.syncStatus}</Text>
              </View>
              <Text style={styles.cardMeta}>
                {item.checklistItemKey} | {new Date(item.deviceTimestamp).toLocaleString()}
              </Text>
              <Text style={styles.cardMeta}>Local ID {shortId(item.id)} | Hash {item.metadataHash.slice(0, 12)}...</Text>
              {!!item.noteText && <Text style={styles.cardNote}>{item.noteText}</Text>}
              {item.photoUri && <Image source={{ uri: item.photoUri }} style={styles.cardPhoto} />}
            </View>
          ))
        )}
      </View>

      <Text style={styles.status}>Status: {status}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 14
  },
  loadingState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12
  },
  loadingText: {
    color: '#A9B4D0'
  },
  section: {
    borderWidth: 1,
    borderColor: '#29344F',
    borderRadius: 10,
    backgroundColor: '#131C33',
    padding: 12,
    gap: 10
  },
  sectionTitle: {
    color: '#EAF1FF',
    fontSize: 16,
    fontWeight: '700'
  },
  label: {
    color: '#D7E0F8',
    fontWeight: '600'
  },
  input: {
    borderWidth: 1,
    borderColor: '#394764',
    borderRadius: 8,
    padding: 11,
    color: 'white',
    backgroundColor: '#0F1528'
  },
  notesInput: {
    minHeight: 108
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8
  },
  primaryButton: {
    backgroundColor: '#2F73FF',
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: 'center'
  },
  primaryButtonFlex: {
    flex: 1,
    backgroundColor: '#2F73FF',
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: 'center'
  },
  primaryButtonLabel: {
    color: 'white',
    fontWeight: '700'
  },
  secondaryButton: {
    borderColor: '#4D5F84',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#111A30'
  },
  secondaryButtonFlex: {
    flex: 1,
    borderColor: '#4D5F84',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#111A30'
  },
  secondaryButtonLabel: {
    color: '#D7E0F8',
    fontWeight: '600'
  },
  buttonDisabled: {
    opacity: 0.6
  },
  queueText: {
    color: '#9CC2FF',
    fontWeight: '600'
  },
  helpText: {
    color: '#A9B4D0'
  },
  hintText: {
    color: '#8DA2C8',
    fontSize: 12
  },
  problemList: {
    borderWidth: 1,
    borderColor: '#4E3B3B',
    borderRadius: 8,
    backgroundColor: '#261818',
    padding: 8,
    gap: 6
  },
  problemTitle: {
    color: '#FFB4A6',
    fontWeight: '700'
  },
  problemItem: {
    color: '#FFD1C8',
    fontSize: 12
  },
  templateList: {
    borderWidth: 1,
    borderColor: '#2F4266',
    borderRadius: 8,
    backgroundColor: '#0E1830',
    maxHeight: 280,
    overflow: 'hidden'
  },
  templateOption: {
    borderBottomWidth: 1,
    borderBottomColor: '#22314D',
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 4
  },
  templateLabel: {
    color: '#EAF1FF',
    fontWeight: '600'
  },
  templateHint: {
    color: '#90A7CD',
    fontSize: 12
  },
  cameraContainer: {
    gap: 8
  },
  camera: {
    height: 320,
    borderRadius: 8,
    overflow: 'hidden'
  },
  photoPreview: {
    gap: 8
  },
  photo: {
    width: '100%',
    height: 210,
    borderRadius: 8
  },
  evidenceCard: {
    borderWidth: 1,
    borderColor: '#2D3B5A',
    borderRadius: 8,
    padding: 10,
    gap: 6,
    backgroundColor: '#0E1630'
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8
  },
  cardTitle: {
    color: '#EAF1FF',
    fontWeight: '700',
    flex: 1
  },
  statusBadge: {
    fontWeight: '700'
  },
  cardMeta: {
    color: '#9FB0CF',
    fontSize: 12
  },
  cardNote: {
    color: '#D7E0F8'
  },
  cardPhoto: {
    width: '100%',
    height: 150,
    borderRadius: 8
  },
  status: {
    color: '#A9B4D0',
    marginTop: 4,
    marginBottom: 16
  }
});
