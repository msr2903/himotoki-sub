import toast from "react-hot-toast";

/** Player-level notices (rendered by the Toaster mounted with the settings button). */
export const notifyError = (message: string, id?: string): void => {
  toast.error(message, { id, duration: 6000 });
};

/** Brief neutral notice (e.g. loop toggled). */
export const notifyInfo = (message: string, id?: string): void => {
  toast(message, { id, duration: 2000 });
};
