export const getApiUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  const browserHost = window.location.hostname;

  if (envUrl) {
    try {
      const parsed = new URL(envUrl);
      const envIsLocal = ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname);
      const browserIsLocal = ['localhost', '127.0.0.1', '::1'].includes(browserHost);

      if (!envIsLocal || browserIsLocal) {
        return envUrl.replace(/\/$/, '');
      }
    } catch (error) {
      // Fall back to the current browser host when the env value is malformed.
    }
  }

  return `${window.location.protocol}//${browserHost}:4000`;
};
