import { Alert, Platform } from 'react-native';

/** Simple message box. `Alert.alert` does nothing useful in a browser, so use window.alert there. */
export function notify(title: string, message?: string): void {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}

/** Ask for confirmation before doing something. Works on phones and in the browser. */
export function confirmAction(options: {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
}): void {
  const { title, message, confirmLabel, cancelLabel = 'Cancel', destructive, onConfirm } = options;
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: cancelLabel, style: 'cancel' },
    { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
  ]);
}
