import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

const FASTING_HOURS = 16;
const FASTING_MS = FASTING_HOURS * 60 * 60 * 1000;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function requestPermission() {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

async function scheduleNotification(startTime) {
  await Notifications.cancelAllScheduledNotificationsAsync();
  const triggerDate = new Date(startTime + FASTING_MS);
  if (triggerDate > new Date()) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '断食完了！',
        body: '16時間の断食が達成されました。',
      },
      trigger: { date: triggerDate },
    });
  }
}

export default function App() {
  const [startTime, setStartTime] = useState(null);
  const [now, setNow] = useState(Date.now());
  const intervalRef = useRef(null);

  useEffect(() => {
    requestPermission();
    AsyncStorage.getItem('startTime').then((val) => {
      if (val) setStartTime(Number(val));
    });
  }, []);

  useEffect(() => {
    intervalRef.current = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(intervalRef.current);
  }, []);

  const handleStart = async () => {
    const t = Date.now();
    setStartTime(t);
    await AsyncStorage.setItem('startTime', String(t));
    await scheduleNotification(t);
  };

  const handleReset = async () => {
    setStartTime(null);
    await AsyncStorage.removeItem('startTime');
    await Notifications.cancelAllScheduledNotificationsAsync();
  };

  const elapsed = startTime ? now - startTime : 0;
  const remaining = Math.max(FASTING_MS - elapsed, 0);
  const progress = startTime ? Math.min(elapsed / FASTING_MS, 1) : 0;
  const done = remaining === 0 && startTime !== null;

  const hours = Math.floor(remaining / 3600000);
  const minutes = Math.floor((remaining % 3600000) / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>16時間断食</Text>

      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      {done ? (
        <Text style={styles.doneText}>完了！</Text>
      ) : (
        <Text style={styles.timer}>{startTime ? timeStr : '--:--:--'}</Text>
      )}

      <Text style={styles.label}>
        {startTime ? (done ? '断食達成' : '残り時間') : '断食していません'}
      </Text>

      {!startTime ? (
        <TouchableOpacity style={styles.button} onPress={handleStart}>
          <Text style={styles.buttonText}>断食開始</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={[styles.button, styles.resetButton]} onPress={handleReset}>
          <Text style={styles.buttonText}>リセット</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  title: {
    color: '#aaa',
    fontSize: 18,
    letterSpacing: 4,
    marginBottom: 8,
  },
  progressBar: {
    width: '70%',
    height: 6,
    backgroundColor: '#333',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4ade80',
    borderRadius: 3,
  },
  timer: {
    color: '#fff',
    fontSize: 56,
    fontVariant: ['tabular-nums'],
    letterSpacing: 2,
  },
  doneText: {
    color: '#4ade80',
    fontSize: 56,
  },
  label: {
    color: '#555',
    fontSize: 14,
  },
  button: {
    marginTop: 16,
    backgroundColor: '#4ade80',
    paddingHorizontal: 48,
    paddingVertical: 16,
    borderRadius: 50,
  },
  resetButton: {
    backgroundColor: '#333',
  },
  buttonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
});
