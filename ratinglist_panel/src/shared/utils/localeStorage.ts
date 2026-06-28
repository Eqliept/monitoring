type LocalStorageValue = string | number | boolean | object | null;

export const setLocalStorage = (key: string, value: LocalStorageValue): void => {
  try {
    const serializedValue = JSON.stringify(value);
    localStorage.setItem(key, serializedValue);
  } catch (error) {
    console.error(`Error setting localStorage key "${key}":`, error);
  }
}

export const getLocalStorage = (key: string): LocalStorageValue => {
  try {
    const serializedValue = localStorage.getItem(key);

    if (serializedValue === null) {
      return null;
    }

    return JSON.parse(serializedValue);
  } catch (error) {
    console.error(`Error getting localStorage key "${key}":`, error);
    return null;
  }
}