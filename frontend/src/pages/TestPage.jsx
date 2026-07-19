import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { startSession, submitAnswer, evaluateSession, skipQuestion as skipQuestionApi } from "../api/api.js";

const AVATAR_STATES = {
  idle: { emoji: "🙂", caption: "Get ready..." },
  speaking: { emoji: "🗣️", caption: "Reading question aloud..." },
  ready: { emoji: "🎙️", caption: 'Click "Start Answer" when ready' },
  listening: { emoji: "👂", caption: "Listening... speak your answer now" },
  thinking: { emoji: "🤔", caption: "Processing your answer..." },
  done: { emoji: "✅", caption: "Answer captured!" },
};

export default function TestPage() {
  const navigate = useNavigate();
  const { token, logout } = useAuth();

  const [phase, setPhase] = useState("loading"); // loading | interview | evaluating | done | error
  const [errorMsg, setErrorMsg] = useState("");
  const [sessionId, setSessionId] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [avatarState, setAvatarState] = useState("idle");
  const [recording, setRecording] = useState(false);
  const [canRecord, setCanRecord] = useState(false);
  const [canSubmit, setCanSubmit] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  // const [skipNotice, setSkipNotice] = useState("");
  // const skipNoticeTimerRef = useRef(null);

  // const mediaRecorderRef = useRef(null);
  // const audioChunksRef = useRef([]);
  // const recordingStartTimeRef = useRef(null);
  // const timerIntervalRef = useRef(null);

  // // ---- Start the interview session on mount ----
  // useEffect(() => {
  //   let cancelled = false;
  //   (async () => {
  //     try {
  //       const data = await startSession(token);
  //       if (cancelled) return;
  //       setSessionId(data.session_id);
  //       setQuestions(data.questions);
  //       setPhase("interview");
  //     } catch (err) {
  //       if (!cancelled) {
  //         setErrorMsg(err.message);
  //         setPhase("error");
  //       }
  //     }
  //   })();
  //   return () => { cancelled = true; };
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, []);

// const mediaRecorderRef = useRef(null);
// const audioChunksRef = useRef([]);
// const recordingStartTimeRef = useRef(null);
// const timerIntervalRef = useRef(null);
// const sessionStartedRef = useRef(false);

// // ---- Start the interview session on mount ----
// useEffect(() => {
//   // Guard against React 18 StrictMode's intentional dev-mode double-invoke
//   // of effects (mount -> cleanup -> mount again). Without this, startSession
//   // - a real POST that creates a DB row - fires twice, leaving one orphaned
//   // session (never answered, overall_score stays NULL forever) alongside
//   // the real one for a single candidate attempt.
//   if (sessionStartedRef.current) return;
//   sessionStartedRef.current = true;

//   let cancelled = false;
//   (async () => {
//     try {
//       const data = await startSession(token);
//       if (cancelled) return;
//       setSessionId(data.session_id);
//       setQuestions(data.questions);
//       setPhase("interview");
//     } catch (err) {
//       if (!cancelled) {
//         setErrorMsg(err.message);
//         setPhase("error");
//       }
//     }
//   })();
//   return () => { cancelled = true; };
//   // eslint-disable-next-line react-hooks/exhaustive-deps
// }, []);


const mediaRecorderRef = useRef(null);
const audioChunksRef = useRef([]);
const recordingStartTimeRef = useRef(null);
const timerIntervalRef = useRef(null);
const sessionStartedRef = useRef(false);

// ---- Start the interview session on mount ----
useEffect(() => {
  // Guard against React 18 StrictMode's intentional dev-mode double-invoke
  // of effects (mount -> cleanup -> mount again). Without this, startSession
  // - a real POST that creates a DB row - fires twice, leaving one orphaned
  // session (never answered, overall_score stays NULL forever) alongside
  // the real one for a single candidate attempt.
  if (sessionStartedRef.current) return;
  sessionStartedRef.current = true;

  (async () => {
    try {
      const data = await startSession(token);
      setSessionId(data.session_id);
      setQuestions(data.questions);
      setPhase("interview");
    } catch (err) {
      setErrorMsg(err.message);
      setPhase("error");
    }
  })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);


  // ---- Whenever we move to a new question, read it aloud ----
  useEffect(() => {
    if (phase === "interview" && questions.length > 0) {
      renderQuestion();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentIndex, questions]);

  function renderQuestion() {
    const q = questions[currentIndex];
    if (!q) return;
    setCanRecord(false);
    setCanSubmit(false);
    setTimeRemaining(q.time_limit_seconds);
    speakQuestion(q.question_text);
  }

  function speakQuestion(text) {
    window.speechSynthesis.cancel();
    setAvatarState("speaking");
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.lang = "en-US";
    utterance.onend = () => {
      setAvatarState("ready");
      setCanRecord(true);
    };
    window.speechSynthesis.speak(utterance);
  }

  function startTimer(limitSeconds) {
    clearInterval(timerIntervalRef.current);
    let remaining = limitSeconds;
    timerIntervalRef.current = setInterval(() => {
      remaining -= 1;
      setTimeRemaining(remaining);
      if (remaining <= 0) {
        clearInterval(timerIntervalRef.current);
        stopRecordingAndSubmit(true);
      }
    }, 1000);
  }

  async function handleToggleRecording() {
    if (!recording) {
      await startRecording();
    } else {
      // When already recording, use the same button to submit the answer
      await submitCurrentAnswer();
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      recorder.start();
      mediaRecorderRef.current = recorder;

      setRecording(true);
      recordingStartTimeRef.current = Date.now();
      startTimer(questions[currentIndex].time_limit_seconds);

      setAvatarState("listening");
      setCanSubmit(true);
    } catch (err) {
      alert("Microphone access is required to record your answer: " + err.message);
    }
  }

  function stopRecorderAndWait() {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recording || !recorder) {
        resolve();
        return;
      }
      setRecording(false);
      recorder.onstop = () => {
        recorder.stream.getTracks().forEach((t) => t.stop());
        resolve();
      };
      recorder.stop();
    });
  }

  async function stopRecordingAndSubmit(autoSubmitted) {
    clearInterval(timerIntervalRef.current);
    setCanRecord(false);
    setAvatarState("thinking");
    await submitCurrentAnswer();
  }

  async function submitCurrentAnswer() {
    await stopRecorderAndWait();
    clearInterval(timerIntervalRef.current);

    const q = questions[currentIndex];
    const timeTaken = Math.min(
      q.time_limit_seconds,
      Math.round((Date.now() - recordingStartTimeRef.current) / 1000)
    );

    setAvatarState("thinking");
    setCanSubmit(false);
    setCanRecord(false);

    try {
      const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
      await submitAnswer(token, sessionId, { questionIndex: q.question_index, timeTakenSeconds: timeTaken, audioBlob });

      setAvatarState("done");

      const nextIndex = currentIndex + 1;
      if (nextIndex < questions.length) {
        setTimeout(() => setCurrentIndex(nextIndex), 800);
      } else {
        finishInterview();
      }
    } catch (err) {
      alert(err.message);
      setCanSubmit(true);
    }
  }

  async function skipQuestion() {
    clearInterval(timerIntervalRef.current);
    if (recording) {
      await stopRecorderAndWait();
    }
    setRecording(false);
    setCanRecord(false);
    setCanSubmit(false);
    setAvatarState("idle");

    try {
      await skipQuestionApi(token, sessionId, questions[currentIndex].question_index);
    } catch (err) {
      alert(err.message);
      return;
    }

    // setSkipNotice("You skipped this question. It will be recorded as skipped.");
    // clearTimeout(skipNoticeTimerRef.current);
    // skipNoticeTimerRef.current = setTimeout(() => setSkipNotice(""), 4000);

    const nextIndex = currentIndex + 1;
    if (nextIndex < questions.length) {
      setCurrentIndex(nextIndex);
    } else {
      await finishInterview();
    }
  }

  async function submitInterviewDirectly() {
    clearInterval(timerIntervalRef.current);

    if (recording) {
      await submitCurrentAnswer();
      return;
    }

    setRecording(false);
    setCanRecord(false);
    setCanSubmit(false);
    setAvatarState("idle");

    try {
      await skipQuestionApi(token, sessionId, questions[currentIndex].question_index);
    } catch (err) {
      alert(err.message);
      return;
    }

    await finishInterview();
  }

  async function finishInterview() {
    setPhase("evaluating");
    try {
      await evaluateSession(token, sessionId);
      setPhase("done");
    } catch (err) {
      alert(err.message);
      setPhase("interview");
    }
  }

  function handleBackToHome() {
    logout();
    navigate("/");
  }

  const avatar = AVATAR_STATES[avatarState] || AVATAR_STATES.idle;
  const q = questions[currentIndex];

  return (
    <div className="page-shell">
      <div style={{ maxWidth: 640, width: "100%" }}>
        <div className="brand-bar">
          <div className="logo-badge">🧑‍💻</div>
          <div>
            <div className="brand">InterviewIQ</div>
            <div className="tagline">Live Interview</div>
          </div>
        </div>

        <div className="glass-card">
          {phase === "loading" && (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div className="spinner" />
              <p style={{ marginTop: 16, color: "#555" }}>Preparing your personalized questions...</p>
            </div>
          )}

          {phase === "error" && (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <p className="form-error">{errorMsg}</p>
              <button className="btn btn-outline" onClick={handleBackToHome}>Back to Home</button>
            </div>
          )}

          {phase === "interview" && q && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="progress-pill">Question {currentIndex + 1} / {questions.length}</span>
                <span className="timer-display">
                  {String(Math.floor(timeRemaining / 60)).padStart(2, "0")}:
                  {String(timeRemaining % 60).padStart(2, "0")}
                </span>
              </div>
              <div style={{ color: "#888", fontSize: 13, marginTop: 8 }}>{q.topic}</div>
              <div className="question-text">{q.question_text}</div>

              {/* {skipNotice && (
                <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 10, background: "#fff4e5", color: "#663c00", border: "1px solid #ffd8a8" }}>
                  {skipNotice}
                </div>
              )} */}

              <div style={{ marginBottom: 10 }}>
                <button className="btn btn-outline btn-sm" onClick={() => speakQuestion(q.question_text)}>
                  🔊 Replay Question
                </button>
              </div>

              <div className="avatar-stage">
                <div className={`avatar-circle state-${avatarState}`}>
                  <div className="avatar-ring" />
                  <span>{avatar.emoji}</span>
                </div>
                <div className="avatar-caption">{avatar.caption}</div>
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                <button
                  className="btn btn-brand"
                  disabled={!canRecord && !recording}
                  onClick={handleToggleRecording}
                >
                  {recording ? "✅ Submit & Next ➜" : "🎙️ Start Answer"}
                </button>
                {currentIndex < questions.length - 1 ? (
                  <button
                    className="btn btn-outline"
                    disabled={!q}
                    onClick={skipQuestion}
                  >
                    Skip Question ➜
                  </button>
                ) : (
                  <button
                    className="btn btn-outline"
                    disabled={!q}
                    onClick={submitInterviewDirectly}
                  >
                    Submit Interview
                  </button>
                )}
              </div>
            </>
          )}

          {phase === "evaluating" && (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div className="spinner" />
              <p style={{ marginTop: 16, color: "#555" }}>Submitting your interview for review...</p>
            </div>
          )}

          {phase === "done" && (
            <div style={{ textAlign: "center" }}>
              <div className="done-icon">✓</div>
              <h4>Thank you!</h4>
              <p style={{ color: "#555" }}>
                Your interview has been submitted successfully. Our team will review your
                responses and get back to you.
              </p>
              <button className="btn btn-outline" onClick={handleBackToHome}>Back to Home</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}