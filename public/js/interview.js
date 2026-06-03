(function () {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  const state = {
    totalQuestions: 0,
    currentIndex: 0,
    phase: "idle", // idle | streaming_question | listening | submitting | generating_review
    recognition: null,
    finalTranscript: "",
    interimTranscript: "",
    isListening: false,
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
      submitting: ["Saving answer…", "badge-neutral"],
      generating_review: ["Generating review…", "badge"],
    };
    const [label, cls] = badges[state.phase] || badges.idle;
    els.statusBadge.textContent = label;
    els.statusBadge.className = `${cls} px-3 py-1 rounded-full text-xs font-medium`;

    els.micBtn.disabled =
      state.phase !== "listening" || !SpeechRecognition;
    els.submitBtn.disabled = state.phase !== "listening";
    els.skipBtn.disabled = state.phase !== "listening";
    els.startBtn.disabled = state.phase !== "idle";
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
    if (!SpeechRecognition) {
      showError(
        "Voice input is not supported in this browser. Type your answer in the text area below."
      );
      return null;
    }

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
      state.interimTranscript = interim;
      els.answerText.value = state.finalTranscript;
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
      state.isListening = false;
      updateUI();
    };

    recognition.onend = () => {
      if (state.isListening && state.phase === "listening") {
        try {
          recognition.start();
        } catch {
          state.isListening = false;
          updateUI();
        }
      }
    };

    return recognition;
  }

  function startListening() {
    if (!state.recognition) return;
    state.finalTranscript = "";
    state.interimTranscript = "";
    els.answerText.value = "";
    els.interimText.textContent = "Start speaking when ready";
    state.isListening = true;
    try {
      state.recognition.start();
    } catch {
      /* already started */
    }
    updateUI();
  }

  function stopListening() {
    state.isListening = false;
    if (state.recognition) {
      try {
        state.recognition.stop();
      } catch {
        /* ignore */
      }
    }
    updateUI();
  }

  async function streamQuestion() {
    setPhase("streaming_question");
    els.questionText.textContent = "";
    els.answerText.value = "";
    els.interimText.textContent = "";
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
        if (data.done) {
          meta = data;
        }
      }
    }

    if (meta.type) {
      els.questionType.textContent =
        meta.type === "technical" ? "Technical" : "Behavioral";
    }

    await speak(fullText);
    setPhase("listening");
    startListening();
  }

  async function submitAnswer() {
    stopListening();
    setPhase("submitting");
    clearError();

    const answer =
      els.answerText.value.trim() || state.finalTranscript.trim() || "(No answer provided)";

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
        if (data.chunk) {
          els.reviewStream.textContent += data.chunk;
        }
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
      stopListening();
    } else {
      startListening();
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
    submitAnswer().catch((err) => showError(err.message));
  });

  state.recognition = initRecognition();
  updateUI();
})();
