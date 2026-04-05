import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import DateTimePicker from '@react-native-community/datetimepicker';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function timeToMinutes(hour, minute) {
  return hour * 60 + minute;
}

function calcFastingHours(startHour, startMin, endHour, endMin) {
  let mins = timeToMinutes(endHour, endMin) - timeToMinutes(startHour, startMin);
  if (mins <= 0) mins += 24 * 60;
  return mins / 60;
}

function isInFastingWindow(now, startHour, startMin, endHour, endMin) {
  const current = timeToMinutes(now.getHours(), now.getMinutes());
  const start = timeToMinutes(startHour, startMin);
  const end = timeToMinutes(endHour, endMin);
  if (start > end) {
    return current >= start || current < end;
  }
  return current >= start && current < end;
}

function getNextTransitionMs(now, targetHour, targetMin) {
  const target = new Date(now);
  target.setHours(targetHour, targetMin, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  return target - now;
}

function formatMs(ms) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

async function scheduleNotifications(startHour, startMin, endHour, endMin) {
  await Notifications.cancelAllScheduledNotificationsAsync();
  const fastingHours = calcFastingHours(startHour, startMin, endHour, endMin);
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '断食開始',
      body: `${fastingHours}時間の断食が始まりました`,
      sound: true,
    },
    trigger: { type: 'daily', hour: startHour, minute: startMin },
  });
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '断食終了',
      body: 'お疲れ様でした！食事の時間です',
      sound: true,
    },
    trigger: { type: 'daily', hour: endHour, minute: endMin },
  });
}

const defaultStart = new Date();
defaultStart.setHours(18, 0, 0, 0);
const defaultEnd = new Date();
defaultEnd.setHours(10, 0, 0, 0);

export default function App() {
  const [fastStart, setFastStart] = useState({ hour: 18, minute: 0 });
  const [fastEnd, setFastEnd] = useState({ hour: 10, minute: 0 });
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [tempDate, setTempDate] = useState(new Date());
  const [notificationsOn, setNotificationsOn] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    (async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      const saved = await AsyncStorage.getItem('fastSettings');
      if (saved) {
        const { startHour, startMin, endHour, endMin, notifOn } = JSON.parse(saved);
        setFastStart({ hour: startHour, minute: startMin });
        setFastEnd({ hour: endHour, minute: endMin });
        setNotificationsOn(notifOn ?? false);
      }
    })();
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const saveSettings = async (start, end, notifOn) => {
    await AsyncStorage.setItem('fastSettings', JSON.stringify({
      startHour: start.hour, startMin: start.minute,
      endHour: end.hour, endMin: end.minute,
      notifOn,
    }));
    if (notifOn) {
      await scheduleNotifications(start.hour, start.minute, end.hour, end.minute);
    } else {
      await Notifications.cancelAllScheduledNotificationsAsync();
    }
  };

  const handleStartChange = (_, date) => {
    if (date) setTempDate(date);
  };

  const confirmStart = () => {
    const newStart = { hour: tempDate.getHours(), minute: tempDate.getMinutes() };
    setFastStart(newStart);
    saveSettings(newStart, fastEnd, notificationsOn);
    setShowStartPicker(false);
  };

  const handleEndChange = (_, date) => {
    if (date) setTempDate(date);
  };

  const confirmEnd = () => {
    const newEnd = { hour: tempDate.getHours(), minute: tempDate.getMinutes() };
    setFastEnd(newEnd);
    saveSettings(fastStart, newEnd, notificationsOn);
    setShowEndPicker(false);
  };

  const toggleNotifications = () => {
    const next = !notificationsOn;
    setNotificationsOn(next);
    saveSettings(fastStart, fastEnd, next);
  };

  const fasting = isInFastingWindow(now, fastStart.hour, fastStart.minute, fastEnd.hour, fastEnd.minute);
  const fastingHours = calcFastingHours(fastStart.hour, fastStart.minute, fastEnd.hour, fastEnd.minute);

  const transitionMs = fasting
    ? getNextTransitionMs(now, fastEnd.hour, fastEnd.minute)
    : getNextTransitionMs(now, fastStart.hour, fastStart.minute);

  const startDate = new Date();
  startDate.setHours(fastStart.hour, fastStart.minute, 0, 0);
  const endDate = new Date();
  endDate.setHours(fastEnd.hour, fastEnd.minute, 0, 0);

  const fmt = (h, m) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Fasting Timer</Text>
      <Text style={styles.fastingHours}>断食時間：{fastingHours}時間</Text>

      <View style={styles.timeRow}>
        <View style={styles.timeBlock}>
          <Text style={styles.timeLabel}>開始</Text>
          <TouchableOpacity onPress={() => { setTempDate(startDate); setShowStartPicker(true); }}>
            <Text style={styles.timeValue}>{fmt(fastStart.hour, fastStart.minute)}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.arrow}>→</Text>
        <View style={styles.timeBlock}>
          <Text style={styles.timeLabel}>終了</Text>
          <TouchableOpacity onPress={() => { setTempDate(endDate); setShowEndPicker(true); }}>
            <Text style={styles.timeValue}>{fmt(fastEnd.hour, fastEnd.minute)}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.statusBadge, fasting ? styles.fastingBadge : styles.eatingBadge]}>
        <Text style={styles.statusText}>{fasting ? '断食中' : '食事OK'}</Text>
      </View>

      <View style={{ height: 20 }} />
      <Text style={styles.countdownLabel}>
        {fasting ? '断食終了まで' : '断食開始まで'}
      </Text>
      <Text style={styles.countdown}>{formatMs(transitionMs)}</Text>

      <TouchableOpacity
        style={[styles.notifButton, notificationsOn && styles.notifOn]}
        onPress={toggleNotifications}
      >
        <Text style={styles.notifText}>
          {notificationsOn ? '通知 ON' : '通知 OFF'}
        </Text>
      </TouchableOpacity>

      <Modal visible={showStartPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>断食開始時刻</Text>
              <TouchableOpacity onPress={confirmStart}>
                <Text style={styles.modalConfirm}>更新</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.pickerWrapper}>
              <DateTimePicker
                mode="time"
                value={tempDate}
                onChange={handleStartChange}
                display="spinner"
                textColor="#000"
                style={styles.picker}
              />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showEndPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>断食終了時刻</Text>
              <TouchableOpacity onPress={confirmEnd}>
                <Text style={styles.modalConfirm}>更新</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.pickerWrapper}>
              <DateTimePicker
                mode="time"
                value={tempDate}
                onChange={handleEndChange}
                display="spinner"
                textColor="#000"
                style={styles.picker}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 120,
    gap: 20,
  },
  title: {
    color: '#555',
    fontSize: 28,
    letterSpacing: 4,
  },
  fastingHours: {
    color: '#aaa',
    fontSize: 18,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginVertical: 8,
  },
  timeBlock: {
    alignItems: 'center',
    gap: 4,
  },
  timeLabel: {
    color: '#555',
    fontSize: 16,
  },
  timeValue: {
    color: '#fff',
    fontSize: 36,
    fontVariant: ['tabular-nums'],
  },
  arrow: {
    color: '#333',
    fontSize: 20,
  },
  statusBadge: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    marginVertical: 8,
  },
  fastingBadge: {
    backgroundColor: '#1a3a2a',
  },
  eatingBadge: {
    backgroundColor: '#2a2a1a',
  },
  statusText: {
    color: '#4ade80',
    fontSize: 14,
    fontWeight: '600',
  },
  countdown: {
    color: '#fff',
    fontSize: 52,
    fontVariant: ['tabular-nums'],
    letterSpacing: 2,
  },
  countdownLabel: {
    color: '#555',
    fontSize: 18,
  },
  notifButton: {
    marginTop: 8,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: '#333',
  },
  notifOn: {
    borderColor: '#4ade80',
  },
  notifText: {
    color: '#aaa',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 32,
    paddingTop: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  modalTitle: {
    color: '#333',
    fontSize: 14,
  },
  modalConfirm: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  pickerWrapper: {
    alignItems: 'center',
    width: '100%',
  },
  picker: {
    width: 200,
  },
});
