import toast from "react-hot-toast";

/** Player-level notices (rendered by the Toaster mounted with the settings button). */
export const notifyError = (message: string, id?: string): void => {
  toast.error(message, { id, duration: 6000 });
};
