
async function submitCV() {
    const file = document.getElementById("cvFile").files[0];
    const role = document.getElementById("roleInput").value;
    const resultDiv = document.getElementById("result");

    if (!file || !role) {
        alert("Please upload a CV and enter a role.");
        return;
    }

    resultDiv.innerHTML = `<p class="text-gray-300">Analyzing... please wait ⏳</p>`;

    let formData = new FormData();
    formData.append("cv", file);
    formData.append("role", role);

    try {
        const response = await fetch("http://localhost:3001/analyze", {
            method: "POST",
            body: formData
        });

        const data = await response.json();

        resultDiv.innerHTML = `
            <!-- Summary -->
            
        `;

    } catch (error) {
        resultDiv.innerHTML = `<p class="text-red-400">Error: ${error.message}</p>`;
    }
}