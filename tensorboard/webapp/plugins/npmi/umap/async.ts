const TASK_DELAY_MS = 200;

/**
 * Runs an expensive task asynchronously with some delay
 * so that it doesn't block the UI thread immediately.
 *
 * @param message The message to display to the user.
 * @param task The expensive task to run.
 * @param msgId Optional. ID of an existing message. If provided, will overwrite
 *     an existing message and won't automatically clear the message when the
 *     task is done.
 * @return The value returned by the task.
 */
export function runAsyncTask<T>(
  task: () => T,
  taskDelay = TASK_DELAY_MS
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    setTimeout(() => {
      try {
        let result = task();
        resolve(result);
      } catch (ex) {
        reject(ex);
      }
      return true;
    }, taskDelay);
  });
}
