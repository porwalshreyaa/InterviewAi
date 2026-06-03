(function () {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  const state = {
    totalQuestions: 0,
    currentIndex: 0,
    phase: "idle",
    recognition: null,
    mediaRecorder: null,
    mediaStream: null,
    audioChunks: [],
    finalTranscript: "",
    transcriptSegments: [],
    isListening: false,
    isTranscribing: false,
    canRecord: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
  };

  const els = {
    statusBadge: document.getElementById("statusBadge"),
    progressBar: document.getElementById("progressBar"),
    progressText: document.getElementById("progressText"),
    questionType: document.getElementById("questionType"),
    questionText: document.getElementById("questionText"),
    answerText: document.getElementById("answerText"),
    interimText: document.getElementById("interimText"),
    micBtn: document.getElementById("micBtn"),
    micBtnLabel: document.getElementById("micBtnLabel"),
    submitBtn: document.getElementById("submitBtn"),
    skipBtn: document.getElementById("skipBtn"),
    startBtn: document.getElementById("startBtn"),
    reviewPanel: document.getElementById("reviewPanel"),
    reviewStream: document.getElementById("reviewStream"),
    errorBox: document.getElementById("errorBox"),
  };

  function setPhase(phase) {
    state.phase = phase;
    updateUI();
  }

  function showError(msg) {
    els.errorBox.textContent = msg;
    els.errorBox.classList.remove("hidden");
  }

  function clearError() {
    els.errorBox.classList.add("hidden");
    els.errorBox.textContent = "";
  }

  function updateUI() {
    const progress =
      state.totalQuestions > 0
        ? Math.round((state.currentIndex / state.totalQuestions) * 100)
        : 0;
    els.progressBar.style.width = `${progress}%`;
    els.progressText.textContent =
      state.totalQuestions > 0
        ? `Question ${Math.min(state.currentIndex + 1, state.totalQuestions)} of ${state.totalQuestions}`
        : "Ready to start";

    const badges = {
      idle: ["Ready", "badge-neutral"],
      streaming_question: ["AI speaking…", "badge"],
      listening: ["Your turn — speak now", "badge-warning"],
      transcribing: ["Transcribing…", "badge"],
      submitting: ["Saving answer…", "badge-neutral"],
      generating_review: ["Generating review…", "badge"],
    };
    const [label, cls] = badges[state.phase] || badges.idle;
    els.statusBadge.textContent = label;
    els.statusBadge.className = `${cls} px-3 py-1 rounded-full text-xs font-medium`;

    const micAllowed =
      state.canRecord && state.phase === "listening" && !state.isTranscribing;
    els.micBtn.disabled = !micAllowed;
    els.submitBtn.disabled =
      state.phase !== "listening" || state.isTranscribing;
    els.skipBtn.disabled =
      state.phase !== "listening" || state.isTranscribing;
    els.startBtn.disabled = state.phase !== "idle";
    updateMicButton();
  }

  function updateMicButton() {
    if (!els.micBtn) return;

    els.micBtn.classList.remove("mic-btn--active", "mic-btn--inactive");

    if (state.isListening) {
      els.micBtn.classList.add("mic-btn--active");
      els.micBtn.setAttribute("aria-pressed", "true");
      if (els.micBtnLabel) els.micBtnLabel.textContent = "Mic on";
    } else {
      els.micBtn.classList.add("mic-btn--inactive");
      els.micBtn.setAttribute("aria-pressed", "false");
      if (els.micBtnLabel) els.micBtnLabel.textContent = "Mic off";
    }
  }

  function getRecorderMimeType() {
    const types = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/mp4",
    ];
    return types.find((t) => MediaRecorder.isTypeSupported(t)) || "";
  }

  function updateAnswerField() {
    els.answerText.value = state.transcriptSegments.join(" ").trim();
  }

  function speak(text) {
    return new Promise((resolve) => {
      if (!window.speechSynthesis) {
        resolve();
        return;
      }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      utterance.pitch = 1;
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      window.speechSynthesis.speak(utterance);
    });
  }

  function initRecognition() {
    if (!SpeechRecognition) return null;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      let interim = "";
      let final = state.finalTranscript;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript + " ";
        } else {
          interim += transcript;
        }
      }

      state.finalTranscript = final.trim();

      if (state.isListening && !state.isTranscribing) {
        const draft = [state.transcriptSegments.join(" "), state.finalTranscript, interim]
          .filter(Boolean)
          .join(" ")
          .trim();
        els.answerText.value = draft;
      }

      els.interimText.textContent = interim
        ? `Hearing: ${interim}`
        : state.finalTranscript
          ? "Listening…"
          : "Start speaking when ready";
    };

    recognition.onerror = (event) => {
      if (event.error !== "aborted") {
        showError(`Microphone error: ${event.error}`);
      }
    };

    recognition.onend = () => {
      if (state.isListening && state.phase === "listening" && !state.isTranscribing) {
        try {
          recognition.start();
        } catch {
          /* ignore */
        }
      }
    };

    return recognition;
  }

  function stopRecognition() {
    if (!state.recognition) return;
    try {
      state.recognition.stop();
    } catch {
      /* ignore */
    }
  }

  async function ensureMediaStream() {
    if (state.mediaStream) return state.mediaStream;
    if (!state.canRecord) {
      throw new Error("Microphone access is not available in this browser.");
    }
    state.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    return state.mediaStream;
  }

  function startRecorder() {
    return new Promise((resolve, reject) => {
      const mimeType = getRecorderMimeType();
      state.audioChunks = [];

      const options = mimeType ? { mimeType } : undefined;
      state.mediaRecorder = new MediaRecorder(state.mediaStream, options);

      state.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) state.audioChunks.push(event.data);
      };

      state.mediaRecorder.onstop = () => resolve();
      state.mediaRecorder.onerror = () => reject(new Error("Recording failed"));

      state.mediaRecorder.start(250);
    });
  }

  function stopRecorder() {
    return new Promise((resolve) => {
      if (!state.mediaRecorder || state.mediaRecorder.state === "inactive") {
        resolve(null);
        return;
      }

      state.mediaRecorder.onstop = () => {
        if (state.audioChunks.length === 0) {
          resolve(null);
          return;
        }
        const mimeType = state.mediaRecorder.mimeType || "audio/webm";
        resolve(new Blob(state.audioChunks, { type: mimeType }));
      };

      state.mediaRecorder.stop();
    });
  }

  async function transcribeBlob(blob) {
    const draftText = [state.transcriptSegments.join(" "), state.finalTranscript]
      .filter(Boolean)
      .join(" ")
      .trim();

    const form = new FormData();
    if (blob && blob.size > 0) {
      form.append("audio", blob, "answer.webm");
    }
    form.append("draftText", draftText || els.answerText.value.trim());

    const response = await fetch("/api/interview/transcribe", {
      method: "POST",
      body: form,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Failed to transcribe answer");
    }

    if (data.text) {
      if (blob && blob.size > 0) {
        state.transcriptSegments.push(data.text);
      } else {
        state.transcriptSegments = [data.text];
      }
      updateAnswerField();
    }

    els.interimText.textContent = data.text
      ? "Transcript ready"
      : "No speech detected — try again or type your answer";
  }

  async function stopRecordingAndTranscribe() {
    if (!state.mediaRecorder || state.mediaRecorder.state === "inactive") {
      if (els.answerText.value.trim() || state.finalTranscript.trim()) {
        state.isTranscribing = true;
        setPhase("transcribing");
        await transcribeBlob(null);
        state.isTranscribing = false;
        setPhase("listening");
      }
      return;
    }

    state.isTranscribing = true;
    setPhase("transcribing");
    stopRecognition();

    const blob = await stopRecorder();
    await transcribeBlob(blob);

    state.finalTranscript = "";
    state.isTranscribing = false;
    setPhase("listening");
  }

  async function startListening() {
    clearError();
    await ensureMediaStream();

    state.finalTranscript = "";
    els.interimText.textContent = "Start speaking when ready";

    state.isListening = true;
    updateMicButton();
    await startRecorder();

    if (state.recognition) {
      try {
        state.recognition.start();
      } catch {
        /* already started */
      }
    }

    updateUI();
  }

  async function stopListening() {
    if (!state.isListening && !state.isTranscribing) return;

    state.isListening = false;
    updateMicButton();
    updateUI();
    await stopRecordingAndTranscribe();
  }

  function resetAnswerState() {
    state.transcriptSegments = [];
    state.finalTranscript = "";
    state.audioChunks = [];
    els.answerText.value = "";
    els.interimText.textContent = "";
  }

  async function streamQuestion() {
    setPhase("streaming_question");
    resetAnswerState();
    els.questionText.textContent = "";
    clearError();

    const response = await fetch("/api/interview/question/stream");
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || "Failed to load question");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullText = "";
    let meta = {};

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = JSON.parse(line.slice(6));
        if (data.text) {
          fullText = data.text;
          els.questionText.textContent = fullText;
        }
        if (data.type) {
          meta = data;
          els.questionType.textContent =
            data.type === "technical" ? "Technical" : "Behavioral";
        }
        if (data.done) meta = data;
      }
    }

    if (meta.type) {
      els.questionType.textContent =
        meta.type === "technical" ? "Technical" : "Behavioral";
    }

    await speak(fullText);
    setPhase("listening");
    await startListening();
  }

  async function submitAnswer() {
    await stopListening();
    setPhase("submitting");
    clearError();

    const answer =
      els.answerText.value.trim() ||
      state.transcriptSegments.join(" ").trim() ||
      "(No answer provided)";

    const response = await fetch("/api/interview/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Failed to submit answer");
    }

    state.currentIndex = data.currentIndex;

    if (data.isComplete) {
      await generateReview();
    } else {
      await streamQuestion();
    }
  }

  async function generateReview() {
    setPhase("generating_review");
    els.reviewPanel.classList.remove("hidden");
    els.reviewStream.textContent = "Analyzing your interview responses…\n";

    if (state.mediaStream) {
      state.mediaStream.getTracks().forEach((track) => track.stop());
      state.mediaStream = null;
    }

    const response = await fetch("/api/interview/review/stream");
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || "Failed to generate review");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = JSON.parse(line.slice(6));
        if (data.chunk) els.reviewStream.textContent += data.chunk;
        if (data.done && data.review) {
          setTimeout(() => {
            window.location.href = "/interview/review";
          }, 800);
        }
      }
    }
  }

  async function startInterview() {
    clearError();
    els.startBtn.disabled = true;

    if (!state.canRecord) {
      showError(
        "Microphone is required for the interview. Allow mic access or type answers manually."
      );
      els.startBtn.disabled = false;
      return;
    }

    const response = await fetch("/api/interview/start", { method: "POST" });
    const data = await response.json();
    if (!response.ok) {
      showError(data.error || "Could not start interview");
      els.startBtn.disabled = false;
      return;
    }

    state.totalQuestions = data.totalQuestions;
    state.currentIndex = data.currentIndex;
    els.startBtn.classList.add("hidden");
    updateUI();
    await streamQuestion();
  }

  els.startBtn?.addEventListener("click", () => {
    startInterview().catch((err) => showError(err.message));
  });

  els.micBtn?.addEventListener("click", () => {
    if (state.isListening) {
      stopListening().catch((err) => showError(err.message));
    } else {
      startListening().catch((err) => showError(err.message));
    }
  });

  els.submitBtn?.addEventListener("click", () => {
    submitAnswer().catch((err) => {
      showError(err.message);
      setPhase("listening");
    });
  });

  els.skipBtn?.addEventListener("click", () => {
    els.answerText.value = "(Skipped)";
    state.transcriptSegments = ["(Skipped)"];
    submitAnswer().catch((err) => showError(err.message));
  });

  state.recognition = initRecognition();

  if (!state.canRecord) {
    showError(
      "Microphone access is unavailable. You can still type answers manually."
    );
  }

  updateUI();
})();
