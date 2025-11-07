document.addEventListener("DOMContentLoaded", () => {
  const host = document.getElementById("teacherPerformanceGraph");
  if (!host) return;

  const raw = document.getElementById("teacher_perf_data");
  let data = { labels: [], uploads: [], messages: [], strokes: [] };
  if (raw) {
    try { data = JSON.parse(raw.textContent); } catch {}
  }

  const canvas = document.createElement("canvas");
  host.textContent = "";
  host.appendChild(canvas);

  new Chart(canvas.getContext("2d"), {
    type: "bar",
    data: {
      labels: data.labels,
      datasets: [
        {
            label: "Uploads",
            data: data.uploads,
            backgroundColor: "#ff9f1c",
            borderColor: "#d87500",
            borderWidth: 2,
            borderRadius: 6
        },
        {
            label: "Messages",
            data: data.messages,
            backgroundColor: "#2ca866",
            borderColor: "#1f7d4c",
            borderWidth: 2,
            borderRadius: 6
        },
        {
            label: "Strokes",
            data: data.strokes,
            backgroundColor: "#4d7cff",
            borderColor: "#2f55b3",
            borderWidth: 2,
            borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      scales: {
        y: { beginAtZero: true }
      },
      plugins: {
        legend: { position: "top" }
      }
    }
  });
});