import { useCallback, useState } from 'react';

const INITIAL_STATE = {
  progress: 0,
  isUploading: false,
  error: null,
};

/**
 * Drives the upload page's progress bar lifecycle. `start(uploaderFn)` runs an
 * async uploader that receives an `onUploadProgress` axios callback; the hook
 * tracks completion percent, in-flight state, and any error surface.
 */
export const useUploadProgress = () => {
  const [state, setState] = useState(INITIAL_STATE);

  const reset = useCallback(() => setState(INITIAL_STATE), []);

  const start = useCallback(async (uploader) => {
    setState({ progress: 0, isUploading: true, error: null });

    const onUploadProgress = (event) => {
      if (!event.total) return;
      const percent = Math.round((event.loaded / event.total) * 100);
      setState((prev) => ({ ...prev, progress: percent }));
    };

    try {
      const result = await uploader({ onUploadProgress });
      setState({ progress: 100, isUploading: false, error: null });
      return result;
    } catch (err) {
      setState({ progress: 0, isUploading: false, error: err });
      throw err;
    }
  }, []);

  return { ...state, start, reset };
};

export default useUploadProgress;
