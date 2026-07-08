/**
 * FUTURE ENHANCEMENT - NOT YET ACTIVE
 * ------------------------------------------------------------
 * This component is a scaffold for planned proctoring features:
 *   1. Camera monitoring - show a small live webcam preview during the test
 *      (via navigator.mediaDevices.getUserMedia({ video: true })) and,
 *      later, periodically capture frames to flag if no face is visible or
 *      multiple faces appear.
 *   2. Tab/window switch detection - listen for the browser's
 *      `visibilitychange` event and `window.blur` to detect when a
 *      candidate navigates away from the test tab, and log/flag it on the
 *      session so it shows up in the admin's candidate detail view.
 *
 * To activate in the future:
 *   - Render <ProctoringMonitor /> inside TestPage.jsx during the
 *     "interview" phase.
 *   - Wire `onTabSwitch` / `onFaceMissing` callbacks to a new backend
 *     endpoint (e.g. POST /api/interview/session/{id}/flag) that appends a
 *     warning to the session, so it appears in the admin dashboard.
 *   - Add a `proctoring_flags` JSON column to InterviewSession in models.py.
 *
 * Left unimplemented for now since it wasn't part of the current scope -
 * this file exists purely so the hook points are easy to find later.
 */
import { useEffect, useRef } from "react";

export default function ProctoringMonitor({ onTabSwitch, onCameraError }) {
  const videoRef = useRef(null);

  useEffect(() => {
    // --- Tab/window switch detection (cheap to enable today) ---
    function handleVisibilityChange() {
      if (document.hidden && onTabSwitch) {
        onTabSwitch({ type: "tab-hidden", at: new Date().toISOString() });
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // --- Camera preview (uncomment when ready to activate) ---
    // navigator.mediaDevices.getUserMedia({ video: true })
    //   .then((stream) => { if (videoRef.current) videoRef.current.srcObject = stream; })
    //   .catch((err) => onCameraError && onCameraError(err));

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [onTabSwitch, onCameraError]);

  // Renders nothing visible yet - swap for a small <video> preview element
  // (using videoRef) once camera monitoring is turned on.
  return null;
}
