import { useCallback } from 'react';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';

export interface VoiceRecording {
  uri: string;
  durationSec: number;
}

export function useVoiceRecorder() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 200);

  const start = useCallback(async (): Promise<boolean> => {
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) return false;
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    return true;
  }, [recorder]);

  const stop = useCallback(async (): Promise<VoiceRecording | null> => {
    await recorder.stop();
    const status = recorder.getStatus();
    if (!status.url) return null;
    return { uri: status.url, durationSec: Math.round(status.durationMillis / 1000) };
  }, [recorder]);

  return {
    isRecording: recorderState.isRecording,
    durationMillis: recorderState.durationMillis,
    start,
    stop,
  };
}
