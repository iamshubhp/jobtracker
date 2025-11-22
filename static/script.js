// Load applications when page loads
document.addEventListener("DOMContentLoaded", function () {
  loadUser();
  loadApplications();
  loadStats();

  // Set today's date as default
  document.getElementById("date_applied").valueAsDate = new Date();

  // Form submission
  document
    .getElementById("applicationForm")
    .addEventListener("submit", handleFormSubmit);
});

// Load user info
async function loadUser() {
  try {
    const response = await fetch("/api/user");
    if (response.ok) {
      const user = await response.json();
      document.getElementById("userName").textContent = `👋 ${user.name}`;
    } else {
      document.getElementById("userName").textContent = "User";
    }
  } catch (error) {
    console.error("Error loading user:", error);
    document.getElementById("userName").textContent = "User";
  }
}

// Logout function
async function logout() {
  if (!confirm("Are you sure you want to logout?")) return;

  try {
    const response = await fetch("/api/logout", { method: "POST" });
    if (response.ok) {
      window.location.href = "/login";
    }
  } catch (error) {
    console.error("Error logging out:", error);
  }
}

// Load all applications
async function loadApplications() {
  try {
    const response = await fetch("/api/applications");
    const applications = await response.json();

    const tbody = document.getElementById("applicationsBody");
    tbody.innerHTML = "";

    if (applications.length === 0) {
      tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 40px; color: #999;">
                        No applications yet. Click "Add New Application" to get started!
                    </td>
                </tr>
            `;
      return;
    }

    applications.forEach((app) => {
      const row = createTableRow(app);
      tbody.appendChild(row);
    });
  } catch (error) {
    console.error("Error loading applications:", error);
    alert("Failed to load applications. Please refresh the page.");
  }
}

// Create table row for an application
function createTableRow(app) {
  const tr = document.createElement("tr");

  const statusClass = `status-${app.status.toLowerCase()}`;
  const formattedDate = formatDate(app.date_applied);

  tr.innerHTML = `
        <td><strong>${escapeHtml(app.company)}</strong></td>
        <td>${escapeHtml(app.position)}</td>
        <td><span class="status-badge ${statusClass}">${escapeHtml(
    app.status
  )}</span></td>
        <td>${formattedDate}</td>
        <td>${escapeHtml(app.location || "-")}</td>
        <td>${escapeHtml(app.salary || "-")}</td>
        <td>
            <button class="btn-edit" onclick="editApplication('${
              app._id
            }')">Edit</button>
            <button class="btn-delete" onclick="deleteApplication('${
              app._id
            }')">Delete</button>
            ${
              app.job_url
                ? `<br><br><a href="${escapeHtml(
                    app.job_url
                  )}" target="_blank" class="job-link">View Job</a>`
                : ""
            }
        </td>
    `;

  return tr;
}

// Load statistics
async function loadStats() {
  try {
    const response = await fetch("/api/stats");
    const stats = await response.json();

    document.getElementById("total-apps").textContent = stats.total;
    document.getElementById("applied-count").textContent =
      stats.by_status["Applied"] || 0;
    document.getElementById("interview-count").textContent =
      stats.by_status["Interview"] || 0;
    document.getElementById("offer-count").textContent =
      stats.by_status["Offer"] || 0;
  } catch (error) {
    console.error("Error loading stats:", error);
  }
}

// Show add form
function showAddForm() {
  document.getElementById("formTitle").textContent = "Add New Application";
  document.getElementById("applicationForm").reset();
  document.getElementById("editId").value = "";
  document.getElementById("date_applied").valueAsDate = new Date();
  document.getElementById("formModal").style.display = "block";
}

// Edit application
async function editApplication(id) {
  try {
    const response = await fetch("/api/applications");
    const applications = await response.json();
    const app = applications.find((a) => a._id === id);

    if (!app) return;

    document.getElementById("formTitle").textContent = "Edit Application";
    document.getElementById("editId").value = app._id;
    document.getElementById("company").value = app.company;
    document.getElementById("position").value = app.position;
    document.getElementById("status").value = app.status;
    document.getElementById("date_applied").value = app.date_applied;
    document.getElementById("location").value = app.location || "";
    document.getElementById("salary").value = app.salary || "";
    document.getElementById("job_url").value = app.job_url || "";
    document.getElementById("notes").value = app.notes || "";

    document.getElementById("formModal").style.display = "block";
  } catch (error) {
    console.error("Error loading application:", error);
    alert("Failed to load application data.");
  }
}

// Delete application
async function deleteApplication(id) {
  if (!confirm("Are you sure you want to delete this application?")) {
    return;
  }

  try {
    const response = await fetch(`/api/applications/${id}`, {
      method: "DELETE",
    });

    if (response.ok) {
      loadApplications();
      loadStats();
    } else {
      alert("Failed to delete application.");
    }
  } catch (error) {
    console.error("Error deleting application:", error);
    alert("Failed to delete application.");
  }
}

// Handle form submission
async function handleFormSubmit(e) {
  e.preventDefault();

  const editId = document.getElementById("editId").value;
  const data = {
    company: document.getElementById("company").value,
    position: document.getElementById("position").value,
    status: document.getElementById("status").value,
    date_applied: document.getElementById("date_applied").value,
    location: document.getElementById("location").value,
    salary: document.getElementById("salary").value,
    job_url: document.getElementById("job_url").value,
    notes: document.getElementById("notes").value,
  };

  try {
    let response;
    if (editId) {
      // Update existing
      response = await fetch(`/api/applications/${editId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
    } else {
      // Create new
      response = await fetch("/api/applications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
    }

    if (response.ok) {
      closeForm();
      loadApplications();
      loadStats();
    } else {
      alert("Failed to save application.");
    }
  } catch (error) {
    console.error("Error saving application:", error);
    alert("Failed to save application.");
  }
}

// Close form modal
function closeForm() {
  document.getElementById("formModal").style.display = "none";
  document.getElementById("applicationForm").reset();
}

// Close modal when clicking outside
window.onclick = function (event) {
  const modal = document.getElementById("formModal");
  if (event.target === modal) {
    closeForm();
  }
};

// Utility functions
function formatDate(dateString) {
  if (!dateString) return "-";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
