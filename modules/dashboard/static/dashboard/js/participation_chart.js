document.addEventListener("DOMContentLoaded", () => {
  const host = document.getElementById("participationGraph");
  if (!host) return;
  const raw = document.getElementById("student_perf_data");
  let data = { labels: [], strokes: [], uploads: [] };
  if (raw) { try { data = JSON.parse(raw.textContent); } catch {} }

  const canvas = document.createElement("canvas");
  host.textContent = "";
  host.appendChild(canvas);

  new Chart(canvas.getContext("2d"), {
    type: "bar",
    data: {
      labels: data.labels,
      datasets: [
        { label:"Strokes", data:data.strokes, backgroundColor:"#2ca866", borderColor:"#1f7d4c", borderWidth:2, borderRadius:6 },
        { label:"Uploads", data:data.uploads, backgroundColor:"#ff9f1c", borderColor:"#d87500", borderWidth:2, borderRadius:6 }
      ]
    },
    options: { responsive:true, maintainAspectRatio:false, scales:{ y:{ beginAtZero:true } } }
  });
});